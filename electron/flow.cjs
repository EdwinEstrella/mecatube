// Google Flow character sheets: per-video storage of the generated images and the job service
// that talks to the browser extension through the bridge.
//
// Layout: <userData>/videos/<videoId>/characters.json
//         <userData>/videos/<videoId>/characters/<characterKey>/<timestamp>-<n>.<ext>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { FLOW_PROJECT_URL } = require('./videos.cjs');

const VIDEO_ID = /^[\w-]{1,100}$/;
const CHARACTER_KEY = /^[a-z0-9-]{1,64}$/;
const IMAGE_FILE = /^\d{10,16}-\d{1,3}\.(webp|png|jpg)$/;
const EXTENSIONS = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
const NAME_MAX = 200;
const ROLE_MAX = 600;
const PROMPT_MAX = 20000;
const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 8;
// Watchdog for one job. The extension's own worst case is about 9 minutes (tab loads, new project,
// a 6 minute generation); this stays just above it so the UI can never remain busy forever.
const JOB_TIMEOUT_MS = 10 * 60 * 1000;
const SUBMIT_METHOD = /^[\w-]{1,40}$/;

function validVideoId(value) {
  if (typeof value !== 'string' || !VIDEO_ID.test(value)) throw new Error('Invalid video id.');
  return value;
}

function validKey(value) {
  if (typeof value !== 'string' || !CHARACTER_KEY.test(value)) throw new Error('Invalid character key.');
  return value;
}

function validFile(value) {
  if (typeof value !== 'string' || !IMAGE_FILE.test(value)) throw new Error('Invalid image file.');
  return value;
}

