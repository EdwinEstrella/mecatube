// Voice mode prompt transformations:
// 'voiceover' (default: narrator in off, characters never speak)
// 'flow' (characters speak their lines inside animations with lip-sync, minimal/no narrator)

export const VOICE_MODES = ['voiceover', 'flow'];
export const DEFAULT_VOICE_MODE = 'voiceover';

export function getVoiceMode(mode) {
  return VOICE_MODES.includes(mode) ? mode : DEFAULT_VOICE_MODE;
}

// ---------------------------------------------------------------------------
// Targets & Replacements for Prompt 1
// ---------------------------------------------------------------------------

export const PROMPT1_LINE4_TARGET =
  'promedio del canal) y guiones en español para narración en off, basados en';
export const PROMPT1_LINE4_FLOW =
  'promedio del canal) y guiones en español dialogados para animación con voces de personajes (modo flow), basados en';

export const PROMPT1_LENGTH_TARGET = `Extensión según duración (narración en español):
Opción 1 · 3 minutos → ~400–500 palabras · Formato B: 3–4 elementos
Opción 2 · 8 minutos → ~1.000–1.200 palabras · Formato B: 6–8 elementos
Opción 3 · 15 minutos → ~1.900–2.200 palabras · Formato B: 8–10 elementos
Opción 4 · 25 minutos → ~3.200–3.700 palabras · Formato B: 12–15 elementos
Opción 5 · Personalizado → ~130–150 palabras por minuto · Formato B: 1 elemento
cada 60–120 segundos
Son objetivos aproximados. Prioriza la narración natural sobre el conteo exacto.
No estires el guion artificialmente.
No repitas información para aumentar la extensión.
REGLAS DEL GANCHO (aplican a ambos formatos)
········································
Extensión:
• Máximo 60–80 palabras (15–25 segundos narrados), en 1 solo párrafo.`;

export const PROMPT1_LENGTH_FLOW = `Extensión según duración (diálogos y escenas en español, modo flow):
Opción 1 · 3 minutos → ~400–500 palabras (~20–25 clips de 8s) · Formato B: 3–4 elementos
Opción 2 · 8 minutos → ~1.000–1.200 palabras (~50–60 clips de 8s) · Formato B: 6–8 elementos
Opción 3 · 15 minutos → ~1.900–2.200 palabras (~100–120 clips de 8s) · Formato B: 8–10 elementos
Opción 4 · 25 minutos → ~3.200–3.700 palabras (~160–190 clips de 8s) · Formato B: 12–15 elementos
Opción 5 · Personalizado → ~130–150 palabras por minuto · Formato B: 1 elemento
cada 60–120 segundos
Son objetivos aproximados. Prioriza diálogos directos y naturales en clips cortos (cada réplica debe caber en un clip de 8 segundos).
No estires el guion artificialmente.
No repitas información para aumentar la extensión.
REGLAS DEL GANCHO (aplican a ambos formatos)
········································
Extensión:
• Máximo 60–80 palabras (15–25 segundos), en diálogo rápido o réplicas de impacto.`;

export const PROMPT1_FORMAT_TARGET = `Formato de salida de la ETAPA 3:
[TÍTULO DE LA IDEA SELECCIONADA]
Formato: [Narrativo | Lista]
Duración: [DURACIÓN]
GANCHO
[1 solo párrafo de 60–80 palabras en Formato A, o 40–60 palabras en Formato B]
DESARROLLO
[Texto del desarrollo en prosa, incluidos el CTA y el cierre]
Reglas de formato del guion:
• Escribe en párrafos de prosa limpia, lista para copiar en un flujo de voz en
off.
• No escribas cada oración en una línea separada.
• No uses marcas de tiempo (0:01, 0:02…).
• No uses subtítulos dentro del guion además de GANCHO y DESARROLLO.
• En FORMATO B, el nombre de cada elemento va como frase corta al inicio de su
párrafo, dentro de la narración.
• Usa párrafos muy cortos solo para énfasis dramático.
• No expliques tu proceso. No muestres el análisis interno.`;

