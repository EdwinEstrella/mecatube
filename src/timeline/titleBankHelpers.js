// Pure helper functions for Title Bank: parsing pasted titles, status mapping, and reordering.
import { isPublished } from './stages.js';

const TITLE_MAX = 200;
const TITLES_LIMIT = 500;

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `title-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parses raw multiline text from a textarea into title objects.
 * Trims, dedupes, ignores empty lines, caps at 500 total titles, each <= 200 chars.
 */
export function parseTitlesInput(text, existingTitles = []) {
  if (typeof text !== 'string') return [];

  const seen = new Set(
    (Array.isArray(existingTitles) ? existingTitles : [])
      .map((t) => (t && typeof t.text === 'string' ? t.text.trim().toLowerCase() : ''))
      .filter(Boolean)
  );

  const lines = text.split(/\r?\n/);
  const newTitles = [];
  const maxAllowed = Math.max(0, TITLES_LIMIT - (Array.isArray(existingTitles) ? existingTitles.length : 0));

  for (const rawLine of lines) {
    if (newTitles.length >= maxAllowed) break;
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const truncated = trimmed.slice(0, TITLE_MAX);
    const normalized = truncated.toLowerCase();

    if (seen.has(normalized)) continue;
    seen.add(normalized);

    newTitles.push({
      id: createId(),
      text: truncated,
      videoId: null,
    });
  }

  return newTitles;
}

/**
 * Maps the status of a title item given its linked video and derived stages.
 * Returns: { status: 'none' | 'in-progress' | 'published', label: string }
 */
export function mapTitleStatus(title, video, stages = []) {
  if (!title?.videoId || !video) {
    return { status: 'none', label: 'Sin video' };
  }

  if (isPublished(stages)) {
    return { status: 'published', label: 'Publicado' };
  }

  return { status: 'in-progress', label: 'En progreso' };
}

/**
 * Pure reorder of titles moving item from `fromIndex` to `toIndex`.
 */
export function reorderTitles(titles, fromIndex, toIndex) {
  if (!Array.isArray(titles)) return [];
  if (fromIndex < 0 || fromIndex >= titles.length) return [...titles];
  if (toIndex < 0 || toIndex >= titles.length) return [...titles];
  if (fromIndex === toIndex) return [...titles];

  const result = [...titles];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}
