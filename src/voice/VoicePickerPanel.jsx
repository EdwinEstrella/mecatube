import SavedVoiceRow from './SavedVoiceRow.jsx';
import VoiceIdLookup from './VoiceIdLookup.jsx';
import VoiceRow from './VoiceRow.jsx';
import { isKnownVoice, voiceDetail } from './voiceDetail.js';

const TABS = [
  { id: 'owned', label: 'My Cartesia voices' },
  { id: 'saved', label: 'Saved in Mecatube' },
  { id: 'id', label: 'Voice ID' },
];

// Presentational: the three voice sources in one compact panel
export default function VoicePickerPanel({ library, tab, onTab, voiceId, voiceName, onSelect }) {
  const { configured, owned, isLoadingOwned, ownedError, hasLoadedOwned, saved, error } = library;
  const select = (voice) => onSelect({ id: voice.id, name: voice.name });

  return (
    <div className="voice-picker__panel">
      {!isKnownVoice(voiceId, owned, saved) && (
        <p className="settings__card-text">
          Current: {voiceName && voiceName !== voiceId ? `${voiceName} · ` : ''}
          <code>{voiceId}</code>
        </p>
      )}

      <div className="timeline__filters" role="tablist" aria-label="Voice source">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`timeline__chip${tab === item.id ? ' timeline__chip--active' : ''}`}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'owned' && (
        <div className="voice-picker__section">
          <div className="voice-panel__actions">
            <button
              type="button"
              className="settings__button settings__button--ghost"
              disabled={isLoadingOwned || configured !== true}
              onClick={() => library.loadOwned(true)}
            >
              {isLoadingOwned ? 'Loading…' : 'Refresh'}
            </button>
            {configured === false && <span className="settings__card-text">Add your Cartesia API key in Settings first.</span>}
          </div>
          {ownedError && <p className="prompt-editor__error">{ownedError}</p>}
          {hasLoadedOwned && owned.length === 0 && !ownedError && (
            <p className="settings__empty">No voices in your Cartesia account yet. Clone one there, or paste a voice ID.</p>
          )}
          <ul className="voice-picker__list">
            {owned.map((voice) => (
              <VoiceRow
                key={voice.id}
                name={voice.name}
                detail={voiceDetail(voice)}
                badge={voice.isPro ? 'Pro clone' : ''}
                previewUrl={voice.previewUrl}
                isSelected={voice.id === voiceId}
                onSelect={() => select(voice)}
              />
            ))}
          </ul>
        </div>
      )}

      {tab === 'saved' && (
        <div className="voice-picker__section">
          {saved.length === 0 && <p className="settings__empty">Nothing saved yet. Check a voice ID and save it.</p>}
          <ul className="voice-picker__list">
            {saved.map((voice) => (
              <SavedVoiceRow
                key={voice.id}
                voice={voice}
                isSelected={voice.id === voiceId}
                onSelect={() => onSelect({ id: voice.id, name: voice.label })}
                onRename={library.rename}
                onRemove={library.remove}
              />
            ))}
          </ul>
        </div>
      )}

      {tab === 'id' && (
        <div className="voice-picker__section">
          <VoiceIdLookup onLookup={library.lookup} onUse={onSelect} onSave={library.save} disabled={configured !== true} />
          {configured === false && <p className="settings__card-text">Add your Cartesia API key in Settings first.</p>}
        </div>
      )}

      {error && <p className="prompt-editor__error">{error}</p>}
    </div>
  );
}