export const PROMPT1_FORMAT_FLOW = `Formato de salida de la ETAPA 3 (Modo Flow — Diálogos):
[TÍTULO DE LA IDEA SELECCIONADA]
Formato: [Narrativo | Lista]
Duración: [DURACIÓN]
GANCHO
[Escenas cortas del gancho con réplicas de diálogo en formato NOMBRE: «línea»]
DESARROLLO
[Escenas cortas numeradas o secuenciales con réplicas de diálogo en formato NOMBRE: «línea», incluidos el CTA y el cierre]
Reglas de formato del guion (Modo Flow):
• Organiza el guion en escenas cortas donde los personajes hablan directamente sus líneas.
• Formato obligatorio de diálogo: NOMBRE: «línea de diálogo en español».
• Cada línea de diálogo debe ser concisa y caber con comodidad en un clip animado de 8 segundos (máximo 15–20 palabras por réplica).
• Sin narrador o con intervenciones mínimas de contexto entre escenas solo si es estrictamente necesario.
• No uses marcas de tiempo (0:01, 0:02…).
• No uses subtítulos dentro del guion además de GANCHO y DESARROLLO.
• En FORMATO B, cada elemento es presentado o comentado mediante diálogos directos entre personajes.
• No expliques tu proceso. No muestres el análisis interno.`;

export const PROMPT1_QC_TARGET = '• ¿Está en prosa, dividido solo en GANCHO y DESARROLLO?';
export const PROMPT1_QC_FLOW =
  '• ¿Está estructurado en escenas con diálogos NOMBRE: «línea» divididos en GANCHO y DESARROLLO?';

// ---------------------------------------------------------------------------
// Targets & Replacements for Prompt 2
// ---------------------------------------------------------------------------

export const PROMPT2_SECTION_F_TARGET = `* Si no: 1 imagen por cada frase corta o línea del guion, aprox. cada 3 segundos
de narración (máximo 8–10 palabras por imagen).`;
export const PROMPT2_SECTION_F_FLOW =
  '* Si no: 1 imagen por cada frase corta o línea del guion, aprox. cada 3 a 5 segundos (máximo 8–10 palabras por imagen).';

export const PROMPT2_SECTION_H_TARGET = `* Los personajes nunca hablan: la narración es la voz en off. Se expresan solo con
gestos, posturas, cejas y expresiones de la cara (sonreír, sorprenderse,
preocuparse). La boca no se mueve como si hablara ni hay sincronía labial; sin
diálogos, voces ni bocadillos. La acción principal nunca es hablar, explicar,
gritar, susurrar ni cantar.`;

export const PROMPT2_SECTION_H_FLOW =
  '* Los personajes hablan en pantalla (Modo Flow): los personajes pronuncian el diálogo del guion para esa escena en español con sincronía labial natural (natural lip-sync). En el prompt de animación incluye la indicación de habla, por ejemplo: [NOMBRE] says in Spanish: "[LÍNEA]". Se expresan tanto con sus palabras como con gestos corporales y expresiones faciales acordes a la emoción. Sin subtítulos ni bocadillos de texto en pantalla; sin música de fondo añadida por la animación a menos que la escena lo requiera.';

export const PROMPT2_PLANTILLA3_TARGET = `The characters never speak: they act only through natural body gestures,
posture, eyebrows and facial expressions; their mouths never move as if talking,
with no lip-sync, no dialogue, no voices and no speech bubbles. Keep all existing
text exactly as it is, readable and unchanged; do not add new text. No new`;

export const PROMPT2_PLANTILLA3_FLOW = `The characters speak their dialogue lines from the script in Spanish with natural lip-sync: [NOMBRE] says in Spanish: "[LINEA]". They act naturally through expressive body gestures, posture, eyebrows and facial expressions matching the emotion. No subtitles, no on-screen text captions, no speech bubbles, and no background music unless the scene specifically calls for it. Keep all existing
text exactly as it is, readable and unchanged; do not add new text. No new`;

// Only the style-independent tail is targeted: styles rewrite the example before this step runs
export const PROMPT2_ACCION_TARGET = `siempre un gesto o
movimiento, nunca hablar. Explicaciones: cómo`;

