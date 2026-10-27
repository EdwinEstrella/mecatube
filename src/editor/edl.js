// Pure: normalizes AI director EDL and generates deterministic fallbacks. No DOM, no React.
// EDL version 1 with contiguous clips, valid transitions/motions, and timed subtitles.

import { assignByPhrases } from './timing.js';
import { normalizeCaptionStyle } from './captionStyle.js';

export const TRANSITIONS = ['cut', 'fade', 'slide', 'zoom'];
export const MOTIONS = ['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'];

function round3(num) {
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
}

function extractBalancedJson(str) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i += 1) {
    const c = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (c === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (c === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start !== -1) {
          const candidate = str.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              return candidate;
            }
          } catch {
            start = -1;
          }
        }
      }
    }
  }

  return null;
}

export function extractJsonCandidate(str) {
  if (typeof str !== 'string') return null;

  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(str);
  if (fenceMatch) {
    const candidate = extractBalancedJson(fenceMatch[1].trim());
    if (candidate) return candidate;
  }

  return extractBalancedJson(str);
}

function sanitizeSubtitle(item, duration) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  if (typeof item.text !== 'string') return null;

  const collapsed = item.text.trim().replace(/\s+/g, ' ');
  if (collapsed.length === 0) return null;
  const text = collapsed.slice(0, 120);

  if (typeof item.start !== 'number' || !Number.isFinite(item.start)) return null;
  if (typeof item.end !== 'number' || !Number.isFinite(item.end)) return null;

  const start = round3(Math.max(0, Math.min(duration, item.start)));
  const end = round3(Math.max(0, Math.min(duration, item.end)));

  if (end <= start) return null;

  return { start, end, text };
}

