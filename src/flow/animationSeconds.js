// Pure helper to estimate the requested Flow animation duration in seconds from its anchor script text.
// Flow only supports 4, 6, 8, or 10 seconds.

export const ALLOWED_ANIMATION_SECONDS = [4, 6, 8, 10];
export const DEFAULT_ANIMATION_SECONDS = 8;
const WORDS_PER_SECOND = 2.5;
const SAFETY_MARGIN = 1.3;

export function countAnchorWords(text) {
  if (typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const tokens = trimmed.split(/\s+/);
  let count = 0;
  for (const token of tokens) {
    if (/[\p{L}\p{N}]/u.test(token)) {
      count += 1;
    }
  }
  return count;
}

export function animationSeconds(anchorText) {
  const words = countAnchorWords(anchorText);
  if (words === 0) return DEFAULT_ANIMATION_SECONDS;
  const estimate = (words / WORDS_PER_SECOND) * SAFETY_MARGIN;
  const matched = ALLOWED_ANIMATION_SECONDS.find((seconds) => seconds >= estimate);
  return matched ?? 10;
}
