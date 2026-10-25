import SavedVoiceRow from './SavedVoiceRow.jsx';
import VoiceIdLookup from './VoiceIdLookup.jsx';
import { useVoiceLibrary } from './useVoiceLibrary.js';

// Container: "My voices" section of the Cartesia settings card (rename, remove, add by id)
export default function SavedVoicesSettings() {
  const library = useVoiceLibrary();
  const { saved, configured, error } = library;

  return (
    <div className="credits">
      <h3 className="credits__title">Mis voces</h3>
      <p className="settings__card-text">
        Las voces guardadas en Mecatube aparecen en todos los selectores de voz. Pega el ID de una voz de Cartesia para verificarla y añadirla.
      </p>
      {saved.length === 0 ? (
        <p className="settings__empty">Aún no hay voces guardadas.</p>
      ) : (
        <ul className="voice-picker__list">
          {saved.map((voice) => (
            <SavedVoiceRow key={voice.id} voice={voice} onRename={library.rename} onRemove={library.remove} />
          ))}
        </ul>
      )}
      <VoiceIdLookup onLookup={library.lookup} onSave={library.save} disabled={configured !== true} />
      {configured === false && <p className="settings__card-text">Guarda arriba tu clave de API de Cartesia para verificar IDs de voz.</p>}
      {error && <p className="prompt-editor__error">{error}</p>}
    </div>
  );
}
