// Run with: node src/editor/align.test.mjs
import assert from 'node:assert/strict';
import {
  normalizeToken,
  tokenize,
  levenshtein,
  tokensMatch,
  alignAnchors,
  fillMissing,
  buildAlignedClips,
} from './align.js';

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

function makeWords(str, startSec = 0, wordDuration = 0.5, gap = 0.1) {
  const tokens = str.trim().split(/\s+/);
  let cur = startSec;
  return tokens.map((w) => {
    const s = Math.round(cur * 1000) / 1000;
    const e = Math.round((cur + wordDuration) * 1000) / 1000;
    cur = e + gap;
    return { w, s, e };
  });
}

// 1. normalizeToken and tokenize
test('normalizeToken lowercases, strips accents, and removes non-alphanumeric chars', () => {
  assert.equal(normalizeToken('SABÍA'), 'sabia');
  assert.equal(normalizeToken('rápido!'), 'rapido');
  assert.equal(normalizeToken('¿Quién?'), 'quien');
  assert.equal(normalizeToken('...'), '');
  assert.equal(normalizeToken(null), '');
  assert.equal(normalizeToken(123), '');
});

test('tokenize splits into non-empty normalized tokens', () => {
  assert.deepEqual(tokenize('Nadie sabía qué había debajo... ¡del hielo!'), [
    'nadie',
    'sabia',
    'que',
    'habia',
    'debajo',
    'del',
    'hielo',
  ]);
  assert.deepEqual(tokenize('   ...   ---   '), []);
  assert.deepEqual(tokenize(null), []);
});

// 2. Levenshtein and token matching
test('levenshtein computes edit distance correctly', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('preparado', 'preparada'), 1);
  assert.equal(levenshtein('hielo', 'hielo'), 0);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('tokensMatch applies equal, prefix >=4, and Levenshtein <=1 for >=5', () => {
  assert.ok(tokensMatch('motor', 'motor'));
  // Prefix >= 4
  assert.ok(tokensMatch('motores', 'motor'));
  assert.ok(tokensMatch('motor', 'motores'));
  assert.ok(!tokensMatch('sol', 'solo')); // length < 4
  // Levenshtein <= 1 for >= 5
  assert.ok(tokensMatch('preparado', 'preparada'));
  assert.ok(!tokensMatch('gato', 'pato')); // length < 5 even though dist is 1
  assert.ok(!tokensMatch('arranque', 'arrancar')); // dist 2
});

// 3. Exact anchors
test('exact anchors align with score 1.0 and correct wordIndex/start', () => {
  const sentence1 = 'Nadie sabía qué había debajo del hielo';
  const sentence2 = 'Hasta que alguien miró y descubrió la verdad';
  const words = makeWords(`${sentence1} ${sentence2}`);

  const anchors = [
    { number: 1, text: sentence1 },
    { number: 2, text: sentence2 },
  ];

  const aligned = alignAnchors(anchors, words);
  assert.equal(aligned.length, 2);

  assert.equal(aligned[0].number, 1);
  assert.equal(aligned[0].wordIndex, 0);
  assert.equal(aligned[0].start, words[0].s);
  assert.equal(aligned[0].score, 1);
  assert.equal(aligned[0].source, 'anchor');

  assert.equal(aligned[1].number, 2);
  assert.equal(aligned[1].wordIndex, 7);
  assert.equal(aligned[1].start, words[7].s);
  assert.equal(aligned[1].score, 1);
  assert.equal(aligned[1].source, 'anchor');
});

// 4. Anchors with accent/punctuation/case differences
test('anchors with accent, punctuation, and case differences match perfectly', () => {
  const words = makeWords('Nadie sabía qué había debajo del hielo.');
  const anchors = [{ number: 1, text: 'NADIE SABIA QUE HABIA DEBAJO DEL HIELO!' }];

  const aligned = alignAnchors(anchors, words);
  assert.equal(aligned[0].wordIndex, 0);
  assert.equal(aligned[0].score, 1);
  assert.equal(aligned[0].source, 'anchor');
});

// 5. One changed word
test('anchor with one changed word matches when score >= minScore (0.6)', () => {
  const words = makeWords('Nadie sabía qué había debajo del hielo y del agua.');
  // "estaba" instead of "había" -> 8 out of 9 match
  const anchors = [{ number: 1, text: 'Nadie sabía qué estaba debajo del hielo y del agua' }];

  const aligned = alignAnchors(anchors, words);
  assert.equal(aligned[0].wordIndex, 0);
  assert.ok(aligned[0].score >= 0.6);
  assert.equal(aligned[0].source, 'anchor');
});

