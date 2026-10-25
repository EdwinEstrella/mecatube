import VoiceOptions from './VoiceOptions.jsx';
import CustomCheckbox from '../ui/CustomCheckbox.jsx';

// Presentational: paste any script, pick voice and model, confirm and generate.
export default function VoiceOverEditor({
  text,
  title,
  clean,
  chars,
  voiceId,
  voiceName,
  model,
  configured,
  busyElsewhere,
  phase,
  seconds,
  error,
  remaining,
  onTextChange,
  onTitleChange,
  onCleanChange,
  onVoiceChange,
  onModelChange,
  onRequest,
  onConfirm,
  onCancelConfirm,
  onCancelGeneration,
  onOpenSettings,
}) {
  const isLocked = phase !== 'idle';
  const canGenerate = configured === true && !busyElsewhere && chars > 0 && text.trim() !== '';

  return (
    <div className="voice-panel">
      <textarea
        className="prompt-editor__text voice-panel__text voiceover__text"
        value={text}
        spellCheck={false}
        placeholder="Paste any script here. It is spoken exactly as written."
        aria-label="Script to narrate"
        disabled={isLocked}
        onChange={(event) => onTextChange(event.target.value)}
      />

      <div className="voiceover__check">
        <CustomCheckbox
          checked={clean}
          disabled={isLocked}
          label="Clean markdown/labels"
          onChange={onCleanChange}
        />
      </div>

      <label className="voice-panel__field">
        <span className="video-detail__chat-label">Title</span>
        <input
          className="chat-list__rename voiceover__title"
          value={title}
          maxLength={120}
          placeholder="Optional (defaults to the first words of the text)"
          aria-label="Voice-over title"
          disabled={isLocked}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>

      <VoiceOptions
        voiceId={voiceId}
        voiceName={voiceName}
        model={model}
        disabled={isLocked}
        onVoiceChange={onVoiceChange}
        onModelChange={onModelChange}
      />

      <p className="settings__card-text">
        {chars.toLocaleString('en-US')} characters
      </p>

      <div className="voice-panel__actions">
        {phase === 'generating' ? (
          <>
            <span className="settings__card-text">
              Generating… {seconds > 0 ? `${seconds.toFixed(1)} s of audio so far` : 'waiting for Cartesia'}
            </span>
            <button type="button" className="settings__button settings__button--ghost" onClick={onCancelGeneration}>
              Cancel
            </button>
          </>
        ) : phase === 'confirm' ? (
          <>
            <span className="settings__card-text">
              Generate voice-over for this text?
            </span>
            <button type="button" className="settings__button settings__button--primary" onClick={onConfirm}>
              Confirm
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={onCancelConfirm}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="settings__button settings__button--primary" disabled={!canGenerate} onClick={onRequest}>
              Generate
            </button>
            {configured === false && (
              <button type="button" className="script-voice__hint" onClick={onOpenSettings}>
                Add your Cartesia API key in Settings → Cartesia to generate.
              </button>
            )}
            {configured && busyElsewhere && <span className="settings__card-text">Another voice-over is being generated.</span>}
          </>
        )}
      </div>

      {error && <p className="prompt-editor__error">{error}</p>}
    </div>
  );
}
