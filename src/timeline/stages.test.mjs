// Run with: node src/timeline/stages.test.mjs
import assert from 'node:assert/strict';
import { STAGES, deriveStages, countDone, findChosenIdea, branchHasCharacters } from './stages.js';

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n     ${error.message}`);
  }
}

let nextId = 0;
const user = (content) => ({ id: `m${(nextId += 1)}`, role: 'user', content });
const assistant = (content) => ({ id: `m${(nextId += 1)}`, role: 'assistant', content });

const video = (overrides = {}) => ({ id: 'v1', title: 'Untitled video', overrides });
const statusOf = (stages) => Object.fromEntries(stages.map((stage) => [stage.key, stage.status]));
const doneKeys = (stages) => stages.filter((stage) => stage.status === 'done').map((stage) => stage.key);

// --- Prompt 1 fixtures (formats from prompt-1.txt) -----------------------------------------
const ideaBlock = (n, title) =>
  [
    `${n}. ${title}`,
    'Formato: Narrativo',
    `Pregunta central: ¿Qué pasó con ${title}?`,
    'Texto de miniatura: "NO LO CREERÁS"',
    'Gatillo principal: curiosidad',
  ].join('\n');
const IDEAS = `10 IDEAS DE VIDEO\n${[1, 2, 3, 4].map((n) => ideaBlock(n, `Tema ${n}`)).join('\n')}\nSelecciona una idea escribiendo su número (1–10), o escribe "más ideas" para\nrecibir 10 nuevas.`;
const DURATION = 'Idea 2: Tema 2 (Formato A).\nElige la duración del video:\n1 → 3 minutos\n2 → 8 minutos\nResponde únicamente con 1, 2, 3, 4 o 5';
const SCRIPT = [
  'Tema 2',
  'Formato: Narrativo',
  'Duración: 8 minutos',
  'GANCHO',
  'Nadie sabía qué había debajo del hielo. Hasta que alguien miró.',
  'DESARROLLO',
  'Pero eso creó otro problema. Y esto lo cambió todo.',
  'Si todo está bien, escribe "siguiente" para recibir los metadatos de publicación.',
].join('\n');
const SCRIPT_MD = SCRIPT.replace('GANCHO', '**GANCHO**').replace('DESARROLLO', '### DESARROLLO');
const METADATA = [
  'METADATOS DE PUBLICACIÓN',
  '1. TÍTULOS',
  '```',
  'Opción 1: Tema 2',
  '```',
  '2. PROMPTS DE MINIATURA',
  'Para generar la miniatura, sube la imagen de tu personaje principal.',
  '3. DESCRIPCIÓN',
  '4. ETIQUETAS',
].join('\n');
const METADATA_MD = '**METADATOS DE PUBLICACIÓN**\n\n**1. TÍTULOS**\n\n```\nOpción 1\n```\n\n**4. ETIQUETAS**\n\n```\na, b, c\n```';

const scriptChat = {
  ideasOnly: () => [user('prompt 1 …'), assistant(IDEAS)],
  chosen: () => [user('prompt 1 …'), assistant(IDEAS), user('2'), assistant(DURATION)],
  scripted: () => [...scriptChat.chosen(), user('2'), assistant(SCRIPT)],
  full: () => [...scriptChat.scripted(), user('siguiente'), assistant(METADATA)],
};

