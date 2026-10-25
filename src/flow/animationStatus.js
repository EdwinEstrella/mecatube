// Pure helpers over the stored animation records ({ number, hook, generations: [{ files }] }), the
// scene records (their chosen image is the animation's start frame) and the live animation-status
// events ({ state: queued | running | done | error | cancelled, percent, captcha, error }).
import { allFiles, isActive, latestFiles } from './sceneStatus.js';

export function animationVideoUrl(videoId, number, file) {
  return `mecatube-media://animation/${encodeURIComponent(videoId)}/${encodeURIComponent(number)}/${encodeURIComponent(file)}`;
}

// Latest video of an animation, or null
export const latestVideo = (record) => latestFiles(record)[0] ?? null;

// True when the scene with the same number has a chosen image that still exists
export function hasSourceImage(sceneRecord) {
  return Boolean(sceneRecord?.selectedFile) && allFiles(sceneRecord).includes(sceneRecord.selectedFile);
}

// Animations a bulk button queues, in block order: startable (chosen scene image, not queued or
// running) and without a video yet or whose last run failed. hookOnly keeps the hook ones.
export function pendingAnimations(items, statuses, records, sceneRecords, { hookOnly = false } = {}) {
  return items.filter((item) => {
    if (hookOnly && !item.hook) return false;
    if (!hasSourceImage(sceneRecords?.[item.number])) return false;
    const status = statuses[item.number];
    if (isActive(status)) return false;
    return latestVideo(records[item.number]) === null || status?.state === 'error';
  });
}

export const hookCount = (items) => items.filter((item) => item.hook).length;
