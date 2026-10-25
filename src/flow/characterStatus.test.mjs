// Run with: node src/flow/characterStatus.test.mjs
import assert from 'node:assert/strict';
import { allSelected, charactersDone, characterImageUrl } from './characterStatus.js';

assert.equal(allSelected({ a: { selectedFile: 'x.webp' }, b: { selectedFile: 'y.webp' } }, ['a', 'b']), true);
assert.equal(allSelected({ a: { selectedFile: 'x.webp' }, b: { selectedFile: null } }, ['a', 'b']), false);
assert.equal(allSelected({ a: { selectedFile: 'x.webp' } }, ['a', 'missing']), false);
assert.equal(allSelected({}, []), false);
assert.equal(charactersDone([{ approved: true, selectedFile: 'x.webp' }]), true);
assert.equal(charactersDone([{ approved: true, selectedFile: 'x.webp' }, { approved: false, selectedFile: 'y.webp' }]), false);
assert.equal(charactersDone([{ approved: true, selectedFile: null }]), false);
assert.equal(charactersDone([]), false);
assert.equal(charactersDone(undefined), false);
assert.equal(characterImageUrl('v-1', 'ana', '1700000000000-1.webp'), 'mecatube-media://character/v-1/ana/1700000000000-1.webp');
console.log('all passed');
