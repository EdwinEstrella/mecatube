// Run: node electron/purge.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createConversationStore } = require('./conversations.cjs');
const { createVideoStore } = require('./videos.cjs');
const { createConversationPurger, BUSY_MESSAGE } = require('./purge.cjs');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok   ${name}`);
}

function setup(isVideoBusy) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mecatube-purge-'));
  fs.mkdirSync(path.join(dir, 'conversations'));
  fs.mkdirSync(path.join(dir, 'videos'));
  const conversations = createConversationStore(path.join(dir, 'conversations'));
  const videos = createVideoStore(dir);
  const purger = createConversationPurger({ conversations, videos, workspaceDir: dir, isVideoBusy });
  return { dir, conversations, videos, purger };
}

function seedVideoFiles(dir, id) {
  const base = path.join(dir, 'videos', id);
  for (const sub of ['characters', 'scenes', 'animations', 'voice']) fs.mkdirSync(path.join(base, sub), { recursive: true });
  fs.writeFileSync(path.join(base, 'characters', 'a.png'), 'x');
  fs.writeFileSync(path.join(base, 'scenes', '1.png'), 'x');
  fs.writeFileSync(path.join(base, 'animations', '1.mp4'), 'x');
  fs.writeFileSync(path.join(base, 'voice', 'narration.wav'), 'x');
  fs.writeFileSync(path.join(base, 'characters.json'), '[]');
  fs.writeFileSync(path.join(base, 'scenes.json'), '[]');
  fs.writeFileSync(path.join(base, 'animations.json'), '[]');
  return base;
}

test('removes conversation, linked video record and folder (script link)', () => {
  const { dir, conversations, videos, purger } = setup();
  const conv = conversations.create();
  const video = videos.create({ branchId: 'b-1', scriptConversationId: conv.id });
  const base = seedVideoFiles(dir, video.id);
  const result = purger.purge(conv.id);
  assert.deepEqual(result.removedVideoIds, [video.id]);
  assert.equal(fs.existsSync(base), false);
  assert.equal(conversations.get(conv.id), null);
  assert.ok(videos.list().every((v) => v.id !== video.id));
});

test('removes data linked through the illustrator conversation too', () => {
  const { dir, conversations, videos, purger } = setup();
  const conv = conversations.create();
  const video = videos.create({ branchId: 'b-1', illustratorConversationId: conv.id });
  const base = seedVideoFiles(dir, video.id);
  purger.purge(conv.id);
  assert.equal(fs.existsSync(base), false);
});

test('leaves unrelated videos and conversations intact', () => {
  const { dir, conversations, videos, purger } = setup();
  const keep = conversations.create();
  const gone = conversations.create();
  const video = videos.create({ branchId: 'b-1', scriptConversationId: keep.id });
  const base = seedVideoFiles(dir, video.id);
  const otherBase = seedVideoFiles(dir, 'other-video');
  const result = purger.purge(gone.id);
  assert.deepEqual(result.removedVideoIds, []);
  assert.equal(fs.existsSync(base), true);
  assert.equal(fs.existsSync(otherBase), true);
  assert.ok(conversations.get(keep.id));
  assert.equal(videos.list()[0].id, video.id);
});

test('rejects bad conversation ids and never deletes outside videos dir', () => {
  const { dir, purger, videos } = setup();
  const sentinel = path.join(dir, 'keep.txt');
  fs.writeFileSync(sentinel, 'x');
  videos.create({ branchId: 'b-1' });
  for (const bad of ['../x', '..', 'a/b', '', null, undefined, 42, 'a'.repeat(101)]) {
    assert.throws(() => purger.purge(bad), /no válido/);
  }
  assert.equal(fs.existsSync(sentinel), true);
  assert.equal(videos.list().length, 1);
});

test('refuses with a Spanish error while a job runs and deletes nothing', () => {
  const state = { busy: true };
  const { dir, conversations, videos, purger } = setup(() => state.busy);
  const conv = conversations.create();
  const video = videos.create({ branchId: 'b-1', scriptConversationId: conv.id });
  const base = seedVideoFiles(dir, video.id);
  assert.throws(() => purger.purge(conv.id), (e) => e.message === BUSY_MESSAGE);
  assert.ok(conversations.get(conv.id));
  assert.equal(fs.existsSync(base), true);
  state.busy = false;
  purger.purge(conv.id);
});

test('a new illustrator chat clears the previous illustration data but keeps voice', () => {
  const { dir, videos, purger } = setup();
  const video = purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'chat-old', scriptConversationId: 'script-1' });
  videos.update(video.id, { flowProjectUrl: 'https://flow.google.com/project/0b26cd23-4905-4d18-b424-1f866cb36e99' });
  const base = seedVideoFiles(dir, video.id);
  const relinked = purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'chat-new' });
  assert.ok(relinked.id);
  assert.equal(relinked.illustratorConversationId, 'chat-new');
  assert.equal(relinked.flowProjectUrl, null);
  for (const entry of ['characters', 'scenes', 'animations', 'characters.json', 'scenes.json', 'animations.json']) {
    assert.equal(fs.existsSync(path.join(base, entry)), false, entry);
  }
  assert.equal(fs.existsSync(path.join(base, 'voice', 'narration.wav')), true);
});

test('re-linking the same illustrator chat or a first link keeps the data', () => {
  const { dir, purger } = setup();
  const video = purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'chat-1' });
  const base = seedVideoFiles(dir, video.id);
  purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'chat-1' });
  purger.linkIllustrator({ branchId: 'b-1', scriptConversationId: 'script-9' });
  assert.equal(fs.existsSync(path.join(base, 'scenes', '1.png')), true);
});

test('a new illustrator chat is refused while a generation runs for the video', () => {
  const state = { busy: false };
  const { dir, purger } = setup(() => state.busy);
  const video = purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'chat-old' });
  const base = seedVideoFiles(dir, video.id);
  state.busy = true;
  assert.throws(() => purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'chat-new' }), { message: BUSY_MESSAGE });
  assert.equal(fs.existsSync(path.join(base, 'scenes', '1.png')), true);
});

test('script link then illustrator link land on the same video', () => {
  const { videos, purger } = setup();
  const v1 = purger.linkIllustrator({ branchId: 'b-1', scriptConversationId: 'script-1', title: 'Idea 1' });
  assert.equal(videos.list().length, 1);
  assert.equal(v1.scriptConversationId, 'script-1');
  assert.equal(v1.illustratorConversationId, null);
  assert.equal(videos.getActive().id, v1.id);

  const v2 = purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'illustrator-1' });
  assert.equal(videos.list().length, 1);
  assert.equal(v2.id, v1.id);
  assert.equal(v2.scriptConversationId, 'script-1');
  assert.equal(v2.illustratorConversationId, 'illustrator-1');
  assert.equal(videos.getActive().id, v1.id);
});

test('newVideo: true creates a second video that becomes active', () => {
  const { videos, purger } = setup();
  const v1 = purger.linkIllustrator({ branchId: 'b-1', scriptConversationId: 'script-1' });
  assert.equal(videos.getActive().id, v1.id);

  const v2 = purger.linkIllustrator({ newVideo: true, branchId: 'b-1', scriptConversationId: 'script-2' });
  assert.equal(videos.list().length, 2);
  assert.notEqual(v2.id, v1.id);
  assert.equal(v2.scriptConversationId, 'script-2');
  assert.equal(videos.getActive().id, v2.id);
  assert.equal(v2.newVideo, undefined);
});

test('illustrator relink purge operates specifically on the active video among multiple videos', () => {
  const { dir, videos, purger } = setup();
  const v1 = purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'chat-v1' });
  seedVideoFiles(dir, v1.id);

  const v2 = purger.linkIllustrator({ newVideo: true, branchId: 'b-1', illustratorConversationId: 'chat-v2-old' });
  videos.update(v2.id, { flowProjectUrl: 'https://flow.google.com/project/0b26cd23-4905-4d18-b424-1f866cb36e99' });
  const v2Base = seedVideoFiles(dir, v2.id);
  const v1Base = path.join(dir, 'videos', v1.id);

  assert.equal(videos.getActive().id, v2.id);

  const relinked = purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'chat-v2-new' });
  assert.equal(relinked.id, v2.id);
  assert.equal(relinked.illustratorConversationId, 'chat-v2-new');
  assert.equal(relinked.flowProjectUrl, null);

  for (const entry of ['characters', 'scenes', 'animations', 'characters.json', 'scenes.json', 'animations.json']) {
    assert.equal(fs.existsSync(path.join(v2Base, entry)), false, entry);
  }
  assert.equal(fs.existsSync(path.join(v1Base, 'scenes', '1.png')), true);
});

test('title semantics: link that brings title does not mark titleEdited and never overwrites user edited title', () => {
  const { videos, purger } = setup();

  const v = purger.linkIllustrator({ branchId: 'b-1', title: 'Idea 1', scriptConversationId: 'script-1' });
  assert.equal(v.title, 'Idea 1');
  assert.equal(v.titleEdited, false);

  const v2 = purger.linkIllustrator({ branchId: 'b-1', title: 'Idea 1 Modificada', illustratorConversationId: 'illus-1' });
  assert.equal(v2.id, v.id);
  assert.equal(v2.title, 'Idea 1 Modificada');
  assert.equal(v2.titleEdited, false);

  videos.update(v.id, { title: 'User Custom Title' });
  const edited = videos.getActive();
  assert.equal(edited.title, 'User Custom Title');
  assert.equal(edited.titleEdited, true);

  const v3 = purger.linkIllustrator({ branchId: 'b-1', title: 'Idea 1 Overwrite Attempt' });
  assert.equal(v3.id, v.id);
  assert.equal(v3.title, 'User Custom Title');
  assert.equal(v3.titleEdited, true);

  const v4 = purger.linkIllustrator({ branchId: 'branch-other', illustratorConversationId: 'illus-2' });
  assert.equal(v4.branchId, 'b-1');
});

test('linkIllustrator with newVideo: true creates a new video without purging existing active video files', () => {
  const { dir, videos, purger } = setup();
  const v1 = purger.linkIllustrator({ branchId: 'b-1', illustratorConversationId: 'chat-v1' });
  const v1Base = seedVideoFiles(dir, v1.id);

  const v2 = purger.linkIllustrator({ newVideo: true, branchId: 'b-1', illustratorConversationId: 'chat-v2' });
  assert.notEqual(v2.id, v1.id);
  assert.equal(videos.getActive().id, v2.id);
  assert.equal(fs.existsSync(path.join(v1Base, 'scenes', '1.png')), true);
  assert.equal(v2.newVideo, undefined);
});

console.log(`\n${passed} passed`);
