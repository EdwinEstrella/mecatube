// Pure helpers to budget image count for script messages sent after prompt-2's request.

export function countScriptWords(text) {
  if (typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const tokens = trimmed.split(/\s+/);
  let count = 0;
  for (const token of tokens) {
    if (/\p{L}|\p{N}/u.test(token)) {
      count += 1;
    }
  }
  return count;
}

export function imageCountFor(text) {
  const words = countScriptWords(text);
  return Math.max(1, Math.ceil(words / 9));
}

export function asksForScript(assistantText) {
  if (typeof assistantText !== 'string') return false;
  const normalized = assistantText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('enviame tu guion completo');
}

export function withImageBudget(message, previousAssistantText) {
  if (typeof message !== 'string') return message;
  if (!asksForScript(previousAssistantText)) return message;
  if (message.includes('CANTIDAD_IMAGENES')) return message;
  const wordCount = countScriptWords(message);
  if (wordCount < 30) return message;
  const count = imageCountFor(message);
  return `${message}\n\n[CANTIDAD_IMAGENES]: ${count}`;
}
