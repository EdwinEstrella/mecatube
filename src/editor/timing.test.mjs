// Run with: node src/editor/timing.test.mjs
import assert from 'node:assert/strict';
import { buildPhrases, distributeEvenly, assignByPhrases } from './timing.js';

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

// --- buildPhrases: invalid input ---
test('buildPhrases returns [] for non-array input', () => {
  assert.deepEqual(buildPhrases(null), []);
  assert.deepEqual(buildPhrases(undefined), []);
  assert.deepEqual(buildPhrases('words'), []);
  assert.deepEqual(buildPhrases(123), []);
  assert.deepEqual(buildPhrases({}), []);
});

test('buildPhrases skips invalid words and builds from valid ones', () => {
  const words = [
    null,
    undefined,
    {},
    { w: '', s: 0, e: 1 },
    { w: '   ', s: 0, e: 1 },
    { w: 'bad_time', s: '0', e: 1 },
    { w: 'nan_start', s: NaN, e: 1 },
    { w: 'inf_end', s: 0, e: Infinity },
    { w: 'inverted', s: 2, e: 1 },
    { w: 'first', s: 0, e: 0.5 },
    { w: '   ', s: 0.5, e: 0.6 },
    { w: 'second.', s: 0.6, e: 1.0 },
  ];
  const phrases = buildPhrases(words);
  assert.equal(phrases.length, 1);
  assert.deepEqual(phrases[0], {
    index: 0,
    text: 'first second.',
    start: 0,
    end: 1,
    wordCount: 2,
  });
});

test('buildPhrases returns [] if all words are invalid', () => {
  const words = [
    { w: '', s: 0, e: 1 },
    { w: 'inv', s: 2, e: 1 },
  ];
  assert.deepEqual(buildPhrases(words), []);
});

// --- buildPhrases: punctuation split ---
test('buildPhrases splits on sentence punctuation (. ! ? … ; :)', () => {
  const words = [
    { w: 'Uno.', s: 0, e: 0.5 },
    { w: 'Dos!', s: 0.6, e: 1.1 },
    { w: 'Tres?', s: 1.2, e: 1.7 },
    { w: 'Cuatro…', s: 1.8, e: 2.3 },
    { w: 'Cinco;', s: 2.4, e: 2.9 },
    { w: 'Seis:', s: 3.0, e: 3.5 },
    { w: 'Siete', s: 3.6, e: 4.0 },
  ];
  const phrases = buildPhrases(words);
  assert.equal(phrases.length, 7);
  assert.equal(phrases[0].text, 'Uno.');
  assert.equal(phrases[1].text, 'Dos!');
  assert.equal(phrases[2].text, 'Tres?');
  assert.equal(phrases[3].text, 'Cuatro…');
  assert.equal(phrases[4].text, 'Cinco;');
  assert.equal(phrases[5].text, 'Seis:');
  assert.equal(phrases[6].text, 'Siete');
  assert.equal(phrases[6].index, 6);
});

// --- buildPhrases: gap split ---
test('buildPhrases splits when silence exceeds maxGap', () => {
  const words = [
    { w: 'Hello', s: 0, e: 0.5 },
    { w: 'world', s: 0.7, e: 1.2 }, // gap 0.2 <= 0.6
    { w: 'again', s: 1.9, e: 2.4 }, // gap 0.7 > 0.6
  ];
  const phrases = buildPhrases(words);
  assert.equal(phrases.length, 2);
  assert.equal(phrases[0].text, 'Hello world');
  assert.equal(phrases[0].start, 0);
  assert.equal(phrases[0].end, 1.2);
  assert.equal(phrases[1].text, 'again');
  assert.equal(phrases[1].start, 1.9);
});

test('buildPhrases respects custom maxGap', () => {
  const words = [
    { w: 'Hello', s: 0, e: 0.5 },
    { w: 'world', s: 0.8, e: 1.2 }, // gap 0.3
  ];
  const defaultGap = buildPhrases(words);
  assert.equal(defaultGap.length, 1);

  const customGap = buildPhrases(words, { maxGap: 0.25 });
  assert.equal(customGap.length, 2);
});

// --- buildPhrases: maxDuration split ---
test('buildPhrases splits when adding a word exceeds maxDuration', () => {
  const words = [
    { w: 'one', s: 0, e: 2.5 },
    { w: 'two', s: 2.6, e: 5.5 }, // total duration 5.5 <= 6
    { w: 'three', s: 5.6, e: 6.5 }, // total duration 6.5 > 6
  ];
  const phrases = buildPhrases(words, { maxDuration: 6 });
  assert.equal(phrases.length, 2);
  assert.equal(phrases[0].text, 'one two');
  assert.equal(phrases[0].start, 0);
  assert.equal(phrases[0].end, 5.5);
  assert.equal(phrases[1].text, 'three');
  assert.equal(phrases[1].start, 5.6);
  assert.equal(phrases[1].end, 6.5);
});

