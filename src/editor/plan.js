// Pure: Remotion playback plan builder and subtitle lookup. No React.
// Converts EDL clips into contiguous frame ranges, transitions, and camera motions.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DEFAULT_CLIP_SECONDS = 8;
export const TRANSITION_FRAMES = { fade: 12, slide: 12 };
export const PUNCH_FRAMES = 8;

export const compositionSize = {
  width: WIDTH,
  height: HEIGHT,
  fps: FPS,
};

function round3(num) {
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
}

export function buildPlan(edl, { fps = FPS, clipDurations = {} } = {}) {
  if (
    !edl ||
    typeof edl !== 'object' ||
    !Array.isArray(edl.clips) ||
    edl.clips.length === 0
  ) {
    return null;
  }

  const durationInFrames = Math.max(1, Math.round((edl.duration ?? 0) * fps));
  const rawClips = edl.clips;
  const initialItems = [];

  for (let k = 0; k < rawClips.length; k += 1) {
    const clip = rawClips[k];
    const startFrame = Math.round((clip.start ?? 0) * fps);
    const endFrame =
      k + 1 < rawClips.length
        ? Math.round((rawClips[k + 1].start ?? 0) * fps)
        : durationInFrames;
    const frames = endFrame - startFrame;

    if (frames < 1) {
      if (initialItems.length > 0) {
        const prev = initialItems[initialItems.length - 1];
        prev.endFrame = endFrame;
        prev.frames = prev.endFrame - prev.startFrame;
      }
    } else {
      initialItems.push({
        clip,
        startFrame,
        endFrame,
        frames,
      });
    }
  }

  if (initialItems.length === 0) {
    return null;
  }

  if (initialItems[0].startFrame !== 0) {
    initialItems[0].startFrame = 0;
    initialItems[0].frames = initialItems[0].endFrame - initialItems[0].startFrame;
  }

  const lastItem = initialItems[initialItems.length - 1];
  if (lastItem.endFrame !== durationInFrames) {
    lastItem.endFrame = durationInFrames;
    lastItem.frames = lastItem.endFrame - lastItem.startFrame;
  }

  // Compute transitionIn and punchIn for each item.
  const staged = initialItems.map((item, k) => {
    let transitionIn = null;
    const transitionType = item.clip.transition;
    if (k > 0 && (transitionType === 'fade' || transitionType === 'slide')) {
      const maxFrames = TRANSITION_FRAMES[transitionType] ?? 0;
      const prevFrames = initialItems[k - 1].frames;
      const curFrames = item.frames;
      const transFrames = Math.min(
        maxFrames,
        Math.floor(prevFrames / 2),
        Math.floor(curFrames / 2)
      );
      if (transFrames >= 2) {
        transitionIn = { type: transitionType, frames: transFrames };
      }
    }

    const punchIn = transitionType === 'zoom';

    return {
      clip: item.clip,
      startFrame: item.startFrame,
      frames: item.frames,
      transitionIn,
      punchIn,
    };
  });

  // Calculate sequenceFrames with overlap compensation and determine playback speed.
  const items = staged.map((item, index) => {
    const nextTransitionFrames = staged[index + 1]?.transitionIn?.frames ?? 0;
    const sequenceFrames = item.frames + nextTransitionFrames;
    const segmentSeconds = sequenceFrames / fps;

    const rawDuration = clipDurations[item.clip.number];
    const source =
      typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0
        ? rawDuration
        : DEFAULT_CLIP_SECONDS;

    let playbackRate = 1;
    let loop = false;

    if (segmentSeconds <= source) {
      playbackRate = 1;
      loop = false;
    } else if (segmentSeconds <= source * 1.6) {
      playbackRate = round3(source / segmentSeconds);
      loop = false;
    } else {
      playbackRate = 1;
      loop = true;
    }

    return {
      key: `${index}-${item.clip.number}`,
      number: item.clip.number,
      startFrame: item.startFrame,
      frames: item.frames,
      sequenceFrames,
      transitionIn: item.transitionIn,
      punchIn: item.punchIn,
      motion: item.clip.motion || 'none',
      playbackRate,
      loop,
    };
  });

  return {
    durationInFrames,
    items,
  };
}

export function activeSubtitle(subtitles, seconds) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) return null;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;

  let low = 0;
  let high = subtitles.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const sub = subtitles[mid];
    if (seconds < sub.start) {
      high = mid - 1;
    } else if (seconds >= sub.end) {
      low = mid + 1;
    } else {
      return sub;
    }
  }

  return null;
}
