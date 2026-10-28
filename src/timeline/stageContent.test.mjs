import test from 'node:test';
import assert from 'node:assert/strict';
import { latestIdeas, latestScript } from './stageContent.js';

const ideaBlock = (n, title) =>
  [
    `${n}. ${title}`,
    'Formato: Narrativo',
    `Pregunta central: ¿Qué pasó con ${title}?`,
    'Texto de miniatura: "NO LO CREERÁS"',
    'Gatillo principal: curiosidad',
  ].join('\n');

const IDEAS = `10 IDEAS DE VIDEO\n${[1, 2, 3, 4].map((n) => ideaBlock(n, `Tema ${n}`)).join('\n')}\nSelecciona una idea escribiendo su número (1–10)`;

const SCRIPT = [
  'Tema 2',
  'Formato: Narrativo',
  'Duración: 8 minutos',
  'GANCHO',
  'Nadie sabía qué había debajo del hielo. Hasta que alguien miró.',
  'DESARROLLO',
  'Pero eso creó otro problema. Y esto lo cambió todo.',
].join('\n');

test('stageContent: no messages returns null', () => {
  assert.equal(latestIdeas(null), null);
  assert.equal(latestIdeas([]), null);
  assert.equal(latestIdeas([{ role: 'user', content: 'hola' }]), null);

  assert.equal(latestScript(null), null);
  assert.equal(latestScript([]), null);
  assert.equal(latestScript([{ role: 'user', content: SCRIPT }]), null);
});

test('stageContent: ideas without choice returns parsed ideas with null chosenNumber', () => {
  const messages = [
    { role: 'user', content: 'dame 10 ideas' },
    { role: 'assistant', content: IDEAS },
  ];
  const result = latestIdeas(messages);
  assert.ok(result);
  assert.equal(result.index, 1);
  assert.equal(result.parsed.ideas.length, 4);
  assert.equal(result.chosenNumber, null);
  assert.equal(latestScript(messages), null);
});

test('stageContent: ideas with choice returns chosenNumber', () => {
  const messages = [
    { role: 'user', content: 'dame 10 ideas' },
    { role: 'assistant', content: IDEAS },
    { role: 'user', content: '3' },
  ];
  const result = latestIdeas(messages);
  assert.ok(result);
  assert.equal(result.index, 1);
  assert.equal(result.chosenNumber, 3);
  assert.equal(latestScript(messages), null);
});

test('stageContent: script present returns script text', () => {
  const messages = [
    { role: 'user', content: 'escribe el guion' },
    { role: 'assistant', content: SCRIPT },
  ];
  assert.equal(latestIdeas(messages), null);
  assert.equal(latestScript(messages), SCRIPT);
});

test('stageContent: script after ideas returns both latest ideas and latest script', () => {
  const messages = [
    { role: 'user', content: 'dame 10 ideas' },
    { role: 'assistant', content: IDEAS },
    { role: 'user', content: '2' },
    { role: 'assistant', content: SCRIPT },
  ];
  const ideasResult = latestIdeas(messages);
  assert.ok(ideasResult);
  assert.equal(ideasResult.index, 1);
  assert.equal(ideasResult.chosenNumber, 2);
  assert.equal(latestScript(messages), SCRIPT);
});
