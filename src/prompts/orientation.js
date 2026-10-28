// Orientation prompt transformations for 16:9 horizontal vs 9:16 vertical video formats.
// Preserves prompt structure while replacing aspect ratios, dimensions, framing, and adding short-form notes.

function replaceSubstring(text, from, to) {
  if (text.includes(from)) {
    return text.replaceAll(from, to);
  }
  if (from.includes('\r\n') && !text.includes('\r\n')) {
    const lfFrom = from.replaceAll('\r\n', '\n');
    const lfTo = to.replaceAll('\r\n', '\n');
    if (text.includes(lfFrom)) {
      return text.replaceAll(lfFrom, lfTo);
    }
  } else if (!from.includes('\r\n') && text.includes('\r\n')) {
    const crlfFrom = from.replaceAll(/(?<!\r)\n/g, '\r\n');
    const crlfTo = to.replaceAll(/(?<!\r)\n/g, '\r\n');
    if (text.includes(crlfFrom)) {
      return text.replaceAll(crlfFrom, crlfTo);
    }
  }
  return text;
}

// Vertical intro addition for prompt-1
const VERTICAL_NOTE =
  'Este video es un video vertical corto para YouTube Shorts, TikTok e Instagram Reels (gancho en los primeros 2 segundos, ritmo rápido).';

const PROMPT1_INTRO_TARGET = `formatos probados del nicho explainer.`;
const PROMPT1_INTRO_REPLACEMENT = `formatos probados del nicho explainer.\n${VERTICAL_NOTE}`;

// Exact replacements in prompt-1 and prompt-2 for vertical framing and 9:16 aspect ratio
const VERTICAL_EXACT_REPLACEMENTS = [
  // Prompt-1 intro note insertion
  [PROMPT1_INTRO_TARGET, PROMPT1_INTRO_REPLACEMENT],

  // Prompt-1 thumbnail format mention
  [
    '• Formato 16:9, contraste alto, punto focal claro y legible en tamaño pequeño.',
    '• Formato vertical 9:16, contraste alto, punto focal claro y legible en tamaño pequeño.',
  ],

  // Prompt-2 general format specification
  [
    '* Relación de aspecto 16:9, 1920x1080 px.',
    '* Relación de aspecto vertical 9:16, 1080x1920 px.',
  ],

  // Prompt-2 Plantilla 1 shot options
  [
    '* `[SHOT]` — `medium shot, main character centered` / `wide shot, main character\r\non the left third` / `wide shot, main character on the right third`.',
    '* `[SHOT]` — `vertical framing, subject centered` / `vertical framing, main character\r\ncentered` / `vertical framing, close-up centered`.',
  ],
  [
    '* `[SHOT]` — `medium shot, main character centered` / `wide shot, main character on the left third` / `wide shot, main character on the right third`.',
    '* `[SHOT]` — `vertical framing, subject centered` / `vertical framing, main character centered` / `vertical framing, close-up centered`.',
  ],

  // Prompt-2 Plantilla 2 layout tables (horizontal rows -> vertical stacks)
  [
    '| Flujo | a horizontal row of [N] simple drawings from left to right connected by\r\nbold red arrows |',
    '| Flujo | a vertical sequence of [N] simple drawings from top to bottom connected by\r\nbold red arrows |',
  ],
  [
    '| Flujo | a horizontal row of [N] simple drawings from left to right connected by bold red arrows |',
    '| Flujo | a vertical sequence of [N] simple drawings from top to bottom connected by bold red arrows |',
  ],
  [
    '| Línea de tiempo | a long horizontal dotted timeline with small tick marks, with\r\n[N] small drawings placed along it |',
    '| Línea de tiempo | a vertical dotted timeline running top to bottom with small tick marks, with\r\n[N] small drawings placed along it |',
  ],
  [
    '| Línea de tiempo | a long horizontal dotted timeline with small tick marks, with [N] small drawings placed along it |',
    '| Línea de tiempo | a vertical dotted timeline running top to bottom with small tick marks, with [N] small drawings placed along it |',
  ],

  // Prompt-2 Plantilla 3 camera motion
  [
    'slow gentle pan from left to right',
    'slow gentle vertical tilt from top to bottom',
  ],

  // Prompt-2 Plantilla 4 thumbnail header
  [
    'YouTube thumbnail, wide 16:9, 1920x1080.',
    'Vertical thumbnail, vertical 9:16, 1080x1920.',
  ],

  // Templates across stickman and styles (wide 16:9, 1920x1080 -> vertical 9:16, 1080x1920)
  [
    'wide 16:9, 1920x1080',
    'vertical 9:16, 1080x1920',
  ],
  [
    'Wide 16:9',
    'Vertical 9:16',
  ],
  [
    'wide 16:9',
    'vertical 9:16',
  ],
  [
    '1920x1080',
    '1080x1920',
  ],
  [
    '16:9',
    '9:16',
  ],
];

export function applyOrientation(promptText, orientation) {
  if (typeof promptText !== 'string') return '';
  if (orientation !== 'vertical') {
    return promptText;
  }

  let result = promptText;
  for (const [from, to] of VERTICAL_EXACT_REPLACEMENTS) {
    result = replaceSubstring(result, from, to);
  }

  return result;
}
