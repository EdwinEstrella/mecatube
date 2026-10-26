// Pure: keys of the characters in the chat's latest character-sheet message (the sheets the user is
// working with now). Earlier sheet messages and other chats' leftovers are ignored. [] when none.
import { parseCharacterSheets } from './parseCharacterSheets.js';

export function latestCharacterKeys(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index];
    if (message?.role !== 'assistant') continue;
    const parsed = parseCharacterSheets(message.content);
    if (parsed) return parsed.characters.map((character) => character.key);
  }
  return [];
}
