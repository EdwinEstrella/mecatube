// Pure pipeline-stage derivation for the Timeline. No DOM, no React.
// Detection markers come from the output formats of src/prompts/prompt-1.txt (script chat)
// and src/prompts/prompt-2.txt (illustrator chat); they are matched on normalized lines, so
// case, accents and Markdown emphasis do not matter.
import { parseIdeas } from '../chat/parseIdeas.js';
import { chosenIdeaNumber } from '../chat/chosenIdea.js';

// `auto` stages can be detected from a chat; the others are only ever set by hand
export const STAGES = [
  { key: 'idea', label: 'Idea', auto: true },
  { key: 'script', label: 'Guion', auto: true },
  { key: 'metadata', label: 'Metadatos', auto: true },
  // Not chat-detected; it turns done by itself when a narration track exists (hasVoice)
  { key: 'voice', label: 'Voz en off', auto: false },
  { key: 'characters', label: 'Personajes', auto: true },
  { key: 'images', label: 'Imágenes', auto: true },
  { key: 'animations', label: 'Animaciones', auto: true },
  { key: 'thumbnail', label: 'Miniatura', auto: true },
  { key: 'editing', label: 'Edición', auto: false },
  { key: 'published', label: 'Publicado', auto: false },
];

export const STAGE_KEYS = STAGES.map((stage) => stage.key);

// Lowercase, no accents, no Markdown emphasis / heading / quote / bullet markers, single spaces
export function normalizeLine(line) {
  return line
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+•]\s+)+/, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toLines(content) {
  if (typeof content !== 'string') return [];
  return content.replace(/\r\n?/g, '\n').split('\n').map(normalizeLine).filter(Boolean);
}

const test = (lines, pattern) => lines.some((line) => pattern.test(line));

// Messages as { index, role, lines }; lines are only computed for assistant messages
function prepare(messages) {
  return (Array.isArray(messages) ? messages : []).map((message, index) => ({
    index,
    role: message?.role,
    content: message?.content,
    lines: message?.role === 'assistant' ? toLines(message.content) : [],
  }));
}

// The idea the user picked in a script chat: the latest ideas message answered with a bare number
export function findChosenIdea(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index]?.role !== 'assistant') continue;
    const number = chosenIdeaNumber(list, index);
    if (number === null) continue;
    const parsed = parseIdeas(list[index].content);
    const idea = parsed?.ideas.find((item) => item.number === number);
    if (idea) return { number, title: idea.title, index };
  }
  return null;
}

// --- Prompt 1 markers --------------------------------------------------------------------
// ETAPA 3 output format (prompt-1.txt L378-385): standalone "GANCHO" then "DESARROLLO" lines
function isScript(lines) {
  const hook = lines.findIndex((line) => /^gancho:?$/.test(line));
  return hook !== -1 && lines.some((line, i) => i > hook && /^desarrollo:?$/.test(line));
}

// True when one message's text has the ETAPA 3 script layout (used to find the script to narrate)
export function isScriptMessage(content) {
  return isScript(toLines(content));
}

// ETAPA 4 output format (prompt-1.txt L456-467): "METADATOS DE PUBLICACION", or the
// "1. TITULOS" and "4. ETIQUETAS" section headings together, or platform blocks (Shorts/TikTok/Reels)
export function isMetadata(lines) {
  if (test(lines, /^(?:\d+[.)] ?)?metadatos de publicacion:?$/)) return true;
  if (test(lines, /youtube shorts/i) && (test(lines, /tiktok/i) || test(lines, /instagram reels/i))) return true;
  return (
    test(lines, /^(?:\d+[.)] ?)?titulos:?(?: \(.*\))?$/) && test(lines, /^(?:\d+[.)] ?)?etiquetas:?(?: \(.*\))?$/)
  );
}

function detectScriptChat(messages) {
  const prepared = prepare(messages);
  const idea = findChosenIdea(messages);
  const after = prepared.filter((message) => message.role === 'assistant' && message.index > (idea ? idea.index + 1 : -1));
  const metadata = after.some((message) => isMetadata(message.lines));
  const script = metadata || after.some((message) => isScript(message.lines));
  return { idea: script || idea !== null, script, metadata };
}

