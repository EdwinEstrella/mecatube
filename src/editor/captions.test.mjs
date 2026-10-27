// Run with: node src/editor/captions.test.mjs
import assert from 'node:assert/strict';
import {
  buildCaptionPages,
  activePage,
  activeWordIndex,
} from './captions.js';

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

// --- Invalid inputs and word filtering ---------------------------------------------------

test('buildCaptionPages returns empty array for non-array or empty inputs', () => {
  assert.deepEqual(buildCaptionPages(null), []);
  assert.deepEqual(buildCaptionPages(undefined), []);
  assert.deepEqual(buildCaptionPages('words'), []);
  assert.deepEqual(buildCaptionPages(42), []);
  assert.deepEqual(buildCaptionPages({}), []);
  assert.deepEqual(buildCaptionPages([]), []);
});

test('buildCaptionPages skips invalid words and builds from valid words', () => {
  const words = [
    null,
    { w: '', s: 0, e: 0.2 },
    { w: '  ', s: 0.2, e: 0.4 },
    { w: 'valid', s: 'bad', e: 0.5 },
    { w: 'valid', s: 0.5, e: 'bad' },
    { w: 'backwards', s: 0.8, e: 0.6 },
    { w: 'first', s: 1.0, e: 1.3 },
    undefined,
    { w: 'second', s: 1.35, e: 1.6 },
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].words.length, 2);
  assert.equal(pages[0].words[0].text, 'first');
  assert.equal(pages[0].words[1].text, 'second');
});

test('buildCaptionPages returns empty array if all words are invalid', () => {
  assert.deepEqual(buildCaptionPages([null, { w: '', s: 0, e: 1 }]), []);
});

// --- Splitting rules --------------------------------------------------------------------

test('splits when page reaches maxWords (default 4)', () => {
  const words = [
    { w: 'uno', s: 0.0, e: 0.2 },
    { w: 'dos', s: 0.22, e: 0.4 },
    { w: 'tres', s: 0.42, e: 0.6 },
    { w: 'cuatro', s: 0.62, e: 0.8 },
    { w: 'cinco', s: 0.82, e: 1.0 },
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].words.length, 4);
  assert.equal(pages[0].words.map((w) => w.text).join(' '), 'uno dos tres cuatro');
  assert.equal(pages[1].words.length, 1);
  assert.equal(pages[1].words[0].text, 'cinco');
});

test('respects custom maxWords', () => {
  const words = [
    { w: 'a', s: 0.0, e: 0.2 },
    { w: 'b', s: 0.22, e: 0.4 },
    { w: 'c', s: 0.42, e: 0.6 },
  ];

  const pages = buildCaptionPages(words, { maxWords: 2 });
  assert.equal(pages.length, 2);
  assert.equal(pages[0].words.length, 2);
  assert.equal(pages[1].words.length, 1);
});

test('splits when adding a word would exceed maxSeconds (default 1.6s)', () => {
  const words = [
    { w: 'uno', s: 0.0, e: 0.6 },
    { w: 'dos', s: 0.7, e: 1.4 },
    { w: 'tres', s: 1.45, e: 1.8 }, // 1.8 - 0.0 = 1.8 > 1.6s
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].words.length, 2);
  assert.equal(pages[0].words[1].text, 'dos');
  assert.equal(pages[1].words.length, 1);
  assert.equal(pages[1].words[0].text, 'tres');
});

test('splits when silence before the word is > maxGap (default 0.5s)', () => {
  const words = [
    { w: 'antes', s: 0.0, e: 0.4 },
    { w: 'después', s: 1.0, e: 1.4 }, // gap = 1.0 - 0.4 = 0.6 > 0.5s
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].words[0].text, 'antes');
  assert.equal(pages[1].words[0].text, 'después');
});

test('splits after a word ending in sentence punctuation (. ! ? … ; :)', () => {
  const words = [
    { w: 'Hola.', s: 0.0, e: 0.3 },
    { w: 'Mundo!', s: 0.35, e: 0.6 },
    { w: 'Qué?', s: 0.65, e: 0.9 },
    { w: 'Pausa…', s: 0.95, e: 1.2 },
    { w: 'Punto;', s: 1.25, e: 1.5 },
    { w: 'Dos:', s: 1.55, e: 1.8 },
    { w: 'Final', s: 1.85, e: 2.1 },
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 7);
  assert.equal(pages[0].words[0].text, 'Hola.');
  assert.equal(pages[1].words[0].text, 'Mundo!');
  assert.equal(pages[2].words[0].text, 'Qué?');
  assert.equal(pages[3].words[0].text, 'Pausa…');
  assert.equal(pages[4].words[0].text, 'Punto;');
  assert.equal(pages[5].words[0].text, 'Dos:');
  assert.equal(pages[6].words[0].text, 'Final');
});

test('splits on sentence punctuation followed by closing quotes or brackets', () => {
  const words = [
    { w: 'dijo."', s: 0.0, e: 0.3 },
    { w: 'siguiente', s: 0.35, e: 0.6 },
    { w: 'listo!)', s: 0.65, e: 0.9 },
    { w: 'fin', s: 0.95, e: 1.2 },
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 3);
  assert.equal(pages[0].words[0].text, 'dijo."');
  assert.equal(pages[1].words[0].text, 'siguiente');
  assert.equal(pages[1].words[1].text, 'listo!)');
  assert.equal(pages[2].words[0].text, 'fin');
});

