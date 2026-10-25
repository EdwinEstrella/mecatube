// Run: node electron/flow.test.cjs
// Drives the real bridge with a ws client that plays the browser extension, then checks storage on
// disk and the media protocol handler. Uses a temp directory and a local port only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { WebSocket } = require('ws');
const { createBridge } = require('./bridge.cjs');
const { createVideoStore } = require('./videos.cjs');
const { createFlowStore, createFlowService } = require('./flow.cjs');
const { createMediaHandler } = require('./voice-ipc.cjs');

const PORT = 47900 + Math.floor(Math.random() * 90);
const PROJECT = 'https://flow.google.com/project/12345678-1234-1234-1234-123456789abc';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WEBP = Buffer.from('RIFFxxxxWEBPfake-image-bytes');
const results = [];

async function test(name, fn) {
  await fn();
  results.push(name);
  console.log(`ok   ${name}`);
}

async function waitUntil(check, label) {
  for (let i = 0; i < 100; i += 1) {
    if (check()) return;
    await sleep(20);
  }
  throw new Error(`Timed out: ${label}`);
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mecatube-flow-'));
  const bridge = createBridge({ port: PORT });
  bridge.start();
  const videos = createVideoStore(dir);
  const store = createFlowStore(dir);
  const pushed = [];
  const service = createFlowService({ bridge, store, videos, pushToWindow: (channel, payload) => pushed.push([channel, payload]), jobTimeoutMs: 60000 });
  const media = createMediaHandler({ wavPath: () => '', voiceoverWavPath: () => '' }, { characterFile: store.filePath });
  const video = videos.create({ title: 'Test video' });
  const request = (url) => media({ url, headers: new Headers() });

  // The extension: connects with a chrome-extension origin and records what it receives
  const received = [];
  const ext = new WebSocket(`ws://127.0.0.1:${PORT}`, { headers: { Origin: 'chrome-extension://abcdefghijklmnop' } });
  ext.on('message', (raw) => received.push(JSON.parse(raw.toString())));
  await new Promise((resolve, reject) => {
    ext.on('open', resolve);
    ext.on('error', reject);
  });
  await waitUntil(() => bridge.isConnected(), 'bridge connected');

  const generate = (overrides = {}) =>
    service.generate({ videoId: video.id, characterKey: 'personaje-1-tomas', name: 'Personaje 1 — Tomás', role: 'Cazador.', prompt: 'Line one\nLine two', ...overrides });

  await test('rejects a web page origin', async () => {
    const evil = new WebSocket(`ws://127.0.0.1:${PORT}`, { headers: { Origin: 'https://evil.com' } });
    await new Promise((resolve) => {
      evil.on('error', resolve);
      evil.on('unexpected-response', resolve);
      evil.on('open', () => {
        assert.fail('evil origin was accepted');
      });
    });
  });

  await test('new project: flow-generate goes out with projectUrl null and the exact prompt', async () => {
    const { requestId } = generate();
    await waitUntil(() => received.length === 1, 'job received');
    assert.deepEqual(received[0], { type: 'flow-generate', requestId, prompt: 'Line one\nLine two', projectUrl: null });

    assert.throws(() => generate({ characterKey: 'otro' }), /already running/);
    assert.deepEqual(service.status(), { busy: true, videoId: video.id, characterKey: 'personaje-1-tomas' });

    ext.send(JSON.stringify({ type: 'flow-project', requestId, projectUrl: PROJECT }));
    ext.send(JSON.stringify({ type: 'flow-progress', requestId, percent: 42 }));
    ext.send(JSON.stringify({ type: 'flow-captcha', requestId, active: true }));
    ext.send(JSON.stringify({ type: 'flow-captcha', requestId, active: false }));
    ext.send(JSON.stringify({ type: 'flow-progress', requestId: 'someone-else', percent: 99 }));
    ext.send(
      JSON.stringify({
        type: 'flow-result',
        requestId,
        projectUrl: PROJECT,
        images: [
          { mime: 'image/webp', base64: WEBP.toString('base64'), width: 1376, height: 768, sourceUrl: 'https://flow.google.com/asb/a' },
          { mime: 'image/webp', base64: WEBP.toString('base64'), width: 1376, height: 768, sourceUrl: 'https://flow.google.com/asb/b' },
        ],
      }),
    );
    await waitUntil(() => pushed.some(([channel]) => channel === 'flow:result'), 'result pushed');

    const channels = pushed.map(([channel]) => channel);
    assert.deepEqual(channels, ['flow:progress', 'flow:progress', 'flow:captcha', 'flow:captcha', 'flow:result']);
    assert.equal(pushed[1][1].percent, 42);
    assert.equal(pushed[2][1].active, true);
    assert.equal(pushed[3][1].active, false);
    assert.equal(service.status().busy, false);
    assert.equal(videos.list()[0].flowProjectUrl, PROJECT);
  });

  let character;
  await test('images and characters.json are stored atomically under the video', async () => {
    [character] = store.list(video.id);
    assert.equal(character.key, 'personaje-1-tomas');
    assert.equal(character.prompt, 'Line one\nLine two');
    assert.equal(character.selectedFile, null);
    assert.equal(character.approved, false);
    assert.equal(character.generations.length, 1);
    const [generation] = character.generations;
    assert.equal(generation.projectUrl, PROJECT);
    assert.equal(generation.files.length, 2);
    for (const file of generation.files) {
      assert.match(file, /^\d{13}-\d\.webp$/);
      const stored = path.join(dir, 'videos', video.id, 'characters', 'personaje-1-tomas', file);
      assert.deepEqual(fs.readFileSync(stored), WEBP);
    }
    assert.ok(fs.existsSync(path.join(dir, 'videos', video.id, 'characters.json')));
    assert.deepEqual(
      fs.readdirSync(path.join(dir, 'videos', video.id)).filter((name) => name.endsWith('.tmp')),
      [],
    );
  });

  await test('regenerate reuses the stored project URL and keeps earlier generations', async () => {
    received.length = 0;
    const { requestId } = generate();
    await waitUntil(() => received.length === 1, 'second job');
    assert.equal(received[0].projectUrl, PROJECT);
    ext.send(
      JSON.stringify({ type: 'flow-result', requestId, projectUrl: PROJECT, images: [{ mime: 'image/png', base64: WEBP.toString('base64') }] }),
    );
    await waitUntil(() => !service.status().busy, 'second result');
    [character] = store.list(video.id);
    assert.equal(character.generations.length, 2);
    assert.match(character.generations[1].files[0], /\.png$/);
  });

  await test('select / approve rules', async () => {
    assert.throws(() => store.setApproved(video.id, undefined, true), /Select an image/);
    assert.throws(() => store.select(video.id, character.key, '1700000000000-9.webp'), /does not belong/);
    const file = character.generations[0].files[1];
    assert.equal(store.select(video.id, character.key, file).selectedFile, file);
    assert.equal(store.setApproved(video.id, [character.key], true)[0].approved, true);
    // choosing another image drops the approval
    assert.equal(store.select(video.id, character.key, character.generations[0].files[0]).approved, false);
  });

  await test('media protocol serves stored images with the right type', async () => {
    const file = character.generations[0].files[0];
    const response = await request(`mecatube-media://character/${video.id}/${character.key}/${file}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), WEBP);
    const png = await request(`mecatube-media://character/${video.id}/${character.key}/${character.generations[1].files[0]}`);
    assert.equal(png.headers.get('content-type'), 'image/png');
  });

  await test('media protocol rejects traversal and malformed paths', async () => {
    const file = character.generations[0].files[0];
    const bad = [
      `mecatube-media://character/${video.id}/..%2F..%2Fcharacters.json/${file}`,
      `mecatube-media://character/${video.id}/${character.key}/..%2F..%2F..%2Fvideos.json`,
      `mecatube-media://character/${video.id}/${character.key}/..%5C..%5Cx.webp`,
      `mecatube-media://character/..%2F${video.id}/${character.key}/${file}`,
      `mecatube-media://character/${video.id}/${character.key}/notes.txt`,
      `mecatube-media://character/${video.id}/${character.key}`,
      `mecatube-media://character/${video.id}/${character.key}/${file}/extra`,
      `mecatube-media://character/${video.id}/UPPER/${file}`,
      `mecatube-media://character/${video.id}/missing/1700000000000-1.webp`,
      `mecatube-media://other/${video.id}`,
    ];
    for (const url of bad) assert.equal((await request(url)).status, 404, url);
  });

  await test('store validation: ids, keys, mime and payload', async () => {
    for (const id of ['../x', 'a/b', '', 'x'.repeat(101)]) assert.throws(() => store.list(id), /Invalid video id/);
    for (const key of ['Up', '../x', 'a b', '', 'k'.repeat(65)]) {
      assert.throws(() => store.upsert(video.id, { key, name: 'n', role: '', prompt: 'p' }), /Invalid character key/);
    }
    assert.throws(() => store.addGeneration(video.id, 'personaje-1-tomas', { images: [{ mime: 'text/html', base64: 'AAAA' }] }), /Unsupported/);
    assert.throws(() => store.addGeneration(video.id, 'personaje-1-tomas', { images: [] }), /no usable images/);
    assert.throws(() => store.addGeneration(video.id, 'nobody', { images: [{ mime: 'image/webp', base64: 'AAAA' }] }), /not found/);
    assert.throws(() => store.upsert(video.id, { key: 'ok', name: 'n', role: '', prompt: '   ' }), /empty/);
  });

  await test('flow-error and a disconnect fail the job; bad project URLs are refused', async () => {
    pushed.length = 0;
    let { requestId } = generate();
    ext.send(JSON.stringify({ type: 'flow-error', requestId, message: 'Flow prompt box not found.' }));
    await waitUntil(() => pushed.some(([channel]) => channel === 'flow:error'), 'error pushed');
    assert.equal(pushed.at(-1)[1].message, 'Flow prompt box not found.');
    assert.equal(service.status().busy, false);

    ({ requestId } = generate());
    ext.close();
    await waitUntil(() => !service.status().busy, 'disconnect');
    assert.match(pushed.at(-1)[1].message, /disconnected/);
    assert.throws(() => generate(), /not connected/);

    assert.throws(() => service.setProject(video.id, 'https://evil.com/project/12345678-1234-1234-1234-123456789abc'), /Invalid Flow project URL/);
    assert.throws(() => service.setProject(video.id, `${PROJECT}/edit/x`), /Invalid Flow project URL/);
    assert.equal(service.setProject(video.id, ' ').flowProjectUrl, null);
    assert.equal(service.setProject(video.id, PROJECT).flowProjectUrl, PROJECT);
    assert.equal(service.projectUrl(video.id), PROJECT);
  });

  await test('watchdog: a job that never answers fails, frees the UI, and late messages are ignored', async () => {
    let listener = null;
    const fakeBridge = { isConnected: () => true, sendFlowJob: () => {}, onMessage: (fn) => (listener = fn), onStatusChange: () => {} };
    const events = [];
    const watched = createFlowService({ bridge: fakeBridge, store, videos, pushToWindow: (c, p) => events.push([c, p]), jobTimeoutMs: 80 });
    const { requestId } = watched.generate({ videoId: video.id, characterKey: 'personaje-1-tomas', name: 'n', role: '', prompt: 'p' });
    assert.equal(watched.status().busy, true);
    await waitUntil(() => !watched.status().busy, 'watchdog');
    const error = events.find(([channel]) => channel === 'flow:error');
    assert.ok(error, 'flow:error must be pushed');
    assert.equal(error[1].characterKey, 'personaje-1-tomas');
    assert.match(error[1].message, /tardó demasiado/);
    // The extension answering after the watchdog must not resurrect the job or store images
    const before = store.list(video.id)[0].generations.length;
    listener({ type: 'flow-result', requestId, images: [{ mime: 'image/webp', base64: WEBP.toString('base64') }] });
    assert.equal(store.list(video.id)[0].generations.length, before);
    // and a new job can start right away
    watched.generate({ videoId: video.id, characterKey: 'personaje-1-tomas', name: 'n', role: '', prompt: 'p' });
    assert.equal(watched.status().busy, true);
    await waitUntil(() => !watched.status().busy, 'second watchdog');
  });

  await test('the extension\'s start-failure error reaches the UI verbatim and submitMethod is stored', async () => {
    let listener = null;
    const fakeBridge = { isConnected: () => true, sendFlowJob: () => {}, onMessage: (fn) => (listener = fn), onStatusChange: () => {} };
    const events = [];
    const relayed = createFlowService({ bridge: fakeBridge, store, videos, pushToWindow: (c, p) => events.push([c, p]), jobTimeoutMs: 60000 });
    let { requestId } = relayed.generate({ videoId: video.id, characterKey: 'personaje-1-tomas', name: 'n', role: '', prompt: 'p' });
    const text = 'Flow no empezó a generar (el botón de generar no respondió).';
    listener({ type: 'flow-error', requestId, message: text });
    assert.deepEqual(events.at(-1), ['flow:error', { videoId: video.id, characterKey: 'personaje-1-tomas', message: text }]);
    assert.equal(relayed.status().busy, false);

    ({ requestId } = relayed.generate({ videoId: video.id, characterKey: 'personaje-1-tomas', name: 'n', role: '', prompt: 'p' }));
    listener({ type: 'flow-result', requestId, projectUrl: PROJECT, submitMethod: 'pointer-sequence', images: [{ mime: 'image/webp', base64: WEBP.toString('base64') }] });
    const generations = store.list(video.id)[0].generations;
    assert.equal(generations.at(-1).submitMethod, 'pointer-sequence');
    listener({ type: 'flow-error', requestId: 'x', message: 'ignored' });
    assert.equal(events.at(-1)[0], 'flow:result');
  });

  bridge.stop();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${results.length} passed`);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
