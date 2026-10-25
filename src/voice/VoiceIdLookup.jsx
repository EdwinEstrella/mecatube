import { useState } from 'react';
import { cleanIpcError } from './constants.js';

// Paste a Cartesia voice id, check it, then use it and/or save it to "my voices".
// onLookup(id) -> voice | null; onUse is optional (Settings only saves); onSave({ id, name, label }).
export default function VoiceIdLookup({ onLookup, onUse, onSave, disabled }) {
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [found, setFound] = useState(null);
  const [message, setMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const reset = () => {
    setFound(null);
    setMessage('');
  };

  const handleCheck = async () => {
    reset();
    setIsChecking(true);
    try {
      const voice = await onLookup(id.trim());
      if (voice) setFound(voice);
      else setMessage('Voz no encontrada');
    } catch (lookupError) {
      setMessage(cleanIpcError(lookupError));
    } finally {
      setIsChecking(false);
    }
  };

  const handleSave = async () => {
    if (await onSave({ id: found.id, name: found.name, label: label.trim() })) setMessage('Guardada en tus voces.');
  };

  return (
    <div className="voice-lookup">
      <div className="voice-panel__actions">
        <input
          className="chat-list__rename voice-lookup__input"
          value={id}
          spellCheck={false}
          placeholder="Pega un ID de voz"
          aria-label="ID de voz"
          disabled={disabled}
          onChange={(event) => {
            setId(event.target.value);
            reset();
          }}
        />
        <button
          type="button"
          className="settings__button settings__button--ghost"
          disabled={disabled || isChecking || id.trim() === ''}
          onClick={handleCheck}
        >
          {isChecking ? 'Verificando…' : 'Verificar'}
        </button>
      </div>

      {found && (
        <div className="voice-lookup__result">
          <p className="settings__card-text">
            <strong>{found.name}</strong>
            {found.isOwner ? ' · tuya' : ' · voz pública'}
            {found.description && ` — ${found.description}`}
          </p>
          <div className="voice-panel__actions">
            {onUse && (
              <button type="button" className="settings__button settings__button--primary" onClick={() => onUse({ id: found.id, name: found.name })}>
                Usar
              </button>
            )}
            <input
              className="chat-list__rename voice-lookup__label"
              value={label}
              maxLength={80}
              placeholder="Etiqueta personalizada (opcional)"
              aria-label="Etiqueta personalizada"
              onChange={(event) => setLabel(event.target.value)}
            />
            <button type="button" className="settings__button settings__button--ghost" onClick={handleSave}>
              Guardar en mis voces
            </button>
          </div>
        </div>
      )}

      {message && <p className={message === 'Guardada en tus voces.' ? 'settings__card-text' : 'prompt-editor__error'}>{message}</p>}
    </div>
  );
}
