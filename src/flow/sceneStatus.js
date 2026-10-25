// Pure helpers over the stored scene records ({ number, generations: [{ files }] }) and the live
// scene-status events ({ state: queued | running | done | error | cancelled, percent, captcha, error })

export function sceneImageUrl(videoId, number, file) {
  return `mecatube-media://scene/${encodeURIComponent(videoId)}/${encodeURIComponent(number)}/${encodeURIComponent(file)}`;
}

// Files of the most recent generation of a scene (the pair Flow returned last), or []
export function latestFiles(record) {
  const generations = record?.generations ?? [];
  return generations.length > 0 ? generations[generations.length - 1].files : [];
}

export const isActive = (status) => status?.state === 'queued' || status?.state === 'running';

// Label of a scene: { tone: 'idle' | 'active' | 'done' | 'error' | 'warn', text }
export function sceneStatusLabel(status, record) {
  if (status?.state === 'queued') return { tone: 'active', text: 'En cola' };
  if (status?.state === 'running') {
    if (status.captcha) return { tone: 'warn', text: 'Flow pide verificación' };
    const percent = Number.isFinite(status.percent) ? ` ${status.percent} %` : '';
    return { tone: 'active', text: `Generando…${percent}` };
  }
  if (status?.state === 'error') return { tone: 'error', text: 'Error' };
  if (latestFiles(record).length > 0) return { tone: 'done', text: 'Lista' };
  return { tone: 'idle', text: '' };
}

// Scenes "Generar todas" queues: not queued or running, and without images or whose last run failed
export function pendingScenes(scenes, statuses, records) {
  return scenes.filter((scene) => {
    const status = statuses[scene.number];
    if (isActive(status)) return false;
    return latestFiles(records[scene.number]).length === 0 || status?.state === 'error';
  });
}
