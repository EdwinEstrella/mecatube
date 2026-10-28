// Run: node electron/branches.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createBranchStore,
  migrateWorkspace,
  ORIENTATIONS,
  MODES,
  CHARACTER_MODES,
  VIDEO_TYPES,
  validVideoType,
  copyCharacterImages,
  getCharacterFilePath,
} = require('./branches.cjs');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mecatube-branch-test-'));
}

test('create, list, get, update, delete flow', () => {
  const dir = makeTmpDir();
  const store = createBranchStore(dir);

  assert.deepEqual(store.list(), []);
  assert.equal(store.get('non-existent'), null);

  const created = store.create({
    name: '  Mi Rama Principal  ',
    orientation: 'vertical',
    characterMode: 'own',
    characterImages: ['char1.png', 'char2.jpg'],
    mode: 'series',
    series: {
      idea: 'Una gran idea',
      beginning: 'Inicio emocionante',
      middle: 'Nudo complejo',
      end: 'Desenlace épico',
      chapters: 5,
      minutes: 10,
      outline: [
        { number: 1, title: 'Capítulo 1', summary: 'Resumen 1', videoId: null },
      ],
    },
    titles: [{ text: 'Título 1', videoId: null }],
  });

  assert.ok(created.id);
  assert.equal(created.name, 'Mi Rama Principal');
  assert.equal(created.orientation, 'vertical');
  assert.equal(created.characterMode, 'own');
  assert.deepEqual(created.characterImages, ['char1.png', 'char2.jpg']);
  assert.equal(created.mode, 'series');
  assert.equal(created.series.chapters, 5);
  assert.equal(created.series.outline.length, 1);
  assert.equal(created.titles.length, 1);
  assert.ok(created.createdAt > 0);
  assert.equal(created.createdAt, created.updatedAt);

  // List and get
  const list = store.list();
  assert.equal(list.length, 1);
  assert.deepEqual(store.get(created.id), created);

  // Update
  const updated = store.update(created.id, {
    name: 'Nombre Actualizado',
    orientation: 'horizontal',
  });
  assert.equal(updated.name, 'Nombre Actualizado');
  assert.equal(updated.orientation, 'horizontal');
  assert.equal(updated.characterMode, 'own');
  assert.ok(updated.updatedAt >= created.updatedAt);
  assert.equal(store.get(created.id).name, 'Nombre Actualizado');

  // Delete
  store.delete(created.id);
  assert.equal(store.list().length, 0);
  assert.equal(store.get(created.id), null);

  // Deleting unknown id throws
  assert.throws(() => store.delete(created.id), /Rama no encontrada\./);
  assert.throws(() => store.update(created.id, { name: 'X' }), /Rama no encontrada\./);
});

test('create defaults applied when optional fields omitted', () => {
  const dir = makeTmpDir();
  const store = createBranchStore(dir);

  const branch = store.create({ name: 'Rama Simple' });
  assert.equal(branch.name, 'Rama Simple');
  assert.equal(branch.orientation, 'horizontal');
  assert.equal(branch.characterMode, 'create');
  assert.deepEqual(branch.characterImages, []);
  assert.equal(branch.mode, 'free');
  assert.equal(branch.series, null);
  assert.deepEqual(branch.titles, []);
});

test('validation rejects invalid branch fields and unknown properties', () => {
  const dir = makeTmpDir();
  const store = createBranchStore(dir);

  // Missing or empty name
  assert.throws(() => store.create({}), /El nombre de la rama es obligatorio\./);
  assert.throws(() => store.create({ name: '   ' }), /El nombre de la rama es obligatorio\./);
  assert.throws(() => store.create({ name: 'a'.repeat(81) }), /El nombre de la rama es demasiado largo\./);
  assert.throws(() => store.create({ name: 123 }), /Nombre de rama no válido\./);

  // Invalid orientation, characterMode, mode
  assert.throws(() => store.create({ name: 'X', orientation: 'diagonal' }), /Orientación de rama no válida\./);
  assert.throws(() => store.create({ name: 'X', characterMode: 'other' }), /Modo de personaje no válido\./);
  assert.throws(() => store.create({ name: 'X', mode: 'random' }), /Modo de rama no válido\./);

  // Character images
  assert.throws(() => store.create({ name: 'X', characterImages: 'not-an-array' }), /Imágenes de personaje no válidas\./);
  assert.throws(
    () => store.create({ name: 'X', characterImages: Array(11).fill('img.png') }),
    /Se superó el límite de imágenes de personaje\./
  );
  assert.throws(() => store.create({ name: 'X', characterImages: ['bad/path/img.png'] }), /Nombre de imagen de personaje no válido\./);

  // Unknown property in create
  assert.throws(() => store.create({ name: 'X', extraField: 123 }), /Campo no permitido: extraField\./);

  // Unknown property in update
  const branch = store.create({ name: 'Rama Válida' });
  assert.throws(() => store.update(branch.id, { unknownProperty: 'foo' }), /Campo no permitido: unknownProperty\./);
});

