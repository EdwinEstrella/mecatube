// Run with: node src/timeline/syncChosenIdea.test.mjs
import assert from 'node:assert/strict';
import { syncChosenIdea } from './syncChosenIdea.js';

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
  const updated = [];
  return {
    created,
    updated,
    listVideos: async () => videos,
    getActiveVideo: async () => active,
    createVideo: async (input) => {
      created.push(input);
      return { id: 'new', ...input };
    },
    updateVideo: async (id, patch) => {
      updated.push({ id, ...patch });
      return { id, ...patch };
    },
  };
}

const idea = { number: 1, title: 'Mi Idea Increible' };

await test('syncChosenIdea: already linked updates the video and does not call chooseTarget', async () => {
  const linked = { id: 'v-linked', scriptConversationId: 'c1', title: 'Antiguo Titulo', titleEdited: false };
  const api = fakeApi({ videos: [linked] });
  let calledChoose = false;
  const result = await syncChosenIdea(api, 'c1', idea, () => {
    calledChoose = true;
    return 'new';
  });
  assert.equal(calledChoose, false);
  assert.equal(api.created.length, 0);
  assert.deepEqual(api.updated, [{ id: 'v-linked', ideaNumber: 1, title: 'Mi Idea Increible', titleEdited: false }]);
  assert.equal(result.id, 'v-linked');
});

await test('syncChosenIdea: empty slot links without calling chooseTarget', async () => {
  const active = { id: 'v1', branchId: 'b-1', scriptConversationId: null };
  const api = fakeApi({ active });
  let calledChoose = false;
  const result = await syncChosenIdea(api, 'c1', idea, () => {
    calledChoose = true;
    return 'new';
  });
  assert.equal(calledChoose, false);
  assert.deepEqual(api.created, [{ title: 'Mi Idea Increible', scriptConversationId: 'c1', ideaNumber: 1 }]);
  assert.equal(result.id, 'new');
});

await test('syncChosenIdea: occupied slot + new calls createVideo with newVideo true and active branchId', async () => {
  const active = { id: 'v1', branchId: 'b-1', scriptConversationId: 'c-old' };
  const api = fakeApi({ active });
  let slotSeen = null;
  const result = await syncChosenIdea(api, 'c1', idea, async ({ slot, video: v }) => {
    slotSeen = slot;
    assert.equal(v.id, 'v1');
    return 'new';
  });
  assert.equal(slotSeen, 'script');
  assert.deepEqual(api.created, [
    { title: 'Mi Idea Increible', scriptConversationId: 'c1', ideaNumber: 1, newVideo: true, branchId: 'b-1' },
  ]);
  assert.equal(result.id, 'new');
});

await test('syncChosenIdea: occupied slot + current calls createVideo without newVideo', async () => {
  const active = { id: 'v1', branchId: 'b-1', scriptConversationId: 'c-old' };
  const api = fakeApi({ active });
  const result = await syncChosenIdea(api, 'c1', idea, async () => 'current');
  assert.deepEqual(api.created, [
    { title: 'Mi Idea Increible', scriptConversationId: 'c1', ideaNumber: 1 },
  ]);
  assert.equal(result.id, 'new');
});

await test('syncChosenIdea: occupied slot + null returns null and createVideo not called', async () => {
  const active = { id: 'v1', branchId: 'b-1', scriptConversationId: 'c-old' };
  const api = fakeApi({ active });
  const result = await syncChosenIdea(api, 'c1', idea, async () => null);
  assert.equal(result, null);
  assert.equal(api.created.length, 0);
});

await test('syncChosenIdea: occupied slot + no chooseTarget behaves as new', async () => {
  const active = { id: 'v1', branchId: 'b-1', scriptConversationId: 'c-old' };
  const api = fakeApi({ active });
  const result = await syncChosenIdea(api, 'c1', idea);
  assert.deepEqual(api.created, [
    { title: 'Mi Idea Increible', scriptConversationId: 'c1', ideaNumber: 1, newVideo: true, branchId: 'b-1' },
  ]);
  assert.equal(result.id, 'new');
});

await test('syncChosenIdea: returns null on missing arguments', async () => {
  const api = fakeApi();
  assert.equal(await syncChosenIdea(null, 'c1', idea), null);
  assert.equal(await syncChosenIdea(api, null, idea), null);
  assert.equal(await syncChosenIdea(api, 'c1', null), null);
});

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
