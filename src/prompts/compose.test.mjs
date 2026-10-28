import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composePrompt } from './compose.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptOnePath = path.resolve(__dirname, 'prompt-1.txt');
const promptTwoPath = path.resolve(__dirname, 'prompt-2.txt');
const promptOne = fs.readFileSync(promptOnePath, 'utf8');
const promptTwo = fs.readFileSync(promptTwoPath, 'utf8');

test('composePrompt: horizontal + stickman + explainer returns input byte-identical', () => {
  const c1 = composePrompt(promptOne, {
    presetId: 'prompt-1',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
  });
  assert.equal(c1, promptOne);

  const c2 = composePrompt(promptTwo, {
    presetId: 'prompt-2',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
  });
  assert.equal(c2, promptTwo);
});

test('composePrompt: non-string input returns empty string', () => {
  assert.equal(composePrompt(null, {}), '');
  assert.equal(composePrompt(undefined, {}), '');
});

test('composePrompt: vertical orientation removes 16:9 and 1920x1080 across all visual styles', () => {
  const styles = ['stickman', 'cartoon', 'anime', '3d', 'flat', 'realistic'];

  for (const style of styles) {
    const composed = composePrompt(promptTwo, {
      presetId: 'prompt-2',
      style,
      orientation: 'vertical',
      videoType: 'explainer',
    });

    assert.ok(
      !composed.includes('16:9'),
      `Style ${style} vertical contains 16:9`
    );
    assert.ok(
      !composed.includes('1920x1080'),
      `Style ${style} vertical contains 1920x1080`
    );
    assert.ok(
      composed.includes('9:16'),
      `Style ${style} vertical missing 9:16`
    );
    assert.ok(
      composed.includes('1080x1920'),
      `Style ${style} vertical missing 1080x1920`
    );
  }
});

test('composePrompt: branchCharacters appends PERSONAJES YA DEFINIDOS block', () => {
  const branchCharacters = [
    { key: 'leo', name: 'Leo', description: 'Astronauta con traje espacial' },
    { key: 'bot', name: 'Robot 1', description: '' },
  ];

  const composed = composePrompt(promptTwo, {
    presetId: 'prompt-2',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
    branchCharacters,
  });

  assert.ok(composed.includes('PERSONAJES YA DEFINIDOS'));
  assert.ok(composed.includes('- Leo: Astronauta con traje espacial'));
  assert.ok(composed.includes('- Robot 1: ver imagen de referencia'));
  assert.ok(composed.includes('Omite la creación de nuevas hojas de personaje en la ETAPA 2'));

  // Without branchCharacters, or with empty array, must be byte-identical
  const emptyComposed = composePrompt(promptTwo, {
    presetId: 'prompt-2',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
    branchCharacters: [],
  });
  assert.equal(emptyComposed, promptTwo);

  const nullComposed = composePrompt(promptTwo, {
    presetId: 'prompt-2',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
    branchCharacters: null,
  });
  assert.equal(nullComposed, promptTwo);
});

test('composePrompt: prompt-1 with brief appends CONTEXTO DE ESTE VIDEO and skip instructions', () => {
  const briefText = 'Título del video: Los secretos del océano\nDuración objetivo: 5 minutos';
  const composed = composePrompt(promptOne, {
    presetId: 'prompt-1',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
    brief: briefText,
  });

  assert.ok(composed.includes('=== CONTEXTO DE ESTE VIDEO ==='));
  assert.ok(composed.includes(briefText));
  assert.ok(composed.includes('Omite la ETAPA 1'));
  assert.ok(composed.includes('Trata este contexto como la idea seleccionada'));
  assert.ok(composed.includes('=============================='));
});

test('composePrompt: prompt-1 without brief is strictly byte-identical', () => {
  const empty = composePrompt(promptOne, {
    presetId: 'prompt-1',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
    brief: '',
  });
  assert.equal(empty, promptOne);

  const spaces = composePrompt(promptOne, {
    presetId: 'prompt-1',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
    brief: '   \n  ',
  });
  assert.equal(spaces, promptOne);

  const nullBrief = composePrompt(promptOne, {
    presetId: 'prompt-1',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
    brief: null,
  });
  assert.equal(nullBrief, promptOne);

  const omitted = composePrompt(promptOne, {
    presetId: 'prompt-1',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
  });
  assert.equal(omitted, promptOne);
});

test('composePrompt: prompt-2 ignores brief and remains byte-identical', () => {
  const composed = composePrompt(promptTwo, {
    presetId: 'prompt-2',
    style: 'stickman',
    orientation: 'horizontal',
    videoType: 'explainer',
    brief: 'Brief que no debe aplicarse a prompt-2',
  });
  assert.equal(composed, promptTwo);
});

