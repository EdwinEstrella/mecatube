// Pure composition pipeline for system prompts.
// Chains: applyStyle (prompt-2 only) -> applyOrientation -> applyVideoType (placeholder for T10)

import { applyStyle } from './styles.js';
import { applyOrientation } from './orientation.js';

function applyVideoType(text /*, videoType, opts */) {
  // Placeholder hook for T10: video type prompt adaptation
  return text;
}

export function composePrompt(
  text,
  { presetId, style, orientation = 'horizontal', videoType = 'explainer' } = {}
) {
  if (typeof text !== 'string') return '';

  let result = text;

  // 1. Visual style (only applies to prompt-2 illustrator prompt)
  if (presetId === 'prompt-2') {
    result = applyStyle(result, style);
  }

  // 2. Aspect ratio / orientation adaptation (horizontal vs vertical)
  result = applyOrientation(result, orientation);

  // 3. Video type adaptation (placeholder hook for T10)
  result = applyVideoType(result, videoType, { presetId, style, orientation });

  return result;
}
