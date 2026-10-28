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
import StylePicker from './workspace/StylePicker.jsx';
import { DEFAULT_STYLE_ID } from './prompts/styles.js';

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
          {hasOverride ? 'Editado' : 'Original'}
        </span>
      </div>

      <textarea
        className="prompt-editor__text"
        value={text}
        spellCheck={false}
        aria-label={`Texto de ${preset.label}`}
        onChange={(event) => setText(event.target.value)}
      />

      {countConnectors && (
        <p className="settings__card-text">{parseConnectors(text).length} conectores</p>
      )}

      {error && <p className="prompt-editor__error">{error}</p>}

      <div className="prompt-editor__actions">
        <button
          type="button"
          className="settings__button settings__button--primary"
          disabled={text === saved}
          onClick={handleSave}
        >
          Guardar
        </button>
        {isConfirming ? (
          <>
            <span className="settings__card-text">¿Descartar tus cambios y restaurar el original?</span>
            <button type="button" className="settings__button settings__button--danger" onClick={handleReset}>
              Restaurar
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={() => setIsConfirming(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            className="settings__button settings__button--ghost"
            disabled={!hasOverride}
            onClick={() => setIsConfirming(true)}
          >
            Restaurar original
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsView() {
  const [overrides, setOverrides] = useState({});
  const [currentStyle, setCurrentStyle] = useState(DEFAULT_STYLE_ID);
  const [styleError, setStyleError] = useState('');

  const refreshOverrides = useCallback(async () => setOverrides(await loadOverrides()), []);

  const refreshStyle = useCallback(async () => {
    try {
      const ws = await window.electronAPI?.getCurrentWorkspace?.();
      if (ws?.style) setCurrentStyle(ws.style);
    } catch {}
  }, []);

  useEffect(() => {
    refreshOverrides();
    refreshStyle();
  }, [refreshOverrides, refreshStyle]);

  const handleStyleChange = async (newStyle) => {
    setStyleError('');
    setCurrentStyle(newStyle);
    try {
      await window.electronAPI?.setWorkspaceStyle?.(newStyle);
      window.dispatchEvent(
        new CustomEvent('mecatube:workspace-style-changed', { detail: { style: newStyle } })
      );
    } catch (err) {
      setStyleError(err.message || 'Error al actualizar el estilo visual.');
      refreshStyle();
    }
  };

  return (
    <motion.section
      className="settings"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <h1 className="settings__title">Configuración</h1>

      <DeepSeekSettings />

      <CartesiaSettings />

      <div className="settings__card settings__card--spaced">
        <div>
          <h2 className="settings__card-title">Estilo visual</h2>
          <p className="settings__card-text">
            El estilo artístico para la generación de personajes e ilustraciones en este espacio de trabajo.
          </p>
        </div>
        <StylePicker value={currentStyle} onChange={handleStyleChange} />
        {styleError && <p className="prompt-editor__error">{styleError}</p>}
      </div>

      <div className="settings__card settings__card--spaced">
        <div>
          <h2 className="settings__card-title">Prompts</h2>
          <p className="settings__card-text">
            El texto de los botones Prompt 1 y Prompt 2 del chat. Se envía exactamente como se guarda aquí, sin
            añadir ni quitar nada.
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
          <h2 className="settings__card-title">Palabras conectoras</h2>
          <p className="settings__card-text">
            El botón «Agregar palabras conectoras» envía la instrucción seguida de la lista de abajo (una por línea,
            se ignoran las líneas vacías y los duplicados) a la conversación abierta.
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
