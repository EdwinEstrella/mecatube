// Pure prompt transformations for branch video types:
// 'explainer' (default/verbatim) | 'story' | 'list' | 'horror'

export const VIDEO_TYPES = ['explainer', 'story', 'list', 'horror'];
export const DEFAULT_VIDEO_TYPE = 'explainer';

export function getVideoType(type) {
  return VIDEO_TYPES.includes(type) ? type : DEFAULT_VIDEO_TYPE;
}

export const PROMPT1_MODO_BLOCKS = {
  story: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO DE VIDEO: HISTORIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este video sigue un formato narrativo de historia o relato de ficción:
• Estructura dramática: planteamiento inicial, detonante con conflicto progresivo, clímax de máxima tensión y desenlace.
• Narración y ritmo: relato en off guiado por una voz narradora, con giros emocionales y ritmo cinematográfico en lugar de explicaciones didácticas o documentales.
• Personajes consistentes: la trama involucra personajes recurrentes que se mantienen a lo largo de las escenas.
• Continuidad de escenas: asegura coherencia visual y espacial entre escenas (mismos escenarios, misma época y mismos personajes).
• Líneas de diálogo: cuando los personajes en pantalla hablen, intégralo dentro de la narración o identifícalo claramente con el formato «[NOMBRE]: texto» para asignarles voz en off más adelante.`,

  list: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO DE VIDEO: TOP / LISTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este video sigue un formato de conteo, ranking o lista (Top N de N a 1):
• Estructura de cuenta regresiva: organiza el contenido en cuenta regresiva desde el puesto más alto hasta el número 1.
• Cada puesto o elemento debe contar con: una idea de tarjeta de título, datos clave concretos, impacto y una transición fluida hacia el siguiente elemento.
• Sin personaje presentador: no se requiere un personaje presentador en pantalla ni arcos dramáticos personales. La narración se centra directamente en los objetos, lugares, criaturas o eventos listados.
• Ritmo y retención: cada elemento funciona como un nuevo gancho que renueva la curiosidad del espectador.
• Líneas de diálogo o citas: si se cita una frase o testimonio dentro del puesto, intégralo en la narración o identifícalo como «[NOMBRE]: texto».`,

  horror: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO DE VIDEO: TERROR / MISTERIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este video sigue un formato de terror, misterio y suspenso:
• Voz y narración: relato inmersivo contado por una voz narradora que sumerge al oyente en una atmósfera inquietante. El narrador no necesita aparecer como personaje en la historia.
• Tensión progresiva: construcción lenta del suspenso (slow-burn suspense), atmósfera densa, detalles psicológicos y pausas tensas.
• Ritmo y ganchos: utiliza ganchos constantes, cliffhangers al final de secuencias y giros inesperados para maximizar la retención.
• Tono: misterio sugerido y horror psicológico, sin recurrir a gore innecesario ni violencia gráfica explícita.
• Líneas de diálogo: cuando aparezcan palabras pronunciadas por entidades o testigos, redáctalas como narración o márcalas claramente como «[NOMBRE]: texto».`,
};

export const PROMPT2_MODO_BLOCKS = {
  story: `---
### MODO DE VIDEO: HISTORIA
Este proyecto sigue un formato narrativo de historia:
* Personajes recurrentes: crea y entrega en la etapa de diseño de personajes una hoja de personaje para cada personaje recurrente de la trama (hasta 3 personajes principales con sus variantes).
* Escenarios recurrentes: define con precisión y describe las ubicaciones recurrentes (habitaciones, casas, calles o paisajes clave) una vez y reutiliza su descripción visual en inglés palabra por palabra en los detalles del escenario de las escenas para asegurar continuidad total.
* Continuidad visual: los personajes y escenarios deben mantener exactamente la misma apariencia, paleta de colores, vestimenta y atmósfera a lo largo de toda la historia.
* Enfoque emocional: prioriza la emoción, tensión dramática y cinematografía sobre infografías explicativas (la gran mayoría o totalidad de imágenes serán de tipo escena).
* Animación sin voces: en los prompts de animación, solicita explícitamente que NO haya diálogo hablado ni sincronía labial en los clips generados (no spoken dialogue, no lip-sync, mouth closed or natural subtle breathing). Los personajes pueden gesticular, pero jamás hablar para evitar que la IA invente voces.`,

  list: `---
### MODO DE VIDEO: TOP / LISTA
Este proyecto sigue un formato de top, lista o conteo:
* Sin hojas de personaje: no se requieren personajes principales en pantalla. En la etapa de personajes responde con el formato previsto indicando que no hay personajes principales y formulando la pregunta de confirmación habitual para avanzar al primer grupo de imágenes.
* Enfoque en objetos y lugares: cada escena se centra en el objeto, lugar, caso o elemento correspondiente a ese número del ranking, con encuadres limpios y cinematográficos.
* Consistencia y motivo visual recurrente: mantén un estilo coherente en encuadre, iluminación y atmósfera entre todos los elementos de la lista. Deja despejada la zona del distintivo de número para que el editor coloque el badge o texto del puesto (no coloques texto del número dentro de las imágenes).
* Sin texto incrustado: no generes texto gráfico ni números dentro de las imágenes para evitar artefactos visuales.
* Animación sin diálogo: en los prompts de animación, pide expresamente que no haya diálogo hablado ni movimiento labial (no spoken dialogue, no lip-sync). La animación se enfoca en movimiento de cámara suave, efectos ambientales y movimiento del objeto o lugar.`,

  horror: `---
### MODO DE VIDEO: TERROR / MISTERIO
Este proyecto sigue un formato de terror y misterio:
* Atmósfera e iluminación: iluminación oscura, claroscuro dramático, sombras envolventes, niebla, paleta de colores desaturada y fría, y contrastes de luz tenue (luz de velas, linterna, luna).
* Sin gore: nada de violencia gráfica, sangre explícita ni gore. El terror se transmite por aislamiento, tensión, sombras ominosas, siluetas lejanas y detalles perturbadores sutiles.
* Ubicaciones recurrentes consistentes: los lugares clave (la casa, los pasillos, las habitaciones, el bosque) se describen con exactitud una vez y se reutilizan palabra por palabra en la descripción del escenario para dar coherencia arquitectónica y espacial a la pesadilla.
* Personajes y figuras: el narrador no necesita aparecer en imagen. Cualquier figura recurrente o espectro mantiene siempre la misma descripción visual, vestuario y silueta reconocible.
* Animación sin voces: en los prompts de animación, solicita explícitamente cámara lenta, parpadeo de luces, niebla que se desplaza y cero diálogo hablado ni movimiento labial (no spoken dialogue, no lip-sync).`,
};

// Exact replacements to adjust sentences that would directly contradict the specific video type
const VIDEO_TYPE_REPLACEMENTS = {
  'prompt-1': {
    list: [
      [
        '• El personaje principal aparece en 1–2 paneles interactuando con el elemento.',
        '• Cada panel ilustra el elemento o lugar sin necesidad de personaje presentador.',
      ],
    ],
  },
  'prompt-2': {
    story: [
      [
        `* **Imágenes de escena (85 %) — ilustran lo que cuenta el guion en ese
momento.
* **Imágenes de explicación (15 %) — diagramas educativos sobre fondo blanco
con título, flechas, símbolos y etiquetas.`,
        `* **Imágenes de escena (100 %) — ilustran la trama y acciones de los personajes en ese momento dramático.`,
      ],
    ],
    list: [
      [
        `1. Crear la hoja de personaje (character sheet) de cada personaje principal y
confirmarla con el usuario.`,
        `1. Confirmar en la etapa de personajes que este video de tipo lista no requiere hojas de personaje.`,
      ],
      [
        `* Máximo 3 personajes principales en primer plano por imagen. Se permiten
personajes pequeños de fondo.`,
        `* Enfoque en objetos, lugares o conceptos según el número de la lista. No se requiere personaje principal.`,
      ],
    ],
    horror: [
      [
        `* Tono educativo y claro. Sin sangre ni violencia gráfica: las heridas se muestran
con vendajes; el peligro se sugiere con siluetas, sombras o lejanía; un animal
cazado o muerto se muestra tendido, sin heridas.`,
        `* Tono de misterio y suspenso oscuro. Sin sangre ni violencia gráfica explícita: el peligro se sugiere con sombras envolventes, siluetas lejanas, iluminación tenue y atmósfera tensa.`,
      ],
    ],
  },
};

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

function insertPrompt1Block(text, block) {
  const isCrlf = text.includes('\r\n');
  const newline = isCrlf ? '\r\n' : '\n';
  const target = isCrlf
    ? 'OBJETIVO\r\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    : 'OBJETIVO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const normalizedBlock = isCrlf
    ? block.replace(/(?<!\r)\n/g, '\r\n')
    : block.replace(/\r\n/g, '\n');

  if (text.includes(target)) {
    return text.replace(target, `${normalizedBlock}${newline}${newline}${target}`);
  }
  const altTarget = isCrlf ? 'OBJETIVO\r\n' : 'OBJETIVO\n';
  if (text.includes(altTarget)) {
    return text.replace(altTarget, `${normalizedBlock}${newline}${newline}${altTarget}`);
  }
  return `${normalizedBlock}${newline}${newline}${text}`;
}

function insertPrompt2Block(text, block) {
  const isCrlf = text.includes('\r\n');
  const newline = isCrlf ? '\r\n' : '\n';
  const target = isCrlf ? '---\r\n### OBJETIVO' : '---\n### OBJETIVO';
  const normalizedBlock = isCrlf
    ? block.replace(/(?<!\r)\n/g, '\r\n')
    : block.replace(/\r\n/g, '\n');

  if (text.includes(target)) {
    return text.replace(target, `${normalizedBlock}${newline}${newline}${target}`);
  }
  const altTarget = isCrlf ? '### OBJETIVO\r\n' : '### OBJETIVO\n';
  if (text.includes(altTarget)) {
    return text.replace(altTarget, `${normalizedBlock}${newline}${newline}${altTarget}`);
  }
  return `${normalizedBlock}${newline}${newline}${text}`;
}

export function applyVideoType(text, presetId, videoType) {
  if (typeof text !== 'string') return '';
  const resolved = getVideoType(videoType);
  if (resolved === 'explainer') {
    return text;
  }

  const isPrompt1 =
    presetId === 'prompt-1' || (!presetId && text.includes('formatos probados del nicho explainer'));
  const isPrompt2 =
    presetId === 'prompt-2' || (!presetId && text.includes('director de arte'));

  let result = text;

  if (isPrompt1) {
    const block = PROMPT1_MODO_BLOCKS[resolved];
    if (block) {
      result = insertPrompt1Block(result, block);
    }
    const replacements = VIDEO_TYPE_REPLACEMENTS['prompt-1']?.[resolved] || [];
    for (const [from, to] of replacements) {
      result = replaceSubstring(result, from, to);
    }
  } else if (isPrompt2) {
    const block = PROMPT2_MODO_BLOCKS[resolved];
    if (block) {
      result = insertPrompt2Block(result, block);
    }
    const replacements = VIDEO_TYPE_REPLACEMENTS['prompt-2']?.[resolved] || [];
    for (const [from, to] of replacements) {
      result = replaceSubstring(result, from, to);
    }
  } else {
    // Generic fallback for any other preset
    const block = PROMPT1_MODO_BLOCKS[resolved];
    if (block) {
      const isCrlf = text.includes('\r\n');
      const newline = isCrlf ? '\r\n' : '\n';
      const normalizedBlock = isCrlf
        ? block.replace(/(?<!\r)\n/g, '\r\n')
        : block.replace(/\r\n/g, '\n');
      result = `${normalizedBlock}${newline}${newline}${text}`;
    }
  }

  return result;
}
