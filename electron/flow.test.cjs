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
const { flowAssetId, createFlowStore, createFlowService, scenePromptForFlow } = require('./flow.cjs');
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
  const video = videos.create({ title: 'Test video', branchId: 'b-flow' });
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
      outputs: 1,
      references: [],
      aspect: '16:9',
      orientation: 'horizontal',
    });

    assert.throws(() => generate({ characterKey: 'otro' }), /otra generación de Flow en curso/);
    assert.deepEqual(service.status(), {
      busy: true,
      videoId: video.id,
      characterKey: 'personaje-1-tomas',
      scenes: { busy: false, running: null, pending: 0 },
      animations: { busy: false, running: null, pending: 0 },
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
    // A single-image generation selects itself
    assert.equal(character.selectedFile, character.generations[1].files[0]);
  });

  await test('select / approve rules', async () => {
    store.upsert(video.id, { key: 'personaje-8-sin-imagen', name: 'Sin imagen', role: '', prompt: 'p' });
    assert.throws(() => store.setApproved(video.id, ['personaje-8-sin-imagen'], true), /selecciona una imagen/);
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

  await test('a single-image character sheet selects itself', () => {
    store.upsert(video.id, { key: 'personaje-9-solo', name: 'Solo', role: '', prompt: 'p' });
    const solo = store.addGeneration(video.id, 'personaje-9-solo', { images: [{ mime: 'image/webp', base64: WEBP.toString('base64') }] });
    assert.equal(solo.selectedFile, solo.generations[0].files[0]);
    assert.equal(solo.approved, false, 'the user still approves it');
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
    assert.throws(() => service.setProject(video.id, `${PROJECT}x`), /URL del proyecto de Flow no válida/);
    // A pasted address-bar URL keeps only the project base; other accounts carry "/u/<n>/"
    assert.equal(service.setProject(video.id, `${PROJECT}/edit/x?y=1`).flowProjectUrl, PROJECT);
    const accountProject = 'https://flow.google.com/u/4/project/12345678-1234-1234-1234-123456789abc';
    assert.equal(service.setProject(video.id, ` ${accountProject} `).flowProjectUrl, accountProject);
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
  const sceneVideo = sceneVideos.create({ title: 'Scenes video', branchId: 'b-scenes' });
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
  const SHEET_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
  sceneStore.addGeneration(sceneVideo.id, 'personaje-1-tomas', {
    images: [{ mime: 'image/png', base64: 'AQID', sourceUrl: `https://flow-content.google/image/${SHEET_ID}?Expires=1` }, image],
  });
  const [tomas] = sceneStore.list(sceneVideo.id);
  sceneStore.select(sceneVideo.id, 'personaje-1-tomas', tomas.generations[0].files[0]);

  await test('scene queue is serial: the next job goes out only after the previous result', async () => {
    const { queued } = sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(1, ['1']), scene(2, ['1']), scene(3)] });
    assert.equal(queued, 3);
    assert.equal(sent.length, 1);
    // A scene with a sheet reference goes out with the reference guard appended
    assert.equal(sent[0].prompt, scenePromptForFlow('scene 1', ['1']));
    assert.ok(sent[0].prompt.startsWith('scene 1 '));
    assert.deepEqual(states(2), ['queued']);
    assert.deepEqual(sceneService.status().scenes, { busy: true, running: 1, pending: 2 });
    // a duplicate request for a queued or running scene is ignored
    assert.equal(sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(2), scene(1)] }).queued, 0);

    sceneListener({ type: 'flow-progress', requestId: sent[0].requestId, percent: 55 });
    assert.equal(sceneEvents.filter(([c]) => c === 'flow:progress').length, 0, 'scene traffic must not reach the character cards');
    assert.equal(sceneEvents.findLast(([c, p]) => c === 'flow:scene-status' && p.number === 1)[1].percent, 55);

    finish(sent[0]);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].prompt, scenePromptForFlow('scene 2', ['1']));
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
    assert.equal(job.outputs, 1, 'one image per scene');
    assert.equal(job.references.length, 1);
    assert.deepEqual(job.references[0], { name: tomas.generations[0].files[0], mime: 'image/png', base64: 'AQID', assetId: SHEET_ID });
    assert.deepEqual(tomas.generations[0].assetIds, [SHEET_ID, null]);
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

  await test("Flow's usage limit stops the queue instead of failing every waiting scene in Flow", async () => {
    sent.length = 0;
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(13), scene(14), scene(15)] });
    assert.equal(sent.length, 1);
    sceneListener({
      type: 'flow-error',
      requestId: sent[0].requestId,
      message: 'Flow rechazó la generación: Has alcanzado tu límite de uso. Inténtalo de nuevo más tarde.',
    });
    assert.equal(sent.length, 1, 'no further scene is sent to Flow');
    assert.deepEqual([13, 14, 15].map((n) => states(n).slice(-1)[0]), ['error', 'error', 'error']);
    assert.match(sceneEvents.findLast(([, p]) => p.number === 15)[1].error, /Cola detenida: Flow alcanzó tu límite de uso/);
    assert.deepEqual(sceneService.status().scenes, { busy: false, running: null, pending: 0 });
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

  await test('scene selection persists, rejects foreign files and clears when pruned', async () => {
    const a = sceneStore.addSceneGeneration(sceneVideo.id, { number: 50, title: 'A', prompt: 'p', images: [image, image] });
    const b = sceneStore.addSceneGeneration(sceneVideo.id, { number: 51, title: 'B', prompt: 'p', images: [image, image] });
    assert.equal(a.selectedFile, null);
    const mine = a.generations[0].files[1];
    const selectedOf = () => sceneStore.listScenes(sceneVideo.id).find((item) => item.number === 50).selectedFile;
    assert.equal(sceneStore.selectScene(sceneVideo.id, 50, mine).selectedFile, mine);
    assert.equal(selectedOf(), mine);
    // another scene's file, a traversal attempt, an unknown scene and a bad number
    assert.throws(() => sceneStore.selectScene(sceneVideo.id, 50, b.generations[0].files[0]), /no pertenece/);
    assert.throws(() => sceneStore.selectScene(sceneVideo.id, 50, '../51/x.webp'), /Archivo de imagen no válido/);
    assert.throws(() => sceneStore.selectScene(sceneVideo.id, 99, mine), /Escena no encontrada/);
    assert.throws(() => sceneStore.selectScene(sceneVideo.id, 0, mine), /Número de escena no válido/);
    assert.equal(selectedOf(), mine);
    // Regenerating replaces the visible pair, so the choice is cleared and made again among the new images
    await sleep(3);
    const regenerated = sceneStore.addSceneGeneration(sceneVideo.id, { number: 50, title: 'A', prompt: 'p', images: [image, image] });
    assert.equal(regenerated.selectedFile, null);
    assert.equal(selectedOf(), null);
    const fresh = regenerated.generations.at(-1).files[0];
    assert.equal(sceneStore.selectScene(sceneVideo.id, 50, fresh).selectedFile, fresh);
    // A single-image generation (scenes now ask Flow for 1) is chosen automatically, also on regenerate
    await sleep(3);
    const single = sceneStore.addSceneGeneration(sceneVideo.id, { number: 50, title: 'A', prompt: 'p', images: [image] });
    assert.equal(single.selectedFile, single.generations.at(-1).files[0]);
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

  await test("scene references use only the current chat's characters, not another chat's 'Personaje 1'", async () => {
    // Reproduces a real workspace: a leftover "Personaje 1" (here Tomás, stored first) and the chat's
    // current, approved "Personaje 1 — Narrador"; without the chat's keys the leftover was picked
    const NARRADOR_ID = '6f9619ff-8b86-4011-b42d-00c04fc964ff';
    sceneStore.upsert(sceneVideo.id, { key: 'personaje-1-narrador', name: 'Personaje 1 — Narrador (protagonista)', role: '', prompt: 'sheet 1 new' });
    sceneStore.addGeneration(sceneVideo.id, 'personaje-1-narrador', {
      images: [{ mime: 'image/png', base64: 'BAUG', sourceUrl: `https://flow-content.google/image/${NARRADOR_ID}?Expires=1` }, image],
    });
    const narrador = sceneStore.list(sceneVideo.id).find((item) => item.key === 'personaje-1-narrador');
    sceneStore.select(sceneVideo.id, 'personaje-1-narrador', narrador.generations[0].files[0]);

    const before = sent.length;
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(64, ['1'])], characterKeys: ['personaje-1-narrador', 'personaje-2-ana'] });
    assert.equal(sent.length, before + 1);
    assert.equal(sent.at(-1).references.length, 1);
    assert.equal(sent.at(-1).references[0].assetId, NARRADOR_ID);
    finish(sent.at(-1));

    assert.throws(
      () => sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(65, ['1'])], characterKeys: ['../bad'] }),
      /personajes no válida/,
    );
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

  await test('asset ids from flow-result sourceUrl are persisted per file', async () => {
    sent.length = 0;
    const url = (id) => `https://flow-content.google/image/${id}?Expires=1`;
    const ID_B = '11111111-2222-4333-8444-555555555555';
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(81)] });
    finish(sent[0], { images: [{ ...image, sourceUrl: url(SHEET_ID) }, { ...image, sourceUrl: url(ID_B) }] });
    const stored = sceneStore.listScenes(sceneVideo.id).find((item) => item.number === 81);
    assert.deepEqual(stored.generations.at(-1).assetIds, [SHEET_ID, ID_B]);
    sent.length = 0;
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(82)] });
    finish(sent[0], { images: [{ ...image, sourceUrl: 'https://flow.google.com/asb/a' }, image] });
    assert.deepEqual(sceneStore.listScenes(sceneVideo.id).find((item) => item.number === 82).generations.at(-1).assetIds, [null, null]);
  });

  await test('references of data stored without asset ids carry assetId null', async () => {
    const file = path.join(sceneRoot, 'videos', sceneVideo.id, 'characters.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete data[0].generations[0].assetIds;
    fs.writeFileSync(file, JSON.stringify(data));
    assert.equal(sceneStore.readReference(sceneVideo.id, 'personaje-1-tomas').assetId, null);
  });

  await test('flowAssetId parses the uuid of a Flow image URL', () => {
    assert.equal(flowAssetId(`https://flow-content.google/image/${SHEET_ID}?Expires=1`), SHEET_ID);
    assert.equal(flowAssetId(`https://flow-content.google/image/${SHEET_ID.toUpperCase()}`), SHEET_ID);
    assert.equal(flowAssetId('https://flow.google.com/asb/a'), null);
    assert.equal(flowAssetId('https://flow-content.google/image/nope?x=1'), null);
    assert.equal(flowAssetId(undefined), null);
  });

  await test('scenePromptForFlow leaves prompts without references unchanged', () => {
    const prompt = 'Whiteboard explainer. No main characters.';
    assert.equal(scenePromptForFlow(prompt, []), prompt);
  });

  // --- Animations: shared serial queue, source asset from the chosen scene image, video storage ---
  const MP4 = Buffer.from('....ftypisom-fake-video-bytes');
  const clip = (sourceUrl) => ({ mime: 'video/mp4', base64: MP4.toString('base64'), sourceUrl });
  const SRC_ID = '0f8fad5b-d9cb-469f-a165-70867728950f';
  const VID_ID = '22222222-3333-4444-8555-666666666666';
  const flowImageUrl = (id) => `https://flow-content.google/image/${id}?Expires=1`;
  const animation = (number, hook = false) => ({ number, title: `Escena ${number}`, prompt: `animate ${number}`, hook });
  const animStates = (number) => sceneEvents.filter(([c, p]) => c === 'flow:animation-status' && p.number === number).map(([, p]) => p.state);
  const lastAnim = (number) => sceneEvents.findLast(([c, p]) => c === 'flow:animation-status' && p.number === number)[1];
  const finishClip = (job, extra = {}) =>
    sceneListener({ type: 'flow-result', requestId: job.requestId, projectUrl: PROJECT, videos: [clip(flowImageUrl(VID_ID))], ...extra });

  // 90: chosen image with a Flow id; 91: no chosen image; 92: chosen image without a Flow id
  const chosen = (number, sourceUrl) => {
    const saved = sceneStore.addSceneGeneration(sceneVideo.id, { number, title: 'S', prompt: 'p', images: [{ ...image, sourceUrl }, image] });
    sceneStore.selectScene(sceneVideo.id, number, saved.generations[0].files[0]);
  };
  chosen(90, flowImageUrl(SRC_ID));
  sceneStore.addSceneGeneration(sceneVideo.id, { number: 91, title: 'S', prompt: 'p', images: [image, image] });
  chosen(92, 'https://flow.google.com/asb/a');

  await test('animations and scenes share one serial queue; the source asset comes from the chosen scene image', async () => {
    sent.length = 0;
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(70)] });
    assert.equal(sent.length, 1);
    assert.deepEqual(sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [animation(90, true), animation(91), animation(92)] }), { queued: 3 });
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(71)] });
    assert.equal(sent.length, 1, 'one Flow job at a time');
    assert.deepEqual(animStates(90), ['queued']);
    assert.deepEqual(sceneService.status().animations, { busy: true, running: null, pending: 3 });
    assert.deepEqual(sceneService.status().scenes, { busy: true, running: 70, pending: 1 });
    // a duplicate request for a waiting animation is ignored
    assert.equal(sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [animation(90)] }).queued, 0);

    finish(sent[0]);
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[1], {
      requestId: sent[1].requestId,
      kind: 'animate',
      prompt: 'animate 90',
      projectUrl: PROJECT,
      sourceAssetId: SRC_ID,
      aspect: '16:9',
      orientation: 'horizontal',
      video: { model: 'omni-1.1-flash', resolution: '720p', seconds: 8, aspect: '16:9', outputs: 1 },
    });
    assert.deepEqual(animStates(90), ['queued', 'running']);
    assert.equal(sceneService.isVideoBusy(sceneVideo.id), true);

    sceneListener({ type: 'flow-progress', requestId: sent[1].requestId, percent: 40 });
    assert.equal(lastAnim(90).percent, 40);
    assert.equal(sceneEvents.filter(([c]) => c === 'flow:progress').length, 0);
    assert.equal(sceneEvents.findLast(([c]) => c === 'flow:scene-status')[1].number, 70, 'animation traffic stays off the scene channel');

    finishClip(sent[1]);
    assert.deepEqual(animStates(90), ['queued', 'running', 'running', 'done']);
    // 91 and 92 fail alone, then the scene queued after them goes out
    assert.deepEqual(animStates(91).slice(-1), ['error']);
    assert.equal(lastAnim(91).error, 'Elige primero la imagen de la escena 91 en Flow.');
    assert.deepEqual(animStates(92).slice(-1), ['error']);
    assert.match(lastAnim(92).error, /escena 92 no tiene identificador de Flow/);
    assert.equal(sent.length, 3);
    assert.equal(sent[2].prompt, 'scene 71');
    assert.equal(sent[2].kind, undefined, 'image jobs keep their payload');
    finish(sent[2]);
    assert.deepEqual(sceneService.status().animations, { busy: false, running: null, pending: 0 });
    assert.equal(sceneService.isVideoBusy(sceneVideo.id), false);
  });

  await test('animation videos are persisted with asset ids and served by the media protocol', async () => {
    const [stored] = sceneStore.listAnimations(sceneVideo.id);
    assert.equal(stored.number, 90);
    assert.equal(stored.hook, true);
    assert.equal(stored.title, 'Escena 90');
    const generation = stored.generations[0];
    assert.equal(generation.files.length, 1);
    assert.match(generation.files[0], /^\d+-1\.mp4$/);
    assert.deepEqual(generation.assetIds, [VID_ID]);
    assert.equal(generation.sourceAssetId, SRC_ID);
    const full = sceneStore.animationFilePath(sceneVideo.id, 90, generation.files[0]);
    assert.deepEqual(fs.readFileSync(full), MP4);
    assert.equal(sceneEvents.findLast(([c, p]) => c === 'flow:animation-status' && p.state === 'done')[1].animation.number, 90);

    const handler = createMediaHandler({ wavPath: () => '', voiceoverWavPath: () => '' }, { animationFile: sceneStore.animationFilePath });
    const file = generation.files[0];
    const ok = await handler({ url: `mecatube-media://animation/${sceneVideo.id}/90/${file}`, headers: new Headers() });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'video/mp4');
    const ranged = await handler({ url: `mecatube-media://animation/${sceneVideo.id}/90/${file}`, headers: new Headers({ range: 'bytes=0-3' }) });
    assert.equal(ranged.status, 206);
    for (const url of [
      `mecatube-media://animation/${sceneVideo.id}/..%2F90/${file}`,
      `mecatube-media://animation/${sceneVideo.id}/x/${file}`,
      `mecatube-media://animation/${sceneVideo.id}/90/..%2F..%2Fanimations.json`,
      `mecatube-media://animation/${sceneVideo.id}/90/${file.replace('.mp4', '.png')}`,
      `mecatube-media://animation/${sceneVideo.id}/90`,
    ]) {
      assert.equal((await handler({ url, headers: new Headers() })).status, 404, url);
    }
    assert.throws(() => sceneStore.animationFilePath(sceneVideo.id, 90, '../x.mp4'), /Archivo de vídeo no válido/);
  });

  await test('only the latest animation generations are kept and older files are deleted', async () => {
    const dirOf = path.join(sceneRoot, 'videos', sceneVideo.id, 'animations', '95');
    const first = [];
    for (let i = 0; i < 5; i += 1) {
      const saved = sceneStore.addAnimationGeneration(sceneVideo.id, { number: 95, title: 'T', prompt: 'p', videos: [clip(null)] });
      if (i === 0) first.push(...saved.generations[0].files);
      await sleep(3);
    }
    const kept = sceneStore.listAnimations(sceneVideo.id).find((item) => item.number === 95);
    assert.equal(kept.generations.length, 3);
    assert.equal(fs.readdirSync(dirOf).length, 3);
    for (const file of first) assert.equal(fs.existsSync(path.join(dirOf, file)), false);
    assert.throws(() => sceneStore.addAnimationGeneration(sceneVideo.id, { number: 95, prompt: 'p', videos: [] }), /no tiene vídeos utilizables/);
    assert.throws(() => sceneStore.addAnimationGeneration(sceneVideo.id, { number: 95, prompt: 'p', videos: [{ mime: 'image/png', base64: 'AQID' }] }), /Tipo de vídeo no compatible/);
    assert.throws(() => sceneStore.addAnimationGeneration(sceneVideo.id, { number: 0, prompt: 'p', videos: [clip(null)] }), /Número de escena no válido/);
  });

  await test('cancelAnimations drops only waiting animations; a result without videos fails that animation alone', async () => {
    sent.length = 0;
    sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [animation(90)] });
    sceneService.generateScenes({ videoId: sceneVideo.id, scenes: [scene(72)] });
    sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [animation(92)] });
    assert.equal(sent.length, 1);
    assert.deepEqual(sceneService.cancelAnimations(), { cancelled: 1 });
    assert.deepEqual(animStates(92).slice(-1), ['cancelled']);
    assert.deepEqual(sceneService.status().scenes, { busy: true, running: null, pending: 1 });
    // the running animation gets a result with images only: it errors and the queue moves on
    sceneListener({ type: 'flow-result', requestId: sent[0].requestId, projectUrl: PROJECT, images: [image] });
    assert.deepEqual(animStates(90).slice(-1), ['error']);
    assert.match(lastAnim(90).error, /no tiene vídeos utilizables/);
    assert.equal(sent.at(-1).prompt, 'scene 72');
    assert.deepEqual(sceneService.cancelScenes(), { cancelled: 0 });
    finish(sent.at(-1));
  });

  await test('animation jobs conflict with character jobs and validate their payload', async () => {
    sent.length = 0;
    const characterArgs = { videoId: sceneVideo.id, characterKey: 'personaje-1-tomas', name: 'Personaje 1 — Tomás (protagonista)', role: '', prompt: 'sheet 1' };
    sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [animation(90)] });
    assert.throws(() => sceneService.generate(characterArgs), /cola de escenas y animaciones/);
    finishClip(sent[0]);
    sceneService.generate(characterArgs);
    assert.throws(() => sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [animation(90)] }), /generación de personaje en curso/);
    sceneListener({ type: 'flow-error', requestId: sent.at(-1).requestId, message: 'x' });

    const bad = (animations, pattern) => assert.throws(() => sceneService.generateAnimations({ videoId: sceneVideo.id, animations }), pattern);
    bad([], /Lista de animaciones no válida/);
    bad([{ number: 0, prompt: 'p' }], /Número de escena no válido/);
    bad([{ number: 1, prompt: '  ' }], /prompt de la animación está vacío/);
    assert.throws(() => sceneService.generateAnimations({ videoId: 'nope', animations: [animation(1)] }), /Video no encontrado/);
    connected = false;
    assert.throws(() => sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [animation(1)] }), /no está conectada/);
    connected = true;

    // a disconnect fails the running animation and the waiting ones
    sent.length = 0;
    sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [animation(90), animation(91)] });
    statusListener(false);
    assert.deepEqual(animStates(90).slice(-1), ['error']);
    assert.match(lastAnim(91).error, /se desconectó/);
  });

  await test('animation seconds are validated on enqueue and passed to pump', async () => {
    sent.length = 0;
    // valid seconds (4, 6, 8, 10) are passed to the bridge
    sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [{ ...animation(90), seconds: 6 }] });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].video.seconds, 6);
    finishClip(sent[0]);

    // invalid seconds fall back to 8
    sent.length = 0;
    sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [{ ...animation(90), seconds: 12 }] });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].video.seconds, 8);
    finishClip(sent[0]);

    sent.length = 0;
    sceneService.generateAnimations({ videoId: sceneVideo.id, animations: [{ ...animation(90), seconds: 'invalid' }] });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].video.seconds, 8);
    finishClip(sent[0]);
  });

  await test('vertical branch: sends aspect 9:16 and orientation vertical on character, scene, and animation jobs', async () => {
    const vSent = [];
    const vBridge = {
      isConnected: () => true,
      sendFlowJob: (payload) => vSent.push(payload),
      onMessage: () => {},
      onStatusChange: () => {},
    };
    const vBranches = {
      list: () => [{ id: 'b-vert', orientation: 'vertical' }],
    };
    const vVideos = {
      list: () => [{ id: 'v-vert', branchId: 'b-vert', flowProjectUrl: null }],
    };
    const vStore = {
      upsert: () => {},
      list: () => [],
      selectedSceneAssetId: () => 'asset-1',
      readReference: () => ({ name: 'ref.png', base64: 'AAAA' }),
    };
    const vService = createFlowService({
      bridge: vBridge,
      store: vStore,
      videos: vVideos,
      branches: vBranches,
      pushToWindow: () => {},
    });

    // Character job
    vService.generate({
      videoId: 'v-vert',
      characterKey: 'personaje-1-tomas',
      name: 'Tomás',
      role: 'Protagonista',
      prompt: 'Vertical character',
    });
    assert.equal(vSent.length, 1);
    assert.equal(vSent[0].aspect, '9:16');
    assert.equal(vSent[0].orientation, 'vertical');

    // Reset job
    vBridge.onMessage(); // noop
    vSent.length = 0;

    // Animation job
    const animService = createFlowService({
      bridge: vBridge,
      store: vStore,
      videos: vVideos,
      branches: vBranches,
      pushToWindow: () => {},
    });
    animService.generateAnimations({
      videoId: 'v-vert',
      animations: [{ number: 1, prompt: 'Vertical animation', seconds: 8 }],
    });
    assert.equal(vSent.length, 1);
    assert.equal(vSent[0].aspect, '9:16');
    assert.equal(vSent[0].orientation, 'vertical');
    assert.equal(vSent[0].video.aspect, '9:16');

    // Scene job
    vSent.length = 0;
    const sceneServiceVert = createFlowService({
      bridge: vBridge,
      store: vStore,
      videos: vVideos,
      branches: vBranches,
      pushToWindow: () => {},
    });
    sceneServiceVert.generateScenes({
      videoId: 'v-vert',
      scenes: [{ number: 1, title: 'Scene 1', prompt: 'Vertical scene', sheetRefs: [] }],
    });
    assert.equal(vSent.length, 1);
    assert.equal(vSent[0].aspect, '9:16');
    assert.equal(vSent[0].orientation, 'vertical');
  });

  await test('an animation has its own, longer watchdog', async () => {
    const watchedEvents = [];
    const watched = createFlowService({
      bridge: { isConnected: () => true, sendFlowJob: () => {}, onMessage: () => {}, onStatusChange: () => {} },
      store: sceneStore,
      videos: sceneVideos,
      pushToWindow: (c, p) => watchedEvents.push([c, p]),
      jobTimeoutMs: 30,
      animationTimeoutMs: 150,
    });
    watched.generateAnimations({ videoId: sceneVideo.id, animations: [animation(90)] });
    await sleep(70);
    assert.equal(watched.status().animations.busy, true, 'survives the image watchdog');
    await waitUntil(() => !watched.status().animations.busy, 'animation watchdog');
    assert.match(watchedEvents.findLast(([c]) => c === 'flow:animation-status')[1].error, /tardó demasiado/);
  });

  await test('scene job reference resolution falls back to branch characters when video characters are absent', async () => {
    const branchDir = path.join(sceneRoot, 'branches', 'b-branch-chars', 'characters');
    fs.mkdirSync(branchDir, { recursive: true });
    const branchImg = path.join(branchDir, 'hero_safe.webp');
    fs.writeFileSync(branchImg, WEBP);

    const testBranches = {
      get: (id) => {
        if (id === 'b-branch-chars') {
          return {
            id: 'b-branch-chars',
            characters: [
              { key: 'personaje-1', name: 'Personaje 1 — Leo', file: 'hero_safe.webp', source: 'flow' },
            ],
          };
        }
        return null;
      },
    };

    const vSent = [];
    const testBridge = {
      isConnected: () => true,
      sendFlowJob: (payload) => vSent.push(payload),
      onMessage: () => {},
      onStatusChange: () => {},
    };

    const branchEvents = [];
    const branchService = createFlowService({
      bridge: testBridge,
      store: sceneStore,
      videos: {
        list: () => [{ id: 'v-no-chars', branchId: 'b-branch-chars' }],
      },
      branches: testBranches,
      pushToWindow: (c, p) => branchEvents.push([c, p]),
    });

    branchService.generateScenes({
      videoId: 'v-no-chars',
      scenes: [{ number: 1, title: 'Scene 1', prompt: 'Scene with character sheet 1', sheetRefs: ['1'] }],
    });

    assert.equal(vSent.length, 1);
    assert.equal(vSent[0].references.length, 1);
    assert.equal(vSent[0].references[0].name, 'hero_safe.webp');
    assert.equal(vSent[0].references[0].mime, 'image/webp');
    assert.equal(vSent[0].references[0].assetId, null);
    assert.equal(vSent[0].references[0].base64, WEBP.toString('base64'));
    assert.match(vSent[0].prompt, /Use the attached reference image/);
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
