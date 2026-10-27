// Run with: node src/editor/placement.test.mjs
import assert from 'node:assert/strict';
import {
  applyStyling,
  defaultStyling,
  phrasesToWordIndex,
  placeVideos,
} from './placement.js';

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

const words = [
  { w: 'En', s: 0.0, e: 0.3 },
  { w: 'un', s: 0.3, e: 0.6 },
  { w: 'bosque', s: 0.6, e: 1.2 },
  { w: 'oscuro', s: 1.2, e: 1.8 },
  { w: 'caminaba', s: 2.0, e: 2.6 },
  { w: 'un', s: 2.6, e: 2.9 },
  { w: 'lobo', s: 2.9, e: 3.5 },
  { w: 'solitario.', s: 3.5, e: 4.2 },
  { w: 'Buscaba', s: 4.5, e: 5.0 },
  { w: 'comida', s: 5.0, e: 5.5 },
  { w: 'sin', s: 5.5, e: 5.8 },
  { w: 'descanso.', s: 5.8, e: 6.5 },
  { w: 'Al', s: 7.0, e: 7.3 },
  { w: 'amanecer', s: 7.3, e: 8.0 },
  { w: 'encontró', s: 8.0, e: 8.6 },
  { w: 'el', s: 8.6, e: 8.9 },
  { w: 'río.', s: 8.9, e: 9.5 },
];

test('phrasesToWordIndex maps phrase start time to first word index', () => {
  const phrases = [
    { start: 0.0, end: 1.8, text: 'En un bosque oscuro' },
    { start: 2.0, end: 4.2, text: 'caminaba un lobo solitario.' },
    { start: 4.5, end: 6.5, text: 'Buscaba comida sin descanso.' },
    { start: 7.0, end: 9.5, text: 'Al amanecer encontró el río.' },
  ];

  const map = phrasesToWordIndex(phrases, words);
  assert.equal(map[0], 0); // 'En'
  assert.equal(map[1], 4); // 'caminaba'
  assert.equal(map[2], 8); // 'Buscaba'
  assert.equal(map[3], 12);
  assert.equal(map[99], undefined);
});

test('placeVideos with anchors only aligns all clips accurately', () => {
  const anchors = [
    { number: 1, text: 'En un bosque' },
    { number: 2, text: 'caminaba un lobo' },
    { number: 3, text: 'Al amanecer encontró' },
  ];

  const { clips, stats, warnings } = placeVideos({
    words,
    duration: 10.0,
    available: [1, 2, 3],
    anchors,
  });

  assert.equal(warnings.length, 0);
  assert.equal(clips.length, 3);
  assert.deepEqual(stats, { anchor: 3, ai: 0, estimated: 0, total: 3 });

  assert.equal(clips[0].number, 1);
  assert.equal(clips[0].start, 0);
  assert.equal(clips[0].end, 2.0);
  assert.equal(clips[0].source, 'anchor');

  assert.equal(clips[1].number, 2);
  assert.equal(clips[1].start, 2.0);
  assert.equal(clips[1].end, 7.0);
  assert.equal(clips[1].source, 'anchor');

  assert.equal(clips[2].number, 3);
  assert.equal(clips[2].start, 7.0);
  assert.equal(clips[2].end, 10.0);
  assert.equal(clips[2].source, 'anchor');
});

test('placeVideos with AI filling a gap between anchors', () => {
  // Only video 1 and video 3 have anchors; video 2 has no anchor
  const anchors = [
    { number: 1, text: 'En un bosque' }, // word index 0 (start 0.0)
    { number: 3, text: 'Al amanecer encontró' }, // word index 12 (start 7.0)
  ];

  const aiAssignments = [
    { number: 2, wordIndex: 8 }, // 'Buscaba' at start 4.5
  ];

  const { clips, stats } = placeVideos({
    words,
    duration: 10.0,
    available: [1, 2, 3],
    anchors,
    aiAssignments,
  });

  assert.equal(clips.length, 3);
  assert.deepEqual(stats, { anchor: 2, ai: 1, estimated: 0, total: 3 });

  assert.equal(clips[1].number, 2);
  assert.equal(clips[1].start, 4.5);
  assert.equal(clips[1].source, 'ai');
});

