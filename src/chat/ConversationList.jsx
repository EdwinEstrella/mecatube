import { useRef, useState } from 'react';

export default function ConversationList({ conversations, activeId, isLocked, onSelect, onNew, onDelete, onRename }) {
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
        Nuevo chat
      </button>

      <ul className="chat-list__items">
        {conversations.map((conversation) => (
          <li
            key={conversation.id}
            className={`chat-list__item${conversation.id === activeId ? ' chat-list__item--active' : ''}`}
          >
            {editingId === conversation.id ? (
              <input
                className="chat-list__rename"
                value={draft}
                maxLength={120}
                autoFocus
                aria-label="Título de la conversación"
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
                  aria-label={`Renombrar ${conversation.title}`}
                  title="Renombrar conversación"
                  onClick={() => startEditing(conversation)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="chat-list__delete"
                  aria-label={`Eliminar ${conversation.title}`}
                  title="Eliminar conversación"
                  disabled={isLocked && conversation.id === activeId}
                  onClick={() => onDelete(conversation.id)}
                >
                  ×
                </button>
              </>
            )}
          </li>
        ))}
        {conversations.length === 0 && <li className="chat-list__empty">Aún no hay conversaciones</li>}
      </ul>
    </aside>
  );
}