// --- Prompt 2 fixtures (formats from prompt-2.txt) -----------------------------------------
const SHEETS = [
  '**Personaje 1 — Tomás (protagonista)**',
  'Hoja 1 · Rol: el explorador.',
  '```',
  'character sheet prompt',
  '```',
  '```',
  '¿Las hojas de personaje están bien?',
  '1 → Sí, envíame el primer bloque de imágenes.',
  '2 → No, quiero cambiar algo.',
  'Responde 1 o 2.',
  '```',
].join('\n');
const IMAGE_BLOCK_1 = '**Bloque 1 de 2 — Imágenes 1 a 20**\n\n**Imagen 01 — Escena · Tomás (hoja 1)**\n```\nprompt\n```\n```\n¿Paso al siguiente bloque?\n1 → Sí, envíame el Bloque 2.\n2 → No, quiero cambiar imágenes de este bloque.\nResponde 1 o 2.\n```';
const IMAGE_BLOCK_LAST = '**Bloque 2 de 2 — Imágenes 21 a 30**\n\n**Imagen 21 — Escena · Tomás (hoja 1)**\n```\nprompt\n```\n```\n¿Paso a los prompts de animación?\n1 → Sí, envíame el Bloque 1 de animaciones.\n2 → No, quiero cambiar imágenes de este bloque.\nResponde 1 o 2.\n```';
const ANIM_BLOCK_1 = '**Bloque 1 de 2 — Animaciones 1 a 20**\n\n**Animación 01 — Escena · Tomás (hoja 1)**\n```\nprompt\n```\n```\n¿Paso al siguiente bloque de animaciones?\n1 → Sí\n2 → No\nResponde 1 o 2.\n```';
const ANIM_BLOCK_LAST = '**Bloque 2 de 2 — Animaciones 21 a 30**\n\n**Animación 21 — Escena · Tomás (hoja 1)**\n```\nprompt\n```\n```\n¿Paso a la miniatura?\n1 → Sí, envíame el prompt de la miniatura.\n2 → No, quiero cambiar animaciones de este bloque.\nResponde 1 o 2.\n```';
const THUMBNAIL = '**Miniatura · Tomás (hoja 1)**\n```\nthumbnail prompt\n```\nFin de la entrega.';

const illustrator = {
  asked: () => [user('prompt 2 …'), assistant('Envíame tu guion completo.')],
  sheets: () => [...illustrator.asked(), user(SCRIPT), assistant(SHEETS)],
  approved: () => [...illustrator.sheets(), user('1'), assistant(IMAGE_BLOCK_1)],
  images: () => [...illustrator.approved(), user('1'), assistant(IMAGE_BLOCK_LAST)],
  animStarted: () => [...illustrator.images(), user('1'), assistant(ANIM_BLOCK_1)],
  animations: () => [...illustrator.animStarted(), user('1'), assistant(ANIM_BLOCK_LAST)],
  thumbnail: () => [...illustrator.animations(), user('1'), assistant(THUMBNAIL)],
};

// --- Tests ---------------------------------------------------------------------------------
test('STAGES has the ten stages in order', () => {
  assert.deepEqual(
    STAGES.map((stage) => stage.key),
    ['idea', 'script', 'metadata', 'voice', 'characters', 'images', 'animations', 'thumbnail', 'editing', 'published'],
  );
});

test('no chats: first stage is current, nothing is done', () => {
  const stages = deriveStages(video(), null, null);
  assert.equal(stages.length, 10);
  assert.equal(stages[0].status, 'current');
  assert.equal(countDone(stages), 0);
  assert.deepEqual(stages.map((stage) => stage.source), ['auto', 'auto', 'auto', 'manual', 'auto', 'auto', 'auto', 'auto', 'manual', 'manual']);
});

test('ideas listed but none chosen: idea still current', () => {
  assert.equal(statusOf(deriveStages(video(), scriptChat.ideasOnly(), null)).idea, 'current');
});

test('findChosenIdea resolves the chosen number to the idea title', () => {
  const chosen = findChosenIdea(scriptChat.chosen());
  assert.equal(chosen.number, 2);
  assert.equal(chosen.title, 'Tema 2');
  assert.equal(findChosenIdea(scriptChat.ideasOnly()), null);
});

test('idea chosen: idea done, script current', () => {
  const stages = deriveStages(video(), scriptChat.chosen(), null);
  assert.deepEqual(doneKeys(stages), ['idea']);
  assert.equal(statusOf(stages).script, 'current');
});

test('the duration question is not a script', () => {
  assert.equal(statusOf(deriveStages(video(), scriptChat.chosen(), null)).script, 'current');
});

test('script delivered (flat text)', () => {
  const stages = deriveStages(video(), scriptChat.scripted(), null);
  assert.deepEqual(doneKeys(stages), ['idea', 'script']);
  assert.equal(statusOf(stages).metadata, 'current');
});

test('script delivered (Markdown emphasis and headings)', () => {
  const messages = [...scriptChat.chosen(), user('2'), assistant(SCRIPT_MD)];
  assert.deepEqual(doneKeys(deriveStages(video(), messages, null)), ['idea', 'script']);
});

