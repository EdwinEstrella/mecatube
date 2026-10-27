// Run with: node src/flow/imageBudget.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countScriptWords,
  imageCountFor,
  asksForScript,
  withImageBudget,
} from './imageBudget.js';

test('word count with punctuation/newlines', () => {
  assert.equal(countScriptWords(''), 0);
  assert.equal(countScriptWords('   \n\t  '), 0);
  assert.equal(countScriptWords(null), 0);
  assert.equal(countScriptWords(undefined), 0);

  // Punctuation attached to words counts as words
  assert.equal(countScriptWords('Hola, mundo! ¿Cómo estás?'), 4);

  // Standalone punctuation does not count as words
  assert.equal(countScriptWords('Primer párrafo.\n---\nSegundo párrafo... ¡Listo!'), 5);

  // Mixed newlines, tabs and numbers
  const multiline = 'Línea 1 con datos.\r\nLínea 2 con más texto.\n\n3 elementos -- fin.';
  // Línea(1) 1(2) con(3) datos.(4) Línea(5) 2(6) con(7) más(8) texto.(9) 3(10) elementos(11) -- fin.(12)
  assert.equal(countScriptWords(multiline), 12);
});

test('450 words -> 50', () => {
  const words450 = Array.from({ length: 450 }, (_, i) => `palabra${i + 1}`).join(' ');
  assert.equal(countScriptWords(words450), 450);
  assert.equal(imageCountFor(words450), 50);

  // Boundary checks: min 1 and ceil(words / 9)
  assert.equal(imageCountFor(''), 1);
  assert.equal(imageCountFor('una'), 1);
  assert.equal(imageCountFor('uno dos tres cuatro cinco seis siete ocho nueve'), 1);
  assert.equal(imageCountFor('uno dos tres cuatro cinco seis siete ocho nueve diez'), 2);
});

test('message not after script request unchanged', () => {
  const words40 = Array.from({ length: 40 }, (_, i) => `palabra${i + 1}`).join(' ');
  const nonScriptAssistant = 'Aquí tienes algunas ideas de títulos para tu video.';

  assert.equal(withImageBudget(words40, nonScriptAssistant), words40);
  assert.equal(withImageBudget(words40, null), words40);
  assert.equal(withImageBudget(words40, undefined), words40);
  assert.equal(withImageBudget(words40, ''), words40);
});

test('already contains CANTIDAD_IMAGENES unchanged', () => {
  const scriptPrompt = 'Envíame tu guion completo.';
  const words40WithOverride = `${Array.from({ length: 40 }, (_, i) => `palabra${i + 1}`).join(' ')}\n\n[CANTIDAD_IMAGENES]: 25`;

  assert.equal(withImageBudget(words40WithOverride, scriptPrompt), words40WithOverride);

  const words40Inline = `${Array.from({ length: 40 }, (_, i) => `palabra${i + 1}`).join(' ')} (CANTIDAD_IMAGENES personalizada)`;
  assert.equal(withImageBudget(words40Inline, scriptPrompt), words40Inline);
});

test('short message (<30 words) unchanged', () => {
  const scriptPrompt = 'Envíame tu guion completo.';

  const words29 = Array.from({ length: 29 }, (_, i) => `palabra${i + 1}`).join(' ');
  assert.equal(countScriptWords(words29), 29);
  assert.equal(withImageBudget(words29, scriptPrompt), words29);

  const words1 = 'Hola';
  assert.equal(withImageBudget(words1, scriptPrompt), words1);

  // At exactly 30 words, image budget is appended (30 / 9 = 3.33 -> 4)
  const words30 = Array.from({ length: 30 }, (_, i) => `palabra${i + 1}`).join(' ');
  assert.equal(countScriptWords(words30), 30);
  assert.equal(withImageBudget(words30, scriptPrompt), `${words30}\n\n[CANTIDAD_IMAGENES]: 4`);
});

test('accent/case-insensitive detection ("ENVIAME TU GUION COMPLETO")', () => {
  const words450 = Array.from({ length: 450 }, (_, i) => `palabra${i + 1}`).join(' ');

  assert.equal(asksForScript('ENVIAME TU GUION COMPLETO'), true);
  assert.equal(asksForScript('Envíame tu guion completo.'), true);
  assert.equal(asksForScript('envíame tu guión completo'), true);
  assert.equal(asksForScript('> Envíame tu guion completo.\n'), true);
  assert.equal(asksForScript('Otro mensaje cualquiera'), false);

  assert.equal(
    withImageBudget(words450, 'ENVIAME TU GUION COMPLETO'),
    `${words450}\n\n[CANTIDAD_IMAGENES]: 50`,
  );
  assert.equal(
    withImageBudget(words450, 'Envíame tu guion completo.'),
    `${words450}\n\n[CANTIDAD_IMAGENES]: 50`,
  );
});