// 6. One missing word
test('anchor with one missing word in anchor matches', () => {
  // Narration has "realmente", anchor does not
  const words = makeWords('Nadie sabía realmente qué había debajo del hielo.');
  const anchors = [{ number: 1, text: 'Nadie sabía qué había debajo del hielo' }];

  const aligned = alignAnchors(anchors, words);
  assert.equal(aligned[0].wordIndex, 0);
  assert.equal(aligned[0].score, 1);
  assert.equal(aligned[0].source, 'anchor');
});

test('anchor with one missing word in narration matches', () => {
  // Anchor has "realmente", narration does not
  const words = makeWords('Nadie sabía qué había debajo del hielo.');
  const anchors = [{ number: 1, text: 'Nadie sabía realmente qué había debajo del hielo' }];

  const aligned = alignAnchors(anchors, words);
  assert.equal(aligned[0].wordIndex, 0);
  assert.ok(aligned[0].score >= 0.6);
  assert.equal(aligned[0].source, 'anchor');
});

// 7. Repeated phrases in narration (in order)
test('anchors with repeated phrases pick the occurrence after previous anchor', () => {
  const phrase = 'este es el motor de arranque';
  const words = makeWords(`inicio ${phrase} intermedio ${phrase} final`);
  // Occurrence 1 starts at word 1.
  // Occurrence 2 starts at word 8.

  const anchors = [
    { number: 1, text: phrase },
    { number: 2, text: phrase },
  ];

  const aligned = alignAnchors(anchors, words);
  assert.equal(aligned[0].number, 1);
  assert.equal(aligned[0].wordIndex, 1);
  assert.equal(aligned[0].source, 'anchor');

  assert.equal(aligned[1].number, 2);
  assert.equal(aligned[1].wordIndex, 8);
  assert.equal(aligned[1].source, 'anchor');
});

// 8. Mid-sentence false-start protection
test('mid-sentence false-start protection prevents match if first word does not match token 0 or 1', () => {
  const words = makeWords('pero lo que nadie sabía qué había debajo del hielo era un misterio');
  const anchors = [{ number: 1, text: 'nadie sabía qué había debajo del hielo' }];

  const aligned = alignAnchors(anchors, words);
  // Match must start at "nadie" (index 3), not at "pero", "lo", or "que"
  assert.equal(aligned[0].wordIndex, 3);
  assert.equal(aligned[0].score, 1);
  assert.equal(aligned[0].source, 'anchor');
});

// 9. Unmatched anchor -> estimated between neighbours
test('unmatched anchor is marked missing and filled between neighbours', () => {
  const sentence1 = 'uno dos tres cuatro cinco seis';
  const sentence3 = 'siete ocho nueve diez once doce';
  const words = makeWords(`${sentence1} medio ${sentence3}`);

  const anchors = [
    { number: 1, text: sentence1 },
    { number: 2, text: 'totalmente desconocido sin coincidencia alguna' },
    { number: 3, text: sentence3 },
  ];

  const aligned = alignAnchors(anchors, words);
  assert.equal(aligned[0].source, 'anchor');
  assert.equal(aligned[1].source, 'missing');
  assert.equal(aligned[2].source, 'anchor');

  const filled = fillMissing(aligned, words, 20);
  assert.equal(filled[1].source, 'estimated');
  assert.ok(filled[1].wordIndex > filled[0].wordIndex);
  assert.ok(filled[1].wordIndex < filled[2].wordIndex);
  assert.equal(filled[1].start, words[filled[1].wordIndex].s);
});

// 10. All missing -> evenly spread
test('all missing anchors are spread evenly across words', () => {
  const words = makeWords('uno dos tres cuatro cinco seis siete ocho nueve diez');
  const aligned = [
    { number: 1, wordIndex: null, start: null, score: 0, source: 'missing' },
    { number: 2, wordIndex: null, start: null, score: 0, source: 'missing' },
    { number: 3, wordIndex: null, start: null, score: 0, source: 'missing' },
  ];

  const filled = fillMissing(aligned, words, 10);
  assert.equal(filled[0].wordIndex, 0);
  assert.equal(filled[0].source, 'estimated');
  assert.ok(filled[1].wordIndex > filled[0].wordIndex);
  assert.ok(filled[2].wordIndex > filled[1].wordIndex);
  assert.equal(filled[0].start, words[filled[0].wordIndex].s);
  assert.equal(filled[1].start, words[filled[1].wordIndex].s);
  assert.equal(filled[2].start, words[filled[2].wordIndex].s);
});