test('GANCHO without DESARROLLO is not a script', () => {
  const messages = [...scriptChat.chosen(), user('2'), assistant('GANCHO\nUn gancho suelto.')];
  assert.deepEqual(doneKeys(deriveStages(video(), messages, null)), ['idea']);
});

test('metadata delivered (flat text and Markdown)', () => {
  assert.deepEqual(doneKeys(deriveStages(video(), scriptChat.full(), null)), ['idea', 'script', 'metadata']);
  const md = [...scriptChat.scripted(), user('siguiente'), assistant(METADATA_MD)];
  assert.deepEqual(doneKeys(deriveStages(video(), md, null)), ['idea', 'script', 'metadata']);
});

test('metadata detected by section headings without the title line', () => {
  const headings = '1. TÍTULOS\n```\nx\n```\n2. PROMPTS DE MINIATURA\n3. DESCRIPCIÓN\n4. ETIQUETAS\n```\ny\n```';
  const messages = [...scriptChat.scripted(), user('siguiente'), assistant(headings)];
  assert.equal(statusOf(deriveStages(video(), messages, null)).metadata, 'done');
});

test('the script stage in the user prompt message is ignored', () => {
  const messages = [user(SCRIPT), assistant(IDEAS), user('1')];
  assert.deepEqual(doneKeys(deriveStages(video(), messages, null)), ['idea']);
});

test('voice stays pending until a track exists or it is marked manually', () => {
  const stages = deriveStages(video(), scriptChat.full(), null);
  assert.equal(statusOf(stages).voice, 'current');
  assert.equal(stages.find((stage) => stage.key === 'voice').source, 'manual');
});

test('a voice track makes the voice stage done and auto-detected', () => {
  const stages = deriveStages(video(), scriptChat.full(), null, { hasVoice: true });
  const voice = stages.find((stage) => stage.key === 'voice');
  assert.equal(voice.status, 'done');
  assert.equal(voice.source, 'auto');
  assert.equal(voice.overridden, false);
  assert.equal(statusOf(stages).characters, 'current');
});

test('a forced "not done" override beats an existing voice track', () => {
  const stages = deriveStages(video({ voice: false }), scriptChat.full(), null, { hasVoice: true });
  const voice = stages.find((stage) => stage.key === 'voice');
  assert.equal(voice.status, 'current');
  assert.equal(voice.source, 'manual');
  assert.equal(voice.overridden, true);
});

test('a forced "done" override stays manual even with a voice track', () => {
  const voice = deriveStages(video({ voice: true }), null, null, { hasVoice: true }).find((stage) => stage.key === 'voice');
  assert.equal(voice.status, 'done');
  assert.equal(voice.source, 'manual');
});

test('hasVoice defaults to false and ignores non-boolean values', () => {
  assert.equal(statusOf(deriveStages(video(), null, null, {})).voice, 'pending');
  assert.notEqual(statusOf(deriveStages(video(), null, null, { hasVoice: 'yes' })).voice, 'done');
});

test('sheets delivered but not approved: characters current', () => {
  const stages = deriveStages(video({ voice: true }), scriptChat.full(), illustrator.sheets());
  assert.equal(statusOf(stages).characters, 'current');
});

test('sheets approved by answering 1 (before the first image block arrives)', () => {
  const messages = [...illustrator.sheets(), user('1')];
  assert.equal(statusOf(deriveStages(video(), null, messages)).characters, 'done');
});

test('sheets answered 2 are not approved', () => {
  const messages = [...illustrator.sheets(), user('2')];
  assert.notEqual(statusOf(deriveStages(video(), null, messages)).characters, 'done');
});

test('approved characters with images mark the characters stage done, even without a chat', () => {
  const stages = deriveStages(video(), null, illustrator.sheets(), { charactersApproved: true });
  const characters = stages.find((stage) => stage.key === 'characters');
  assert.equal(characters.status, 'done');
  assert.equal(characters.source, 'auto');
  assert.notEqual(statusOf(deriveStages(video(), null, illustrator.sheets(), { charactersApproved: 'yes' })).characters, 'done');
});