test('buildPhrases does not split a single word exceeding maxDuration', () => {
  const words = [
    { w: 'superlongword', s: 0, e: 8.5 },
    { w: 'next', s: 8.6, e: 9.2 },
  ];
  const phrases = buildPhrases(words, { maxDuration: 6 });
  assert.equal(phrases.length, 2);
  assert.equal(phrases[0].text, 'superlongword');
  assert.equal(phrases[0].start, 0);
  assert.equal(phrases[0].end, 8.5);
  assert.equal(phrases[1].text, 'next');
});

// --- buildPhrases: closing-quote punctuation ---
test('buildPhrases ends phrase on punctuation followed by closing quotes or brackets', () => {
  const words = [
    { w: 'said."', s: 0, e: 0.5 },
    { w: 'yes!”', s: 0.6, e: 1.0 },
    { w: 'done.»', s: 1.1, e: 1.5 },
    { w: 'here.)', s: 1.6, e: 2.0 },
    { w: 'stop.]', s: 2.1, e: 2.5 },
    { w: 'nested.")', s: 2.6, e: 3.0 },
    { w: 'tail', s: 3.1, e: 3.5 },
  ];
  const phrases = buildPhrases(words);
  assert.equal(phrases.length, 7);
  assert.equal(phrases[0].text, 'said."');
  assert.equal(phrases[1].text, 'yes!”');
  assert.equal(phrases[2].text, 'done.»');
  assert.equal(phrases[3].text, 'here.)');
  assert.equal(phrases[4].text, 'stop.]');
  assert.equal(phrases[5].text, 'nested.")');
  assert.equal(phrases[6].text, 'tail');
});

test('buildPhrases does not split on quotes without sentence punctuation', () => {
  const words = [
    { w: '"start', s: 0, e: 0.5 },
    { w: 'middle"', s: 0.6, e: 1.0 },
    { w: 'end', s: 1.1, e: 1.5 },
  ];
  const phrases = buildPhrases(words);
  assert.equal(phrases.length, 1);
  assert.equal(phrases[0].text, '"start middle" end');
});

// --- buildPhrases: rounding ---
test('buildPhrases rounds start and end to 3 decimal places', () => {
  const words = [
    { w: 'alpha', s: 0.12345, e: 1.23456 },
    { w: 'beta.', s: 1.34567, e: 2.45678 },
  ];
  const phrases = buildPhrases(words);
  assert.equal(phrases.length, 1);
  assert.equal(phrases[0].start, 0.123);
  assert.equal(phrases[0].end, 2.457);
});

// --- distributeEvenly: invalid input ---
test('distributeEvenly returns [] for invalid count or duration', () => {
  assert.deepEqual(distributeEvenly(0, 10), []);
  assert.deepEqual(distributeEvenly(-2, 10), []);
  assert.deepEqual(distributeEvenly(1.5, 10), []);
  assert.deepEqual(distributeEvenly('3', 10), []);
  assert.deepEqual(distributeEvenly(null, 10), []);

  assert.deepEqual(distributeEvenly(3, 0), []);
  assert.deepEqual(distributeEvenly(3, -5), []);
  assert.deepEqual(distributeEvenly(3, Infinity), []);
  assert.deepEqual(distributeEvenly(3, NaN), []);
  assert.deepEqual(distributeEvenly(3, '10'), []);
  assert.deepEqual(distributeEvenly(3, null), []);
});

// --- distributeEvenly: contiguity and last end ---
test('distributeEvenly creates contiguous slices with last end exactly duration', () => {
  const count = 3;
  const duration = 10;
  const slices = distributeEvenly(count, duration);

  assert.equal(slices.length, 3);
  assert.deepEqual(slices, [
    { number: 1, start: 0, end: 3.333 },
    { number: 2, start: 3.333, end: 6.667 },
    { number: 3, start: 6.667, end: 10 },
  ]);

  // Contiguity check
  assert.equal(slices[0].start, 0);
  assert.equal(slices[0].end, slices[1].start);
  assert.equal(slices[1].end, slices[2].start);
  assert.equal(slices[slices.length - 1].end, duration);
});

test('distributeEvenly single slice', () => {
  const slices = distributeEvenly(1, 4.25);
  assert.deepEqual(slices, [{ number: 1, start: 0, end: 4.25 }]);
});

