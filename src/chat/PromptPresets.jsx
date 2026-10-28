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
import { DEFAULT_STYLE_ID } from '../prompts/styles.js';
import { composePrompt } from '../prompts/compose.js';

// The first two buttons start a new chat; the connectors button writes into the open conversation
export default function PromptPresets({ disabled, hasActiveConversation, onSend, onSendConnectors }) {
  const [overrides, setOverrides] = useState({});
  const [currentStyle, setCurrentStyle] = useState(DEFAULT_STYLE_ID);
  const [currentOrientation, setCurrentOrientation] = useState('horizontal');
  const [currentVideoType, setCurrentVideoType] = useState('explainer');

  // Reload on mount and whenever Settings saves or restores a prompt
  useEffect(() => {
    let active = true;
    const refresh = () => loadOverrides().then((value) => active && setOverrides(value));
    refresh();
    window.addEventListener(PROMPTS_CHANGED_EVENT, refresh);

    const refreshStyle = () => {
      window.electronAPI?.getCurrentWorkspace?.().then((ws) => {
        if (active && ws?.style) setCurrentStyle(ws.style);
      });
    };
    refreshStyle();

    const refreshBranch = async () => {
      try {
        const api = window.electronAPI;
        if (!api) return;
        const [activeVideo, branches] = await Promise.all([
          api.getActiveVideo?.(),
          api.listBranches?.(),
        ]);
        if (!active) return;
        if (activeVideo?.branchId && Array.isArray(branches)) {
          const branch = branches.find((b) => b.id === activeVideo.branchId);
          if (branch?.orientation) setCurrentOrientation(branch.orientation);
          if (branch?.videoType) setCurrentVideoType(branch.videoType);
        }
      } catch {}
    };
    refreshBranch();

    const handleStyleChange = (e) => {
      if (e.detail?.style) {
        setCurrentStyle(e.detail.style);
      } else {
        refreshStyle();
      }
      refreshBranch();
    };
    const handleActiveChanged = () => {
      refreshBranch();
    };

    window.addEventListener('mecatube:workspace-style-changed', handleStyleChange);
    window.addEventListener('mecatube:active-video-changed', handleActiveChanged);

    return () => {
      active = false;
      window.removeEventListener(PROMPTS_CHANGED_EVENT, refresh);
      window.removeEventListener('mecatube:workspace-style-changed', handleStyleChange);
      window.removeEventListener('mecatube:active-video-changed', handleActiveChanged);
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
          onClick={() => {
            const rawText = effectiveText(preset, overrides);
            const text = composePrompt(rawText, {
              presetId: preset.id,
              style: currentStyle,
              orientation: currentOrientation,
              videoType: currentVideoType,
            });
            onSend(text);
          }}
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