test('a forced "not done" override beats approved characters', () => {
  const stages = deriveStages(video({ characters: false }), null, null, { charactersApproved: true });
  assert.notEqual(statusOf(stages).characters, 'done');
});

test('branch with characters marks characters stage done', () => {
  const branch = { id: 'b1', characters: [{ key: 'char-1', name: 'Hero', file: 'hero.png', source: 'flow' }] };
  assert.equal(branchHasCharacters(branch), true);
  const stages = deriveStages(video(), null, null, { branch });
  const chars = stages.find((stage) => stage.key === 'characters');
  assert.equal(chars.status, 'done');
  assert.equal(chars.source, 'auto');
});

test('branch with characterMode own and characterImages marks characters stage done', () => {
  const branch = { id: 'b2', characterMode: 'own', characterImages: ['char.png'] };
  assert.equal(branchHasCharacters(branch), true);
  const stages = deriveStages(video(), null, null, { branch });
  assert.equal(statusOf(stages).characters, 'done');
});

test('override false beats branch characters', () => {
  const branch = { id: 'b1', characters: [{ key: 'char-1', name: 'Hero', file: 'hero.png', source: 'flow' }] };
  const stages = deriveStages(video({ characters: false }), null, null, { branch });
  assert.notEqual(statusOf(stages).characters, 'done');
  assert.equal(stages.find((stage) => stage.key === 'characters').source, 'manual');
});

test('branch with no characters does not mark characters stage done without approval', () => {
  const branch = { id: 'b1', characters: [], characterImages: [], characterMode: 'create' };
  assert.equal(branchHasCharacters(branch), false);
  const stages = deriveStages(video(), null, null, { branch });
  assert.notEqual(statusOf(stages).characters, 'done');
});

test('first image block delivered: characters done, images not yet', () => {
  const stages = deriveStages(video(), null, illustrator.approved());
  assert.equal(statusOf(stages).characters, 'done');
  assert.notEqual(statusOf(stages).images, 'done');
});

test('last image block with the animations question: images done', () => {
  const stages = deriveStages(video(), null, illustrator.images());
  assert.equal(statusOf(stages).images, 'done');
  assert.notEqual(statusOf(stages).animations, 'done');
});

test('animation blocks started implies images done', () => {
  const stages = deriveStages(video(), null, illustrator.animStarted());
  assert.equal(statusOf(stages).images, 'done');
  assert.notEqual(statusOf(stages).animations, 'done');
});

test('last animation block with the thumbnail question: animations done', () => {
  const stages = deriveStages(video(), null, illustrator.animations());
  assert.equal(statusOf(stages).animations, 'done');
  assert.notEqual(statusOf(stages).thumbnail, 'done');
});

test('thumbnail delivered ("Fin de la entrega.")', () => {
  const stages = deriveStages(video(), null, illustrator.thumbnail());
  assert.deepEqual(doneKeys(stages), ['characters', 'images', 'animations', 'thumbnail']);
});

test('older flat-text messages (no Markdown) are detected', () => {
  const messages = [
    ...illustrator.sheets(),
    user('1'),
    assistant('Bloque 2 de 2 — Imágenes 21 a 30\nImagen 21 — Escena\n¿Paso a los prompts de animación?\nResponde 1 o 2.'),
  ];
  assert.equal(statusOf(deriveStages(video(), null, messages)).images, 'done');
});

test('detection ignores case and accents', () => {
  const messages = [...scriptChat.chosen(), user('2'), assistant('**gancho**\nx\n**Desarrollo**\ny')];
  assert.equal(statusOf(deriveStages(video(), messages, null)).script, 'done');
  const lower = [...illustrator.asked(), user('x'), assistant('FIN DE LA ENTREGA.')];
  assert.equal(statusOf(deriveStages(video(), null, lower)).thumbnail, 'done');
});

test('override true forces a stage done and is marked overridden', () => {
  const stages = deriveStages(video({ voice: true }), null, null);
  assert.equal(statusOf(stages).voice, 'done');
  assert.equal(stages.find((stage) => stage.key === 'voice').overridden, true);
});

