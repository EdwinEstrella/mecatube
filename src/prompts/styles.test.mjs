// Run: node src/prompts/styles.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STYLES,
  DEFAULT_STYLE_ID,
  getStyle,
  applyStyle,
} from './styles.js';
import {
  NEW_STYLE_SPECS,
  buildStyleReplacements,
} from './styleSpecs.js';
import electronStyles from '../../electron/styles.cjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptTwoPath = path.resolve(__dirname, 'prompt-2.txt');
const promptTwo = fs.readFileSync(promptTwoPath, 'utf8');

test('catalog contains all 26 styles in order with stickman as default', () => {
  const ids = STYLES.map((s) => s.id);
  assert.deepEqual(ids, electronStyles.STYLE_IDS);
  assert.equal(ids.length, 26);
  assert.equal(DEFAULT_STYLE_ID, 'stickman');

  // Verify alignment with electron/styles.cjs
  assert.equal(electronStyles.DEFAULT_STYLE_ID, 'stickman');

  const originalSix = ['stickman', 'cartoon', 'anime', '3d', 'flat', 'realistic'];

  // Verify Spanish labels, categories, and descriptions
  for (const style of STYLES) {
    assert.ok(style.id);
    assert.ok(style.label);
    assert.ok(style.description);
    assert.ok(style.category);
    assert.ok(style.englishDescription);
    if (originalSix.includes(style.id)) {
      assert.ok(style.image);
    }
  }
});

test('getStyle resolves known ids and falls back to stickman on unknown', () => {
  assert.equal(getStyle('cartoon').id, 'cartoon');
  assert.equal(getStyle('anime').id, 'anime');
  assert.equal(getStyle('3d').id, '3d');
  assert.equal(getStyle('flat').id, 'flat');
  assert.equal(getStyle('realistic').id, 'realistic');
  assert.equal(getStyle('cine-realista').id, 'cine-realista');
  assert.equal(getStyle('pixel-art').id, 'pixel-art');
  assert.equal(getStyle('unknown-style').id, 'stickman');
  assert.equal(getStyle(null).id, 'stickman');
  assert.equal(getStyle(undefined).id, 'stickman');
});

test('applyStyle for stickman returns the text byte-identical', () => {
  const result = applyStyle(promptTwo, 'stickman');
  assert.equal(result, promptTwo);
});

test('applyStyle for each non-stickman style removes all stickman wording and preserves workflow/headings/placeholders', () => {
  const nonStickmanStyles = STYLES.filter((s) => s.id !== 'stickman').map((s) => s.id);
  assert.equal(nonStickmanStyles.length, 25);

  const requiredHeadings = [
    'ETAPA 1 — SOLICITAR GUION',
    'ETAPA 2 — HOJAS DE PERSONAJE',
    'ETAPA 3 — ENTREGAR IMÁGENES EN BLOQUES DE 20',
    'ETAPA 4 — ENTREGAR ANIMACIONES EN BLOQUES DE 20',
    'ETAPA 5 — MINIATURA',
    '**Bloque [N] de [TOTAL_BLOQUES] — Imágenes [X] a [Y]**',
    '**Bloque [N] de [TOTAL_BLOQUES] — Animaciones [X] a [Y]**',
  ];

  const requiredPlaceholders = [
    '[FICHA]',
    '[ACCIONES_HISTORIA]',
    '[SCENE]',
    '[CHARACTERS]',
    '[SETTING]',
    '[SETTING_DETAILS]',
    '[BACKGROUND]',
    '[BACKGROUND_CHARACTERS]',
    '[SHOT]',
    '[MOOD]',
    '[TEXT]',
    '[TITULO]',
    '[LAYOUT]',
    '[ELEMENTS]',
    '[SYMBOLS]',
    '[LABELS]',
    '[PERSONAJES_EN_IMAGEN]',
    '[ACCION_PRINCIPAL]',
    '[MOVIMIENTO_SECUNDARIO]',
    '[CAMARA]',
    '[TEXTO_MINIATURA]',
    '[ELEMENTO_CLAVE]',
    '[LADO_PERSONAJE]',
    '[LADO_TEXTO]',
  ];

  for (const styleId of nonStickmanStyles) {
    const styled = applyStyle(promptTwo, styleId);

    // 1. Must contain no stickman / stick figure / palito (case-insensitive)
    const stickMatches = styled.match(/stickman|stick figure|palito/gi);
    assert.equal(
      stickMatches,
      null,
      `Style ${styleId} still contains stickman-related words: ${stickMatches?.join(', ')}`
    );

    // 2. All ETAPAs and block headings intact
    for (const heading of requiredHeadings) {
      assert.ok(
        styled.includes(heading),
        `Style ${styleId} missing required heading: ${heading}`
      );
    }

    // 3. All template placeholders intact
    for (const ph of requiredPlaceholders) {
      assert.ok(
        styled.includes(ph),
        `Style ${styleId} missing required placeholder: ${ph}`
      );
    }

    // 4. English style description is present
    const styleObj = getStyle(styleId);
    assert.ok(
      styled.includes(styleObj.englishDescription),
      `Style ${styleId} missing required english description: ${styleObj.englishDescription}`
    );
  }
});

test('for every new style, every replacement from actually occurs in prompt-2.txt and styled prompt contains englishDescription', () => {
  for (const spec of NEW_STYLE_SPECS) {
    const replacements = buildStyleReplacements(spec);
    assert.ok(Array.isArray(replacements) && replacements.length > 0);

    for (const [from, to] of replacements) {
      const occursExact = promptTwo.includes(from);
      const occursNormalized =
        promptTwo.includes(from.replaceAll('\r\n', '\n')) ||
        promptTwo.includes(from.replaceAll(/(?<!\r)\n/g, '\r\n'));
      assert.ok(
        occursExact || occursNormalized,
        `Style ${spec.id} replacement "from" string not found in prompt-2.txt: "${from.slice(0, 40)}..."`
      );
    }

    const styled = applyStyle(promptTwo, spec.id);
    assert.ok(
      styled.includes(spec.englishDescription),
      `Style ${spec.id} missing englishDescription in styled prompt`
    );
  }
});

test('text without from strings is returned unchanged and never throws', () => {
  const customPrompt = 'Un prompt completamente personalizado sin texto predeterminado.';
  const result = applyStyle(customPrompt, 'cartoon');
  assert.equal(result, customPrompt);
});

test('unknown style id returns prompt text unchanged', () => {
  const result = applyStyle(promptTwo, 'non-existent-id');
  assert.equal(result, promptTwo);
});
