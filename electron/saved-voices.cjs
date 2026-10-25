// Voices the user saved in Mecatube: userData/saved-voices.json [{ id, label, name, addedAt }].
// Seeded with Hector only when the file does not exist yet.
const fs = require('node:fs');
const path = require('node:path');

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const LABEL_MAX = 80;
const NAME_MAX = 120;
const MAX_VOICES = 500;

const SEED = Object.freeze({ id: 'b042270c-d46f-4d4f-8fb0-7dd7c5fe5615', label: 'Hector - Tour Leader', name: 'Hector - Tour Leader' });

function cleanId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error('That does not look like a voice ID.');
  return id;
}

function cleanLabel(label, fallback) {
  if (label !== undefined && label !== null && typeof label !== 'string') throw new Error('Invalid label.');
  const text = (label ?? '').trim().slice(0, LABEL_MAX);
  return text || fallback;
}

function createSavedVoiceStore(dir, { now = () => Date.now() } = {}) {
  const file = path.join(dir, 'saved-voices.json');

  function write(list) {
    fs.mkdirSync(dir, { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(list, null, 2));
    fs.renameSync(temp, file);
  }

  function read() {
    if (!fs.existsSync(file)) {
      const seeded = [{ ...SEED, addedAt: now() }];
      write(seeded);
      return seeded;
    }
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(data)) return [];
      return data.filter((item) => item && ID_PATTERN.test(item.id) && typeof item.label === 'string');
    } catch {
      return [];
    }
  }

  const list = () => read();

  // Adding an id that is already saved only updates its label
  function add({ id, label, name } = {}) {
    cleanId(id);
    const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, NAME_MAX) : id;
    const voices = read();
    const existing = voices.find((item) => item.id === id);
    if (existing) {
      existing.label = cleanLabel(label, existing.label);
    } else {
      if (voices.length >= MAX_VOICES) throw new Error('Too many saved voices.');
      voices.push({ id, label: cleanLabel(label, cleanName), name: cleanName, addedAt: now() });
    }
    write(voices);
    return voices;
  }

  function rename(id, label) {
    cleanId(id);
    const voices = read();
    const item = voices.find((entry) => entry.id === id);
    if (!item) throw new Error('Saved voice not found.');
    item.label = cleanLabel(label, item.label);
    write(voices);
    return voices;
  }

  function remove(id) {
    cleanId(id);
    const voices = read().filter((item) => item.id !== id);
    write(voices);
    return voices;
  }

  return { list, add, rename, remove };
}

module.exports = { createSavedVoiceStore, SEED };
