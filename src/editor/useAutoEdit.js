// Hook managing automatic video editing state, AI direct-edit generation, and fallback logic.
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildPhrases } from './timing.js';
import { extractJsonCandidate, normalizeEdl } from './edl.js';
import {
  applyStyling,
  defaultStyling,
  phrasesToWordIndex,
  placeVideos,
} from './placement.js';
import { sceneSummaries } from './sceneSummary.js';
import { probeDurations } from './clipDurations.js';
import { animationVideoUrl, latestVideo } from '../flow/animationStatus.js';
import { latestFiles, sceneImageUrl } from '../flow/sceneStatus.js';
import { collectImageScenes } from '../flow/parseImageScenes.js';
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

function isValidWord(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.s === 'number' &&
    Number.isFinite(item.s) &&
    typeof item.e === 'number' &&
    Number.isFinite(item.e)
  );
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
  const [syncStats, setSyncStats] = useState(null);
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
    words: [],
    anchors: [],
    scenesMeta: [],
  });

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;

    if (!videoId) {
      setStatus('missing');
      setMissing(['No se ha seleccionado ningún video.']);
      setEdl(null);
      edlRef.current = null;
      setSyncStats(null);
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
      const [voiceMeta, anims, savedEdit, busy, scenesList, videosList] = await Promise.all([
        api?.getVoice?.(videoId) ?? null,
        api?.getAnimations?.(videoId) ?? [],
        api?.getEdit?.(videoId) ?? null,
        api?.getEditBusy?.() ?? false,
        api?.getScenes?.(videoId) ?? [],
        api?.listVideos?.() ?? [],
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

      // Collect image scenes from illustrator conversation if present
      const currentVideo = Array.isArray(videosList) ? videosList.find((v) => v?.id === videoId) : null;
      let collectedChatScenes = [];
      if (currentVideo?.illustratorConversationId) {
        try {
          const conv = await api?.getConversation?.(currentVideo.illustratorConversationId);
          if (conv?.messages) {
            collectedChatScenes = collectImageScenes(conv.messages);
          }
        } catch {
          collectedChatScenes = [];
        }
      }

      if (reqId !== reqIdRef.current) return;

      const sceneMap = new Map();
      for (const scene of Array.isArray(scenesList) ? scenesList : []) {
        if (scene && Number.isInteger(scene.number)) {
          sceneMap.set(scene.number, {
            number: scene.number,
            title: scene.title || `Escena ${scene.number}`,
            prompt: scene.prompt || '',
            scriptAnchor: '',
            kind: scene.kind,
          });
        }
      }
      for (const scene of collectedChatScenes) {
        if (scene && Number.isInteger(scene.number)) {
          const existing = sceneMap.get(scene.number) || {};
          sceneMap.set(scene.number, {
            number: scene.number,
            title: scene.title || existing.title || `Escena ${scene.number}`,
            prompt: scene.prompt || existing.prompt || '',
            scriptAnchor: scene.scriptAnchor || existing.scriptAnchor || '',
            kind: scene.kind || existing.kind,
          });
        }
      }

      const anchors = availableNums.map((num) => ({
        number: num,
        text: sceneMap.get(num)?.scriptAnchor || '',
      }));

      const scenesMeta = availableNums.map((num) => {
        const item = sceneMap.get(num);
        return {
          number: num,
          title: item?.title || `Escena ${num}`,
          prompt: item?.prompt || '',
          scriptAnchor: item?.scriptAnchor || '',
          kind: item?.kind,
        };
      });

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
        words: wordsList,
        anchors,
        scenesMeta,
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
            phrases: [],
          });
          const resolvedEdl = normEdl ? { ...normEdl, syncStats: savedEdit.syncStats } : null;
          setEdl(resolvedEdl);
          edlRef.current = resolvedEdl;
          setSyncStats(savedEdit.syncStats || null);
          setWarnings(normWarnings);
          setAdjustments(normWarnings.length);
          setNotices([]);
          setUsedFallback(Boolean(savedEdit.isFallback));
        } else {
          setEdl(null);
          edlRef.current = null;
          setSyncStats(null);
          setWarnings([]);
          setAdjustments(0);
          setNotices([]);
          setUsedFallback(false);
        }
      } else {
        setEdl(null);
        edlRef.current = null;
        setSyncStats(null);
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
      const { duration, available, phrases, words, anchors, scenesMeta } = dataRef.current;

      if (!duration || !available || available.length === 0 || !phrases || phrases.length === 0) {
        setError('No se puede generar la edición porque faltan recursos necesarios.');
        return;
      }

      setStatus('directing');
      setError('');
      setWarnings([]);
      setAdjustments(0);
      setNotices([]);

      const finalNotices = [];
      let isFallback = false;

      const summaries = sceneSummaries(scenesMeta);
      const summaryMap = new Map(summaries.map((s) => [s.number, s.summary]));

      // 1. Initial placement with anchors only
      let placement = placeVideos({
        words,
        duration,
        available,
        anchors,
        aiAssignments: [],
      });

      // 2. If anchors did not cover all videos, attempt AI alignment pass
      if (placement.stats.anchor < placement.stats.total) {
        const anchoredClips = placement.clips.filter((c) => c.source === 'anchor');
        const anchoredSet = new Set(anchoredClips.map((c) => c.number));
        const anchoredPhraseMap = new Map();

        for (const clip of anchoredClips) {
          const pIdx = phrases.findIndex(
            (p) => clip.start >= p.start && clip.start <= p.end
          );
          if (pIdx !== -1) {
            anchoredPhraseMap.set(clip.number, phrases[pIdx].i ?? phrases[pIdx].index ?? pIdx);
          } else {
            let bestIdx = 0;
            let bestDiff = Infinity;
            for (let i = 0; i < phrases.length; i += 1) {
              const diff = Math.abs(phrases[i].start - clip.start);
              if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
              }
            }
            anchoredPhraseMap.set(clip.number, phrases[bestIdx].i ?? phrases[bestIdx].index ?? bestIdx);
          }
        }

        const phrasesPayload = phrases.map((p, idx) => ({
          i: typeof p.i === 'number' ? p.i : (p.index ?? idx),
          text: p.text,
        }));

        const scenesPayload = scenesMeta.map((s) => {
          const isAnchored = anchoredSet.has(s.number);
          return {
            number: s.number,
            title: s.title || `Escena ${s.number}`,
            summary: summaryMap.get(s.number) || '',
            needed: !isAnchored,
            fixedPhrase: isAnchored ? (anchoredPhraseMap.get(s.number) ?? null) : null,
          };
        });

        try {
          const alignRes = await api?.alignEdit?.({
            videoId,
            phrases: phrasesPayload,
            scenes: scenesPayload,
          });
          const jsonCandidate = extractJsonCandidate(alignRes?.raw);
          const parsed = jsonCandidate ? JSON.parse(jsonCandidate) : null;
          if (parsed && Array.isArray(parsed.assignments)) {
            const phraseToWord = phrasesToWordIndex(phrases, words);
            const aiAssignments = [];
            for (const item of parsed.assignments) {
              if (item && Number.isInteger(item.number) && Number.isInteger(item.phrase)) {
                const wIdx = phraseToWord[item.phrase];
                if (typeof wIdx === 'number' && Number.isInteger(wIdx)) {
                  aiAssignments.push({ number: item.number, wordIndex: wIdx });
                }
              }
            }
            placement = placeVideos({
              words,
              duration,
              available,
              anchors,
              aiAssignments,
            });
          } else {
            finalNotices.push('No se pudo alinear con IA; algunos videos se ubicaron por estimación.');
          }
        } catch {
          finalNotices.push('No se pudo alinear con IA; algunos videos se ubicaron por estimación.');
        }
      }

      // 3. Fixed clips ready: prepare payload with narration text for visual styling
      const clipsPayload = placement.clips.map((c) => {
        const coveredWords = words.filter(
          (w) => isValidWord(w) && w.e > c.start && w.s < c.end
        );
        const clipText = coveredWords
          .map((w) => w.w.trim())
          .join(' ')
          .slice(0, 2000);
        const sMeta = scenesMeta.find((s) => s.number === c.number);
        const isExplainer =
          sMeta?.kind === 'explanation' ||
          sMeta?.kind === 'explainer' ||
          /explicaci/i.test(sMeta?.title || '') ||
          /reads exactly/i.test(sMeta?.prompt || '') ||
          /layout:/i.test(sMeta?.prompt || '');
        const kind = isExplainer ? 'explainer' : 'scene';
        const clipDuration = Math.round((c.end - c.start + Number.EPSILON) * 1000) / 1000;

        return {
          number: c.number,
          start: c.start,
          end: c.end,
          duration: clipDuration,
          text: clipText,
          summary: summaryMap.get(c.number) || '',
          kind,
        };
      });

      let finalEdl = null;
      let finalWarnings = placement.warnings || [];

      try {
        const directRes = await api?.directEdit?.({
          videoId,
          duration,
          clips: clipsPayload,
          notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
        });

        const styled = applyStyling(placement.clips, directRes?.raw, { duration });
        if (styled.edl) {
          finalEdl = styled.edl;
          finalWarnings = [...finalWarnings, ...styled.warnings];
          isFallback = false;
        } else {
          finalEdl = defaultStyling(placement.clips, { duration });
          finalNotices.push('La IA no devolvió un formato válido; se aplicó el estilo predeterminado.');
          isFallback = true;
        }
      } catch {
        finalEdl = defaultStyling(placement.clips, { duration });
        finalNotices.push('Error al comunicarse con la IA; se aplicó el estilo predeterminado.');
        isFallback = true;
      }

      if (finalEdl) {
        try {
          const withStyle = {
            ...finalEdl,
            captionStyle: captionStyleRef.current,
            syncStats: placement.stats,
          };
          const toSave = { ...withStyle, isFallback };
          await api?.saveEdit?.(videoId, toSave);
          if (!isEditingDone(stagesRef.current)) {
            await api?.setVideoStage?.(videoId, 'editing', true);
          }
          await onEditedRef.current?.();
          setEdl(withStyle);
          edlRef.current = withStyle;
          setSyncStats(placement.stats);
          setWarnings(finalWarnings);
          setAdjustments(finalWarnings.length);
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
    [videoId]
  );

  const runFallback = useCallback(async () => {
    const api = window.electronAPI;
    const { duration, available, words, anchors } = dataRef.current;

    if (!duration || !available || available.length === 0) {
      setError('No se puede generar la edición porque faltan recursos necesarios.');
      return;
    }

    setError('');
    setWarnings([]);
    setAdjustments(0);
    setNotices([]);

    const placement = placeVideos({
      words,
      duration,
      available,
      anchors,
      aiAssignments: [],
    });

    const edlResult = defaultStyling(placement.clips, { duration });
    if (!edlResult) {
      setError('No se pudo generar la edición de respaldo.');
      setStatus('error');
      return;
    }

    const withStyle = {
      ...edlResult,
      captionStyle: captionStyleRef.current,
      syncStats: placement.stats,
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
      setSyncStats(placement.stats);
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
    syncStats: syncStats || edl?.syncStats || null,
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
