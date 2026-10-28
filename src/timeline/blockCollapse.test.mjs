import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSceneImageComplete,
  isAnimationItemComplete,
  isImageBlockComplete,
  isAnimationBlockComplete,
  isBlockComplete,
  blockCollapsedLabel,
} from './blockCollapse.js';

test('isSceneImageComplete verifies selected image existence in latest generation', () => {
  const records = {
    1: { selectedFile: '1-b.webp', generations: [{ files: ['1-a.webp', '1-b.webp'] }] },
    2: { selectedFile: '2-a.webp', generations: [{ files: ['2-a.webp'] }, { files: ['2-c.webp', '2-d.webp'] }] },
    3: { selectedFile: null, generations: [{ files: ['3-a.webp'] }] },
  };

  assert.equal(isSceneImageComplete({ number: 1 }, records), true);
  // Scene 2 has selectedFile from an older generation, not in latestFiles
  assert.equal(isSceneImageComplete({ number: 2 }, records), false);
  assert.equal(isSceneImageComplete({ number: 3 }, records), false);
  assert.equal(isSceneImageComplete({ number: 4 }, records), false);
  assert.equal(isSceneImageComplete(null, records), false);
  assert.equal(isSceneImageComplete({ number: 1 }, null), false);
  assert.equal(isSceneImageComplete(1, records), true);
});

test('isAnimationItemComplete verifies generated or selected video', () => {
  const records = {
    1: { generations: [{ files: ['anim-1.mp4'] }] },
    2: { selectedFile: 'anim-2-custom.mp4', generations: [{ files: ['anim-2.mp4', 'anim-2-custom.mp4'] }] },
    3: { generations: [] },
    4: { selectedFile: null, generations: [] },
  };

  assert.equal(isAnimationItemComplete({ number: 1 }, records), true);
  assert.equal(isAnimationItemComplete({ number: 2 }, records), true);
  assert.equal(isAnimationItemComplete({ number: 3 }, records), false);
  assert.equal(isAnimationItemComplete({ number: 4 }, records), false);
  assert.equal(isAnimationItemComplete({ number: 5 }, records), false);
  assert.equal(isAnimationItemComplete(null, records), false);
  assert.equal(isAnimationItemComplete({ number: 1 }, null), false);
  assert.equal(isAnimationItemComplete(1, records), true);
});

test('isImageBlockComplete requires all scenes in block to have selected images', () => {
  const scenes = [{ number: 1 }, { number: 2 }];
  const recordsIncomplete = {
    1: { selectedFile: 'img1.webp', generations: [{ files: ['img1.webp'] }] },
    2: { selectedFile: null, generations: [{ files: ['img2.webp'] }] },
  };
  const recordsComplete = {
    1: { selectedFile: 'img1.webp', generations: [{ files: ['img1.webp'] }] },
    2: { selectedFile: 'img2.webp', generations: [{ files: ['img2.webp'] }] },
  };

  assert.equal(isImageBlockComplete([], recordsComplete), false);
  assert.equal(isImageBlockComplete(null, recordsComplete), false);
  assert.equal(isImageBlockComplete(scenes, recordsIncomplete), false);
  assert.equal(isImageBlockComplete(scenes, recordsComplete), true);
});

test('isAnimationBlockComplete requires all animations in block to have videos', () => {
  const animations = [{ number: 10 }, { number: 11 }];
  const recordsIncomplete = {
    10: { generations: [{ files: ['vid10.mp4'] }] },
  };
  const recordsComplete = {
    10: { generations: [{ files: ['vid10.mp4'] }] },
    11: { generations: [{ files: ['vid11.mp4'] }] },
  };

  assert.equal(isAnimationBlockComplete([], recordsComplete), false);
  assert.equal(isAnimationBlockComplete(null, recordsComplete), false);
  assert.equal(isAnimationBlockComplete(animations, recordsIncomplete), false);
  assert.equal(isAnimationBlockComplete(animations, recordsComplete), true);
});

test('isBlockComplete delegates to image or animation logic correctly', () => {
  const scenes = [{ number: 1 }];
  const imageRecords = { 1: { selectedFile: 'a.webp', generations: [{ files: ['a.webp'] }] } };
  const animRecords = { 1: { generations: [{ files: ['a.mp4'] }] } };

  assert.equal(isBlockComplete('images', scenes, imageRecords), true);
  assert.equal(isBlockComplete('images', scenes, {}), false);
  assert.equal(isBlockComplete('animations', scenes, animRecords), true);
  assert.equal(isBlockComplete('animations', scenes, {}), false);
});

test('blockCollapsedLabel formats label with block and scene counts', () => {
  const block = { index: 1, total: 3, from: 1, to: 20 };
  const scenes = new Array(20).fill({});

  assert.equal(blockCollapsedLabel(block, scenes), 'Bloque 1 de 3 · 20/20 listas ✓');
  assert.equal(blockCollapsedLabel({ index: 2, total: 2 }, 15), 'Bloque 2 de 2 · 15/15 listas ✓');
  assert.equal(blockCollapsedLabel(null, scenes), '20/20 listas ✓');
  assert.equal(blockCollapsedLabel({ index: 1 }, 10), 'Bloque 1 · 10/10 listas ✓');
});
