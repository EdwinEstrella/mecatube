// Run with: node src/flow/illustratorBlocks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIllustratorBlocks } from './illustratorBlocks.js';

const SCENE_BLOCK_1 = [
  '**Bloque 1 de 2 — Imágenes 1 a 2**',
  '**Imagen 01 — Escena · Tomás (hoja 1)**',
  'Guion: «Tomás mira las estrellas con curiosidad.»',
  '```',
  'Close up of Tomás looking at the sky.',
  '```',
  '**Imagen 02 — Explicación (Robot)**',
  'Guion: «Un robot amigable.»',
  '```',
  'Blueprint of the robot.',
  '```',
  '¿Paso al siguiente bloque?',
  '1 -> Sí',
  '2 -> No',
].join('\n');

const ANIMATION_BLOCK_1 = [
  '**Bloque 1 de 1 — Animaciones 1 a 2**',
  '**Animación 01 — Escena · Tomás**',
  '```',
  'Camera pans slowly.',
  '```',
  '**Animación 02 — Explicación**',
  '```',
  'Robot parts rotate.',
  '```',
].join('\n');

const THUMBNAIL_MSG = [
  '**Miniatura · El Viaje (hoja 1)**',
  '```',
  'YouTube thumbnail format, bold colors.',
  '```',
  'Fin de la entrega.',
].join('\n');

const CHARACTER_SHEET_MSG = [
  '**Personaje 1 — Tomás (protagonista)**',
  'Hoja 1 · Rol: El explorador espacial.',
  '```',
  'Tomás sheet prompt',
  '```',
  '¿Las hojas de personaje están bien?',
].join('\n');

const IDEAS_MSG = [
  '**Idea 01:** Un viaje al espacio',
  'Sinopsis interesante.',
].join('\n');

test('returns empty structures for invalid or empty input', () => {
  assert.deepEqual(parseIllustratorBlocks(null), {
    sceneBlocks: [],
    animationBlocks: [],
    thumbnail: null,
    imageBlocks: [],
    thumbnails: [],
  });
  assert.deepEqual(parseIllustratorBlocks([]), {
    sceneBlocks: [],
    animationBlocks: [],
    thumbnail: null,
    imageBlocks: [],
    thumbnails: [],
  });
});

test('parses scene blocks, animation blocks, and thumbnails with anchors', () => {
  const messages = [
    { role: 'user', content: 'Crea los personajes' },
    { role: 'assistant', content: CHARACTER_SHEET_MSG },
    { role: 'user', content: '1' },
    { role: 'assistant', content: SCENE_BLOCK_1 },
    { role: 'user', content: '1' },
    { role: 'assistant', content: ANIMATION_BLOCK_1 },
    { role: 'user', content: '1' },
    { role: 'assistant', content: THUMBNAIL_MSG },
    { role: 'assistant', content: IDEAS_MSG },
  ];

  const result = parseIllustratorBlocks(messages);

  // Scene blocks
  assert.equal(result.sceneBlocks.length, 1);
  assert.equal(result.sceneBlocks[0].block.index, 1);
  assert.equal(result.sceneBlocks[0].scenes.length, 2);
  assert.equal(result.sceneBlocks[0].messageIndex, 3);

  // Animation blocks with anchors resolved from scene block
  assert.equal(result.animationBlocks.length, 1);
  assert.equal(result.animationBlocks[0].block.index, 1);
  assert.equal(result.animationBlocks[0].scenes.length, 2);
  assert.equal(result.animationBlocks[0].messageIndex, 5);
  // Scene 1 anchor copied over from scene block
  assert.equal(result.animationBlocks[0].scenes[0].scriptAnchor, 'Tomás mira las estrellas con curiosidad.');
  assert.equal(typeof result.animationBlocks[0].scenes[0].seconds, 'number');

  // Thumbnail
  assert.ok(result.thumbnail);
  assert.equal(result.thumbnail.title, 'El Viaje');
  assert.equal(result.thumbnail.messageIndex, 7);

  // Per-message arrays matching MessageList indexing
  assert.equal(result.imageBlocks.length, messages.length);
  assert.equal(result.imageBlocks[0], null);
  assert.equal(result.imageBlocks[1], null); // sheets ignored
  assert.equal(result.imageBlocks[2], null);
  assert.equal(result.imageBlocks[3], result.sceneBlocks[0]);
  assert.equal(result.imageBlocks[4], null);
  assert.equal(result.imageBlocks[5], result.animationBlocks[0]);
  assert.equal(result.imageBlocks[6], null);
  assert.equal(result.imageBlocks[7], null);
  assert.equal(result.imageBlocks[8], null); // ideas ignored

  assert.equal(result.thumbnails.length, messages.length);
  assert.equal(result.thumbnails[7], result.thumbnail);
});
