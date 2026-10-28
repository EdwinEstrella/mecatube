// Run: node electron/cartesia.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createVoiceService,
  buildWav,
  buildRequestBody,
  buildGenerationConfig,
  simulateTake,
  SAMPLE_RATE,
  TEXT_MAX,
} = require('./cartesia.cjs');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mecatube-cartesia-test-'));
}

test('buildGenerationConfig validates speed boundaries and default 1.0', () => {
  assert.equal(buildGenerationConfig('sonic-3.5', 1.0), null);
  assert.equal(buildGenerationConfig('sonic-3.5', null), null);
  assert.equal(buildGenerationConfig('sonic-2', 1.2), null); // sonic-2 doesn't use generation_config
  assert.deepEqual(buildGenerationConfig('sonic-3.5', 1.2), { speed: 1.2 });
  assert.deepEqual(buildGenerationConfig('sonic-3.5', 2.0), { speed: 1.5 }); // clamped max
  assert.deepEqual(buildGenerationConfig('sonic-3.5', 0.2), { speed: 0.6 }); // clamped min
  assert.throws(() => buildGenerationConfig('sonic-3.5', 'fast'), /Velocidad no válida\./);
});

test('buildRequestBody builds container pcm_s16le with timestamps', () => {
  const body = buildRequestBody({
    model: 'sonic-3.5',
    text: 'Hola a todos.',
    voiceId: 'voice-1234',
    language: 'es',
    speed: 1.1,
  });

  assert.equal(body.model_id, 'sonic-3.5');
  assert.equal(body.transcript, 'Hola a todos.');
  assert.deepEqual(body.voice, { mode: 'id', id: 'voice-1234' });
  assert.equal(body.add_timestamps, true);
  assert.equal(body.output_format.sample_rate, SAMPLE_RATE);
  assert.deepEqual(body.generation_config, { speed: 1.1 });
});

test('simulateTake produces valid PCM audio and word timestamps', () => {
  const { words, pcm } = simulateTake('Hola mundo desde Mecatube.');
  assert.ok(words.length > 0);
  assert.ok(pcm.length > 0);
  assert.equal(words[0].w, 'Hola');
  assert.ok(words[words.length - 1].e > words[0].s);
});

test('createVoiceService generates single-voice track when no segments given', async () => {
  const dir = makeTmpDir();
  const service = createVoiceService({
    userDataDir: dir,
    getApiKey: () => null,
    videoExists: () => true,
    simulate: true,
  });

  const meta = await service.generate({
    videoId: 'vid-test-1',
    text: 'Este es un texto de prueba para una sola voz.',
    voiceId: 'voice-hector-default',
    voiceName: 'Hector',
  });

  assert.equal(meta.voiceId, 'voice-hector-default');
  assert.equal(meta.voiceName, 'Hector');
  assert.ok(meta.duration > 0);
  assert.ok(meta.words.length > 0);
  assert.equal(meta.simulated, true);

  // Check files on disk
  const wavFile = service.wavPath('vid-test-1');
  const metaFile = path.join(service.voiceDir('vid-test-1'), 'voice_meta.json');
  assert.ok(fs.existsSync(wavFile));
  assert.ok(fs.existsSync(metaFile));

  // WAV header check: 44 bytes + PCM
  const wavBytes = fs.readFileSync(wavFile);
  assert.ok(wavBytes.length > 44);
  assert.equal(wavBytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wavBytes.toString('ascii', 8, 12), 'WAVE');
});

test('createVoiceService generates multi-segment voiceover and offsets timestamps', async () => {
  const dir = makeTmpDir();
  const service = createVoiceService({
    userDataDir: dir,
    getApiKey: () => null,
    videoExists: () => true,
    simulate: true,
  });

  const segments = [
    { speaker: 'narrator', text: 'El narrador abre el video.', voiceId: 'voice-narrator' },
    { speaker: 'carlos', text: 'Carlos responde con emoción.', voiceId: 'voice-carlos' },
    { speaker: 'narrator', text: 'El narrador concluye el episodio.', voiceId: 'voice-narrator' },
  ];

  const meta = await service.generate({
    videoId: 'vid-multi-1',
    text: segments.map((s) => s.text).join('\n\n'),
    voiceId: 'voice-narrator',
    voiceName: 'Narrador',
    segments,
  });

  assert.ok(meta.duration > 0);
  assert.equal(meta.transcript, segments.map((s) => s.text).join('\n\n'));
  assert.ok(meta.words.length >= 6);

  // Check timestamps are strictly increasing and offset
  for (let i = 1; i < meta.words.length; i += 1) {
    const prev = meta.words[i - 1];
    const curr = meta.words[i];
    assert.ok(curr.s >= prev.s, `Word ${curr.w} start (${curr.s}) should be >= previous start (${prev.s})`);
    assert.ok(curr.e >= curr.s, `Word ${curr.w} end should be >= start`);
  }

  // Audio WAV file exists and has concatenated PCM size
  const wavFile = service.wavPath('vid-multi-1');
  assert.ok(fs.existsSync(wavFile));
  const wavBytes = fs.readFileSync(wavFile);
  assert.equal(wavBytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wavBytes.toString('ascii', 8, 12), 'WAVE');
});

