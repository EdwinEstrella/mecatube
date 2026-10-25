// Run with: node src/flow/animationStatus.test.mjs
import assert from 'node:assert/strict';
import { animationVideoUrl, hasSourceImage, hookCount, latestVideo, pendingAnimations } from './animationStatus.js';

assert.equal(animationVideoUrl('v 1', 7, '1700000000000-1.mp4'), 'mecatube-media://animation/v%201/7/1700000000000-1.mp4');
assert.equal(latestVideo({ generations: [{ files: ['a.mp4'] }, { files: ['b.mp4'] }] }), 'b.mp4');
assert.equal(latestVideo(undefined), null);

const picked = { generations: [{ files: ['a.webp', 'b.webp'] }], selectedFile: 'b.webp' };
assert.equal(hasSourceImage(picked), true);
assert.equal(hasSourceImage({ ...picked, selectedFile: null }), false);
assert.equal(hasSourceImage({ ...picked, selectedFile: 'gone.webp' }), false);
assert.equal(hasSourceImage(undefined), false);

const items = [
  { number: 1, hook: true },
  { number: 2, hook: true },
  { number: 3, hook: false },
  { number: 4, hook: true },
  { number: 5, hook: true },
  { number: 6, hook: false },
];
assert.equal(hookCount(items), 4);
const sceneRecords = { 1: picked, 2: picked, 3: picked, 4: picked, 6: picked }; // 5 has no chosen image
const records = { 2: { generations: [{ files: ['x.mp4'] }] }, 6: { generations: [{ files: ['y.mp4'] }] } };
const statuses = { 4: { state: 'queued' }, 6: { state: 'error' } };
assert.deepEqual(pendingAnimations(items, statuses, records, sceneRecords, { hookOnly: true }).map((item) => item.number), [1]);
assert.deepEqual(pendingAnimations(items, statuses, records, sceneRecords).map((item) => item.number), [1, 3, 6]);

console.log('animationStatus: all passed');