test('placeVideos ignores invalid AI assignments', () => {
  const anchors = [
    { number: 1, text: 'En un bosque' }, // word index 0
    { number: 3, text: 'Al amanecer encontró' }, // word index 12
  ];

  // Invalid: wordIndex 15 is after anchor 3 (wordIndex 12)
  const outOfOrderAi = [{ number: 2, wordIndex: 15 }];
  const res1 = placeVideos({
    words,
    duration: 10.0,
    available: [1, 2, 3],
    anchors,
    aiAssignments: outOfOrderAi,
  });

  assert.equal(res1.stats.ai, 0);
  assert.equal(res1.stats.estimated, 1);
  assert.equal(res1.clips[1].source, 'estimated');

  // Invalid: wordIndex out of bounds or negative
  const negativeAi = [{ number: 2, wordIndex: -1 }];
  const res2 = placeVideos({
    words,
    duration: 10.0,
    available: [1, 2, 3],
    anchors,
    aiAssignments: negativeAi,
  });
  assert.equal(res2.stats.ai, 0);
  assert.equal(res2.stats.estimated, 1);
});

test('placeVideos with estimated rest when no anchors and no AI exist', () => {
  const { clips, stats } = placeVideos({
    words,
    duration: 10.0,
    available: [1, 2],
    anchors: [],
  });

  assert.equal(clips.length, 2);
  assert.deepEqual(stats, { anchor: 0, ai: 0, estimated: 2, total: 2 });
  assert.equal(clips[0].source, 'estimated');
  assert.equal(clips[1].source, 'estimated');
  assert.equal(clips[0].start, 0);
  assert.equal(clips[1].end, 10.0);
});

test('applyStyling ignores AI timings and keeps fixed clips', () => {
  const fixedClips = [
    { number: 1, start: 0.0, end: 3.5 },
    { number: 2, start: 3.5, end: 10.0 },
  ];

  const aiRaw = JSON.stringify({
    clips: [
      { number: 1, start: 50.0, end: 80.0, transition: 'zoom', motion: 'pan-left' },
      { number: 2, start: 80.0, end: 100.0, transition: 'slide', motion: 'pan-right' },
    ],
  });

  const { edl, warnings } = applyStyling(fixedClips, aiRaw, { duration: 10.0 });
  assert.ok(edl);
  assert.equal(warnings.length, 0);

  // Timings are strictly preserved from fixedClips
  assert.equal(edl.clips[0].number, 1);
  assert.equal(edl.clips[0].start, 0.0);
  assert.equal(edl.clips[0].end, 3.5);
  assert.equal(edl.clips[0].transition, 'zoom');
  assert.equal(edl.clips[0].motion, 'pan-left');

  assert.equal(edl.clips[1].number, 2);
  assert.equal(edl.clips[1].start, 3.5);
  assert.equal(edl.clips[1].end, 10.0);
  assert.equal(edl.clips[1].transition, 'slide');
  assert.equal(edl.clips[1].motion, 'pan-right');

  assert.deepEqual(edl.subtitles, []);
});

test('applyStyling defaults gracefully on garbage AI input', () => {
  const fixedClips = [
    { number: 1, start: 0.0, end: 4.0 },
    { number: 2, start: 4.0, end: 8.0 },
    { number: 3, start: 8.0, end: 12.0 },
  ];

  const garbageRaw = 'This is complete garbage and not JSON at all!';
  const { edl } = applyStyling(fixedClips, garbageRaw, { duration: 12.0 });

  assert.ok(edl);
  assert.equal(edl.clips.length, 3);

  // Defaults: first clip 'fade', others 'cut'; motions alternate 'zoom-in' / 'zoom-out'
  assert.equal(edl.clips[0].transition, 'fade');
  assert.equal(edl.clips[0].motion, 'zoom-in');

  assert.equal(edl.clips[1].transition, 'cut');
  assert.equal(edl.clips[1].motion, 'zoom-out');

  assert.equal(edl.clips[2].transition, 'cut');
  assert.equal(edl.clips[2].motion, 'zoom-in');
});

test('defaultStyling produces valid EDL v1', () => {
  const fixedClips = [
    { number: 1, start: 0.0, end: 5.0 },
    { number: 2, start: 5.0, end: 10.0 },
  ];

  const edl = defaultStyling(fixedClips, { duration: 10.0 });
  assert.equal(edl.version, 1);
  assert.equal(edl.duration, 10.0);
  assert.equal(edl.clips[0].transition, 'fade');
  assert.equal(edl.clips[0].motion, 'zoom-in');
  assert.equal(edl.clips[1].transition, 'cut');
  assert.equal(edl.clips[1].motion, 'zoom-out');
  assert.deepEqual(edl.subtitles, []);
});

