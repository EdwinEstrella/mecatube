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

test('createVoiceService generates single-voice track', async () => {
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
