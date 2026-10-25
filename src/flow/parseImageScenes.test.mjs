// Run with: node src/flow/parseImageScenes.test.mjs
import assert from 'node:assert/strict';
import { parseImageScenes } from './parseImageScenes.js';

const P1 = 'Wide shot of a caveman lighting a fire.\nThe character from character sheet [1].';
const P2 = 'Infographic of the fire triangle, white background.';
const P3 = 'Two travelers crossing a river at dawn.';
const QUESTION = ['```', '¿Paso al siguiente bloque?', '1 → Sí, envíame el Bloque 2.', '2 → No, quiero cambiar imágenes de este bloque.', 'Responde 1 o 2.', '```'].join('\n');

// Exactly the layout prompt-2.txt (ETAPA 3, "Formato de salida") asks for
const STANDARD = [
  '**Bloque 1 de 3 — Imágenes 1 a 20**',
  '**Imagen 01 — Escena · Tomás (hoja 1)**',
  '```',
  P1,
  '```',
  '**Imagen 02 — Explicación (infografía central)**',
  '```',
  P2,
  '```',
  '**Imagen 03 — Escena · Tomás (hoja 1), Ana (hoja 2)**',
  '```',
  P3,
  '```',
  QUESTION,
].join('\n');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n${error.stack}`);
  }
}

test('standard Etapa 3 output', () => {
  const result = parseImageScenes(STANDARD);
  assert.deepEqual(result.block, { index: 1, total: 3, from: 1, to: 20 });
  assert.equal(result.intro, '');
  assert.equal(result.scenes.length, 3);
  assert.equal(result.kind, 'images');
  assert.deepEqual(result.scenes[0], { number: 1, kind: 'scene', title: 'Tomás', sheetRefs: ['1'], hook: false, prompt: P1 });
  assert.deepEqual(result.scenes[1], { number: 2, kind: 'explanation', title: 'infografía central', sheetRefs: [], hook: false, prompt: P2 });
  assert.deepEqual(result.scenes[2].sheetRefs, ['1', '2']);
  assert.equal(result.scenes[2].title, 'Tomás, Ana');
  assert.match(result.outro, /¿Paso al siguiente bloque\?/);
});

test('hoja lists: "hojas 1 y 2", variants and duplicates', () => {
  const text = [
    '**Imagen 04 — Escena · Tomás y Ana (hojas 1 y 2)**',
    '```',
    'p',
    '```',
    '**Imagen 05 — Escena · Tomás joven (hoja 1B)**',
    '```',
    'q',
    '```',
    '**Imagen 06 — Escena · Grupo (hojas 1, 2, 3)**',
    '```',
    'r',
    '```',
    '**Imagen 07 — Escena · Nadie**',
    '```',
    's',
    '```',
  ].join('\n');
  const { scenes, block } = parseImageScenes(text);
  assert.equal(block, null);
  assert.deepEqual(scenes.map((scene) => scene.sheetRefs), [['1', '2'], ['1B'], ['1', '2', '3'], []]);
  assert.equal(scenes[0].title, 'Tomás y Ana');
  assert.equal(scenes[3].title, 'Nadie');
});

test('tolerates headings, plain dashes and missing bold markers', () => {
  const text = [
    'Aquí tienes el bloque.',
    '',
    '### Bloque 2 de 3 - Imágenes 21 a 40',
    '### Imagen 21 - Escena · Ana (hoja 2)',
    '~~~text',
    'p',
    '~~~',
    'Imagen 22 – Explicación (comparativa)',
    '```',
    'q',
    '```',
  ].join('\n');
  const result = parseImageScenes(text);
  assert.equal(result.intro, 'Aquí tienes el bloque.');
  assert.deepEqual(result.block, { index: 2, total: 3, from: 21, to: 40 });
  assert.deepEqual(result.scenes.map((scene) => [scene.number, scene.kind, scene.title]), [
    [21, 'scene', 'Ana'],
    [22, 'explanation', 'comparativa'],
  ]);
});

test('bold closing before the dash and unknown kinds', () => {
  const text = ['**Imagen 08** — Portada (hoja 1)', '```', 'p', '```'].join('\n');
  const [scene] = parseImageScenes(text).scenes;
  assert.equal(scene.number, 8);
  assert.equal(scene.kind, 'other');
  assert.deepEqual(scene.sheetRefs, ['1']);
});

test('prompt keeps inner blank lines and ignores fences after the first one', () => {
  const text = ['**Imagen 01 — Escena · Tomás (hoja 1)**', '```', 'line one', '', 'line three', '```', '```', 'extra', '```'].join('\n');
  const result = parseImageScenes(text);
  assert.equal(result.scenes[0].prompt, 'line one\n\nline three');
  assert.match(result.outro, /extra/);
});

