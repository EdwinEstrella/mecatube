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
import electronStyles from '../../electron/styles.cjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptTwoPath = path.resolve(__dirname, 'prompt-2.txt');
const promptTwo = fs.readFileSync(promptTwoPath, 'utf8');

test('catalog contains all 6 styles in order with stickman as default', () => {
  const ids = STYLES.map((s) => s.id);
  assert.deepEqual(ids, ['stickman', 'cartoon', 'anime', '3d', 'flat', 'realistic']);
  assert.equal(DEFAULT_STYLE_ID, 'stickman');

  // Verify alignment with electron/styles.cjs
  assert.deepEqual(electronStyles.STYLE_IDS, ids);
  assert.equal(electronStyles.DEFAULT_STYLE_ID, 'stickman');

  // Verify Spanish labels and descriptions
  for (const style of STYLES) {
    assert.ok(style.id);
    assert.ok(style.label);
    assert.ok(style.description);
    assert.ok(style.image);
    assert.ok(style.englishDescription);
  }
});

test('getStyle resolves known ids and falls back to stickman on unknown', () => {
  assert.equal(getStyle('cartoon').id, 'cartoon');
  assert.equal(getStyle('anime').id, 'anime');
  assert.equal(getStyle('3d').id, '3d');
  assert.equal(getStyle('flat').id, 'flat');
  assert.equal(getStyle('realistic').id, 'realistic');
  assert.equal(getStyle('unknown-style').id, 'stickman');
  assert.equal(getStyle(null).id, 'stickman');
  assert.equal(getStyle(undefined).id, 'stickman');
});

test('applyStyle for stickman returns the text byte-identical', () => {
  const result = applyStyle(promptTwo, 'stickman');
  assert.equal(result, promptTwo);
});

test('applyStyle for each non-stickman style removes all stickman wording and preserves workflow/headings/placeholders', () => {
  const nonStickmanStyles = ['cartoon', 'anime', '3d', 'flat', 'realistic'];

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

test('text without from strings is returned unchanged and never throws', () => {
  const customPrompt = 'Un prompt completamente personalizado sin texto predeterminado.';
  const result = applyStyle(customPrompt, 'cartoon');
  assert.equal(result, customPrompt);
});

test('unknown style id returns prompt text unchanged', () => {
  const result = applyStyle(promptTwo, 'non-existent-id');
  assert.equal(result, promptTwo);
});