// --- assignByPhrases: invalid input ---
test('assignByPhrases returns [] for invalid count or duration', () => {
  const phrases = [{ index: 0, start: 0, end: 2 }];
  assert.deepEqual(assignByPhrases(phrases, 0, 10), []);
  assert.deepEqual(assignByPhrases(phrases, -1, 10), []);
  assert.deepEqual(assignByPhrases(phrases, 1.5, 10), []);
  assert.deepEqual(assignByPhrases(phrases, 1, 0), []);
  assert.deepEqual(assignByPhrases(phrases, 1, -10), []);
  assert.deepEqual(assignByPhrases(phrases, 1, NaN), []);
});

// --- assignByPhrases: fallback when too few phrases ---
test('assignByPhrases falls back to distributeEvenly with empty phraseIndexes when too few phrases', () => {
  const phrases = [
    { index: 0, start: 1, end: 2 },
    { index: 1, start: 3, end: 4 },
  ];
  // phrases.length (2) < count (3)
  const result = assignByPhrases(phrases, 3, 10);
  assert.equal(result.length, 3);
  assert.deepEqual(result, [
    { number: 1, start: 0, end: 3.333, phraseIndexes: [] },
    { number: 2, start: 3.333, end: 6.667, phraseIndexes: [] },
    { number: 3, start: 6.667, end: 10, phraseIndexes: [] },
  ]);

  // Empty phrases array
  const emptyResult = assignByPhrases([], 2, 8);
  assert.equal(emptyResult.length, 2);
  assert.deepEqual(emptyResult[0].phraseIndexes, []);
  assert.deepEqual(emptyResult[1].phraseIndexes, []);

  // Non-array phrases
  const nullResult = assignByPhrases(null, 2, 8);
  assert.equal(nullResult.length, 2);
  assert.deepEqual(nullResult[0].phraseIndexes, []);
});

// --- assignByPhrases: contiguity, boundaries on phrase starts, no empty groups ---
test('assignByPhrases splits into contiguous clips on phrase starts without empty groups', () => {
  const phrases = [
    { index: 0, start: 1.0, end: 3.0 },
    { index: 1, start: 4.5, end: 7.0 },
    { index: 2, start: 10.2, end: 14.0 },
    { index: 3, start: 18.8, end: 22.0 },
    { index: 4, start: 24.0, end: 27.5 },
  ];
  // 3 clips for duration = 30
  // Ideal cuts: 10 and 20
  // Boundary 1 candidates: index 1 (start 4.5, diff 5.5), index 2 (start 10.2, diff 0.2), index 3 (start 18.8, diff 8.8)
  //   -> chosen: index 2 (cut at phrases[2].start = 10.2)
  // Boundary 2 candidates: index 3 (start 18.8, diff 1.2), index 4 (start 24.0, diff 4.0)
  //   -> chosen: index 3 (cut at phrases[3].start = 18.8)
  const clips = assignByPhrases(phrases, 3, 30);

  assert.equal(clips.length, 3);
  assert.deepEqual(clips, [
    { number: 1, start: 0, end: 10.2, phraseIndexes: [0, 1] },
    { number: 2, start: 10.2, end: 18.8, phraseIndexes: [2] },
    { number: 3, start: 18.8, end: 30, phraseIndexes: [3, 4] },
  ]);

  // Verify contiguity
  assert.equal(clips[0].start, 0);
  assert.equal(clips[0].end, clips[1].start);
  assert.equal(clips[1].end, clips[2].start);
  assert.equal(clips[2].end, 30);

  // Verify no empty groups
  for (const clip of clips) {
    assert.ok(clip.phraseIndexes.length > 0);
  }
});

test('assignByPhrases prevents empty groups even when phrase starts are skewed', () => {
  // All phrases start very late near the end of the duration
  const phrases = [
    { index: 0, start: 25, end: 26 },
    { index: 1, start: 27, end: 28 },
    { index: 2, start: 29, end: 30 },
  ];
  // count = 3, duration = 30
  // Phrases length = 3, count = 3 -> each clip MUST get exactly one phrase
  const clips = assignByPhrases(phrases, 3, 30);
  assert.equal(clips.length, 3);
  assert.deepEqual(clips[0].phraseIndexes, [0]);
  assert.deepEqual(clips[1].phraseIndexes, [1]);
  assert.deepEqual(clips[2].phraseIndexes, [2]);

  assert.equal(clips[0].start, 0);
  assert.equal(clips[0].end, 27);
  assert.equal(clips[1].start, 27);
  assert.equal(clips[1].end, 29);
  assert.equal(clips[2].start, 29);
  assert.equal(clips[2].end, 30);
});

test('assignByPhrases with count = 1 assigns all phrases to single clip', () => {
  const phrases = [
    { index: 0, start: 1, end: 2 },
    { index: 1, start: 3, end: 5 },
  ];
  const clips = assignByPhrases(phrases, 1, 10);
  assert.equal(clips.length, 1);
  assert.deepEqual(clips[0], {
    number: 1,
    start: 0,
    end: 10,
    phraseIndexes: [0, 1],
  });
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
