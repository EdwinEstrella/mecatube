// Google Flow character sheets: per-video storage of the generated images and the job service
// that talks to the browser extension through the bridge.
//
// Layout: <userData>/videos/<videoId>/characters.json
//         <userData>/videos/<videoId>/characters/<characterKey>/<timestamp>-<n>.<ext>
//         <userData>/videos/<videoId>/scenes.json
//         <userData>/videos/<videoId>/scenes/<sceneNumber>/<timestamp>-<n>.<ext>
//         <userData>/videos/<videoId>/animations.json
//         <userData>/videos/<videoId>/animations/<number>/<timestamp>-<n>.<mp4|webm|mov>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { FLOW_PROJECT_URL } = require('./videos.cjs');

const VIDEO_ID = /^[\w-]{1,100}$/;
const CHARACTER_KEY = /^[a-z0-9-]{1,64}$/;
// Flow's "Has alcanzado tu límite de uso. Inténtalo de nuevo más tarde." (relayed by the extension)
const USAGE_LIMIT = /l[ií]mite de uso/i;
const USAGE_LIMIT_STOP = 'Cola detenida: Flow alcanzó tu límite de uso. Inténtalo de nuevo más tarde.';
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
const SCENE_MAX = 9999;
const SCENES_PER_BATCH_MAX = 200;
// Older scene generations are pruned (files included) so a re-rolled scene does not pile up images
const MAX_SCENE_GENERATIONS = 4;
const SHEET_REF = /^\d{1,3}[A-Za-z]?$/;
const REFERENCES_MAX = 6;
// Every Flow request asks for this model and image count; the extension applies them in the page
const FLOW_MODEL = 'nano-banana-pro';
// One image per character sheet and per scene stretches Flow's usage limit; a bad one is regenerated
// from its card. A single-image generation selects itself, so there is nothing to choose
const FLOW_OUTPUTS = 1;
const SCENE_OUTPUTS = 1;
// Animations: the extension sends the generated video(s) as base64. A video generation takes much
// longer than an image one, hence its own watchdog.
const VIDEO_FILE = /^\d{10,16}-\d{1,3}\.(mp4|webm|mov)$/;
const VIDEO_EXTENSIONS = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const VIDEO_MAX_BYTES = 24 * 1024 * 1024;
const MAX_VIDEOS = 4;
const MAX_ANIMATION_GENERATIONS = 3;
const ANIMATIONS_PER_BATCH_MAX = 200;
const ANIMATION_JOB_TIMEOUT_MS = 15 * 60 * 1000;
// Video settings every animate job asks for (Omni 1.1 Flash); the extension applies them in the page
const ANIMATION_VIDEO_SETTINGS = Object.freeze({ model: 'omni-1.1-flash', resolution: '720p', seconds: 8, aspect: '16:9', outputs: 1 });
const ANIMATION_VIDEO_SECONDS = [4, 6, 8, 10];
const validAnimationSeconds = (value) => (ANIMATION_VIDEO_SECONDS.includes(value) ? value : ANIMATION_VIDEO_SETTINGS.seconds);
const MIME_BY_EXTENSION = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };

// Flow asset id inside a result image/video URL: https://flow-content.google/image|video/<uuid>?Expires=... ; null when absent
const FLOW_ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function flowAssetId(url) {
  if (typeof url !== 'string') return null;
  const match = /\/(?:image|video)\/([^/?#]+)/.exec(url);
  return match && FLOW_ASSET_ID.test(match[1]) ? match[1].toLowerCase() : null;
}

function validVideoId(value) {
  if (typeof value !== 'string' || !VIDEO_ID.test(value)) throw new Error('ID de video no válido.');
  return value;
}

function validKey(value) {
  if (typeof value !== 'string' || !CHARACTER_KEY.test(value)) throw new Error('Clave de personaje no válida.');
  return value;
}

function validFile(value) {
  if (typeof value !== 'string' || !IMAGE_FILE.test(value)) throw new Error('Archivo de imagen no válido.');
  return value;
}

function validVideoFile(value) {
  if (typeof value !== 'string' || !VIDEO_FILE.test(value)) throw new Error('Archivo de vídeo no válido.');
  return value;
}

function validScene(value) {
  if (!Number.isInteger(value) || value < 1 || value > SCENE_MAX) throw new Error('Número de escena no válido.');
  return value;
}

function boundedText(value, max, label) {
  if (typeof value !== 'string') throw new Error(`${label} no válido.`);
  if (value.length > max) throw new Error(`El campo ${label} es demasiado largo.`);
  return value;
}

// A URL copied from the address bar may carry a sub-path or query; keep only the project base
function validProjectUrl(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = /^(https:\/\/flow\.google\.com\/(?:u\/\d+\/)?project\/[0-9a-f-]{36})(?:[/?#].*)?$/s.exec(text);
  if (!match || !FLOW_PROJECT_URL.test(match[1])) throw new Error('URL del proyecto de Flow no válida.');
  return match[1];
}

function writeAtomic(file, data) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
}

// images: [{ mime, base64 }] -> [{ extension, bytes }], validated
function decodeImages(images) {
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
    throw new Error('La generación no tiene imágenes utilizables.');
  }
  return images.map((image) => {
    const extension = EXTENSIONS[image?.mime];
    if (!extension) throw new Error('Tipo de imagen no compatible.');
    if (typeof image.base64 !== 'string') throw new Error('Datos de imagen no válidos.');
    const bytes = Buffer.from(image.base64, 'base64');
    if (bytes.length === 0 || bytes.length > IMAGE_MAX_BYTES) throw new Error('Tamaño de imagen no válido.');
    return { extension, bytes, assetId: flowAssetId(image.sourceUrl) };
  });
}

// videos: [{ mime, base64, sourceUrl }] -> [{ extension, bytes, assetId }], validated
function decodeVideos(videos) {
  if (!Array.isArray(videos) || videos.length === 0 || videos.length > MAX_VIDEOS) {
    throw new Error('La animación no tiene vídeos utilizables.');
  }
  return videos.map((video) => {
    const extension = VIDEO_EXTENSIONS[String(video?.mime ?? '').split(';')[0].trim().toLowerCase()];
    if (!extension) throw new Error('Tipo de vídeo no compatible.');
    if (typeof video.base64 !== 'string') throw new Error('Datos de vídeo no válidos.');
    const bytes = Buffer.from(video.base64, 'base64');
    if (bytes.length === 0 || bytes.length > VIDEO_MAX_BYTES) throw new Error('Tamaño de vídeo no válido.');
    return { extension, bytes, assetId: flowAssetId(video.sourceUrl) };
  });
}

// Flow asset ids aligned with the stored files (null when Flow gave no usable URL)
const assetIdsOf = (decoded) => decoded.map(({ assetId }) => assetId);

// Writes the decoded images as <timestamp>-<n>.<ext> and returns the file names
function writeImages(dir, decoded, at) {
  fs.mkdirSync(dir, { recursive: true });
  return decoded.map(({ extension, bytes }, index) => {
    const name = `${at}-${index + 1}.${extension}`;
    writeAtomic(path.join(dir, name), bytes);
    return name;
  });
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
      if (error.message === 'ID de video no válido.') throw error;
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
    if (!character) throw new Error('Personaje no encontrado.');
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
    if (fields.prompt.trim() === '') throw new Error('El prompt del personaje está vacío.');
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
    const decoded = decodeImages(images);

    const characters = readAll(videoId);
    const character = characters.find((item) => item.key === key);
    if (!character) throw new Error('Personaje no encontrado.');

    const at = Date.now();
    const files = writeImages(path.join(videoDir(videoId), 'characters', key), decoded, at);

    character.generations.push({
      id: crypto.randomUUID(),
      at,
      files,
      assetIds: assetIdsOf(decoded),
      projectUrl: projectUrl && FLOW_PROJECT_URL.test(projectUrl) ? projectUrl : null,
      // Which submit method made Flow start (click / pointer-sequence / enter-key); diagnostics only
      submitMethod: typeof submitMethod === 'string' && SUBMIT_METHOD.test(submitMethod) ? submitMethod : null,
    });
    if (files.length === 1) character.selectedFile = files[0];
    character.approved = false;
    writeAll(videoId, characters);
    return character;
  }

  function select(videoId, key, file) {
    validFile(file);
    return mutate(videoId, key, (character) => {
      if (!character.generations.some((generation) => generation.files.includes(file))) {
        throw new Error('Esa imagen no pertenece a este personaje.');
      }
      character.selectedFile = file;
      character.approved = false;
    });
  }

  // Marks the given characters (default: all) approved or not; approving needs a selected image
  function setApproved(videoId, keys, approved) {
    if (typeof approved !== 'boolean') throw new Error('Valor de aprobación no válido.');
    const characters = readAll(videoId);
    const wanted = keys === undefined ? null : new Set(keys.map(validKey));
    characters.forEach((character) => {
      if (wanted && !wanted.has(character.key)) return;
      if (approved && !character.selectedFile) throw new Error('Primero selecciona una imagen para cada personaje.');
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
    if (path.dirname(full) !== base) throw new Error('Ruta de imagen no válida.');
    if (!fs.statSync(full).isFile()) throw new Error('Imagen no encontrada.');
    return full;
  }

  // The selected sheet image of a character as a Flow reference: { name, mime, base64, assetId };
  // assetId is the image's id inside Flow (null for data stored before ids were kept)
  function readReference(videoId, key) {
    const character = readAll(videoId).find((item) => item.key === validKey(key));
    if (!character?.selectedFile) throw new Error('El personaje no tiene una imagen seleccionada.');
    const file = filePath(videoId, key, character.selectedFile);
    const mime = MIME_BY_EXTENSION[character.selectedFile.split('.').pop()];
    const generation = character.generations.find((item) => item.files.includes(character.selectedFile));
    const assetId = generation?.assetIds?.[generation.files.indexOf(character.selectedFile)] ?? null;
    return { name: character.selectedFile, mime, base64: fs.readFileSync(file).toString('base64'), assetId };
  }

  // Scenes: videos/<id>/scenes.json holds [{ number, title, prompt, sheetRefs, generations, selectedFile }]
  const scenesIndexFile = (videoId) => path.join(videoDir(videoId), 'scenes.json');
  const sceneDir = (videoId, number) => path.join(videoDir(videoId), 'scenes', String(validScene(number)));

  function listScenes(videoId) {
    try {
      const data = JSON.parse(fs.readFileSync(scenesIndexFile(videoId), 'utf8'));
      return Array.isArray(data) ? data.map((scene) => ({ ...scene, selectedFile: scene.selectedFile ?? null })) : [];
    } catch (error) {
      if (error.message === 'ID de video no válido.') throw error;
      return [];
    }
  }

  // Marks one stored image as the chosen one of a scene; the file must belong to that scene
  function selectScene(videoId, number, file) {
    validScene(number);
    validFile(file);
    const scenes = listScenes(videoId);
    const scene = scenes.find((item) => item.number === number);
    if (!scene) throw new Error('Escena no encontrada.');
    if (!scene.generations.some((generation) => generation.files.includes(file))) {
      throw new Error('Esa imagen no pertenece a esta escena.');
    }
    scene.selectedFile = file;
    writeAtomic(scenesIndexFile(videoId), JSON.stringify(scenes, null, 2));
    return scene;
  }

  // Records one generation of a scene (creating the scene or refreshing its text) and keeps only the
  // latest MAX_SCENE_GENERATIONS, deleting the files of the older ones
  function addSceneGeneration(videoId, { number, title = '', prompt, sheetRefs = [], projectUrl = null, images, submitMethod = null }) {
    validScene(number);
    const decoded = decodeImages(images);
    const scenes = listScenes(videoId);
    let scene = scenes.find((item) => item.number === number);
    if (!scene) {
      scene = { number, title: '', prompt: '', sheetRefs: [], generations: [], selectedFile: null };
      scenes.push(scene);
      scenes.sort((a, b) => a.number - b.number);
    }
    scene.title = boundedText(title, NAME_MAX, 'scene title');
    scene.prompt = boundedText(prompt, PROMPT_MAX, 'scene prompt');
    scene.sheetRefs = sheetRefs.filter((ref) => SHEET_REF.test(ref));

    const at = Date.now();
    const dir = sceneDir(videoId, number);
    const files = writeImages(dir, decoded, at);
    scene.generations.push({
      id: crypto.randomUUID(),
      at,
      files,
      assetIds: assetIdsOf(decoded),
      projectUrl: projectUrl && FLOW_PROJECT_URL.test(projectUrl) ? projectUrl : null,
      submitMethod: typeof submitMethod === 'string' && SUBMIT_METHOD.test(submitMethod) ? submitMethod : null,
    });
    for (const old of scene.generations.splice(0, Math.max(0, scene.generations.length - MAX_SCENE_GENERATIONS))) {
      for (const file of old.files) fs.rmSync(path.join(dir, file), { force: true });
    }
    // Regenerating replaces the images the user sees: a single image is the choice by itself, several are
    // chosen again among the new ones
    if (files.length === 1) scene.selectedFile = files[0];
    else if (scene.selectedFile && !files.includes(scene.selectedFile)) scene.selectedFile = null;
    fs.mkdirSync(videoDir(videoId), { recursive: true });
    writeAtomic(scenesIndexFile(videoId), JSON.stringify(scenes, null, 2));
    return scene;
  }

  // Absolute path of one stored scene image, or throws when any part is invalid or the file is missing
  function sceneFilePath(videoId, number, file) {
    validFile(file);
    const base = sceneDir(videoId, Number(number));
    const full = path.join(base, file);
    if (path.dirname(full) !== base) throw new Error('Ruta de imagen no válida.');
    if (!fs.statSync(full).isFile()) throw new Error('Imagen no encontrada.');
    return full;
  }

  // Flow asset id of the chosen image of a scene (the source frame of its animation); throws a
  // Spanish message when the scene has no chosen image or the image has no Flow id
  function selectedSceneAssetId(videoId, number) {
    const scene = listScenes(videoId).find((item) => item.number === number);
    const generation = scene?.selectedFile ? scene.generations.find((item) => item.files.includes(scene.selectedFile)) : null;
    const label = String(number).padStart(2, '0');
    if (!generation) throw new Error(`Elige primero la imagen de la escena ${label} en Flow.`);
    const assetId = generation.assetIds?.[generation.files.indexOf(scene.selectedFile)] ?? null;
    if (!assetId) throw new Error(`La imagen elegida de la escena ${label} no tiene identificador de Flow. Vuelve a generarla.`);
    return assetId;
  }

  // Animations: videos/<id>/animations.json holds [{ number, title, prompt, hook, generations }]
  const animationsIndexFile = (videoId) => path.join(videoDir(videoId), 'animations.json');
  const animationDir = (videoId, number) => path.join(videoDir(videoId), 'animations', String(validScene(number)));

  function listAnimations(videoId) {
    try {
      const data = JSON.parse(fs.readFileSync(animationsIndexFile(videoId), 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error.message === 'ID de video no válido.') throw error;
      return [];
    }
  }

  // Records one generation of an animation (creating it or refreshing its text) and keeps only the
  // latest MAX_ANIMATION_GENERATIONS, deleting the files of the older ones
  function addAnimationGeneration(videoId, { number, title = '', prompt, hook = false, sourceAssetId = null, projectUrl = null, videos: clips }) {
    validScene(number);
    const decoded = decodeVideos(clips);
    const animations = listAnimations(videoId);
    let animation = animations.find((item) => item.number === number);
    if (!animation) {
      animation = { number, title: '', prompt: '', hook: false, generations: [] };
      animations.push(animation);
      animations.sort((a, b) => a.number - b.number);
    }
    animation.title = boundedText(title, NAME_MAX, 'animation title');
    animation.prompt = boundedText(prompt, PROMPT_MAX, 'animation prompt');
    animation.hook = hook === true;

    const at = Date.now();
    const dir = animationDir(videoId, number);
    fs.mkdirSync(dir, { recursive: true });
    const files = decoded.map(({ extension, bytes }, index) => {
      const name = `${at}-${index + 1}.${extension}`;
      writeAtomic(path.join(dir, name), bytes);
      return name;
    });
    animation.generations.push({
      id: crypto.randomUUID(),
      at,
      files,
      assetIds: assetIdsOf(decoded),
      sourceAssetId: typeof sourceAssetId === 'string' && FLOW_ASSET_ID.test(sourceAssetId) ? sourceAssetId : null,
      projectUrl: projectUrl && FLOW_PROJECT_URL.test(projectUrl) ? projectUrl : null,
    });
    for (const old of animation.generations.splice(0, Math.max(0, animation.generations.length - MAX_ANIMATION_GENERATIONS))) {
      for (const file of old.files) fs.rmSync(path.join(dir, file), { force: true });
    }
    fs.mkdirSync(videoDir(videoId), { recursive: true });
    writeAtomic(animationsIndexFile(videoId), JSON.stringify(animations, null, 2));
    return animation;
  }

  // Absolute path of one stored animation video, or throws when any part is invalid or the file is missing
  function animationFilePath(videoId, number, file) {
    validVideoFile(file);
    const base = animationDir(videoId, Number(number));
    const full = path.join(base, file);
    if (path.dirname(full) !== base) throw new Error('Ruta de vídeo no válida.');
    if (!fs.statSync(full).isFile()) throw new Error('Vídeo no encontrado.');
    return full;
  }

  return {
    list, upsert, addGeneration, select, setApproved, filePath, readReference,
    listScenes, addSceneGeneration, selectScene, sceneFilePath, selectedSceneAssetId,
    listAnimations, addAnimationGeneration, animationFilePath,
  };
}

// Sheet number a stored character answers to: "Personaje 2 — Ana" (name) or "personaje-2-ana" (key)
function sheetNumber(character) {
  const fromName = /^\s*personaje\s+(\d+)/i.exec(character.name ?? '');
  const fromKey = /^personaje-(\d+)(?:-|$)/.exec(character.key ?? '');
  const match = fromName ?? fromKey;
  return match ? Number(match[1]) : null;
}

// Maps scene sheet labels ("1", "2", "1B") to the characters whose sheet they name. Assumption: the
// number is the "Personaje N" / "Hoja N" of ETAPA 2 (the key is the slug of that title); variants
// of one number ("Personaje 1 — Tomás (adulto)", sheet 1B) are told apart by their order in the
// store: no letter or A is the first, B the second, C the third. Returns [{ ref, character }].
function resolveSheets(characters, refs) {
  return refs.map((ref) => {
    const number = Number(/^\d+/.exec(ref)[0]);
    const letter = /[A-Za-z]$/.exec(ref)?.[0].toUpperCase();
    let candidates = characters.filter((character) => sheetNumber(character) === number);
    // Without "Personaje N" titles fall back to the position in the list
    if (candidates.length === 0 && !letter && characters[number - 1]) candidates = [characters[number - 1]];
    const index = letter ? letter.charCodeAt(0) - 65 : 0;
    return { ref, character: candidates[index] ?? (letter ? undefined : candidates[0]) };
  });
}

// bridge: createBridge(); videos: video store; pushToWindow(channel, payload)
//
// One Flow job runs at a time, shared by character sheets, scenes and animations. Scenes and
// animations go through one serial queue: the next item is sent only after the previous one finished
// (result or error). Character jobs push flow:progress / flow:captcha / flow:result / flow:error;
// scene jobs push only flow:scene-status { videoId, number, state, percent, captcha, error, scene } and
// animation jobs flow:animation-status { ..., animation } with state one of
// queued | running | done | error | cancelled, so the character cards never see their traffic.
function createFlowService({
  bridge,
  store,
  videos,
  pushToWindow,
  jobTimeoutMs = JOB_TIMEOUT_MS,
  animationTimeoutMs = ANIMATION_JOB_TIMEOUT_MS,
}) {
  // The one job in flight: { requestId, videoId, kind: 'character' | 'scene' | 'animation',
  // characterKey?, scene?, animation?, timer }
  let job = null;
  // Items waiting for their turn: [{ type: 'scene' | 'animation', videoId, number, title, prompt, sheetRefs?, hook? }]
  const queue = [];

  const findVideo = (videoId) => videos.list().find((video) => video.id === videoId);

  function sceneStatus(videoId, number, state, extra = {}) {
    pushToWindow('flow:scene-status', { videoId, number, state, percent: null, captcha: false, error: null, ...extra });
  }

  function animationStatus(videoId, number, state, extra = {}) {
    pushToWindow('flow:animation-status', { videoId, number, state, percent: null, captcha: false, error: null, ...extra });
  }

  // Status event of a scene or animation (type 'scene' | 'animation'), on its own channel
  const itemStatus = (type, videoId, number, state, extra) =>
    (type === 'animation' ? animationStatus : sceneStatus)(videoId, number, state, extra);

  function finishJob() {
    if (job) clearTimeout(job.timer);
    job = null;
  }

  function failJob(message) {
    if (!job) return;
    const failed = job;
    finishJob();
    if (failed.kind === 'scene' || failed.kind === 'animation') {
      itemStatus(failed.kind, failed.videoId, (failed.scene ?? failed.animation).number, 'error', { error: message });
      // Flow's usage limit fails every following request too: stop the queue instead of burning through it
      if (USAGE_LIMIT.test(message)) dropQueue('error', USAGE_LIMIT_STOP);
      pump();
    } else {
      pushToWindow('flow:error', { videoId: failed.videoId, characterKey: failed.characterKey, message });
    }
  }

  // Empties the waiting queue (only one type when given), telling the UI why each item will not run
  function dropQueue(state, error = null, type = null) {
    const dropped = [];
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (!type || queue[index].type === type) dropped.unshift(...queue.splice(index, 1));
    }
    for (const item of dropped) itemStatus(item.type, item.videoId, item.number, state, { error });
    return dropped.length;
  }

  function rememberProject(videoId, projectUrl) {
    if (typeof projectUrl !== 'string' || !FLOW_PROJECT_URL.test(projectUrl)) return;
    if (findVideo(videoId)?.flowProjectUrl === projectUrl) return;
    videos.update(videoId, { flowProjectUrl: projectUrl });
  }

  function startTimer(timeoutMs = jobTimeoutMs) {
    const timer = setTimeout(() => failJob('Flow tardó demasiado en responder. Revisa la pestaña de Flow e inténtalo de nuevo.'), timeoutMs);
    timer.unref?.();
    return timer;
  }

  function handleBridgeMessage(message) {
    if (!job || message.requestId !== job.requestId) return;
    const { videoId, characterKey, kind } = job;
    const number = (job.scene ?? job.animation)?.number;
    const queued = kind === 'scene' || kind === 'animation';

    if (message.type === 'flow-project') {
      try {
        rememberProject(videoId, message.projectUrl);
      } catch (error) {
        failJob(error.message);
        return;
      }
      if (queued) itemStatus(kind, videoId, number, 'running');
      else pushToWindow('flow:progress', { videoId, characterKey, stage: 'project', percent: null });
    } else if (message.type === 'flow-progress') {
      const percent = Number.isFinite(message.percent) ? Math.max(0, Math.min(100, message.percent)) : null;
      if (queued) itemStatus(kind, videoId, number, 'running', { percent });
      else pushToWindow('flow:progress', { videoId, characterKey, stage: 'generating', percent });
    } else if (message.type === 'flow-captcha') {
      const active = message.active !== false;
      if (queued) itemStatus(kind, videoId, number, 'running', { captcha: active });
      else pushToWindow('flow:captcha', { videoId, characterKey, active });
    } else if (message.type === 'flow-result') {
      try {
        if (kind === 'animation') {
          const animation = store.addAnimationGeneration(videoId, {
            ...job.animation,
            projectUrl: message.projectUrl,
            videos: message.videos,
          });
          try {
            rememberProject(videoId, message.projectUrl);
          } catch {
            // The videos are already stored; the project link is a convenience
          }
          finishJob();
          animationStatus(videoId, number, 'done', { percent: 100, animation });
          pump();
          return;
        }
        if (kind === 'scene') {
          const scene = store.addSceneGeneration(videoId, {
            ...job.scene,
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
          sceneStatus(videoId, number, 'done', { percent: 100, scene });
          pump();
          return;
        }
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
      failJob(String(message.message ?? 'Flow informó de un error.'));
    }
  }

  function generate({ videoId, characterKey, name, role, prompt }) {
    validVideoId(videoId);
    validKey(characterKey);
    const video = findVideo(videoId);
    if (!video) throw new Error('Video no encontrado.');
    if ((job && job.kind !== 'character') || queue.length > 0) throw new Error('La cola de escenas y animaciones está en curso. Espera a que termine o detenla.');
    if (job) throw new Error('Ya hay otra generación de Flow en curso.');
    if (!bridge.isConnected()) throw new Error('La extensión del navegador no está conectada.');

    store.upsert(videoId, { key: characterKey, name, role, prompt });
    const requestId = crypto.randomUUID();
    job = { requestId, videoId, kind: 'character', characterKey, timer: startTimer() };
    try {
      // The prompt travels exactly as stored
      bridge.sendFlowJob({ requestId, prompt, projectUrl: video.flowProjectUrl ?? null, model: FLOW_MODEL, outputs: FLOW_OUTPUTS, references: [] });
    } catch (error) {
      finishJob();
      throw error;
    }
    return { requestId };
  }

  // Reference images of a scene: the selected image of every character its sheet labels name
  function referencesFor(item) {
    if (item.sheetRefs.length === 0) return [];
    // Only the characters of the chat's current sheets: leftovers of another chat or of a renamed
    // sheet answer to the same "Personaje N" and would be picked instead of the approved one
    const all = store.list(item.videoId);
    const keys = item.characterKeys ?? [];
    const characters = keys.length > 0 ? all.filter((character) => keys.includes(character.key)) : all;
    const references = [];
    const seen = new Set();
    for (const { ref, character } of resolveSheets(characters, item.sheetRefs)) {
      if (!character) throw new Error(`No encuentro el personaje de la hoja ${ref}. Genera y aprueba primero las hojas de personaje.`);
      if (!character.selectedFile) throw new Error(`La hoja ${ref} (${character.name}) aún no tiene una imagen seleccionada.`);
      if (seen.has(character.key)) continue;
      seen.add(character.key);
      references.push(store.readReference(item.videoId, character.key));
    }
    return references;
  }

  // Sends the next waiting scene when nothing is in flight; a scene that cannot start fails alone
  function pump() {
    while (!job && queue.length > 0) {
      const item = queue.shift();
      const video = findVideo(item.videoId);
      const requestId = crypto.randomUUID();
      if (item.type === 'animation') {
        try {
          if (!video) throw new Error('Video no encontrado.');
          // The scene's chosen image is the start frame; without it only this animation fails
          const sourceAssetId = store.selectedSceneAssetId(item.videoId, item.number);
          job = { requestId, videoId: item.videoId, kind: 'animation', animation: { ...item, sourceAssetId }, timer: startTimer(animationTimeoutMs) };
          animationStatus(item.videoId, item.number, 'running');
          bridge.sendFlowJob({
            requestId,
            kind: 'animate',
            prompt: item.prompt,
            projectUrl: video.flowProjectUrl ?? null,
            sourceAssetId,
            video: { ...ANIMATION_VIDEO_SETTINGS, seconds: item.seconds ?? ANIMATION_VIDEO_SETTINGS.seconds },
          });
        } catch (error) {
          finishJob();
          animationStatus(item.videoId, item.number, 'error', { error: error.message });
        }
        continue;
      }
      try {
        if (!video) throw new Error('Video no encontrado.');
        const references = referencesFor(item);
        job = { requestId, videoId: item.videoId, kind: 'scene', scene: item, timer: startTimer() };
        sceneStatus(item.videoId, item.number, 'running');
        bridge.sendFlowJob({
          requestId,
          prompt: references.length > 0 ? scenePromptForFlow(item.prompt, item.sheetRefs) : item.prompt,
          projectUrl: video.flowProjectUrl ?? null,
          model: FLOW_MODEL,
          outputs: SCENE_OUTPUTS,
          references,
        });
      } catch (error) {
        finishJob();
        sceneStatus(item.videoId, item.number, 'error', { error: error.message });
      }
    }
  }

  // scenes: [{ number, title, prompt, sheetRefs }]; queued in the given order, one Flow job at a time
  // characterKeys: keys of the characters in the chat's latest sheet message (optional)
  function generateScenes({ videoId, scenes, characterKeys = [] } = {}) {
    validVideoId(videoId);
    if (!findVideo(videoId)) throw new Error('Video no encontrado.');
    if (!Array.isArray(scenes) || scenes.length === 0 || scenes.length > SCENES_PER_BATCH_MAX) throw new Error('Lista de escenas no válida.');
    if (!Array.isArray(characterKeys) || characterKeys.length > 50 || !characterKeys.every((key) => typeof key === 'string' && CHARACTER_KEY.test(key))) {
      throw new Error('Lista de personajes no válida.');
    }
    if (job?.kind === 'character') throw new Error('Hay una generación de personaje en curso. Espera a que termine.');
    if (!bridge.isConnected()) throw new Error('La extensión del navegador no está conectada.');

    const items = scenes.map((scene) => {
      const sheetRefs = Array.isArray(scene?.sheetRefs) ? scene.sheetRefs : [];
      if (sheetRefs.length > REFERENCES_MAX || !sheetRefs.every((ref) => SHEET_REF.test(ref))) throw new Error('Referencias de hoja no válidas.');
      const prompt = boundedText(scene?.prompt, PROMPT_MAX, 'scene prompt');
      if (prompt.trim() === '') throw new Error('El prompt de la escena está vacío.');
      return {
        type: 'scene',
        videoId,
        number: validScene(scene?.number),
        title: boundedText(scene?.title ?? '', NAME_MAX, 'scene title'),
        prompt,
        sheetRefs,
        characterKeys,
      };
    });

    const added = enqueue(videoId, items);
    return { queued: added };
  }

  // Adds items to the shared queue unless the same scene/animation is already running or waiting
  function enqueue(videoId, items) {
    let added = 0;
    for (const item of items) {
      const running = job?.kind === item.type ? job[item.type] : null;
      const busy = (running && job.videoId === videoId && running.number === item.number)
        || queue.some((waiting) => waiting.type === item.type && waiting.videoId === videoId && waiting.number === item.number);
      if (busy) continue;
      queue.push(item);
      added += 1;
      itemStatus(item.type, videoId, item.number, 'queued');
    }
    pump();
    return added;
  }

  // animations: [{ number, title, prompt, hook }]; the source image of each is the chosen image of the
  // scene with the same number. Shares the serial queue with scenes.
  function generateAnimations({ videoId, animations } = {}) {
    validVideoId(videoId);
    if (!findVideo(videoId)) throw new Error('Video no encontrado.');
    if (!Array.isArray(animations) || animations.length === 0 || animations.length > ANIMATIONS_PER_BATCH_MAX) {
      throw new Error('Lista de animaciones no válida.');
    }
    if (job?.kind === 'character') throw new Error('Hay una generación de personaje en curso. Espera a que termine.');
    if (!bridge.isConnected()) throw new Error('La extensión del navegador no está conectada.');

    const items = animations.map((animation) => {
      const prompt = boundedText(animation?.prompt, PROMPT_MAX, 'animation prompt');
      if (prompt.trim() === '') throw new Error('El prompt de la animación está vacío.');
      return {
        type: 'animation',
        videoId,
        number: validScene(animation?.number),
        title: boundedText(animation?.title ?? '', NAME_MAX, 'animation title'),
        prompt,
        hook: animation?.hook === true,
        seconds: validAnimationSeconds(animation?.seconds),
      };
    });
    return { queued: enqueue(videoId, items) };
  }

  // Drops every waiting scene; the one already in Flow cannot be recalled and finishes normally
  function cancelScenes() {
    return { cancelled: dropQueue('cancelled', null, 'scene') };
  }

  // Same for the waiting animations
  function cancelAnimations() {
    return { cancelled: dropQueue('cancelled', null, 'animation') };
  }

  const pendingOf = (type) => queue.filter((item) => item.type === type).length;
  const status = () => ({
    ...(job?.kind === 'character' ? { busy: true, videoId: job.videoId, characterKey: job.characterKey } : { busy: false }),
    scenes: { busy: job?.kind === 'scene' || pendingOf('scene') > 0, running: job?.kind === 'scene' ? job.scene.number : null, pending: pendingOf('scene') },
    animations: {
      busy: job?.kind === 'animation' || pendingOf('animation') > 0,
      running: job?.kind === 'animation' ? job.animation.number : null,
      pending: pendingOf('animation'),
    },
  });

  // True while a character or scene job for this video is running or queued
  const isVideoBusy = (videoId) =>
    job?.videoId === videoId || queue.some((item) => item.videoId === videoId);

  function setProject(videoId, url) {
    validVideoId(videoId);
    if (!findVideo(videoId)) throw new Error('Video no encontrado.');
    const next = url === null || url === undefined || String(url).trim() === '' ? null : validProjectUrl(String(url).trim());
    return videos.update(videoId, { flowProjectUrl: next });
  }

  function projectUrl(videoId) {
    validVideoId(videoId);
    const url = findVideo(videoId)?.flowProjectUrl;
    if (!url) throw new Error('Este video aún no tiene un proyecto de Flow.');
    return validProjectUrl(url);
  }

  bridge.onMessage(handleBridgeMessage);
  bridge.onStatusChange((connected) => {
    if (connected) return;
    dropQueue('error', 'La extensión del navegador se desconectó.');
    failJob('La extensión del navegador se desconectó.');
  });

  return { generate, generateScenes, cancelScenes, generateAnimations, cancelAnimations, status, isVideoBusy, setProject, projectUrl, handleBridgeMessage, store };
}

function registerFlowIpc({ ipcMain, shell, service }) {
  const { store } = service;
  ipcMain.handle('flow:generate', (_event, payload = {}) => service.generate(payload));
  ipcMain.handle('flow:status', () => service.status());
  ipcMain.handle('flow:characters', (_event, { videoId } = {}) => store.list(videoId));
  ipcMain.handle('flow:select', (_event, { videoId, characterKey, file } = {}) => store.select(videoId, characterKey, file));
  ipcMain.handle('flow:approve', (_event, { videoId, keys, approved } = {}) => store.setApproved(videoId, keys, approved));
  ipcMain.handle('flow:scenes', (_event, { videoId } = {}) => store.listScenes(videoId));
  ipcMain.handle('flow:scene-select', (_event, { videoId, number, file } = {}) => store.selectScene(videoId, number, file));
  ipcMain.handle('flow:scenes-generate', (_event, payload = {}) => service.generateScenes(payload));
  ipcMain.handle('flow:scenes-cancel', () => service.cancelScenes());
  ipcMain.handle('flow:animations', (_event, { videoId } = {}) => store.listAnimations(videoId));
  ipcMain.handle('flow:animations-generate', (_event, payload = {}) => service.generateAnimations(payload));
  ipcMain.handle('flow:animations-cancel', () => service.cancelAnimations());
  ipcMain.handle('flow:set-project', (_event, { videoId, url } = {}) => service.setProject(videoId, url));
  ipcMain.handle('flow:open-project', async (_event, { videoId } = {}) => {
    await shell.openExternal(service.projectUrl(videoId));
  });
}

// The illustrator prompt says "the character from character sheet 1" and "must match its character
// sheet reference". With the sheet attached, Nano Banana reads that as "draw a character sheet" and
// copies the turnaround poses and expression row. Only the text sent to Flow changes: sheet mentions
// point at the attached reference image(s) and a guard keeps the scene a single composition. The
// character description (FICHA) stays word for word, so the character keeps its identity.
const REFERENCE_GUARD =
  'Use the attached reference image only for the character design (head, face, hair, clothing, colors, accessories, prop). ' +
  'Draw one single scene. Do not reproduce the reference layout: no turnaround views, no pose grid, no expression row, ' +
  'no multiple copies of the same character, no white sheet background unless the scene asks for it.';

function scenePromptForFlow(prompt, sheetRefs = []) {
  const text = String(prompt ?? '');
  const order = [];
  for (const ref of sheetRefs) {
    const key = String(ref).toUpperCase();
    if (!order.includes(key)) order.push(key);
  }
  if (order.length === 0) return text;
  const single = order.length === 1;
  const imageFor = (ref) => {
    const index = order.indexOf(String(ref).toUpperCase());
    return single || index === -1 ? 'the attached reference image' : `attached reference image ${index + 1}`;
  };
  const rewritten = text
    .replace(
      /\b(the\s+)?character\s+from\s+(?:the\s+)?character\s+sheet\s+(\d+[A-Z]?)\b/gi,
      (_, the = '', ref) => `${the}character shown in ${imageFor(ref)}`,
    )
    .replace(/\bcharacter\s+sheet\s+(\d+[A-Z]?)\b/gi, (_, ref) => imageFor(ref))
    .replace(/\bits\s+character\s+sheet\s+reference\b/gi, single ? 'the attached reference image' : 'its attached reference image')
    .replace(/\btheir\s+character\s+sheet\s+references\b/gi, 'their attached reference images')
    .replace(/\bcharacter\s+sheet\s+references?\b/gi, (match) => (/s$/i.test(match) ? 'reference images' : 'reference image'))
    .replace(/\bcharacter\s+sheets?\b/gi, (match) => (/s$/i.test(match) ? 'reference images' : 'reference image'));
  return `${rewritten.trim()} ${REFERENCE_GUARD}`;
}

module.exports = { flowAssetId, createFlowStore, createFlowService, registerFlowIpc, scenePromptForFlow, CHARACTER_KEY };
