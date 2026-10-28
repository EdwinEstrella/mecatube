import { allFiles, latestFiles } from '../flow/sceneStatus.js';
import { latestVideo } from '../flow/animationStatus.js';

export function isSceneImageComplete(scene, records) {
  if (!scene || !records) return false;
  const number = typeof scene === 'number' ? scene : scene?.number;
  if (number == null) return false;
  const record = records[number];
  if (!record?.selectedFile) return false;
  return latestFiles(record).includes(record.selectedFile);
}

export function isAnimationItemComplete(item, records) {
  if (!item || !records) return false;
  const number = typeof item === 'number' ? item : item?.number;
  if (number == null) return false;
  const record = records[number];
  if (!record) return false;
  if (record.selectedFile) {
    if (latestFiles(record).includes(record.selectedFile) || allFiles(record).includes(record.selectedFile)) {
      return true;
    }
  }
  return Boolean(latestVideo(record));
}

export function isImageBlockComplete(scenes, records) {
  if (!Array.isArray(scenes) || scenes.length === 0) return false;
  return scenes.every((scene) => isSceneImageComplete(scene, records));
}

export function isAnimationBlockComplete(animations, records) {
  if (!Array.isArray(animations) || animations.length === 0) return false;
  return animations.every((item) => isAnimationItemComplete(item, records));
}

export function isBlockComplete(kind, scenes, records) {
  if (kind === 'animations') {
    return isAnimationBlockComplete(scenes, records);
  }
  return isImageBlockComplete(scenes, records);
}

export function blockCollapsedLabel(block, scenes) {
  const total = Array.isArray(scenes) ? scenes.length : (typeof scenes === 'number' ? scenes : 0);
  const countText = `${total}/${total} listas ✓`;
  if (block?.index != null && block?.total != null) {
    return `Bloque ${block.index} de ${block.total} · ${countText}`;
  }
  if (block?.index != null) {
    return `Bloque ${block.index} · ${countText}`;
  }
  return countText;
}
