// Cartesia text-to-speech: one continuous take with per-word timestamps (SSE).
// Port of the continuous mode of as-video-studio/motores/voz_cartesia/voz.py. The API key is
// supplied by the caller (main process) and never logged or returned.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_BASE_URL = 'https://api.cartesia.ai';
const API_VERSION = '2025-04-16';
// Voices endpoints: try the current version first; retry once with the newer one if Cartesia rejects it
const VOICES_API_VERSION = API_VERSION;
const VOICES_FALLBACK_VERSION = '2026-08-14';
const VOICE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const SAMPLE_RATE = 44100;
const DEFAULT_LANGUAGE = 'es';
const DEFAULT_MODEL = 'sonic-3.5';
const MODELS = ['sonic-3.5', 'sonic-3', 'sonic-turbo', 'sonic-2'];
// Only these models read generation_config; sonic-2/turbo use __experimental_controls instead
const GENERATION_CONFIG_MODELS = ['sonic-3', 'sonic-3.5'];
const SPEED_MIN = 0.6;
const SPEED_MAX = 1.5;
const TIMEOUT_MS = 10 * 60 * 1000;
const TEXT_MAX = 200000;
const PROGRESS_INTERVAL_MS = 400;
const VOICES_PAGE_LIMIT = 100;
const VOICES_MAX_PAGES = 40;
const ID_PATTERN = /^[\w-]{1,100}$/;

// --- Pure helpers ------------------------------------------------------------------------------

// Incremental SSE reader: feed text chunks of any size; onEvent gets each parsed `data:` JSON
function createSseParser(onEvent) {
  let buffer = '';
  const handleLine = (rawLine) => {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('data:')) return;
    try {
      onEvent(JSON.parse(line.slice(5).trim()));
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  };
  return {
    push(text) {
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(handleLine);
    },
    end() {
      const rest = buffer;
      buffer = '';
      if (rest) handleLine(rest);
    },
  };
}

// Collects PCM and word timestamps across events; the timestamps are already cumulative per take
function createTake() {
  const chunks = [];
  const words = [];
  let pcmBytes = 0;
  return {
    add(event) {
      if (!event || typeof event !== 'object') return;
      if (event.type === 'error' || event.error) {
        const detail = typeof event.error === 'string' ? event.error : event.message || 'unknown error';
        throw new Error(`Cartesia error: ${String(detail).slice(0, 200)}`);
      }
      if (typeof event.data === 'string' && event.data) {
        const chunk = Buffer.from(event.data, 'base64');
        chunks.push(chunk);
        pcmBytes += chunk.length;
      }
      const stamps = event.word_timestamps;
      if (stamps && Array.isArray(stamps.words)) {
        stamps.words.forEach((word, index) => {
          const start = Number(stamps.start?.[index]);
          const end = Number(stamps.end?.[index]);
          if (!Number.isFinite(start) || !Number.isFinite(end)) return;
          words.push({ w: String(word), s: Math.round(start * 1000) / 1000, e: Math.round(end * 1000) / 1000 });
        });
      }
    },
    get seconds() {
      return pcmBytes / (SAMPLE_RATE * 2);
    },
    get words() {
      return words;
    },
    pcm: () => Buffer.concat(chunks, pcmBytes),
  };
}

// 44-byte RIFF/WAVE header for PCM s16le mono (wav_desde_pcm in voz.py)
function buildWav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// sonic-3/3.5 speed is a multiplier 0.6-1.5 in generation_config; 1.0 is the default and is omitted
function buildGenerationConfig(model, speed) {
  if (!GENERATION_CONFIG_MODELS.includes(model)) return null;
  if (speed === undefined || speed === null) return null;
  const value = Number(speed);
  if (!Number.isFinite(value)) throw new Error('Invalid speed.');
  const clamped = Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
  return Math.abs(clamped - 1) < 1e-9 ? null : { speed: Math.round(clamped * 1000) / 1000 };
}

