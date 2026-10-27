// Hook managing automatic video editing state, AI direct-edit generation, and fallback logic.
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildPhrases } from './timing.js';
import { fallbackEdl, normalizeEdl } from './edl.js';
import { probeDurations } from './clipDurations.js';
import { animationVideoUrl, latestVideo } from '../flow/animationStatus.js';
import { latestFiles, sceneImageUrl } from '../flow/sceneStatus.js';
import { DEFAULT_CAPTION_STYLE, normalizeCaptionStyle } from './captionStyle.js';
import { cleanIpcError } from '../voice/constants.js';

function isEditingDone(stages) {
  if (Array.isArray(stages)) {
    return stages.find((s) => s?.key === 'editing')?.status === 'done';
  }
  if (stages && typeof stages === 'object') {
    return stages.editing === true || stages.editing === 'done' || stages.editing?.status === 'done';
  }
  return false;
}

export function useAutoEdit(videoId, options = {}) {
  const opts = typeof options === 'function' ? { onEdited: options } : options || {};
  const { onEdited, stages } = opts;

  const onEditedRef = useRef(onEdited);
  onEditedRef.current = onEdited;
  const stagesRef = useRef(stages);
  stagesRef.current = stages;

  const reqIdRef = useRef(0);

  const [status, setStatus] = useState('loading');
  const [missing, setMissing] = useState([]);
  const [edl, setEdl] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [adjustments, setAdjustments] = useState(0);
  const [notices, setNotices] = useState([]);
  const [error, setError] = useState('');
  const [usedFallback, setUsedFallback] = useState(false);
  const [sources, setSources] = useState({});
  const [audioUrl, setAudioUrl] = useState('');
  const [words, setWords] = useState([]);
  const [clipDurations, setClipDurations] = useState({});
  const [captionStyle, setCaptionStyleState] = useState(DEFAULT_CAPTION_STYLE);
  const [available, setAvailable] = useState([]);
  const [sceneImages, setSceneImages] = useState({});

  const captionStyleRef = useRef(DEFAULT_CAPTION_STYLE);
  const edlRef = useRef(null);
  const saveStyleTimeoutRef = useRef(null);

  const dataRef = useRef({
    duration: 0,
    available: [],
    phrases: [],
    animList: [],
    sources: {},
    audioUrl: '',
  });

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;

    if (!videoId) {
      setStatus('missing');
      setMissing(['No se ha seleccionado ningún video.']);
      setEdl(null);
      edlRef.current = null;
      setSources({});
      setAudioUrl('');
      setWords([]);
      setClipDurations({});
      setWarnings([]);
      setAdjustments(0);
      setNotices([]);
      setCaptionStyleState(DEFAULT_CAPTION_STYLE);
      captionStyleRef.current = DEFAULT_CAPTION_STYLE;
      setAvailable([]);
      setSceneImages({});
      return;
    }

    setStatus('loading');
    setError('');
    setWarnings([]);
    setAdjustments(0);
    setNotices([]);

    const api = window.electronAPI;
    try {
      const [voiceMeta, anims, savedEdit, busy, scenesList] = await Promise.all([
        api?.getVoice?.(videoId) ?? null,
        api?.getAnimations?.(videoId) ?? [],
        api?.getEdit?.(videoId) ?? null,
        api?.getEditBusy?.() ?? false,
        api?.getScenes?.(videoId) ?? [],
      ]);

      if (reqId !== reqIdRef.current) return;

      const duration = voiceMeta?.duration;
      const rawWords = voiceMeta?.words;
      const wordsList = Array.isArray(rawWords) ? rawWords : [];
      const phrases = buildPhrases(wordsList);

      const animList = Array.isArray(anims) ? anims : [];
      const availableItems = animList.filter((anim) => {
        if (!anim || typeof anim !== 'object' || !Number.isInteger(anim.number)) return false;
        return latestVideo(anim) !== null;
      });
      const availableNums = availableItems.map((a) => a.number);

      const currentSources = {};
      for (const anim of availableItems) {
        const file = latestVideo(anim);
        currentSources[anim.number] = animationVideoUrl(videoId, anim.number, file);
      }

      const currentSceneImages = {};
      for (const scene of Array.isArray(scenesList) ? scenesList : []) {
        if (scene && Number.isInteger(scene.number)) {
          const file = scene.selectedFile || latestFiles(scene)[0];
          if (file) {
            currentSceneImages[scene.number] = sceneImageUrl(videoId, scene.number, file);
          }
        }
      }

      const currentAudioUrl = `mecatube-media://voice/${encodeURIComponent(videoId)}`;

      const missingReasons = [];
      const hasVoice =
        typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && phrases.length > 0;
      if (!hasVoice) {
        missingReasons.push('Falta la voz en off (genera la narración en el panel de Voz).');
      }
      if (availableNums.length === 0) {
        missingReasons.push('No hay animaciones con video generado (genera al menos una animación).');
      }

      dataRef.current = {
        duration: typeof duration === 'number' && Number.isFinite(duration) ? duration : 0,
        available: availableNums,
        phrases,
        animList,
        sources: currentSources,
        audioUrl: currentAudioUrl,
      };

      setSources(currentSources);
      setSceneImages(currentSceneImages);
      setAvailable(availableNums);
      setAudioUrl(currentAudioUrl);
      setWords(wordsList);
      setMissing(missingReasons);

      // Initialize caption style from saved edit, or default if absent
      const initialStyle = savedEdit?.captionStyle
        ? normalizeCaptionStyle(savedEdit.captionStyle)
        : DEFAULT_CAPTION_STYLE;
      setCaptionStyleState(initialStyle);
      captionStyleRef.current = initialStyle;

      // Probe clip durations in the background
      if (Object.keys(currentSources).length > 0) {
        probeDurations(currentSources).then((durations) => {
          if (reqId === reqIdRef.current) {
            setClipDurations(durations);
          }
        });
      } else {
        setClipDurations({});
      }

      // Re-normalize saved edit against current available animations before use
      if (savedEdit) {
        if (hasVoice && availableNums.length > 0) {
          const { edl: normEdl, warnings: normWarnings } = normalizeEdl(savedEdit, {
            duration,
            available: availableNums,
            phrases,
          });
          setEdl(normEdl);
          edlRef.current = normEdl;
          setWarnings(normWarnings);
          setAdjustments(normWarnings.length);
          setNotices([]);
          setUsedFallback(Boolean(savedEdit.isFallback));
        } else {
          setEdl(null);
          edlRef.current = null;
          setWarnings([]);
          setAdjustments(0);
          setNotices([]);
          setUsedFallback(false);
        }
      } else {
        setEdl(null);
        edlRef.current = null;
        setWarnings([]);
        setAdjustments(0);
        setNotices([]);
        setUsedFallback(false);
      }

      if (busy) {
        setStatus('directing');
      } else if (missingReasons.length > 0) {
        setStatus('missing');
      } else {
        setStatus('ready');
      }
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setError(cleanIpcError(err));
      setStatus('error');
    }
  }, [videoId]);

  useEffect(() => {
    load();
    return () => {
      reqIdRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    return () => {
      if (saveStyleTimeoutRef.current) {
        clearTimeout(saveStyleTimeoutRef.current);
      }
    };
  }, []);

  const setCaptionStyle = useCallback(
    (next) => {
      let resolvedStyle;
      setCaptionStyleState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        resolvedStyle = normalizeCaptionStyle(resolved);
        captionStyleRef.current = resolvedStyle;
        return resolvedStyle;
      });

      if (saveStyleTimeoutRef.current) {
        clearTimeout(saveStyleTimeoutRef.current);
        saveStyleTimeoutRef.current = null;
      }

      if (edlRef.current) {
        saveStyleTimeoutRef.current = setTimeout(async () => {
          if (!videoId || !edlRef.current) return;
          const currentStyle = captionStyleRef.current;
          const mergedEdl = { ...edlRef.current, captionStyle: currentStyle };
          setEdl(mergedEdl);
          edlRef.current = mergedEdl;
          try {
            await window.electronAPI?.saveEdit?.(videoId, mergedEdl);
            await onEditedRef.current?.();
          } catch (err) {
            console.error('Failed to save caption style', err);
          }
        }, 500);
      }
    },
    [videoId]
  );

  const generate = useCallback(
    async (notes) => {
      const api = window.electronAPI;
      const { duration, available, phrases, animList } = dataRef.current;

      if (!duration || !available || available.length === 0 || !phrases || phrases.length === 0) {
        setError('No se puede generar la edición porque faltan recursos necesarios.');
        return;
      }

      setStatus('directing');
      setError('');
      setWarnings([]);
      setAdjustments(0);
      setNotices([]);

      const phrasesPayload = phrases.map((p, idx) => ({
        i: typeof p.index === 'number' ? p.index : idx,
        start: p.start,
        end: p.end,
        text: p.text,
      }));

      const availableSet = new Set(available);
      const animationsPayload = animList
        .filter((a) => availableSet.has(a.number))
        .map((a) => ({
          number: a.number,
          title: a.title ?? `Animación ${a.number}`,
          hook: Boolean(a.hook),
        }));

      let finalEdl = null;
      let finalWarnings = [];
      let finalAdjustments = 0;
      let finalNotices = [];
      let isFallback = false;

      try {
        const result = await api?.directEdit?.({
          videoId,
          duration,
          phrases: phrasesPayload,
          animations: animationsPayload,
          notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
        });

        const raw = result?.raw;
        const normalized = normalizeEdl(raw, { duration, available, phrases });
        if (normalized.edl) {
          finalEdl = normalized.edl;
          finalWarnings = normalized.warnings;
          finalAdjustments = normalized.warnings.length;
          finalNotices = [];
          isFallback = false;
        } else {
          finalEdl = fallbackEdl({ duration, available, phrases });
          finalWarnings = normalized.warnings;
          finalAdjustments = normalized.warnings.length;
          finalNotices = [
            'La IA no devolvió un formato válido; se aplicó una edición de respaldo automática.',
          ];
          isFallback = true;
        }
      } catch (err) {
        const errorMsg = cleanIpcError(err);
        setError(errorMsg);
        finalEdl = fallbackEdl({ duration, available, phrases });
        finalWarnings = [];
        finalAdjustments = 0;
        finalNotices = ['Error al comunicarse con la IA; se aplicó una edición de respaldo automática.'];
        isFallback = true;
      }

      if (finalEdl) {
        try {
          const withStyle = {
            ...finalEdl,
            captionStyle: captionStyleRef.current,
          };
          const toSave = { ...withStyle, isFallback };
          await api?.saveEdit?.(videoId, toSave);
          if (!isEditingDone(stagesRef.current)) {
            await api?.setVideoStage?.(videoId, 'editing', true);
          }
          await onEditedRef.current?.();
          setEdl(withStyle);
          edlRef.current = withStyle;
          setWarnings(finalWarnings);
          setAdjustments(finalAdjustments);
          setNotices(finalNotices);
          setUsedFallback(isFallback);
          setStatus('ready');
        } catch (saveErr) {
          setError(cleanIpcError(saveErr));
          setStatus('error');
        }
      } else {
        setStatus('error');
        setError('No se pudo generar la edición.');
      }
    },
    [videoId],
  );

  const runFallback = useCallback(async () => {
    const api = window.electronAPI;
    const { duration, available, phrases } = dataRef.current;

    if (!duration || !available || available.length === 0 || !phrases || phrases.length === 0) {
      setError('No se puede generar la edición porque faltan recursos necesarios.');
      return;
    }

    setError('');
    setWarnings([]);
    setAdjustments(0);
    setNotices([]);

    const edlResult = fallbackEdl({ duration, available, phrases });
    if (!edlResult) {
      setError('No se pudo generar la edición de respaldo.');
      setStatus('error');
      return;
    }

    const withStyle = {
      ...edlResult,
      captionStyle: captionStyleRef.current,
    };

    try {
      const toSave = { ...withStyle, isFallback: true };
      await api?.saveEdit?.(videoId, toSave);
      if (!isEditingDone(stagesRef.current)) {
        await api?.setVideoStage?.(videoId, 'editing', true);
      }
      await onEditedRef.current?.();
      setEdl(withStyle);
      edlRef.current = withStyle;
      setWarnings([]);
      setAdjustments(0);
      setNotices([]);
      setUsedFallback(true);
      setStatus('ready');
    } catch (saveErr) {
      setError(cleanIpcError(saveErr));
      setStatus('error');
    }
  }, [videoId]);

  return {
    status,
    missing,
    edl,
    adjustments,
    notices,
    error,
    usedFallback,
    sources,
    audioUrl,
    words,
    clipDurations,
    captionStyle,
    setCaptionStyle,
    available,
    sceneImages,
    generate,
    runFallback,
  };
}
