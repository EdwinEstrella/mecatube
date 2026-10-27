// Run: node electron/exporter.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  sanitizeSlug,
  createExporterService,
  MAX_EXPORT_BYTES,
} = require('./exporter.cjs');

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok   ${name}`);
}

(async () => {
  const tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'exporter-test-'));

  try {
    let openedFolder = null;
    const fakeShell = {
      openPath: async (p) => {
        openedFolder = p;
        return '';
      },
    };

    const service = createExporterService({
      getWorkspacePath: () => tmpWorkspace,
      shell: fakeShell,
    });

    await test('fileName sanitization converts to safe slug, trims, removes extension and enforces max length', () => {
      assert.equal(sanitizeSlug(''), 'video-final');
      assert.equal(sanitizeSlug(null), 'video-final');
      assert.equal(sanitizeSlug(undefined), 'video-final');
      assert.equal(sanitizeSlug('   '), 'video-final');
      assert.equal(sanitizeSlug('---'), 'video-final');
      assert.equal(sanitizeSlug('Mi Video Genial.mp4'), 'Mi-Video-Genial');
      assert.equal(sanitizeSlug('Edición Especial: ¡Los Secretos!'), 'Edicion-Especial-Los-Secretos');
      assert.equal(sanitizeSlug('../../etc/passwd'), 'etc-passwd');
      assert.equal(sanitizeSlug('foo_bar__baz'), 'foo-bar-baz');
      assert.equal(sanitizeSlug('video-123.MP4'), 'video-123');

      const longTitle = 'a'.repeat(120);
      const sanitized = sanitizeSlug(longTitle);
      assert.equal(sanitized.length, 80);
      assert.equal(sanitized, 'a'.repeat(80));

      const titleEndingInDashes = 'a'.repeat(79) + '---';
      assert.equal(sanitizeSlug(titleEndingInDashes).length, 79);
    });

    await test('invalid videoId is rejected with proper error message', () => {
      const bytes = Buffer.from('test mp4 content');

      assert.throws(() => service.saveExport({ videoId: '', fileName: 'test', bytes }), /ID de video no válido/);
      assert.throws(() => service.saveExport({ videoId: '../traversal', fileName: 'test', bytes }), /ID de video no válido/);
      assert.throws(() => service.saveExport({ videoId: 'bad id with spaces', fileName: 'test', bytes }), /ID de video no válido/);
      assert.throws(() => service.saveExport({ videoId: 'invalid$char', fileName: 'test', bytes }), /ID de video no válido/);
      assert.throws(() => service.saveExport({ videoId: null, fileName: 'test', bytes }), /ID de video no válido/);

      assert.throws(() => service.getExport(''), /ID de video no válido/);
      assert.throws(() => service.getExport('../bad'), /ID de video no válido/);

      assert.rejects(async () => {
        await service.openExportFolder('');
      }, /ID de video no válido/);
    });

    await test('writes the bytes and path stays inside <workspace>/videos/<id>/final', () => {
      const videoId = 'video-test-01';
      const sampleBytes = Buffer.from('video mp4 binary data');

      const savedPath = service.saveExport({
        videoId,
        fileName: 'Mi Video 01',
        bytes: sampleBytes,
      });

      const finalDir = path.resolve(tmpWorkspace, 'videos', videoId, 'final');
      assert.equal(path.dirname(savedPath), finalDir);
      assert.equal(path.basename(savedPath), 'Mi-Video-01.mp4');
      assert.ok(savedPath.startsWith(finalDir + path.sep));
      assert.ok(fs.existsSync(savedPath));
      assert.equal(fs.readFileSync(savedPath, 'utf8'), 'video mp4 binary data');
    });

    await test('accepts Uint8Array and ArrayBuffer inputs', () => {
      const videoId = 'video-test-02';
      const uint8 = new Uint8Array([1, 2, 3, 4, 5]);

      const savedPath = service.saveExport({
        videoId,
        fileName: 'binary-test',
        bytes: uint8,
      });

      assert.ok(fs.existsSync(savedPath));
      const fileBuf = fs.readFileSync(savedPath);
      assert.deepEqual(Array.from(fileBuf), [1, 2, 3, 4, 5]);

      const arrayBuf = new Uint8Array([9, 8, 7]).buffer;
      const savedPath2 = service.saveExport({
        videoId,
        fileName: 'arraybuf-test',
        bytes: arrayBuf,
      });
      assert.ok(fs.existsSync(savedPath2));
      assert.deepEqual(Array.from(fs.readFileSync(savedPath2)), [9, 8, 7]);
    });

    await test('enforces 2 GB max size limit', () => {
      const videoId = 'video-test-03';
      const fakeLargeBuffer = {
        length: MAX_EXPORT_BYTES + 1,
        byteLength: MAX_EXPORT_BYTES + 1,
      };

      assert.throws(
        () => service.saveExport({ videoId, fileName: 'too-big', bytes: fakeLargeBuffer }),
        /tamaño máximo/
      );
    });

    await test('getExport returns latest exported mp4 or null when empty', async () => {
      const videoId = 'video-test-multi';

      assert.equal(service.getExport(videoId), null);

      const path1 = service.saveExport({
        videoId,
        fileName: 'first-export',
        bytes: Buffer.from('first'),
      });
      // Set distinct mtime
      fs.utimesSync(path1, new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:00:00Z'));

      assert.equal(service.getExport(videoId), path1);

      // Create a non-mp4 file in final/
      const finalDir = path.dirname(path1);
      fs.writeFileSync(path.join(finalDir, 'notes.txt'), 'hello');
      fs.utimesSync(path.join(finalDir, 'notes.txt'), new Date('2026-01-03T10:00:00Z'), new Date('2026-01-03T10:00:00Z'));

      // Non-mp4 file must not be returned
      assert.equal(service.getExport(videoId), path1);

      const path2 = service.saveExport({
        videoId,
        fileName: 'second-export',
        bytes: Buffer.from('second'),
      });
      fs.utimesSync(path2, new Date('2026-01-02T10:00:00Z'), new Date('2026-01-02T10:00:00Z'));

      assert.equal(service.getExport(videoId), path2);
    });

    await test('openExportFolder creates final folder and invokes shell.openPath', async () => {
      const videoId = 'video-test-open';
      openedFolder = null;

      const folderPath = await service.openExportFolder(videoId);
      assert.ok(fs.existsSync(folderPath));
      assert.equal(openedFolder, folderPath);
    });

    await test('chunked export start/append/finish roundtrip', () => {
      const videoId = 'video-test-chunked';
      const { exportId } = service.startExport({ videoId, fileName: 'chunked-video', totalSize: 6 });

      service.appendExportChunk({ exportId, chunk: Buffer.from('abc') });
      service.appendExportChunk({ exportId, chunk: new Uint8Array([100, 101, 102]) }); // 'def'

      const finalPath = service.finishExport({ exportId });
      assert.ok(fs.existsSync(finalPath));
      assert.equal(fs.readFileSync(finalPath, 'utf8'), 'abcdef');
    });

    await test('saveThumbnail copies thumbnail to final folder with correct name and extension', () => {
      const videoId = 'video-test-thumb';
      const sceneDir = path.join(tmpWorkspace, 'videos', videoId, 'scenes', '9999');
      fs.mkdirSync(sceneDir, { recursive: true });
      const srcFile = path.join(sceneDir, 'thumbnail-gen.webp');
      fs.writeFileSync(srcFile, 'webp-binary-data');

      const savedPath = service.saveThumbnail({
        videoId,
        sourcePath: 'scenes/9999/thumbnail-gen.webp',
      });

      const finalDir = path.join(tmpWorkspace, 'videos', videoId, 'final');
      const expectedPath = path.join(finalDir, 'miniatura.webp');
      assert.equal(savedPath, expectedPath);
      assert.ok(fs.existsSync(expectedPath));
      assert.equal(fs.readFileSync(expectedPath, 'utf8'), 'webp-binary-data');

      // Also accepts absolute path inside video directory and cleans up previous extension
      const srcPng = path.join(sceneDir, 'thumbnail-2.png');
      fs.writeFileSync(srcPng, 'png-binary-data');
      const savedPng = service.saveThumbnail({
        videoId,
        sourcePath: srcPng,
      });
      const expectedPng = path.join(finalDir, 'miniatura.png');
      assert.equal(savedPng, expectedPng);
      assert.ok(fs.existsSync(expectedPng));
      assert.equal(fs.readFileSync(expectedPng, 'utf8'), 'png-binary-data');
      assert.ok(!fs.existsSync(expectedPath)); // Previous webp cleaned up
    });

    await test('saveThumbnail rejects paths outside the video folder and non-existent files', () => {
      const videoId = 'video-test-thumb-security';
      const otherVideoDir = path.join(tmpWorkspace, 'videos', 'other-video');
      fs.mkdirSync(otherVideoDir, { recursive: true });
      const outsideFile = path.join(otherVideoDir, 'outside.png');
      fs.writeFileSync(outsideFile, 'data');

      assert.throws(
        () => service.saveThumbnail({ videoId, sourcePath: outsideFile }),
        /dentro de la carpeta del video/
      );
      assert.throws(
        () => service.saveThumbnail({ videoId, sourcePath: '../other-video/outside.png' }),
        /dentro de la carpeta del video/
      );
      assert.throws(
        () => service.saveThumbnail({ videoId, sourcePath: 'scenes/9999/missing.png' }),
        /no existe/
      );
    });

    await test('saveThumbnail rejects bad extensions', () => {
      const videoId = 'video-test-thumb-ext';
      const dir = path.join(tmpWorkspace, 'videos', videoId, 'scenes', '9999');
      fs.mkdirSync(dir, { recursive: true });
      const badFile = path.join(dir, 'thumb.txt');
      fs.writeFileSync(badFile, 'text');

      assert.throws(
        () => service.saveThumbnail({ videoId, sourcePath: 'scenes/9999/thumb.txt' }),
        /Extensión de miniatura no permitida/
      );
      assert.throws(
        () => service.saveThumbnail({ videoId, sourcePath: 'scenes/9999/thumb.exe' }),
        /Extensión de miniatura no permitida/
      );
    });

    await test('saveThumbnail rejects invalid videoId', () => {
      assert.throws(
        () => service.saveThumbnail({ videoId: '../evil', sourcePath: 'thumb.png' }),
        /ID de video no válido/
      );
    });

    console.log(`\n${passed} passed`);
  } finally {
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
  }
})();
