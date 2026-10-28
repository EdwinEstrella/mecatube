import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStageStorageKey,
  getInitialStageKey,
  getRememberedStageKey,
  rememberStageKey,
  clearRememberedStageKey,
} from './stageMemory.js';

function createFakeStorage(initialData = {}, { throwOnGet = false, throwOnSet = false } = {}) {
  const store = new Map(Object.entries(initialData));
  return {
    store,
    getItem(key) {
      if (throwOnGet) throw new Error('Storage access denied');
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (throwOnSet) throw new Error('QuotaExceededError');
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

const mockStages = [
  { key: 'idea', status: 'done' },
  { key: 'script', status: 'done' },
  { key: 'voice', status: 'pending' },
  { key: 'images', status: 'pending' },
];

test('getInitialStageKey returns first non-done stage or last stage', () => {
  assert.equal(getInitialStageKey(mockStages), 'voice');
  const allDone = mockStages.map((s) => ({ ...s, status: 'done' }));
  assert.equal(getInitialStageKey(allDone), 'images');
  assert.equal(getInitialStageKey([]), null);
});

test('getRememberedStageKey falls back to initial stage when nothing is stored', () => {
  const storage = createFakeStorage();
  const result = getRememberedStageKey('vid-1', mockStages, storage);
  assert.equal(result, 'voice');
});

test('getRememberedStageKey returns stored stage when valid and present in stages', () => {
  const storage = createFakeStorage({
    [getStageStorageKey('vid-1')]: 'script',
  });
  const result = getRememberedStageKey('vid-1', mockStages, storage);
  assert.equal(result, 'script');
});

test('getRememberedStageKey falls back to initial stage if stored key is not in stages', () => {
  const storage = createFakeStorage({
    [getStageStorageKey('vid-1')]: 'non-existent-stage',
  });
  const result = getRememberedStageKey('vid-1', mockStages, storage);
  assert.equal(result, 'voice');
});

test('getRememberedStageKey handles storage read exceptions gracefully', () => {
  const storage = createFakeStorage({}, { throwOnGet: true });
  const result = getRememberedStageKey('vid-1', mockStages, storage);
  assert.equal(result, 'voice');
});

test('rememberStageKey persists selected stage per videoId', () => {
  const storage = createFakeStorage();
  rememberStageKey('vid-1', 'images', storage);
  rememberStageKey('vid-2', 'idea', storage);

  assert.equal(storage.store.get('mecatube:timeline-stage:vid-1'), 'images');
  assert.equal(storage.store.get('mecatube:timeline-stage:vid-2'), 'idea');

  assert.equal(getRememberedStageKey('vid-1', mockStages, storage), 'images');
  assert.equal(getRememberedStageKey('vid-2', mockStages, storage), 'idea');
});

test('rememberStageKey handles storage write exceptions gracefully', () => {
  const storage = createFakeStorage({}, { throwOnSet: true });
  assert.doesNotThrow(() => {
    rememberStageKey('vid-1', 'voice', storage);
  });
});

test('tolerates null/undefined storage safely', () => {
  assert.equal(getRememberedStageKey('vid-1', mockStages, null), 'voice');
  assert.doesNotThrow(() => {
    rememberStageKey('vid-1', 'voice', null);
  });
  assert.doesNotThrow(() => {
    clearRememberedStageKey('vid-1', null);
  });
});

test('clearRememberedStageKey removes key for specific video', () => {
  const storage = createFakeStorage({
    [getStageStorageKey('vid-1')]: 'script',
  });
  clearRememberedStageKey('vid-1', storage);
  assert.equal(storage.store.has(getStageStorageKey('vid-1')), false);
  assert.equal(getRememberedStageKey('vid-1', mockStages, storage), 'voice');
});
