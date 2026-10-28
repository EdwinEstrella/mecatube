// Run with: node src/editor/plan.test.mjs
import assert from 'node:assert/strict';
import {
  FPS,
  WIDTH,
  HEIGHT,
  DEFAULT_CLIP_SECONDS,
  TRANSITION_FRAMES,
  PUNCH_FRAMES,
  compositionSize,
  frameSize,
  getCompositionDimensions,
  buildPlan,
  activeSubtitle,
} from './plan.js';

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

// --- Constants & compositionSize -------------------------------------------
test('constants and compositionSize match contract', () => {
  assert.equal(FPS, 30);
  assert.equal(WIDTH, 1920);
  assert.equal(HEIGHT, 1080);
  assert.equal(DEFAULT_CLIP_SECONDS, 8);
  assert.deepEqual(TRANSITION_FRAMES, { fade: 12, slide: 12 });
  assert.equal(PUNCH_FRAMES, 8);
  assert.deepEqual(compositionSize, { width: 1920, height: 1080, fps: 30 });
});

test('frameSize returns 1080x1920 for vertical and 1920x1080 for horizontal', () => {
  assert.deepEqual(frameSize('vertical'), { width: 1080, height: 1920 });
  assert.deepEqual(frameSize('horizontal'), { width: 1920, height: 1080 });
  assert.deepEqual(frameSize(), { width: 1920, height: 1080 });
  assert.deepEqual(frameSize(null), { width: 1920, height: 1080 });
  assert.deepEqual(frameSize('unknown'), { width: 1920, height: 1080 });

  assert.deepEqual(getCompositionDimensions('vertical'), { width: 1080, height: 1920, fps: 30 });
  assert.deepEqual(getCompositionDimensions('horizontal'), { width: 1920, height: 1080, fps: 30 });
  assert.deepEqual(getCompositionDimensions('vertical', 60), { width: 1080, height: 1920, fps: 60 });
});

// --- Null for empty EDL -----------------------------------------------------
test('buildPlan returns null for missing or empty EDL', () => {
  assert.equal(buildPlan(null), null);
  assert.equal(buildPlan(undefined), null);
  assert.equal(buildPlan({}), null);
  assert.equal(buildPlan({ duration: 10, clips: [] }), null);
});

// --- Frame math ------------------------------------------------------------
test('frame math computes contiguous startFrame, endFrame, and frames', () => {
  const edl = {
    duration: 6,
    clips: [
      { number: 1, start: 0, end: 2, transition: 'fade', motion: 'zoom-in' },
      { number: 2, start: 2, end: 6, transition: 'cut', motion: 'pan-left' },
    ],
  };

  const plan = buildPlan(edl, { fps: 30 });
  assert.ok(plan);
  assert.equal(plan.durationInFrames, 180);
  assert.equal(plan.items.length, 2);

  const [first, second] = plan.items;
  assert.equal(first.startFrame, 0);
  assert.equal(first.frames, 60);
  assert.equal(first.transitionIn, null); // Item 0 always has null transitionIn
  assert.equal(first.motion, 'zoom-in');

  assert.equal(second.startFrame, 60);
  assert.equal(second.frames, 120);
  assert.equal(second.transitionIn, null); // cut
  assert.equal(second.motion, 'pan-left');
});

