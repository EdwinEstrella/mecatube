import { useEffect, useState } from 'react';
import { cleanIpcError } from './constants.js';
import SavedVoicesSettings from './SavedVoicesSettings.jsx';

const MASKED_KEY = '••••••••••••••••••••••••••••••••';

// Settings card for the Cartesia API key. The key is sent to the main process and never read back.
export default function CartesiaSettings() {
  const [status, setStatus] = useState(null);
  const [key, setKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState({ kind: '', text: '' });

  const configured = status?.configured === true;

  useEffect(() => {
    window.electronAPI?.getCartesiaStatus().then(setStatus, () => setStatus({ configured: false }));
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
      const newStatus = await window.electronAPI.saveCartesiaKey(key);
      setStatus(newStatus);
      setKey('');
      setIsEditing(false);
      setMessage({ kind: 'ok', text: 'Key saved.' });
    });

  const handleTest = () =>
    run(async () => {
      const result = await window.electronAPI.testCartesiaKey();
      setMessage(result.ok ? { kind: 'ok', text: 'Connection works.' } : { kind: 'error', text: result.error });
    });

  const handleClear = () =>
    run(async () => {
      setStatus(await window.electronAPI.clearCartesiaKey());
      setKey('');
      setIsEditing(false);
      setMessage({ kind: 'ok', text: 'Key removed.' });
    });

  const handleFocus = () => {
    if (!isEditing && status?.configured) {
      setIsEditing(true);
      setKey('');
    }
  };

  const handleBlur = () => {
    if (key.trim() === '') {
      setIsEditing(false);
    }
  };

  const inputValue = !isEditing && configured ? MASKED_KEY : key;

  return (
    <div className="settings__card">
      <div>
        <h2 className="settings__card-title">Cartesia</h2>
        <p className="settings__card-text">
          API key for generating voice-overs. It is stored encrypted on this computer and is never shown again.{' '}
          {status && (configured ? `Configured (…${status.last4}).` : 'Not configured.')}
        </p>
      </div>
      <div className="prompt-editor__actions">
        <input
          className="chat-list__rename cartesia-key"
          type="password"
          value={inputValue}
          autoComplete="off"
          spellCheck={false}
          placeholder={configured ? 'Paste a new key to replace it' : 'Paste your Cartesia API key'}
          aria-label="Cartesia API key"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(event) => {
            setIsEditing(true);
            setKey(event.target.value);
          }}
        />
        <button
          type="button"
          className="settings__button settings__button--primary"
          disabled={isBusy || !isEditing || key.trim() === ''}
          onClick={handleSave}
        >
          Save
        </button>
        <button
          type="button"
          className="settings__button settings__button--ghost"
          disabled={isBusy || !configured}
          onClick={handleTest}
        >
          Test connection
        </button>
        <button
          type="button"
          className="settings__button settings__button--danger"
          disabled={isBusy || !configured}
          onClick={handleClear}
        >
          Clear
        </button>
      </div>
      {message.text && (
        <p className={message.kind === 'error' ? 'prompt-editor__error' : 'settings__card-text'}>{message.text}</p>
      )}

      <SavedVoicesSettings />
    </div>
  );
}
