// Timeline videos store: JSON array of videos, written atomically.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { VOICE_MODES } = require('./branches.cjs');

const ID_PATTERN = /^[\w-]{1,100}$/;
const TITLE_MAX = 120;
const BRIEF_MAX = 8000;
const NARRATION_MAX = 200000;
const DEFAULT_TITLE = 'Video sin título';
// Accounts other than the default one carry a "/u/<n>/" prefix
const FLOW_PROJECT_URL = /^https:\/\/flow\.google\.com\/(?:u\/\d+\/)?project\/[0-9a-f-]{36}$/;
// Must match the stage keys in src/timeline/stages.js
const STAGE_KEYS = [
  'idea',
  'script',
  'metadata',
  'voice',
  'characters',
  'images',
  'animations',
  'thumbnail',
  'editing',
  'published',
];

function validId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new Error(`${label} no válido.`);
  return value;
}

function validTitle(value) {
  if (typeof value !== 'string') throw new Error('Título de video no válido.');
  const title = value.trim();
  if (!title) throw new Error('El título del video es obligatorio.');
  if (title.length > TITLE_MAX) throw new Error('El título del video es demasiado largo.');
  return title;
}

function validLink(value, label) {
  return value === null ? null : validId(value, label);
}

function validIdeaNumber(value) {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 999) throw new Error('Número de idea no válido.');
  return value;
}

// Validates only the fields present in `input`; absent fields are left out of the result
function validateFields(input) {
  if (!input || typeof input !== 'object') throw new Error('Video no válido.');
  const fields = {};
  if (input.branchId !== undefined) {
    fields.branchId = validId(input.branchId, 'ID de rama');
  }
  if (input.title !== undefined) fields.title = validTitle(input.title);
  if (input.brief !== undefined) {
    if (input.brief !== null && (typeof input.brief !== 'string' || input.brief.length > BRIEF_MAX)) {
      throw new Error('Brief de video no válido.');
    }
    fields.brief = input.brief;
  }
  if (input.scriptConversationId !== undefined) {
    fields.scriptConversationId = validLink(input.scriptConversationId, 'script conversation id');
  }
  if (input.illustratorConversationId !== undefined) {
    fields.illustratorConversationId = validLink(input.illustratorConversationId, 'illustrator conversation id');
  }
  if (input.ideaNumber !== undefined) fields.ideaNumber = validIdeaNumber(input.ideaNumber);
  if (input.voiceMode !== undefined) {
    if (input.voiceMode !== null && (typeof input.voiceMode !== 'string' || !VOICE_MODES.includes(input.voiceMode))) {
      throw new Error('Modo de voz no válido.');
    }
    fields.voiceMode = input.voiceMode;
  }
  if (input.titleEdited !== undefined) {
    if (typeof input.titleEdited !== 'boolean') throw new Error('Indicador titleEdited no válido.');
    fields.titleEdited = input.titleEdited;
  }
  // null clears the edited narration so the text follows the script again
  if (input.narrationText !== undefined) {
    if (
      input.narrationText !== null &&
      (typeof input.narrationText !== 'string' || input.narrationText.length > NARRATION_MAX)
    ) {
      throw new Error('Texto de narración no válido.');
    }
    fields.narrationText = input.narrationText;
  }
  // null clears the Google Flow project this video's characters are generated in
  if (input.flowProjectUrl !== undefined) {
    if (
      input.flowProjectUrl !== null &&
      !(typeof input.flowProjectUrl === 'string' && FLOW_PROJECT_URL.test(input.flowProjectUrl))
    ) {
      throw new Error('URL del proyecto de Flow no válida.');
    }
    fields.flowProjectUrl = input.flowProjectUrl;
  }
  return fields;
}

function writeAtomicJson(filePath, data) {
  const temp = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, filePath);
}

function createVideoStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'videos.json');
  const activeFile = path.join(dir, 'active-video.json');

  function read() {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) return data;
      }
    } catch {}
    return [];
  }

  function write(videos) {
    writeAtomicJson(file, Array.isArray(videos) ? videos : []);
  }

  function readActiveId() {
    try {
      if (fs.existsSync(activeFile)) {
        const raw = fs.readFileSync(activeFile, 'utf8');
        const data = JSON.parse(raw);
        if (data && typeof data.videoId === 'string') return data.videoId;
      }
    } catch {}
    return null;
  }

  function writeActivePointer(videoId) {
    if (videoId) {
      writeAtomicJson(activeFile, { videoId });
    } else {
      try {
        if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
      } catch {}
    }
  }

  function list(branchId) {
    const videos = read();
    const filtered = branchId ? videos.filter((v) => v.branchId === branchId) : videos;
    return filtered.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  function get(id) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
    return read().find((v) => v.id === id) || null;
  }

  function getActive() {
    const activeId = readActiveId();
    if (activeId) {
      const video = get(activeId);
      if (video) return video;
    }
    const all = list();
    if (all.length === 0) return null;
    return all.reduce((latest, v) => ((v.createdAt || 0) >= (latest.createdAt || 0) ? v : latest), all[0]);
  }

  function setActive(id) {
    validId(id, 'ID de video');
    const video = get(id);
    if (!video) throw new Error('Video no encontrado.');
    writeActivePointer(video.id);
    return video;
  }

  function create(input = {}) {
    if (!input || !input.branchId) {
      throw new Error('El ID de rama es obligatorio.');
    }
    const branchId = validId(input.branchId, 'ID de rama');
    const fields = validateFields(input);
    const now = Date.now();
    const record = {
      id: crypto.randomUUID(),
      branchId,
      title: fields.title ?? DEFAULT_TITLE,
      titleEdited: fields.titleEdited ?? false,
      voiceMode: fields.voiceMode ?? null,
      ideaNumber: fields.ideaNumber ?? null,
      scriptConversationId: fields.scriptConversationId ?? null,
      illustratorConversationId: fields.illustratorConversationId ?? null,
      flowProjectUrl: fields.flowProjectUrl ?? null,
      narrationText: fields.narrationText ?? null,
      brief: fields.brief ?? null,
      overrides: {},
      createdAt: now,
      updatedAt: now,
    };
    const videos = read();
    videos.push(record);
    write(videos);
    writeActivePointer(record.id);
    return record;
  }

  function update(id, patch) {
    validId(id, 'ID de video');
    const fields = validateFields(patch);
    if (fields.title !== undefined && fields.titleEdited === undefined) fields.titleEdited = true;
    const videos = read();
    const video = videos.find((v) => v.id === id);
    if (!video) throw new Error('Video no encontrado.');
    Object.assign(video, fields, { updatedAt: Date.now() });
    write(videos);
    return video;
  }

  function setStage(id, key, value) {
    validId(id, 'ID de video');
    if (!STAGE_KEYS.includes(key)) throw new Error('Etapa no válida.');
    if (value !== true && value !== false && value !== null) throw new Error('Valor de etapa no válido.');
    const videos = read();
    const video = videos.find((v) => v.id === id);
    if (!video) throw new Error('Video no encontrado.');
    const overrides = { ...(video.overrides && typeof video.overrides === 'object' ? video.overrides : {}) };
    if (value === null) delete overrides[key];
    else overrides[key] = value;
    video.overrides = overrides;
    video.updatedAt = Date.now();
    write(videos);
    return video;
  }

  function remove(id) {
    validId(id, 'ID de video');
    const videos = read();
    const index = videos.findIndex((v) => v.id === id);
    if (index === -1) throw new Error('Video no encontrado.');
    videos.splice(index, 1);
    write(videos);
    if (readActiveId() === id) {
      writeActivePointer(null);
    }
  }

  return { list, get, getActive, setActive, create, update, setStage, delete: remove };
}

module.exports = {
  createVideoStore,
  VOICE_MODES,
  STAGE_KEYS,
  FLOW_PROJECT_URL,
  validateFields,
  DEFAULT_TITLE,
  BRIEF_MAX,
};
