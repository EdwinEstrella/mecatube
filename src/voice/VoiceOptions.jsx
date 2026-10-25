import { MODELS } from './constants.js';
import VoicePicker from './VoicePicker.jsx';

// Presentational: voice picker and model select. onVoiceChange receives { id, name }.
export default function VoiceOptions({ voiceId, voiceName, model, disabled, onVoiceChange, onModelChange }) {
  return (
    <div className="voice-panel__options">
      <VoicePicker voiceId={voiceId} voiceName={voiceName} disabled={disabled} onChange={onVoiceChange} />
      <label className="voice-panel__field">
        <span className="video-detail__chat-label">Model</span>
        <select
          className="video-detail__select"
          value={model}
          disabled={disabled}
          aria-label="Voice model"
          onChange={(event) => onModelChange(event.target.value)}
        >
          {MODELS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