test('series validation rules', () => {
  const dir = makeTmpDir();
  const store = createBranchStore(dir);

  // Series chapters range 1..50
  assert.throws(
    () => store.create({ name: 'S1', series: { chapters: 0 } }),
    /Número de capítulos no válido\./
  );
  assert.throws(
    () => store.create({ name: 'S1', series: { chapters: 51 } }),
    /Número de capítulos no válido\./
  );

  // Series minutes range 0.5..60
  assert.throws(
    () => store.create({ name: 'S1', series: { minutes: 0.1 } }),
    /Duración en minutos no válida\./
  );
  assert.throws(
    () => store.create({ name: 'S1', series: { minutes: 61 } }),
    /Duración en minutos no válida\./
  );

  // Series text length <= 4000
  assert.throws(
    () => store.create({ name: 'S1', series: { idea: 'x'.repeat(4001) } }),
    /Idea de serie no válido\./
  );

  // Outline validation
  assert.throws(
    () => store.create({ name: 'S1', series: { outline: 'invalid' } }),
    /Estructura de capítulos no válida\./
  );
  assert.throws(
    () => store.create({ name: 'S1', series: { outline: [{ number: 0, title: 'T', summary: 'S' }] } }),
    /Número de capítulo no válido\./
  );
});

test('titles validation rules', () => {
  const dir = makeTmpDir();
  const store = createBranchStore(dir);

  assert.throws(() => store.create({ name: 'T1', titles: 'invalid' }), /Lista de títulos no válida\./);
  assert.throws(
    () => store.create({ name: 'T1', titles: Array(501).fill({ text: 'A' }) }),
    /Se superó el límite de títulos\./
  );
  assert.throws(
    () => store.create({ name: 'T1', titles: [{ text: '' }] }),
    /Texto de título no válido\./
  );
  assert.throws(
    () => store.create({ name: 'T1', titles: [{ text: 'b'.repeat(201) }] }),
    /Texto de título no válido\./
  );
});

test('migration of a legacy workspace: default branch created and videos gain branchId', () => {
  const dir = makeTmpDir();
  const videosFile = path.join(dir, 'videos.json');
  const wsFile = path.join(dir, 'workspace.json');

  fs.writeFileSync(wsFile, JSON.stringify({ name: 'Mi Espacio de Trabajo' }));
  const legacyVideo = {
    id: 'legacy-video-123',
    title: 'Mi Video Anterior',
    titleEdited: true,
    scriptConversationId: 'conv-1',
    illustratorConversationId: null,
    flowProjectUrl: null,
    overrides: {},
    createdAt: 1000,
    updatedAt: 1000,
  };
  fs.writeFileSync(videosFile, JSON.stringify([legacyVideo]));

  // Run migration
  const result = migrateWorkspace(dir);
  assert.equal(result.branches.length, 1);
  const defaultBranch = result.branches[0];
  assert.equal(defaultBranch.name, 'Principal');
  assert.equal(defaultBranch.orientation, 'horizontal');
  assert.equal(defaultBranch.characterMode, 'create');
  assert.equal(defaultBranch.mode, 'free');

  // Verify videos.json on disk
  const migratedVideos = JSON.parse(fs.readFileSync(videosFile, 'utf8'));
  assert.equal(migratedVideos.length, 1);
  assert.equal(migratedVideos[0].id, 'legacy-video-123');
  assert.equal(migratedVideos[0].title, 'Mi Video Anterior');
  assert.equal(migratedVideos[0].branchId, defaultBranch.id);
});

test('migration on empty workspace creates default branch and one default video titled with workspace name', () => {
  const dir = makeTmpDir();
  const wsFile = path.join(dir, 'workspace.json');
  fs.writeFileSync(wsFile, JSON.stringify({ name: 'Canal de Historia' }));

  const result = migrateWorkspace(dir);
  assert.equal(result.branches.length, 1);
  assert.equal(result.videos.length, 1);

  const video = result.videos[0];
  assert.equal(video.branchId, result.branches[0].id);
  assert.equal(video.title, 'Canal de Historia');
});

test('migration is strictly idempotent: running twice changes nothing', () => {
  const dir = makeTmpDir();
  const wsFile = path.join(dir, 'workspace.json');
  fs.writeFileSync(wsFile, JSON.stringify({ name: 'Espacio Idempotente' }));

  migrateWorkspace(dir);

  const branchesFile = path.join(dir, 'branches.json');
  const videosFile = path.join(dir, 'videos.json');

  const branchesBefore = fs.readFileSync(branchesFile, 'utf8');
  const videosBefore = fs.readFileSync(videosFile, 'utf8');

  // Second run
  migrateWorkspace(dir);

  const branchesAfter = fs.readFileSync(branchesFile, 'utf8');
  const videosAfter = fs.readFileSync(videosFile, 'utf8');

  assert.equal(branchesBefore, branchesAfter);
  assert.equal(videosBefore, videosAfter);
});

