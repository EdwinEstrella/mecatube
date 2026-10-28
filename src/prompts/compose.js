// Pure composition pipeline for system prompts.
// Chains: applyStyle (prompt-2 only) -> applyOrientation -> applyVideoType

import { applyStyle } from './styles.js';
import { applyOrientation } from './orientation.js';
import { applyVideoType } from './videoTypes.js';
import { applyVoiceMode, DEFAULT_VOICE_MODE } from './voiceMode.js';
import { imageCountFor } from '../flow/imageBudget.js';

export function composePrompt(
  text,
  {
    presetId,
    style,
    orientation = 'horizontal',
    videoType = 'explainer',
    branchCharacters = null,
    brief = null,
    voiceMode = DEFAULT_VOICE_MODE,
    script = null,
  } = {}
) {
  if (typeof text !== 'string') return '';

  let result = text;

  // 1. Visual style (only applies to prompt-2 illustrator prompt)
  if (presetId === 'prompt-2') {
    result = applyStyle(result, style);
  }

  // 2. Aspect ratio / orientation adaptation (horizontal vs vertical)
  result = applyOrientation(result, orientation);

  // 3. Video type adaptation
  result = applyVideoType(result, presetId, videoType);

  // 4. Voice mode adaptation (voiceover vs flow)
  result = applyVoiceMode(result, { presetId, voiceMode });

  // 5. Branch characters adaptation (only for prompt-2 when branch characters exist)
  if (presetId === 'prompt-2' && Array.isArray(branchCharacters) && branchCharacters.length > 0) {
    const list = branchCharacters
      .map((char, index) => {
        const name = char.name && char.name.trim() ? char.name.trim() : `Personaje ${index + 1}`;
        const desc =
          char.description && char.description.trim() ? char.description.trim() : 'ver imagen de referencia';
        return `- ${name}: ${desc}`;
      })
      .join('\n');

    const block = [
      '=== PERSONAJES YA DEFINIDOS ===',
      'Esta rama ya tiene los siguientes personajes definidos y aprobados:',
      list,
      '',
      'INSTRUCCIONES PARA ETAPA 2 Y SIGUIENTES:',
      '1. Omite la creación de nuevas hojas de personaje en la ETAPA 2. Responde en la ETAPA 2 indicando que los personajes ya están definidos utilizando exactamente estos mismos nombres.',
      '2. Utiliza obligatoriamente y de forma exacta estos nombres y descripciones en todos los prompts de escenas y animaciones (ETAPAS 3, 4 y 5) para mantener la coherencia con las imágenes de referencia aprobadas.',
      '================================',
    ].join('\n');

    result = `${result.trim()}\n\n${block}\n`;
  }

  // 6. Brief injection (only for prompt-1 when a video brief is provided)
  if (presetId === 'prompt-1' && typeof brief === 'string' && brief.trim().length > 0) {
    const block = [
      '=== CONTEXTO DE ESTE VIDEO ===',
      brief.trim(),
      '',
      'INSTRUCCIONES:',
      'Este video ya tiene su tema y enfoque definidos en el contexto anterior.',
      'Omite la ETAPA 1 (no propongas nuevas ideas ni pidas al usuario elegir una).',
      'Trata este contexto como la idea seleccionada y redacta directamente el guion completo siguiendo la estructura y el formato de salida requerido (incluyendo título, Formato, Duración, GANCHO y DESARROLLO).',
      '==============================',
    ].join('\n');

    result = `${result.trim()}\n\n${block}\n`;
  }

  // 7. Script injection (only for prompt-2 when a video script is provided)
  if (presetId === 'prompt-2' && typeof script === 'string' && script.trim().length > 0) {
    const trimmedScript = script.trim();
    const count = imageCountFor(trimmedScript);
    const block = [
      '=== GUION DEL VIDEO ===',
      'Ya tienes el guion completo a continuación: omite la ETAPA 1 (no pidas el guion) y empieza directamente por la ETAPA 2.',
      '',
      trimmedScript,
      '',
      `[CANTIDAD_IMAGENES]: ${count}`,
    ].join('\n');

    result = `${result.trim()}\n\n${block}\n`;
  }

  return result;
}
