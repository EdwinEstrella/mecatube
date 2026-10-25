import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CONNECTORS_INSTRUCTION,
  CONNECTORS_LIST,
  PRESETS,
  PROMPTS_CHANGED_EVENT,
  effectiveText,
  loadOverrides,
} from './prompts/presets.js';
import { parseConnectors } from './prompts/connectors.js';
import CartesiaSettings from './voice/CartesiaSettings.jsx';
import DeepSeekSettings from './settings/DeepSeekSettings.jsx';


// Edits one preset prompt; text is kept and saved exactly as typed, with no trimming or normalization
function PromptEditor({ preset, override, onChanged, countConnectors = false }) {
  const saved = effectiveText(preset, { [preset.id]: override });
  const [text, setText] = useState(saved);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');

  // Follow the stored value after a save or restore
  useEffect(() => {
    setText(saved);
  }, [saved]);

  const run = async (action) => {
    setError('');
    try {
      await action();
      window.dispatchEvent(new CustomEvent(PROMPTS_CHANGED_EVENT));
      await onChanged();
    } catch (actionError) {
      setError(actionError.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
  };

  const handleSave = () => run(() => window.electronAPI.savePrompt(preset.id, text));
  const handleReset = () => {
    setIsConfirming(false);
    return run(() => window.electronAPI.resetPrompt(preset.id));
  };

  const hasOverride = override !== null && override !== undefined;

  return (
    <div className="prompt-editor">
      <div className="prompt-editor__header">
        <h3 className="prompt-editor__label">{preset.label}</h3>
        <span className={`prompt-editor__badge${hasOverride ? ' prompt-editor__badge--edited' : ''}`}>
          {hasOverride ? 'Edited' : 'Original'}
        </span>
      </div>

      <textarea
        className="prompt-editor__text"
        value={text}
        spellCheck={false}
        aria-label={`${preset.label} text`}
        onChange={(event) => setText(event.target.value)}
      />

      {countConnectors && (
        <p className="settings__card-text">{parseConnectors(text).length} connectors</p>
      )}

      {error && <p className="prompt-editor__error">{error}</p>}

      <div className="prompt-editor__actions">
        <button
          type="button"
          className="settings__button settings__button--primary"
          disabled={text === saved}
          onClick={handleSave}
        >
          Save
        </button>
        {isConfirming ? (
          <>
            <span className="settings__card-text">Discard your edits and restore the original?</span>
            <button type="button" className="settings__button settings__button--danger" onClick={handleReset}>
              Restore
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={() => setIsConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="settings__button settings__button--ghost"
            disabled={!hasOverride}
            onClick={() => setIsConfirming(true)}
          >
            Restore original
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsView() {
  const [overrides, setOverrides] = useState({});
  const refreshOverrides = useCallback(async () => setOverrides(await loadOverrides()), []);

  useEffect(() => {
    refreshOverrides();
  }, [refreshOverrides]);

  return (
    <motion.section
      className="settings"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <h1 className="settings__title">Settings</h1>

      <DeepSeekSettings />

      <CartesiaSettings />

      <div className="settings__card settings__card--spaced">
        <div>
          <h2 className="settings__card-title">Prompts</h2>
          <p className="settings__card-text">
            The text of the Prompt 1 and Prompt 2 buttons in the chat. It is sent exactly as saved here, with
            nothing added or removed.
          </p>
        </div>
        {PRESETS.map((preset) => (
          <PromptEditor
            key={preset.id}
            preset={preset}
            override={overrides[preset.id]}
            onChanged={refreshOverrides}
          />
        ))}
      </div>

      <div className="settings__card settings__card--spaced">
        <div>
          <h2 className="settings__card-title">Connector words</h2>
          <p className="settings__card-text">
            The “Agregar palabras conectoras” button sends the instruction followed by the list below (one per line,
            blanks and duplicates ignored) into the open conversation.
          </p>
        </div>
        <PromptEditor
          preset={CONNECTORS_INSTRUCTION}
          override={overrides[CONNECTORS_INSTRUCTION.id]}
          onChanged={refreshOverrides}
        />
        <PromptEditor
          preset={CONNECTORS_LIST}
          override={overrides[CONNECTORS_LIST.id]}
          onChanged={refreshOverrides}
          countConnectors
        />
      </div>
    </motion.section>
  );
}
