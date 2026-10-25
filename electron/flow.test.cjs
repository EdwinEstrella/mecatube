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
const { createFlowStore, createFlowService, scenePromptForFlow } = require('./flow.cjs');
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
    assert.deepEqual(received[0], {
      type: 'flow-generate',
      requestId,
      prompt: 'Line one\nLine two',
      projectUrl: null,
      model: 'nano-banana-pro',
      outputs: 2,
      references: [],
    });

    assert.throws(() => generate({ characterKey: 'otro' }), /otra generación de Flow en curso/);
    assert.deepEqual(service.status(), {
      busy: true,
      videoId: video.id,
      characterKey: 'personaje-1-tomas',
      scenes: { busy: false, running: null, pending: 0 },
    });

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
    assert.throws(() => store.setApproved(video.id, undefined, true), /selecciona una imagen/);
    assert.throws(() => store.select(video.id, character.key, '1700000000000-9.webp'), /no pertenece/);
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
    for (const id of ['../x', 'a/b', '', 'x'.repeat(101)]) assert.throws(() => store.list(id), /ID de video no válido/);
    for (const key of ['Up', '../x', 'a b', '', 'k'.repeat(65)]) {
      assert.throws(() => store.upsert(video.id, { key, name: 'n', role: '', prompt: 'p' }), /Clave de personaje no válida/);
    }
    assert.throws(() => store.addGeneration(video.id, 'personaje-1-tomas', { images: [{ mime: 'text/html', base64: 'AAAA' }] }), /no compatible/);
    assert.throws(() => store.addGeneration(video.id, 'personaje-1-tomas', { images: [] }), /imágenes utilizables/);
    assert.throws(() => store.addGeneration(video.id, 'nobody', { images: [{ mime: 'image/webp', base64: 'AAAA' }] }), /Personaje no encontrado/);
    assert.throws(() => store.upsert(video.id, { key: 'ok', name: 'n', role: '', prompt: '   ' }), /vacío/);
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
    assert.match(pushed.at(-1)[1].message, /se desconectó/);
    assert.throws(() => generate(), /no está conectada/);

    assert.throws(() => service.setProject(video.id, 'https://evil.com/project/12345678-1234-1234-1234-123456789abc'), /URL del proyecto de Flow no válida/);
    assert.throws(() => service.setProject(video.id, `${PROJECT}/edit/x`), /URL del proyecto de Flow no válida/);
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

  // --- Scenes: serial queue, references, cancel ---
  // A video owns its characters, and a workspace has a single video: scenes get their own workspace
  const sceneRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mecatube-scenes-'));
  const sceneVideos = createVideoStore(sceneRoot);
  const sceneStore = createFlowStore(sceneRoot);
  const sceneVideo = sceneVideos.create({ title: 'Scenes video' });
  const sent = [];
  let sceneListener = null;
  let statusListener = null;
  let connected = true;
  const sceneBridge = {
    isConnected: () => connected,
    sendFlowJob: (job) => sent.push(job),
    onMessage: (fn) => (sceneListener = fn),
    onStatusChange: (fn) => (statusListener = fn),
  };
  const sceneEvents = [];
  const sceneService = createFlowService({ bridge: sceneBridge, store: sceneStore, videos: sceneVideos, pushToWindow: (c, p) => sceneEvents.push([c, p]), jobTimeoutMs: 60000 });
  const states = (number) => sceneEvents.filter(([c, p]) => c === 'flow:scene-status' && p.number === number).map(([, p]) => p.state);
  const image = { mime: 'image/webp', base64: WEBP.toString('base64') };
  const finish = (job, extra = {}) => sceneListener({ type: 'flow-result', requestId: job.requestId, projectUrl: PROJECT, images: [image, image], ...extra });
  const scene = (number, sheetRefs = [], prompt = `scene ${number}`) => ({ number, title: `Escena ${number}`, prompt, sheetRefs });

  sceneStore.upsert(sceneVideo.id, { key: 'personaje-1-tomas', name: 'Personaje 1 — Tomás (protagonista)', role: '', prompt: 'sheet 1' });
  sceneStore.upsert(sceneVideo.id, { key: 'personaje-2-ana', name: 'Personaje 2 — Ana', role: '', prompt: 'sheet 2' });
  sceneStore.addGeneration(sceneVideo.id, 'personaje-1-tomas', { images: [{ mime: 'image/png', base64: 'AQID' }, image] });
  const [tomas] = sceneStore.list(sceneVideo.id);
  sceneStore.select(sceneVideo.id, 'personaje-1-tomas', tomas.generations[0].files[0]);

  await test('scene queue is serial: the next job goes out only after the previous result', async () => {
    const { queued } = sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(1, ['1']), scene(2, ['1']), scene(3)] });
    assert.equal(queued, 3);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].prompt, 'scene 1');
    assert.deepEqual(states(2), ['queued']);
    assert.deepEqual(sceneService.status().scenes, { busy: true, running: 1, pending: 2 });
    // a duplicate request for a queued or running scene is ignored
    assert.equal(sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(2), scene(1)] }).queued, 0);

    sceneListener({ type: 'flow-progress', requestId: sent[0].requestId, percent: 55 });
    assert.equal(sceneEvents.filter(([c]) => c === 'flow:progress').length, 0, 'scene traffic must not reach the character cards');
    assert.equal(sceneEvents.findLast(([c, p]) => c === 'flow:scene-status' && p.number === 1)[1].percent, 55);

    finish(sent[0]);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].prompt, 'scene 2');
    assert.deepEqual(states(1), ['queued', 'running', 'running', 'done']);
    const stored = sceneStore.listScenes(sceneVideo.id);
    assert.deepEqual(stored.map((item) => item.number), [1]);
    assert.equal(stored[0].generations[0].files.length, 2);
    assert.ok(fs.existsSync(sceneStore.sceneFilePath(sceneVideo.id, 1, stored[0].generations[0].files[0])));
    assert.equal(sceneEvents.findLast(([, p]) => p.number === 1)[1].scene.number, 1);

    // an error also releases the queue
    sceneListener({ type: 'flow-error', requestId: sent[1].requestId, message: 'Flow se quedó sin créditos.' });
    assert.deepEqual(states(2).slice(-1), ['error']);
    assert.equal(sceneEvents.findLast(([, p]) => p.number === 2)[1].error, 'Flow se quedó sin créditos.');
    assert.equal(sent.length, 3);
    assert.equal(sent[2].prompt, 'scene 3');
    finish(sent[2]);
    assert.deepEqual(sceneService.status().scenes, { busy: false, running: null, pending: 0 });
  });

  await test('scene jobs carry the selected sheet as reference plus model and outputs', async () => {
    const job = sent[0];
    assert.equal(job.model, 'nano-banana-pro');
    assert.equal(job.outputs, 2);
    assert.equal(job.references.length, 1);
    assert.deepEqual(job.references[0], { name: tomas.generations[0].files[0], mime: 'image/png', base64: 'AQID' });
    assert.deepEqual(sent[2].references, [], 'a scene without sheet refs sends no references');
  });

  await test('scenes whose sheet is unknown or has no selected image fail alone and the queue moves on', async () => {
    sent.length = 0;
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(4, ['2']), scene(5, ['7']), scene(6, ['1B']), scene(7, ['1', '2'])] });
    // 4: Ana has no selected image; 5: no sheet 7; 6: no variant B; 7: Ana again -> all fail, none sent
    assert.equal(sent.length, 0);
    assert.deepEqual([4, 5, 6, 7].map((n) => states(n).slice(-1)[0]), ['error', 'error', 'error', 'error']);
    assert.match(sceneEvents.findLast(([, p]) => p.number === 4)[1].error, /hoja 2 .*no tiene una imagen seleccionada/);
    assert.match(sceneEvents.findLast(([, p]) => p.number === 5)[1].error, /No encuentro el personaje de la hoja 7/);

    sceneStore.addGeneration(sceneVideo.id, 'personaje-2-ana', { images: [image] });
    sceneStore.select(sceneVideo.id, 'personaje-2-ana', sceneStore.list(sceneVideo.id)[1].generations[0].files[0]);
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(8, ['1', '2', '1'])] });
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].references.map((ref) => ref.mime), ['image/png', 'image/webp'], 'two sheets, the repeated one only once');
    finish(sent[0]);
  });

  await test('cancelScenes clears the waiting scenes and keeps the running one', async () => {
    sent.length = 0;
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(10), scene(11), scene(12)] });
    assert.equal(sent.length, 1);
    assert.deepEqual(sceneService.cancelScenes(), { cancelled: 2 });
    assert.deepEqual(states(11).slice(-1), ['cancelled']);
    assert.deepEqual(states(12).slice(-1), ['cancelled']);
    assert.deepEqual(sceneService.status().scenes, { busy: true, running: 10, pending: 0 });
    finish(sent[0]);
    assert.equal(sent.length, 1, 'nothing else is sent after the running scene ends');
    assert.deepEqual(states(10).slice(-1), ['done']);
  });

  await test('a character job is rejected while the scene queue is busy, and scenes while a character runs', async () => {
    sent.length = 0;
    const characterArgs = { videoId: sceneVideo.id, characterKey: 'personaje-1-tomas', name: 'Personaje 1 — Tomás (protagonista)', role: '', prompt: 'sheet 1' };
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(20)] });
    assert.throws(() => sceneService.generate(characterArgs), /cola de escenas/);
    finish(sent[0]);
    assert.equal(sceneService.status().scenes.busy, false);

    sceneService.generate(characterArgs);
    assert.throws(() => sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(21)] }), /generación de personaje en curso/);
    sceneListener({ type: 'flow-error', requestId: sent.at(-1).requestId, message: 'x' });
  });

  await test('scene payload validation, disconnect and old generations pruning', async () => {
    const bad = (scenes, pattern) => assert.throws(() => sceneService.generateScenes({ videoId: sceneVideo.id, scenes }), pattern);
    bad([], /Lista de escenas no válida/);
    bad([{ number: 0, prompt: 'p' }], /Número de escena no válido/);
    bad([{ number: 1.5, prompt: 'p' }], /Número de escena no válido/);
    bad([{ number: 1, prompt: '  ' }], /prompt de la escena está vacío/);
    bad([{ number: 1, prompt: 'p', sheetRefs: ['../x'] }], /Referencias de hoja no válidas/);
    assert.throws(() => sceneService.generateScenes({ videoId: 'nope', scenes: [scene(1)] }), /Video no encontrado/);
    assert.throws(() => sceneStore.sceneFilePath(sceneVideo.id, 1, '../x.webp'), /Archivo de imagen no válido/);
    assert.throws(() => sceneStore.sceneFilePath(sceneVideo.id, 'abc', '1700000000000-1.webp'), /Número de escena no válido/);

    sent.length = 0;
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(30), scene(31)] });
    statusListener(false);
    assert.deepEqual(states(30).slice(-1), ['error']);
    assert.deepEqual(states(31).slice(-1), ['error']);
    assert.match(sceneEvents.findLast(([, p]) => p.number === 31)[1].error, /se desconectó/);
    assert.equal(sceneService.status().scenes.busy, false);
    connected = false;
    assert.throws(() => sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(32)] }), /no está conectada/);
    connected = true;

    // Only the latest generations of a scene are kept, older files are deleted
    const dirOf = path.join(sceneRoot, 'videos', sceneVideo.id, 'scenes', '40');
    const firstFiles = [];
    for (let i = 0; i < 6; i += 1) {
      const saved = sceneStore.addSceneGeneration(sceneVideo.id, { number: 40, title: 'T', prompt: 'p', images: [image, image] });
      if (i === 0) firstFiles.push(...saved.generations[0].files);
      await sleep(3);
    }
    const kept = sceneStore.listScenes(sceneVideo.id).find((item) => item.number === 40);
    assert.equal(kept.generations.length, 4);
    assert.equal(fs.readdirSync(dirOf).length, 8);
    for (const file of firstFiles) assert.equal(fs.existsSync(path.join(dirOf, file)), false);
  });

  await test('media protocol serves scene images and rejects malformed scene paths', async () => {
    const [{ generations }] = sceneStore.listScenes(sceneVideo.id);
    const file = generations[0].files[0];
    const ok = await createMediaHandler({ wavPath: () => '', voiceoverWavPath: () => '' }, { sceneFile: sceneStore.sceneFilePath })({
      url: `mecatube-media://scene/${sceneVideo.id}/1/${file}`,
      headers: new Headers(),
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'image/webp');
    const handler = createMediaHandler({ wavPath: () => '', voiceoverWavPath: () => '' }, { sceneFile: sceneStore.sceneFilePath });
    for (const url of [`mecatube-media://scene/${sceneVideo.id}/..%2F1/${file}`, `mecatube-media://scene/${sceneVideo.id}/x/${file}`, `mecatube-media://scene/${sceneVideo.id}/1`]) {
      assert.equal((await handler({ url, headers: new Headers() })).status, 404, url);
    }
  });

  await test('scenePromptForFlow points sheet mentions at the attached reference and adds the layout guard', () => {
    const prompt =
      'Each main character must match its character sheet reference exactly: same head. Scene: a man points at a map. ' +
      'The character from character sheet 1, stickman man with dark brown hair, pointing, with a curious expression.';
    const out = scenePromptForFlow(prompt, ['1']);
    assert.ok(!/character sheet/i.test(out), out);
    assert.match(out, /must match the attached reference image exactly/);
    assert.match(out, /The character shown in the attached reference image, stickman man with dark brown hair/);
    assert.match(out, /no expression row/);
    // The character description itself is untouched
    assert.ok(out.includes('stickman man with dark brown hair, pointing, with a curious expression.'));
  });

  await test('scenePromptForFlow numbers several references by attachment order', () => {
    const prompt = 'The character from character sheet 2, a woman. The character from character sheet 1B, a man. Matching their character sheet references.';
    const out = scenePromptForFlow(prompt, ['2', '1B']);
    assert.match(out, /The character shown in attached reference image 1, a woman/);
    assert.match(out, /The character shown in attached reference image 2, a man/);
    assert.match(out, /their attached reference images/);
  });

  await test('scenePromptForFlow leaves prompts without references unchanged', () => {
    const prompt = 'Whiteboard explainer. No main characters.';
    assert.equal(scenePromptForFlow(prompt, []), prompt);
  });

  fs.rmSync(sceneRoot, { recursive: true, force: true });
  bridge.stop();
  fs.rmSync(dir,{ recursive: true, force: true });
  console.log(`\n${results.length} passed`);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
