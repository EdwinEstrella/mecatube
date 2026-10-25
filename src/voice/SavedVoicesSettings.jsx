import SavedVoiceRow from './SavedVoiceRow.jsx';
import VoiceIdLookup from './VoiceIdLookup.jsx';
import { useVoiceLibrary } from './useVoiceLibrary.js';

// Container: "My voices" section of the Cartesia settings card (rename, remove, add by id)
export default function SavedVoicesSettings() {
  const library = useVoiceLibrary();
  const { saved, configured, error } = library;

  return (
    <div className="credits">
      <h3 className="credits__title">My voices</h3>
      <p className="settings__card-text">
        Voices saved in Mecatube show up in every voice picker. Paste a Cartesia voice ID to check it and add it.
      </p>
      {saved.length === 0 ? (
        <p className="settings__empty">No saved voices yet.</p>
      ) : (
        <ul className="voice-picker__list">
          {saved.map((voice) => (
            <SavedVoiceRow key={voice.id} voice={voice} onRename={library.rename} onRemove={library.remove} />
          ))}
        </ul>
      )}
      <VoiceIdLookup onLookup={library.lookup} onSave={library.save} disabled={configured !== true} />
      {configured === false && <p className="settings__card-text">Save your Cartesia API key above to check voice IDs.</p>}
      {error && <p className="prompt-editor__error">{error}</p>}
    </div>
  );
}