// --- Overlap compensation invariant with mixed transitions ------------------
test('overlap compensation invariant holds with mixed fade, slide, cut, zoom', () => {
  const edl = {
    duration: 10,
    clips: [
      { number: 1, start: 0, end: 2, transition: 'fade' },
      { number: 2, start: 2, end: 4, transition: 'slide' },
      { number: 3, start: 4, end: 6, transition: 'cut' },
      { number: 4, start: 6, end: 8, transition: 'zoom' },
      { number: 5, start: 8, end: 10, transition: 'fade' },
    ],
  };

  const plan = buildPlan(edl, { fps: 30 });
  assert.ok(plan);
  assert.equal(plan.durationInFrames, 300);

  const sumSequenceFrames = plan.items.reduce((s, it) => s + it.sequenceFrames, 0);
  const sumTransitionFrames = plan.items.reduce(
    (s, it) => s + (it.transitionIn?.frames ?? 0),
    0
  );

  assert.equal(sumSequenceFrames - sumTransitionFrames, plan.durationInFrames);

  // Transitions check
  assert.equal(plan.items[0].transitionIn, null);
  assert.deepEqual(plan.items[1].transitionIn, { type: 'slide', frames: 12 });
  assert.equal(plan.items[2].transitionIn, null);
  assert.equal(plan.items[3].transitionIn, null);
  assert.deepEqual(plan.items[4].transitionIn, { type: 'fade', frames: 12 });

  // Sequence frames check
  assert.equal(plan.items[0].sequenceFrames, plan.items[0].frames + 12);
  assert.equal(plan.items[1].sequenceFrames, plan.items[1].frames + 0);
  assert.equal(plan.items[2].sequenceFrames, plan.items[2].frames + 0);
  assert.equal(plan.items[3].sequenceFrames, plan.items[3].frames + 12);
  assert.equal(plan.items[4].sequenceFrames, plan.items[4].frames + 0);
});

// --- Transition clamping for short clips ------------------------------------
test('transition clamping for short clips limits or drops transitions', () => {
  // prev.frames = 8 (floor/2 = 4), cur.frames = 6 (floor/2 = 3) -> min(12, 4, 3) = 3
  const edlClamped = {
    duration: 0.467,
    clips: [
      { number: 1, start: 0, end: 0.267, transition: 'cut' },
      { number: 2, start: 0.267, end: 0.467, transition: 'fade' },
    ],
  };

  const plan = buildPlan(edlClamped, { fps: 30 });
  assert.ok(plan);
  const [first, second] = plan.items;
  assert.equal(first.frames, 8);
  assert.equal(second.frames, 6);
  assert.deepEqual(second.transitionIn, { type: 'fade', frames: 3 });

  // When min frames < 2, transitionIn must be null
  const edlTooShort = {
    duration: 0.2,
    clips: [
      { number: 1, start: 0, end: 0.1, transition: 'cut' },
      { number: 2, start: 0.1, end: 0.2, transition: 'slide' },
    ],
  };

  const planShort = buildPlan(edlTooShort, { fps: 30 });
  assert.ok(planShort);
  // 3 frames each -> floor(3/2) = 1 < 2 -> null
  assert.equal(planShort.items[1].transitionIn, null);
});

// --- PunchIn behavior -------------------------------------------------------
test('punchIn is true for zoom transition, false otherwise', () => {
  const edl = {
    duration: 4,
    clips: [
      { number: 10, start: 0, end: 2, transition: 'zoom' },
      { number: 20, start: 2, end: 4, transition: 'fade' },
    ],
  };

  const plan = buildPlan(edl, { fps: 30 });
  assert.ok(plan);
  assert.equal(plan.items[0].punchIn, true);
  assert.equal(plan.items[0].transitionIn, null);
  assert.equal(plan.items[1].punchIn, false);
});

