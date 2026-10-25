import { useEffect, useState } from 'react';
import {
  CONNECTORS_INSTRUCTION,
  CONNECTORS_LIST,
  PRESETS,
  PROMPTS_CHANGED_EVENT,
  effectiveText,
  loadOverrides,
} from '../prompts/presets.js';
import { composeConnectorsMessage } from '../prompts/connectors.js';

// The first two buttons start a new chat; the connectors button writes into the open conversation
export default function PromptPresets({ disabled, hasActiveConversation, onSend, onSendConnectors }) {
  const [overrides, setOverrides] = useState({});

  // Reload on mount and whenever Settings saves or restores a prompt
  useEffect(() => {
    let active = true;
    const refresh = () => loadOverrides().then((value) => active && setOverrides(value));
    refresh();
    window.addEventListener(PROMPTS_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(PROMPTS_CHANGED_EVENT, refresh);
    };
  }, []);

  return (
    <div className="chat-presets">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="chat-presets__button"
          disabled={disabled}
          onClick={() => onSend(effectiveText(preset, overrides))}
        >
          {preset.label}
        </button>
      ))}
      <button
        type="button"
        className="chat-presets__button"
        disabled={disabled || !hasActiveConversation}
        title={hasActiveConversation ? undefined : 'Abre primero una conversación'}
        onClick={() =>
          onSendConnectors(
            composeConnectorsMessage(
              effectiveText(CONNECTORS_INSTRUCTION, overrides),
              effectiveText(CONNECTORS_LIST, overrides),
            ),
          )
        }
      >
        Agregar palabras conectoras
      </button>
    </div>
  );
}
