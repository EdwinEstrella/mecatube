import { useEffect, useState } from 'react';
import VoicePicker from './VoicePicker.jsx';
import VoicePlayer from './VoicePlayer.jsx';

// Presentational: voice-over button, inline confirm, progress and player under one script message.
// phase: 'idle' | 'confirm' | 'generating'.
export default function ScriptVoiceControl({
  chars,
  voiceId,
  voiceName,
  videoId,
  track,
  configured,
  busyElsewhere,
  phase,
  seconds,
  error,
  remaining,
  expandPlayer,
  onVoiceChange,
  onRequest,
  onConfirm,
  onCancelConfirm,
  onCancelGeneration,
  onOpenFolder,
  onOpenTimeline,
  onOpenSettings,
}) {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  useEffect(() => {
    if (expandPlayer) setIsPlayerOpen(true);
  }, [expandPlayer]);

  const canGenerate = configured === true && !busyElsewhere && chars > 0;

  return (
    <div className="script-voice">
      <div className="script-voice__row">
        {phase === 'generating' ? (
          <>
            <span className="settings__card-text">
              Generando voz en off… {seconds > 0 ? `${seconds.toFixed(1)} s de audio` : 'esperando a Cartesia'}
            </span>
            <button type="button" className="settings__button settings__button--ghost" onClick={onCancelGeneration}>
              Cancelar
            </button>
          </>
        ) : phase === 'confirm' ? (
          <>
            <span className="settings__card-text">
              ¿Generar locución con Cartesia? ({chars.toLocaleString('es-ES')} caracteres{voiceName ? ` · Voz: ${voiceName}` : ''})
            </span>
            <button type="button" className="settings__button settings__button--primary" onClick={onConfirm}>
              Confirmar
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={onCancelConfirm}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="settings__button settings__button--ghost"
              disabled={!canGenerate}
              onClick={onRequest}
            >
              {track ? 'Regenerar voz en off' : 'Generar voz en off'}
            </button>
            {configured === false && (
              <button type="button" className="script-voice__hint" onClick={onOpenSettings}>
                Configura tu clave de Cartesia en Configuración
              </button>
            )}
            {configured && busyElsewhere && <span className="settings__card-text">Hay otra voz en off generándose.</span>}
          </>
        )}
      </div>

      {phase === 'confirm' && (
        <VoicePicker voiceId={voiceId} voiceName={voiceName} onChange={onVoiceChange} />
      )}

      {error && <p className="prompt-editor__error">{error}</p>}

      {track && videoId && phase !== 'generating' && (
        <details className="script-voice__player" open={isPlayerOpen} onToggle={(event) => setIsPlayerOpen(event.currentTarget.open)}>
          <summary>Voz en off de este video</summary>
          {isPlayerOpen && (
            <VoicePlayer videoId={videoId} voice={track} openLabel="Abrir carpeta" onOpenFolder={onOpenFolder}>
              <button type="button" className="settings__button settings__button--ghost" onClick={onOpenTimeline}>
                Ver en la línea de tiempo
              </button>
            </VoicePlayer>
          )}
        </details>
      )}
    </div>
  );
}