// 11. Leading and trailing missing
test('leading and trailing missing items are spread proportionally', () => {
  const words = makeWords('cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce');
  const aligned = [
    { number: 1, wordIndex: null, start: null, score: 0, source: 'missing' },
    { number: 2, wordIndex: 6, start: words[6].s, score: 1, source: 'anchor' },
    { number: 3, wordIndex: null, start: null, score: 0, source: 'missing' },
  ];

  const filled = fillMissing(aligned, words, 15);
  // Leading missing spreads from word 0 to word 6
  assert.equal(filled[0].wordIndex, 0);
  assert.equal(filled[0].source, 'estimated');

  // Middle anchor remains untouched
  assert.equal(filled[1].wordIndex, 6);
  assert.equal(filled[1].source, 'anchor');

  // Trailing missing spreads between word 6 and last word (12)
  assert.ok(filled[2].wordIndex > 6);
  assert.ok(filled[2].wordIndex <= 12);
  assert.equal(filled[2].source, 'estimated');
});

// 12. 'ai' items untouched by fillMissing
test('items with source "ai" are not moved by fillMissing', () => {
  const words = makeWords('uno dos tres cuatro cinco seis siete ocho nueve diez');
  const aligned = [
    { number: 1, wordIndex: 2, start: words[2].s, source: 'ai' },
    { number: 2, wordIndex: null, start: null, score: 0, source: 'missing' },
    { number: 3, wordIndex: 8, start: words[8].s, source: 'ai' },
  ];

  const filled = fillMissing(aligned, words, 10);
  assert.equal(filled[0].wordIndex, 2);
  assert.equal(filled[0].source, 'ai');
  assert.equal(filled[0].start, words[2].s);

  assert.equal(filled[1].source, 'estimated');
  assert.ok(filled[1].wordIndex > 2 && filled[1].wordIndex < 8);

  assert.equal(filled[2].wordIndex, 8);
  assert.equal(filled[2].source, 'ai');
  assert.equal(filled[2].start, words[8].s);
});

// 13. buildAlignedClips contiguity, first start 0, last end = duration, short clip dropped
test('buildAlignedClips enforces contiguity, first start 0, last end duration, and drops short clips with warning', () => {
  const alignment = [
    { number: 1, start: 0.8, source: 'anchor' },
    { number: 2, start: 3.0, source: 'anchor' },
    { number: 3, start: 3.2, source: 'anchor' }, // duration 0.2 < minClip 0.5 -> dropped!
    { number: 4, start: 6.0, source: 'anchor' },
  ];

  const { clips, warnings } = buildAlignedClips(alignment, 10.0, { minClip: 0.5 });

  // Clip 3 should be dropped because span 3.2 - 3.0 = 0.2s < 0.5s
  assert.equal(clips.length, 3);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('Dropped clip 2') || warnings[0].includes('Dropped clip 3'));

  // First start forced to 0
  assert.equal(clips[0].start, 0);

  // Contiguity: each clip ends at next start, last ends at duration
  assert.equal(clips[0].end, clips[1].start);
  assert.equal(clips[1].end, clips[2].start);
  assert.equal(clips[2].end, 10.0);

  // All clips satisfy minClip
  for (const c of clips) {
    assert.ok(c.end - c.start >= 0.5);
  }
});

// 14. Edge cases
test('alignAnchors ignores anchors with no tokens and marks them missing', () => {
  const words = makeWords('Nadie sabía qué había debajo del hielo.');
  const anchors = [
    { number: 1, text: '' },
    { number: 2, text: '   ...   ' },
    { number: 3, text: 'Nadie sabía qué había debajo del hielo' },
  ];

  const aligned = alignAnchors(anchors, words);
  assert.equal(aligned[0].source, 'missing');
  assert.equal(aligned[1].source, 'missing');
  assert.equal(aligned[2].source, 'anchor');
  assert.equal(aligned[2].wordIndex, 0);
});

test('alignAnchors prefers the earliest good match over a perfect repeated phrase far ahead', () => {
  const words = makeWords(
    'el oro brillaba bajo la arena del desierto entonces llegaron los soldados al templo y el oro brillaba bajo la luna'
  );
  const result = alignAnchors(
    [
      { number: 1, text: 'el oro brillaba bajo la luna' },
      { number: 2, text: 'entonces llegaron los soldados' },
    ],
    words
  );
  assert.equal(result[0].wordIndex, 0);
  assert.equal(result[1].source, 'anchor');
  assert.equal(result[1].wordIndex, 7);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
