// Pure helper functions to construct structured video briefs for series chapters and title bank videos.

/**
 * Builds the brief for a series chapter video containing:
 * - series context (idea, beginning, middle, end)
 * - this chapter's number, title, and summary
 * - previous and next chapter titles (for narrative continuity)
 * - target duration in minutes
 */
export function buildSeriesChapterBrief({ series = {}, chapter = {}, outline = [] } = {}) {
  const chapterNumber = chapter.number ?? 1;
  const chapterTitle = (chapter.title ?? '').trim();
  const chapterSummary = (chapter.summary ?? '').trim();
  const minutes = series?.minutes ?? 1;

  const prevChapter = outline.find((c) => c.number === chapterNumber - 1);
  const nextChapter = outline.find((c) => c.number === chapterNumber + 1);

  const lines = [
    'SERIE:',
    series.idea ? `- Idea general: ${series.idea}` : null,
    series.beginning ? `- Inicio de la serie: ${series.beginning}` : null,
    series.middle ? `- Nudo / enlace: ${series.middle}` : null,
    series.end ? `- Desenlace de la serie: ${series.end}` : null,
    '',
    `CAPÍTULO ACTUAL (${chapterNumber} de ${outline.length || series.chapters || 1}):`,
    chapterTitle ? `- Título: ${chapterTitle}` : null,
    chapterSummary ? `- Resumen del capítulo: ${chapterSummary}` : null,
    `- Duración objetivo: ${minutes} minutos`,
    '',
    'CONTINUIDAD NARRATIVA:',
    prevChapter
      ? `- Capítulo anterior: Cap. ${prevChapter.number} — ${prevChapter.title}`
      : '- Capítulo anterior: Ninguno (este es el primer capítulo de la serie).',
    nextChapter
      ? `- Capítulo siguiente: Cap. ${nextChapter.number} — ${nextChapter.title}`
      : '- Capítulo siguiente: Ninguno (este es el capítulo final de la serie).',
  ].filter((item) => item !== null);

  return lines.join('\n');
}

/**
 * Builds the brief for a title bank video:
 * "Título del video: <texto>" + branch context (videoType, orientation).
 */
export function buildTitleBrief(titleText, branch = {}) {
  const text = typeof titleText === 'string' ? titleText.trim() : '';
  const lines = [`Título del video: ${text}`];

  if (branch?.videoType) {
    lines.push(`Tipo de video: ${branch.videoType}`);
  }
  if (branch?.orientation) {
    lines.push(`Orientación / Formato: ${branch.orientation}`);
  }

  return lines.join('\n');
}
