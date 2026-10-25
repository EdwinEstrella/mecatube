// Voice-over wiring for the main process: privileged media scheme, secrets and voice IPC.
const fs = require('node:fs');
const { Readable } = require('node:stream');

const MEDIA_SCHEME = 'mecatube-media';

// Must run before app 'ready'
function registerMediaScheme(protocol) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
    },
  ]);
}

// "bytes=start-end" | "bytes=start-" | "bytes=-suffix" -> { start, end } (inclusive), null when absent,
// 'invalid' when it cannot be satisfied. Only a single range is supported.
function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid';
  let start;
  let end;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (suffix === 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

// Serves only a video's voice/narration.wav (mecatube-media://voice/<videoId>) or a standalone
// voiceovers/<id>/narration.wav (mecatube-media://voiceover/<id>), with range support for seeking.
// With `characterFile(videoId, key, file)` it also serves a Flow character image
// (mecatube-media://character/<videoId>/<characterKey>/<file>); `sceneFile(videoId, number, file)` does
// the same for scene images (mecatube-media://scene/<videoId>/<number>/<file>). Resolvers validate every part.
const IMAGE_TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };

function createMediaHandler(voice, { characterFile, sceneFile } = {}) {
  return async (request) => {
    let file;
    let contentType = 'audio/wav';
    try {
      const url = new URL(request.url);
      const parts = url.pathname.slice(1).split('/').map(decodeURIComponent);
      if (url.hostname === 'voice' && parts.length === 1) file = voice.wavPath(parts[0]);
      else if (url.hostname === 'voiceover' && parts.length === 1) file = voice.voiceoverWavPath(parts[0]);
      else if (url.hostname === 'character' && characterFile && parts.length === 3) {
        file = characterFile(parts[0], parts[1], parts[2]);
        contentType = IMAGE_TYPES[file.slice(file.lastIndexOf('.')).toLowerCase()];
        if (!contentType) throw new Error('No encontrado');
      } else if (url.hostname === 'scene' && sceneFile && parts.length === 3) {
        file = sceneFile(parts[0], parts[1], parts[2]);
        contentType = IMAGE_TYPES[file.slice(file.lastIndexOf('.')).toLowerCase()];
        if (!contentType) throw new Error('No encontrado');
      } else throw new Error('No encontrado');
    } catch {
      return new Response('Not found', { status: 404 });
    }
    let size;
    try {
      size = fs.statSync(file).size;
    } catch {
      return new Response('Not found', { status: 404 });
    }
    const base = { 'Content-Type': contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    const range = parseRange(request.headers.get('range'), size);
    if (range === 'invalid') {
      return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } });
    }
    const { start, end } = range ?? { start: 0, end: size - 1 };
    const body = size === 0 ? null : Readable.toWeb(fs.createReadStream(file, { start, end }));
    return new Response(body, {
      status: range ? 206 : 200,
      headers: {
        ...base,
        'Content-Length': String(size === 0 ? 0 : end - start + 1),
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
      },
    });
  };
}

