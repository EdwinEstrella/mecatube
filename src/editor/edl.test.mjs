// Run with: node src/editor/edl.test.mjs
import assert from 'node:assert/strict';
import { TRANSITIONS, MOTIONS, normalizeEdl, fallbackEdl } from './edl.js';

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

test('TRANSITIONS and MOTIONS exports match allowed enums', () => {
  assert.deepEqual(TRANSITIONS, ['cut', 'fade', 'slide', 'zoom']);
  assert.deepEqual(MOTIONS, ['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right']);
});

test('fenced/prose JSON string parsing extracts top-level EDL', () => {
  const payload = `
    Here is the suggested EDL:
    \`\`\`json
    {
      "version": 1,
      "duration": 6,
      "clips": [
        { "number": 1, "start": 0, "end": 6, "transition": "cut", "motion": "none" }
      ],
      "subtitles": [
        { "start": 0, "end": 2.5, "text": "Hello world" }
      ]
    }
    \`\`\`
    Hope this helps! { extra braces in prose }
  `;
  const { edl, warnings } = normalizeEdl(payload, { duration: 6, available: [1] });
  assert.ok(edl);
  assert.equal(edl.version, 1);
  assert.equal(edl.duration, 6);
  assert.equal(edl.clips.length, 1);
  assert.equal(edl.clips[0].number, 1);
  assert.equal(edl.subtitles.length, 1);
  assert.equal(edl.subtitles[0].text, 'Hello world');
  assert.equal(warnings.length, 0);
});

test('invalid JSON string or non-object yields null edl with warning', () => {
  const badInputs = [
    '{ invalid json',
    'just prose without json',
    null,
    undefined,
    123,
    [],
    '```json\n{ not: valid }\n```',
  ];
  for (const input of badInputs) {
    const { edl, warnings } = normalizeEdl(input, { duration: 5, available: [1] });
    assert.equal(edl, null);
    assert.ok(warnings.length > 0);
  }
});

test('unknown animation numbers are dropped with warning', () => {
  const raw = {
    version: 1,
    clips: [
      { number: 99, start: 0, end: 2 },
      { number: '2', start: 2, end: 4 },
      { number: 2, start: 0, end: 5 },
    ],
  };
  const { edl, warnings } = normalizeEdl(raw, { duration: 5, available: [2] });
  assert.ok(edl);
  assert.equal(edl.clips.length, 1);
  assert.equal(edl.clips[0].number, 2);
  assert.ok(warnings.some((w) => w.includes('Dropped clip with invalid or unavailable number')));
});

test('unknown transition and motion default to cut and none with warnings', () => {
  const raw = {
    version: 1,
    clips: [
      { number: 1, start: 0, end: 5, transition: 'spin', motion: 'wobble' },
    ],
  };
  const { edl, warnings } = normalizeEdl(raw, { duration: 5, available: [1] });
  assert.ok(edl);
  assert.equal(edl.clips[0].transition, 'cut');
  assert.equal(edl.clips[0].motion, 'none');
  assert.ok(warnings.some((w) => w.includes('Defaulted unknown transition')));
  assert.ok(warnings.some((w) => w.includes('Defaulted unknown motion')));
});

test('clamping to [0, duration] pushes warnings', () => {
  const raw = {
    version: 1,
    clips: [
      { number: 1, start: -2, end: 12 },
    ],
  };
  const { edl, warnings } = normalizeEdl(raw, { duration: 8, available: [1] });
  assert.ok(edl);
  assert.equal(edl.clips[0].start, 0);
  assert.equal(edl.clips[0].end, 8);
  assert.ok(warnings.some((w) => w.includes('Clamped clip timing')));
});

