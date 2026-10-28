// Run with: node src/flow/illustratorVideo.test.mjs
import assert from 'node:assert/strict';
import { ensureIllustratorVideo } from './illustratorVideo.js';

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n     ${error.message}`);
  }
}

function fakeApi({ videos = [], active = null } = {}) {
  const created = [];
  return {
    created,
    listVideos: async () => videos,
    getActiveVideo: async () => active,
    createVideo: async (input) => {
      created.push(input);
      return { id: 'new', ...input };
    },
  };
}

await test('ensureIllustratorVideo: already linked reuses existing video without calling chooseTarget', async () => {
  const linked = { id: 'v-illus', illustratorConversationId: 'chat-1' };
  const api = fakeApi({ videos: [linked] });
  let calledChoose = false;
  const result = await ensureIllustratorVideo(api, 'chat-1', 'Titulo', () => {
    calledChoose = true;
    return 'new';
  });
  assert.equal(calledChoose, false);
  assert.equal(api.created.length, 0);
  assert.equal(result.id, 'v-illus');
});

await test('ensureIllustratorVideo: empty slot links without calling chooseTarget', async () => {
  const active = { id: 'v1', branchId: 'b-1', illustratorConversationId: null };
  const api = fakeApi({ active });
  let calledChoose = false;
  const result = await ensureIllustratorVideo(api, 'chat-1', 'Mi Ilustracion', () => {
    calledChoose = true;
    return 'new';
  });
  assert.equal(calledChoose, false);
  assert.deepEqual(api.created, [{ title: 'Mi Ilustracion', illustratorConversationId: 'chat-1' }]);
  assert.equal(result.id, 'new');
});

await test('ensureIllustratorVideo: occupied slot + new calls createVideo with newVideo true and active branchId', async () => {
  const active = { id: 'v1', branchId: 'b-1', illustratorConversationId: 'chat-old' };
  const api = fakeApi({ active });
  let slotSeen = null;
  const result = await ensureIllustratorVideo(api, 'chat-1', 'Mi Ilustracion', async ({ slot, video: v }) => {
    slotSeen = slot;
    assert.equal(v.id, 'v1');
    return 'new';
  });
  assert.equal(slotSeen, 'illustrator');
  assert.deepEqual(api.created, [
    { title: 'Mi Ilustracion', illustratorConversationId: 'chat-1', newVideo: true, branchId: 'b-1' },
  ]);
  assert.equal(result.id, 'new');
});

await test('ensureIllustratorVideo: occupied slot + current calls createVideo without newVideo', async () => {
  const active = { id: 'v1', branchId: 'b-1', illustratorConversationId: 'chat-old' };
  const api = fakeApi({ active });
  const result = await ensureIllustratorVideo(api, 'chat-1', 'Mi Ilustracion', async () => 'current');
  assert.deepEqual(api.created, [
    { title: 'Mi Ilustracion', illustratorConversationId: 'chat-1' },
  ]);
  assert.equal(result.id, 'new');
});

await test('ensureIllustratorVideo: occupied slot + null returns null and createVideo not called', async () => {
  const active = { id: 'v1', branchId: 'b-1', illustratorConversationId: 'chat-old' };
  const api = fakeApi({ active });
  const result = await ensureIllustratorVideo(api, 'chat-1', 'Mi Ilustracion', async () => null);
  assert.equal(result, null);
  assert.equal(api.created.length, 0);
});

await test('ensureIllustratorVideo: occupied slot + no chooseTarget behaves as new', async () => {
  const active = { id: 'v1', branchId: 'b-1', illustratorConversationId: 'chat-old' };
  const api = fakeApi({ active });
  const result = await ensureIllustratorVideo(api, 'chat-1', 'Mi Ilustracion');
  assert.deepEqual(api.created, [
    { title: 'Mi Ilustracion', illustratorConversationId: 'chat-1', newVideo: true, branchId: 'b-1' },
  ]);
  assert.equal(result.id, 'new');
});

await test('ensureIllustratorVideo: refuses without conversation', async () => {
  const api = fakeApi();
  await assert.rejects(ensureIllustratorVideo(api, null), /conversación guardada/);
  await assert.rejects(ensureIllustratorVideo(null, 'chat-1'), /conversación guardada/);
});

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
