export const ORIENTATION_LABELS = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
};

export const ORIENTATION_DESCRIPTIONS = {
  horizontal: 'Horizontal 16:9 · YouTube',
  vertical: 'Vertical 9:16 · Shorts, TikTok, Reels',
};

export const VIDEO_TYPE_LABELS = {
  explainer: 'Explicativo',
  story: 'Historia',
  list: 'Top / lista',
  horror: 'Terror / misterio',
};

export const VIDEO_TYPE_HINTS = {
  explainer: 'Estructura estándar de guion e ilustración técnica',
  story: 'Narrativa con múltiples personajes y escenas dramáticas',
  list: 'Conteos y tops dinámicos sin personajes fijos',
  horror: 'Relatos con narrador inmersivo y ambientación oscura',
};

export const MODE_LABELS = {
  free: 'Libre',
  series: 'Serie',
  titles: 'Títulos',
};

export const MODE_HINTS = {
  free: 'Crea videos con total libertad',
  series: 'Lo configuras después en la rama',
  titles: 'Lo configuras después en la rama',
};

export function getOrientationLabel(orientation) {
  return ORIENTATION_LABELS[orientation] ?? 'Horizontal';
}

export function getVideoTypeLabel(videoType) {
  return VIDEO_TYPE_LABELS[videoType] ?? 'Explicativo';
}

export function getModeLabel(mode) {
  return MODE_LABELS[mode] ?? 'Libre';
}

/**
 * Groups a list of videos by branchId.
 *
 * @param {Array<Object>} branches
 * @param {Array<Object>} videos
 * @returns {Array<{ branch: Object, videos: Array<Object> }>}
 */
export function groupVideosByBranch(branches = [], videos = []) {
  const safeBranches = Array.isArray(branches) ? branches : [];
  const safeVideos = Array.isArray(videos) ? videos : [];

  const videoMap = new Map();
  for (const branch of safeBranches) {
    videoMap.set(branch.id, []);
  }

  const orphaned = [];
  for (const video of safeVideos) {
    if (video.branchId && videoMap.has(video.branchId)) {
      videoMap.get(video.branchId).push(video);
    } else {
      orphaned.push(video);
    }
  }

  const groups = safeBranches.map((branch) => ({
    branch,
    videos: videoMap.get(branch.id) || [],
  }));

  if (orphaned.length > 0 && groups.length > 0) {
    // Attach orphans to the first branch as a fallback safeguard
    groups[0].videos.push(...orphaned);
  }

  return groups;
}