function buildRequestBody({ model, text, voiceId, language = DEFAULT_LANGUAGE, speed }) {
  const body = {
    model_id: model,
    transcript: text,
    voice: { mode: 'id', id: voiceId },
    output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: SAMPLE_RATE },
    language,
    add_timestamps: true,
  };
  const generationConfig = buildGenerationConfig(model, speed);
  if (generationConfig) body.generation_config = generationConfig;
  return body;
}

// Reduces one /voices entry; locales[] carries per-language native flags
function toVoice(raw) {
  const locales = Array.isArray(raw?.locales) ? raw.locales.filter((item) => item && item.locale) : [];
  return {
    id: raw?.id,
    name: raw?.name || raw?.id,
    description: String(raw?.description ?? '').trim(),
    language: String(raw?.language ?? '').toLowerCase(),
    isPublic: raw?.is_public !== false,
    locales: locales.map((item) => String(item.locale).toLowerCase()),
    nativeLocales: locales.filter((item) => item.is_native).map((item) => String(item.locale).toLowerCase()),
  };
}

// One voice of GET /voices or /voices/{id} for the picker; the preview must be an https URL
function toOwnedVoice(raw) {
  const preview = typeof raw?.preview_file_url === 'string' && raw.preview_file_url.startsWith('https://');
  return {
    id: raw?.id,
    name: raw?.name || raw?.id,
    tagline: String(raw?.tagline ?? '').trim(),
    description: String(raw?.description ?? '').trim(),
    isOwner: raw?.is_owner === true,
    isPro: raw?.is_pro === true,
    gender: raw?.gender ?? null,
    language: raw?.language ?? null,
    createdAt: raw?.created_at ?? null,
    previewUrl: preview ? raw.preview_file_url : null,
  };
}

// Voices able to narrate `language`, own (cloned) voices and native speakers first
function filterVoices(rawVoices, language) {
  const key = String(language || '').toLowerCase();
  const seen = new Set();
  const picked = [];
  for (const raw of rawVoices) {
    const voice = toVoice(raw);
    if (!voice.id || seen.has(voice.id)) continue;
    seen.add(voice.id);
    const native = voice.language === key || voice.nativeLocales.some((locale) => locale.startsWith(`${key}-`));
    let include;
    if (!key || !voice.isPublic) include = true;
    else include = native || voice.locales.some((locale) => locale.startsWith(`${key}-`));
    if (include) picked.push({ voice, native: native || !voice.isPublic });
  }
  picked.sort(
    (a, b) =>
      Number(a.voice.isPublic) - Number(b.voice.isPublic) ||
      Number(!a.native) - Number(!b.native) ||
      String(a.voice.name).localeCompare(String(b.voice.name)),
  );
  return picked.map(({ voice }) => ({
    id: voice.id,
    name: voice.name,
    description: voice.description,
    isOwner: !voice.isPublic,
  }));
}

// Fake word timestamps (about 0.35 s per word) for simulation mode
function simulateTake(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const words = tokens.map((word, index) => ({
    w: word,
    s: Math.round(index * 0.35 * 1000) / 1000,
    e: Math.round((index * 0.35 + 0.3) * 1000) / 1000,
  }));
  const seconds = Math.max(0.5, tokens.length * 0.35 + 0.2);
  const pcm = Buffer.alloc(Math.floor(seconds * SAMPLE_RATE) * 2);
  return { pcm, words };
}

const TITLE_MAX = 120;
const TITLE_FROM_TEXT = 40;

// Given title, else the first ~40 characters of the text
function voiceoverTitle(title, text) {
  const given = typeof title === 'string' ? title.trim().slice(0, TITLE_MAX) : '';
  return given || text.trim().replace(/\s+/g, ' ').slice(0, TITLE_FROM_TEXT) || 'Voice-over';
}

function headersFor(apiKey, version = API_VERSION) {
  return { 'X-API-Key': apiKey, 'Cartesia-Version': version };
}

async function errorFromResponse(response) {
  let body = '';
  try {
    body = (await response.text()).slice(0, 200);
  } catch {
    // The status code alone is enough
  }
  return new Error(`Cartesia returned HTTP ${response.status}${body ? `: ${body}` : ''}`);
}

// --- Service -----------------------------------------------------------------------------------

