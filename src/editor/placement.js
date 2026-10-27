// Pure: places video clips on the timeline and applies transitions/motions. No DOM, no React.
// Clips are positioned by (1) script anchors, (2) AI phrase alignment, (3) interpolation.
// Timings are strictly fixed before styling; the AI director only selects transitions and motions.

import { alignAnchors, buildAlignedClips, fillMissing, round3 } from './align.js';
import { extractJsonCandidate, MOTIONS, normalizeEdl, TRANSITIONS } from './edl.js';

function isValidWord(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.s === 'number' &&
    Number.isFinite(item.s)
  );
}

// Map a phrase index to the word index of its first word by matching start timestamps.
// Word index of each phrase's first word (matched by start time), null when no word starts there
export function phrasesToWordIndex(phrases, words) {
  const phraseList = Array.isArray(phrases) ? phrases : [];
  const wordList = Array.isArray(words) ? words : [];

  return phraseList.map((p) => {
    if (!p || typeof p.start !== 'number' || !Number.isFinite(p.start)) return null;
    const pStart = round3(p.start);
    let matchedWordIdx = -1;
    let minDiff = Infinity;
    for (let w = 0; w < wordList.length; w += 1) {
      const item = wordList[w];
      if (!isValidWord(item)) continue;
      const diff = Math.abs(round3(item.s) - pStart);
      if (diff < minDiff) {
        minDiff = diff;
        matchedWordIdx = w;
        if (diff < 0.001) break;
      }
    }
    return matchedWordIdx !== -1 && minDiff <= 0.05 ? matchedWordIdx : null;
  });
}

// Places available animations along narration words.
// Anchors -> AI assignments -> missing interpolation -> aligned clips.
export function placeVideos({ words = [], duration = 0, available = [], anchors = [], aiAssignments = [] } = {}) {
  const roundedDuration = round3(duration);
  const sortedAvailable = [...available]
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);

  if (
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    roundedDuration <= 0 ||
    sortedAvailable.length === 0
  ) {
    return {
      clips: [],
      stats: { anchor: 0, ai: 0, estimated: 0, total: sortedAvailable.length },
      warnings: ['Invalid duration or available animations.'],
    };
  }

  // a) alignAnchors restricted to available animation numbers
  const anchorMap = new Map();
  if (Array.isArray(anchors)) {
    for (const a of anchors) {
      if (a && Number.isInteger(a.number)) {
        anchorMap.set(a.number, typeof a.text === 'string' ? a.text : '');
      }
    }
  }

  const restrictedAnchors = sortedAvailable.map((num) => ({
    number: num,
    text: anchorMap.get(num) ?? '',
  }));

  const items = alignAnchors(restrictedAnchors, words);

  // b) Apply valid AI assignments for items still 'missing'
  if (Array.isArray(aiAssignments) && aiAssignments.length > 0) {
    const validAssignments = aiAssignments
      .filter((a) => a && Number.isInteger(a.number) && Number.isInteger(a.wordIndex))
      .sort((a, b) => a.number - b.number);

    for (const assign of validAssignments) {
      const idx = items.findIndex((it) => it.number === assign.number);
      if (idx === -1 || items[idx].source !== 'missing') continue;

      const wIdx = assign.wordIndex;
      if (wIdx < 0 || wIdx >= words.length || !isValidWord(words[wIdx])) {
        continue;
      }

      // Check strictly increasing relative to known neighbours in number order
      let valid = true;

      // Nearest preceding known neighbour
      for (let prev = idx - 1; prev >= 0; prev -= 1) {
        if (typeof items[prev].wordIndex === 'number' && Number.isInteger(items[prev].wordIndex)) {
          if (wIdx <= items[prev].wordIndex) {
            valid = false;
          }
          break;
        }
      }

      if (!valid) continue;

      // Nearest succeeding known neighbour
      for (let next = idx + 1; next < items.length; next += 1) {
        if (typeof items[next].wordIndex === 'number' && Number.isInteger(items[next].wordIndex)) {
          if (wIdx >= items[next].wordIndex) {
            valid = false;
          }
          break;
        }
      }

      if (!valid) continue;

      items[idx].wordIndex = wIdx;
      items[idx].start = round3(words[wIdx].s);
      items[idx].source = 'ai';
    }
  }

  // c) fillMissing for remaining items ('estimated')
  const filledItems = fillMissing(items, words, roundedDuration);

  // Stats reflect placement distribution across items
  const stats = {
    anchor: filledItems.filter((it) => it.source === 'anchor').length,
    ai: filledItems.filter((it) => it.source === 'ai').length,
    estimated: filledItems.filter((it) => it.source === 'estimated').length,
    total: filledItems.length,
  };

  const { clips, warnings } = buildAlignedClips(filledItems, roundedDuration);

  return { clips, stats, warnings };
}

