// Run with: node src/flow/parseThumbnail.test.mjs
import assert from 'node:assert/strict';
import { parseThumbnail, THUMBNAIL_NUMBER } from './parseThumbnail.js';
import { parseImageScenes } from './parseImageScenes.js';

const PROMPT = 'YouTube thumbnail, wide 16:9, bold colors. Main subject: the character from character sheet 1, shocked face.';
const STANDARD = ['**Miniatura · El Narrador (hoja 1)**', '```', PROMPT, '```', 'Fin de la entrega.'].join('\n');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n     ${error.message}`);
  }
}

test('parses the exact ETAPA 5 delivery', () => {
  assert.deepEqual(parseThumbnail(STANDARD), {
    number: THUMBNAIL_NUMBER,
    kind: 'thumbnail',
    title: 'El Narrador',
    sheetRefs: ['1'],
    prompt: PROMPT,
    intro: '',
    outro: 'Fin de la entrega.',
  });
  assert.equal(THUMBNAIL_NUMBER, 9999);
});

test('tolerates heading variants, accents, separators and several sheets', () => {
  for (const heading of ['Miniatura - El Narrador (hoja 1)', '## **Miniatura — El Narrador (hoja 1)**', 'MINIATURA: El Narrador (hoja 1)', 'Miniatura • El Narrador (hoja 1)']) {
    const result = parseThumbnail([heading, '```', PROMPT, '```'].join('\n'));
    assert.equal(result.title, 'El Narrador', heading);
    assert.deepEqual(result.sheetRefs, ['1'], heading);
  }
  const multi = parseThumbnail(['**Miniatura · Tomás y Ana (hojas 1 y 2)**', '```', PROMPT, '```'].join('\n'));
  assert.deepEqual(multi.sheetRefs, ['1', '2']);
  assert.equal(multi.title, 'Tomás y Ana');
});

test('keeps text before the heading as intro and supports tilde fences and CRLF', () => {
  const result = parseThumbnail(['Aquí va.', '', '**Miniatura · Ana (hoja 2)**', '~~~', PROMPT, '~~~', 'Fin de la entrega.'].join('\r\n'));
  assert.equal(result.intro, 'Aquí va.');
  assert.equal(result.prompt, PROMPT);
  assert.deepEqual(result.sheetRefs, ['2']);
});

test('returns null without a fenced prompt, with an empty or unclosed fence, or for other messages', () => {
  assert.equal(parseThumbnail('**Miniatura · El Narrador (hoja 1)**\nFin de la entrega.'), null);
  assert.equal(parseThumbnail(['**Miniatura · El Narrador (hoja 1)**', '```', '```'].join('\n')), null);
  assert.equal(parseThumbnail(['**Miniatura · El Narrador (hoja 1)**', '```', PROMPT].join('\n')), null);
  assert.equal(parseThumbnail(['**Miniatura · Idea del guionista**', '```', PROMPT, '```'].join('\n')), null);
  assert.equal(parseThumbnail('Hola, ¿cómo estás?'), null);
  assert.equal(parseThumbnail(''), null);
  assert.equal(parseThumbnail(undefined), null);
});

test('a regular image block is not a thumbnail and parseImageScenes still reads it', () => {
  const block = ['**Bloque 1 de 1 — Imágenes 1 a 1**', '**Imagen 01 — Escena · Tomás (hoja 1)**', '```', 'A caveman.', '```'].join('\n');
  assert.equal(parseThumbnail(block), null);
  assert.equal(parseImageScenes(block).scenes[0].title, 'Tomás');
  assert.equal(parseImageScenes(STANDARD), null);
});

if (failures > 0) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
