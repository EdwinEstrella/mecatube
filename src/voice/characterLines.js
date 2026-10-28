// Pure parser and planning for character dialogue lines and multi-voice voiceovers. No DOM, no React.
// Segments a script into speaker blocks based on [NOMBRE]: tags and branch characters.

export function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Splits a script/narration into ordered segments { speaker: 'narrator'|<characterKey>, text }.
// Character lines use the [NOMBRE]: texto convention (T10). Unknown names become narrator,
// and their tag is removed from the text. Names match case- and accent-insensitively.
export function parseCharacterLines(text, characters = []) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const charMap = new Map();
  if (Array.isArray(characters)) {
    for (const c of characters) {
      if (!c) continue;
      if (c.name) charMap.set(normalizeName(c.name), c.key);
      if (c.key) charMap.set(normalizeName(c.key), c.key);
    }
  }

  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const rawSegments = [];
  let currentSpeaker = null;
  let currentParts = [];

  const flush = () => {
    if (currentSpeaker && currentParts.length > 0) {
      const content = currentParts.join('\n').trim();
      if (content) {
        rawSegments.push({ speaker: currentSpeaker, text: content });
      }
    }
    currentSpeaker = null;
    currentParts = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    // Strip common Markdown bolding wrappers around tags
    const line = trimmed
      .replace(/^\s*\*\*\[([^\]]+)\]:\*\*\s*/, '[$1]: ')
      .replace(/^\s*\*\*\[([^\]]+)\]\*\*\s*:\s*/, '[$1]: ');

    const tagMatch = line.match(/^\[([^\]]+)\]\s*:\s*(.*)$/);
    if (tagMatch) {
      flush();
      const rawName = tagMatch[1];
      const rest = tagMatch[2].trim();
      const matchedKey = charMap.get(normalizeName(rawName));
      currentSpeaker = matchedKey || 'narrator';
      if (rest) currentParts.push(rest);
    } else {
      const inlineMatch = line.match(/^(.*?)\s*\[([^\]]+)\]\s*:\s*(.*)$/);
      if (inlineMatch && inlineMatch[1].trim()) {
        flush();
        rawSegments.push({ speaker: 'narrator', text: inlineMatch[1].trim() });
        const rawName = inlineMatch[2];
        const rest = inlineMatch[3].trim();
        const matchedKey = charMap.get(normalizeName(rawName));
        currentSpeaker = matchedKey || 'narrator';
        if (rest) currentParts.push(rest);
      } else if (currentSpeaker !== null) {
        currentParts.push(line);
      } else {
        currentSpeaker = 'narrator';
        currentParts.push(line);
      }
    }
  }
  flush();

  // Merge consecutive segments with the same speaker
  const segments = [];
  for (const seg of rawSegments) {
    if (segments.length > 0 && segments[segments.length - 1].speaker === seg.speaker) {
      segments[segments.length - 1].text += `\n\n${seg.text}`;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}

// Plans voice assignment per segment. Characters without a voice fall back to narrator voice.
// Adjacent segments sharing the same voice are merged. Returns { isMultiVoice, narratorVoiceId, segments }.
export function planVoiceSegments(segments, { characters = [], narratorVoiceId = null, defaultVoiceId = null } = {}) {
  const activeNarratorVoice = (typeof narratorVoiceId === 'string' && narratorVoiceId.trim())
    ? narratorVoiceId.trim()
    : (typeof defaultVoiceId === 'string' && defaultVoiceId.trim() ? defaultVoiceId.trim() : null);

  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      isMultiVoice: false,
      narratorVoiceId: activeNarratorVoice,
      segments: [],
    };
  }

  const charVoiceMap = new Map();
  if (Array.isArray(characters)) {
    for (const c of characters) {
      if (!c) continue;
      charVoiceMap.set(c.key, {
        voiceId: typeof c.voiceId === 'string' && c.voiceId.trim() ? c.voiceId.trim() : null,
        name: c.name || c.key,
      });
    }
  }

  const resolved = [];
  for (const seg of segments) {
    if (!seg || typeof seg.text !== 'string' || !seg.text.trim()) continue;
    let segVoiceId = activeNarratorVoice;
    let voiceName = 'Narrador';
    const speaker = seg.speaker || 'narrator';

    if (speaker !== 'narrator') {
      const charInfo = charVoiceMap.get(speaker);
      if (charInfo && charInfo.voiceId) {
        segVoiceId = charInfo.voiceId;
        voiceName = charInfo.name;
      } else {
        segVoiceId = activeNarratorVoice;
        voiceName = 'Narrador';
      }
    }

    resolved.push({
      speaker,
      voiceId: segVoiceId,
      voiceName,
      text: seg.text.trim(),
    });
  }

  // Merge adjacent segments that share the same voiceId
  const merged = [];
  for (const item of resolved) {
    if (merged.length > 0 && merged[merged.length - 1].voiceId === item.voiceId) {
      merged[merged.length - 1].text += `\n\n${item.text}`;
    } else {
      merged.push({ ...item });
    }
  }

  const distinctVoices = new Set(merged.map((s) => s.voiceId).filter(Boolean));
  const hasCharacterWithVoice = merged.some(
    (s) => s.speaker !== 'narrator' && s.voiceId && s.voiceId !== activeNarratorVoice
  );
  const isMultiVoice = merged.length > 1 && (distinctVoices.size > 1 || hasCharacterWithVoice);

  return {
    isMultiVoice,
    narratorVoiceId: activeNarratorVoice,
    segments: merged,
  };
}

// Pure helper: merges multiple takes/segments into a single word timestamps array
// by shifting each subsequent segment's timestamps by the cumulative audio duration.
export function mergeTimestampOffsets(segments = []) {
  if (!Array.isArray(segments)) return [];
  const mergedWords = [];
  let currentOffset = 0;

  for (const seg of segments) {
    if (!seg) continue;
    const words = Array.isArray(seg.words) ? seg.words : [];
    for (const item of words) {
      if (!item || typeof item !== 'object') continue;
      const s = typeof item.s === 'number' && Number.isFinite(item.s) ? item.s : 0;
      const e = typeof item.e === 'number' && Number.isFinite(item.e) ? item.e : s;
      mergedWords.push({
        w: String(item.w ?? ''),
        s: Math.round((s + currentOffset) * 1000) / 1000,
        e: Math.round((e + currentOffset) * 1000) / 1000,
      });
    }

    let duration = 0;
    if (typeof seg.duration === 'number' && Number.isFinite(seg.duration)) {
      duration = seg.duration;
    } else if (typeof seg.seconds === 'number' && Number.isFinite(seg.seconds)) {
      duration = seg.seconds;
    } else if (words.length > 0) {
      const lastWord = words[words.length - 1];
      if (lastWord && typeof lastWord.e === 'number') {
        duration = lastWord.e;
      }
    }

    currentOffset += Math.max(0, duration);
  }

  return mergedWords;
}
