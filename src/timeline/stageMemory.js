export const TIMELINE_STAGE_STORAGE_PREFIX = 'mecatube:timeline-stage:';

export function getStageStorageKey(videoId) {
  return `${TIMELINE_STAGE_STORAGE_PREFIX}${videoId}`;
}

export function getInitialStageKey(stageList = []) {
  const notDone = stageList.find((stage) => stage.status !== 'done');
  return notDone?.key ?? stageList[stageList.length - 1]?.key ?? null;
}

export function getRememberedStageKey(
  videoId,
  stages = [],
  storage = (typeof window !== 'undefined' ? window.localStorage : null)
) {
  if (videoId && storage) {
    try {
      const storedKey = storage.getItem(getStageStorageKey(videoId));
      if (storedKey && stages.some((stage) => stage?.key === storedKey)) {
        return storedKey;
      }
    } catch {
      // Storage unavailable or blocked; fall back safely
    }
  }
  return getInitialStageKey(stages);
}

export function rememberStageKey(
  videoId,
  stageKey,
  storage = (typeof window !== 'undefined' ? window.localStorage : null)
) {
  if (!videoId || !stageKey || !storage) return;
  try {
    storage.setItem(getStageStorageKey(videoId), stageKey);
  } catch {
    // Quota exceeded or storage disabled; fail silently
  }
}

export function clearRememberedStageKey(
  videoId,
  storage = (typeof window !== 'undefined' ? window.localStorage : null)
) {
  if (!videoId || !storage) return;
  try {
    storage.removeItem(getStageStorageKey(videoId));
  } catch {
    // Storage access error; ignore
  }
}
