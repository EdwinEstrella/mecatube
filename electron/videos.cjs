// Timeline videos store: one JSON array, written atomically.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ID_PATTERN = /^[\w-]{1,100}$/;
const TITLE_MAX = 120;
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
  if (input.title !== undefined) fields.title = validTitle(input.title);
  if (input.scriptConversationId !== undefined) {
    fields.scriptConversationId = validLink(input.scriptConversationId, 'script conversation id');
  }
  if (input.illustratorConversationId !== undefined) {
    fields.illustratorConversationId = validLink(input.illustratorConversationId, 'illustrator conversation id');
  }
  if (input.ideaNumber !== undefined) fields.ideaNumber = validIdeaNumber(input.ideaNumber);
  if (input.titleEdited !== undefined) {
    if (typeof input.titleEdited !== 'boolean') throw new Error('Indicador titleEdited no válido.');
    fields.titleEdited = input.titleEdited;
  }
  // null clears the edited narration so the text follows the script again
  if (input.narrationText !== undefined) {
    if (input.narrationText !== null && (typeof input.narrationText !== 'string' || input.narrationText.length > NARRATION_MAX)) {
      throw new Error('Texto de narración no válido.');
    }
    fields.narrationText = input.narrationText;
  }
  // null clears the Google Flow project this video's characters are generated in
  if (input.flowProjectUrl !== undefined) {
    if (input.flowProjectUrl !== null && !(typeof input.flowProjectUrl === 'string' && FLOW_PROJECT_URL.test(input.flowProjectUrl))) {
      throw new Error('URL del proyecto de Flow no válida.');
    }
    fields.flowProjectUrl = input.flowProjectUrl;
  }
  return fields;
}

function createVideoStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'videos.json');

  function getWorkspaceTitle() {
    try {
      const wsFile = path.join(dir, 'workspace.json');
      if (fs.existsSync(wsFile)) {
        const data = JSON.parse(fs.readFileSync(wsFile, 'utf8'));
        if (data?.name) return data.name;
      }
    } catch {}
    return DEFAULT_TITLE;
  }

  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return [data[0]];
    } catch {}
    return [];
  }

  function write(videos) {
    const single = Array.isArray(videos) && videos.length > 0 ? [videos[0]] : [];
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(single, null, 2), 'utf8');
    fs.renameSync(temp, file);
  }

  function ensureSingle() {
    let videos = read();
    if (videos.length === 0) {
      const now = Date.now();
      const record = {
        id: crypto.randomUUID(),
        title: getWorkspaceTitle(),
        titleEdited: false,
        ideaNumber: null,
        scriptConversationId: null,
        illustratorConversationId: null,
        flowProjectUrl: null,
        overrides: {},
        createdAt: now,
        updatedAt: now,
      };
      videos = [record];
      write(videos);
    }
    return videos;
  }

  // Exactly 1 single video timeline per workspace
  function list() {
    return ensureSingle();
  }

  function create(input = {}) {
    const fields = validateFields(input ?? {});
    const videos = ensureSingle();
    const video = videos[0];
    Object.assign(video, fields, { updatedAt: Date.now() });
    write(videos);
    return video;
  }

  function update(id, patch) {
    const fields = validateFields(patch);
    if (fields.title !== undefined && fields.titleEdited === undefined) fields.titleEdited = true;
    const videos = ensureSingle();
    const video = videos[0];
    Object.assign(video, fields, { updatedAt: Date.now() });
    write(videos);
    return video;
  }

  function setStage(id, key, value) {
    if (!STAGE_KEYS.includes(key)) throw new Error('Etapa no válida.');
    if (value !== true && value !== false && value !== null) throw new Error('Valor de etapa no válido.');
    const videos = ensureSingle();
    const video = videos[0];
    const overrides = { ...(video.overrides && typeof video.overrides === 'object' ? video.overrides : {}) };
    if (value === null) delete overrides[key];
    else overrides[key] = value;
    video.overrides = overrides;
    video.updatedAt = Date.now();
    write(videos);
    return video;
  }

  function remove(id) {
    const now = Date.now();
    const reset = {
      id: crypto.randomUUID(),
      title: getWorkspaceTitle(),
      titleEdited: false,
      ideaNumber: null,
      scriptConversationId: null,
      illustratorConversationId: null,
      flowProjectUrl: null,
      overrides: {},
      createdAt: now,
      updatedAt: now,
    };
    write([reset]);
  }

  return { list, create, update, setStage, delete: remove };
}

module.exports = { createVideoStore, STAGE_KEYS, FLOW_PROJECT_URL };
