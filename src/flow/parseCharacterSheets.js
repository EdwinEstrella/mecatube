// Pure parser for the ETAPA 2 output of src/prompts/prompt-2.txt (character sheets). Per character:
//
//   **Personaje 1 — Tomás (protagonista)**
//   Hoja 1 · Rol: role in one line.
//   ```
//   character sheet prompt
//   ```
//
// followed by the approval question ("¿Las hojas de personaje están bien?", itself inside a code
// block). Headings may carry Markdown markers (#, **), the dash may be -, – or —, and a variant is
// written "**Personaje 1 — Tomás (adulto)** · Hoja 1B.".

const KEY_MAX = 64;

const stripAccents = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Lowercase ascii slug, [a-z0-9-] only, at most 64 chars; '' when nothing usable is left
export function slugify(text) {
  return stripAccents(String(text ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, KEY_MAX)
    .replace(/-+$/g, '');
}

const unmark = (line) => line.replace(/^\s*(?:#{1,6}\s*|>\s*)?/, '').replace(/[*_`]/g, '').trim();

const HEADING = /^personaje\s+\d+/;
const ROLE = /^(?:hoja\s+\w+\s*[·•|\-–—:]?\s*)?rol\s*:\s*(.+)$/i;
const FENCE = /^\s*(`{3,}|~{3,})\s*[\w+#.-]*\s*$/;
const QUESTION = /las hojas de personaje estan bien/;

function titleFrom(line) {
  let text = unmark(line);
  let role = '';
  const inlineRole = /\s[·•|]\s*(?:hoja\s+\w+\s*[·•|]\s*)?rol\s*:\s*(.+)$/i.exec(text);
  if (inlineRole) {
    role = inlineRole[1].trim();
    text = text.slice(0, inlineRole.index).trim();
  }
  text = text.replace(/\s*[·•|]\s*hoja\s+\w+\.?\s*$/i, '').replace(/[\s.:]+$/, '').trim();
  return { title: text, role };
}

// Characters of a finished assistant message as { characters: [{ key, title, role, prompt }] },
// or null when the message is not a character-sheet delivery
export function parseCharacterSheets(content) {
  if (typeof content !== 'string' || content.trim() === '') return null;
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  if (!QUESTION.test(stripAccents(content).toLowerCase())) return null;

  const found = [];
  let current = null;
  let fence = null; // { marker, lines }

  for (const line of lines) {
    if (fence) {
      const closing = new RegExp(`^\\s*${fence.char}{${fence.length},}\\s*$`);
      if (closing.test(line)) {
        // Only the first code block after a heading is that character's prompt
        if (current && current.prompt === null && fence.lines.join('').trim() !== '') {
          current.prompt = fence.lines.join('\n');
        }
        fence = null;
      } else {
        fence.lines.push(line);
      }
      continue;
    }

    const open = FENCE.exec(line);
    if (open) {
      fence = { char: open[1][0], length: open[1].length, lines: [] };
      continue;
    }

    const plain = stripAccents(unmark(line)).toLowerCase();
    if (HEADING.test(plain)) {
      const { title, role } = titleFrom(line);
      current = { title, role, prompt: null };
      found.push(current);
      continue;
    }
    if (current && !current.role) {
      const match = ROLE.exec(unmark(line));
      if (match) current.role = match[1].trim();
    }
  }

  const used = new Set();
  const characters = [];
  for (const item of found) {
    if (item.prompt === null) continue;
    const base = slugify(item.title) || `personaje-${characters.length + 1}`;
    let key = base;
    for (let n = 2; used.has(key); n += 1) {
      const suffix = `-${n}`;
      key = `${base.slice(0, KEY_MAX - suffix.length)}${suffix}`;
    }
    used.add(key);
    characters.push({ key, title: item.title, role: item.role, prompt: item.prompt });
  }
  return characters.length > 0 ? { characters } : null;
}
