// Pure: caption page builder and active time lookups for karaoke subtitles. No React.
// Breaks voice meta word timestamps into short, readable pages with spring animations.

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

export function buildCaptionPages(
  words,
  { maxWords = 4, maxSeconds = 1.6, maxGap = 0.5 } = {}
) {
  if (!Array.isArray(words)) return [];

  const validWords = words.filter(isValidWord);
  if (validWords.length === 0) return [];

  const rawPages = [];
  let current = [];

  const flush = () => {
    if (current.length === 0) return;
    rawPages.push(current);
    current = [];
  };

  for (const word of validWords) {
    if (current.length > 0) {
      const prevWord = current[current.length - 1];
      const hasMaxWords = current.length >= maxWords;
      const isGap = round3(word.s - prevWord.e) > maxGap;
      const wouldExceedSeconds = round3(word.e - current[0].s) > maxSeconds;

      if (hasMaxWords || isGap || wouldExceedSeconds) {
        flush();
      }
    }

    current.push(word);

    if (SENTENCE_PUNCTUATION.test(word.w.trim())) {
      flush();
    }
  }

  flush();

  const pages = [];
  for (let i = 0; i < rawPages.length; i += 1) {
    const raw = rawPages[i];
    const pageWords = raw.map((w) => ({
      text: w.w.trim(),
      start: round3(w.s),
      end: round3(w.e),
    }));

    const pageStart = pageWords[0].start;
    const lastWordEnd = pageWords[pageWords.length - 1].end;

    let pageEnd;
    if (i + 1 < rawPages.length) {
      const nextPageStart = round3(rawPages[i + 1][0].s);
      const gap = round3(nextPageStart - lastWordEnd);
      if (gap < 0.3) {
        pageEnd = nextPageStart;
      } else {
        pageEnd = round3(Math.min(lastWordEnd + 0.15, nextPageStart));
      }
    } else {
      pageEnd = round3(lastWordEnd + 0.15);
    }

    pages.push({
      start: pageStart,
      end: pageEnd,
      words: pageWords,
    });
  }

  return pages;
}

export function activePage(pages, seconds) {
  if (!Array.isArray(pages) || pages.length === 0) return null;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    if (seconds >= page.start && seconds < page.end) {
      return page;
    }
  }

  return null;
}

export function activeWordIndex(page, seconds) {
  if (!page || !Array.isArray(page.words) || page.words.length === 0) return -1;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return -1;
  if (seconds < page.words[0].start) return -1;

  let active = -1;
  for (let i = 0; i < page.words.length; i += 1) {
    if (seconds >= page.words[i].start) {
      active = i;
    } else {
      break;
    }
  }

  return active;
}
