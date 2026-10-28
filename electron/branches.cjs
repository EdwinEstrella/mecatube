// Workspace branches store: branches.json array, written atomically.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ID_PATTERN = /^[\w-]{1,100}$/;
const CHARACTER_IMAGE_PATTERN = /^[\w.-]{1,120}$/;
const NAME_MAX = 80;
const TEXT_MAX = 4000;
const TITLE_MAX = 200;

const ORIENTATIONS = ['horizontal', 'vertical'];
const MODES = ['series', 'titles', 'free'];
const CHARACTER_MODES = ['own', 'create'];

const KNOWN_BRANCH_FIELDS = [
  'name',
  'orientation',
  'characterMode',
  'characterImages',
  'mode',
  'series',
  'titles',
];

const KNOWN_SERIES_FIELDS = ['idea', 'beginning', 'middle', 'end', 'chapters', 'minutes', 'outline'];

function validName(value) {
  if (value === undefined || value === null) throw new Error('El nombre de la rama es obligatorio.');
  if (typeof value !== 'string') throw new Error('Nombre de rama no válido.');
  const name = value.trim();
  if (!name) throw new Error('El nombre de la rama es obligatorio.');
  if (name.length > NAME_MAX) throw new Error('El nombre de la rama es demasiado largo.');
  return name;
}

function validOrientation(value) {
  if (typeof value !== 'string' || !ORIENTATIONS.includes(value)) {
    throw new Error('Orientación de rama no válida.');
  }
  return value;
}

function validCharacterMode(value) {
  if (typeof value !== 'string' || !CHARACTER_MODES.includes(value)) {
    throw new Error('Modo de personaje no válido.');
  }
  return value;
}

function validCharacterImages(value) {
  if (!Array.isArray(value)) throw new Error('Imágenes de personaje no válidas.');
  if (value.length > 10) throw new Error('Se superó el límite de imágenes de personaje.');
  for (const img of value) {
    if (typeof img !== 'string' || !CHARACTER_IMAGE_PATTERN.test(img)) {
      throw new Error('Nombre de imagen de personaje no válido.');
    }
  }
  return [...value];
}

function validMode(value) {
  if (typeof value !== 'string' || !MODES.includes(value)) {
    throw new Error('Modo de rama no válido.');
  }
  return value;
}

function validSeriesText(text, label) {
  if (typeof text !== 'string' || text.length > TEXT_MAX) {
    throw new Error(`${label} de serie no válido.`);
  }
  return text;
}

function validSeries(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Datos de serie no válidos.');
  }
  for (const key of Object.keys(value)) {
    if (!KNOWN_SERIES_FIELDS.includes(key)) {
      throw new Error(`Campo de serie no permitido: ${key}.`);
    }
  }

  const idea = value.idea !== undefined ? validSeriesText(value.idea, 'Idea') : '';
  const beginning = value.beginning !== undefined ? validSeriesText(value.beginning, 'Inicio') : '';
  const middle = value.middle !== undefined ? validSeriesText(value.middle, 'Nudo') : '';
  const end = value.end !== undefined ? validSeriesText(value.end, 'Desenlace') : '';

  if (value.chapters !== undefined) {
    if (!Number.isInteger(value.chapters) || value.chapters < 1 || value.chapters > 50) {
      throw new Error('Número de capítulos no válido.');
    }
  }
  const chapters = value.chapters ?? 1;

  if (value.minutes !== undefined) {
    if (typeof value.minutes !== 'number' || Number.isNaN(value.minutes) || value.minutes < 0.5 || value.minutes > 60) {
      throw new Error('Duración en minutos no válida.');
    }
  }
  const minutes = value.minutes ?? 1;

  let outline = [];
  if (value.outline !== undefined) {
    if (!Array.isArray(value.outline)) throw new Error('Estructura de capítulos no válida.');
    outline = value.outline.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Capítulo no válido.');
      if (!Number.isInteger(item.number) || item.number < 1) throw new Error('Número de capítulo no válido.');
      if (typeof item.title !== 'string' || item.title.length > TITLE_MAX) {
        throw new Error('Título de capítulo no válido.');
      }
      if (typeof item.summary !== 'string' || item.summary.length > TEXT_MAX) {
        throw new Error('Resumen de capítulo no válido.');
      }
      if (
        item.videoId !== null &&
        item.videoId !== undefined &&
        (typeof item.videoId !== 'string' || !ID_PATTERN.test(item.videoId))
      ) {
        throw new Error('ID de video de capítulo no válido.');
      }
      return {
        number: item.number,
        title: item.title,
        summary: item.summary,
        videoId: item.videoId ?? null,
      };
    });
  }

  return { idea, beginning, middle, end, chapters, minutes, outline };
}

function validTitles(value) {
  if (!Array.isArray(value)) throw new Error('Lista de títulos no válida.');
  if (value.length > 500) throw new Error('Se superó el límite de títulos.');
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Título no válido.');
    if (typeof item.text !== 'string') throw new Error('Texto de título no válido.');
    const text = item.text.trim();
    if (text.length < 1 || text.length > TITLE_MAX) throw new Error('Texto de título no válido.');
    if (item.id !== undefined && item.id !== null && (typeof item.id !== 'string' || !ID_PATTERN.test(item.id))) {
      throw new Error('ID de título no válido.');
    }
    if (
      item.videoId !== null &&
      item.videoId !== undefined &&
      (typeof item.videoId !== 'string' || !ID_PATTERN.test(item.videoId))
    ) {
      throw new Error('ID de video de título no válido.');
    }
    return {
      id: item.id || crypto.randomUUID(),
      text,
      videoId: item.videoId ?? null,
    };
  });
}

function validateBranchPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('Datos de rama no válidos.');
  }
  for (const key of Object.keys(patch)) {
    if (!KNOWN_BRANCH_FIELDS.includes(key)) {
      throw new Error(`Campo no permitido: ${key}.`);
    }
  }
  const fields = {};
  if (patch.name !== undefined) fields.name = validName(patch.name);
  if (patch.orientation !== undefined) fields.orientation = validOrientation(patch.orientation);
  if (patch.characterMode !== undefined) fields.characterMode = validCharacterMode(patch.characterMode);
  if (patch.characterImages !== undefined) fields.characterImages = validCharacterImages(patch.characterImages);
  if (patch.mode !== undefined) fields.mode = validMode(patch.mode);
  if (patch.series !== undefined) fields.series = validSeries(patch.series);
  if (patch.titles !== undefined) fields.titles = validTitles(patch.titles);
  return fields;
}

function writeAtomicJson(filePath, data) {
  const temp = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, filePath);
}

function createBranchStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'branches.json');

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

  function write(branches) {
    writeAtomicJson(file, branches);
  }

  function list() {
    return read();
  }

  function get(id) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
    return read().find((b) => b.id === id) || null;
  }

  function create(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Datos de rama no válidos.');
    }
    for (const key of Object.keys(input)) {
      if (!KNOWN_BRANCH_FIELDS.includes(key)) {
        throw new Error(`Campo no permitido: ${key}.`);
      }
    }

    const name = validName(input.name);
    const orientation = input.orientation !== undefined ? validOrientation(input.orientation) : 'horizontal';
    const characterMode = input.characterMode !== undefined ? validCharacterMode(input.characterMode) : 'create';
    const characterImages = input.characterImages !== undefined ? validCharacterImages(input.characterImages) : [];
    const mode = input.mode !== undefined ? validMode(input.mode) : 'free';
    const series = input.series !== undefined ? validSeries(input.series) : null;
    const titles = input.titles !== undefined ? validTitles(input.titles) : [];

    const now = Date.now();
    const record = {
      id: crypto.randomUUID(),
      name,
      orientation,
      characterMode,
      characterImages,
      mode,
      series,
      titles,
      createdAt: now,
      updatedAt: now,
    };

    const branches = read();
    branches.push(record);
    write(branches);
    return record;
  }

  function update(id, patch) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error('ID de rama no válido.');
    const fields = validateBranchPatch(patch);
    const branches = read();
    const branch = branches.find((b) => b.id === id);
    if (!branch) throw new Error('Rama no encontrada.');

    Object.assign(branch, fields, { updatedAt: Date.now() });
    write(branches);
    return branch;
  }

  function remove(id) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error('ID de rama no válido.');
    const branches = read();
    const index = branches.findIndex((b) => b.id === id);
    if (index === -1) throw new Error('Rama no encontrada.');

    branches.splice(index, 1);
    write(branches);
  }

  return { list, get, create, update, delete: remove };
}

function migrateWorkspace(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const branchesFile = path.join(dir, 'branches.json');
  const videosFile = path.join(dir, 'videos.json');
  const wsFile = path.join(dir, 'workspace.json');

  function readJson(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  function getWorkspaceTitle() {
    try {
      const data = readJson(wsFile);
      if (data?.name && typeof data.name === 'string' && data.name.trim()) {
        return data.name.trim();
      }
    } catch {}
    return 'Video sin título';
  }

  let branches = readJson(branchesFile);
  let branchesModified = false;

  if (!Array.isArray(branches) || branches.length === 0) {
    const now = Date.now();
    branches = [
      {
        id: crypto.randomUUID(),
        name: 'Principal',
        orientation: 'horizontal',
        characterMode: 'create',
        characterImages: [],
        mode: 'free',
        series: null,
        titles: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
    branchesModified = true;
  }

  if (branchesModified) {
    writeAtomicJson(branchesFile, branches);
  }

  const firstBranchId = branches[0].id;
  let videos = readJson(videosFile);
  let videosModified = false;

  if (!Array.isArray(videos) || videos.length === 0) {
    const now = Date.now();
    videos = [
      {
        id: crypto.randomUUID(),
        branchId: firstBranchId,
        title: getWorkspaceTitle(),
        titleEdited: false,
        ideaNumber: null,
        scriptConversationId: null,
        illustratorConversationId: null,
        flowProjectUrl: null,
        narrationText: null,
        brief: null,
        overrides: {},
        createdAt: now,
        updatedAt: now,
      },
    ];
    videosModified = true;
  } else {
    for (const video of videos) {
      if (!video.branchId) {
        video.branchId = firstBranchId;
        videosModified = true;
      }
    }
  }

  if (videosModified) {
    writeAtomicJson(videosFile, videos);
  }

  return { branches, videos };
}

module.exports = {
  createBranchStore,
  migrateWorkspace,
  ORIENTATIONS,
  MODES,
  CHARACTER_MODES,
  validName,
  validOrientation,
  validCharacterMode,
  validCharacterImages,
  validMode,
  validSeries,
  validTitles,
  validateBranchPatch,
};