test('overlap fix adjusts start and drops clips becoming shorter than minClip', () => {
  const raw = {
    version: 1,
    clips: [
      { number: 1, start: 0, end: 4 },
      { number: 2, start: 3, end: 7 }, // overlap: start 3 -> 4, length 3 >= 0.5
      { number: 3, start: 6.8, end: 7.4 }, // length 0.6 >= 0.5; overlap: start -> 7, new length 0.4 < 0.5 -> dropped
      { number: 4, start: 7, end: 10 },
    ],
  };
  const { edl, warnings } = normalizeEdl(raw, { duration: 10, available: [1, 2, 3, 4] });
  assert.ok(edl);
  assert.equal(edl.clips.length, 3);
  assert.deepEqual(
    edl.clips.map((c) => ({ number: c.number, start: c.start, end: c.end })),
    [
      { number: 1, start: 0, end: 4 },
      { number: 2, start: 4, end: 7 },
      { number: 4, start: 7, end: 10 },
    ]
  );
  assert.ok(warnings.some((w) => w.includes('Adjusted overlapping clip start')));
  assert.ok(warnings.some((w) => w.includes('after overlap adjustment')));
});

test('gap closing extends previous clip end to next start', () => {
  const raw = {
    version: 1,
    clips: [
      { number: 1, start: 0, end: 2.5 },
      { number: 2, start: 4, end: 6 },
    ],
  };
  const { edl, warnings } = normalizeEdl(raw, { duration: 6, available: [1, 2] });
  assert.ok(edl);
  assert.equal(edl.clips[0].end, 4);
  assert.equal(edl.clips[1].start, 4);
  assert.ok(warnings.some((w) => w.includes('Extended clip end from 2.5 to 4 to close gap.')));
});

test('first clip start bounded to 0 and last clip end bounded to duration', () => {
  const raw = {
    version: 1,
    clips: [
      { number: 1, start: 1.2, end: 3 },
      { number: 2, start: 3, end: 7.5 },
    ],
  };
  const { edl, warnings } = normalizeEdl(raw, { duration: 9, available: [1, 2] });
  assert.ok(edl);
  assert.equal(edl.clips[0].start, 0);
  assert.equal(edl.clips[1].end, 9);
  assert.ok(warnings.some((w) => w.includes('Adjusted first clip start from 1.2 to 0.')));
  assert.ok(warnings.some((w) => w.includes('Adjusted last clip end from 7.5 to 9.')));
});

test('short clip drop removes clips shorter than minClip after clamping', () => {
  const raw = {
    version: 1,
    clips: [
      { number: 1, start: 0, end: 3 },
      { number: 2, start: 3, end: 3.2 }, // 0.2s < minClip 0.5
      { number: 3, start: 3.5, end: 6 },
    ],
  };
  const { edl, warnings } = normalizeEdl(raw, { duration: 6, available: [1, 2, 3] });
  assert.ok(edl);
  assert.equal(edl.clips.length, 2);
  assert.equal(edl.clips[0].number, 1);
  assert.equal(edl.clips[1].number, 3);
  assert.ok(warnings.some((w) => w.includes('Dropped clip shorter than minClip (0.5s).')));
});

test('all-invalid clips or missing duration yields null edl', () => {
  const rawNoValidClips = {
    version: 1,
    clips: [
      { number: 99, start: 0, end: 2 },
      { number: 1, start: 1, end: 1.2 }, // too short
    ],
  };
  const res1 = normalizeEdl(rawNoValidClips, { duration: 5, available: [1] });
  assert.equal(res1.edl, null);
  assert.ok(res1.warnings.length > 0);

  const res2 = normalizeEdl(rawNoValidClips, { duration: 0, available: [1] });
  assert.equal(res2.edl, null);
  assert.ok(res2.warnings.some((w) => w.includes('Invalid or missing duration')));

  const res3 = normalizeEdl(rawNoValidClips, { duration: 5, available: 'not an array' });
  assert.equal(res3.edl, null);
});