// --- Prompt 2 markers --------------------------------------------------------------------
// ETAPA 3 block heading (prompt-2.txt L374): "Bloque N de M — Imagenes X a Y"
const IMAGE_BLOCK = /^bloque \d+ de \d+ ?[-–—] ?imagenes?\b/;
// ETAPA 4 block heading (prompt-2.txt L430): "Bloque N de M — Animaciones X a Y"
const ANIMATION_BLOCK = /^bloque \d+ de \d+ ?[-–—] ?animaciones?\b/;
// Last-image-block question (L394) and last-animation-block question (L449)
const TO_ANIMATIONS_QUESTION = /paso a los prompts de animacion/;
const TO_THUMBNAIL_QUESTION = /paso a la miniatura/;
// ETAPA 5 (L474, L478): "Miniatura · Name (hoja N)" heading and the closing line
const THUMBNAIL_HEADING = /^miniatura ?[·•]/;
const END_OF_DELIVERY = /^fin de la entrega\b/;
// ETAPA 2 (L333): sheets approval question
const SHEETS_QUESTION = /las hojas de personaje estan bien/;

const isBareOne = (message) => message?.role === 'user' && typeof message.content === 'string' && message.content.trim() === '1';

function detectIllustratorChat(messages, charactersApproved = false) {
  const prepared = prepare(messages);
  const assistants = prepared.filter((message) => message.role === 'assistant');
  const any = (pattern) => assistants.some((message) => test(message.lines, pattern));

  const thumbnail = any(END_OF_DELIVERY) || any(THUMBNAIL_HEADING);
  const animationsStarted = any(ANIMATION_BLOCK);
  const animations = thumbnail || any(TO_THUMBNAIL_QUESTION);
  const images = animations || animationsStarted || any(TO_ANIMATIONS_QUESTION);
  const imagesStarted = images || any(IMAGE_BLOCK);
  // Approval is Stage 3 starting, or the user answering "1" to the sheets question
  const approvedByAnswer = assistants.some(
    (message) => test(message.lines, SHEETS_QUESTION) && isBareOne(messages[message.index + 1]),
  );
  // Also done when every character has a Flow image selected and approved in Mecatube
  const characters = imagesStarted || approvedByAnswer || charactersApproved;
  return { characters, images, animations, thumbnail };
}

// Auto-detected done flags for every stage; stages without a linked chat are all false
export function detectAuto(scriptMessages, illustratorMessages, hasVoice = false, charactersApproved = false) {
  return {
    voice: hasVoice === true,
    editing: false,
    published: false,
    ...detectScriptChat(scriptMessages),
    ...detectIllustratorChat(illustratorMessages, charactersApproved === true),
  };
}

// video.overrides[key] = true | false wins over detection; anything else means "auto".
// 'current' is the first stage that is not done. hasVoice marks the voice stage done when a
// narration track exists for the video.
export function branchHasCharacters(branch) {
  if (!branch) return false;
  if (Array.isArray(branch.characters) && branch.characters.length > 0) return true;
  if (branch.characterMode === 'own' && Array.isArray(branch.characterImages) && branch.characterImages.length > 0) {
    return true;
  }
  return false;
}

export function deriveStages(
  video,
  scriptMessages,
  illustratorMessages,
  { hasVoice = false, charactersApproved = false, videoType = null, branch = null } = {}
) {
  const resolvedBranch = branch ?? video?.branch ?? null;
  const resolvedVideoType = videoType ?? resolvedBranch?.videoType ?? video?.videoType ?? 'explainer';
  const auto = detectAuto(scriptMessages, illustratorMessages, hasVoice, charactersApproved);
  const overrides = video?.overrides && typeof video.overrides === 'object' ? video.overrides : {};
  const hasBranchChars = branchHasCharacters(resolvedBranch);
  const hasBrief = Boolean(video?.brief && typeof video.brief === 'string' && video.brief.trim());

  let currentAssigned = false;
  return STAGES.map(({ key, label, auto: isAuto }) => {
    const overridden = typeof overrides[key] === 'boolean';
    const isCharactersSkipped = key === 'characters' && resolvedVideoType === 'list';

    if (isCharactersSkipped && !overridden) {
      return {
        key,
        label,
        status: 'not-needed',
        notNeeded: true,
        source: 'auto',
        overridden: false,
      };
    }

    const isBranchCharactersDone = key === 'characters' && hasBranchChars;
    const isBriefDone = key === 'idea' && hasBrief;
    const isAutoDone = auto[key] === true || isBranchCharactersDone || isBriefDone;
    const done = overridden ? overrides[key] : isAutoDone;
    let status = 'pending';
    if (done) {
      status = 'done';
    } else if (!currentAssigned) {
      status = 'current';
      currentAssigned = true;
    }
    const detected = !overridden && isAutoDone;
    return {
      key,
      label,
      status,
      source: overridden || (!isAuto && !detected) ? 'manual' : 'auto',
      overridden,
      notNeeded: false,
    };
  });
}

export function countDone(stages) {
  return stages.filter((stage) => stage.status === 'done' || stage.status === 'not-needed').length;
}

export function isPublished(stages) {
  return stages.find((stage) => stage.key === 'published')?.status === 'done';
}
