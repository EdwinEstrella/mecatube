import promptOne from './prompt-1.txt?raw';
import promptTwo from './prompt-2.txt?raw';
import connectorsInstruction from './connectors-instruction.txt?raw';
import connectorsList from './connectors.txt?raw';

// Verbatim prompts from Material_Video_Stickman_IA.pdf; the text files must not be edited by hand.
// User edits are stored as overrides by the main process and never touch these defaults.
export const PRESETS = [
  { id: 'prompt-1', label: 'Prompt 1', defaultText: promptOne },
  { id: 'prompt-2', label: 'Prompt 2', defaultText: promptTwo },
];

// Editable text behind the "Agregar palabras conectoras" button; stored through the same overrides
export const CONNECTORS_INSTRUCTION = {
  id: 'connectors-instruction',
  label: 'Connectors instruction',
  defaultText: connectorsInstruction,
};
export const CONNECTORS_LIST = { id: 'connectors', label: 'Connector words (one per line)', defaultText: connectorsList };

export const PROMPTS_CHANGED_EVENT = 'mecatube:prompts-changed';

// Effective text is the override when one exists, otherwise the original
export function effectiveText(preset, overrides) {
  return overrides?.[preset.id] ?? preset.defaultText;
}

export async function loadOverrides() {
  return (await window.electronAPI?.getPromptOverrides()) ?? {};
}
