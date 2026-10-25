// Pure: one-line summary of a Cartesia voice for the picker rows
export function voiceDetail(voice) {
  const parts = [];
  if (voice.tagline) parts.push(voice.tagline);
  const created = voice.createdAt ? new Date(voice.createdAt) : null;
  if (created && !Number.isNaN(created.getTime())) {
    parts.push(`creada el ${created.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}`);
  }
  return parts.join(' · ');
}

// True when the id appears in either list, so the picker knows whether to show "Current: <id>"
export function isKnownVoice(id, owned, saved) {
  return owned.some((voice) => voice.id === id) || saved.some((voice) => voice.id === id);
}
