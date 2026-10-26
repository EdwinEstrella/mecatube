// Pure: finds the illustrator's closing question ("¿Paso al siguiente bloque?" followed by
// "1 → …" / "2 → …" options), which prompt 2 wraps in a code fence, so the block cards can offer it
// as buttons. Returns null when the message has no such question.

const OPTION = /^\s*([1-9])\s*(?:→|->|-|\)|\.)\s*(.+?)\s*$/;
const QUESTION = /^\s*¿.+\?\s*$/;

export function nextStepPrompt(markdown) {
  if (typeof markdown !== 'string' || !markdown) return null;
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\*\*/g, '').trim())
    .filter((line) => line && !/^(```|~~~)/.test(line));

  // The last question in the message that is directly followed by numbered options
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!QUESTION.test(lines[index])) continue;
    const options = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const match = OPTION.exec(lines[next]);
      if (!match) break;
      options.push({ value: match[1], label: match[2] });
    }
    if (options.length >= 2) return { question: lines[index], options };
  }
  return null;
}