test('videoType: validation, defaults, update, and backward compatibility', () => {
  assert.deepEqual(VIDEO_TYPES, ['explainer', 'story', 'list', 'horror']);
  assert.equal(validVideoType('explainer'), 'explainer');
  assert.equal(validVideoType('story'), 'story');
  assert.equal(validVideoType('list'), 'list');
  assert.equal(validVideoType('horror'), 'horror');
  assert.throws(() => validVideoType('unknown'), /Tipo de video no válido\./);
  assert.throws(() => validVideoType(123), /Tipo de video no válido\./);

  const dir = makeTmpDir();
  const store = createBranchStore(dir);

  // Default is 'explainer'
  const b1 = store.create({ name: 'Rama Default' });
  assert.equal(b1.videoType, 'explainer');

  // Explicit type
  const b2 = store.create({ name: 'Rama Terror', videoType: 'horror' });
  assert.equal(b2.videoType, 'horror');

  // Update
  const updated = store.update(b1.id, { videoType: 'story' });
  assert.equal(updated.videoType, 'story');

  // Branches missing videoType on disk are read as 'explainer'
  const rawBranchesFile = path.join(dir, 'branches.json');
  const onDisk = JSON.parse(fs.readFileSync(rawBranchesFile, 'utf8'));
  delete onDisk[0].videoType;
  fs.writeFileSync(rawBranchesFile, JSON.stringify(onDisk));

  const reloaded = store.list();
  assert.equal(reloaded[0].videoType, 'explainer');
});

test('migration populates videoType explainer on existing branches missing it', () => {
  const dir = makeTmpDir();
  const branchesFile = path.join(dir, 'branches.json');
  const legacyBranch = {
    id: 'legacy-branch-1',
    name: 'Rama Vieja',
    orientation: 'horizontal',
    characterMode: 'create',
    characterImages: [],
    mode: 'free',
    series: null,
    titles: [],
    createdAt: 1000,
    updatedAt: 1000,
  };
  fs.writeFileSync(branchesFile, JSON.stringify([legacyBranch]));

  const result = migrateWorkspace(dir);
  assert.equal(result.branches.length, 1);
  assert.equal(result.branches[0].videoType, 'explainer');

  const onDisk = JSON.parse(fs.readFileSync(branchesFile, 'utf8'));
  assert.equal(onDisk[0].videoType, 'explainer');
});

test('copyCharacterImages and getCharacterFilePath: copy, sanitization, and traversal rejection', () => {
  const dir = makeTmpDir();
  const branchId = 'test-branch-123';

  // Create temporary source image files
  const tmpSrc = makeTmpDir();
  const file1 = path.join(tmpSrc, 'my character @ hero!.png');
  const file2 = path.join(tmpSrc, 'side view.jpg');
  const invalidExt = path.join(tmpSrc, 'script.txt');
  fs.writeFileSync(file1, 'fake-png-bytes');
  fs.writeFileSync(file2, 'fake-jpg-bytes');
  fs.writeFileSync(invalidExt, 'not-an-image');

  // Valid copy
  const storedNames = copyCharacterImages(dir, branchId, [file1, file2]);
  assert.equal(storedNames.length, 2);
  assert.ok(/^[\w.-]{1,120}$/.test(storedNames[0]));
  assert.ok(/^[\w.-]{1,120}$/.test(storedNames[1]));
  assert.ok(storedNames[0].endsWith('.png'));
  assert.ok(storedNames[1].endsWith('.jpg'));

  // Files exist on disk
  const resolvedPath1 = getCharacterFilePath(dir, branchId, storedNames[0]);
  assert.ok(fs.existsSync(resolvedPath1));
  assert.equal(fs.readFileSync(resolvedPath1, 'utf8'), 'fake-png-bytes');

  // Invalid extension rejected
  assert.throws(() => copyCharacterImages(dir, branchId, [invalidExt]), /Formato de imagen no permitido\./);

  // Invalid branchId rejected
  assert.throws(() => copyCharacterImages(dir, '../bad-id', [file1]), /ID de rama no válido\./);
  assert.throws(() => getCharacterFilePath(dir, '../bad-id', storedNames[0]), /ID de rama no válido\./);

  // Path traversal in filename rejected
  assert.throws(() => getCharacterFilePath(dir, branchId, '../secret.png'), /Nombre de imagen de personaje no válido\./);
  assert.throws(() => getCharacterFilePath(dir, branchId, 'non-existent.png'), /Imagen no encontrada\./);
});
