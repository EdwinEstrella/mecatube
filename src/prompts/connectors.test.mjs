// Run with: node src/prompts/connectors.test.mjs
import assert from 'node:assert/strict';
import { composeConnectorsMessage, parseConnectors } from './connectors.js';
import { readFileSync } from 'node:fs';

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

test('exact message format', () => {
  assert.equal(
    composeConnectorsMessage('Usa conectores.', 'y\npor ende\nsin embargo'),
    'Usa conectores.\n\nPALABRAS CONECTORAS DISPONIBLES:\ny, por ende, sin embargo',
  );
});

test('trims, skips blank lines and handles CRLF', () => {
  assert.deepEqual(parseConnectors('  y  \r\n\r\n\t\r\npor ende\r\n'), ['y', 'por ende']);
});

test('dedupes ignoring case and accents, keeping the first spelling and order', () => {
  assert.deepEqual(parseConnectors('Además\nademas\nY\ny\nasí que\nASI QUE'), ['Además', 'Y', 'así que']);
});

test('the instruction is used verbatim', () => {
  const instruction = '  línea 1\n\nlínea 2  ';
  assert.ok(composeConnectorsMessage(instruction, 'y').startsWith(`${instruction}\n\nPALABRAS`));
});

test('no trailing period or newline', () => {
  assert.equal(composeConnectorsMessage('X', 'a\nb').endsWith('b'), true);
});

test('non-string list gives an empty list', () => {
  assert.deepEqual(parseConnectors(undefined), []);
});

test('bundled defaults: instruction has no trailing newline, list is clean', () => {
  const dir = new URL('./', import.meta.url);
  const instruction = readFileSync(new URL('connectors-instruction.txt', dir), 'utf8');
  const list = readFileSync(new URL('connectors.txt', dir), 'utf8');
  assert.equal(instruction.endsWith('\n'), false);
  assert.ok(instruction.startsWith('Para que el guion suene más humano'));
  const lines = list.split('\n');
  assert.ok(lines.every((line) => line === line.trim() && line.length > 0), 'no blank or padded lines');
  assert.equal(parseConnectors(list).length, lines.length, 'no duplicates');
  assert.ok(lines.length >= 400);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall passed');
