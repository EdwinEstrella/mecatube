import { useState } from 'react';
import VoicePlayer from './VoicePlayer.jsx';

const formatDate = (ms) =>
  new Date(ms).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function HistoryItem({ item, onOpenFolder, onCopy, onReuse, onDelete }) {
  const [isConfirming, setIsConfirming] = useState(false);
  return (
    <li className="voiceover-item">
      <div className="voiceover-item__head">
        <strong className="voiceover-item__title">{item.title}</strong>
        <span className="settings__card-text">{formatDate(item.createdAt)}</span>
      </div>
      <VoicePlayer
        src={`mecatube-media://voiceover/${encodeURIComponent(item.id)}`}
        voice={item}
        onOpenFolder={() => onOpenFolder(item.id)}
      >
        <button type="button" className="settings__button settings__button--ghost" onClick={() => onCopy(item)}>
          Copy text
        </button>
        <button type="button" className="settings__button settings__button--ghost" onClick={() => onReuse(item)}>
          Use text again
        </button>
        {isConfirming ? (
          <>
            <span className="settings__card-text">Delete this voice-over and its files?</span>
            <button type="button" className="settings__button settings__button--danger" onClick={() => onDelete(item.id)}>
              Delete
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={() => setIsConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="settings__button settings__button--danger" onClick={() => setIsConfirming(true)}>
            Delete
          </button>
        )}
      </VoicePlayer>
    </li>
  );
}

// Presentational: finished standalone voice-overs, newest first
export default function VoiceOverHistory({ items, ...handlers }) {
  if (items.length === 0) return <p className="settings__empty">No voice-overs yet.</p>;
  return (
    <ul className="voiceover-list">
      {items.map((item) => (
        <HistoryItem key={item.id} item={item} {...handlers} />
      ))}
    </ul>
  );
}