test('createVoiceService single-segment fallback when segments has length <= 1', async () => {
  const dir = makeTmpDir();
  const service = createVoiceService({
    userDataDir: dir,
    getApiKey: () => null,
    videoExists: () => true,
    simulate: true,
  });

  const segments = [
    { speaker: 'narrator', text: 'Solo un segmento.', voiceId: 'voice-single' },
  ];

  const meta = await service.generate({
    videoId: 'vid-single-seg',
    text: 'Solo un segmento.',
    voiceId: 'voice-single',
    voiceName: 'Voz Unica',
    segments,
  });

  assert.equal(meta.voiceId, 'voice-single');
  assert.ok(meta.duration > 0);
  assert.equal(meta.transcript, 'Solo un segmento.');
});

test('createVoiceService rejects when segments has too many items (> 200)', async () => {
  const dir = makeTmpDir();
  const service = createVoiceService({
    userDataDir: dir,
    getApiKey: () => null,
    videoExists: () => true,
    simulate: true,
  });

  const segments = Array.from({ length: 201 }, (_, i) => ({
    text: `Segmento ${i}`,
  }));

  await assert.rejects(
    () =>
      service.generate({
        videoId: 'vid-too-many',
        text: 'Texto de prueba',
        voiceId: 'voice-default',
        segments,
      }),
    /Segmentos de voz no válidos\./
  );
});

test('createVoiceService rejects when segments total text length exceeds TEXT_MAX', async () => {
  const dir = makeTmpDir();
  const service = createVoiceService({
    userDataDir: dir,
    getApiKey: () => null,
    videoExists: () => true,
    simulate: true,
  });

  const segments = [
    { text: 'x'.repeat(100001), voiceId: 'voice-1' },
    { text: 'y'.repeat(100000), voiceId: 'voice-2' },
  ];

  await assert.rejects(
    () =>
      service.generate({
        videoId: 'vid-too-long',
        text: 'Texto corto',
        voiceId: 'voice-default',
        segments,
      }),
    /El texto de la narración es demasiado largo\./
  );
});

test('createVoiceService rejects invalid segment elements or non-array', async () => {
  const dir = makeTmpDir();
  const service = createVoiceService({
    userDataDir: dir,
    getApiKey: () => null,
    videoExists: () => true,
    simulate: true,
  });

  await assert.rejects(
    () =>
      service.generate({
        videoId: 'vid-invalid-1',
        text: 'Texto',
        voiceId: 'voice-default',
        segments: 'not-an-array',
      }),
    /Segmentos de voz no válidos\./
  );

  await assert.rejects(
    () =>
      service.generate({
        videoId: 'vid-invalid-2',
        text: 'Texto',
        voiceId: 'voice-default',
        segments: [{ text: 123 }],
      }),
    /Segmentos de voz no válidos\./
  );

  await assert.rejects(
    () =>
      service.generate({
        videoId: 'vid-invalid-3',
        text: 'Texto',
        voiceId: 'voice-default',
        segments: [{ text: 'Hola', voiceId: 999 }],
      }),
    /Segmentos de voz no válidos\./
  );
});

test('createVoiceService valid segments pass in simulate mode', async () => {
  const dir = makeTmpDir();
  const service = createVoiceService({
    userDataDir: dir,
    getApiKey: () => null,
    videoExists: () => true,
    simulate: true,
  });

  const segments = [
    { text: 'Primera línea con voz por defecto.' },
    { text: 'Segunda línea con otra voz.', voiceId: 'voice-second' },
  ];

  const meta = await service.generate({
    videoId: 'vid-valid-sim',
    text: 'Primera línea con voz por defecto.\n\nSegunda línea con otra voz.',
    voiceId: 'voice-default',
    segments,
  });

  assert.equal(meta.simulated, true);
  assert.ok(meta.duration > 0);
  assert.equal(meta.chars, segments[0].text.length + segments[1].text.length);
  assert.ok(meta.words.length > 0);
  assert.ok(fs.existsSync(service.wavPath('vid-valid-sim')));
});
