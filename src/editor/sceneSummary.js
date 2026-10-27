// Pure: summarizes illustrator image prompts for AI director alignment. No DOM, no React.
// Strips shared style boilerplate and recurring character sheets, preserving scene-specific details and explainer titles.

const STYLE_HEURISTICS = [
  'character sheet',
  'stickman man of about',
  'linework',
  '1920x1080',
];

function splitSentences(text) {
  if (typeof text !== 'string') return [];
  // Split on sentence punctuation (. ! ?) followed by optional quotes/brackets and whitespace, or on newlines
  const raw = text.split(/(?<=[.!?]["'”»\)]*)\s+|\n+/);
  return raw
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => s.length > 0);
}

function isStyleBoilerplate(sentenceLower) {
  return STYLE_HEURISTICS.some((h) => sentenceLower.includes(h));
}

function isProtectedExplainer(sentenceLower) {
  return sentenceLower.includes('reads exactly') || sentenceLower.includes('layout:');
}

/**
 * Summarizes scenes by stripping shared boilerplate across prompts and style descriptions.
 *
 * @param {Array<{ number: number, title?: string, prompt?: string }>} scenes
 * @returns {Array<{ number: number, title: string, summary: string }>}
 */
export function sceneSummaries(scenes) {
  if (!Array.isArray(scenes)) return [];

  // 1. Split each prompt into normalized sentences and collect unique sentences per prompt
  const sceneSentences = scenes.map((scene) => {
    const prompt = typeof scene?.prompt === 'string' ? scene.prompt : '';
    const sentences = splitSentences(prompt);
    const uniqueSet = new Set(sentences);
    return {
      scene,
      sentences,
      uniqueSet,
    };
  });

  const totalPrompts = scenes.length;

  // 2. Count prompt frequency for each sentence
  const sentencePromptCount = new Map();
  for (const { uniqueSet } of sceneSentences) {
    for (const sentence of uniqueSet) {
      sentencePromptCount.set(sentence, (sentencePromptCount.get(sentence) ?? 0) + 1);
    }
  }

  // 3. Filter sentences per scene
  return sceneSentences.map(({ scene, sentences }, index) => {
    const num = scene?.number ?? index + 1;
    const title = scene?.title || `Escena ${num}`;

    const kept = [];
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();

      // Explainer images: always keep 'reads exactly' and 'Layout:' sentences
      if (isProtectedExplainer(lower)) {
        kept.push(sentence);
        continue;
      }

      // Drop shared boilerplate (appears in >= 50% of prompts, requiring at least 2 prompts)
      const count = sentencePromptCount.get(sentence) ?? 0;
      const isShared = totalPrompts >= 2 && count >= 2 && count / totalPrompts >= 0.5;
      if (isShared) {
        continue;
      }

      // Drop style/character sheet descriptions
      if (isStyleBoilerplate(lower)) {
        continue;
      }

      kept.push(sentence);
    }

    const combined = kept.join(' ');
    const collapsed = combined.trim().replace(/\s+/g, ' ');
    const summary = collapsed.slice(0, 600);

    return {
      number: num,
      title,
      summary,
    };
  });
}
