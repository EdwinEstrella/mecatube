import { parseIdeas } from '../chat/parseIdeas.js';
import { chosenIdeaNumber } from '../chat/chosenIdea.js';
import { isScriptMessage } from './stages.js';

// Returns the latest assistant ideas message data, or null
export function latestIdeas(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index];
    if (message?.role !== 'assistant') continue;
    if (typeof message.content !== 'string') continue;
    const parsed = parseIdeas(message.content);
    if (parsed) {
      const chosenNumber = chosenIdeaNumber(list, index);
      return { index, parsed, chosenNumber };
    }
  }
  return null;
}

// Returns the content of the latest assistant script message, or null
export function latestScript(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index];
    if (message?.role !== 'assistant') continue;
    if (typeof message.content === 'string' && isScriptMessage(message.content)) {
      return message.content;
    }
  }
  return null;
}
