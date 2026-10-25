import { useEffect, useState } from 'react';
import { cleanIpcError } from '../voice/constants.js';

const MASKED_KEY = '••••••••••••••••••••••••••••••••';

export default function DeepSeekSettings() {
  const [status, setStatus] = useState(null);
  const [key, setKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState({ kind: '', text: '' });

  const configured = status?.configured === true;

  useEffect(() => {
    window.electronAPI?.getDeepSeekStatus().then(setStatus, () => setStatus({ configured: false }));
  }, []);

  const run = async (action) => {
    setIsBusy(true);
    setMessage({ kind: '', text: '' });
    try {
      await action();
    } catch (error) {
      setMessage({ kind: 'error', text: cleanIpcError(error) });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = () =>
    run(async () => {
      const newStatus = await window.electronAPI.saveDeepSeekKey(key);
      setStatus(newStatus);
      setKey('');
      setIsEditing(false);
      setMessage({ kind: 'ok', text: 'API Key de DeepSeek guardada correctamente.' });
    });

  const handleTest = () =>
    run(async () => {
      const result = await window.electronAPI.testDeepSeekKey();
      setMessage(result.ok ? { kind: 'ok', text: 'Conexión exitosa con DeepSeek.' } : { kind: 'error', text: result.error });
    });

  const handleClear = () =>
    run(async () => {
      const newStatus = await window.electronAPI.clearDeepSeekKey();
      setStatus(newStatus);
      setKey('');
      setIsEditing(false);
      setMessage({ kind: 'ok', text: 'API Key eliminada.' });
    });

  const displayValue = isEditing ? key : configured ? MASKED_KEY : key;

  return (
    <div className="settings__card settings__card--spaced">
      <div className="prompt-editor__header">
        <div>
          <h2 className="settings__card-title">DeepSeek API</h2>
          <p className="settings__card-text">
            Conexión directa con la API oficial de DeepSeek (api.deepseek.com). No requiere extensión del navegador ni pestañas abiertas.
          </p>
        </div>
        <span
          className={`prompt-editor__badge ${
            configured ? 'prompt-editor__badge--edited' : 'prompt-editor__badge--empty'
          }`}
        >
          {configured ? `Configurada (…${status?.last4 || ''})` : 'Sin configurar'}
        </span>
      </div>

      <label className="voice-panel__field">
        <span className="settings__card-text">API Key</span>
        <input
          type="text"
          className="chat-list__rename settings__api-input"
          value={displayValue}
          placeholder="sk-…"
          disabled={isBusy}
          onFocus={() => {
            if (!isEditing) {
              setKey('');
              setIsEditing(true);
            }
          }}
          onChange={(event) => {
            setIsEditing(true);
            setKey(event.target.value);
          }}
        />
      </label>

      <div className="settings__actions">
        <button
          type="button"
          className="settings__button settings__button--primary"
          disabled={isBusy || (isEditing && !key.trim())}
          onClick={handleSave}
        >
          Guardar
        </button>
        <button
          type="button"
          className="settings__button settings__button--ghost"
          disabled={isBusy || !configured}
          onClick={handleTest}
        >
          Probar conexión
        </button>
        <button
          type="button"
          className="settings__button settings__button--danger"
          disabled={isBusy || !configured}
          onClick={handleClear}
        >
          Eliminar
        </button>
      </div>

      {message.text && (
        <p className={message.kind === 'error' ? 'prompt-editor__error' : 'settings__card-text'}>{message.text}</p>
      )}
    </div>
  );
}
