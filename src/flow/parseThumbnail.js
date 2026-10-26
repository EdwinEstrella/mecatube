// Pure parser for the thumbnail delivery of src/prompts/prompt-2.txt (ETAPA 5, PLANTILLA 4):
//
//   **Miniatura · El Narrador (hoja 1)**
//   ```
//   YouTube thumbnail, wide 16:9, ... Main subject: the character from character sheet 1, ...
//   ```
//   Fin de la entrega.
//
// The heading may carry Markdown markers (#, **), the separator may be ·, •, |, –, — , - or :, and
// accents/casing are ignored. The thumbnail reuses the scene pipeline under one reserved scene number.
import { parseSheetRefs } from './parseImageScenes.js';

// Reserved scene number of the thumbnail in the scene store: the highest number electron/flow.cjs
// accepts (SCENE_MAX), so it never collides with real scenes and the main process needs no change.
// Nothing enumerates stored scene records (they are looked up by number), so it cannot leak into lists.
export const THUMBNAIL_NUMBER = 9999;

const stripAccents = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '');
const unmark = (line) => line.replace(/^\s*(?:#{1,6}\s*|>\s*)?/, '').replace(/[*_`]/g, '').trim();
const FENCE = /^\s*(`{3,}|~{3,})\s*[\w+#.-]*\s*$/;
const HEADING = /^miniatura\s*(?:[·•|–—:-]\s*)?(.*)$/;
const HEADING_PREFIX = /^miniatura\s*[·•|\-–—:]?\s*/i;
const SHEET_GROUP = /\(\s*hojas?\s[^)]*\)/gi;

// { number, kind: 'thumbnail', title, sheetRefs, prompt, intro, outro } or null when the message is
// not a thumbnail delivery (no "Miniatura" heading followed by a non-empty fenced prompt)
export function parseThumbnail(content) {
  if (typeof content !== 'string' || content.trim() === '') return null;
  const lines = content.replace(/\r\n?/g, '\n').split('\n');

  const headingAt = lines.findIndex((line) => line.length <= 200 && HEADING.test(stripAccents(unmark(line)).toLowerCase()));
  if (headingAt === -1) return null;

  const original = unmark(lines[headingAt]).replace(HEADING_PREFIX, '');
  let at = headingAt + 1;
  while (at < lines.length && !FENCE.test(lines[at])) at += 1;
  if (at >= lines.length) return null;
  const open = FENCE.exec(lines[at]);
  const closing = new RegExp(String.raw`^\s*${open[1][0]}{${open[1].length},}\s*$`);
  const body = [];
  let end = at + 1;
  while (end < lines.length && !closing.test(lines[end])) body.push(lines[end++]);
  if (end >= lines.length) return null;
  const prompt = body.join('\n').trim();
  if (prompt === '') return null;

  const title = original
    .replace(SHEET_GROUP, '')
    .replace(/\s*[·•|]\s*hojas?\s.*$/i, '')
    .replace(/^[\s·•|\-–—:,]+|[\s·•|\-–—:,.]+$/g, '')
    .replace(/\s{2,}/g, ' ');

  // Without a sheet reference it is not the illustrator's delivery (e.g. a thumbnail idea in the scriptwriter chat)
  const sheetRefs = parseSheetRefs(original);
  if (sheetRefs.length === 0) return null;

  return {
    number: THUMBNAIL_NUMBER,
    kind: 'thumbnail',
    title,
    sheetRefs,
    prompt,
    intro: lines.slice(0, headingAt).join('\n').trim(),
    outro: lines.slice(end + 1).join('\n').trim(),
  };
}
