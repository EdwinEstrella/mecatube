// Pure composition pipeline for system prompts.
// Chains: applyStyle (prompt-2 only) -> applyOrientation -> applyVideoType

import { applyStyle } from './styles.js';
import { applyOrientation } from './orientation.js';
import { applyVideoType } from './videoTypes.js';

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

  // 3. Video type adaptation
  result = applyVideoType(result, presetId, videoType);

  return result;
}
