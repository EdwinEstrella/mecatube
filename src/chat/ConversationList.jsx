import { useRef, useState } from 'react';

export default function ConversationList({ conversations, activeId, isLocked, onSelect, onNew, onDelete, onRename }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  // Guards against saving twice when Enter unmounts the input and blur fires afterwards
  const settledRef = useRef(false);

  const startEditing = (conversation) => {
    settledRef.current = false;
    setDraft(conversation.title);
    setEditingId(conversation.id);
  };

  const finishEditing = (conversation, save) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setEditingId(null);
    const title = draft.trim();
    if (save && title && title !== conversation.title) onRename(conversation.id, title);
  };

  return (
    <aside className="chat-list">
      <button type="button" className="chat-list__new" onClick={onNew}>
        New chat
      </button>

      <ul className="chat-list__items">
        {conversations.map((conversation) => (
          <li
            key={conversation.id}
            className={`chat-list__item${conversation.id === activeId ? ' chat-list__item--active' : ''}`}
          >
            {confirmingId === conversation.id ? (
              <div className="chat-list__confirm">
                <span>Delete?</span>
                <button
                  type="button"
                  className="chat-list__confirm-yes"
                  onClick={() => {
                    setConfirmingId(null);
                    onDelete(conversation.id);
                  }}
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmingId(null)}>
                  Cancel
                </button>
              </div>
            ) : editingId === conversation.id ? (
              <input
                className="chat-list__rename"
                value={draft}
                maxLength={120}
                autoFocus
                aria-label="Conversation title"
                onFocus={(event) => event.target.select()}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => finishEditing(conversation, true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') finishEditing(conversation, true);
                  else if (event.key === 'Escape') finishEditing(conversation, false);
                }}
              />
            ) : (
              <>
                <button
                  type="button"
                  className="chat-list__title"
                  title={conversation.title}
                  onClick={() => onSelect(conversation.id)}
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  className="chat-list__rename-button"
                  aria-label={`Rename ${conversation.title}`}
                  title="Rename conversation"
                  onClick={() => startEditing(conversation)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="chat-list__delete"
                  aria-label={`Delete ${conversation.title}`}
                  title="Delete conversation"
                  disabled={isLocked && conversation.id === activeId}
                  onClick={() => setConfirmingId(conversation.id)}
                >
                  ×
                </button>
              </>
            )}
          </li>
        ))}
        {conversations.length === 0 && <li className="chat-list__empty">No conversations yet</li>}
      </ul>
    </aside>
  );
}