// --- Speed and hold rules ---------------------------------------------------
test('speed rules: rate 1, slowed rate, holdFrames, and default 8s source', () => {
  const edl = {
    duration: 34,
    clips: [
      // 6s segment <= 8s default source -> playbackRate 1, holdFrames 0
      { number: 1, start: 0, end: 6, transition: 'cut' },
      // 9s segment > 8s but 8/9 = 0.8888... >= 0.85 -> playbackRate = 0.889, holdFrames 0
      { number: 2, start: 6, end: 15, transition: 'cut' },
      // 15s segment > 8s / 0.85 -> playbackRate = 0.85, holdFrames = 450 - round((8/0.85)*30) = 450 - 282 = 168
      { number: 3, start: 15, end: 30, transition: 'cut' },
      // 4s segment with custom duration 3s -> 3/4 = 0.75 < 0.85 -> playbackRate = 0.85, holdFrames = 120 - round((3/0.85)*30) = 14
      { number: 4, start: 30, end: 34, transition: 'cut' },
    ],
  };

  const plan = buildPlan(edl, {
    fps: 30,
    clipDurations: { 4: 3, 3: null, 2: 0, 1: -5 },
  });

  assert.ok(plan);
  const [c1, c2, c3, c4] = plan.items;

  // c1: segmentSeconds = 6 <= 8 (default fallback for -5)
  assert.equal(c1.playbackRate, 1);
  assert.equal(c1.holdFrames, 0);
  assert.equal(c1.loop, undefined);

  // c2: segmentSeconds = 9 > 8 but 8/9 >= 0.85
  assert.equal(c2.playbackRate, 0.889);
  assert.equal(c2.holdFrames, 0);
  assert.equal(c2.loop, undefined);

  // c3: segmentSeconds = 15 > 8/0.85
  assert.equal(c3.playbackRate, 0.85);
  assert.equal(c3.holdFrames, 168);
  assert.equal(c3.loop, undefined);

  // c4: segmentSeconds = 4 with custom source 3s
  assert.equal(c4.playbackRate, 0.85);
  assert.equal(c4.holdFrames, 14);
  assert.equal(c4.loop, undefined);

  // Total frames invariant holds
  const sumFrames = plan.items.reduce((sum, item) => sum + item.frames, 0);
  assert.equal(sumFrames, plan.durationInFrames);
  assert.equal(plan.durationInFrames, 34 * 30);
});

// --- Tiny clip merge --------------------------------------------------------
test('tiny clip merge drops clips with frames < 1 and merges span into previous', () => {
  const edl = {
    duration: 4,
    clips: [
      { number: 1, start: 0, end: 2, transition: 'cut' },
      // start 2.0 to next start 2.001 -> round(2*30)=60, round(2.001*30)=60 -> 0 frames
      { number: 2, start: 2.0, end: 2.001, transition: 'fade' },
      { number: 3, start: 2.001, end: 4, transition: 'slide' },
    ],
  };

  const plan = buildPlan(edl, { fps: 30 });
  assert.ok(plan);
  assert.equal(plan.items.length, 2);
  assert.equal(plan.items[0].number, 1);
  assert.equal(plan.items[0].frames, 60);
  assert.equal(plan.items[1].number, 3);
  assert.equal(plan.items[1].frames, 60);
  assert.equal(plan.durationInFrames, 120);

  const sumSequenceFrames = plan.items.reduce((s, it) => s + it.sequenceFrames, 0);
  const sumTransitionFrames = plan.items.reduce(
    (s, it) => s + (it.transitionIn?.frames ?? 0),
    0
  );
  assert.equal(sumSequenceFrames - sumTransitionFrames, plan.durationInFrames);
});

// --- activeSubtitle edges ---------------------------------------------------
test('activeSubtitle edge cases and bounds', () => {
  const subs = [
    { start: 1.0, end: 2.5, text: 'First subtitle' },
    { start: 3.0, end: 4.5, text: 'Second subtitle' },
  ];

  assert.equal(activeSubtitle(null, 1.5), null);
  assert.equal(activeSubtitle([], 1.5), null);
  assert.equal(activeSubtitle(subs, NaN), null);
  assert.equal(activeSubtitle(subs, Infinity), null);
  assert.equal(activeSubtitle(subs, '1.5'), null);

  // Before first
  assert.equal(activeSubtitle(subs, 0.5), null);

  // Exactly at start
  assert.equal(activeSubtitle(subs, 1.0)?.text, 'First subtitle');

  // Inside
  assert.equal(activeSubtitle(subs, 1.8)?.text, 'First subtitle');

  // Exactly at end (start <= seconds < end -> returns null)
  assert.equal(activeSubtitle(subs, 2.5), null);

  // In the gap between 2.5 and 3.0
  assert.equal(activeSubtitle(subs, 2.8), null);

  // Second subtitle
  assert.equal(activeSubtitle(subs, 3.0)?.text, 'Second subtitle');
  assert.equal(activeSubtitle(subs, 4.499)?.text, 'Second subtitle');
  assert.equal(activeSubtitle(subs, 4.5), null);

  // After last
  assert.equal(activeSubtitle(subs, 5.0), null);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
