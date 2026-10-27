// Run with: node src/editor/exportVideo.test.mjs
import assert from 'node:assert/strict';
import { exportVideo } from './exportVideo.js';
import { compositionSize } from './plan.js';

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n     ${error.message}`);
  }
}

// 1. Unsupported check throws Spanish error
await test('throws Spanish error when canRenderMediaOnWeb reports unsupported', async () => {
  const fakeCanRender = async () => ({
    canRender: false,
    issues: [
      { severity: 'error', message: 'H.264 video codec unsupported by WebCodecs' },
    ],
  });

  await assert.rejects(
    async () => {
      await exportVideo({ component: () => null }, { canRenderMediaOnWeb: fakeCanRender });
    },
    (err) => {
      assert.match(err.message, /El navegador no puede exportar el video/);
      assert.match(err.message, /H\.264 video codec unsupported by WebCodecs/);
      return true;
    }
  );
});

// 2. Missing component throws Spanish error
await test('throws Spanish error when component is omitted', async () => {
  await assert.rejects(
    async () => {
      await exportVideo({});
    },
    (err) => {
      assert.match(err.message, /Se requiere un componente de composición/);
      return true;
    }
  );
});

// 3. Invokes renderMediaOnWeb with exact required options
await test('invokes renderMediaOnWeb with exact composition, container and codec options', async () => {
  let passedOptions = null;
  const fakeBlob = new Blob(['mock-mp4-data'], { type: 'video/mp4' });

  const fakeCanRender = async (opts) => {
    assert.equal(opts.container, 'mp4');
    assert.equal(opts.videoCodec, 'h264');
    assert.equal(opts.width, compositionSize.width);
    assert.equal(opts.height, compositionSize.height);
    return { canRender: true, issues: [] };
  };

  const fakeRenderMedia = async (options) => {
    passedOptions = options;
    return {
      getBlob: async () => fakeBlob,
    };
  };

  const inputProps = {
    edl: { duration: 10.5, clips: [] },
    sources: { 1: 'mecatube-media://animation/1' },
    audioUrl: 'mecatube-media://voice/test',
  };

  const progressFn = () => {};
  const controller = new AbortController();
  const mockComponent = () => null;

  const resultBlob = await exportVideo(
    {
      component: mockComponent,
      inputProps,
      onProgress: progressFn,
      signal: controller.signal,
    },
    {
      canRenderMediaOnWeb: fakeCanRender,
      renderMediaOnWeb: fakeRenderMedia,
    }
  );

  assert.equal(resultBlob, fakeBlob);
  assert.ok(passedOptions);
  assert.equal(passedOptions.container, 'mp4');
  assert.equal(passedOptions.videoCodec, 'h264');
  assert.equal(passedOptions.onProgress, progressFn);
  assert.equal(passedOptions.signal, controller.signal);
  assert.equal(passedOptions.inputProps, inputProps);

  const comp = passedOptions.composition;
  assert.equal(comp.component, mockComponent);
  assert.equal(comp.id, 'mecatube-final');
  assert.equal(comp.calculateMetadata, null);
  assert.equal(comp.fps, compositionSize.fps);
  assert.equal(comp.width, compositionSize.width);
  assert.equal(comp.height, compositionSize.height);
  assert.equal(comp.durationInFrames, Math.round(10.5 * compositionSize.fps));
});

// 4. Custom durationInFrames beats edl duration
await test('custom durationInFrames overrides default calculation', async () => {
  let capturedFrames = null;
  const fakeCanRender = async () => ({ canRender: true, issues: [] });
  const fakeRenderMedia = async (options) => {
    capturedFrames = options.composition.durationInFrames;
    return { getBlob: async () => new Blob([]) };
  };

  await exportVideo(
    {
      component: () => null,
      durationInFrames: 500,
      inputProps: { edl: { duration: 1 } },
    },
    {
      canRenderMediaOnWeb: fakeCanRender,
      renderMediaOnWeb: fakeRenderMedia,
    }
  );

  assert.equal(capturedFrames, 500);
});

if (failures > 0) {
  process.exit(1);
} else {
  console.log('\nall passed');
}
