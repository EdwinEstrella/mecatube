// Pure: aligns script anchor snippets to speech timestamps and builds video clips. No DOM, no React.
// Matches LLM-selected anchor words to voice_meta word timestamps with sequential and Levenshtein tolerance.

export function round3(num) {
  if (typeof num !== 'number' || !Number.isFinite(num)) return 0;
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

export function normalizeToken(text) {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function tokenize(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((tok) => tok.length > 0);
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b ? b.length : 0;
  if (!b) return a ? a.length : 0;

  const aLen = a.length;
  const bLen = b.length;
  let prev = new Array(bLen + 1);
  let curr = new Array(bLen + 1);

  for (let j = 0; j <= bLen; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= aLen; i += 1) {
    curr[0] = i;
    const aCode = a.charCodeAt(i - 1);
    for (let j = 1; j <= bLen; j += 1) {
      const cost = aCode === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[bLen];
}

export function tokensMatch(tok1, tok2) {
  if (!tok1 || !tok2) return false;
  if (tok1 === tok2) return true;
  if (tok1.length >= 4 && tok2.length >= 4) {
    if (tok1.startsWith(tok2) || tok2.startsWith(tok1)) {
      return true;
    }
  }
  if (tok1.length >= 5 && tok2.length >= 5) {
    if (levenshtein(tok1, tok2) <= 1) {
      return true;
    }
  }
  return false;
}

function countGreedyMatches(anchorTokens, windowWords, startAnchorIdx) {
  let matched = 1;
  let wIdx = 1;

  for (let aIdx = startAnchorIdx + 1; aIdx < anchorTokens.length; aIdx += 1) {
    const aTok = anchorTokens[aIdx];
    for (let j = wIdx; j < windowWords.length; j += 1) {
      if (tokensMatch(aTok, windowWords[j])) {
        matched += 1;
        wIdx = j + 1;
        break;
      }
    }
  }

  return matched;
}

export function alignAnchors(anchors, words, { minScore = 0.6 } = {}) {
  if (!Array.isArray(anchors)) return [];

  const sortedAnchors = [...anchors].sort((a, b) => a.number - b.number);

  const wordList = [];
  if (Array.isArray(words)) {
    for (let i = 0; i < words.length; i += 1) {
      const item = words[i];
      if (isValidWord(item)) {
        const tok = normalizeToken(item.w);
        if (tok.length > 0) {
          wordList.push({
            index: i,
            token: tok,
            word: item,
          });
        }
      }
    }
  }

  const results = [];
  let prevMatchedWordIndex = -1;

  for (let k = 0; k < sortedAnchors.length; k += 1) {
    const anchor = sortedAnchors[k];
    const anchorTokens = tokenize(anchor.text);

    if (anchorTokens.length === 0) {
      results.push({
        number: anchor.number,
        wordIndex: null,
        start: null,
        score: 0,
        source: 'missing',
      });
      continue;
    }

    const remainingAnchors = sortedAnchors.length - 1 - k;
    let bestScore = -1;
    let bestP = -1;
    let bestStart = null;
    const candidates = [];

    for (let candIdx = 0; candIdx < wordList.length; candIdx += 1) {
      const cand = wordList[candIdx];
      const p = cand.index;

      if (p <= prevMatchedWordIndex) continue;

      const remainingWords = wordList.length - 1 - candIdx;
      if (remainingWords < remainingAnchors) break;

      const windowWords = wordList
        .slice(candIdx, candIdx + anchorTokens.length + 3)
        .map((w) => w.token);

      let maxMatched = 0;
      if (tokensMatch(windowWords[0], anchorTokens[0])) {
        const m = countGreedyMatches(anchorTokens, windowWords, 0);
        if (m > maxMatched) maxMatched = m;
      }
      if (anchorTokens.length > 1 && tokensMatch(windowWords[0], anchorTokens[1])) {
        const m = countGreedyMatches(anchorTokens, windowWords, 1);
        if (m > maxMatched) maxMatched = m;
      }

      if (maxMatched === 0) continue;

      const score = maxMatched / anchorTokens.length;

      candidates.push({ p, score });
      if (score > bestScore) bestScore = score;
    }

    // Prefer the earliest good match: a near-perfect match far ahead (a repeated phrase) must not
    // skip over the script moments of the anchors in between
    // (then refine within the anchor's length, since a match may also start on its second word)
    const first = candidates.find((c) => c.score >= minScore && c.score >= bestScore - 0.2);
    const chosen = first
      ? candidates
          .filter((c) => c.p >= first.p && c.p <= first.p + anchorTokens.length)
          .reduce((best, c) => (c.score > best.score ? c : best), first)
      : null;
    if (chosen) {
      bestP = chosen.p;
      bestStart = round3(words[chosen.p].s);
      bestScore = chosen.score;
    }

    if (bestScore >= minScore) {
      results.push({
        number: anchor.number,
        wordIndex: bestP,
        start: bestStart,
        score: round3(bestScore),
        source: 'anchor',
      });
      prevMatchedWordIndex = bestP;
    } else {
      results.push({
        number: anchor.number,
        wordIndex: null,
        start: null,
        score: bestScore > 0 ? round3(bestScore) : 0,
        source: 'missing',
      });
    }
  }

  return results;
}

export function fillMissing(alignment, words, duration) {
  if (!Array.isArray(alignment) || alignment.length === 0) return [];

  const items = alignment.map((item) => ({ ...item }));
  const totalDuration = round3(duration);

  const validIndices = [];
  if (Array.isArray(words)) {
    for (let i = 0; i < words.length; i += 1) {
      if (isValidWord(words[i])) {
        validIndices.push(i);
      }
    }
  }

  if (validIndices.length === 0) {
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].source === 'missing') {
        items[i].wordIndex = null;
        items[i].start = round3((i * totalDuration) / items.length);
        items[i].source = 'estimated';
      }
    }
    return items;
  }

  function getPos(wIdx) {
    const direct = validIndices.indexOf(wIdx);
    if (direct !== -1) return direct;
    let bestDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < validIndices.length; i += 1) {
      const dist = Math.abs(validIndices[i] - wIdx);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  const knownIndices = [];
  for (let i = 0; i < items.length; i += 1) {
    if (
      items[i].source !== 'missing' &&
      typeof items[i].wordIndex === 'number' &&
      Number.isInteger(items[i].wordIndex)
    ) {
      knownIndices.push(i);
    }
  }

  if (knownIndices.length === 0) {
    let prevPos = -1;
    for (let i = 0; i < items.length; i += 1) {
      let idealPos = Math.round((i * validIndices.length) / items.length);
      if (idealPos <= prevPos) idealPos = prevPos + 1;
      idealPos = Math.min(validIndices.length - 1, idealPos);
      prevPos = idealPos;

      const wIdx = validIndices[idealPos];
      items[i].wordIndex = wIdx;
      items[i].start = round3(words[wIdx].s);
      items[i].source = 'estimated';
    }
    return items;
  }

  // 1. Leading missing items before first known
  const firstKnownIdx = knownIndices[0];
  if (firstKnownIdx > 0) {
    const qPos = getPos(items[firstKnownIdx].wordIndex);
    const mCount = firstKnownIdx;
    let prevPos = -1;

    for (let j = 0; j < mCount; j += 1) {
      let idealPos = Math.round((j * qPos) / mCount);
      if (idealPos <= prevPos) idealPos = prevPos + 1;
      if (idealPos >= qPos) idealPos = Math.max(0, qPos - 1);
      prevPos = idealPos;

      const wIdx = validIndices[idealPos];
      items[j].wordIndex = wIdx;
      items[j].start = round3(words[wIdx].s);
      items[j].source = 'estimated';
    }
  }

  // 2. Middle missing items between known pairs
  for (let k = 0; k < knownIndices.length - 1; k += 1) {
    const startIdx = knownIndices[k] + 1;
    const endIdx = knownIndices[k + 1] - 1;
    if (startIdx <= endIdx) {
      const pPos = getPos(items[knownIndices[k]].wordIndex);
      const qPos = getPos(items[knownIndices[k + 1]].wordIndex);
      const mCount = endIdx - startIdx + 1;
      let prevPos = pPos;

      for (let j = 0; j < mCount; j += 1) {
        const itemIdx = startIdx + j;
        let idealPos = Math.round(pPos + ((j + 1) * (qPos - pPos)) / (mCount + 1));
        if (idealPos <= prevPos) idealPos = prevPos + 1;
        if (idealPos >= qPos) idealPos = Math.max(pPos + 1, qPos - 1);
        prevPos = idealPos;

        const wIdx = validIndices[Math.min(validIndices.length - 1, idealPos)];
        items[itemIdx].wordIndex = wIdx;
        items[itemIdx].start = round3(words[wIdx].s);
        items[itemIdx].source = 'estimated';
      }
    }
  }

  // 3. Trailing missing items after last known
  const lastKnownIdx = knownIndices[knownIndices.length - 1];
  const trailingStartIdx = lastKnownIdx + 1;
  const trailingEndIdx = items.length - 1;
  if (trailingStartIdx <= trailingEndIdx) {
    const pPos = getPos(items[lastKnownIdx].wordIndex);
    const lastPos = validIndices.length - 1;
    const mCount = trailingEndIdx - trailingStartIdx + 1;
    let prevPos = pPos;

    for (let j = 0; j < mCount; j += 1) {
      const itemIdx = trailingStartIdx + j;
      let idealPos = Math.round(pPos + ((j + 1) * (lastPos - pPos)) / (mCount + 1));
      if (idealPos <= prevPos) idealPos = prevPos + 1;
      idealPos = Math.min(lastPos, idealPos);
      prevPos = idealPos;

      const wIdx = validIndices[idealPos];
      items[itemIdx].wordIndex = wIdx;
      items[itemIdx].start = round3(words[wIdx].s);
      items[itemIdx].source = 'estimated';
    }
  }

  return items;
}

// Never drops clips: crowded starts are shifted so each clip lasts at least minSpan
// (or duration / count when the timeline is too short for that).
export function buildAlignedClips(alignment, duration, { minSpan = 1.5 } = {}) {
  const warnings = [];
  const roundedDuration = round3(duration);

  if (typeof duration !== 'number' || !Number.isFinite(duration) || roundedDuration <= 0) {
    warnings.push('Invalid or missing duration.');
    return { clips: [], warnings };
  }

  if (!Array.isArray(alignment) || alignment.length === 0) {
    return { clips: [], warnings };
  }

  const current = alignment
    .filter(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.number === 'number' &&
        typeof item.start === 'number' &&
        Number.isFinite(item.start)
    )
    .map((item) => ({
      number: item.number,
      start: round3(item.start),
      source: item.source || 'anchor',
    }));

  if (current.length === 0) {
    return { clips: [], warnings };
  }

  current.sort((a, b) => a.start - b.start || a.number - b.number);
  current[0].start = 0;

  const n = current.length;
  const D = roundedDuration;
  const m = Math.min(minSpan, D / n);

  const s = new Array(n + 1);
  for (let i = 0; i < n; i += 1) {
    s[i] = current[i].start;
  }
  s[0] = 0;
  s[n] = D;

  const origStarts = [...s];

  // Forward pass: s[i] = max(s[i], s[i-1] + m)
  for (let i = 1; i < n; i += 1) {
    s[i] = Math.max(s[i], s[i - 1] + m);
  }

  // Backward pass with s[n] = D: s[i] = min(s[i], s[i+1] - m) for i from n-1 down to 1
  for (let i = n - 1; i >= 1; i -= 1) {
    s[i] = Math.min(s[i], s[i + 1] - m);
  }
  s[0] = 0;

  // Round with round3
  for (let i = 0; i < n; i += 1) {
    s[i] = round3(s[i]);
  }
  s[n] = D;

  const mFormatted = round3(m);
  for (let i = 1; i < n; i += 1) {
    if (s[i] !== origStarts[i]) {
      warnings.push(
        `Shifted clip ${current[i].number} start from ${origStarts[i]} to ${s[i]} to keep it at least ${mFormatted}s.`
      );
    }
  }

  const clips = [];
  for (let i = 0; i < n; i += 1) {
    clips.push({
      number: current[i].number,
      start: s[i],
      end: s[i + 1],
      source: current[i].source,
    });
  }

  return { clips, warnings };
}
