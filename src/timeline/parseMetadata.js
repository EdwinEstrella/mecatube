// Pure parser for publication metadata delivered in the script chat (Prompt 1, ETAPA 4).
// Supports single YouTube metadata (horizontal format) and multi-platform metadata (vertical format:
// YouTube Shorts, TikTok, Instagram Reels). Tolerant to headings (Markdown #/**, accents, casing, numbering, emoji)
// and optional code fences.
import { normalizeLine, isMetadata } from './stages.js';

const FENCE_REGEX = /^\s*(`{3,}|~{3,})\s*[\w+#.-]*\s*$/;

// Strips surrounding quotes, backticks, asterisks or whitespace from a string
export function stripWrapping(text) {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/^["'«“`]+|["'»”`]+$/g, '')
    .trim();
}

// Extracts content inside code fences, or all non-empty lines if no fences exist
function extractFencedOrRaw(lines) {
  const fencedBlocks = [];
  let inFence = false;
  let currentFenceChar = null;
  let currentFenceLen = 0;
  let currentBlock = [];

  for (const line of lines) {
    const fenceMatch = line.match(FENCE_REGEX);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (!inFence) {
        inFence = true;
        currentFenceChar = char;
        currentFenceLen = len;
        currentBlock = [];
      } else if (char === currentFenceChar && len >= currentFenceLen) {
        inFence = false;
        fencedBlocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
    } else if (inFence) {
      currentBlock.push(line);
    }
  }

  if (fencedBlocks.length > 0) {
    return { fenced: true, text: fencedBlocks.join('\n\n').trim(), blocks: fencedBlocks };
  }

  const cleanLines = lines.filter((line) => {
    const norm = normalizeLine(line);
    return norm && !/^[=-]{3,}$/.test(norm);
  });

  return { fenced: false, text: cleanLines.join('\n').trim(), blocks: [] };
}

const TITLE_PREFIX = /^(?:[-*•]\s*)?(?:\*{1,2})?(?:opci[oó]n\s*\d+|t[ií]tulo\s*\d+|\d+[.)])(?:\*{1,2})?\s*[:\-–—]?\s*(.*)$/i;
const TITLE_STANDALONE_LABEL = /^(?:[-*•]\s*)?(?:\*{1,2})?(?:opci[oó]n\s*\d+|t[ií]tulo\s*\d+|\d+[.)])(?:\*{1,2})?:?\s*$/i;

function parseTitles(lines) {
  const extracted = extractFencedOrRaw(lines);
  const rawLines = extracted.text ? extracted.text.split('\n') : [];

  const titles = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    if (TITLE_STANDALONE_LABEL.test(line) && i + 1 < rawLines.length) {
      const next = rawLines[i + 1].trim();
      if (next && !TITLE_STANDALONE_LABEL.test(next)) {
        titles.push(stripWrapping(next));
        i++;
        continue;
      }
    }

    const match = line.match(TITLE_PREFIX);
    if (match && match[1].trim()) {
      titles.push(stripWrapping(match[1]));
    }
  }

  if (titles.length > 0) return titles;

  if (extracted.fenced) {
    return rawLines.map(stripWrapping).filter(Boolean);
  }

  return rawLines.map(stripWrapping).filter(Boolean);
}

const THUMBNAIL_TEXT_REGEX = /(?:texto (?:de(?: la)?|en la)? miniatura|texto de miniatura|texto miniatura|thumbnail text)\s*[:\-–—=]\s*["'«“]?([^"'»”\n\r]+)["'»”]?/i;

function parseThumbnailText(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(THUMBNAIL_TEXT_REGEX);
  if (!match || !match[1].trim()) return null;
  return stripWrapping(match[1]);
}

function parseDescription(lines) {
  const extracted = extractFencedOrRaw(lines);
  return extracted.text;
}

