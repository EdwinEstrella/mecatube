import { useState } from 'react';

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function SavedIdea({ idea, onOpenChat, onRemove, onCopy }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (await onCopy(idea)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <li className="saved-idea">
      <div className="saved-idea__header">
        <h3 className="saved-idea__title">{idea.title}</h3>
        {idea.format && <span className="idea-card__badge">{idea.format}</span>}
      </div>
      {idea.question && <p className="saved-idea__question">{idea.question}</p>}
      <dl className="idea-card__meta">
        {idea.thumbnailText && (
          <div>
            <dt>Thumbnail</dt>
            <dd>{idea.thumbnailText}</dd>
          </div>
        )}
        {idea.trigger && (
          <div>
            <dt>Trigger</dt>
            <dd>{idea.trigger}</dd>
          </div>
        )}
      </dl>
      <p className="saved-idea__source">
        {idea.conversationTitle || 'Untitled chat'} · {formatDate(idea.savedAt)}
      </p>
      <div className="saved-idea__actions">
        <button type="button" className="settings__button settings__button--ghost" onClick={() => onOpenChat(idea.conversationId)}>
          Open chat
        </button>
        <button type="button" className="settings__button settings__button--ghost" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {isConfirming ? (
          <>
            <button type="button" className="settings__button settings__button--danger" onClick={() => onRemove(idea.id)}>
              Confirm remove
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={() => setIsConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="settings__button settings__button--danger" onClick={() => setIsConfirming(true)}>
            Remove
          </button>
        )}
      </div>
    </li>
  );
}

// Presentational list of saved ideas, newest first (order comes from the container)
export default function IdeaList({ ideas, onOpenChat, onRemove, onCopy }) {
  if (ideas.length === 0) {
    return <p className="settings__empty">No saved ideas yet. Tap the heart on an idea in a chat to keep it here.</p>;
  }
  return (
    <ul className="saved-ideas">
      {ideas.map((idea) => (
        <SavedIdea key={idea.id} idea={idea} onOpenChat={onOpenChat} onRemove={onRemove} onCopy={onCopy} />
      ))}
    </ul>
  );
}
