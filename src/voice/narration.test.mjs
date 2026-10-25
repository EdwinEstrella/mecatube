// Run with: node src/voice/narration.test.mjs
import assert from 'node:assert/strict';
import { extractNarration, narrationFromChat } from './narration.js';

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

const HOOK = 'Nadie sabía qué había debajo del hielo. Hasta que alguien miró y lo que vio cambió todo.';
const BODY_1 = 'Pero eso creó otro problema. Y esto lo cambió todo: **nadie** estaba preparado.';
const BODY_2 = 'Excepto por un detalle. Aquí es donde se pone interesante.';
const CLOSING = 'Si todo está bien, escribe "siguiente" para recibir los metadatos de publicación.';

const PLAIN = ['Tema 2', 'Formato: Narrativo', 'Duración: 8 minutos', 'GANCHO', HOOK, 'DESARROLLO', BODY_1, '', BODY_2, CLOSING].join('\n');

const BOLD_LABELS = [
  '**Tema 2: el hielo**',
  '**Formato:** Narrativo',
  '**Duración:** 8 minutos',
  '',
  '**GANCHO**',
  '',
  HOOK,
  '',
  '**DESARROLLO**',
  '',
  BODY_1,
  '',
  BODY_2,
  '',
  CLOSING,
].join('\n');

const HEADING_LABELS = [
  '# Tema 2: el hielo',
  '',
  'Formato: Narrativo',
  'Duración: 8 minutos',
  '',
  '---',
  '',
  '## GANCHO',
  HOOK,
  '',
  '### DESARROLLO:',
  BODY_1,
  '',
  BODY_2,
  '',
  '---',
  '',
  CLOSING,
  'Luego detente.',
].join('\n');

const EXPECTED = `${HOOK}\n\n${BODY_1.replace('**nadie**', 'nadie')}\n\n${BODY_2}`;
const EXPECTED_PLAIN_BODY = `${HOOK}\n\n${BODY_1.replace('**nadie**', 'nadie')}\n\n${BODY_2}`;

test('plain labels: title, Formato, Duración, labels and closing prompt are dropped', () => {
  assert.equal(extractNarration(PLAIN), EXPECTED_PLAIN_BODY);
});

test('bold labels', () => {
  assert.equal(extractNarration(BOLD_LABELS), EXPECTED);
});

test('heading labels with a colon, rules and trailing meta lines', () => {
  assert.equal(extractNarration(HEADING_LABELS), EXPECTED);
});

test('CRLF line endings', () => {
  assert.equal(extractNarration(PLAIN.replace(/\n/g, '\r\n')), EXPECTED_PLAIN_BODY);
});

test('lowercase and unaccented labels', () => {
  const text = ['titulo', 'duracion: 3 minutos', 'gancho', HOOK, 'desarrollo', BODY_2].join('\n');
  assert.equal(extractNarration(text), `${HOOK}\n\n${BODY_2}`);
});

test('flat text without labels is kept whole', () => {
  assert.equal(extractNarration(`${HOOK}\n\n${BODY_2}`), `${HOOK}\n\n${BODY_2}`);
});

test('flat text: a title followed by Formato/Duración is dropped', () => {
  assert.equal(extractNarration(`Mi título\nFormato: Lista\nDuración: 3 minutos\n\n${HOOK}`), HOOK);
});

test('a paragraph per line (no blank lines) stays separate; wrapped sentences are joined', () => {
  assert.equal(extractNarration(`${HOOK}\n${BODY_2}`), `${HOOK}\n\n${BODY_2}`);
  assert.equal(extractNarration('Una frase que se parte\nen dos líneas y termina aquí.'), 'Una frase que se parte en dos líneas y termina aquí.');
});

test('markdown: emphasis, links, code, quotes, list markers, fences', () => {
  const text = [
    'GANCHO',
    '*Imagina* que _todo_ cambia, __ahora__ mismo con [esta idea](https://example.com/x_y).',
    '> Una cita dramática.',
    'DESARROLLO',
    '- Primero, el hielo.',
    '2. Segundo, el fuego.',
    '```',
    'Texto dentro de un bloque.',
    '```',
    'Un `código` y una imagen ![alt](a.png) aquí.',
  ].join('\n');
  assert.equal(
    extractNarration(text),
    [
      'Imagina que todo cambia, ahora mismo con esta idea.',
      'Una cita dramática.',
      'Primero, el hielo.',
      'Segundo, el fuego.',
      'Texto dentro de un bloque.',
      'Un código y una imagen aquí.',
    ].join('\n\n'),
  );
});

test('snake_case words and numbers are not mangled', () => {
  assert.equal(extractNarration('GANCHO\nEl archivo mi_archivo_final pesa 3.5 GB en 1999.\nDESARROLLO\nFin.'), 'El archivo mi_archivo_final pesa 3.5 GB en 1999.\n\nFin.');
});

test('the closing prompt is cut together with whatever follows it', () => {
  const out = extractNarration([PLAIN, 'Texto que no es narración.'].join('\n'));
  assert.equal(out, EXPECTED_PLAIN_BODY);
  assert.ok(!out.includes('siguiente'));
});

test('empty and non-string input give an empty string', () => {
  assert.equal(extractNarration(''), '');
  assert.equal(extractNarration(null), '');
  assert.equal(extractNarration(undefined), '');
  assert.equal(extractNarration(42), '');
});

// --- Choosing the script message from a chat -----------------------------------------------
const assistant = (content) => ({ role: 'assistant', content });
const user = (content) => ({ role: 'user', content });

test('narrationFromChat picks the latest script-format assistant message', () => {
  const corrected = PLAIN.replace('Excepto por un detalle.', 'Excepto por un detalle corregido.');
  const messages = [user('prompt 1'), assistant('10 IDEAS DE VIDEO'), user('2'), assistant(PLAIN), user('cambia algo'), assistant(corrected), user('siguiente'), assistant('METADATOS DE PUBLICACIÓN\n1. TÍTULOS\n4. ETIQUETAS')];
  const out = narrationFromChat(messages);
  assert.ok(out.includes('detalle corregido'));
  assert.ok(!out.includes('METADATOS'));
});

test('narrationFromChat ignores user messages that contain a script and non-script chats', () => {
  assert.equal(narrationFromChat([user(PLAIN), assistant('Hola, ¿qué tal?')]), '');
  assert.equal(narrationFromChat(null), '');
  assert.equal(narrationFromChat([]), '');
  assert.equal(narrationFromChat([null, { role: 'assistant' }, { role: 'assistant', content: 5 }]), '');
});

test('narrationFromChat works with markdown labels', () => {
  assert.equal(narrationFromChat([assistant(BOLD_LABELS)]), EXPECTED);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