function parseTags(lines) {
  const extracted = extractFencedOrRaw(lines);
  if (!extracted.text) return [];

  const items = extracted.text.includes(',')
    ? extracted.text.split(',')
    : extracted.text.split('\n');

  return items
    .map((item) => stripWrapping(item.trim().replace(/^#/, '')))
    .filter((tag) => tag.length > 0);
}

function cleanPlatformHeading(line) {
  if (typeof line !== 'string') return '';
  return line
    .replace(/^[\s#*`~_>\-–—\d.)•🎬📱📸🎥✨]+/u, '')
    .replace(/[:\s*`~_#]+$/u, '')
    .trim();
}

function parseHashtags(text) {
  if (typeof text !== 'string') return [];
  const matches = text.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g);
  if (matches && matches.length > 0) {
    return Array.from(new Set(matches.map((h) => (h.startsWith('#') ? h : `#${h}`))));
  }
  return text
    .split(/[\s,]+/)
    .map((s) => stripWrapping(s.trim()))
    .filter(Boolean)
    .map((s) => (s.startsWith('#') ? s : `#${s}`));
}

function parseShortsBlock(lines) {
  const norm = lines.map(normalizeLine);
  const titleIdx = norm.findIndex((l) => /^(?:\d+[.)] ?)?t[ií]tulos?\b/.test(l));
  const descIdx = norm.findIndex((l) => /^(?:\d+[.)] ?)?descripci[oó]n\b/.test(l));
  const tagsIdx = norm.findIndex((l) => /^(?:\d+[.)] ?)?etiquetas\b/.test(l));

  if (titleIdx !== -1 || descIdx !== -1 || tagsIdx !== -1) {
    const titleEnd = descIdx !== -1 ? descIdx : (tagsIdx !== -1 ? tagsIdx : lines.length);
    const descEnd = tagsIdx !== -1 ? tagsIdx : lines.length;

    const titleLines = titleIdx !== -1 ? lines.slice(titleIdx + 1, titleEnd) : [];
    const descLines = descIdx !== -1 ? lines.slice(descIdx + 1, descEnd) : [];
    const tagsLines = tagsIdx !== -1 ? lines.slice(tagsIdx + 1) : [];

    const parsedTitles = parseTitles(titleLines);
    const title = parsedTitles[0] || (extractFencedOrRaw(titleLines).text.split('\n')[0] ?? '').trim();
    const description = parseDescription(descLines);
    const tags = parseTags(tagsLines);

    return {
      title,
      titles: parsedTitles.length ? parsedTitles : (title ? [title] : []),
      description,
      tags,
    };
  }

  const extracted = extractFencedOrRaw(lines);
  if (extracted.blocks.length >= 3) {
    const titles = parseTitles([extracted.blocks[0]]);
    const title = titles[0] || stripWrapping(extracted.blocks[0]);
    return {
      title,
      titles: titles.length ? titles : (title ? [title] : []),
      description: stripWrapping(extracted.blocks[1]),
      tags: parseTags([extracted.blocks[2]]),
    };
  }
  if (extracted.blocks.length === 2) {
    const titles = parseTitles([extracted.blocks[0]]);
    const title = titles[0] || stripWrapping(extracted.blocks[0]);
    return {
      title,
      titles: titles.length ? titles : (title ? [title] : []),
      description: stripWrapping(extracted.blocks[1]),
      tags: [],
    };
  }
  return { title: '', titles: [], description: extracted.text, tags: [] };
}

function parseTikTokBlock(lines) {
  const norm = lines.map(normalizeLine);
  const descIdx = norm.findIndex((l) => /^(?:\d+[.)] ?)?(?:descripci[oó]n|caption|texto)\b/.test(l));
  const tagsIdx = norm.findIndex((l) => /^(?:\d+[.)] ?)?(?:hashtags?|etiquetas)\b/.test(l));

  if (descIdx !== -1 || tagsIdx !== -1) {
    const descEnd = tagsIdx !== -1 ? tagsIdx : lines.length;
    const descLines = descIdx !== -1 ? lines.slice(descIdx + 1, descEnd) : lines.slice(0, tagsIdx);
    const tagsLines = tagsIdx !== -1 ? lines.slice(tagsIdx + 1) : [];

    const caption = parseDescription(descLines);
    let hashtags = parseHashtags(extractFencedOrRaw(tagsLines).text);
    if (hashtags.length === 0 && caption) {
      hashtags = parseHashtags(caption);
    }
    return { caption, hashtags };
  }

  const extracted = extractFencedOrRaw(lines);
  if (extracted.blocks.length >= 2) {
    const caption = stripWrapping(extracted.blocks[0]);
    let hashtags = parseHashtags(extracted.blocks[1]);
    if (hashtags.length === 0) hashtags = parseHashtags(caption);
    return { caption, hashtags };
  }
  return {
    caption: extracted.text,
    hashtags: parseHashtags(extracted.text),
  };
}

function parseReelsBlock(lines) {
  const norm = lines.map(normalizeLine);
  const descIdx = norm.findIndex((l) => /^(?:\d+[.)] ?)?(?:descripci[oó]n|caption|texto)\b/.test(l));
  const tagsIdx = norm.findIndex((l) => /^(?:\d+[.)] ?)?(?:hashtags?|etiquetas)\b/.test(l));

  if (descIdx !== -1 || tagsIdx !== -1) {
    const descEnd = tagsIdx !== -1 ? tagsIdx : lines.length;
    const descLines = descIdx !== -1 ? lines.slice(descIdx + 1, descEnd) : lines.slice(0, tagsIdx);
    const tagsLines = tagsIdx !== -1 ? lines.slice(tagsIdx + 1) : [];

    const caption = parseDescription(descLines);
    let hashtags = parseHashtags(extractFencedOrRaw(tagsLines).text);
    if (hashtags.length === 0 && caption) {
      hashtags = parseHashtags(caption);
    }
    return { caption, hashtags };
  }

  const extracted = extractFencedOrRaw(lines);
  if (extracted.blocks.length >= 2) {
    const caption = stripWrapping(extracted.blocks[0]);
    let hashtags = parseHashtags(extracted.blocks[1]);
    if (hashtags.length === 0) hashtags = parseHashtags(caption);
    return { caption, hashtags };
  }
  return {
    caption: extracted.text,
    hashtags: parseHashtags(extracted.text),
  };
}

