// Run with: node src/editor/sceneSummary.test.mjs
import assert from 'node:assert/strict';
import { sceneSummaries } from './sceneSummary.js';

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

const SHARED_BOILERPLATE = [
  'Wide 16:9 illustration, 1920x1080.',
  'Hand-drawn 2D stickman cartoon style for an educational explainer video.',
  'The characters are drawn with clean bold black linework and flat colors.',
  'The environment is a richly detailed hand-painted 2D illustration with depth, material textures, atmospheric lighting, soft shadows and cinematic composition, like a professional animated film background.',
  'Characters are true stickmen: large perfectly round white head, tiny black dot eyes, thin expressive black eyebrows, simple mouth, no nose.',
  'Stick body: the torso is a single thin black line or a small flat garment shape hanging from the shoulders; arms and legs are always single thin black lines of equal thickness, fully visible, never covered by sleeves or trousers; hands are tiny simple circles; feet are tiny short line ends.',
  'Hair and the flat garment drawn simply with flat color and light texture.',
  'Main characters keep both hands empty and never hold objects.',
  'No trousers, no sleeves, no shoes, no thick limbs, no body volume, no realistic hands or feet.',
  'Each main character must match its character sheet reference exactly: same head, face, proportions, hair, clothing, colors and accessories.',
].join(' ');

const SCENE_1_PROMPT = [
  SHARED_BOILERPLATE,
  'Scene: Tomás points to a massive telescope pointed at Mars.',
  'The character from character sheet 1, a stickman man of about 30 with messy hair, looking up with wonder.',
  'Setting: An astronomical observatory on a mountain peak at night, with brass equipment and star charts on the wall.',
  'Composition: medium shot, main character centered.',
].join(' ');

const SCENE_2_PROMPT = [
  SHARED_BOILERPLATE,
  'Scene: Tomás examines ancient astronomical manuscripts covered in mysterious planetary symbols.',
  'The character from character sheet 1, a stickman man of about 30 with messy hair, scratching his head in confusion.',
  'Setting: A dimly lit library with wooden shelves stacked with dusty scrolls and a glowing kerosene lamp.',
  'Composition: close-up on the manuscript with Tomás on the right third.',
].join(' ');

const EXPLAINER_PROMPT = [
  'Wide 16:9 educational explainer illustration, 1920x1080, in a simple hand-drawn 2D stickman cartoon style: pure white background, clean bold black linework, flat colors with minimal soft shading.',
  'At the top center, a bold black hand-lettered title in Spanish that reads exactly: "EL SISTEMA SOLAR".',
  'Layout: a horizontal row of 4 simple drawings from left to right connected by bold red arrows.',
  'Elements: the sun on the left, Mercury, Venus and Earth in orbital alignment.',
  'Symbols: a small glowing yellow circle over each planet.',
  'Each main character must match its character sheet reference exactly: same head, face, proportions, with empty hands.',
].join(' ');

test('strips shared boilerplate and character sheet descriptions while preserving scene specifics', () => {
  const scenes = [
    { number: 1, title: 'Escena 1 — Telescopio', prompt: SCENE_1_PROMPT },
    { number: 2, title: 'Escena 2 — Biblioteca', prompt: SCENE_2_PROMPT },
    { number: 3, title: 'Imagen 03 — Explicación', prompt: EXPLAINER_PROMPT },
  ];

  const summaries = sceneSummaries(scenes);
  assert.equal(summaries.length, 3);

  // Scene 1: shared boilerplate & character sheet descriptions stripped
  const s1 = summaries[0];
  assert.equal(s1.number, 1);
  assert.equal(s1.title, 'Escena 1 — Telescopio');
  assert.ok(!s1.summary.includes('1920x1080'));
  assert.ok(!s1.summary.includes('Hand-drawn 2D stickman'));
  assert.ok(!s1.summary.includes('character sheet'));
  assert.ok(!s1.summary.includes('stickman man of about'));
  assert.ok(s1.summary.includes('Tomás points to a massive telescope'));
  assert.ok(s1.summary.includes('astronomical observatory'));
  assert.ok(s1.summary.includes('medium shot'));

  // Scene 2: shared boilerplate & character sheet descriptions stripped
  const s2 = summaries[1];
  assert.equal(s2.number, 2);
  assert.equal(s2.title, 'Escena 2 — Biblioteca');
  assert.ok(!s2.summary.includes('1920x1080'));
  assert.ok(!s2.summary.includes('Hand-drawn 2D stickman'));
  assert.ok(!s2.summary.includes('character sheet'));
  assert.ok(!s2.summary.includes('stickman man of about'));
  assert.ok(s2.summary.includes('ancient astronomical manuscripts'));
  assert.ok(s2.summary.includes('dimly lit library'));

  // Explainer: keeps 'reads exactly' and 'Layout:' sentences
  const s3 = summaries[2];
  assert.equal(s3.number, 3);
  assert.equal(s3.title, 'Imagen 03 — Explicación');
  assert.ok(s3.summary.includes('reads exactly: "EL SISTEMA SOLAR"'));
  assert.ok(s3.summary.includes('Layout: a horizontal row of 4 simple drawings'));
  assert.ok(s3.summary.includes('Elements: the sun on the left'));
  // Style boilerplate with 1920x1080 / linework / character sheet is stripped
  assert.ok(!s3.summary.includes('1920x1080'));
  assert.ok(!s3.summary.includes('character sheet reference'));
});

test('caps summary length at 600 characters', () => {
  const longPrompt = 'Scene: ' + 'Very long detailed narrative text explaining the scene. '.repeat(30);
  const scenes = [{ number: 1, title: 'Scene 1', prompt: longPrompt }];
  const summaries = sceneSummaries(scenes);
  assert.ok(summaries[0].summary.length <= 600);
});

test('handles empty, null, or invalid scenes array', () => {
  assert.deepEqual(sceneSummaries([]), []);
  assert.deepEqual(sceneSummaries(null), []);
  assert.deepEqual(sceneSummaries(undefined), []);
  assert.deepEqual(sceneSummaries('not array'), []);
});

test('handles missing or non-string prompt in scene item', () => {
  const scenes = [
    { number: 1, title: 'Item 1' },
    { number: 2, title: 'Item 2', prompt: null },
    { number: 3, title: 'Item 3', prompt: 123 },
  ];
  const summaries = sceneSummaries(scenes);
  assert.equal(summaries.length, 3);
  assert.equal(summaries[0].summary, '');
  assert.equal(summaries[1].summary, '');
  assert.equal(summaries[2].summary, '');
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
