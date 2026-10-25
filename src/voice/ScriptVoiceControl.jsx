import { useEffect, useState } from 'react';
import VoicePlayer from './VoicePlayer.jsx';
import { formatCredits } from './creditsText.js';

const LOCALE = 'es-ES';

// Presentational: voice-over button, inline confirm, progress and player under one script message.
// phase: 'idle' | 'confirm' | 'generating'; remaining: { left, over } estimate for this narration.
export default function ScriptVoiceControl({
  chars,
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
            <span className={`settings__card-text${remaining.over ? ' script-voice__warn' : ''}`}>
              Esto gastará {formatCredits(chars, LOCALE)} créditos de Cartesia
              {remaining.left !== null && ` · te quedarán ≈ ${formatCredits(remaining.left, LOCALE)}`}
              {remaining.over && ' (supera tu saldo estimado)'}
              {voiceName && ` · Voz: ${voiceName}`}
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
                Configura tu clave de Cartesia en Ajustes
              </button>
            )}
            {configured && busyElsewhere && <span className="settings__card-text">Hay otra voz en off generándose.</span>}
          </>
        )}
      </div>

      {error && <p className="prompt-editor__error">{error}</p>}

      {track && videoId && phase !== 'generating' && (
        <details className="script-voice__player" open={isPlayerOpen} onToggle={(event) => setIsPlayerOpen(event.currentTarget.open)}>
          <summary>Voz en off de este video</summary>
          {isPlayerOpen && (
            <VoicePlayer videoId={videoId} voice={track} openLabel="Abrir carpeta" onOpenFolder={onOpenFolder}>
              <button type="button" className="settings__button settings__button--ghost" onClick={onOpenTimeline}>
                Ver en Timeline
              </button>
            </VoicePlayer>
          )}
        </details>
      )}
    </div>
  );
}
