// Pure: turns the Prompt 1 ETAPA 3 script message into the text to speak. No DOM, no React.
// Output format (prompt-1.txt, "Formato de salida de la ETAPA 3"): title, "Formato:", "Duración:",
// then a standalone GANCHO and DESARROLLO, then the closing "…escribe "siguiente"…" question.
import { isScriptMessage, normalizeLine } from '../timeline/stages.js';

const GANCHO = /^gancho:?$/;
const DESARROLLO = /^desarrollo:?$/;
const META_LINE = /^(?:formato|duracion):/;
// "Si todo está bien, escribe "siguiente" para recibir los metadatos…" and anything after it
const CLOSING_PROMPT = /\bescribe\b.*\bsiguiente\b/;
const HORIZONTAL_RULE = /^\s*(?:(?:[-*_]\s*){3,}|[─━═]{3,})\s*$/;
const FENCE = /^\s*(?:```|~~~)/;
const SENTENCE_END = /[.!?…:;"”»)\]]$/;

// Inline Markdown to plain text: links keep their text, images go, emphasis and code lose their marks
function stripInline(line) {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(¿¡])_([^_]+)_(?=$|[\s).,;:!?])/g, '$1$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\*+/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, '$1');
}

// Marks the kind of Markdown block a raw line starts: keeps the text, reports how it was introduced
function stripBlock(line) {
  let text = line.trim();
  let block = false;
  const heading = /^#{1,6}\s+/.exec(text);
  if (heading) {
    text = text.slice(heading[0].length);
    block = true;
  }
  text = text.replace(/\s+#+\s*$/, '');
  while (/^>\s?/.test(text)) {
    text = text.replace(/^>\s?/, '');
    block = true;
  }
  const bullet = /^(?:[-*+•]|\d{1,2}[.)])\s+/.exec(text);
  if (bullet) {
    text = text.slice(bullet[0].length);
    block = true;
  }
  return { text: stripInline(text).replace(/\s+/g, ' ').trim(), block };
}

// Lines that form the spoken script, with the title / labels / closing prompt removed
function spokenLines(lines) {
  const normalized = lines.map(normalizeLine);
  const hook = normalized.findIndex((line) => GANCHO.test(line));
  const closing = normalized.findIndex((line, index) => index > hook && CLOSING_PROMPT.test(line));
  const end = closing === -1 ? lines.length : closing;

  let start = 0;
  if (hook !== -1) {
    // Everything before GANCHO is the title block
    start = hook + 1;
  } else {
    // Flat text: drop a title only when "Formato:" / "Duración:" follows it
    const meta = normalized.findIndex((line, index) => index < 6 && META_LINE.test(line));
    const firstFilled = normalized.findIndex(Boolean);
    if (meta > 0 && firstFilled < meta) start = firstFilled + 1;
  }

  const kept = [];
  for (let index = start; index < end; index += 1) {
    const line = normalized[index];
    if (GANCHO.test(line) || DESARROLLO.test(line) || META_LINE.test(line)) continue;
    kept.push(lines[index]);
  }
  return kept;
}

// Script message text -> plain narration; paragraphs are separated by one blank line
export function extractNarration(markdown) {
  if (typeof markdown !== 'string') return '';
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const paragraphs = [];
  let current = '';
  const flush = () => {
    if (current) paragraphs.push(current);
    current = '';
  };

  for (const raw of spokenLines(lines)) {
    if (FENCE.test(raw) || HORIZONTAL_RULE.test(raw) || !raw.trim()) {
      if (!FENCE.test(raw)) flush();
      continue;
    }
    const { text, block } = stripBlock(raw);
    if (!text) continue;
    // A soft-wrapped sentence continues the paragraph; a finished sentence ends it
    if (block || (current && SENTENCE_END.test(current))) flush();
    current = current ? `${current} ${text}` : text;
    if (block) flush();
  }
  flush();
  return paragraphs.join('\n\n');
}

// Narration for the latest script the assistant produced in the chat; '' when there is none
export function narrationFromChat(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index];
    if (message?.role === 'assistant' && isScriptMessage(message.content)) return extractNarration(message.content);
  }
  return '';
}
