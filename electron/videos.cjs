// Timeline videos store: one JSON array, written atomically.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ID_PATTERN = /^[\w-]{1,100}$/;
const TITLE_MAX = 120;
const NARRATION_MAX = 200000;
const DEFAULT_TITLE = 'Untitled video';
const FLOW_PROJECT_URL = /^https:\/\/flow\.google\.com\/project\/[0-9a-f-]{36}$/;
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
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new Error(`Invalid ${label}.`);
  return value;
}

function validTitle(value) {
  if (typeof value !== 'string') throw new Error('Invalid video title.');
  const title = value.trim();
  if (!title) throw new Error('Video title is required.');
  if (title.length > TITLE_MAX) throw new Error('Video title is too long.');
  return title;
}

function validLink(value, label) {
  return value === null ? null : validId(value, label);
}

function validIdeaNumber(value) {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 999) throw new Error('Invalid idea number.');
  return value;
}

// Validates only the fields present in `input`; absent fields are left out of the result
function validateFields(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid video.');
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
    if (typeof input.titleEdited !== 'boolean') throw new Error('Invalid titleEdited flag.');
    fields.titleEdited = input.titleEdited;
  }
  // null clears the edited narration so the text follows the script again
  if (input.narrationText !== undefined) {
    if (input.narrationText !== null && (typeof input.narrationText !== 'string' || input.narrationText.length > NARRATION_MAX)) {
      throw new Error('Invalid narration text.');
    }
    fields.narrationText = input.narrationText;
  }
  // null clears the Google Flow project this video's characters are generated in
  if (input.flowProjectUrl !== undefined) {
    if (input.flowProjectUrl !== null && !(typeof input.flowProjectUrl === 'string' && FLOW_PROJECT_URL.test(input.flowProjectUrl))) {
      throw new Error('Invalid Flow project URL.');
    }
    fields.flowProjectUrl = input.flowProjectUrl;
  }
  return fields;
}

function createVideoStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'videos.json');

  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function write(videos) {
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(videos, null, 2), 'utf8');
    fs.renameSync(temp, file);
  }

  // Most recently updated first
  function list() {
    return read().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // `titleEdited` records whether the user chose the title; an idea title never overwrites it
  function create(input = {}) {
    const fields = validateFields(input ?? {});
    const now = Date.now();
    const record = {
      id: crypto.randomUUID(),
      title: fields.title ?? DEFAULT_TITLE,
      titleEdited: fields.titleEdited ?? false,
      ideaNumber: fields.ideaNumber ?? null,
      scriptConversationId: fields.scriptConversationId ?? null,
      illustratorConversationId: fields.illustratorConversationId ?? null,
      flowProjectUrl: fields.flowProjectUrl ?? null,
      overrides: {},
      createdAt: now,
      updatedAt: now,
    };
    const videos = read();
    videos.push(record);
    write(videos);
    return record;
  }

  // A title in the patch counts as a user edit unless the caller says titleEdited: false
  function update(id, patch) {
    validId(id, 'video id');
    const fields = validateFields(patch);
    if (fields.title !== undefined && fields.titleEdited === undefined) fields.titleEdited = true;
    const videos = read();
    const video = videos.find((item) => item.id === id);
    if (!video) throw new Error('Video not found.');
    Object.assign(video, fields, { updatedAt: Date.now() });
    write(videos);
    return video;
  }

  // value true/false forces the stage; null clears the override so detection decides again
  function setStage(id, key, value) {
    validId(id, 'video id');
    if (!STAGE_KEYS.includes(key)) throw new Error('Invalid stage.');
    if (value !== true && value !== false && value !== null) throw new Error('Invalid stage value.');
    const videos = read();
    const video = videos.find((item) => item.id === id);
    if (!video) throw new Error('Video not found.');
    const overrides = { ...(video.overrides && typeof video.overrides === 'object' ? video.overrides : {}) };
    if (value === null) delete overrides[key];
    else overrides[key] = value;
    video.overrides = overrides;
    video.updatedAt = Date.now();
    write(videos);
    return video;
  }

  function remove(id) {
    validId(id, 'video id');
    const videos = read();
    const kept = videos.filter((video) => video.id !== id);
    if (kept.length !== videos.length) write(kept);
  }

  return { list, create, update, setStage, delete: remove };
}

module.exports = { createVideoStore, STAGE_KEYS, FLOW_PROJECT_URL };
