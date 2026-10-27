// Run: node electron/director.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildDirectorMessages,
  buildAlignMessages,
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
    const validClips = [
      { number: 1, start: 0, end: 2.5, text: 'Hello and welcome to this video.' },
      { number: 2, start: 2.5, end: 6.0, text: 'Here we explain the concept clearly.' },
    ];
    const validPhrases = [
      { i: 0, text: 'Hello and welcome to this video.' },
      { i: 1, text: 'Here we explain the concept clearly.' },
    ];
    const validScenes = [
      { number: 1, title: 'Intro', prompt: 'A cinematic opening scene.' },
      { number: 2, title: 'Concept', prompt: 'Detailed diagram of the topic.' },
    ];

    await test('director message building contains clips and notes with fixed-timings prompt', () => {
      const messages = buildDirectorMessages({
        duration: 6.0,
        clips: validClips,
        notes: 'Keep the pace fast and dynamic.',
      });

      assert.equal(messages.length, 2);
      assert.equal(messages[0].role, 'system');
      assert.match(messages[0].content, /FIXED/);
      assert.match(messages[0].content, /cut\|fade\|slide\|zoom/);
      assert.match(messages[0].content, /none\|zoom-in\|zoom-out\|pan-left\|pan-right/);

      assert.equal(messages[1].role, 'user');
      const payload = JSON.parse(messages[1].content);
      assert.equal(payload.duration, 6.0);
      assert.deepEqual(payload.clips, validClips);
      assert.equal(payload.notes, 'Keep the pace fast and dynamic.');

      // Omits notes when empty
      const withoutNotes = buildDirectorMessages({
        duration: 6.0,
        clips: validClips,
        notes: '   ',
      });
      const parsedWithout = JSON.parse(withoutNotes[1].content);
      assert.equal(Object.prototype.hasOwnProperty.call(parsedWithout, 'notes'), false);
    });

    await test('align message building truncates long prompts and includes scenes and phrases', () => {
      const longPrompt = 'A'.repeat(800);
      const messages = buildAlignMessages({
        phrases: validPhrases,
        scenes: [
          { number: 1, title: 'Intro', prompt: longPrompt, needed: true },
          { number: 2, title: 'Concept', prompt: 'Short prompt', needed: false, fixedPhrase: 1 },
        ],
      });

      assert.equal(messages.length, 2);
      assert.equal(messages[0].role, 'system');
      assert.match(messages[0].content, /assignments/);

      assert.equal(messages[1].role, 'user');
      const payload = JSON.parse(messages[1].content);
      assert.deepEqual(payload.phrases, validPhrases);
      assert.equal(payload.scenes[0].prompt.length, 700);
      assert.equal(payload.scenes[0].needed, true);
      assert.equal(payload.scenes[1].needed, false);
      assert.equal(payload.scenes[1].fixedPhrase, 1);
    });

    await test('direct validation errors (bad id, duration, clips, notes)', async () => {
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: async () => '{"clips":[]}',
      });

      // Bad videoId
      for (const badId of ['../escape', 'a/b', '', 'x'.repeat(101)]) {
        await assert.rejects(
          () => service.direct({ videoId: badId, duration: 10, clips: validClips }),
          /ID de video no válido\./,
        );
      }

      // Bad duration
      for (const badDur of [0, -1, NaN, Infinity, null, '10']) {
        await assert.rejects(
          () => service.direct({ videoId: 'v1', duration: badDur, clips: validClips }),
          /Duración no válida\./,
        );
      }

      // Bad clips
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, clips: [] }),
        /Lista de clips no válida\./,
      );
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, clips: [{ number: 1, start: 5, end: 4, text: 'invalid' }] }),
        /Lista de clips no válida\./,
      );
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, clips: [{ number: 0, start: 0, end: 5, text: 'invalid' }] }),
        /Lista de clips no válida\./,
      );
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, clips: [{ number: 1, start: 0, end: 5, text: 'a'.repeat(2001) }] }),
        /Lista de clips no válida\./,
      );

      // Long notes
      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, clips: validClips, notes: 'a'.repeat(501) }),
        /Notas no válidas\./,
      );
    });

    await test('align validation errors (bad id, phrases, scenes)', async () => {
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: async () => '{"assignments":[]}',
      });

      // Bad videoId
      await assert.rejects(
        () => service.align({ videoId: 'bad/id', phrases: validPhrases, scenes: validScenes }),
        /ID de video no válido\./,
      );

      // Bad phrases
      await assert.rejects(
        () => service.align({ videoId: 'v1', phrases: [], scenes: validScenes }),
        /Lista de frases no válida\./,
      );
      await assert.rejects(
        () => service.align({ videoId: 'v1', phrases: [{ i: 'not-int', text: 'hi' }], scenes: validScenes }),
        /Lista de frases no válida\./,
      );

      // Bad scenes
      await assert.rejects(
        () => service.align({ videoId: 'v1', phrases: validPhrases, scenes: [] }),
        /Lista de escenas no válida\./,
      );
      await assert.rejects(
        () => service.align({ videoId: 'v1', phrases: validPhrases, scenes: [{ number: 0, title: 't', prompt: 'p' }] }),
        /Lista de escenas no válida\./,
      );
    });

    await test('missing key error for direct and align', async () => {
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => '',
        streamChat: async () => '{}',
      });

      await assert.rejects(
        () => service.direct({ videoId: 'v1', duration: 10, clips: validClips }),
        /Configura tu API Key de DeepSeek en Configuración para que la IA edite el video\./,
      );

      await assert.rejects(
        () => service.align({ videoId: 'v1', phrases: validPhrases, scenes: validScenes }),
        /Configura tu API Key de DeepSeek en Configuración para que la IA edite el video\./,
      );
    });

    await test('busy rejection and cleared after failure', async () => {
      let rejectChat;
      const pendingPromise = new Promise((_, reject) => {
        rejectChat = reject;
      });

      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: () => pendingPromise,
      });

      assert.equal(service.busy(), false);
      const run1 = service.direct({ videoId: 'v1', duration: 10, clips: validClips });
      assert.equal(service.busy(), true);

      await assert.rejects(
        () => service.align({ videoId: 'v1', phrases: validPhrases, scenes: validScenes }),
        /Ya hay una edición en curso\./,
      );

      rejectChat(new Error('Network failure'));
      await assert.rejects(() => run1, /Network failure/);
      assert.equal(service.busy(), false);
    });

    await test('raw returned from direct and align', async () => {
      const directRaw = '{"clips":[{"number":1,"transition":"fade","motion":"zoom-in"}]}';
      const alignRaw = '{"assignments":[{"number":1,"phrase":0}]}';

      let returnRaw = directRaw;
      const service = createDirectorService({
        getWorkspacePath: () => tmpWorkspace,
        getApiKey: () => 'fake-key',
        streamChat: async () => returnRaw,
      });

      const resDirect = await service.direct({
        videoId: 'v1',
        duration: 6.0,
        clips: validClips,
      });
      assert.deepEqual(resDirect, { raw: directRaw });

      returnRaw = alignRaw;
      const resAlign = await service.align({
        videoId: 'v1',
        phrases: validPhrases,
        scenes: validScenes,
      });
      assert.deepEqual(resAlign, { raw: alignRaw });
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
        subtitles: [],
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

    console.log(`\n${passed} passed`);
  } finally {
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