export function parseMetadataFromContent(content) {
  if (typeof content !== 'string' || !content.trim()) return null;

  const rawLines = content.replace(/\r\n?/g, '\n').split('\n');
  const normLines = rawLines.map(normalizeLine);

  if (!isMetadata(normLines.filter(Boolean))) {
    return null;
  }

  // Check for multi-platform headings (vertical branch: YouTube Shorts / TikTok / Instagram Reels)
  const platformMatches = [];
  rawLines.forEach((line, i) => {
    const clean = cleanPlatformHeading(line);
    if (/^youtube(?:\s+shorts)?$/i.test(clean)) {
      platformMatches.push({ platform: 'youtubeShorts', idx: i });
    } else if (/^tiktok$/i.test(clean)) {
      platformMatches.push({ platform: 'tiktok', idx: i });
    } else if (/^(?:instagram(?:\s+reels)?|reels)$/i.test(clean)) {
      platformMatches.push({ platform: 'instagramReels', idx: i });
    }
  });

  if (platformMatches.length > 0) {
    platformMatches.sort((a, b) => a.idx - b.idx);
    let youtubeShorts = null;
    let tiktok = null;
    let instagramReels = null;

    for (let m = 0; m < platformMatches.length; m++) {
      const current = platformMatches[m];
      const nextIdx = platformMatches[m + 1] ? platformMatches[m + 1].idx : rawLines.length;
      const sectionLines = rawLines.slice(current.idx + 1, nextIdx);

      if (current.platform === 'youtubeShorts') {
        youtubeShorts = parseShortsBlock(sectionLines);
      } else if (current.platform === 'tiktok') {
        tiktok = parseTikTokBlock(sectionLines);
      } else if (current.platform === 'instagramReels') {
        instagramReels = parseReelsBlock(sectionLines);
      }
    }

    let thumbnailText = parseThumbnailText(content);

    const titles = youtubeShorts?.titles?.length
      ? youtubeShorts.titles
      : (youtubeShorts?.title ? [youtubeShorts.title] : []);
    const description = youtubeShorts?.description || '';
    const tags = youtubeShorts?.tags || [];

    return {
      titles,
      description,
      tags,
      thumbnailText,
      platforms: {
        youtubeShorts: youtubeShorts || { title: '', titles: [], description: '', tags: [] },
        tiktok: tiktok || { caption: '', hashtags: [] },
        instagramReels: instagramReels || { caption: '', hashtags: [] },
      },
    };
  }

  // Single YouTube metadata parse (horizontal branch backwards-compatible)
  const titlesIdx = normLines.findIndex((l) => /^(?:\d+[.)] ?)?titulos\b/.test(l));
  const thumbIdx = normLines.findIndex((l) => /^(?:\d+[.)] ?)?(?:prompts? de )?miniaturas?\b/.test(l));
  const descIdx = normLines.findIndex((l) => /^(?:\d+[.)] ?)?descripcion\b/.test(l));
  const tagsIdx = normLines.findIndex((l) => /^(?:\d+[.)] ?)?etiquetas\b/.test(l));

  const titlesEnd = thumbIdx !== -1 ? thumbIdx : (descIdx !== -1 ? descIdx : (tagsIdx !== -1 ? tagsIdx : rawLines.length));
  const thumbEnd = descIdx !== -1 ? descIdx : (tagsIdx !== -1 ? tagsIdx : rawLines.length);
  const descEnd = tagsIdx !== -1 ? tagsIdx : rawLines.length;

  const titlesLines = titlesIdx !== -1 ? rawLines.slice(titlesIdx + 1, titlesEnd) : [];
  const thumbLines = thumbIdx !== -1 ? rawLines.slice(thumbIdx + 1, thumbEnd) : [];
  const descLines = descIdx !== -1 ? rawLines.slice(descIdx + 1, descEnd) : [];
  const tagsLines = tagsIdx !== -1 ? rawLines.slice(tagsIdx + 1) : [];

  const titles = parseTitles(titlesLines);
  const description = parseDescription(descLines);
  const tags = parseTags(tagsLines);

  let thumbnailText = parseThumbnailText(thumbLines.join('\n'));
  if (!thumbnailText) {
    thumbnailText = parseThumbnailText(content);
  }

  if (titles.length === 0 && !description && tags.length === 0) {
    return null;
  }

  return {
    titles,
    description,
    tags,
    thumbnailText,
  };
}

export function parseMetadata(input) {
  if (!input) return null;

  if (Array.isArray(input)) {
    for (let i = input.length - 1; i >= 0; i--) {
      const msg = input[i];
      if (msg?.role === 'assistant' && typeof msg.content === 'string') {
        const parsed = parseMetadataFromContent(msg.content);
        if (parsed) return parsed;
      }
    }
    return null;
  }

  const content = typeof input === 'string' ? input : (typeof input?.content === 'string' ? input.content : null);
  if (!content) return null;
  return parseMetadataFromContent(content);
}
