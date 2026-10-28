// Preferences for DeepSeek ({ webSearch }) kept in <workspacePath>/deepseek-prefs.json.
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PREFS = Object.freeze({
  webSearch: true,
});

function validatePrefs(input) {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_PREFS };
  }
  return {
    webSearch: input.webSearch !== false,
  };
}

function createDeepSeekPrefsStore(dir) {
  const file = path.join(dir, 'deepseek-prefs.json');

  function get() {
    try {
      if (fs.existsSync(file)) {
        return validatePrefs(JSON.parse(fs.readFileSync(file, 'utf8')));
      }
    } catch {}
    return { ...DEFAULT_PREFS };
  }

  function set(input) {
    const current = get();
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return current;
    }
    const prefs = validatePrefs({ ...current, ...input });
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return prefs;
  }

  return { get, set };
}

module.exports = { DEFAULT_PREFS, validatePrefs, createDeepSeekPrefsStore };
