// AI director service: uses DeepSeek to assemble an Edit Decision List (EDL)
// and handles persistence of edit.json in the workspace.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VIDEO_ID = /^[\w-]{1,100}$/;
const MAX_PHRASES = 2000;
const MAX_ANIMATIONS = 500;
const MAX_NOTES_CHARS = 500;
const MAX_EDL_BYTES = 2 * 1024 * 1024;

const DIRECTOR_SYSTEM_PROMPT =
  'You are a professional YouTube video editor for narrated faceless videos.\n' +
  'Generate an Edit Decision List (EDL) following these strict rules:\n\n' +
  '1. Output ONLY one JSON object, no prose, no code fences. Output exactly the EDL v1 shape with allowed transition values cut|fade|slide|zoom and motion values none|zoom-in|zoom-out|pan-left|pan-right:\n' +
  '   {\n' +
  '     "version": 1,\n' +
  '     "duration": <number>,\n' +
  '     "clips": [\n' +
  '       { "number": <int>, "start": <number>, "end": <number>, "transition": "<cut|fade|slide|zoom>", "motion": "<none|zoom-in|zoom-out|pan-left|pan-right>" }\n' +
  '     ],\n' +
  '     "subtitles": [\n' +
  '       { "start": <number>, "end": <number>, "text": "<string>" }\n' +
  '     ]\n' +
  '   }\n\n' +
  '2. Clips must be contiguous, cover 0..duration exactly, cut on phrase boundaries (use phrase start times), in narrative order.\n\n' +
  '3. Animations are numbered in script order: the illustrator split the script in order and the last animation matches the end of the script; use that order as the backbone, every animation should appear at least once when possible; hook animations (hook=true) belong to the opening hook.\n\n' +
  '4. Each source clip lasts about 8 seconds; prefer segments of 2-8 s; a longer segment is allowed (it will be slowed/looped) but split long phrases across two clips instead when possible; reusing a clip is allowed.\n\n' +
  '5. Pacing: faster cuts in the hook, mostly \'cut\' transitions, \'fade\' on topic changes, \'zoom\' for reveals/emphasis, \'slide\' rarely; vary motion so consecutive clips differ.\n\n' +
  '6. Subtitles: short chunks of at most ~7 words, aligned to the phrase timings, text copied from the phrases verbatim.\n\n' +
  '7. If notes are given, they are the creator\'s instructions for this edit and take priority over style preferences (never over the JSON/coverage rules).';

function validVideoId(value) {
  if (typeof value !== 'string' || !VIDEO_ID.test(value)) throw new Error('ID de video no válido.');
  return value;
}

function writeAtomic(file, data) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
}

function buildDirectorMessages({ duration, phrases, animations, notes }) {
  const userPayload = {
    duration,
    phrases: (Array.isArray(phrases) ? phrases : []).map((p, index) => ({
      i: typeof p.i === 'number' ? p.i : index,
      start: p.start,
      end: p.end,
      text: p.text,
    })),
    animations: (Array.isArray(animations) ? animations : []).map((a) => ({
      number: a.number,
      title: a.title,
      hook: Boolean(a.hook),
    })),
  };

  const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';
  if (trimmedNotes.length > 0) {
    userPayload.notes = trimmedNotes;
  }

  return [
    { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload) },
  ];
}

function createDirectorService({ getWorkspacePath, getApiKey, streamChat }) {
  let inFlight = false;

  async function direct({ videoId, duration, phrases, animations, notes }) {
    validVideoId(videoId);

    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      throw new Error('Duración no válida.');
    }

    if (!Array.isArray(phrases) || phrases.length < 1 || phrases.length > MAX_PHRASES) {
      throw new Error('Lista de frases no válida.');
    }
    for (const p of phrases) {
      if (
        !p ||
        typeof p !== 'object' ||
        typeof p.start !== 'number' ||
        !Number.isFinite(p.start) ||
        typeof p.end !== 'number' ||
        !Number.isFinite(p.end) ||
        typeof p.text !== 'string'
      ) {
        throw new Error('Lista de frases no válida.');
      }
    }

    if (!Array.isArray(animations) || animations.length < 1 || animations.length > MAX_ANIMATIONS) {
      throw new Error('Lista de animaciones no válida.');
    }
    for (const a of animations) {
      if (
        !a ||
        typeof a !== 'object' ||
        !Number.isInteger(a.number) ||
        a.number < 1 ||
        typeof a.title !== 'string' ||
        typeof a.hook !== 'boolean'
      ) {
        throw new Error('Lista de animaciones no válida.');
      }
    }

    let trimmedNotes = undefined;
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== 'string') throw new Error('Notas no válidas.');
      trimmedNotes = notes.trim();
      if (trimmedNotes.length > MAX_NOTES_CHARS) throw new Error('Notas no válidas.');
    }

    const apiKey = getApiKey?.();
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new Error('Configura tu API Key de DeepSeek en Configuración para que la IA edite el video.');
    }

    if (inFlight) throw new Error('Ya hay una edición en curso.');

    inFlight = true;
    try {
      const messages = buildDirectorMessages({
        duration,
        phrases,
        animations,
        notes: trimmedNotes,
      });
      const raw = await streamChat({
        apiKey,
        messages,
        model: 'deepseek-chat',
      });
      return { raw };
    } finally {
      inFlight = false;
    }
  }

  function getEdit(videoId) {
    validVideoId(videoId);
    try {
      const ws = getWorkspacePath?.();
      if (!ws) return null;
      const file = path.join(ws, 'videos', videoId, 'edit.json');
      const content = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      return null;
    } catch (error) {
      if (error.message === 'ID de video no válido.') throw error;
      return null;
    }
  }

  function saveEdit(videoId, edl) {
    validVideoId(videoId);
    if (!edl || typeof edl !== 'object' || Array.isArray(edl) || !Array.isArray(edl.clips)) {
      throw new Error('Edición no válida.');
    }
    const saved = { ...edl, savedAt: Date.now() };
    let serialized;
    try {
      serialized = JSON.stringify(saved, null, 2);
    } catch {
      throw new Error('Edición no válida.');
    }
    if (Buffer.byteLength(serialized, 'utf8') > MAX_EDL_BYTES) {
      throw new Error('Edición no válida.');
    }
    const ws = getWorkspacePath?.();
    if (!ws) throw new Error('Espacio de trabajo no disponible.');
    const videoDir = path.join(ws, 'videos', videoId);
    fs.mkdirSync(videoDir, { recursive: true });
    writeAtomic(path.join(videoDir, 'edit.json'), serialized);
    return saved;
  }

  const busy = () => inFlight;

  return { direct, getEdit, saveEdit, busy };
}

function registerDirectorIpc({ ipcMain, service }) {
  ipcMain.handle('editor:direct', (_event, payload = {}) => service.direct(payload));
  ipcMain.handle('editor:get', (_event, { videoId } = {}) => service.getEdit(videoId));
  ipcMain.handle('editor:save', (_event, { videoId, edl } = {}) => service.saveEdit(videoId, edl));
  ipcMain.handle('editor:busy', () => service.busy());
}

module.exports = {
  buildDirectorMessages,
  createDirectorService,
  registerDirectorIpc,
};
