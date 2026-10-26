// Run with: node src/flow/sceneStatus.test.mjs
import assert from 'node:assert/strict';
import { allFiles, latestFiles, selectedCount, pendingScenes, sceneImageUrl, sceneStatusLabel } from './sceneStatus.js';

const done = { number: 1, generations: [{ files: ['a-1.webp', 'a-2.webp'] }, { files: ['b-1.webp', 'b-2.webp'] }] };

assert.equal(sceneImageUrl('v 1', 7, 'x-1.webp'), 'mecatube-media://scene/v%201/7/x-1.webp');
assert.deepEqual(latestFiles(done), ['b-1.webp', 'b-2.webp']);
assert.deepEqual(latestFiles(undefined), []);
assert.deepEqual(latestFiles({ generations: [] }), []);

assert.deepEqual(sceneStatusLabel({ state: 'queued' }, undefined), { tone: 'active', text: 'En cola' });
assert.deepEqual(sceneStatusLabel({ state: 'running', percent: 40 }, undefined), { tone: 'active', text: 'Generando… 40 %' });
assert.deepEqual(sceneStatusLabel({ state: 'running', percent: null }, undefined), { tone: 'active', text: 'Generando…' });
assert.equal(sceneStatusLabel({ state: 'running', captcha: true }, undefined).tone, 'warn');
assert.equal(sceneStatusLabel({ state: 'error', error: 'x' }, done).tone, 'error');
assert.deepEqual(sceneStatusLabel({ state: 'done' }, done), { tone: 'done', text: 'Lista' });
assert.deepEqual(sceneStatusLabel(undefined, done), { tone: 'done', text: 'Lista' });
assert.deepEqual(sceneStatusLabel({ state: 'cancelled' }, undefined), { tone: 'idle', text: '' });

const scenes = [1, 2, 3, 4, 5].map((number) => ({ number }));
const pending = pendingScenes(scenes, { 2: { state: 'queued' }, 3: { state: 'running' }, 4: { state: 'error' }, 5: { state: 'cancelled' } }, { 1: done });
assert.deepEqual(pending.map((scene) => scene.number), [4, 5]);

assert.deepEqual(allFiles(done), ['a-1.webp', 'a-2.webp', 'b-1.webp', 'b-2.webp']);
assert.deepEqual(allFiles(undefined), []);
// Only a choice among the latest pair counts (a choice in an older generation does not)
const records = { 1: { ...done, selectedFile: 'b-2.webp' }, 2: { ...done, selectedFile: 'a-1.webp' }, 3: { ...done, selectedFile: null } };
assert.equal(selectedCount([{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }], records), 1);

console.log('sceneStatus: all passed');