test('does not split on non-sentence punctuation like commas', () => {
  const words = [
    { w: 'hola,', s: 0.0, e: 0.3 },
    { w: 'amigo', s: 0.32, e: 0.6 },
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].words.length, 2);
});

// --- Page start and end rules -----------------------------------------------------------

test('page start = first word start', () => {
  const words = [
    { w: 'inicio', s: 1.234, e: 1.5 },
    { w: 'siguiente', s: 1.55, e: 1.8 },
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages[0].start, 1.234);
});

test('page end = next page start when gap is < 0.3 s', () => {
  const words = [
    { w: 'page1.', s: 0.0, e: 0.5 },
    { w: 'page2', s: 0.7, e: 1.1 }, // gap = 0.7 - 0.5 = 0.2 < 0.3
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].end, 0.7); // extended to next page start
  assert.equal(pages[1].start, 0.7);
});

test('page end = last word end + 0.15 s when gap is >= 0.3 s', () => {
  const words = [
    { w: 'page1.', s: 0.0, e: 0.5 },
    { w: 'page2', s: 1.0, e: 1.4 }, // gap = 1.0 - 0.5 = 0.5 >= 0.3
  ];

  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].end, 0.65); // 0.5 + 0.15
  assert.equal(pages[1].start, 1.0);
});

test('last page end = last word end + 0.15 s', () => {
  const words = [{ w: 'solo', s: 0.5, e: 1.0 }];
  const pages = buildCaptionPages(words);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].start, 0.5);
  assert.equal(pages[0].end, 1.15); // 1.0 + 0.15
});

// --- activePage lookup ------------------------------------------------------------------

test('activePage returns null for empty or invalid arguments', () => {
  assert.equal(activePage(null, 1.0), null);
  assert.equal(activePage([], 1.0), null);
  assert.equal(activePage([{ start: 0, end: 1, words: [] }], 'not-a-number'), null);
  assert.equal(activePage([{ start: 0, end: 1, words: [] }], NaN), null);
});

test('activePage returns the matching page during active time and null in gaps or bounds', () => {
  const pages = [
    { start: 1.0, end: 2.0, words: [{ text: 'uno', start: 1.0, end: 1.8 }] },
    { start: 2.5, end: 3.5, words: [{ text: 'dos', start: 2.5, end: 3.3 }] },
  ];

  assert.equal(activePage(pages, 0.99), null);
  assert.equal(activePage(pages, 1.0), pages[0]);
  assert.equal(activePage(pages, 1.5), pages[0]);
  assert.equal(activePage(pages, 1.999), pages[0]);
  assert.equal(activePage(pages, 2.0), null); // gap starts at 2.0
  assert.equal(activePage(pages, 2.2), null); // inside gap
  assert.equal(activePage(pages, 2.5), pages[1]);
  assert.equal(activePage(pages, 3.5), null); // after end
});

test('activePage hands over cleanly when page ends at next page start', () => {
  const pages = [
    { start: 0.0, end: 1.0, words: [{ text: 'a', start: 0, end: 0.9 }] },
    { start: 1.0, end: 2.0, words: [{ text: 'b', start: 1.0, end: 1.9 }] },
  ];

  assert.equal(activePage(pages, 0.999), pages[0]);
  assert.equal(activePage(pages, 1.0), pages[1]);
});

// --- activeWordIndex lookup -------------------------------------------------------------

test('activeWordIndex returns -1 for empty or invalid page', () => {
  assert.equal(activeWordIndex(null, 1.0), -1);
  assert.equal(activeWordIndex({}, 1.0), -1);
  assert.equal(activeWordIndex({ words: [] }, 1.0), -1);
  assert.equal(activeWordIndex({ words: [{ start: 1, end: 2 }] }, NaN), -1);
});

test('activeWordIndex returns -1 before the first word starts', () => {
  const page = {
    words: [
      { text: 'uno', start: 1.0, end: 1.4 },
      { text: 'dos', start: 1.6, end: 2.0 },
    ],
  };

  assert.equal(activeWordIndex(page, 0.5), -1);
  assert.equal(activeWordIndex(page, 0.99), -1);
});

test('activeWordIndex tracks active word and preserves previous index during silence gaps', () => {
  const page = {
    words: [
      { text: 'uno', start: 1.0, end: 1.4 },
      { text: 'dos', start: 1.7, end: 2.1 },
      { text: 'tres', start: 2.3, end: 2.7 },
    ],
  };

  // During word 0
  assert.equal(activeWordIndex(page, 1.0), 0);
  assert.equal(activeWordIndex(page, 1.2), 0);
  assert.equal(activeWordIndex(page, 1.4), 0);

  // In gap between word 0 and word 1: keeps previous index (0)
  assert.equal(activeWordIndex(page, 1.55), 0);
  assert.equal(activeWordIndex(page, 1.69), 0);

  // During word 1
  assert.equal(activeWordIndex(page, 1.7), 1);
  assert.equal(activeWordIndex(page, 2.0), 1);

  // In gap between word 1 and word 2: keeps previous index (1)
  assert.equal(activeWordIndex(page, 2.2), 1);

  // During word 2
  assert.equal(activeWordIndex(page, 2.3), 2);
  assert.equal(activeWordIndex(page, 2.7), 2);

  // After word 2 ended: stays at last word index
  assert.equal(activeWordIndex(page, 2.85), 2);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
