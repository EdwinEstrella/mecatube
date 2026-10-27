// AI director service: uses DeepSeek to assemble visual styling and scene alignment,
// and handles persistence of edit.json in the workspace.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VIDEO_ID = /^[\w-]{1,100}$/;
const MAX_PHRASES = 2000;
const MAX_SCENES = 500;
const MAX_CLIPS = 1000;
const MAX_PROMPT_CHARS = 700;
const MAX_CLIP_TEXT_CHARS = 2000;
const MAX_NOTES_CHARS = 500;
const MAX_EDL_BYTES = 2 * 1024 * 1024;

const DIRECTOR_SYSTEM_PROMPT =
  'You are a professional YouTube video editor for narrated faceless videos.\n' +
  'Clip timings and order are FIXED. Your role is ONLY to choose the transition and motion for each clip.\n\n' +
  'Allowed transitions: cut | fade | slide | zoom\n' +
  'Allowed motions: none | zoom-in | zoom-out | pan-left | pan-right\n\n' +
  'Pacing guidance:\n' +
  '- Opening hook: faster cuts and dynamic motion.\n' +
  '- Mostly use \'cut\' transitions.\n' +
  '- Use \'fade\' on topic changes.\n' +
  '- Use \'zoom\' for reveals and strong emphasis.\n' +
  '- Use \'slide\' rarely.\n' +
  '- Vary motion so consecutive clips differ (alternate zoom-in / zoom-out, pan-left / pan-right).\n\n' +
  'Rules:\n' +
  '1. Output ONLY one JSON object, no prose, no code fences. Output exactly this shape with one entry per given clip, in the same order:\n' +
  '   {\n' +
  '     "clips": [\n' +
  '       { "number": <int>, "transition": "<cut|fade|slide|zoom>", "motion": "<none|zoom-in|zoom-out|pan-left|pan-right>" }\n' +
  '     ]\n' +
  '   }\n' +
  '2. No timings, no subtitles (positions and captions are fixed).\n' +
  '3. If notes are given, they are creator instructions for styling and take priority over style preferences.';

const ALIGN_SYSTEM_PROMPT =
  'You are an expert video editor matching illustrated scenes to the narration.\n' +
  'Scenes are in script order and each scene illustrates the START of one moment.\n\n' +
  'Input:\n' +
  '- phrases: numbered narration phrases [{ "i": <int>, "text": "<string>" }] in chronological order.\n' +
  '- scenes: scenes to place [{ "number": <int>, "title": "<string>", "prompt": "<string>", "needed": <bool>, "fixedPhrase": <int|null> }].\n\n' +
  'Rules:\n' +
  '1. Output ONLY a single JSON object, no prose, no code fences:\n' +
  '   {"assignments":[{"number":N,"phrase":i}]}\n' +
  '2. For scenes with needed=true (or needed omitted), return one assignment with the phrase index i where that scene begins.\n' +
  '3. Anchored scenes (fixedPhrase) are fixed references in time. Use them to guide where the needed scenes belong.\n' +
  '4. Phrase indices must be non-decreasing in number order, one per scene.\n' +
  '5. The first scene usually starts at phrase 0.';

function validVideoId(value) {
  if (typeof value !== 'string' || !VIDEO_ID.test(value)) throw new Error('ID de video no válido.');
  return value;
}

function writeAtomic(file, data) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
}

function buildDirectorMessages({ duration, clips, notes }) {
  const userPayload = {
    duration,
    clips: (Array.isArray(clips) ? clips : []).map((c) => ({
      number: c.number,
      start: c.start,
      end: c.end,
      text: c.text,
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

function buildAlignMessages({ phrases, scenes }) {
  const userPayload = {
    phrases: (Array.isArray(phrases) ? phrases : []).map((p, index) => ({
      i: typeof p.i === 'number' ? p.i : index,
      text: p.text,
    })),
    scenes: (Array.isArray(scenes) ? scenes : []).map((s) => ({
      number: s.number,
      title: s.title,
      prompt: typeof s.prompt === 'string' ? s.prompt.slice(0, MAX_PROMPT_CHARS) : '',
      ...(s.needed !== undefined ? { needed: Boolean(s.needed) } : {}),
      ...(typeof s.fixedPhrase === 'number' ? { fixedPhrase: s.fixedPhrase } : {}),
    })),
  };

  return [
    { role: 'system', content: ALIGN_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload) },
  ];
}

function createDirectorService({ getWorkspacePath, getApiKey, streamChat }) {
  let inFlight = false;

  async function direct({ videoId, duration, clips, notes }) {
    validVideoId(videoId);

    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      throw new Error('Duración no válida.');
    }

    if (!Array.isArray(clips) || clips.length < 1 || clips.length > MAX_CLIPS) {
      throw new Error('Lista de clips no válida.');
    }
    for (const c of clips) {
      if (
        !c ||
        typeof c !== 'object' ||
        !Number.isInteger(c.number) ||
        c.number < 1 ||
        typeof c.start !== 'number' ||
        !Number.isFinite(c.start) ||
        typeof c.end !== 'number' ||
        !Number.isFinite(c.end) ||
        c.start >= c.end ||
        typeof c.text !== 'string' ||
        c.text.length > MAX_CLIP_TEXT_CHARS
      ) {
        throw new Error('Lista de clips no válida.');
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
        clips,
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

  async function align({ videoId, phrases, scenes }) {
    validVideoId(videoId);

    if (!Array.isArray(phrases) || phrases.length < 1 || phrases.length > MAX_PHRASES) {
      throw new Error('Lista de frases no válida.');
    }
    for (const p of phrases) {
      if (
        !p ||
        typeof p !== 'object' ||
        typeof p.i !== 'number' ||
        !Number.isInteger(p.i) ||
        typeof p.text !== 'string'
      ) {
        throw new Error('Lista de frases no válida.');
      }
    }

    if (!Array.isArray(scenes) || scenes.length < 1 || scenes.length > MAX_SCENES) {
      throw new Error('Lista de escenas no válida.');
    }
    for (const s of scenes) {
      if (
        !s ||
        typeof s !== 'object' ||
        !Number.isInteger(s.number) ||
        s.number < 1 ||
        typeof s.title !== 'string' ||
        typeof s.prompt !== 'string'
      ) {
        throw new Error('Lista de escenas no válida.');
      }
    }

    const apiKey = getApiKey?.();
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new Error('Configura tu API Key de DeepSeek en Configuración para que la IA edite el video.');
    }

    if (inFlight) throw new Error('Ya hay una edición en curso.');

    inFlight = true;
    try {
      const messages = buildAlignMessages({
        phrases,
        scenes,
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

  return { direct, align, getEdit, saveEdit, busy };
}

function registerDirectorIpc({ ipcMain, service }) {
  ipcMain.handle('editor:direct', (_event, payload = {}) => service.direct(payload));
  ipcMain.handle('editor:align', (_event, payload = {}) => service.align(payload));
  ipcMain.handle('editor:get', (_event, { videoId } = {}) => service.getEdit(videoId));
  ipcMain.handle('editor:save', (_event, { videoId, edl } = {}) => service.saveEdit(videoId, edl));
  ipcMain.handle('editor:busy', () => service.busy());
}

module.exports = {
  buildDirectorMessages,
  buildAlignMessages,
  createDirectorService,
  registerDirectorIpc,
};
