// Run: node electron/videos.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createVideoStore,
  STAGE_KEYS,
  DEFAULT_TITLE,
  validateFields,
} = require('./videos.cjs');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mecatube-videos-test-'));
}

test('create requires branchId and defaults title to DEFAULT_TITLE', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  assert.throws(() => store.create({}), /El ID de rama es obligatorio\./);
  assert.throws(() => store.create({ branchId: '' }), /El ID de rama es obligatorio\./);
  assert.throws(() => store.create({ branchId: 123 }), /ID de rama no válido\./);

  const video = store.create({ branchId: 'branch-1' });
  assert.ok(video.id);
  assert.equal(video.branchId, 'branch-1');
  assert.equal(video.title, DEFAULT_TITLE);
  assert.equal(video.titleEdited, false);
  assert.equal(video.brief, null);
  assert.deepEqual(video.overrides, {});
  assert.ok(video.createdAt > 0);
  assert.equal(video.createdAt, video.updatedAt);
});

test('multiple videos can be created and listed by branch or all', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  const v1 = store.create({
    branchId: 'branch-A',
    title: 'Episodio 1',
    brief: 'Contexto del episodio 1',
  });
  const v2 = store.create({
    branchId: 'branch-B',
    title: 'Short 1',
    brief: null,
  });
  const v3 = store.create({
    branchId: 'branch-A',
    title: 'Episodio 2',
    brief: 'Contexto del episodio 2',
  });

  // list() without branchId returns all videos sorted by createdAt
  const all = store.list();
  assert.equal(all.length, 3);
  assert.deepEqual(
    all.map((v) => v.id),
    [v1.id, v2.id, v3.id]
  );

  // list(branchId) filters by branch
  const branchAVideos = store.list('branch-A');
  assert.equal(branchAVideos.length, 2);
  assert.deepEqual(
    branchAVideos.map((v) => v.id),
    [v1.id, v3.id]
  );

  const branchBVideos = store.list('branch-B');
  assert.equal(branchBVideos.length, 1);
  assert.equal(branchBVideos[0].id, v2.id);

  const emptyBranch = store.list('branch-C');
  assert.equal(emptyBranch.length, 0);
});

test('update video fields and automatic titleEdited flag', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  const v = store.create({ branchId: 'b-1' });
  assert.equal(v.titleEdited, false);

  const updated = store.update(v.id, {
    title: 'Nuevo Título',
    brief: 'Nuevo brief explicativo',
  });
  assert.equal(updated.title, 'Nuevo Título');
  assert.equal(updated.titleEdited, true);
  assert.equal(updated.brief, 'Nuevo brief explicativo');

  // Updating without title keeps titleEdited
  const updated2 = store.update(v.id, { ideaNumber: 42 });
  assert.equal(updated2.ideaNumber, 42);
  assert.equal(updated2.titleEdited, true);

  // Setting titleEdited explicitly
  const updated3 = store.update(v.id, { title: 'Otro', titleEdited: false });
  assert.equal(updated3.title, 'Otro');
  assert.equal(updated3.titleEdited, false);
});

test('setStage updates overrides and rejects invalid stages/values', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  const v = store.create({ branchId: 'b-1' });

  // Valid stage override
  const s1 = store.setStage(v.id, 'script', true);
  assert.equal(s1.overrides.script, true);

  const s2 = store.setStage(v.id, 'script', false);
  assert.equal(s2.overrides.script, false);

  // Clearing stage override with null
  const s3 = store.setStage(v.id, 'script', null);
  assert.equal(s3.overrides.script, undefined);

  // Invalid stage name
  assert.throws(() => store.setStage(v.id, 'invalid-stage', true), /Etapa no válida\./);

  // Invalid stage value
  assert.throws(() => store.setStage(v.id, 'idea', 'yes'), /Valor de etapa no válido\./);
  assert.throws(() => store.setStage(v.id, 'idea', 1), /Valor de etapa no válido\./);
});

test('delete removes video record from store', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  const v1 = store.create({ branchId: 'b-1', title: 'Video 1' });
  const v2 = store.create({ branchId: 'b-1', title: 'Video 2' });

  assert.equal(store.list().length, 2);

  store.delete(v1.id);
  const remaining = store.list();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, v2.id);
  assert.equal(store.get(v1.id), null);
});