test('applyStyling never drops clips regardless of keep:false or duration', () => {
  const fixedClips = [
    { number: 1, start: 0.0, end: 1.5 },
    { number: 2, start: 1.5, end: 5.0 },
    { number: 3, start: 5.0, end: 6.2 },
    { number: 4, start: 6.2, end: 9.0 },
    { number: 5, start: 9.0, end: 12.0 },
  ];

  const aiRaw = JSON.stringify({
    clips: [
      { number: 1, keep: false, reason: 'Demasiado corto al inicio' },
      { number: 2, keep: true, transition: 'fade', motion: 'zoom-in', reason: 'Inicio absorbido' },
      { number: 3, keep: false, reason: 'Transición innecesaria de 1.2s' },
      { number: 4, keep: false, transition: 'zoom', motion: 'pan-left', reason: 'Intento de descarte pero dura 2.8s' },
      { number: 5, keep: true, transition: 'cut', motion: 'none', reason: 'Final estable' },
    ],
  });

  const { edl, warnings } = applyStyling(fixedClips, aiRaw, { duration: 12.0 });
  assert.ok(edl);
  assert.equal(warnings.length, 0);

  // Dropped list is empty
  assert.deepEqual(edl.dropped, []);

  // All 5 clips are kept with fixed timings
  assert.equal(edl.clips.length, 5);

  assert.equal(edl.clips[0].number, 1);
  assert.equal(edl.clips[0].start, 0.0);
  assert.equal(edl.clips[0].end, 1.5);
  assert.equal(edl.clips[0].reason, 'Demasiado corto al inicio');

  assert.equal(edl.clips[1].number, 2);
  assert.equal(edl.clips[1].start, 1.5);
  assert.equal(edl.clips[1].end, 5.0);
  assert.equal(edl.clips[1].transition, 'fade');
  assert.equal(edl.clips[1].motion, 'zoom-in');
  assert.equal(edl.clips[1].reason, 'Inicio absorbido');

  assert.equal(edl.clips[2].number, 3);
  assert.equal(edl.clips[2].start, 5.0);
  assert.equal(edl.clips[2].end, 6.2);
  assert.equal(edl.clips[2].reason, 'Transición innecesaria de 1.2s');

  assert.equal(edl.clips[3].number, 4);
  assert.equal(edl.clips[3].start, 6.2);
  assert.equal(edl.clips[3].end, 9.0);
  assert.equal(edl.clips[3].transition, 'zoom');
  assert.equal(edl.clips[3].motion, 'pan-left');
  assert.equal(edl.clips[3].reason, 'Intento de descarte pero dura 2.8s');

  assert.equal(edl.clips[4].number, 5);
  assert.equal(edl.clips[4].start, 9.0);
  assert.equal(edl.clips[4].end, 12.0);
  assert.equal(edl.clips[4].transition, 'cut');
  assert.equal(edl.clips[4].motion, 'none');
  assert.equal(edl.clips[4].reason, 'Final estable');
});

test('applyStyling keeps clip and leaves dropped empty when AI returns keep:false for 0.7s clip', () => {
  const fixedClips = [
    { number: 1, start: 0.0, end: 5.0 },
    { number: 2, start: 5.0, end: 5.7 },
    { number: 3, start: 5.7, end: 10.0 },
  ];

  const aiRaw = JSON.stringify({
    clips: [
      { number: 1, keep: true, transition: 'fade', motion: 'zoom-in' },
      { number: 2, keep: false, transition: 'cut', motion: 'none', reason: 'Muy corto' },
      { number: 3, keep: true, transition: 'cut', motion: 'zoom-out' },
    ],
  });

  const { edl, warnings } = applyStyling(fixedClips, aiRaw, { duration: 10.0 });
  assert.ok(edl);
  assert.equal(warnings.length, 0);
  assert.equal(edl.clips.length, 3);
  assert.equal(edl.clips[1].number, 2);
  assert.equal(edl.clips[1].start, 5.0);
  assert.equal(edl.clips[1].end, 5.7);
  assert.equal(edl.clips[1].transition, 'cut');
  assert.equal(edl.clips[1].motion, 'none');
  assert.equal(edl.clips[1].reason, 'Muy corto');
  assert.deepEqual(edl.dropped, []);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