export const PROMPT2_ACCION_FLOW = `combinado con lo que dice
en español con natural lip-sync (añade \`and says in Spanish: "[LINEA]"\`). Explicaciones: cómo`;

// ---------------------------------------------------------------------------
// Targets & Replacements for videoTypes blocks
// ---------------------------------------------------------------------------

export const STORY_PROMPT1_NARRATION_TARGET =
  '• Narración y ritmo: relato en off guiado por una voz narradora, con giros emocionales y ritmo cinematográfico en lugar de explicaciones didácticas o documentales.';
export const STORY_PROMPT1_NARRATION_FLOW =
  '• Diálogos y ritmo (Modo Flow): relato guiado por diálogos directos entre personajes en pantalla, con giros emocionales y ritmo cinematográfico en lugar de explicaciones didácticas o documentales.';

export const STORY_PROMPT1_DIALOGUE_TARGET =
  '• Líneas de diálogo: cuando los personajes en pantalla hablen, intégralo dentro de la narración o identifícalo claramente con el formato «[NOMBRE]: texto» para asignarles voz en off más adelante.';
export const STORY_PROMPT1_DIALOGUE_FLOW =
  '• Líneas de diálogo (Modo Flow): asigna a cada personaje sus réplicas directas en formato «[NOMBRE]: texto», redactadas en español y dimensionadas para clips de 8 segundos.';

export const STORY_PROMPT2_ANIMATION_TARGET =
  '* Animación sin voces: en los prompts de animación, solicita explícitamente que NO haya diálogo hablado ni sincronía labial en los clips generados (no spoken dialogue, no lip-sync, mouth closed or natural subtle breathing). Los personajes pueden gesticular, pero jamás hablar para evitar que la IA invente voces.';
export const STORY_PROMPT2_ANIMATION_FLOW =
  '* Animación con diálogo (Modo Flow): en los prompts de animación, incluye el diálogo que dice el personaje en esa escena con sincronía labial natural (ej. NAME says in Spanish: "...", with natural lip-sync). Sin subtítulos ni bocadillos en pantalla.';

export const LIST_PROMPT1_HOST_TARGET =
  '• Sin personaje presentador: no se requiere un personaje presentador en pantalla ni arcos dramáticos personales. La narración se centra directamente en los objetos, lugares, criaturas o eventos listados.';
export const LIST_PROMPT1_HOST_FLOW =
  '• Presentación directa (Modo Flow): no se requiere un personaje presentador continuo en pantalla ni arcos dramáticos personales. El guion presenta los elementos mediante escenas concisas centradas en los objetos, lugares, criaturas o eventos listados.';

export const LIST_PROMPT1_DIALOGUE_TARGET =
  '• Líneas de diálogo o citas: si se cita una frase o testimonio dentro del puesto, intégralo en la narración o identifícalo como «[NOMBRE]: texto».';
export const LIST_PROMPT1_DIALOGUE_FLOW =
  '• Líneas de diálogo o citas (Modo Flow): si se cita una frase o testimonio dentro del puesto, identifícalo en formato «[NOMBRE]: texto» para que el personaje o testigo lo exprese en su clip.';

export const LIST_PROMPT2_ANIMATION_TARGET =
  '* Animación sin diálogo: en los prompts de animación, pide expresamente que no haya diálogo hablado ni movimiento labial (no spoken dialogue, no lip-sync). La animación se enfoca en movimiento de cámara suave, efectos ambientales y movimiento del objeto o lugar.';
export const LIST_PROMPT2_ANIMATION_FLOW =
  '* Animación en Modo Flow: la animación se enfoca en movimiento de cámara suave, efectos ambientales y movimiento del objeto o lugar. Si un personaje o testigo interviene en la escena, incluye su frase con sincronía labial natural (ej. NAME says in Spanish: "...").';

export const HORROR_PROMPT1_VOICE_TARGET =
  '• Voz y narración: relato inmersivo contado por una voz narradora que sumerge al oyente en una atmósfera inquietante. El narrador no necesita aparecer como personaje en la historia.';
