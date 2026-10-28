// Orientation prompt transformations for 16:9 horizontal vs 9:16 vertical video formats.
// Preserves prompt structure while replacing aspect ratios, dimensions, framing, and adding short-form notes.

function replaceSubstring(text, from, to) {
  if (text.includes(from)) {
    return text.replaceAll(from, to);
  }
  if (from.includes('\r\n') && !text.includes('\r\n')) {
    const lfFrom = from.replaceAll('\r\n', '\n');
    const lfTo = to.replaceAll('\r\n', '\n');
    if (text.includes(lfFrom)) {
      return text.replaceAll(lfFrom, lfTo);
    }
  } else if (!from.includes('\r\n') && text.includes('\r\n')) {
    const crlfFrom = from.replaceAll(/(?<!\r)\n/g, '\r\n');
    const crlfTo = to.replaceAll(/(?<!\r)\n/g, '\r\n');
    if (text.includes(crlfFrom)) {
      return text.replaceAll(crlfFrom, crlfTo);
    }
  }
  return text;
}

// Vertical intro addition for prompt-1
const VERTICAL_NOTE =
  'Este video es un video vertical corto para YouTube Shorts, TikTok e Instagram Reels (gancho en los primeros 2 segundos, ritmo rápido).';

const PROMPT1_INTRO_TARGET = `formatos probados del nicho explainer.`;
const PROMPT1_INTRO_REPLACEMENT = `formatos probados del nicho explainer.\n${VERTICAL_NOTE}`;

const PROMPT1_METADATA_TARGET = `ETAPA 4 — METADATOS DE PUBLICACIÓN
────────────────────────────────────────
Objetivo:
Entregar los metadatos para publicar el video, coherentes con el guion final y
optimizados para CTR.
Instrucciones:
Ejecuta esta etapa solo cuando el usuario escriba "siguiente".
Entrega los 4 bloques en este orden y en bloques de código copiables.
1. TÍTULOS (2 opciones)
• Aplica las fórmulas de título del formato del video.
• Opción 1: la versión más cercana a la idea seleccionada. Opción 2: un ángulo
distinto (otra emoción u otra fórmula).
• Curiosidad estratégica, sin sensacionalismo vacío ni promesas que el guion no
cumpla.
• Máximo 60 caracteres siempre que sea posible; nunca más de 70.
• Si el título menciona minutos, deben coincidir con [DURACIÓN].
2. PROMPTS DE MINIATURA (2 prompts)
Antes de los prompts, indica al usuario en 1–2 líneas:
Para generar la miniatura, sube o selecciona la imagen de tu personaje principal
en ChatGPT o en Flow y luego pega el prompt correspondiente.
Instrucciones para cada prompt:
• Miniatura 1 conectada con el Título 1. Miniatura 2 conectada con el Título 2.
• Indica que se use la imagen adjunta del personaje principal como referencia y se
mantenga su apariencia y estilo.
• Escribe el prompt en inglés para mejor resultado del generador de imágenes.
• Formato 16:9, contraste alto, punto focal claro y legible en tamaño pequeño.
Si el video es FORMATO A (Narrativo):
• Un solo personaje principal como protagonista, ocupando gran parte del encuadre.
• Emoción exagerada y legible que refleje la pregunta del título (miedo, asombro,
confusión, placer, agotamiento).
• Escena simple con 1 elemento visual clave del tema (amenaza, objeto o lugar).
• Texto de 1–3 palabras en español, gigante, en negrita, amarillo con contorno
negro grueso, normalmente con signo de interrogación, ubicado en una esquina
superior sin tapar la cara del personaje.
• El texto complementa el título sin repetirlo.
Si el video es FORMATO B (Lista):
• Cuadrícula de 6 u 8 paneles (2×3 o 2×4) con bordes blancos finos.
• Cada panel muestra un elemento del guion con una imagen clara.
• Cada panel lleva una etiqueta corta en español con el nombre del elemento, en
texto negro sobre franja blanca en la parte inferior.
• El personaje principal aparece en 1–2 paneles interactuando con el elemento.
• Sin texto grande de encabezado.
3. DESCRIPCIÓN
• Las 2 primeras líneas deben enganchar e incluir la palabra clave principal.
• Un párrafo breve que resuma el video sin revelar el giro principal.
• En FORMATO B, una lista de los elementos que aparecen en el video, sin marcas de
tiempo.
• Un llamado a la acción breve.
• 3 hashtags relevantes al final.
• No incluyas capítulos ni marcas de tiempo.
4. ETIQUETAS
• Entre 15 y 20 etiquetas en español, separadas por comas.
• Mezcla palabras clave amplias, específicas y de cola larga.
• Máximo 500 caracteres en total.
Formato de salida de la ETAPA 4:
METADATOS DE PUBLICACIÓN
1. TÍTULOS
[bloque de código con Opción 1 y Opción 2]
2. PROMPTS DE MINIATURA
[Indicación breve sobre la imagen del personaje principal]
[bloque de código con Prompt Miniatura 1]
[bloque de código con Prompt Miniatura 2]
3. DESCRIPCIÓN
[bloque de código]
4. ETIQUETAS
[bloque de código]`;

