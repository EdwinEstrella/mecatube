import { useState } from 'react';
import { characterImageUrl } from './characterStatus.js';

// Presentational Timeline section: selected image per character plus the editable Flow project link
export default function CharactersPanel({ video, characters, onSetProject, onOpenProject }) {
  const stored = video.flowProjectUrl ?? '';
  const [draft, setDraft] = useState(stored);
  const [editedFrom, setEditedFrom] = useState(stored);
  // Follow the stored value (e.g. set automatically after a generation) unless the user is typing
  if (editedFrom !== stored) {
    setEditedFrom(stored);
    setDraft(stored);
  }

  const changed = draft.trim() !== stored;

  return (
    <div className="char-panel">
      <h4 className="char-panel__title">Characters</h4>

      <div className="char-panel__project">
        <input
          className="chat-list__rename char-panel__input"
          value={draft}
          placeholder="https://flow.google.com/project/…"
          aria-label="Flow project URL"
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className="settings__button settings__button--primary"
          disabled={!changed}
          onClick={() => onSetProject(video.id, draft.trim())}
        >
          Save
        </button>
        {stored && (
          <button type="button" className="settings__button settings__button--ghost" onClick={() => onOpenProject(video.id)}>
            Abrir en Flow
          </button>
        )}
      </div>

      {characters.length === 0 ? (
        <p className="settings__card-text">No characters yet. Generate them from the illustrator chat.</p>
      ) : (
        <ul className="char-panel__list">
          {characters.map((character) => (
            <li key={character.key} className="char-panel__item">
              {character.selectedFile ? (
                <img
                  className="char-panel__image"
                  src={characterImageUrl(video.id, character.key, character.selectedFile)}
                  alt={character.name}
                  loading="lazy"
                />
              ) : (
                <div className="char-panel__image char-panel__image--empty">No image</div>
              )}
              <span className="char-panel__name">{character.name}</span>
              <span className="char-panel__state">{character.approved ? 'Approved' : character.selectedFile ? 'Selected' : 'Pending'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