export const HORROR_PROMPT1_VOICE_FLOW =
  '• Voces y atmósfera (Modo Flow): relato inmersivo donde los personajes, testigos o entidades hablan sus líneas en escenas de alta tensión, sumergiendo al espectador en una atmósfera inquietante.';

export const HORROR_PROMPT1_DIALOGUE_TARGET =
  '• Líneas de diálogo: cuando aparezcan palabras pronunciadas por entidades o testigos, redáctalas como narración o márcalas claramente como «[NOMBRE]: texto».';
export const HORROR_PROMPT1_DIALOGUE_FLOW =
  '• Líneas de diálogo (Modo Flow): cuando aparezcan palabras pronunciadas por personajes, entidades o testigos, márcalas claramente como «[NOMBRE]: texto» para que las pronuncien en pantalla.';

export const HORROR_PROMPT2_ANIMATION_TARGET =
  '* Animación sin voces: en los prompts de animación, solicita explícitamente cámara lenta, parpadeo de luces, niebla que se desplaza y cero diálogo hablado ni movimiento labial (no spoken dialogue, no lip-sync).';
export const HORROR_PROMPT2_ANIMATION_FLOW =
  '* Animación con diálogo (Modo Flow): en los prompts de animación, solicita cámara lenta, parpadeo de luces, niebla que se desplaza y sincronía labial natural cuando un personaje o entidad hable sus líneas en español (ej. NAME says in Spanish: "...").';

export const FLOW_REPLACEMENTS = [
  // Prompt 1 common
  [PROMPT1_LINE4_TARGET, PROMPT1_LINE4_FLOW],
  [PROMPT1_LENGTH_TARGET, PROMPT1_LENGTH_FLOW],
  [PROMPT1_FORMAT_TARGET, PROMPT1_FORMAT_FLOW],
  [PROMPT1_QC_TARGET, PROMPT1_QC_FLOW],

  // Prompt 2 common
  [PROMPT2_SECTION_F_TARGET, PROMPT2_SECTION_F_FLOW],
  [PROMPT2_SECTION_H_TARGET, PROMPT2_SECTION_H_FLOW],
  [PROMPT2_PLANTILLA3_TARGET, PROMPT2_PLANTILLA3_FLOW],
  [PROMPT2_ACCION_TARGET, PROMPT2_ACCION_FLOW],

  // Video types (Story)
  [STORY_PROMPT1_NARRATION_TARGET, STORY_PROMPT1_NARRATION_FLOW],
  [STORY_PROMPT1_DIALOGUE_TARGET, STORY_PROMPT1_DIALOGUE_FLOW],
  [STORY_PROMPT2_ANIMATION_TARGET, STORY_PROMPT2_ANIMATION_FLOW],

  // Video types (List)
  [LIST_PROMPT1_HOST_TARGET, LIST_PROMPT1_HOST_FLOW],
  [LIST_PROMPT1_DIALOGUE_TARGET, LIST_PROMPT1_DIALOGUE_FLOW],
  [LIST_PROMPT2_ANIMATION_TARGET, LIST_PROMPT2_ANIMATION_FLOW],

  // Video types (Horror)
  [HORROR_PROMPT1_VOICE_TARGET, HORROR_PROMPT1_VOICE_FLOW],
  [HORROR_PROMPT1_DIALOGUE_TARGET, HORROR_PROMPT1_DIALOGUE_FLOW],
  [HORROR_PROMPT2_ANIMATION_TARGET, HORROR_PROMPT2_ANIMATION_FLOW],
];

function replaceSubstring(text, from, to) {
  if (typeof text !== 'string') return '';
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

export function applyVoiceMode(text, { presetId, voiceMode } = {}) {
  if (typeof text !== 'string') return '';
  const resolved = getVoiceMode(voiceMode);
  if (resolved !== 'flow') {
    return text;
  }

  let result = text;
  for (const [from, to] of FLOW_REPLACEMENTS) {
    result = replaceSubstring(result, from, to);
  }

  return result;
}
