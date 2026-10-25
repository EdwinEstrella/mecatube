// Run with: node src/flow/parseCharacterSheets.test.mjs
import assert from 'node:assert/strict';
import { parseCharacterSheets, slugify } from './parseCharacterSheets.js';

const PROMPT_A = 'Character sheet of a caveman, white background,\nfront, side and back views,\nholding a stone-tipped spear.';
const PROMPT_B = 'Character sheet of a woman explorer, white background, all views.';
const QUESTION_BLOCK = ['```', '¿Las hojas de personaje están bien?', '1 → Sí, envíame el primer bloque de imágenes.', '2 → No, quiero cambiar algo.', 'Responde 1 o 2.', '```'].join('\n');

// Exactly the layout prompt-2.txt (ETAPA 2, "Formato de salida") asks for
const STANDARD = [
  '**Personaje 1 — Tomás (protagonista)**',
  'Hoja 1 · Rol: Cazador que descubre el fuego.',
  '```',
  PROMPT_A,
  '```',
  '**Personaje 2 — Ana**',
  'Hoja 2 · Rol: Exploradora que lo acompaña.',
  '```',
  PROMPT_B,
  '```',
  QUESTION_BLOCK,
].join('\n');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n${error.stack}`);
  }
}

test('standard Etapa 2 output', () => {
  const result = parseCharacterSheets(STANDARD);
  assert.equal(result.characters.length, 2);
  assert.deepEqual(result.characters[0], {
    key: 'personaje-1-tomas-protagonista',
    title: 'Personaje 1 — Tomás (protagonista)',
    role: 'Cazador que descubre el fuego.',
    prompt: PROMPT_A,
  });
  assert.equal(result.characters[1].key, 'personaje-2-ana');
  assert.equal(result.characters[1].prompt, PROMPT_B);
});

test('the prompt is the exact code block content (no trimming, inner blank lines kept)', () => {
  const prompt = '  indented first line\n\nsecond paragraph  ';
  const content = `**Personaje 1 — Ana**\nHoja 1 · Rol: x.\n\`\`\`\n${prompt}\n\`\`\`\n${QUESTION_BLOCK}`;
  assert.equal(parseCharacterSheets(content).characters[0].prompt, prompt);
});

test('the approval question block is never taken as a prompt', () => {
  const result = parseCharacterSheets(STANDARD);
  assert.ok(result.characters.every((item) => !item.prompt.includes('Responde 1 o 2')));
});

test('unnamed character and age variant with its sheet letter', () => {
  const content = [
    '**Personaje 1 (protagonista)**',
    'Hoja 1 · Rol: Un viajero.',
    '```',
    'young traveler sheet',
    '```',
    '**Personaje 1 — Tomás (adulto)** · Hoja 1B.',
    'Rol: El mismo viajero, ya mayor.',
    '```',
    'adult traveler sheet',
    '```',
    QUESTION_BLOCK,
  ].join('\n');
  const { characters } = parseCharacterSheets(content);
  assert.equal(characters.length, 2);
  assert.equal(characters[0].title, 'Personaje 1 (protagonista)');
  assert.equal(characters[0].key, 'personaje-1-protagonista');
  assert.equal(characters[1].title, 'Personaje 1 — Tomás (adulto)');
  assert.equal(characters[1].role, 'El mismo viajero, ya mayor.');
  assert.equal(characters[1].key, 'personaje-1-tomas-adulto');
});

test('markdown variants: ### headings, hyphen dash, language tag, tilde fences, CRLF', () => {
  const content = [
    '### Personaje 1 - Lucía',
    '_Hoja 1 · Rol: Maestra del pueblo._',
    '```text',
    'teacher sheet',
    '```',
    '## **Personaje 2 – Pedro**',
    'Hoja 2 · **Rol:** Su alumno.',
    '~~~',
    'student sheet',
    '~~~',
    '```',
    '¿Las hojas de personaje están bien?',
    '```',
  ].join('\r\n');
  const { characters } = parseCharacterSheets(content);
  assert.deepEqual(
    characters.map((item) => [item.key, item.role, item.prompt]),
    [
      ['personaje-1-lucia', 'Maestra del pueblo._'.replace('_', ''), 'teacher sheet'],
      ['personaje-2-pedro', 'Su alumno.', 'student sheet'],
    ],
  );
});

test('role on the same line as the heading', () => {
  const content = `**Personaje 1 — Ana** · Hoja 1 · Rol: Guía.\n\`\`\`\nsheet\n\`\`\`\n${QUESTION_BLOCK}`;
  const { characters } = parseCharacterSheets(content);
  assert.equal(characters[0].title, 'Personaje 1 — Ana');
  assert.equal(characters[0].role, 'Guía.');
});

test('question without code fence and without accents still counts', () => {
  const content = '**Personaje 1 — Ana**\nHoja 1 · Rol: Guia.\n```\nsheet\n```\nLas hojas de personaje estan bien?\n1 → Si\n2 → No';
  assert.equal(parseCharacterSheets(content).characters.length, 1);
});

test('duplicate titles get unique keys', () => {
  const block = '**Personaje 1 — Ana**\nHoja 1 · Rol: x.\n```\nsheet\n```\n';
  const keys = parseCharacterSheets(`${block}${block}${QUESTION_BLOCK}`).characters.map((item) => item.key);
  assert.deepEqual(keys, ['personaje-1-ana', 'personaje-1-ana-2']);
});

test('keys are valid [a-z0-9-]{1,64}', () => {
  const long = 'Ñandú '.repeat(30);
  const content = `**Personaje 1 — ${long}**\nHoja 1 · Rol: x.\n\`\`\`\nsheet\n\`\`\`\n${QUESTION_BLOCK}`;
  const [{ key }] = parseCharacterSheets(content).characters;
  assert.match(key, /^[a-z0-9-]{1,64}$/);
  assert.equal(slugify('¡¡¡'), '');
});

test('null for other messages', () => {
  assert.equal(parseCharacterSheets(''), null);
  assert.equal(parseCharacterSheets(null), null);
  assert.equal(parseCharacterSheets('Envíame tu guion completo.'), null);
  // Etapa 3 block: image prompts in code blocks, no character headings or sheet question
  const stage3 = 'Bloque 1 de 3 — Imágenes 1 a 20\nImagen 1 · hoja 1\n```\nscene prompt\n```\n¿Paso al siguiente bloque?';
  assert.equal(parseCharacterSheets(stage3), null);
  // Sheets without the approval question are not treated as a delivery
  assert.equal(parseCharacterSheets('**Personaje 1 — Ana**\nHoja 1 · Rol: x.\n```\nsheet\n```'), null);
  // A question with no character prompt
  assert.equal(parseCharacterSheets(QUESTION_BLOCK), null);
});

test('a heading without a code block is skipped', () => {
  const content = `**Personaje 1 — Ana**\nHoja 1 · Rol: x.\n**Personaje 2 — Beto**\nHoja 2 · Rol: y.\n\`\`\`\nsheet B\n\`\`\`\n${QUESTION_BLOCK}`;
  const { characters } = parseCharacterSheets(content);
  assert.equal(characters.length, 1);
  assert.equal(characters[0].title, 'Personaje 2 — Beto');
});

if (failures > 0) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
