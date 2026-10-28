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
  VOICE_MODES,
  validVideoType,
  validVoiceMode,
  copyCharacterImages,
  getCharacterFilePath,
  validCharacters,
  validFlowProjectUrl,
  validNarratorVoiceId,
  VOICE_ID_PATTERN,
  copyVideoCharacterFiles,
  copyVideoCharacters,
  mergeBranchCharacters,
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
  assert.equal(branch.voiceMode, 'voiceover');
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

  // Invalid orientation, characterMode, mode, voiceMode
  assert.throws(() => store.create({ name: 'X', voiceMode: 'invalid' }), /Modo de voz no válido\./);
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
  assert.equal(defaultBranch.voiceMode, 'voiceover');
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
  assert.equal(result.branches[0].voiceMode, 'voiceover');
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
test('voiceMode: validation, defaults, update, and backward compatibility', () => {
  assert.deepEqual(VOICE_MODES, ['voiceover', 'flow']);
  assert.equal(validVoiceMode('voiceover'), 'voiceover');
  assert.equal(validVoiceMode('flow'), 'flow');
  assert.throws(() => validVoiceMode('unknown'), /Modo de voz no válido\./);
  assert.throws(() => validVoiceMode(123), /Modo de voz no válido\./);
  assert.throws(() => validVoiceMode(null), /Modo de voz no válido\./);
  assert.throws(() => validVoiceMode(undefined), /Modo de voz no válido\./);

  const dir = makeTmpDir();
  const store = createBranchStore(dir);

  // Default is 'voiceover'
  const b1 = store.create({ name: 'Rama Default' });
  assert.equal(b1.voiceMode, 'voiceover');

  // Explicit mode
  const b2 = store.create({ name: 'Rama Flow', voiceMode: 'flow' });
  assert.equal(b2.voiceMode, 'flow');

  // Update
  const updated = store.update(b1.id, { voiceMode: 'flow' });
  assert.equal(updated.voiceMode, 'flow');

  // Branches missing voiceMode on disk are read as 'voiceover'
  const rawBranchesFile = path.join(dir, 'branches.json');
  const onDisk = JSON.parse(fs.readFileSync(rawBranchesFile, 'utf8'));
  delete onDisk[0].voiceMode;
  fs.writeFileSync(rawBranchesFile, JSON.stringify(onDisk));

  const reloaded = store.list();
  assert.equal(reloaded[0].voiceMode, 'voiceover');
});

