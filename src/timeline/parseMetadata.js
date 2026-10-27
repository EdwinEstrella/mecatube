// Pure parser for YouTube publication metadata delivered in the script chat (Prompt 1, ETAPA 4).
// Tolerant to heading formatting (Markdown #/**, accents, casing, numbering) and optional code fences.
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

export function parseMetadataFromContent(content) {
  if (typeof content !== 'string' || !content.trim()) return null;

  const rawLines = content.replace(/\r\n?/g, '\n').split('\n');
  const normLines = rawLines.map(normalizeLine);

  if (!isMetadata(normLines.filter(Boolean))) {
    return null;
  }

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
