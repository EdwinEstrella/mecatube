// Run with: node src/chat/parseIdeas.test.mjs
import assert from 'node:assert/strict';
import { parseIdeas } from './parseIdeas.js';
import { chosenIdeaNumber, hasUserMessageAfter } from './chosenIdea.js';

const OUTRO = 'Selecciona una idea escribiendo su número (1–10), o escribe "más ideas" para\nrecibir 10 nuevas.';

const block = (n, title) =>
  [
    `${n}. ${title}`,
    'Formato: Narrativo',
    `Pregunta central: ¿Qué pasó con ${title}?`,
    'Texto de miniatura: "NO LO CREERÁS"',
    'Gatillo principal: curiosidad',
  ].join('\n');

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

test('plain text', () => {
  const text = `10 IDEAS DE VIDEO\n${[1, 2, 3].map((n) => block(n, `Tema ${n}`)).join('\n')}\n${OUTRO}`;
  const result = parseIdeas(text);
  assert.equal(result.intro, '10 IDEAS DE VIDEO');
  assert.equal(result.ideas.length, 3);
  assert.deepEqual(result.ideas[1], {
    number: 2,
    title: 'Tema 2',
    format: 'Narrativo',
    question: '¿Qué pasó con Tema 2?',
    thumbnailText: 'NO LO CREERÁS',
    trigger: 'curiosidad',
  });
  assert.ok(result.outro.startsWith('Selecciona una idea'));
  assert.ok(result.outro.endsWith('nuevas.'));
  assert.ok(!result.ideas[2].trigger.includes('Selecciona'));
});

test('bold labels and bold titles, blank lines between items', () => {
  const item = (n) =>
    `**${n}. Título ${n}**\n\n**Formato:** Lista\n\n**Pregunta central:** ¿Por qué ${n}?\n\n**Texto de miniatura:** “WOW ${n}”\n\n**Gatillo principal:** miedo\n`;
  const result = parseIdeas(`## 10 IDEAS DE VIDEO\n\n${item(1)}\n${item(2)}\n${item(3)}\n${OUTRO}`);
  assert.equal(result.ideas.length, 3);
  assert.equal(result.ideas[0].title, 'Título 1');
  assert.equal(result.ideas[0].format, 'Lista');
  assert.equal(result.ideas[0].thumbnailText, 'WOW 1');
  assert.equal(result.ideas[2].question, '¿Por qué 3?');
  assert.equal(result.intro, '## 10 IDEAS DE VIDEO');
  assert.ok(result.outro.startsWith('Selecciona'));
});

test('heading titles', () => {
  const item = (n) =>
    `### ${n}. Idea ${n}\n- **Formato:** Narrativo\n- **Pregunta central:** ¿Cómo ${n}?\n- **Texto de miniatura:** "HOLA"\n- **Gatillo principal:** asombro\n`;
  const result = parseIdeas(`# 10 IDEAS DE VIDEO\n${item(1)}${item(2)}${item(3)}${item(4)}`);
  assert.equal(result.ideas.length, 4);
  assert.equal(result.ideas[3].title, 'Idea 4');
  assert.equal(result.ideas[3].trigger, 'asombro');
  assert.equal(result.outro, '');
});

test('list-item titles', () => {
  const item = (n) =>
    `- ${n}. [Título ${n}]\n  Formato: Lista\n  Pregunta central: ¿Será ${n}?\n  Texto de miniatura: "SÍ"\n  Gatillo principal: nostalgia`;
  const result = parseIdeas(`10 IDEAS DE VIDEO\n${[1, 2, 3].map(item).join('\n')}`);
  assert.equal(result.ideas.length, 3);
  assert.equal(result.ideas[0].title, 'Título 1');
  assert.equal(result.ideas[1].number, 2);
  assert.equal(result.ideas[2].trigger, 'nostalgia');
});

test('wrapped trigger continues on a lowercase line', () => {
  const wrapped = block(1, 'A').replace('curiosidad', 'curiosidad / miedo /\nindignación');
  const result = parseIdeas([wrapped, block(2, 'B'), block(3, 'C')].join('\n'));
  assert.equal(result.ideas[0].trigger, 'curiosidad / miedo / indignación');
});

test('non-idea replies return null', () => {
  assert.equal(parseIdeas('Hola, ¿en qué te ayudo?'), null);
  assert.equal(parseIdeas('1. Primero\n2. Segundo\n3. Tercero\n4. Cuarto'), null);
  assert.equal(parseIdeas(`${block(1, 'A')}\n${block(2, 'B')}`), null);
  assert.equal(parseIdeas(''), null);
  assert.equal(parseIdeas(undefined), null);
});

test('chosenIdeaNumber', () => {
  const msgs = [
    { role: 'assistant', content: 'ideas' },
    { role: 'user', content: '3' },
    { role: 'assistant', content: 'more' },
    { role: 'user', content: 'más ideas' },
  ];
  assert.equal(chosenIdeaNumber(msgs, 0), 3);
  assert.equal(chosenIdeaNumber(msgs, 2), null);
  assert.equal(chosenIdeaNumber([{ role: 'assistant', content: 'x' }], 0), null);
  assert.equal(chosenIdeaNumber([{ role: 'assistant' }, { role: 'user', content: ' 7\n' }], 0), 7);
  assert.equal(chosenIdeaNumber([{ role: 'assistant' }, { role: 'assistant', content: '3' }], 0), null);
});

test('hasUserMessageAfter', () => {
  const msgs = [{ role: 'assistant' }, { role: 'user' }, { role: 'assistant' }];
  assert.equal(hasUserMessageAfter(msgs, 0), true);
  assert.equal(hasUserMessageAfter(msgs, 1), false);
  assert.equal(hasUserMessageAfter(msgs, 2), false);
});

if (failures) {
  console.log(`${failures} failed`);
  process.exit(1);
}
console.log('all passed');