test('migration populates voiceMode voiceover on existing branches missing it', () => {
  const dir = makeTmpDir();
  const branchesFile = path.join(dir, 'branches.json');
  const legacyBranch = {
    id: 'legacy-branch-voice',
    name: 'Rama Vieja Sin Voz',
    orientation: 'horizontal',
    videoType: 'explainer',
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
  assert.equal(result.branches[0].voiceMode, 'voiceover');

  const onDisk = JSON.parse(fs.readFileSync(branchesFile, 'utf8'));
  assert.equal(onDisk[0].voiceMode, 'voiceover');
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

test('copyCharacterImages and getCharacterFilePath comprehensive security and validation checks', () => {
  const dir = makeTmpDir();
  const branchId = 'security-branch-99';
  const targetCharsDir = path.join(dir, 'branches', branchId, 'characters');

  const tmpSrc = makeTmpDir();
  const validFile = path.join(tmpSrc, 'test image 1.png');
  const exeFile = path.join(tmpSrc, 'malware.exe');
  const noExtFile = path.join(tmpSrc, 'rawfile');
  fs.writeFileSync(validFile, 'valid-bytes');
  fs.writeFileSync(exeFile, 'fake-exe');
  fs.writeFileSync(noExtFile, 'fake-raw');

  // 1. Rejects bad branch ids
  const badBranchIds = ['', '   ', null, undefined, 12345, '../traversal', '..\\traversal', 'has spaces', 'branch#special', 'branch$bad'];
  for (const badId of badBranchIds) {
    assert.throws(
      () => copyCharacterImages(dir, badId, [validFile]),
      /ID de rama no válido./,
      `copyCharacterImages should reject bad branchId: ${badId}`
    );
    assert.throws(
      () => getCharacterFilePath(dir, badId, 'some-image.png'),
      /ID de rama no válido./,
      `getCharacterFilePath should reject bad branchId: ${badId}`
    );
  }

  // 2. Rejects non-image extensions (.exe, no extension)
  assert.throws(
    () => copyCharacterImages(dir, branchId, [exeFile]),
    /Formato de imagen no permitido./,
    'Should reject .exe extension'
  );
  assert.throws(
    () => copyCharacterImages(dir, branchId, [noExtFile]),
    /Formato de imagen no permitido./,
    'Should reject file with no extension'
  );

  // 3. Rejects missing files
  const missingFile = path.join(tmpSrc, 'does-not-exist.png');
  assert.throws(
    () => copyCharacterImages(dir, branchId, [missingFile]),
    /Archivo no encontrado/,
    'Should throw when source image file does not exist'
  );

  // 4. Copies with a generated safe name and never resolves outside characters folder
  const complexName = path.join(tmpSrc, 'mi personaje #1 [final] @ 2026.webp');
  fs.writeFileSync(complexName, 'webp-content');
  const [copiedName] = copyCharacterImages(dir, branchId, [complexName]);

  assert.ok(/^[\w.-]{1,120}$/.test(copiedName), 'Generated safe name must match safe pattern');
  assert.ok(copiedName.endsWith('.webp'));
  assert.ok(!copiedName.includes(' '));
  assert.ok(!copiedName.includes('#'));
  assert.ok(!copiedName.includes('@'));

  const resolved = getCharacterFilePath(dir, branchId, copiedName);
  assert.ok(resolved.startsWith(targetCharsDir + path.sep), 'Resolved path must be inside characters folder');
  assert.equal(path.dirname(resolved), targetCharsDir, 'Parent directory must strictly match characters directory');
  assert.equal(fs.readFileSync(resolved, 'utf8'), 'webp-content');

  // 5. Rejects names with path separators or ".." in getCharacterFilePath
  const badFileNames = [
    '../other.png',
    '..\\other.png',
    'sub/image.png',
    'sub\\image.png',
    '..',
    '',
    null,
    undefined,
    123,
    'bad name with spaces.png',
  ];
  for (const badName of badFileNames) {
    assert.throws(
      () => getCharacterFilePath(dir, branchId, badName),
      /(Nombre de imagen de personaje no válido|Ruta de imagen no válida)./,
      `getCharacterFilePath should reject bad fileName: ${badName}`
    );
  }
});


test('branch characters validation and flowProjectUrl validation', () => {
  // Valid characters
  const valid = [
    {
      key: 'personaje-1',
      name: '  Tomás  ',
      description: 'El protagonista científico',
      file: 'char1.png',
      source: 'own',
    },
    {
      key: 'personaje_2-robot',
      name: 'Robot X',
      description: '',
      file: 'robot.webp',
      source: 'flow',
    },
  ];
  const cleaned = validCharacters(valid);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].name, 'Tomás');
  assert.equal(cleaned[0].source, 'own');
  assert.equal(cleaned[1].source, 'flow');

  // Invalid key
  assert.throws(() => validCharacters([{ key: 'bad key with spaces', name: 'N', file: 'f.png', source: 'own' }]), /Clave de personaje no válida\./);
  assert.throws(() => validCharacters([{ key: 'bad#char', name: 'N', file: 'f.png', source: 'own' }]), /Clave de personaje no válida\./);
  assert.throws(() => validCharacters([{ key: 'a'.repeat(61), name: 'N', file: 'f.png', source: 'own' }]), /Clave de personaje no válida\./);

  // Invalid name
  assert.throws(() => validCharacters([{ key: 'k', name: '   ', file: 'f.png', source: 'own' }]), /Nombre de personaje no válido\./);
  assert.throws(() => validCharacters([{ key: 'k', name: 'a'.repeat(81), file: 'f.png', source: 'own' }]), /Nombre de personaje no válido\./);

  // Invalid description
  assert.throws(() => validCharacters([{ key: 'k', name: 'N', description: 'a'.repeat(2001), file: 'f.png', source: 'own' }]), /Descripción de personaje no válida\./);

  // Invalid file
  assert.throws(() => validCharacters([{ key: 'k', name: 'N', file: '../traversal.png', source: 'own' }]), /Nombre de imagen de personaje no válido\./);
  assert.throws(() => validCharacters([{ key: 'k', name: 'N', file: 'bad file name.png', source: 'own' }]), /Nombre de imagen de personaje no válido\./);

  // Invalid source
  assert.throws(() => validCharacters([{ key: 'k', name: 'N', file: 'f.png', source: 'other' }]), /Origen de personaje no válido\./);

  // Non-array
  assert.throws(() => validCharacters('not-array'), /Lista de personajes no válida\./);


  // validNarratorVoiceId
  assert.equal(validNarratorVoiceId(null), null);
  assert.equal(validNarratorVoiceId(undefined), null);
  assert.equal(validNarratorVoiceId(''), null);
  assert.equal(validNarratorVoiceId('narrator-voice-1'), 'narrator-voice-1');
  assert.throws(() => validNarratorVoiceId('bad narrator voice with spaces'), /ID de voz de narrador no válido\./);
  assert.throws(() => validNarratorVoiceId('a'.repeat(101)), /ID de voz de narrador no válido\./);
  assert.throws(() => validNarratorVoiceId(1234), /ID de voz de narrador no válido\./);

  // validFlowProjectUrl
  assert.equal(validFlowProjectUrl(null), null);
  assert.equal(validFlowProjectUrl(undefined), null);
  assert.equal(validFlowProjectUrl('https://flow.google.com/project/12345678-1234-1234-1234-123456789abc'), 'https://flow.google.com/project/12345678-1234-1234-1234-123456789abc');
  assert.equal(validFlowProjectUrl('https://flow.google.com/u/1/project/12345678-1234-1234-1234-123456789abc'), 'https://flow.google.com/u/1/project/12345678-1234-1234-1234-123456789abc');
  assert.throws(() => validFlowProjectUrl('https://malicious.com/project/12345678-1234-1234-1234-123456789abc'), /URL del proyecto de Flow no válida\./);
  assert.throws(() => validFlowProjectUrl('not-url'), /URL del proyecto de Flow no válida\./);
});

test('setCharacters updates characters, flowProjectUrl, and synchronizes characterImages', () => {
  const dir = makeTmpDir();
  const store = createBranchStore(dir);
  const branch = store.create({ name: 'Rama Personajes' });
  assert.deepEqual(branch.characters, []);
  assert.equal(branch.flowProjectUrl, null);

  const updated = store.setCharacters(
    branch.id,
    [
      { key: 'char-1', name: 'Personaje 1', description: 'Desc 1', file: 'char1.png', source: 'own' },
      { key: 'char-2', name: 'Personaje 2', description: 'Desc 2', file: 'char2.webp', source: 'flow' },
    ],
    'https://flow.google.com/project/12345678-1234-1234-1234-123456789abc'
  );

  assert.equal(updated.characters.length, 2);
  assert.equal(updated.characters[0].key, 'char-1');
  assert.equal(updated.flowProjectUrl, 'https://flow.google.com/project/12345678-1234-1234-1234-123456789abc');
  assert.ok(updated.characterImages.includes('char1.png'));
  assert.ok(updated.characterImages.includes('char2.webp'));

  // Re-read from disk
  const reloaded = store.get(branch.id);
  assert.deepEqual(reloaded.characters, updated.characters);
  assert.equal(reloaded.flowProjectUrl, updated.flowProjectUrl);
  assert.deepEqual(reloaded.characterImages, updated.characterImages);

  // Unknown branch throws
  assert.throws(() => store.setCharacters('unknown-id', []), /Rama no encontrada\./);
});

test('branch narratorVoiceId create, update, and read roundtrip', () => {
  const dir = makeTmpDir();
  const store = createBranchStore(dir);

  const branch = store.create({
    name: 'Rama Narrador',
    narratorVoiceId: 'narrator-cartesia-1',
  });

  assert.equal(branch.narratorVoiceId, 'narrator-cartesia-1');

  // Update narratorVoiceId
  const updated = store.update(branch.id, { narratorVoiceId: 'narrator-cartesia-2' });
  assert.equal(updated.narratorVoiceId, 'narrator-cartesia-2');

  // Clear narratorVoiceId
  const cleared = store.update(branch.id, { narratorVoiceId: null });
  assert.equal(cleared.narratorVoiceId, null);

  // Re-read from disk
  const reloaded = store.get(branch.id);
  assert.equal(reloaded.narratorVoiceId, null);
});

test('a character input with a voiceId field is accepted and the field is dropped from the result', () => {
  const result = validCharacters([
    { key: 'c1', name: 'Char 1', file: 'f.png', source: 'own', voiceId: 'old-voice-id-123' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].key, 'c1');
  assert.equal(result[0].name, 'Char 1');
  assert.equal(result[0].file, 'f.png');
  assert.equal(result[0].source, 'own');
  assert.equal(result[0].voiceId, undefined);
  assert.equal('voiceId' in result[0], false);
});

test('copyVideoCharacterFiles: copies with safe names and rejects traversal', () => {
  const wsDir = makeTmpDir();
  const branchId = 'branch-copy-test';
  const videoId = 'video-source-1';
  const charKey = 'personaje-1';

  // Set up video character folder on disk
  const videoCharDir = path.join(wsDir, 'videos', videoId, 'characters', charKey);
  fs.mkdirSync(videoCharDir, { recursive: true });
  const srcFile = path.join(videoCharDir, 'sheet_1.png');
  fs.writeFileSync(srcFile, 'png-bytes-from-video');

  const result = copyVideoCharacterFiles(wsDir, branchId, videoId, [
    {
      key: charKey,
      name: 'Personaje 1',
      description: 'El héroe',
      selectedFile: 'sheet_1.png',
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].key, charKey);
  assert.equal(result[0].name, 'Personaje 1');
  assert.equal(result[0].description, 'El héroe');
  assert.equal(result[0].source, 'flow');
  assert.ok(/^[\w.-]{1,120}$/.test(result[0].file));
  assert.ok(result[0].file.endsWith('.png'));

  // Check file actually exists on disk in branch characters folder
  const branchCharFile = path.join(wsDir, 'branches', branchId, 'characters', result[0].file);
  assert.ok(fs.existsSync(branchCharFile));
  assert.equal(fs.readFileSync(branchCharFile, 'utf8'), 'png-bytes-from-video');

  // Traversal rejected in branchId
  assert.throws(
    () => copyVideoCharacterFiles(wsDir, '../bad-branch', videoId, [{ key: charKey, selectedFile: 'sheet_1.png' }]),
    /ID de rama no válido\./
  );

  // Traversal rejected in videoId
  assert.throws(
    () => copyVideoCharacterFiles(wsDir, branchId, '../bad-video', [{ key: charKey, selectedFile: 'sheet_1.png' }]),
    /ID de video no válido\./
  );

  // Traversal rejected in key
  assert.throws(
    () => copyVideoCharacterFiles(wsDir, branchId, videoId, [{ key: '../bad-key', selectedFile: 'sheet_1.png' }]),
    /Clave de personaje no válida\./
  );

  // Traversal rejected in file name
  assert.throws(
    () => copyVideoCharacterFiles(wsDir, branchId, videoId, [{ key: charKey, selectedFile: '../../etc/passwd.png' }]),
    /Nombre de imagen de personaje no válido\./
  );

  // Non-existent file
  assert.throws(
    () => copyVideoCharacterFiles(wsDir, branchId, videoId, [{ key: charKey, selectedFile: 'missing.png' }]),
    /Archivo no encontrado/
  );
});

test('mergeBranchCharacters merges by character key with incoming winning and preserving others', () => {
  const existing = [
    { key: 'char-1', name: 'Tomás Antiguo', file: 'tomas_old.png', source: 'flow' },
    { key: 'char-2', name: 'Ana', file: 'ana.png', source: 'own' },
  ];
  const incoming = [
    { key: 'char-1', name: 'Tomás Nuevo', file: 'tomas_new.png', source: 'flow' },
    { key: 'char-3', name: 'Robot', file: 'robot.png', source: 'flow' },
  ];

  const merged = mergeBranchCharacters(existing, incoming);
  assert.equal(merged.length, 3);
  // char-1 updated
  assert.equal(merged[0].key, 'char-1');
  assert.equal(merged[0].name, 'Tomás Nuevo');
  assert.equal(merged[0].file, 'tomas_new.png');
  // char-2 kept in position
  assert.equal(merged[1].key, 'char-2');
  assert.equal(merged[1].name, 'Ana');
  // char-3 appended
  assert.equal(merged[2].key, 'char-3');
  assert.equal(merged[2].name, 'Robot');

  // Edge cases
  assert.deepEqual(mergeBranchCharacters([], incoming), incoming);
  assert.deepEqual(mergeBranchCharacters(existing, []), existing);
  assert.deepEqual(mergeBranchCharacters(null, null), []);
});
