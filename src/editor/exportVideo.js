// Client-side video export using Remotion web-renderer with MP4 container and H.264 codec.
import { canRenderMediaOnWeb, renderMediaOnWeb } from '@remotion/web-renderer';
import { compositionSize } from './plan.js';

export async function exportVideo(
  {
    component,
    durationInFrames,
    fps = compositionSize.fps,
    width = compositionSize.width,
    height = compositionSize.height,
    inputProps = {},
    onProgress = null,
    signal = null,
  } = {},
  deps = {}
) {
  if (!component) {
    throw new Error('Se requiere un componente de composición para exportar.');
  }

  const canRenderFn = deps.canRenderMediaOnWeb || canRenderMediaOnWeb;
  const renderMediaFn = deps.renderMediaOnWeb || renderMediaOnWeb;

  const check = await canRenderFn({
    width,
    height,
    container: 'mp4',
    videoCodec: 'h264',
  });

  if (check && !check.canRender) {
    const errorIssues = (check.issues || [])
      .filter((i) => i.severity === 'error')
      .map((i) => i.message);
    const details = errorIssues.length > 0 ? errorIssues.join(', ') : 'incompatibilidad técnica';
    throw new Error(`El navegador no puede exportar el video: ${details}.`);
  }

  const duration =
    typeof durationInFrames === 'number' && durationInFrames > 0
      ? durationInFrames
      : Math.max(1, Math.round((inputProps?.edl?.duration ?? 0) * fps));

  const { getBlob } = await renderMediaFn({
    composition: {
      component,
      durationInFrames: duration,
      fps,
      width,
      height,
      calculateMetadata: null,
      id: 'mecatube-final',
    },
    inputProps,
    container: 'mp4',
    videoCodec: 'h264',
    onProgress: onProgress || null,
    signal: signal || null,
  });

  return await getBlob();
}
