import { useState } from 'react';
import VoicePickerPanel from './VoicePickerPanel.jsx';
import { useVoiceLibrary } from './useVoiceLibrary.js';

// Container: the current voice plus a collapsible picker over the user's own voices
export default function VoicePicker({ voiceId, voiceName, disabled, onChange }) {
  const library = useVoiceLibrary();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState('saved');

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && library.configured && !library.hasLoadedOwned && !library.isLoadingOwned) library.loadOwned(false);
  };

  const handleSelect = (voice) => {
    onChange(voice);
    setIsOpen(false);
  };

  return (
    <div className="voice-picker">
      <div className="voice-panel__field">
        <span className="video-detail__chat-label">Voice</span>
        <button
          type="button"
          className="settings__button settings__button--ghost voice-picker__current"
          disabled={disabled}
          aria-expanded={isOpen}
          title={voiceId}
          onClick={toggle}
        >
          {voiceName || voiceId} ▾
        </button>
      </div>
      {isOpen && (
        <VoicePickerPanel
          library={library}
          tab={tab}
          onTab={setTab}
          voiceId={voiceId}
          voiceName={voiceName}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