// getVideoTitle(id) names a video in the usage ledger; credits and prefs are optional stores
function registerVoiceIpc({ ipcMain, shell, voice, secrets, pushToWindow, prefs, credits, savedVoices, getVideoTitle = () => '' }) {
  ipcMain.handle('secrets:cartesia-status', () => secrets.cartesiaStatus());

  ipcMain.handle('secrets:cartesia-save', (_event, { key } = {}) => {
    secrets.saveCartesiaKey(key);
    voice.clearVoiceCache();
    return secrets.cartesiaStatus();
  });

  ipcMain.handle('secrets:cartesia-clear', () => {
    secrets.clearCartesiaKey();
    voice.clearVoiceCache();
    return secrets.cartesiaStatus();
  });

  // Errors are returned, not thrown, so the renderer shows the message without IPC noise
  ipcMain.handle('secrets:cartesia-test', async () => {
    try {
      return await voice.testConnection();
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('voice:owned-voices', (_event, { refresh } = {}) => voice.listOwnedVoices({ refresh }));
  ipcMain.handle('voice:lookup', (_event, { id } = {}) => voice.lookupVoice(id));
  ipcMain.handle('saved-voices:list', () => savedVoices.list());
  ipcMain.handle('saved-voices:add', (_event, input) => savedVoices.add(input));
  ipcMain.handle('saved-voices:rename', (_event, { id, label } = {}) => savedVoices.rename(id, label));
  ipcMain.handle('saved-voices:remove', (_event, { id } = {}) => savedVoices.remove(id));

  // Runs one generation for a video or a standalone voice-over; the last successful choice becomes the
  // default voice and real (non-simulated) takes are counted in the usage ledger. Neither can lose the take.
  async function runGeneration(payload, kind) {
    const request = { ...payload, kind };
    const videoId = kind === 'video' ? payload.videoId : null;
    try {
      const meta = await voice.generate(request);
      try {
        prefs?.set({ voiceId: meta.voiceId, voiceName: meta.voiceName, model: meta.model });
      } catch {
        // Preferences are a convenience
      }
      try {
        if (credits && !meta.simulated) {
          credits.record({
            videoId,
            videoTitle: kind === 'video' ? getVideoTitle(videoId) : meta.title,
            chars: meta.chars,
            model: meta.model,
            voiceName: meta.voiceName,
          });
          pushToWindow('credits:changed', {});
        }
      } catch {
        // The ledger is informational
      }
      pushToWindow('voice:finished', { videoId, voiceoverId: meta.id ?? null, ok: true });
      return meta;
    } catch (error) {
      pushToWindow('voice:finished', { videoId, voiceoverId: null, ok: false, error: error.message });
      throw error;
    }
  }

  ipcMain.handle('voice:generate', (_event, payload = {}) => runGeneration(payload, 'video'));
  ipcMain.handle('voiceover:generate', (_event, payload = {}) => runGeneration(payload, 'voiceover'));
  ipcMain.handle('voiceover:list', () => voice.listVoiceovers());
  ipcMain.handle('voiceover:delete', (_event, { id } = {}) => voice.deleteVoiceover(id));
  ipcMain.handle('voiceover:open-folder', async (_event, { id } = {}) => {
    const dir = voice.voiceoverDir(id);
    if (!fs.existsSync(dir)) throw new Error('Esa voz en off ya no existe.');
    const failure = await shell.openPath(dir);
    if (failure) throw new Error(failure);
  });

  ipcMain.handle('voice:prefs-get', () => prefs.get());
  ipcMain.handle('voice:prefs-set', (_event, input) => prefs.set(input));

  ipcMain.handle('credits:summary', () => credits.summary());
  ipcMain.handle('credits:settings-save', (_event, input) => {
    const result = credits.saveSettings(input);
    pushToWindow('credits:changed', {});
    return result;
  });
  ipcMain.handle('credits:calibrate', (_event, input) => {
    const result = credits.calibrate(input);
    pushToWindow('credits:changed', {});
    return result;
  });
  ipcMain.handle('credits:clear-calibration', () => {
    const result = credits.clearCalibration();
    pushToWindow('credits:changed', {});
    return result;
  });

  ipcMain.handle('voice:cancel', () => voice.cancel());
  ipcMain.handle('voice:active', () => voice.activeVideoId());
  ipcMain.handle('voice:busy', () => voice.isBusy());
  ipcMain.handle('voice:get', (_event, { videoId } = {}) => voice.get(videoId));

  ipcMain.handle('voice:open-folder', async (_event, { videoId } = {}) => {
    const dir = voice.voiceDir(videoId);
    if (!fs.existsSync(dir)) throw new Error('Este video aún no tiene una pista de voz.');
    const failure = await shell.openPath(dir);
    if (failure) throw new Error(failure);
  });
}

module.exports = { MEDIA_SCHEME, registerMediaScheme, createMediaHandler, registerVoiceIpc, parseRange };