// Pure default styling for the non-AI path.
export function defaultStyling(fixedClips, { duration } = {}) {
  if (!Array.isArray(fixedClips) || fixedClips.length === 0) {
    return null;
  }
  const totalDuration = duration ?? (fixedClips.length > 0 ? fixedClips[fixedClips.length - 1].end : 0);
  const clips = fixedClips.map((c, i) => ({
    number: c.number,
    start: round3(c.start),
    end: round3(c.end),
    transition: i === 0 ? 'fade' : 'cut',
    motion: i % 2 === 0 ? 'zoom-in' : 'zoom-out',
  }));

  return {
    version: 1,
    duration: round3(totalDuration),
    clips,
    subtitles: [],
  };
}

// Applies transitions and motions from AI to pre-computed fixed clips.
// AI start/end timings are completely ignored; only styling is adopted.
export function applyStyling(fixedClips, raw, { duration } = {}) {
  if (!Array.isArray(fixedClips) || fixedClips.length === 0) {
    return { edl: null, warnings: ['Missing or empty fixed clips.'] };
  }

  const totalDuration =
    typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? duration
      : fixedClips[fixedClips.length - 1]?.end ?? 0;

  let parsed = null;
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    parsed = raw;
  } else if (typeof raw === 'string') {
    const jsonStr = extractJsonCandidate(raw);
    if (jsonStr) {
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = null;
      }
    }
  }

  const aiClips = Array.isArray(parsed?.clips) ? parsed.clips : [];

  // Determine drop candidates: only clips with segment duration < 2.0s and keep: false may be dropped
  const dropCandidates = [];
  for (let i = 0; i < fixedClips.length; i += 1) {
    const fixed = fixedClips[i];
    const segDuration = round3(fixed.end - fixed.start);
    let aiClip = aiClips[i];
    if (!aiClip || aiClip.number !== fixed.number) {
      aiClip = aiClips.find((c) => c && c.number === fixed.number);
    }
    if (aiClip && aiClip.keep === false && segDuration < 2.0) {
      dropCandidates.push(i);
    }
  }

  // If all clips were marked dropped, keep all to ensure a valid non-empty timeline
  const actuallyDropIndices =
    dropCandidates.length < fixedClips.length ? new Set(dropCandidates) : new Set();

  const keptClips = [];
  const dropped = [];
  let pendingStart = null;

  for (let i = 0; i < fixedClips.length; i += 1) {
    const fixed = fixedClips[i];
    let aiClip = aiClips[i];
    if (!aiClip || aiClip.number !== fixed.number) {
      aiClip = aiClips.find((c) => c && c.number === fixed.number);
    }

    if (actuallyDropIndices.has(i)) {
      const reason = typeof aiClip?.reason === 'string' ? aiClip.reason.trim().slice(0, 140) : '';
      dropped.push({ number: fixed.number, reason });

      if (keptClips.length > 0) {
        keptClips[keptClips.length - 1].end = round3(fixed.end);
      } else if (pendingStart === null) {
        pendingStart = fixed.start;
      }
    } else {
      let start = fixed.start;
      if (pendingStart !== null) {
        start = pendingStart;
        pendingStart = null;
      }

      const transition =
        aiClip && TRANSITIONS.includes(aiClip.transition)
          ? aiClip.transition
          : keptClips.length === 0
            ? 'fade'
            : 'cut';

      const motion =
        aiClip && MOTIONS.includes(aiClip.motion)
          ? aiClip.motion
          : keptClips.length % 2 === 0
            ? 'zoom-in'
            : 'zoom-out';

      const reason =
        typeof aiClip?.reason === 'string' && aiClip.reason.trim()
          ? aiClip.reason.trim().slice(0, 140)
          : undefined;

      keptClips.push({
        number: fixed.number,
        start: round3(start),
        end: round3(fixed.end),
        transition,
        motion,
        ...(reason !== undefined ? { reason } : {}),
      });
    }
  }

  const edlCandidate = {
    version: 1,
    duration: round3(totalDuration),
    clips: keptClips,
    subtitles: [],
    dropped,
  };

  const available = fixedClips.map((c) => c.number);
  return normalizeEdl(edlCandidate, {
    duration: totalDuration,
    available,
    phrases: [],
  });
}