test('override false forces an auto-detected stage not done', () => {
  const stages = deriveStages(video({ script: false }), scriptChat.full(), null);
  const byKey = statusOf(stages);
  assert.equal(byKey.idea, 'done');
  assert.equal(byKey.script, 'current');
  assert.equal(byKey.metadata, 'done');
  assert.equal(stages.find((stage) => stage.key === 'script').source, 'manual');
  assert.equal(stages.find((stage) => stage.key === 'metadata').source, 'auto');
});

test('override true wins over missing chats; non-boolean overrides mean auto', () => {
  const stages = deriveStages(video({ idea: true, script: null, metadata: 'yes' }), null, null);
  assert.equal(statusOf(stages).idea, 'done');
  assert.equal(statusOf(stages).script, 'current');
  assert.equal(stages.find((stage) => stage.key === 'script').overridden, false);
});

test('current is the first not-done stage and later done stages stay done', () => {
  const stages = deriveStages(video({ published: true }), scriptChat.scripted(), null);
  assert.equal(statusOf(stages).metadata, 'current');
  assert.equal(statusOf(stages).published, 'done');
  assert.equal(stages.filter((stage) => stage.status === 'current').length, 1);
});

test('everything done: no current stage', () => {
  const overrides = Object.fromEntries(STAGES.map((stage) => [stage.key, true]));
  const stages = deriveStages(video(overrides), null, null);
  assert.equal(countDone(stages), 10);
  assert.equal(stages.some((stage) => stage.status === 'current'), false);
});

test('tolerates missing video, bad messages and non-array chats', () => {
  assert.equal(deriveStages(undefined, undefined, undefined).length, 10);
  assert.equal(deriveStages(video(), [null, { role: 'assistant' }, { role: 'assistant', content: 5 }], 'nope').length, 10);
});

test('video with brief marks idea stage done automatically', () => {
  const vidWithBrief = { id: 'v1', title: 'Video con brief', brief: 'Contexto del capítulo 1', overrides: {} };
  const stages = deriveStages(vidWithBrief, null, null);
  assert.equal(statusOf(stages).idea, 'done');
  assert.equal(statusOf(stages).script, 'current');
  assert.equal(stages.find((s) => s.key === 'idea').overridden, false);
  assert.equal(stages.find((s) => s.key === 'idea').source, 'auto');
});

test('video without brief keeps idea stage as current when no messages', () => {
  const vidNoBrief = { id: 'v1', title: 'Video sin brief', brief: '', overrides: {} };
  const stages = deriveStages(vidNoBrief, null, null);
  assert.equal(statusOf(stages).idea, 'current');
});

test('override false beats brief auto-done', () => {
  const vidOverridden = { id: 'v1', title: 'Video con brief', brief: 'Contexto', overrides: { idea: false } };
  const stages = deriveStages(vidOverridden, null, null);
  assert.equal(statusOf(stages).idea, 'current');
  assert.equal(stages.find((s) => s.key === 'idea').overridden, true);
});

test('flow video: voice stage marked not-needed automatically', () => {
  const vidFlow = { id: 'v1', title: 'Video Flow', voiceMode: 'flow', overrides: {} };
  const stages = deriveStages(vidFlow, null, null);
  const voiceStage = stages.find((s) => s.key === 'voice');
  assert.equal(voiceStage.status, 'not-needed');
  assert.equal(voiceStage.notNeeded, true);
  assert.equal(voiceStage.overridden, false);
});

test('video inheriting flow voiceMode from branch: voice stage marked not-needed', () => {
  const vidInherited = { id: 'v1', title: 'Video Default', voiceMode: null, overrides: {} };
  const branch = { id: 'b1', name: 'Rama Flow', voiceMode: 'flow' };
  const stages = deriveStages(vidInherited, null, null, { branch });
  const voiceStage = stages.find((s) => s.key === 'voice');
  assert.equal(voiceStage.status, 'not-needed');
  assert.equal(voiceStage.notNeeded, true);
});

test('flow video: manual override beats not-needed', () => {
  const vidOverridden = { id: 'v1', title: 'Video Flow', voiceMode: 'flow', overrides: { voice: true } };
  const stages = deriveStages(vidOverridden, null, null);
  const voiceStage = stages.find((s) => s.key === 'voice');
  assert.equal(voiceStage.status, 'done');
  assert.equal(voiceStage.overridden, true);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall passed');
