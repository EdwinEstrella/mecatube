// API keys, encrypted with Electron safeStorage. The key is only ever decrypted in the main
// process: the renderer gets a status ({ configured, last4 }) and nothing else.
const fs = require('node:fs');
const path = require('node:path');

const KEY_MAX = 512;

function createSecretStore(dir, safeStorage) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'secrets.json');

  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      return {};
    }
  }

  function write(data) {
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temp, file);
  }

  function decrypt(name) {
    const stored = read()[name];
    if (typeof stored !== 'string' || !stored) return null;
    try {
      if (!safeStorage.isEncryptionAvailable()) return null;
      return safeStorage.decryptString(Buffer.from(stored, 'base64'));
    } catch {
      return null;
    }
  }

  function validKey(value) {
    if (typeof value !== 'string') throw new Error('Invalid API key.');
    const key = value.trim();
    if (!key) throw new Error('The API key is empty.');
    if (key.length > KEY_MAX || /[\s\u0000-\u001f]/.test(key)) throw new Error('The API key looks invalid.');
    return key;
  }

  // Never falls back to plaintext: without OS-level encryption the key is not stored at all
  function save(name, value) {
    const key = validKey(value);
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is not available on this system, so the key was not saved.');
    }
    const data = read();
    data[name] = safeStorage.encryptString(key).toString('base64');
    write(data);
  }

  function clear(name) {
    const data = read();
    if (!(name in data)) return;
    delete data[name];
    write(data);
  }

  function status(name) {
    const key = decrypt(name);
    return key ? { configured: true, last4: key.slice(-4) } : { configured: false };
  }

  return {
    getCartesiaKey: () => decrypt('cartesia'),
    cartesiaStatus: () => status('cartesia'),
    saveCartesiaKey: (value) => save('cartesia', value),
    clearCartesiaKey: () => clear('cartesia'),
  };
}

module.exports = { createSecretStore };
