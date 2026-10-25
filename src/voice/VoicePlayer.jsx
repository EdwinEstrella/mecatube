import { formatDuration } from './constants.js';

// Presentational: the generated narration track with its details. `src` overrides the media URL
// (standalone voice-overs); children add extra action buttons next to "open folder".
export default function VoicePlayer({ videoId, voice, src, openLabel = 'Abrir carpeta', onOpenFolder, children }) {
  return (
    <div className="voice-player">
      <audio
        className="voice-player__audio"
        controls
        preload="metadata"
        src={`${src ?? `mecatube-media://voice/${encodeURIComponent(videoId)}`}?v=${voice.createdAt}`}
      />
      <p className="settings__card-text">
        {formatDuration(voice.duration)} · {voice.chars.toLocaleString('es-ES')} caracteres · {voice.model} ·{' '}
        {voice.voiceName}
        {voice.simulated ? ' · simulada' : ''}
      </p>
      <div className="voice-panel__actions">
        <button type="button" className="settings__button settings__button--ghost" onClick={onOpenFolder}>
          {openLabel}
        </button>
        {children}
      </div>
    </div>
  );
}
