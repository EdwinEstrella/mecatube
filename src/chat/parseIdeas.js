// Parses the "10 IDEAS DE VIDEO" reply (Prompt 1, stage 1) out of Markdown.
// Pure module: no DOM, no React. Returns null when the text is not an idea list.

const FIELDS = [
  ['format', /^formato\s*:\s*(.*)$/i],
  ['question', /^pregunta central\s*:\s*(.*)$/i],
  ['thumbnailText', /^texto de miniatura\s*:\s*(.*)$/i],
  ['trigger', /^gatillo principal\s*:\s*(.*)$/i],
];
const MIN_IDEAS = 3;
const INLINE_LABEL = /\s+(?=(?:\*\*|__)?(?:formato|pregunta central|texto de miniatura|gatillo principal)\s*(?:\*\*|__)?\s*:)/gi;

// Some replies put every field on the title line; break them apart so each field gets its own line
function splitInlineFields(line) {
  const labels = line.match(INLINE_LABEL);
  return labels && labels.length >= 2 ? line.split(INLINE_LABEL) : [line];
}

// Removes heading, quote and list markers plus emphasis so labels match regardless of styling
function normalize(line) {
  return line
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+•]\s+)+/, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*/g, '')
    .replace(/(^|\s)_+|_+(\s|$)/g, '$1$2')
    .trim();
}

function stripWrapping(value) {
  let text = value.trim();
  const pairs = [['[', ']'], ['"', '"'], ['“', '”'], ["'", "'"], ['«', '»']];
  for (const [open, close] of pairs) {
    if (text.length > 1 && text.startsWith(open) && text.endsWith(close)) {
      text = text.slice(1, -1).trim();
    }
  }
  return text;
}

export function parseIdeas(markdown) {
  if (typeof markdown !== 'string' || !markdown) return null;

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n').flatMap(splitInlineFields);
  const intro = [];
  const outro = [];
  const ideas = [];
  let current = null;
  let currentField = null;
  let inOutro = false;

  for (const raw of lines) {
    if (inOutro) {
      outro.push(raw);
      continue;
    }
    const line = normalize(raw);

    const start = /^(\d{1,2})[.)]\s*(.+)$/.exec(line);
    if (start && !FIELDS.some(([, pattern]) => pattern.test(line))) {
      current = {
        number: Number(start[1]),
        title: stripWrapping(start[2]),
        format: '',
        question: '',
        thumbnailText: '',
        trigger: '',
      };
      ideas.push(current);
      currentField = null;
      continue;
    }

    if (!current) {
      intro.push(raw);
      continue;
    }
    if (!line) continue;

    let matched = false;
    for (const [key, pattern] of FIELDS) {
      const match = pattern.exec(line);
      if (!match) continue;
      current[key] = key === 'thumbnailText' || key === 'trigger' ? stripWrapping(match[1]) : match[1].trim();
      currentField = key;
      matched = true;
      break;
    }
    if (matched) continue;

    // A lowercase line right after a field is a wrapped continuation of that field
    if (currentField && /^\p{Ll}/u.test(line)) {
      current[currentField] = `${current[currentField]} ${line}`.trim();
      continue;
    }
    // Anything else after the first field closes the list
    if (currentField) {
      inOutro = true;
      outro.push(raw);
    }
  }

  const withQuestion = ideas.filter((idea) => idea.question);
  if (withQuestion.length < MIN_IDEAS) return null;

  return {
    intro: intro.join('\n').trim(),
    ideas,
    outro: outro.join('\n').trim(),
  };
}
