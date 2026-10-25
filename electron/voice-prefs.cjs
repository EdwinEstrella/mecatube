// Last voice choice ({ voiceId, voiceName, model }) kept in userData/voice-prefs.json.
const fs = require('node:fs');
const path = require('node:path');
const { MODELS } = require('./cartesia.cjs');

const DEFAULT_PREFS = Object.freeze({
  voiceId: 'b042270c-d46f-4d4f-8fb0-7dd7c5fe5615',
  voiceName: 'Hector - Tour Leader',
  model: 'sonic-3.5',
});
const VOICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const NAME_MAX = 200;

// Returns a clean prefs object or throws; unknown fields are dropped
function validatePrefs(input) {
  if (!input || typeof input !== 'object') throw new Error('Preferencias de voz no válidas.');
  const { voiceId, voiceName, model } = input;
  if (typeof voiceId !== 'string' || !VOICE_ID_PATTERN.test(voiceId)) throw new Error('ID de voz no válido.');
  if (typeof voiceName !== 'string' || voiceName.length > NAME_MAX) throw new Error('Nombre de voz no válido.');
  if (!MODELS.includes(model)) throw new Error('Modelo de voz desconocido.');
  return { voiceId, voiceName: voiceName.trim() || voiceId, model };
}

function createVoicePrefsStore(userDataDir) {
  const file = path.join(userDataDir, 'voice-prefs.json');

  function get() {
    try {
      return validatePrefs(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  function set(input) {
    const prefs = validatePrefs(input);
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(prefs, null, 2));
    return prefs;
  }

  return { get, set };
}

module.exports = { DEFAULT_PREFS, validatePrefs, createVoicePrefsStore };
