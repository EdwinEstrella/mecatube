// Run with: node src/chat/nextStep.test.mjs
import assert from 'node:assert/strict';
import { nextStepPrompt } from './nextStep.js';

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

const block = (question, first, second) =>
  ['**Imagen 18 — Explicación (línea de tiempo)**', '```', 'prompt text', '```', '```', question, `1 → ${first}`, `2 → ${second}`, 'Responde 1 o 2.', '```'].join('\n');

test('finds the next-block question inside a code fence', () => {
  const result = nextStepPrompt(block('¿Paso al siguiente bloque?', 'Sí, envíame el Bloque 2.', 'No, quiero cambiar imágenes de este bloque.'));
  assert.deepEqual(result, {
    question: '¿Paso al siguiente bloque?',
    options: [
      { value: '1', label: 'Sí, envíame el Bloque 2.' },
      { value: '2', label: 'No, quiero cambiar imágenes de este bloque.' },
    ],
  });
});

test('finds the hand-off to animations', () => {
  const result = nextStepPrompt(block('¿Paso a los prompts de animación?', 'Sí, envíame el Bloque 1 de animaciones.', 'No.'));
  assert.equal(result.question, '¿Paso a los prompts de animación?');
  assert.equal(result.options[0].label, 'Sí, envíame el Bloque 1 de animaciones.');
});

test('accepts -> and bold markup', () => {
  const result = nextStepPrompt('**¿Paso a la miniatura?**\n1 -> Sí\n2 -> No');
  assert.deepEqual(result.options.map((o) => o.value), ['1', '2']);
});

test('ignores questions without numbered options', () => {
  assert.equal(nextStepPrompt('¿Te gusta?\nTexto suelto.'), null);
  assert.equal(nextStepPrompt('¿Paso?\n1 → Sí'), null);
  assert.equal(nextStepPrompt(''), null);
  assert.equal(nextStepPrompt(undefined), null);
});

if (failures) {
  console.log(`${failures} failed`);
  process.exit(1);
}
console.log('all passed');