// userDataDir holds videos/<videoId>/voice/; getApiKey() returns the decrypted key or null
function createVoiceService({
  userDataDir,
  getApiKey,
  videoExists = () => true,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = (...args) => fetch(...args),
  simulate = process.env.MECATUBE_SIMULATE_TTS === '1',
  onProgress = () => {},
  timeoutMs = TIMEOUT_MS,
}) {
  let active = null; // { videoId, controller, cancelled }
  const voiceCache = new Map(); // language -> voices
  let ownedCache = null;
  let voicesVersion = VOICES_API_VERSION;

  function validVideoId(videoId) {
    if (typeof videoId !== 'string' || !ID_PATTERN.test(videoId) || !videoExists(videoId)) {
      throw new Error('Video not found.');
    }
    return videoId;
  }

  // Standalone voice-overs live in voiceovers/<id>/; ID_PATTERN excludes dots and separators
  function validVoiceoverId(id) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error('Voice-over not found.');
    return id;
  }

  const voiceDir = (videoId) => path.join(userDataDir, 'videos', validVideoId(videoId), 'voice');
  const wavPath = (videoId) => path.join(voiceDir(videoId), 'narration.wav');
  const metaPath = (videoId) => path.join(voiceDir(videoId), 'voice_meta.json');
  const voiceoverDir = (id) => path.join(userDataDir, 'voiceovers', validVoiceoverId(id));
  const voiceoverWavPath = (id) => path.join(voiceoverDir(id), 'narration.wav');
  const voiceoverMetaPath = (id) => path.join(voiceoverDir(id), 'voice_meta.json');

  function requireKey() {
    const key = getApiKey();
    if (!key) throw new Error('Add your Cartesia API key in Settings first.');
    return key;
  }

  // Paths are resolved inside the try so an unknown id reads as "no track"
  function readMeta(metaFile, wavFile) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile(), 'utf8'));
      if (!fs.existsSync(wavFile())) return null;
      return meta && typeof meta === 'object' ? meta : null;
    } catch {
      return null;
    }
  }

  const get = (videoId) => readMeta(() => metaPath(videoId), () => wavPath(videoId));
  const getVoiceover = (id) => readMeta(() => voiceoverMetaPath(id), () => voiceoverWavPath(id));

  // Newest first; folders without a readable track are skipped
  function listVoiceovers() {
    let names;
    try {
      names = fs.readdirSync(path.join(userDataDir, 'voiceovers'));
    } catch {
      return [];
    }
    return names
      .filter((name) => ID_PATTERN.test(name))
      .map((name) => getVoiceover(name))
      .filter(Boolean)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  function deleteVoiceover(id) {
    const dir = voiceoverDir(id);
    if (active?.voiceoverId === id) throw new Error('That voice-over is being generated.');
    fs.rmSync(dir, { recursive: true, force: true });
  }

  function writeAtomic(file, data) {
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, data);
    fs.renameSync(temp, file);
  }

  async function fetchVoicesPage(apiKey, cursor, signal) {
    const url = new URL('/voices/', baseUrl);
    url.searchParams.set('limit', String(VOICES_PAGE_LIMIT));
    if (cursor) url.searchParams.set('starting_after', cursor);
    const response = await fetchImpl(url, { headers: headersFor(apiKey), signal });
    if (!response.ok) throw await errorFromResponse(response);
    return response.json();
  }

  async function testConnection() {
    const apiKey = requireKey();
    const url = new URL('/voices/', baseUrl);
    url.searchParams.set('limit', '1');
    const response = await fetchImpl(url, { headers: headersFor(apiKey), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw await errorFromResponse(response);
    return { ok: true };
  }

  async function listVoices({ language = DEFAULT_LANGUAGE, refresh = false } = {}) {
    if (!refresh && voiceCache.has(language)) return voiceCache.get(language);
    const apiKey = requireKey();
    const signal = AbortSignal.timeout(60000);
    const raw = [];
    let cursor = null;
    // The endpoint pages by 100 and the public catalog is several hundred voices
    for (let page = 0; page < VOICES_MAX_PAGES; page += 1) {
      const data = await fetchVoicesPage(apiKey, cursor, signal);
      raw.push(...(Array.isArray(data?.data) ? data.data : []));
      cursor = data?.next_page;
      if (!data?.has_more || !cursor) break;
    }
    const voices = filterVoices(raw, language);
    voiceCache.set(language, voices);
    return voices;
  }

  function clearVoiceCache() {
    voiceCache.clear();
    ownedCache = null;
  }

  // GET on a voices endpoint. A 4xx that mentions the API version is retried once with the newer
  // version, which is then remembered. Returns the Response (ok or not) so callers can map 404.
  async function voicesGet(url, apiKey, signal) {
    const send = (version) => fetchImpl(url, { headers: headersFor(apiKey, version), signal });
    let response = await send(voicesVersion);
    if (!response.ok && response.status >= 400 && response.status < 500 && voicesVersion !== VOICES_FALLBACK_VERSION) {
      let body = '';
      try {
        body = await response.clone().text();
      } catch {
        // Without a body there is no evidence of a version problem
      }
      if (/version/i.test(body)) {
        const retry = await send(VOICES_FALLBACK_VERSION);
        if (retry.ok) voicesVersion = VOICES_FALLBACK_VERSION;
        response = retry;
      }
    }
    return response;
  }

  // Every voice the account owns (cloned or created), with preview URLs; cached until refresh
  async function listOwnedVoices({ refresh = false } = {}) {
    if (!refresh && ownedCache) return ownedCache;
    const apiKey = requireKey();
    const signal = AbortSignal.timeout(60000);
    const voices = [];
    const seen = new Set();
    let cursor = null;
    for (let page = 0; page < VOICES_MAX_PAGES; page += 1) {
      const url = new URL('/voices/', baseUrl);
      url.searchParams.set('limit', String(VOICES_PAGE_LIMIT));
      url.searchParams.set('is_owner', 'true');
      url.searchParams.append('expand[]', 'preview_file_url');
      if (cursor) url.searchParams.set('starting_after', cursor);
      const response = await voicesGet(url, apiKey, signal);
      if (!response.ok) throw await errorFromResponse(response);
      const data = await response.json();
      for (const raw of Array.isArray(data?.data) ? data.data : []) {
        if (raw?.id && !seen.has(raw.id)) {
          seen.add(raw.id);
          voices.push(toOwnedVoice(raw));
        }
      }
      cursor = data?.next_page;
      if (!data?.has_more || !cursor) break;
    }
    ownedCache = voices;
    return voices;
  }

  // One voice by id, or null when Cartesia does not know it
  async function lookupVoice(id) {
    if (typeof id !== 'string' || !VOICE_ID_PATTERN.test(id)) throw new Error('That does not look like a voice ID.');
    const apiKey = requireKey();
    const url = new URL(`/voices/${id}`, baseUrl);
    url.searchParams.append('expand[]', 'preview_file_url');
    const response = await voicesGet(url, apiKey, AbortSignal.timeout(30000));
    if (response.status === 404) return null;
    if (!response.ok) throw await errorFromResponse(response);
    return toOwnedVoice(await response.json());
  }

  async function streamTake(body, run) {
    const response = await fetchImpl(new URL('/tts/sse', baseUrl), {
      method: 'POST',
      headers: { ...headersFor(run.apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: run.controller.signal,
    });
    if (!response.ok) throw await errorFromResponse(response);
    if (!response.body) throw new Error('Cartesia returned an empty response.');

    const take = createTake();
    const decoder = new TextDecoder();
    const parser = createSseParser((event) => take.add(event));
    let lastProgress = 0;
    for await (const chunk of response.body) {
      parser.push(decoder.decode(chunk, { stream: true }));
      const now = Date.now();
      if (now - lastProgress >= PROGRESS_INTERVAL_MS) {
        lastProgress = now;
        onProgress({ videoId: run.videoId, voiceoverId: run.voiceoverId, seconds: take.seconds });
      }
    }
    parser.push(decoder.decode());
    parser.end();
    return take;
  }

  // One generation at a time, for a video or (kind 'voiceover') a standalone track. Returns the stored meta.
  async function generate({
    videoId,
    kind = 'video',
    title,
    text,
    voiceId,
    voiceName,
    model = DEFAULT_MODEL,
    language = DEFAULT_LANGUAGE,
    speed,
  }) {
    const isVoiceover = kind === 'voiceover';
    if (kind !== 'video' && !isVoiceover) throw new Error('Unknown generation target.');
    if (!isVoiceover) validVideoId(videoId);
    if (active) throw new Error('A voice generation is already in progress.');
    if (typeof text !== 'string' || !text.trim()) throw new Error('There is no narration text to speak.');
    if (text.length > TEXT_MAX) throw new Error('The narration text is too long.');
    if (typeof voiceId !== 'string' || !ID_PATTERN.test(voiceId)) throw new Error('Invalid voice.');
    if (!MODELS.includes(model)) throw new Error('Unknown voice model.');
    if (typeof language !== 'string' || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(language)) throw new Error('Invalid language.');
    const apiKey = simulate ? null : requireKey();

    const voiceoverId = isVoiceover ? crypto.randomUUID() : null;
    const run = { videoId: isVoiceover ? null : videoId, voiceoverId, apiKey, controller: new AbortController(), cancelled: false };
    active = run;
    const timer = setTimeout(() => run.controller.abort(), timeoutMs);
    try {
      let words;
      let pcm;
      if (simulate) {
        ({ words, pcm } = simulateTake(text));
        onProgress({ videoId: run.videoId, voiceoverId, seconds: pcm.length / (SAMPLE_RATE * 2) });
      } else {
        const take = await streamTake(buildRequestBody({ model, text, voiceId, language, speed }), run);
        pcm = take.pcm();
        words = take.words;
      }
      if (run.cancelled) throw new Error('Generation cancelled.');
      if (pcm.length === 0) throw new Error('Cartesia returned no audio.');

      const meta = {
        model,
        voiceId,
        voiceName: typeof voiceName === 'string' ? voiceName.slice(0, 120) : voiceId,
        language,
        chars: text.length,
        duration: Math.round((pcm.length / (SAMPLE_RATE * 2)) * 1000) / 1000,
        sampleRate: SAMPLE_RATE,
        transcript: text,
        words,
        createdAt: Date.now(),
        ...(simulate ? { simulated: true } : {}),
        ...(isVoiceover ? { id: voiceoverId, title: voiceoverTitle(title, text) } : {}),
      };
      const dir = isVoiceover ? voiceoverDir(voiceoverId) : voiceDir(videoId);
      fs.mkdirSync(dir, { recursive: true });
      writeAtomic(path.join(dir, 'narration.wav'), buildWav(pcm));
      writeAtomic(path.join(dir, 'voice_meta.json'), JSON.stringify(meta, null, 2));
      return meta;
    } catch (error) {
      if (run.cancelled) throw new Error('Generation cancelled.');
      if (error?.name === 'AbortError') throw new Error('Cartesia took too long to respond.');
      throw error;
    } finally {
      clearTimeout(timer);
      active = null;
    }
  }

  function cancel() {
    if (!active) return false;
    active.cancelled = true;
    active.controller.abort();
    return true;
  }

  return {
    generate,
    cancel,
    get,
    listVoices,
    listOwnedVoices,
    lookupVoice,
    clearVoiceCache,
    testConnection,
    activeVideoId: () => active?.videoId ?? null,
    isBusy: () => active !== null,
    voiceDir,
    wavPath,
    getVoiceover,
    listVoiceovers,
    deleteVoiceover,
    voiceoverDir,
    voiceoverWavPath,
  };
}

module.exports = {
  createVoiceService,
  createSseParser,
  createTake,
  buildWav,
  buildRequestBody,
  buildGenerationConfig,
  filterVoices,
  simulateTake,
  voiceoverTitle,
  toOwnedVoice,
  VOICES_API_VERSION,
  VOICES_FALLBACK_VERSION,
  VOICE_ID_PATTERN,
  MODELS,
  DEFAULT_MODEL,
  SAMPLE_RATE,
  API_VERSION,
};