function boundedText(value, max, label) {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}.`);
  if (value.length > max) throw new Error(`The ${label} is too long.`);
  return value;
}

function validProjectUrl(value) {
  if (typeof value !== 'string' || !FLOW_PROJECT_URL.test(value)) throw new Error('Invalid Flow project URL.');
  return value;
}

function writeAtomic(file, data) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
}

function createFlowStore(userDataDir) {
  const videosDir = path.join(userDataDir, 'videos');

  const videoDir = (videoId) => path.join(videosDir, validVideoId(videoId));
  const indexFile = (videoId) => path.join(videoDir(videoId), 'characters.json');

  function readAll(videoId) {
    try {
      const data = JSON.parse(fs.readFileSync(indexFile(videoId), 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error.message === 'Invalid video id.') throw error;
      return [];
    }
  }

  function writeAll(videoId, characters) {
    fs.mkdirSync(videoDir(videoId), { recursive: true });
    writeAtomic(indexFile(videoId), JSON.stringify(characters, null, 2));
  }

  function mutate(videoId, key, change) {
    validKey(key);
    const characters = readAll(videoId);
    const character = characters.find((item) => item.key === key);
    if (!character) throw new Error('Character not found.');
    change(character);
    writeAll(videoId, characters);
    return character;
  }

  const list = (videoId) => readAll(videoId);

  // Creates the character or refreshes its name, role and prompt; generations are kept
  function upsert(videoId, { key, name, role, prompt }) {
    validKey(key);
    const fields = {
      name: boundedText(name, NAME_MAX, 'character name'),
      role: boundedText(role ?? '', ROLE_MAX, 'character role'),
      prompt: boundedText(prompt, PROMPT_MAX, 'character prompt'),
    };
    if (fields.prompt.trim() === '') throw new Error('The character prompt is empty.');
    const characters = readAll(videoId);
    let character = characters.find((item) => item.key === key);
    if (character) {
      Object.assign(character, fields);
    } else {
      character = { key, ...fields, generations: [], selectedFile: null, approved: false };
      characters.push(character);
    }
    writeAll(videoId, characters);
    return character;
  }

  // images: [{ mime, base64 }]. Writes every file, then records one generation; a new generation
  // resets the approval because the user has not seen it yet.
  function addGeneration(videoId, key, { projectUrl = null, images, submitMethod = null }) {
    validKey(key);
    if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
      throw new Error('The generation has no usable images.');
    }
    const decoded = images.map((image) => {
      const extension = EXTENSIONS[image?.mime];
      if (!extension) throw new Error('Unsupported image type.');
      if (typeof image.base64 !== 'string') throw new Error('Invalid image data.');
      const bytes = Buffer.from(image.base64, 'base64');
      if (bytes.length === 0 || bytes.length > IMAGE_MAX_BYTES) throw new Error('Invalid image size.');
      return { extension, bytes };
    });

    const characters = readAll(videoId);
    const character = characters.find((item) => item.key === key);
    if (!character) throw new Error('Character not found.');

    const at = Date.now();
    const dir = path.join(videoDir(videoId), 'characters', key);
    fs.mkdirSync(dir, { recursive: true });
    const files = decoded.map(({ extension, bytes }, index) => {
      const name = `${at}-${index + 1}.${extension}`;
      writeAtomic(path.join(dir, name), bytes);
      return name;
    });

    character.generations.push({
      id: crypto.randomUUID(),
      at,
      files,
      projectUrl: projectUrl && FLOW_PROJECT_URL.test(projectUrl) ? projectUrl : null,
      // Which submit method made Flow start (click / pointer-sequence / enter-key); diagnostics only
      submitMethod: typeof submitMethod === 'string' && SUBMIT_METHOD.test(submitMethod) ? submitMethod : null,
    });
    character.approved = false;
    writeAll(videoId, characters);
    return character;
  }

  function select(videoId, key, file) {
    validFile(file);
    return mutate(videoId, key, (character) => {
      if (!character.generations.some((generation) => generation.files.includes(file))) {
        throw new Error('That image does not belong to this character.');
      }
      character.selectedFile = file;
      character.approved = false;
    });
  }

  // Marks the given characters (default: all) approved or not; approving needs a selected image
  function setApproved(videoId, keys, approved) {
    if (typeof approved !== 'boolean') throw new Error('Invalid approval value.');
    const characters = readAll(videoId);
    const wanted = keys === undefined ? null : new Set(keys.map(validKey));
    characters.forEach((character) => {
      if (wanted && !wanted.has(character.key)) return;
      if (approved && !character.selectedFile) throw new Error('Select an image for every character first.');
      character.approved = approved;
    });
    writeAll(videoId, characters);
    return characters;
  }

  // Absolute path of one stored image, or throws when any part is invalid or the file is missing
  function filePath(videoId, key, file) {
    validKey(key);
    validFile(file);
    const base = path.join(videoDir(videoId), 'characters', key);
    const full = path.join(base, file);
    if (path.dirname(full) !== base) throw new Error('Invalid image path.');
    if (!fs.statSync(full).isFile()) throw new Error('Image not found.');
    return full;
  }

  return { list, upsert, addGeneration, select, setApproved, filePath };
}

// bridge: createBridge(); videos: video store; pushToWindow(channel, payload)
function createFlowService({ bridge, store, videos, pushToWindow, jobTimeoutMs = JOB_TIMEOUT_MS }) {
  // The one job in flight: { requestId, videoId, characterKey, timer }
  let job = null;

  const findVideo = (videoId) => videos.list().find((video) => video.id === videoId);

  function finishJob() {
    if (job) clearTimeout(job.timer);
    job = null;
  }

  function failJob(message) {
    if (!job) return;
    const { videoId, characterKey } = job;
    finishJob();
    pushToWindow('flow:error', { videoId, characterKey, message });
  }

  function rememberProject(videoId, projectUrl) {
    if (typeof projectUrl !== 'string' || !FLOW_PROJECT_URL.test(projectUrl)) return;
    if (findVideo(videoId)?.flowProjectUrl === projectUrl) return;
    videos.update(videoId, { flowProjectUrl: projectUrl });
  }

  function handleBridgeMessage(message) {
    if (!job || message.requestId !== job.requestId) return;
    const { videoId, characterKey } = job;

    if (message.type === 'flow-project') {
      try {
        rememberProject(videoId, message.projectUrl);
      } catch (error) {
        failJob(error.message);
        return;
      }
      pushToWindow('flow:progress', { videoId, characterKey, stage: 'project', percent: null });
    } else if (message.type === 'flow-progress') {
      const percent = Number.isFinite(message.percent) ? Math.max(0, Math.min(100, message.percent)) : null;
      pushToWindow('flow:progress', { videoId, characterKey, stage: 'generating', percent });
    } else if (message.type === 'flow-captcha') {
      pushToWindow('flow:captcha', { videoId, characterKey, active: message.active !== false });
    } else if (message.type === 'flow-result') {
      try {
        const character = store.addGeneration(videoId, characterKey, {
          projectUrl: message.projectUrl,
          images: message.images,
          submitMethod: message.submitMethod,
        });
        try {
          rememberProject(videoId, message.projectUrl);
        } catch {
          // The images are already stored; the project link is a convenience
        }
        finishJob();
        pushToWindow('flow:result', { videoId, characterKey, character });
      } catch (error) {
        failJob(error.message);
      }
    } else if (message.type === 'flow-error') {
      failJob(String(message.message ?? 'Flow reported an error.'));
    }
  }

  function generate({ videoId, characterKey, name, role, prompt }) {
    validVideoId(videoId);
    validKey(characterKey);
    const video = findVideo(videoId);
    if (!video) throw new Error('Video not found.');
    if (job) throw new Error('Another Flow generation is already running.');
    if (!bridge.isConnected()) throw new Error('The browser extension is not connected.');

    store.upsert(videoId, { key: characterKey, name, role, prompt });
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => failJob('Flow tardó demasiado en responder. Revisa la pestaña de Flow e inténtalo de nuevo.'), jobTimeoutMs);
    timer.unref?.();
    job = { requestId, videoId, characterKey, timer };
    try {
      // The prompt travels exactly as stored
      bridge.sendFlowJob({ requestId, prompt, projectUrl: video.flowProjectUrl ?? null });
    } catch (error) {
      finishJob();
      throw error;
    }
    return { requestId };
  }

  const status = () => (job ? { busy: true, videoId: job.videoId, characterKey: job.characterKey } : { busy: false });

  function setProject(videoId, url) {
    validVideoId(videoId);
    if (!findVideo(videoId)) throw new Error('Video not found.');
    const next = url === null || url === undefined || String(url).trim() === '' ? null : validProjectUrl(String(url).trim());
    return videos.update(videoId, { flowProjectUrl: next });
  }

  function projectUrl(videoId) {
    validVideoId(videoId);
    const url = findVideo(videoId)?.flowProjectUrl;
    if (!url) throw new Error('This video has no Flow project yet.');
    return validProjectUrl(url);
  }

  bridge.onMessage(handleBridgeMessage);
  bridge.onStatusChange((connected) => {
    if (!connected) failJob('The browser extension disconnected.');
  });

  return { generate, status, setProject, projectUrl, handleBridgeMessage, store };
}

function registerFlowIpc({ ipcMain, shell, service }) {
  const { store } = service;
  ipcMain.handle('flow:generate', (_event, payload = {}) => service.generate(payload));
  ipcMain.handle('flow:status', () => service.status());
  ipcMain.handle('flow:characters', (_event, { videoId } = {}) => store.list(videoId));
  ipcMain.handle('flow:select', (_event, { videoId, characterKey, file } = {}) => store.select(videoId, characterKey, file));
  ipcMain.handle('flow:approve', (_event, { videoId, keys, approved } = {}) => store.setApproved(videoId, keys, approved));
  ipcMain.handle('flow:set-project', (_event, { videoId, url } = {}) => service.setProject(videoId, url));
  ipcMain.handle('flow:open-project', async (_event, { videoId } = {}) => {
    await shell.openExternal(service.projectUrl(videoId));
  });
}

module.exports = { createFlowStore, createFlowService, registerFlowIpc, CHARACTER_KEY };