test('subtitle cleanup and phrase fallback', () => {
  // 1. Cleanup of valid raw subtitles
  const rawWithSubs = {
    version: 1,
    clips: [{ number: 1, start: 0, end: 10 }],
    subtitles: [
      null,
      { text: '', start: 0, end: 1 },
      { text: '  clean   this   text  ', start: 0, end: 2 },
      { text: 'inverted', start: 3, end: 2 },
      { text: 'A'.repeat(150), start: 4, end: 6 },
      { text: 'second', start: 2, end: 3.5 },
    ],
  };
  const res1 = normalizeEdl(rawWithSubs, { duration: 10, available: [1] });
  assert.ok(res1.edl);
  assert.equal(res1.edl.subtitles.length, 3);
  assert.deepEqual(res1.edl.subtitles[0], { start: 0, end: 2, text: 'clean this text' });
  assert.deepEqual(res1.edl.subtitles[1], { start: 2, end: 3.5, text: 'second' });
  assert.equal(res1.edl.subtitles[2].text.length, 120);

  // 2. Phrase fallback when raw has no valid subtitles
  const rawWithoutSubs = {
    version: 1,
    clips: [{ number: 1, start: 0, end: 10 }],
    subtitles: [{ text: '   ', start: 0, end: 1 }],
  };
  const phrases = [
    { start: 0, end: 3, text: 'Phrase one' },
    { start: 3.5, end: 7, text: 'Phrase two' },
  ];
  const res2 = normalizeEdl(rawWithoutSubs, { duration: 10, available: [1], phrases });
  assert.ok(res2.edl);
  assert.deepEqual(res2.edl.subtitles, [
    { start: 0, end: 3, text: 'Phrase one' },
    { start: 3.5, end: 7, text: 'Phrase two' },
  ]);
});

test('fallbackEdl mapping and normalizeEdl(fallbackEdl(...)) idempotency with 0 warnings', () => {
  const phrases = [
    { start: 0.5, end: 3.2, text: 'First phrase spoken.' },
    { start: 3.8, end: 6.5, text: 'Second phrase spoken.' },
    { start: 7.0, end: 9.8, text: 'Third phrase spoken.' },
  ];
  const duration = 10;
  const available = [4, 1, 9];

  const fallback = fallbackEdl({ duration, available, phrases });
  assert.ok(fallback);
  assert.equal(fallback.version, 1);
  assert.equal(fallback.duration, 10);
  assert.equal(fallback.clips.length, 3);

  // Mapped to sorted available: 1, 4, 9
  assert.equal(fallback.clips[0].number, 1);
  assert.equal(fallback.clips[1].number, 4);
  assert.equal(fallback.clips[2].number, 9);

  // Transitions: first fade, others cut
  assert.equal(fallback.clips[0].transition, 'fade');
  assert.equal(fallback.clips[1].transition, 'cut');
  assert.equal(fallback.clips[2].transition, 'cut');

  // Motions: alternate zoom-in, zoom-out
  assert.equal(fallback.clips[0].motion, 'zoom-in');
  assert.equal(fallback.clips[1].motion, 'zoom-out');
  assert.equal(fallback.clips[2].motion, 'zoom-in');

  // Subtitles from phrases
  assert.equal(fallback.subtitles.length, 3);
  assert.equal(fallback.subtitles[0].text, 'First phrase spoken.');

  // Zero warnings and deep-equal in normalizeEdl
  const normalized = normalizeEdl(fallback, { duration, available, phrases });
  assert.equal(normalized.warnings.length, 0);
  assert.deepEqual(normalized.edl, fallback);

  // Edge cases: invalid duration or empty available -> null
  assert.equal(fallbackEdl({ duration: -1, available }), null);
  assert.equal(fallbackEdl({ duration, available: [] }), null);
});

test('normalizeEdl preserves and normalizes captionStyle when provided', () => {
  const raw = {
    version: 1,
    clips: [{ number: 1, start: 0, end: 5, transition: 'cut', motion: 'none' }],
    captionStyle: { font: 'anton', size: 90 },
  };
  const { edl, warnings } = normalizeEdl(raw, { duration: 5, available: [1] });
  assert.ok(edl);
  assert.equal(edl.captionStyle.font, 'anton');
  assert.equal(edl.captionStyle.size, 90);
  assert.equal(edl.captionStyle.weight, 400);
  assert.equal(warnings.length, 0);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
