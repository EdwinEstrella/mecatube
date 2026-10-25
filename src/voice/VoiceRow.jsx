import { useEffect, useRef, useState } from 'react';

// Presentational: one voice with an optional preview, a select button and extra actions (children)
export default function VoiceRow({ name, detail, badge, previewUrl, isSelected, onSelect, children }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => () => audioRef.current?.pause(), []);

  const togglePreview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play().catch(() => setIsPlaying(false));
  };

  return (
    <li className={`voice-row${isSelected ? ' voice-row--selected' : ''}`}>
      {previewUrl && (
        <>
          <audio
            ref={audioRef}
            src={previewUrl}
            preload="none"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
          <button
            type="button"
            className="voice-row__play"
            aria-label={`${isPlaying ? 'Stop' : 'Play'} preview of ${name}`}
            onClick={togglePreview}
          >
            {isPlaying ? '■' : '▶'}
          </button>
        </>
      )}
      <div className="voice-row__text">
        <span className="voice-row__name">
          {name}
          {badge && <span className="voice-row__badge">{badge}</span>}
        </span>
        {detail && <span className="settings__card-text voice-row__detail">{detail}</span>}
      </div>
      {children}
      {onSelect && (
        <button
          type="button"
          className="settings__button settings__button--ghost"
          disabled={isSelected}
          onClick={onSelect}
        >
          {isSelected ? 'Selected' : 'Select'}
        </button>
      )}
    </li>
  );
}
