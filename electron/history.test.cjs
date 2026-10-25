// Run: node electron/history.test.cjs
// Resync alignment (pure), the conversation store repair, and the bridge history job driven by a ws
// client that plays the browser extension. Uses a temp directory and a local port only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { WebSocket } = require('ws');
const { createBridge } = require('./bridge.cjs');
const { createConversationStore, alignResync } = require('./conversations.cjs');

const PORT = 47990 + Math.floor(Math.random() * 9);
const URL = 'https://chat.deepseek.com/a/chat/s/abc-123';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let passed = 0;

async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok   ${name}`);
}

const msg = (role, content, id = `${role}-${content}`) => ({ id, role, content, createdAt: 1 });

(async () => {
  await test('alignResync replaces assistant content by position and never touches user messages', () => {
    const local = [msg('user', 'q1'), msg('assistant', 'cut'), msg('user', 'q2'), msg('assistant', 'same')];
    const remote = [
      { role: 'user', content: 'q1 (normalized)' },
      { role: 'assistant', content: 'complete answer' },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: 'same' },
    ];
    const result = alignResync(local, remote);
    assert.deepEqual(result.updates, [{ index: 1, content: 'complete answer' }]);
    assert.equal(result.updated, 1);
    assert.equal(result.aligned, 4);
  });

  await test('alignResync with different counts aligns from the start and deletes nothing', () => {
    const local = [msg('user', 'q1'), msg('assistant', 'a1'), msg('user', 'q2'), msg('assistant', 'a2')];
    const shorter = alignResync(local, [{ role: 'user', content: 'q1' }, { role: 'assistant', content: 'A1' }]);
    assert.equal(shorter.updated, 1);
    assert.deepEqual([shorter.localCount, shorter.remoteCount], [4, 2]);
    const longer = alignResync(local.slice(0, 2), [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'extra' },
      { role: 'assistant', content: 'extra answer' },
    ]);
    assert.equal(longer.updated, 1);
    assert.deepEqual(longer.updates, [{ index: 1, content: 'A1' }]);
  });

  await test('alignResync stops at the first role mismatch and ignores empty remote replies', () => {
    const local = [msg('user', 'q1'), msg('assistant', 'a1'), msg('assistant', 'a1b'), msg('user', 'q2')];
    const result = alignResync(local, [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'q2' },
    ]);
    assert.equal(result.updated, 0);
    assert.equal(result.aligned, 2);
    assert.deepEqual(alignResync(undefined, undefined).updates, []);
  });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mecatube-history-'));
  const store = createConversationStore(dir);

  await test('applyRemoteHistory keeps ids and timestamps and does not bump the conversation', () => {
    const conversation = store.create();
    store.appendMessage(conversation.id, 'user', 'q');
    const reply = store.appendMessage(conversation.id, 'assistant', 'truncated');
    const before = store.get(conversation.id);
    const summary = store.applyRemoteHistory(conversation.id, [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'complete ```text\nbody\n```' },
    ]);
    assert.deepEqual(summary, { updated: 1, aligned: 2, localCount: 2, remoteCount: 2 });
    const after = store.get(conversation.id);
    assert.equal(after.messages[1].id, reply.id);
    assert.equal(after.messages[1].createdAt, reply.createdAt);
    assert.equal(after.messages[1].content, 'complete ```text\nbody\n```');
    assert.equal(after.updatedAt, before.updatedAt);
    assert.equal(store.applyRemoteHistory(conversation.id, after.messages).updated, 0);
    assert.throws(() => store.applyRemoteHistory('missing', []), /Conversación no encontrada/);
  });

  const bridge = createBridge({ port: PORT });
  bridge.start();
  const received = [];
  const connect = async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${PORT}`, { headers: { Origin: 'chrome-extension://abcdefghijklmnop' } });
    socket.on('message', (raw) => received.push(JSON.parse(raw.toString())));
    await new Promise((resolve, reject) => {
      socket.on('open', resolve);
      socket.on('error', reject);
    });
    return socket;
  };

  await test('requestHistory rejects when the extension is not connected', async () => {
    await assert.rejects(bridge.requestHistory({ deepseekUrl: URL }), /no está conectada/);
  });

  let ext = await connect();
  for (let i = 0; i < 100 && !bridge.isConnected(); i += 1) await sleep(20);

  await test('requestHistory sends the job and resolves with the sanitized messages', async () => {
    const generalMessages = [];
    bridge.onMessage((message) => generalMessages.push(message));
    const promise = bridge.requestHistory({ deepseekUrl: URL });
    for (let i = 0; i < 100 && received.length === 0; i += 1) await sleep(20);
    assert.equal(received[0].type, 'deepseek-history');
    assert.equal(received[0].deepseekUrl, URL);
    const messages = [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }];
    ext.send(JSON.stringify({ type: 'history', requestId: received[0].requestId, messages }));
    assert.deepEqual(await promise, messages);
    assert.deepEqual(generalMessages, [], 'history replies must not reach the general listeners');
  });

  await test('history-error, malformed replies and timeouts reject', async () => {
    received.length = 0;
    let promise = bridge.requestHistory({ deepseekUrl: URL });
    for (let i = 0; i < 100 && received.length === 0; i += 1) await sleep(20);
    ext.send(JSON.stringify({ type: 'history-error', requestId: received[0].requestId, message: 'DeepSeek está ocupado' }));
    await assert.rejects(promise, /ocupado/);

    received.length = 0;
    promise = bridge.requestHistory({ deepseekUrl: URL });
    for (let i = 0; i < 100 && received.length === 0; i += 1) await sleep(20);
    ext.send(JSON.stringify({ type: 'history', requestId: received[0].requestId, messages: [{ role: 'system', content: 'x' }] }));
    await assert.rejects(promise, /formato inesperado/);

    await assert.rejects(bridge.requestHistory({ deepseekUrl: URL, timeoutMs: 50 }), /tardó demasiado/);
  });

  await test('a disconnect rejects the pending request and a replaced connection reports a disconnect first', async () => {
    received.length = 0;
    const promise = bridge.requestHistory({ deepseekUrl: URL });
    for (let i = 0; i < 100 && received.length === 0; i += 1) await sleep(20);
    const statuses = [];
    bridge.onStatusChange((connected) => statuses.push(connected));
    const replacement = await connect();
    await assert.rejects(promise, /reinició/);
    assert.deepEqual(statuses.slice(0, 2), [false, true]);
    ext = replacement;

    received.length = 0;
    const second = bridge.requestHistory({ deepseekUrl: URL });
    for (let i = 0; i < 100 && received.length === 0; i += 1) await sleep(20);
    ext.close();
    await assert.rejects(second, /desconectó/);
  });

  bridge.stop();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${passed} passed`);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