const PROMPT1_METADATA_REPLACEMENT = `ETAPA 4 — METADATOS DE PUBLICACIÓN
────────────────────────────────────────
Objetivo:
Entregar los metadatos para publicar el video vertical (formato 9:16) en las 3 plataformas:
YouTube Shorts, TikTok e Instagram Reels, coherentes con el guion final.
Instrucciones:
Ejecuta esta etapa solo cuando el usuario escriba "siguiente".
Entrega exactamente 3 bloques con los encabezados estrictos "YOUTUBE SHORTS", "TIKTOK" e
"INSTAGRAM REELS" en bloques de código copiables:
1. YOUTUBE SHORTS
• Título: máximo 100 caracteres, incluyendo obligatoriamente el hashtag #Shorts al final. Gancho potente y claro.
• Descripción: resumen breve de 2-3 líneas con llamado a la acción y palabras clave.
• Etiquetas: entre 10 y 15 etiquetas separadas por comas (máximo 500 caracteres).
2. TIKTOK
• Descripción (caption): texto breve de máximo 150 caracteres que invite a comentar o ver completo, más 3 a 5 hashtags relevantes (#...).
• Hashtags: lista de los 3-5 hashtags seleccionados.
3. INSTAGRAM REELS
• Descripción (caption): texto atractivo con gancho inicial, desarrollo breve y llamado a la acción.
• Hashtags: hasta 5 hashtags específicos del nicho (#...).
Formato de salida de la ETAPA 4:
METADATOS DE PUBLICACIÓN

YOUTUBE SHORTS
Título:
[bloque de código con título <=100 caracteres con #Shorts]
Descripción:
[bloque de código con descripción]
Etiquetas:
[bloque de código con etiquetas separadas por comas]

TIKTOK
Descripción:
[bloque de código con caption <=150 caracteres + hashtags]
Hashtags:
[bloque de código con 3-5 hashtags]

INSTAGRAM REELS
Descripción:
[bloque de código con caption]
Hashtags:
[bloque de código con hasta 5 hashtags]`;

// Exact replacements in prompt-1 and prompt-2 for vertical framing and 9:16 aspect ratio
const VERTICAL_EXACT_REPLACEMENTS = [
  // Prompt-1 intro note insertion
  [PROMPT1_INTRO_TARGET, PROMPT1_INTRO_REPLACEMENT],

  // Prompt-1 vertical publication metadata (YouTube Shorts, TikTok, Instagram Reels)
  [PROMPT1_METADATA_TARGET, PROMPT1_METADATA_REPLACEMENT],

  // Prompt-1 thumbnail format mention
  [
    '• Formato 16:9, contraste alto, punto focal claro y legible en tamaño pequeño.',
    '• Formato vertical 9:16, contraste alto, punto focal claro y legible en tamaño pequeño.',
  ],

  // Prompt-2 general format specification
  [
    '* Relación de aspecto 16:9, 1920x1080 px.',
    '* Relación de aspecto vertical 9:16, 1080x1920 px.',
  ],

  // Prompt-2 Plantilla 1 shot options
  [
    '* `[SHOT]` — `medium shot, main character centered` / `wide shot, main character\r\non the left third` / `wide shot, main character on the right third`.',
    '* `[SHOT]` — `vertical framing, subject centered` / `vertical framing, main character\r\ncentered` / `vertical framing, close-up centered`.',
  ],
  [
    '* `[SHOT]` — `medium shot, main character centered` / `wide shot, main character on the left third` / `wide shot, main character on the right third`.',
    '* `[SHOT]` — `vertical framing, subject centered` / `vertical framing, main character centered` / `vertical framing, close-up centered`.',
  ],

  // Prompt-2 Plantilla 2 layout tables (horizontal rows -> vertical stacks)
  [
    '| Flujo | a horizontal row of [N] simple drawings from left to right connected by\r\nbold red arrows |',
    '| Flujo | a vertical sequence of [N] simple drawings from top to bottom connected by\r\nbold red arrows |',
  ],
  [
    '| Flujo | a horizontal row of [N] simple drawings from left to right connected by bold red arrows |',
    '| Flujo | a vertical sequence of [N] simple drawings from top to bottom connected by bold red arrows |',
  ],
  [
    '| Línea de tiempo | a long horizontal dotted timeline with small tick marks, with\r\n[N] small drawings placed along it |',
    '| Línea de tiempo | a vertical dotted timeline running top to bottom with small tick marks, with\r\n[N] small drawings placed along it |',
  ],
  [
    '| Línea de tiempo | a long horizontal dotted timeline with small tick marks, with [N] small drawings placed along it |',
    '| Línea de tiempo | a vertical dotted timeline running top to bottom with small tick marks, with [N] small drawings placed along it |',
  ],

  // Prompt-2 Plantilla 3 camera motion
  [
    'slow gentle pan from left to right',
    'slow gentle vertical tilt from top to bottom',
  ],

  // Prompt-2 Plantilla 4 thumbnail header
  [
    'YouTube thumbnail, wide 16:9, 1920x1080.',
    'Vertical thumbnail, vertical 9:16, 1080x1920.',
  ],

  // Templates across stickman and styles (wide 16:9, 1920x1080 -> vertical 9:16, 1080x1920)
  [
    'wide 16:9, 1920x1080',
    'vertical 9:16, 1080x1920',
  ],
  [
    'Wide 16:9',
    'Vertical 9:16',
  ],
  [
    'wide 16:9',
    'vertical 9:16',
  ],
  [
    '1920x1080',
    '1080x1920',
  ],
  [
    '16:9',
    '9:16',
  ],
];

export function applyOrientation(promptText, orientation) {
  if (typeof promptText !== 'string') return '';
  if (orientation !== 'vertical') {
    return promptText;
  }

  let result = promptText;
  for (const [from, to] of VERTICAL_EXACT_REPLACEMENTS) {
    result = replaceSubstring(result, from, to);
  }

  return result;
}