export function normalizeEdl(raw, { duration, available, phrases = [], minClip = 0.5 } = {}) {
  const warnings = [];

  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    warnings.push('Invalid or missing duration.');
    return { edl: null, warnings };
  }

  if (!Array.isArray(available)) {
    warnings.push('Invalid or missing available animations.');
    return { edl: null, warnings };
  }

  const availableSet = new Set(available.filter((n) => Number.isInteger(n)));

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

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    warnings.push('Unparseable EDL: valid JSON object not found.');
    return { edl: null, warnings };
  }

  if (!Array.isArray(parsed.clips)) {
    warnings.push('Missing or invalid clips array.');
    return { edl: null, warnings };
  }

  const initialClips = [];
  for (const clip of parsed.clips) {
    if (clip === null || typeof clip !== 'object' || Array.isArray(clip)) {
      warnings.push('Dropped non-object clip entry.');
      continue;
    }

    if (
      typeof clip.number !== 'number' ||
      !Number.isInteger(clip.number) ||
      !availableSet.has(clip.number)
    ) {
      warnings.push(`Dropped clip with invalid or unavailable number: ${clip.number}.`);
      continue;
    }

    if (
      typeof clip.start !== 'number' ||
      !Number.isFinite(clip.start) ||
      typeof clip.end !== 'number' ||
      !Number.isFinite(clip.end)
    ) {
      warnings.push('Dropped clip with non-finite start or end time.');
      continue;
    }

    let transition = clip.transition;
    if (!TRANSITIONS.includes(transition)) {
      transition = 'cut';
      warnings.push(`Defaulted unknown transition '${clip.transition}' to 'cut'.`);
    }

    let motion = clip.motion;
    if (!MOTIONS.includes(motion)) {
      motion = 'none';
      warnings.push(`Defaulted unknown motion '${clip.motion}' to 'none'.`);
    }

    const rawStart = clip.start;
    const rawEnd = clip.end;
    const clampedStart = round3(Math.max(0, Math.min(duration, rawStart)));
    const clampedEnd = round3(Math.max(0, Math.min(duration, rawEnd)));

    if (clampedStart !== round3(rawStart) || clampedEnd !== round3(rawEnd)) {
      warnings.push(
        `Clamped clip timing from [${rawStart}, ${rawEnd}] to [${clampedStart}, ${clampedEnd}].`
      );
    }

    let reason = undefined;
    if (typeof clip.reason === 'string') {
      const trimmed = clip.reason.trim();
      if (trimmed.length > 0) {
        reason = trimmed.slice(0, 140);
      }
    }

    initialClips.push({
      number: clip.number,
      start: clampedStart,
      end: clampedEnd,
      transition,
      motion,
      ...(reason !== undefined ? { reason } : {}),
    });
  }

  initialClips.sort((a, b) => a.start - b.start || a.end - b.end);

  const filteredClips = [];
  for (const clip of initialClips) {
    if (round3(clip.end - clip.start) < minClip) {
      warnings.push(`Dropped clip shorter than minClip (${minClip}s).`);
    } else {
      filteredClips.push(clip);
    }
  }

  const nonOverlapping = [];
  for (const clip of filteredClips) {
    if (nonOverlapping.length === 0) {
      nonOverlapping.push({ ...clip });
      continue;
    }

    const prev = nonOverlapping[nonOverlapping.length - 1];
    let curStart = clip.start;
    const curEnd = clip.end;

    if (curStart < prev.end) {
      warnings.push(`Adjusted overlapping clip start from ${curStart} to ${prev.end}.`);
      curStart = prev.end;

      if (round3(curEnd - curStart) < minClip) {
        warnings.push(
          `Dropped clip shorter than minClip (${minClip}s) after overlap adjustment.`
        );
        continue;
      }
    }

    nonOverlapping.push({
      ...clip,
      start: curStart,
      end: curEnd,
    });
  }

  for (let i = 0; i < nonOverlapping.length - 1; i += 1) {
    const current = nonOverlapping[i];
    const next = nonOverlapping[i + 1];
    if (current.end < next.start) {
      warnings.push(`Extended clip end from ${current.end} to ${next.start} to close gap.`);
      current.end = next.start;
    }
  }

  if (nonOverlapping.length > 0) {
    if (nonOverlapping[0].start !== 0) {
      warnings.push(`Adjusted first clip start from ${nonOverlapping[0].start} to 0.`);
      nonOverlapping[0].start = 0;
    }

    const last = nonOverlapping[nonOverlapping.length - 1];
    const roundedDuration = round3(duration);
    if (last.end !== roundedDuration) {
      warnings.push(`Adjusted last clip end from ${last.end} to ${roundedDuration}.`);
      last.end = roundedDuration;
    }
  }

  if (nonOverlapping.length === 0) {
    return { edl: null, warnings };
  }

  let subtitles = [];
  if (Array.isArray(parsed.subtitles)) {
    for (const item of parsed.subtitles) {
      const cleaned = sanitizeSubtitle(item, duration);
      if (cleaned) {
        subtitles.push(cleaned);
      }
    }
    subtitles.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  if (subtitles.length === 0 && Array.isArray(phrases)) {
    for (const item of phrases) {
      const cleaned = sanitizeSubtitle(item, duration);
      if (cleaned) {
        subtitles.push(cleaned);
      }
    }
    subtitles.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  const captionStyle =
    parsed.captionStyle !== undefined ? normalizeCaptionStyle(parsed.captionStyle) : undefined;

  const dropped = [];
  if (Array.isArray(parsed.dropped)) {
    for (const d of parsed.dropped) {
      if (d && typeof d === 'object' && Number.isInteger(d.number)) {
        const item = { number: d.number };
        if (typeof d.reason === 'string') {
          item.reason = d.reason.trim().slice(0, 140);
        }
        dropped.push(item);
      }
    }
  }

  return {
    edl: {
      version: 1,
      duration: round3(duration),
      clips: nonOverlapping.map((c) => ({
        number: c.number,
        start: round3(c.start),
        end: round3(c.end),
        transition: c.transition,
        motion: c.motion,
        ...(c.reason !== undefined ? { reason: c.reason } : {}),
      })),
      subtitles,
      dropped,
      ...(captionStyle !== undefined ? { captionStyle } : {}),
    },
    warnings,
  };
}

export function fallbackEdl({ duration, available, phrases = [] } = {}) {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  if (!Array.isArray(available) || available.length === 0) {
    return null;
  }

  const sortedAvailable = [...available]
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);

  if (sortedAvailable.length === 0) {
    return null;
  }

  const rawClips = assignByPhrases(phrases, sortedAvailable.length, duration);
  if (!Array.isArray(rawClips) || rawClips.length === 0) {
    return null;
  }

  const clips = rawClips.map((c, i) => ({
    number: sortedAvailable[i],
    start: round3(c.start),
    end: round3(c.end),
    transition: i === 0 ? 'fade' : 'cut',
    motion: i % 2 === 0 ? 'zoom-in' : 'zoom-out',
  }));

  const subtitles = (Array.isArray(phrases) ? phrases : [])
    .map((p) => sanitizeSubtitle(p, duration))
    .filter((s) => s !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  return {
    version: 1,
    duration: round3(duration),
    clips,
    subtitles,
    dropped: [],
  };
}
