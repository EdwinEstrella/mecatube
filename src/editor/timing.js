// Pure: builds speech phrases from word timestamps and slices timeline clips. No DOM, no React.
// Input: words from voice_meta.json [{ w, s, e }]. Exports phrase building and clip distribution.

const SENTENCE_PUNCTUATION = /[.!?…;:]["”»)\]]*$/;

function round3(num) {
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
}

function isValidWord(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.w === 'string' &&
    item.w.trim().length > 0 &&
    typeof item.s === 'number' &&
    Number.isFinite(item.s) &&
    typeof item.e === 'number' &&
    Number.isFinite(item.e) &&
    item.e >= item.s
  );
}

function isValidCount(count) {
  return typeof count === 'number' && Number.isInteger(count) && count > 0;
}

function isValidDuration(duration) {
  return typeof duration === 'number' && Number.isFinite(duration) && duration > 0;
}

export function buildPhrases(words, { maxGap = 0.6, maxDuration = 6 } = {}) {
  if (!Array.isArray(words)) return [];

  const validWords = words.filter(isValidWord);
  if (validWords.length === 0) return [];

  const phrases = [];
  let current = [];

  const flush = () => {
    if (current.length === 0) return;
    phrases.push({
      index: phrases.length,
      text: current.map((item) => item.w.trim()).join(' '),
      start: round3(current[0].s),
      end: round3(current[current.length - 1].e),
      wordCount: current.length,
    });
    current = [];
  };

  for (const word of validWords) {
    if (current.length > 0) {
      const prevWord = current[current.length - 1];
      const isGap = word.s - prevWord.e > maxGap;
      const isTooLong = word.e - current[0].s > maxDuration;

      if (isGap || isTooLong) {
        flush();
      }
    }

    current.push(word);

    if (SENTENCE_PUNCTUATION.test(word.w.trim())) {
      flush();
    }
  }

  flush();
  return phrases;
}

export function distributeEvenly(count, duration) {
  if (!isValidCount(count) || !isValidDuration(duration)) return [];

  const totalDuration = round3(duration);
  const slices = [];
  let prevEnd = 0;

  for (let i = 1; i <= count; i += 1) {
    const end = i === count ? totalDuration : round3((i * duration) / count);
    slices.push({
      number: i,
      start: prevEnd,
      end,
    });
    prevEnd = end;
  }

  return slices;
}

export function assignByPhrases(phrases, count, duration) {
  if (!isValidCount(count) || !isValidDuration(duration)) return [];

  if (!Array.isArray(phrases) || phrases.length < count || phrases.length === 0) {
    return distributeEvenly(count, duration).map((slice) => ({
      ...slice,
      phraseIndexes: [],
    }));
  }

  const cuts = [];
  let prevK = 0;

  for (let i = 1; i < count; i += 1) {
    const idealCut = (i * duration) / count;
    const minK = prevK + 1;
    const maxK = phrases.length - (count - i);

    let bestK = minK;
    let bestDiff = Math.abs(phrases[minK].start - idealCut);

    for (let k = minK + 1; k <= maxK; k += 1) {
      const diff = Math.abs(phrases[k].start - idealCut);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestK = k;
      }
    }

    cuts.push(bestK);
    prevK = bestK;
  }

  const boundaries = [0, ...cuts, phrases.length];
  const totalDuration = round3(duration);
  const clips = [];

  for (let i = 0; i < count; i += 1) {
    const fromIdx = boundaries[i];
    const toIdx = boundaries[i + 1];
    const groupPhrases = phrases.slice(fromIdx, toIdx);

    const start = i === 0 ? 0 : round3(phrases[fromIdx].start);
    const end = i === count - 1 ? totalDuration : round3(phrases[toIdx].start);

    const phraseIndexes = groupPhrases.map((p, idx) =>
      typeof p.index === 'number' ? p.index : fromIdx + idx
    );

    clips.push({
      number: i + 1,
      start,
      end,
      phraseIndexes,
    });
  }

  return clips;
}
