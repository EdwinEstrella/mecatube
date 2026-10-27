// Service for exporting rendered video files to the workspace videos/<videoId>/final folder.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VIDEO_ID = /^[\w-]{1,100}$/;
const MAX_EXPORT_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

function validVideoId(value) {
  if (typeof value !== 'string' || !VIDEO_ID.test(value)) {
    throw new Error('ID de video no válido.');
  }
  return value;
}

function sanitizeSlug(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return 'video-final';
  }

  let name = fileName.trim();
  // Strip trailing .mp4 if already included
  if (/\.mp4$/i.test(name)) {
    name = name.slice(0, -4);
  }

  // Decompose accented characters to ASCII equivalents
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Keep letters, numbers, and dashes; convert other characters into dashes
  const slug = normalized
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');

  return slug || 'video-final';
}

function writeAtomic(file, data) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
}

function toBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) {
    return bytes;
  }
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  if (bytes instanceof ArrayBuffer) {
    return Buffer.from(bytes);
  }
  throw new Error('Datos de exportación no válidos.');
}

function createExporterService({ getWorkspacePath, shell }) {
  const inProgressExports = new Map();

  function saveExport({ videoId, fileName, bytes }) {
    validVideoId(videoId);
    if (!bytes || typeof bytes !== 'object') {
      throw new Error('Datos de exportación no válidos.');
    }

    const byteSize = bytes.byteLength ?? bytes.length;
    if (typeof byteSize === 'number' && byteSize > MAX_EXPORT_BYTES) {
      throw new Error('El archivo supera el tamaño máximo permitido (2 GB).');
    }

    const buffer = toBuffer(bytes);
    if (buffer.length > MAX_EXPORT_BYTES) {
      throw new Error('El archivo supera el tamaño máximo permitido (2 GB).');
    }

    const ws = getWorkspacePath?.();
    if (!ws) throw new Error('Espacio de trabajo no disponible.');

    const finalDir = path.resolve(ws, 'videos', videoId, 'final');
    fs.mkdirSync(finalDir, { recursive: true });

    const slug = sanitizeSlug(fileName);
    const filePath = path.resolve(finalDir, `${slug}.mp4`);

    if (!filePath.startsWith(finalDir + path.sep)) {
      throw new Error('Ruta de exportación no válida.');
    }

    writeAtomic(filePath, buffer);
    return filePath;
  }

  function getExport(videoId) {
    validVideoId(videoId);
    const ws = getWorkspacePath?.();
    if (!ws) return null;

    const finalDir = path.resolve(ws, 'videos', videoId, 'final');
    if (!fs.existsSync(finalDir)) return null;

    try {
      const entries = fs.readdirSync(finalDir);
      const mp4Files = entries.filter((name) => name.toLowerCase().endsWith('.mp4'));
      if (mp4Files.length === 0) return null;

      let latestFile = null;
      let latestMtime = -1;

      for (const name of mp4Files) {
        const fullPath = path.join(finalDir, name);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestFile = fullPath;
          }
        } catch {
          // Ignore unreadable entries
        }
      }

      return latestFile;
    } catch {
      return null;
    }
  }

  async function openExportFolder(videoId) {
    validVideoId(videoId);
    const ws = getWorkspacePath?.();
    if (!ws) throw new Error('Espacio de trabajo no disponible.');

    const finalDir = path.resolve(ws, 'videos', videoId, 'final');
    fs.mkdirSync(finalDir, { recursive: true });

    if (shell?.openPath) {
      await shell.openPath(finalDir);
    }
    return finalDir;
  }

  function startExport({ videoId, fileName, totalSize }) {
    validVideoId(videoId);
    if (typeof totalSize === 'number' && totalSize > MAX_EXPORT_BYTES) {
      throw new Error('El archivo supera el tamaño máximo permitido (2 GB).');
    }

    const ws = getWorkspacePath?.();
    if (!ws) throw new Error('Espacio de trabajo no disponible.');

    const finalDir = path.resolve(ws, 'videos', videoId, 'final');
    fs.mkdirSync(finalDir, { recursive: true });

    const slug = sanitizeSlug(fileName);
    const filePath = path.resolve(finalDir, `${slug}.mp4`);
    if (!filePath.startsWith(finalDir + path.sep)) {
      throw new Error('Ruta de exportación no válida.');
    }

    const exportId = crypto.randomUUID();
    const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const fd = fs.openSync(tempPath, 'w');

    inProgressExports.set(exportId, {
      videoId,
      filePath,
      tempPath,
      fd,
      bytesWritten: 0,
    });

    return { exportId };
  }

  function appendExportChunk({ exportId, chunk }) {
    const item = inProgressExports.get(exportId);
    if (!item) throw new Error('Sesión de exportación no encontrada.');

    const buffer = toBuffer(chunk);
    if (item.bytesWritten + buffer.length > MAX_EXPORT_BYTES) {
      fs.closeSync(item.fd);
      fs.rmSync(item.tempPath, { force: true });
      inProgressExports.delete(exportId);
      throw new Error('El archivo supera el tamaño máximo permitido (2 GB).');
    }

    fs.writeSync(item.fd, buffer);
    item.bytesWritten += buffer.length;
    return { bytesWritten: item.bytesWritten };
  }

  function finishExport({ exportId }) {
    const item = inProgressExports.get(exportId);
    if (!item) throw new Error('Sesión de exportación no encontrada.');

    fs.closeSync(item.fd);
    inProgressExports.delete(exportId);
    fs.renameSync(item.tempPath, item.filePath);
    return item.filePath;
  }

  function abortExport({ exportId }) {
    const item = inProgressExports.get(exportId);
    if (item) {
      try {
        fs.closeSync(item.fd);
      } catch {}
      try {
        fs.rmSync(item.tempPath, { force: true });
      } catch {}
      inProgressExports.delete(exportId);
    }
  }

  function saveThumbnail(payload, maybeSourcePath) {
    const videoId = typeof payload === 'object' && payload !== null ? payload.videoId : payload;
    const sourcePath = typeof payload === 'object' && payload !== null ? payload.sourcePath : maybeSourcePath;

    validVideoId(videoId);
    if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
      throw new Error('Ruta de miniatura no válida.');
    }

    const ws = getWorkspacePath?.();
    if (!ws) throw new Error('Espacio de trabajo no disponible.');

    const videoDir = path.resolve(ws, 'videos', videoId);
    const resolvedSource = path.isAbsolute(sourcePath)
      ? path.resolve(sourcePath)
      : path.resolve(videoDir, sourcePath);

    const relativeToVideo = path.relative(videoDir, resolvedSource);
    if (relativeToVideo.startsWith('..') || path.isAbsolute(relativeToVideo) || relativeToVideo === '') {
      throw new Error('La ruta de origen debe estar dentro de la carpeta del video.');
    }

    const ext = path.extname(resolvedSource).toLowerCase();
    const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
    if (!ALLOWED_EXTS.includes(ext)) {
      throw new Error('Extensión de miniatura no permitida (solo png, jpg o webp).');
    }

    if (!fs.existsSync(resolvedSource)) {
      throw new Error('El archivo de miniatura no existe.');
    }

    const finalDir = path.resolve(videoDir, 'final');
    fs.mkdirSync(finalDir, { recursive: true });

    for (const allowed of ALLOWED_EXTS) {
      if (allowed !== ext) {
        try {
          fs.rmSync(path.resolve(finalDir, `miniatura${allowed}`), { force: true });
        } catch {}
      }
    }

    const destPath = path.resolve(finalDir, `miniatura${ext}`);
    fs.copyFileSync(resolvedSource, destPath);
    return destPath;
  }

  return {
    saveExport,
    getExport,
    openExportFolder,
    startExport,
    appendExportChunk,
    finishExport,
    abortExport,
    saveThumbnail,
    sanitizeSlug,
  };
}

function registerExporterIpc({ ipcMain, service }) {
  ipcMain.handle('editor:save-export', (_event, payload = {}) => service.saveExport(payload));
  ipcMain.handle('editor:get-export', (_event, payload) => {
    const videoId = typeof payload === 'string' ? payload : payload?.videoId;
    return service.getExport(videoId);
  });
  ipcMain.handle('editor:open-export-folder', (_event, payload) => {
    const videoId = typeof payload === 'string' ? payload : payload?.videoId;
    return service.openExportFolder(videoId);
  });
  ipcMain.handle('editor:export-start', (_event, payload = {}) => service.startExport(payload));
  ipcMain.handle('editor:export-chunk', (_event, payload = {}) => service.appendExportChunk(payload));
  ipcMain.handle('editor:export-finish', (_event, payload = {}) => service.finishExport(payload));
  ipcMain.handle('editor:export-abort', (_event, payload = {}) => service.abortExport(payload));
  ipcMain.handle('editor:save-thumbnail', (_event, payload = {}) => service.saveThumbnail(payload));
}

module.exports = {
  VIDEO_ID,
  MAX_EXPORT_BYTES,
  sanitizeSlug,
  createExporterService,
  registerExporterIpc,
};
