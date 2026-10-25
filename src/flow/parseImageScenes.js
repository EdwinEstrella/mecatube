// Pure parser for the ETAPA 3 output of src/prompts/prompt-2.txt (image blocks). Per block:
//
//   **Bloque 1 de 3 — Imágenes 1 a 20**
//   **Imagen 01 — Escena · Tomás (hoja 1), Ana (hoja 2)**
//   ```
//   English image prompt
//   ```
//   **Imagen 02 — Explicación (infografía)**
//   ```
//   English image prompt
//   ```
//   ¿Paso al siguiente bloque?  (often inside a code block)
//
// Headings may carry Markdown markers (#, **), the dash may be -, – or —, and the block header is
// optional (corrected images are re-sent without it). Animation blocks ("Animación NN") never match.

const stripAccents = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '');
const unmark = (line) => line.replace(/^\s*(?:#{1,6}\s*|>\s*)?/, '').replace(/[*_`]/g, '').trim();

const FENCE = /^\s*(`{3,}|~{3,})\s*[\w+#.-]*\s*$/;
const DASH = '[·•|–—:-]';
const BLOCK = new RegExp(String.raw`^bloque\s+(\d+)\s+de\s+(\d+)(?:\s*${DASH}\s*(.*))?$`);
const RANGE = /^imagenes?\s+(\d+)\s+a\s+(\d+)/;
const HEADING = new RegExp(String.raw`^imagen\s+(\d+)\s*(?:${DASH}\s*(.*))?$`);
const SHEETS = /hojas?\s+(\d+[a-z]?(?:\s*(?:,|\by\b|\be\b|&|\/)\s*\d+[a-z]?)*)/gi;
const SHEET_ITEM = /\d+[a-z]?/gi;
const SHEET_GROUP = /\(\s*hojas?\s[^)]*\)/gi;

const KINDS = { escena: 'scene', explicacion: 'explanation' };

function parseHeading(number, rest) {
  const text = String(rest ?? '').trim();
  const plain = stripAccents(text).toLowerCase();
  const word = /^([a-z]+)/.exec(plain)?.[1] ?? '';
  const kind = KINDS[word] ?? 'other';

  const sheetRefs = [];
  for (const match of text.matchAll(SHEETS)) {
    for (const item of match[1].matchAll(SHEET_ITEM)) {
      const ref = item[0].toUpperCase();
      if (!sheetRefs.includes(ref)) sheetRefs.push(ref);
    }
  }

  let title = text.replace(SHEET_GROUP, '').replace(/\s*[·•|]\s*hojas?\s.*$/i, '');
  if (kind === 'explanation') {
    // "Explicación (disposición)": the label is the parenthesised layout
    const inner = /\(([^)]*)\)/.exec(title)?.[1]?.trim();
    title = inner || '';
  } else if (kind === 'scene') {
    title = title.replace(/^escena\s*[·•|\-–—:]?\s*/i, '');
  }
  title = title.replace(/^[\s·•|\-–—:,]+|[\s·•|\-–—:,.]+$/g, '').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ');
  return { number, kind, title, sheetRefs };
}

// Scenes of a finished assistant message, or null when it is not an image-block delivery:
// { block: { index, total, from, to } | null, intro, scenes: [{ number, kind, title, sheetRefs, prompt }], outro }
// sheetRefs are the sheet labels as written ("1", "2", "1B"), in order of appearance.
export function parseImageScenes(content) {
  if (typeof content !== 'string' || content.trim() === '') return null;
  const lines = content.replace(/\r\n?/g, '\n').split('\n');

  let block = null;
  const intro = [];
  const scenes = [];
  let current = null;
  let tail = [];
  let fence = null; // { char, length, lines }

  for (const line of lines) {
    if (fence) {
      const closing = new RegExp(String.raw`^\s*${fence.char}{${fence.length},}\s*$`);
      if (closing.test(line)) {
        if (current && current.prompt === null && fence.lines.join('').trim() !== '') current.prompt = fence.lines.join('\n');
        else tail.push(...fence.raw, line);
        fence = null;
      } else {
        fence.lines.push(line);
        fence.raw.push(line);
      }
      continue;
    }

    const open = FENCE.exec(line);
    if (open) {
      fence = { char: open[1][0], length: open[1].length, lines: [], raw: [line] };
      continue;
    }

    const plain = stripAccents(unmark(line)).toLowerCase();
    const blockMatch = BLOCK.exec(plain);
    if (blockMatch) {
      const range = RANGE.exec(blockMatch[3] ?? '');
      if (!range) return null; // an animation (or other) block, not images
      block = { index: Number(blockMatch[1]), total: Number(blockMatch[2]), from: Number(range[1]), to: Number(range[2]) };
      continue;
    }
    const headingMatch = HEADING.exec(plain);
    if (headingMatch) {
      // Re-read the heading with its original accents and casing
      const original = unmark(line).replace(/^imagen\s+\d+\s*[·•|\-–—:]?\s*/i, '');
      current = { ...parseHeading(Number(headingMatch[1]), original), prompt: null };
      scenes.push(current);
      tail = [];
      continue;
    }

    if (scenes.length === 0) intro.push(line);
    else if (current.prompt !== null) tail.push(line);
  }

  const found = scenes.filter((scene) => scene.prompt !== null);
  if (found.length === 0) return null;
  return {
    block,
    intro: intro.join('\n').trim(),
    scenes: found,
    outro: tail.join('\n').trim(),
  };
}
