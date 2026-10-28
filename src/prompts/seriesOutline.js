// Pure helper functions for building series outline prompts and parsing AI outline responses.

/**
 * Builds a Spanish prompt asking the AI for exactly N chapters following
 * beginning/middle/end, each "Capítulo X: <título>" + a 2-4 sentence summary.
 */
export function buildSeriesOutlinePrompt({
  idea = '',
  beginning = '',
  middle = '',
  end = '',
  chapters = 1,
  minutes = 1,
} = {}) {
  const numChapters = Math.max(1, Math.min(50, Math.floor(Number(chapters) || 1)));
  const mins = Math.max(0.5, Math.min(60, Number(minutes) || 1));

  return [
    'Actúa como showrunner y guionista principal para planificar una serie de videos documentales / narrativos para YouTube.',
    '',
    'DATOS DE LA SERIE:',
    `- Idea general: ${idea.trim() || 'No especificada'}`,
    `- Inicio: ${beginning.trim() || 'No especificado'}`,
    `- Nudo / enlace: ${middle.trim() || 'No especificado'}`,
    `- Desenlace: ${end.trim() || 'No especificado'}`,
    `- Número de capítulos: exactamente ${numChapters}`,
    `- Duración estimada por capítulo: ${mins} minutos`,
    '',
    'INSTRUCCIONES:',
    `1. Diseña la estructura completa de EXACTAMENTE ${numChapters} capítulos que sigan coherentemente el arco dramático (inicio, nudo y desenlace).`,
    '2. Cada capítulo debe tener un título atractivo y un resumen de 2 a 4 oraciones explicando qué ocurre en él y cómo conecta con el resto de la serie.',
    '3. Devuelve los capítulos en el siguiente formato estricto, sin introducciones ni conclusiones:',
    '',
    'Capítulo 1: <Título del capítulo>',
    'Resumen: <Resumen de 2 a 4 oraciones>',
    '',
    'Capítulo 2: <Título del capítulo>',
    'Resumen: <Resumen de 2 a 4 oraciones>',
    '',
    '(y así sucesivamente para cada uno de los capítulos hasta el final).',
  ].join('\n');
}

/**
 * Parses the raw AI reply into a list of chapters [{ number, title, summary, videoId }].
 * Tolerant to markdown formatting (bold, headers), numbering variations, and accents.
 */
export function parseSeriesOutline(text, expectedCount = null) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const rawChapters = [];
  let current = null;
  let summaryLines = [];

  // Matches lines like:
  // "Capítulo 1: El misterio"
  // "**Capítulo 1: El misterio**"
  // "**Capítulo 1**: El misterio"
  // "1. Capítulo 1: El misterio"
  // "### Capítulo 1 - El misterio"
  // "Episodio 1: El misterio"
  const chapterPattern = /^(?:#{1,6}\s+)?(?:\d+[.)]\s+)?(?:\*\*)?(?:cap[ií]tulo|cap\.|episodio)\s*(\d+)[\s*:-]+(?:\*\*)?\s*(.*?)$/i;

  // Fallback pattern for pure numbered lists like "1. El misterio"
  const fallbackNumPattern = /^(?:#{1,6}\s+)?(\d+)[.)]\s+(?:\*\*)?(.*?)$/;

  const flush = () => {
    if (current) {
      const summaryText = summaryLines
        .join(' ')
        .replace(/^(?:\*\*)?(?:resumen|sinopsis|summary):?\s*(?:\*\*)?/i, '')
        .replace(/^\*+\s*/, '')
        .replace(/\s*\*+$/, '')
        .trim();
      current.summary = summaryText;
      rawChapters.push(current);
      current = null;
      summaryLines = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(chapterPattern);
    if (match) {
      flush();
      const num = parseInt(match[1], 10);
      let title = match[2]
        .replace(/^[:–—\-]\s*/, '')
        .replace(/\*\*+/g, '')
        .replace(/__+/g, '')
        .trim();
      current = {
        number: Number.isInteger(num) ? num : rawChapters.length + 1,
        title: title || `Capítulo ${rawChapters.length + 1}`,
        summary: '',
        videoId: null,
      };
      continue;
    }

    if (current) {
      summaryLines.push(line);
    }
  }
  flush();

  // If no chapters were detected using "Capítulo", try the fallback numbered pattern
  if (rawChapters.length === 0) {
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const match = line.match(fallbackNumPattern);
      if (match) {
        flush();
        const num = parseInt(match[1], 10);
        let title = match[2]
          .replace(/^[:–—\-]\s*/, '')
          .replace(/\*\*+/g, '')
          .replace(/__+/g, '')
          .trim();
        current = {
          number: Number.isInteger(num) ? num : rawChapters.length + 1,
          title: title || `Capítulo ${rawChapters.length + 1}`,
          summary: '',
          videoId: null,
        };
        continue;
      }

      if (current) {
        summaryLines.push(line);
      }
    }
    flush();
  }

  // Format and sanitize
  const results = rawChapters.map((c, idx) => ({
    number: c.number || idx + 1,
    title: (c.title || `Capítulo ${idx + 1}`).slice(0, 200),
    summary: (c.summary || '').slice(0, 4000),
    videoId: c.videoId ?? null,
  }));

  if (expectedCount && expectedCount > 0 && results.length > expectedCount) {
    return results.slice(0, expectedCount);
  }

  return results;
}
