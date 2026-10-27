// Run with: node src/flow/animationSeconds.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_ANIMATION_SECONDS,
  DEFAULT_ANIMATION_SECONDS,
  animationSeconds,
  countAnchorWords,
} from './animationSeconds.js';

test('0 words -> 8 (defaults when anchor text is absent or empty)', () => {
  assert.equal(animationSeconds(''), 8);
  assert.equal(animationSeconds('   \n\t  '), 8);
  assert.equal(animationSeconds(null), 8);
  assert.equal(animationSeconds(undefined), 8);
});

test('5 words -> 4 (5 / 2.5 * 1.3 = 2.6 -> 4)', () => {
  const text = 'Uno dos tres cuatro cinco';
  assert.equal(countAnchorWords(text), 5);
  assert.equal(animationSeconds(text), 4);
});

test('9 words -> 6 (9 / 2.5 * 1.3 = 4.68 -> 6)', () => {
  const text = 'Uno dos tres cuatro cinco seis siete ocho nueve';
  assert.equal(countAnchorWords(text), 9);
  assert.equal(animationSeconds(text), 6);
});

test('14 words -> 8 (14 / 2.5 * 1.3 = 7.28 -> 8)', () => {
  const text = 'Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce';
  assert.equal(countAnchorWords(text), 14);
  assert.equal(animationSeconds(text), 8);
});

test('18 words -> 10 (18 / 2.5 * 1.3 = 9.36 -> 10)', () => {
  const text = 'Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho';
  assert.equal(countAnchorWords(text), 18);
  assert.equal(animationSeconds(text), 10);
});

test('40 words -> 10 (40 / 2.5 * 1.3 = 20.8 -> clamped to 10)', () => {
  const words40 = Array.from({ length: 40 }, (_, i) => `palabra${i + 1}`).join(' ');
  assert.equal(countAnchorWords(words40), 40);
  assert.equal(animationSeconds(words40), 10);
});

test('punctuation-only tokens ignored', () => {
  assert.equal(countAnchorWords('--- ... « » ¡! ¿?'), 0);
  assert.equal(animationSeconds('--- ... « » ¡! ¿?'), 8);

  const textWithPunctuationTokens = '« Uno dos tres cuatro cinco » --- ...';
  assert.equal(countAnchorWords(textWithPunctuationTokens), 5);
  assert.equal(animationSeconds(textWithPunctuationTokens), 4);
});

test('constants match supported Flow durations', () => {
  assert.deepEqual(ALLOWED_ANIMATION_SECONDS, [4, 6, 8, 10]);
  assert.equal(DEFAULT_ANIMATION_SECONDS, 8);
});