test('a heading without a prompt is dropped', () => {
  const text = ['**Imagen 01 — Escena · A (hoja 1)**', 'sin bloque de código', '**Imagen 02 — Escena · B (hoja 1)**', '```', 'p', '```'].join('\n');
  assert.deepEqual(parseImageScenes(text).scenes.map((scene) => scene.number), [2]);
});

test('CRLF line endings', () => {
  assert.equal(parseImageScenes(STANDARD.replace(/\n/g, '\r\n')).scenes.length, 3);
});

test('returns null for everything else', () => {
  assert.equal(parseImageScenes(''), null);
  assert.equal(parseImageScenes(null), null);
  assert.equal(parseImageScenes('Hola, ¿qué tal?'), null);
  assert.equal(parseImageScenes('**Personaje 1 — Tomás**\nHoja 1 · Rol: x.\n```\nsheet\n```'), null);
  assert.equal(parseImageScenes('**Bloque 1 de 3 — Miniaturas**\n**Imagen 01 — Escena · A**\n```\np\n```'), null);
  assert.equal(parseImageScenes('Mira la Imagen 3 - es genial'), null);
});

test('hook tag in image titles (with accents, casing and explanations)', () => {
  const text = [
    '**Bloque 1 de 3 — Imágenes 1 a 20**',
    '**Imagen 01 — Escena · Gancho · Tomás (hoja 1)**',
    '```',
    'a',
    '```',
    '**Imagen 02 — Explicación · Gancho (infografía central)**',
    '```',
    'b',
    '```',
    '**Imagen 03 — escena · GANCHO · Tomás y Ana (hojas 1 y 2)**',
    '```',
    'c',
    '```',
    '**Imagen 04 — Escena · El gancho del anzuelo (hoja 1)**',
    '```',
    'd',
    '```',
    '**Imagen 05 — Escena · Tomás (hoja 1)**',
    '```',
    'e',
    '```',
  ].join('\n');
  const { kind, scenes } = parseImageScenes(text);
  assert.equal(kind, 'images');
  assert.deepEqual(scenes.map((scene) => scene.hook), [true, true, true, false, false]);
  assert.deepEqual(scenes.map((scene) => scene.title), ['Tomás', 'infografía central', 'Tomás y Ana', 'El gancho del anzuelo', 'Tomás']);
  assert.deepEqual(scenes.map((scene) => scene.kind), ['scene', 'explanation', 'scene', 'scene', 'scene']);
  assert.deepEqual(scenes[2].sheetRefs, ['1', '2']);
});

test('animation blocks with and without hook', () => {
  const text = [
    '**Bloque 1 de 3 — Animaciones 1 a 20**',
    '**Animación 01 — Escena · Gancho · Tomás (hoja 1)**',
    '```',
    'Slow push-in on the caveman.',
    '```',
    '**Animación 02 — Explicación (infografía)**',
    '```',
    'The arrows animate.',
    '```',
    '**Animación 03 — Explicación · Gancho (comparativa)**',
    '```',
    'x',
    '```',
    '¿Paso al siguiente bloque de animaciones?',
  ].join('\n');
  const result = parseImageScenes(text);
  assert.equal(result.kind, 'animations');
  assert.deepEqual(result.block, { index: 1, total: 3, from: 1, to: 20 });
  assert.deepEqual(result.scenes[0], { number: 1, kind: 'scene', title: 'Tomás', sheetRefs: ['1'], hook: true, prompt: 'Slow push-in on the caveman.' });
  assert.deepEqual(result.scenes.map((scene) => [scene.number, scene.kind, scene.title, scene.hook]), [
    [1, 'scene', 'Tomás', true],
    [2, 'explanation', 'infografía', false],
    [3, 'explanation', 'comparativa', true],
  ]);
  assert.match(result.outro, /siguiente bloque de animaciones/);
});

test('corrected animations without block header and unaccented heading', () => {
  const text = ['Animacion 07 - Escena · Gancho · Ana (hoja 2)', '```', 'p', '```'].join('\n');
  const result = parseImageScenes(text);
  assert.equal(result.kind, 'animations');
  assert.equal(result.block, null);
  assert.deepEqual(result.scenes.map((scene) => [scene.number, scene.title, scene.hook]), [[7, 'Ana', true]]);
});

test('a heading of the other kind is not an item', () => {
  const text = ['**Imagen 01 — Escena · A**', '```', 'p', '```', '**Animación 01 — Escena · A**', '```', 'q', '```'].join('\n');
  const result = parseImageScenes(text);
  assert.equal(result.kind, 'images');
  assert.equal(result.scenes.length, 1);
});

if (failures > 0) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
