// Run: node electron/director.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildDirectorMessages,
  createDirectorService,
} = require('./director.cjs');

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok   ${name}`);
}

(async () => {
  const tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'director-test-'));

  try {
    const validPhrases = [
      { i: 0, start: 0, end: 2.5, text: 'Hello and welcome.' },
      { i: 1, start: 2.5, end: 6.0, text: 'In this video we build an AI director.' },
    ];
    const validAnimations = [
      { number: 1, title: 'Hook scene', hook: true },
      { number: 2, title: 'Concept explanation', hook: false },
    ];

    await test('message building contains the JSON input and notes', () => {
      const messages = buildDirectorMessages({
        duration: 6.0,
        phrases: validPhrases,
        animations: validAnimations,
        notes: 'Keep the pace fast and dynamic.',
      });

      assert.equal(messages.length, 2);
      assert.equal(messages[0].role, 'system');
      assert.match(messages[0].content, /EDL v1/);
      assert.match(messages[0].content, /cut\|fade\|slide\|zoom/);
      assert.match(messages[0].content, /none\|zoom-in\|zoom-out\|pan-left\|pan-right/);
      assert.match(messages[0].content, /contiguous/);
      assert.match(messages[0].content, /hook/i);

      assert.equal(messages[1].role, 'user');
      const payload = JSON.parse(messages[1].content);
      assert.equal(payload.duration, 6.0);
      assert.deepEqual(payload.phrases, validPhrases);
      assert.deepEqual(payload.animations, validAnimations);
      assert.equal(payload.notes, 'Keep the pace fast and dynamic.');

      // Omits notes when empty
      const withoutNotes = buildDirectorMessages({
        duration: 6.0,
        phrases: validPhrases,
        animations: validAnimations,
        notes: '   ',
      });
      const parsedWithout = JSON.parse(withoutNotes[1].content);
      assert.equal(Object.prototype.hasOwnProperty.call(parsedWithout, 'notes'), false);
    });

    await test('validation errors (bad id, empty phrases, bad animation, long notes)', async () => {
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: async () => '{"version":1,"clips":[],"subtitles":[]}',
      });

      // Bad videoId
      for (const badId of ['../escape', 'a/b', '', 'x'.repeat(101)]) {
        await assert.rejects(
          () => service.direct({ videoId: badId, duration: 10, phrases: validPhrases, animations: validAnimations }),
          /ID de video no válido\./,
        );
      }

      // Bad duration
      for (const badDur of [0, -1, NaN, Infinity, null, '10']) {
        await assert.rejects(
          () => service.direct({ videoId: 'v1', duration: badDur, phrases: validPhrases, animations: validAnimations }),
          /Duración no válida\./,
        );
      }

      // Empty / invalid phrases
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, phrases: [], animations: validAnimations }),
        /Lista de frases no válida\./,
      );
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, phrases: [{ start: 'bad', end: 1, text: 'hi' }], animations: validAnimations }),
        /Lista de frases no válida\./,
      );

      // Bad animation
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, phrases: validPhrases, animations: [] }),
        /Lista de animaciones no válida\./,
      );
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, phrases: validPhrases, animations: [{ number: 0, title: 't', hook: false }] }),
        /Lista de animaciones no válida\./,
      );
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, phrases: validPhrases, animations: [{ number: 1, title: 't', hook: 'not-bool' }] }),
        /Lista de animaciones no válida\./,
      );

      // Long notes
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, phrases: validPhrases, animations: validAnimations, notes: 'a'.repeat(501) }),
        /Notas no válidas\./,
      );
    });

    await test('missing key error', async () => {
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => '',
        streamChat: async () => '{}',
      });

      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, phrases: validPhrases, animations: validAnimations }),
        /Configura tu API Key de DeepSeek en Configuración para que la IA edite el video\./,
      );
    });

    await test('busy rejection while a run is pending and busy cleared after failure', async () => {
      let resolveChat;
      let rejectChat;
      const pendingPromise = new Promise((resolve, reject) => {
        resolveChat = resolve;
        rejectChat = reject;
      });

      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: () => pendingPromise,
      });

      assert.equal(service.busy(), false);

      const run1 = service.direct({ videoId: 'v1', duration: 10, phrases: validPhrases, animations: validAnimations });

      assert.equal(service.busy(), true);

      // Second run rejected because service is busy
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, phrases: validPhrases, animations: validAnimations }),
        /Ya hay una edición en curso\./,
      );

      // Fail run1 and verify busy flag is cleared
      rejectChat(new Error('Network failure'));
      await assert.rejects(() => run1, /Network failure/);

      assert.equal(service.busy(), false);
    });

    await test('raw returned', async () => {
      const rawOutput = '{"version":1,"duration":6,"clips":[],"subtitles":[]}';
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: async () => rawOutput,
      });

      const result = await service.direct({
        videoId: 'v1',
        duration: 6.0,
        phrases: validPhrases,
        animations: validAnimations,
      });

      assert.deepEqual(result, { raw: rawOutput });
      assert.equal(service.busy(), false);
    });

    await test('save/get roundtrip with savedAt', async () => {
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: async () => '{}',
      });

      const edlToSave = {
        version: 1,
        duration: 10,
        clips: [{ number: 1, start: 0, end: 10, transition: 'cut', motion: 'none' }],
        subtitles: [{ start: 0, end: 5, text: 'Hello' }],
      };

      const before = Date.now();
      const saved = service.saveEdit('test-video', edlToSave);
      const after = Date.now();

      assert.ok(typeof saved.savedAt === 'number');
      assert.ok(saved.savedAt >= before && saved.savedAt <= after);
      assert.equal(saved.version, 1);
      assert.deepEqual(saved.clips, edlToSave.clips);

      const retrieved = service.getEdit('test-video');
      assert.deepEqual(retrieved, saved);
    });

    await test('get missing -> null', () => {
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: async () => '{}',
      });

      assert.equal(service.getEdit('non-existent-video'), null);
    });

    await test('save rejects non-object/missing clips', () => {
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: async () => '{}',
      });

      for (const badEdl of [null, undefined, 'string', 123, [], { version: 1 }, { clips: 'not-array' }]) {
        assert.throws(
          () => service.saveEdit('v1', badEdl),
          /Edición no válida\./,
        );
      }

      // Reject payload exceeding 2MB
      const bigEdl = { clips: [], huge: 'x'.repeat(2 * 1024 * 1024 + 10) };
      assert.throws(
        () => service.saveEdit('v1', bigEdl),
        /Edición no válida\./,
      );
    });

    console.log(`\n${passed} passed`);
  } finally {
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