test('unknown id error on update, setStage, delete', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  assert.throws(() => store.update('non-existent-id', { title: 'X' }), /Video no encontrado\./);
  assert.throws(() => store.setStage('non-existent-id', 'idea', true), /Video no encontrado\./);
  assert.throws(() => store.delete('non-existent-id'), /Video no encontrado\./);
});

test('getActive returns null when store is empty', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);
  assert.equal(store.getActive(), null);
});

test('create sets active video and persists active-video.json', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  const v1 = store.create({ branchId: 'b-1', title: 'Video 1' });
  assert.equal(store.getActive().id, v1.id);
  const pointer1 = JSON.parse(fs.readFileSync(path.join(dir, 'active-video.json'), 'utf8'));
  assert.deepEqual(pointer1, { videoId: v1.id });

  const v2 = store.create({ branchId: 'b-1', title: 'Video 2' });
  assert.equal(store.getActive().id, v2.id);
  const pointer2 = JSON.parse(fs.readFileSync(path.join(dir, 'active-video.json'), 'utf8'));
  assert.deepEqual(pointer2, { videoId: v2.id });
});

test('setActive validates id exists, persists pointer, and returns record', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  const v1 = store.create({ branchId: 'b-1', title: 'Video 1' });
  const v2 = store.create({ branchId: 'b-1', title: 'Video 2' });
  assert.equal(store.getActive().id, v2.id);

  const switched = store.setActive(v1.id);
  assert.equal(switched.id, v1.id);
  assert.equal(store.getActive().id, v1.id);

  const pointer = JSON.parse(fs.readFileSync(path.join(dir, 'active-video.json'), 'utf8'));
  assert.deepEqual(pointer, { videoId: v1.id });

  assert.throws(() => store.setActive('bad/id'), /ID de video no válido\./);
  assert.throws(() => store.setActive('non-existent-id'), /Video no encontrado\./);
});

test('getActive falls back to most recently created video when pointer is missing or stale', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  const v1 = store.create({ branchId: 'b-1', title: 'Video 1' });
  const v2 = store.create({ branchId: 'b-1', title: 'Video 2' });

  // Missing active-video.json
  fs.unlinkSync(path.join(dir, 'active-video.json'));
  assert.equal(store.getActive().id, v2.id);

  // Stale active-video.json pointing to unknown id
  fs.writeFileSync(path.join(dir, 'active-video.json'), JSON.stringify({ videoId: 'deleted-or-stale' }));
  assert.equal(store.getActive().id, v2.id);
});

test('delete of active video clears pointer and fallback applies', () => {
  const dir = makeTmpDir();
  const store = createVideoStore(dir);

  const v1 = store.create({ branchId: 'b-1', title: 'Video 1' });
  const v2 = store.create({ branchId: 'b-1', title: 'Video 2' });
  assert.equal(store.getActive().id, v2.id);

  // Deleting non-active video leaves pointer intact
  store.delete(v1.id);
  assert.equal(store.getActive().id, v2.id);
  assert.ok(fs.existsSync(path.join(dir, 'active-video.json')));

  // Deleting active video clears pointer file
  store.delete(v2.id);
  assert.equal(fs.existsSync(path.join(dir, 'active-video.json')), false);
  assert.equal(store.getActive(), null);

  // When another video exists and active video is deleted, fallback returns most recently created
  const v3 = store.create({ branchId: 'b-1', title: 'Video 3' });
  const v4 = store.create({ branchId: 'b-1', title: 'Video 4' });
  store.setActive(v3.id);
  assert.equal(store.getActive().id, v3.id);

  store.delete(v3.id);
  assert.equal(fs.existsSync(path.join(dir, 'active-video.json')), false);
  // Falls back to v4 (most recently created remaining)
  assert.equal(store.getActive().id, v4.id);
});

test('validateFields validates brief and branchId', () => {
  const valid = validateFields({
    branchId: 'b-123',
    brief: 'Un brief válido',
    title: 'Título',
  });
  assert.equal(valid.branchId, 'b-123');
  assert.equal(valid.brief, 'Un brief válido');
  assert.equal(valid.title, 'Título');

  // brief > 8000
  assert.throws(
    () => validateFields({ brief: 'x'.repeat(8001) }),
    /Brief de video no válido\./
  );

  // brief null is accepted
  const validNullBrief = validateFields({ brief: null });
  assert.equal(validNullBrief.brief, null);

  // invalid branchId
  assert.throws(
    () => validateFields({ branchId: 'bad id with spaces!' }),
    /ID de rama no válido\./
  );
});
