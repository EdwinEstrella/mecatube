import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VoiceOptions from './VoiceOptions.jsx';
import VoicePlayer from './VoicePlayer.jsx';
import { DEFAULT_MODEL, DEFAULT_VOICE, cleanIpcError } from './constants.js';
import { narrationFromChat } from './narration.js';
import { useVoicePrefs } from './useVoicePrefs.js';

const SAVE_DELAY_MS = 700;

// Container: narration text, voice choice, generation and the resulting track for one video
export default function VoicePanel({ video, scriptMessages, voice, onSaveNarration }) {
  const api = window.electronAPI;
  const derived = useMemo(() => narrationFromChat(scriptMessages), [scriptMessages]);
  // null until the user types or resets in this session; then the text shown is the draft
  const [draft, setDraft] = useState(null);
  const text = draft ?? video.narrationText ?? derived;
  const characters = text.length;

  const prefs = useVoicePrefs();
  const [configured, setConfigured] = useState(null);
  const [voiceId, setVoiceId] = useState(voice?.voiceId || DEFAULT_VOICE.id);
  const [voiceName, setVoiceName] = useState(voice?.voiceName || DEFAULT_VOICE.name);
  const [model, setModel] = useState(voice?.model || DEFAULT_MODEL);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  // Debounced save of the edited text; `undefined` means nothing is waiting
  const pendingRef = useRef(undefined);
  const timerRef = useRef(null);
  const saveRef = useRef(onSaveNarration);
  saveRef.current = onSaveNarration;

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    if (pendingRef.current === undefined) return;
    const value = pendingRef.current;
    pendingRef.current = undefined;
    saveRef.current(video.id, value);
  }, [video.id]);

  useEffect(() => flush, [flush]);

  const queueSave = (value) => {
    pendingRef.current = value;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  // The last voice and model used anywhere become the defaults when the panel opens
  useEffect(() => {
    if (!prefs) return;
    setVoiceId(prefs.voiceId);
    setVoiceName(prefs.voiceName);
    setModel(prefs.model);
  }, [prefs]);

  useEffect(() => {
    if (voice?.voiceId) return;
    if (!api || !video?.branchId) return;
    api.listBranches?.().then((branches) => {
      const branch = (branches || []).find((b) => b.id === video.branchId);
      if (branch?.narratorVoiceId) {
        setVoiceId(branch.narratorVoiceId);
        setVoiceName('Narrador de rama');
      }
    }).catch(() => {});
  }, [api, video?.branchId, voice?.voiceId]);

  useEffect(() => {
    if (!api) return undefined;
    api.getCartesiaStatus().then((status) => setConfigured(status.configured), () => setConfigured(false));
    api.getActiveVoice().then((activeId) => setIsGenerating(activeId === video.id), () => {});
    const offProgress = api.onVoiceProgress((progress) => {
      if (progress.videoId === video.id) setSeconds(progress.seconds);
    });
    const offFinished = api.onVoiceFinished((result) => {
      if (result.videoId !== video.id) return;
      setIsGenerating(false);
      setIsConfirming(false);
    });
    return () => {
      offProgress();
      offFinished();
    };
  }, [api, video.id]);

  const handleChange = (value) => {
    setDraft(value);
    queueSave(value);
  };

  const handleReset = () => {
    setDraft(derived);
    queueSave(null);
  };

  const handleGenerate = async () => {
    setIsConfirming(false);
    setError('');
    setSeconds(0);
    setIsGenerating(true);
    flush();
    try {
      await api.generateVoice({
        videoId: video.id,
        text,
        voiceId,
        voiceName: voiceName || voiceId,
        model,
      });
    } catch (generateError) {
      setError(cleanIpcError(generateError));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenFolder = () => api.openVoiceFolder(video.id).catch((openError) => setError(cleanIpcError(openError)));

  const canGenerate = configured === true && text.trim() !== '' && !isGenerating;
  const verb = voice ? 'Regenerar' : 'Generar';

  return (
    <div className="voice-panel">
      <h4 className="voice-panel__title">Voz</h4>

      <textarea
        className="prompt-editor__text voice-panel__text"
        value={text}
        spellCheck={false}
        placeholder="Texto de la narración. Se completa desde el chat del guion cuando existe un guion."
        aria-label="Texto de la narración"
        disabled={isGenerating}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={flush}
      />
      <div className="voice-panel__meta">
        <span className="settings__card-text">
          {characters.toLocaleString('es-ES')} caracteres
        </span>
        <button
          type="button"
          className="settings__button settings__button--ghost"
          disabled={isGenerating || text === derived}
          onClick={handleReset}
        >
          Restaurar desde el guion
        </button>
      </div>

      <VoiceOptions
        voiceId={voiceId}
        voiceName={voiceName}
        model={model}
        disabled={isGenerating}
        onVoiceChange={(chosen) => {
          setVoiceId(chosen.id);
          setVoiceName(chosen.name);
        }}
        onModelChange={setModel}
      />

      <div className="voice-panel__actions">
        {isGenerating ? (
          <>
            <span className="settings__card-text">
              Generando… {seconds > 0 ? `${seconds.toFixed(1)} s de audio hasta ahora` : 'esperando a Cartesia'}
            </span>
            <button type="button" className="settings__button settings__button--ghost" onClick={() => api.cancelVoice()}>
              Cancelar
            </button>
          </>
        ) : isConfirming ? (
          <>
            <span className="settings__card-text">
              {voice ? 'Esto reemplazará la pista actual.' : '¿Generar la voz en off para esta narración?'}
            </span>
            <button type="button" className="settings__button settings__button--primary" onClick={handleGenerate}>
              Confirmar
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={() => setIsConfirming(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="settings__button settings__button--primary"
              disabled={!canGenerate}
              onClick={() => setIsConfirming(true)}
            >
              {verb}
            </button>
            {configured === false && (
              <span className="settings__card-text">Para generar, añade tu clave de API de Cartesia en Configuración → Cartesia.</span>
            )}
          </>
        )}
      </div>

      {error && <p className="prompt-editor__error">{error}</p>}

      {voice && <VoicePlayer videoId={video.id} voice={voice} onOpenFolder={handleOpenFolder} />}
    </div>
  );
}
