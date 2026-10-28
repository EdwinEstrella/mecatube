// Tests for deepseek-prefs.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createDeepSeekPrefsStore, validatePrefs, DEFAULT_PREFS } = require('./deepseek-prefs.cjs');

test('validatePrefs: defaults webSearch to true on missing or empty input', () => {
  assert.deepEqual(validatePrefs(null), { webSearch: true });
  assert.deepEqual(validatePrefs({}), { webSearch: true });
  assert.deepEqual(validatePrefs({ webSearch: true }), { webSearch: true });
  assert.deepEqual(validatePrefs({ webSearch: false }), { webSearch: false });
  assert.deepEqual(validatePrefs({ webSearch: 'random' }), { webSearch: true });
});

test('createDeepSeekPrefsStore: persists and loads prefs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsk-prefs-'));
  try {
    const store = createDeepSeekPrefsStore(tmp);
    // Initial read defaults to true
    assert.deepEqual(store.get(), { webSearch: true });

    // Set webSearch to false
    const updated = store.set({ webSearch: false });
    assert.deepEqual(updated, { webSearch: false });
    assert.deepEqual(store.get(), { webSearch: false });

    // New instance in same directory reads persisted value
    const store2 = createDeepSeekPrefsStore(tmp);
    assert.deepEqual(store2.get(), { webSearch: false });

    // Set back to true
    store2.set({ webSearch: true });
    assert.deepEqual(store2.get(), { webSearch: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('createDeepSeekPrefsStore: set() ignores non-object input and keeps current prefs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsk-prefs-'));
  try {
    const store = createDeepSeekPrefsStore(tmp);
    store.set({ webSearch: false });
    assert.deepEqual(store.get(), { webSearch: false });

    assert.deepEqual(store.set(null), { webSearch: false });
    assert.deepEqual(store.set(undefined), { webSearch: false });
    assert.deepEqual(store.set('string'), { webSearch: false });
    assert.deepEqual(store.set(123), { webSearch: false });
    assert.deepEqual(store.set([1, 2, 3]), { webSearch: false });

    assert.deepEqual(store.get(), { webSearch: false });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
