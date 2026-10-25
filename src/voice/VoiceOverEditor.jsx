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
        placeholder="Pega aquí cualquier guion. Se narra exactamente como está escrito."
        aria-label="Guion a narrar"
        disabled={isLocked}
        onChange={(event) => onTextChange(event.target.value)}
      />

      <div className="voiceover__check">
        <CustomCheckbox
          checked={clean}
          disabled={isLocked}
          label="Limpiar markdown y etiquetas"
          onChange={onCleanChange}
        />
      </div>

      <label className="voice-panel__field">
        <span className="video-detail__chat-label">Título</span>
        <input
          className="chat-list__rename voiceover__title"
          value={title}
          maxLength={120}
          placeholder="Opcional (por defecto, las primeras palabras del texto)"
          aria-label="Título de la voz en off"
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
        {chars.toLocaleString('es-ES')} caracteres
      </p>

      <div className="voice-panel__actions">
        {phase === 'generating' ? (
          <>
            <span className="settings__card-text">
              Generating… {seconds > 0 ? `${seconds.toFixed(1)} s de audio hasta ahora` : 'esperando a Cartesia'}
            </span>
            <button type="button" className="settings__button settings__button--ghost" onClick={onCancelGeneration}>
              Cancelar
            </button>
          </>
        ) : phase === 'confirm' ? (
          <>
            <span className="settings__card-text">
              ¿Generar la voz en off para este texto?
            </span>
            <button type="button" className="settings__button settings__button--primary" onClick={onConfirm}>
              Confirmar
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={onCancelConfirm}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button type="button" className="settings__button settings__button--primary" disabled={!canGenerate} onClick={onRequest}>
              Generar
            </button>
            {configured === false && (
              <button type="button" className="script-voice__hint" onClick={onOpenSettings}>
                Para generar, añade tu clave de API de Cartesia en Configuración → Cartesia.
              </button>
            )}
            {configured && busyElsewhere && <span className="settings__card-text">Se está generando otra voz en off.</span>}
          </>
        )}
      </div>

      {error && <p className="prompt-editor__error">{error}</p>}
    </div>
  );
}
