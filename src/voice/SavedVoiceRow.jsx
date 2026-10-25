import { useState } from 'react';
import VoiceRow from './VoiceRow.jsx';

// Presentational: a voice saved in Mecatube, with rename and remove (select is optional)
export default function SavedVoiceRow({ voice, isSelected = false, onSelect, onRename, onRemove }) {
  const [draft, setDraft] = useState(null);

  if (draft !== null) {
    const commit = async () => {
      if (draft.trim()) await onRename(voice.id, draft);
      setDraft(null);
    };
    return (
      <li className="voice-row">
        <input
          className="chat-list__rename voice-lookup__label"
          value={draft}
          maxLength={80}
          autoFocus
          aria-label="Etiqueta de la voz"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') setDraft(null);
          }}
        />
        <button type="button" className="settings__button settings__button--primary" onClick={commit}>
          Guardar
        </button>
        <button type="button" className="settings__button settings__button--ghost" onClick={() => setDraft(null)}>
          Cancelar
        </button>
      </li>
    );
  }

  return (
    <VoiceRow
      name={voice.label}
      detail={voice.name !== voice.label ? voice.name : ''}
      isSelected={isSelected}
      onSelect={onSelect}
    >
      <button type="button" className="settings__button settings__button--ghost" onClick={() => setDraft(voice.label)}>
        Renombrar
      </button>
      <button type="button" className="settings__button settings__button--danger" onClick={() => onRemove(voice.id)}>
        Eliminar
      </button>
    </VoiceRow>
  );
}
