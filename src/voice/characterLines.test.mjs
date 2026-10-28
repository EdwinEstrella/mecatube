// Run with: node src/voice/characterLines.test.mjs
import assert from 'node:assert/strict';
import {
  normalizeName,
  parseCharacterLines,
  planVoiceSegments,
  mergeTimestampOffsets,
} from './characterLines.js';

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

const characters = [
  { key: 'carlos', name: 'Carlos', voiceId: 'voice-carlos-1' },
  { key: 'maria', name: 'María', voiceId: 'voice-maria-2' },
  { key: 'robot', name: 'Robot X', voiceId: null }, // no voice
];

test('normalizeName strips accents, lowers case, and trims', () => {
  assert.equal(normalizeName('  Carlos  '), 'carlos');
  assert.equal(normalizeName('MARÍA'), 'maria');
  assert.equal(normalizeName('Élena'), 'elena');
  assert.equal(normalizeName('Ángel'), 'angel');
  assert.equal(normalizeName(''), '');
  assert.equal(normalizeName(null), '');
});

test('parseCharacterLines handles empty, null, undefined', () => {
  assert.deepEqual(parseCharacterLines(''), []);
  assert.deepEqual(parseCharacterLines('   '), []);
  assert.deepEqual(parseCharacterLines(null), []);
  assert.deepEqual(parseCharacterLines(undefined), []);
});

test('parseCharacterLines with no tags returns single narrator segment', () => {
  const text = 'Esta es una narración pura sin personajes.\nSegunda línea de narración.';
  const segs = parseCharacterLines(text, characters);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].speaker, 'narrator');
  assert.equal(segs[0].text, text);
});

test('parseCharacterLines matches character names case- and accent-insensitively', () => {
  const text = [
    '[carlos]: Hola desde minúsculas.',
    '[MARIA]: Hola sin tilde y mayúsculas.',
    '[Carlos]: Hola capitalizado.',
    '[María]: Hola con tilde.',
  ].join('\n\n');

  const segs = parseCharacterLines(text, characters);
  assert.equal(segs.length, 4);
  assert.equal(segs[0].speaker, 'carlos');
  assert.equal(segs[0].text, 'Hola desde minúsculas.');
  assert.equal(segs[1].speaker, 'maria');
  assert.equal(segs[1].text, 'Hola sin tilde y mayúsculas.');
  assert.equal(segs[2].speaker, 'carlos');
  assert.equal(segs[2].text, 'Hola capitalizado.');
  assert.equal(segs[3].speaker, 'maria');
  assert.equal(segs[3].text, 'Hola con tilde.');
});

test('parseCharacterLines handles unknown tags as narrator and strips the tag', () => {
  const text = [
    'Inicio del video.',
    '[Desconocido]: Esta frase la dice alguien anónimo.',
    'Fin de la historia.',
  ].join('\n\n');

  const segs = parseCharacterLines(text, characters);
  // All 3 resolve to narrator, so they merge into 1 narrator segment
  assert.equal(segs.length, 1);
  assert.equal(segs[0].speaker, 'narrator');
  assert.ok(!segs[0].text.includes('[Desconocido]'));
  assert.ok(segs[0].text.includes('Esta frase la dice alguien anónimo.'));
  assert.ok(segs[0].text.includes('Inicio del video.'));
  assert.ok(segs[0].text.includes('Fin de la historia.'));
});

test('parseCharacterLines with mixed scripts (narrator, characters, multiline dialogue)', () => {
  const text = [
    'En un lejano planeta, la tripulación descendió de la nave.',
    '',
    '[Carlos]: El aire es respirable. Podemos quitarnos los cascos.',
    'Miró a su alrededor con cautela.',
    '',
    '[María]: Espera, Carlos. El radar detecta movimiento subterráneo.',
    '',
    'El suelo comenzó a temblar bajo sus pies.',
    '',
    '[Voz misteriosa]: Bienvenidos a nuestro mundo.',
    '',
    'Una gigantesca compuerta se abrió frente a ellos.',
  ].join('\n');

  const segs = parseCharacterLines(text, characters);
  assert.equal(segs.length, 4);

  // 1. Narrator intro
  assert.equal(segs[0].speaker, 'narrator');
  assert.equal(segs[0].text, 'En un lejano planeta, la tripulación descendió de la nave.');

  // 2. Carlos dialogue
  assert.equal(segs[1].speaker, 'carlos');
  assert.equal(
    segs[1].text,
    'El aire es respirable. Podemos quitarnos los cascos.\nMiró a su alrededor con cautela.'
  );

  // 3. María dialogue
  assert.equal(segs[2].speaker, 'maria');
  assert.equal(segs[2].text, 'Espera, Carlos. El radar detecta movimiento subterráneo.');

  // 4. Narrator + unknown tag "Voz misteriosa" merged
  assert.equal(segs[3].speaker, 'narrator');
  assert.ok(!segs[3].text.includes('[Voz misteriosa]'));
  assert.ok(segs[3].text.includes('El suelo comenzó a temblar bajo sus pies.'));
  assert.ok(segs[3].text.includes('Bienvenidos a nuestro mundo.'));
  assert.ok(segs[3].text.includes('Una gigantesca compuerta se abrió frente a ellos.'));
});

test('parseCharacterLines strips markdown bold around tags', () => {
  const text = '**[Carlos]:** Frase importante.\n\n**[María]**: Otra frase.';
  const segs = parseCharacterLines(text, characters);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].speaker, 'carlos');
  assert.equal(segs[0].text, 'Frase importante.');
  assert.equal(segs[1].speaker, 'maria');
  assert.equal(segs[1].text, 'Otra frase.');
});

test('planVoiceSegments returns single voice when no characters or no voices', () => {
  const text = 'Texto sin personajes.';
  const segs = parseCharacterLines(text, characters);
  const plan = planVoiceSegments(segs, {
    characters,
    narratorVoiceId: 'voice-narrator-default',
  });

  assert.equal(plan.isMultiVoice, false);
  assert.equal(plan.narratorVoiceId, 'voice-narrator-default');
  assert.equal(plan.segments.length, 1);
  assert.equal(plan.segments[0].voiceId, 'voice-narrator-default');
  assert.equal(plan.segments[0].text, 'Texto sin personajes.');
});

test('planVoiceSegments falls back characters without voiceId to narrator voice and merges', () => {
  const text = [
    'Narrador antes.',
    '[Robot X]: Yo no tengo voz personalizada.',
    'Narrador después.',
  ].join('\n\n');

  const segs = parseCharacterLines(text, characters);
  const plan = planVoiceSegments(segs, {
    characters,
    narratorVoiceId: 'voice-narrator-1',
  });

  // Robot X has voiceId: null, so it falls back to voice-narrator-1.
  // All 3 segments share voice-narrator-1, so they merge into 1 single-voice segment!
  assert.equal(plan.isMultiVoice, false);
  assert.equal(plan.segments.length, 1);
  assert.equal(plan.segments[0].voiceId, 'voice-narrator-1');
  assert.ok(plan.segments[0].text.includes('Yo no tengo voz personalizada.'));
});

test('planVoiceSegments plans multi-voice when characters have voices and lines', () => {
  const text = [
    'El narrador introduce.',
    '[Carlos]: Mi línea de Carlos.',
    '[María]: Mi línea de María.',
    'El narrador concluye.',
  ].join('\n\n');

  const segs = parseCharacterLines(text, characters);
  const plan = planVoiceSegments(segs, {
    characters,
    narratorVoiceId: 'voice-narrator-main',
    defaultVoiceId: 'fallback-voice',
  });

  assert.equal(plan.isMultiVoice, true);
  assert.equal(plan.segments.length, 4);

  assert.equal(plan.segments[0].speaker, 'narrator');
  assert.equal(plan.segments[0].voiceId, 'voice-narrator-main');
  assert.equal(plan.segments[0].text, 'El narrador introduce.');

  assert.equal(plan.segments[1].speaker, 'carlos');
  assert.equal(plan.segments[1].voiceId, 'voice-carlos-1');
  assert.equal(plan.segments[1].voiceName, 'Carlos');
  assert.equal(plan.segments[1].text, 'Mi línea de Carlos.');

  assert.equal(plan.segments[2].speaker, 'maria');
  assert.equal(plan.segments[2].voiceId, 'voice-maria-2');
  assert.equal(plan.segments[2].voiceName, 'María');
  assert.equal(plan.segments[2].text, 'Mi línea de María.');

  assert.equal(plan.segments[3].speaker, 'narrator');
  assert.equal(plan.segments[3].voiceId, 'voice-narrator-main');
  assert.equal(plan.segments[3].text, 'El narrador concluye.');
});

test('planVoiceSegments uses defaultVoiceId when narratorVoiceId is omitted', () => {
  const text = 'Texto narrado.';
  const segs = parseCharacterLines(text, characters);
  const plan = planVoiceSegments(segs, {
    characters,
    defaultVoiceId: 'global-default-voice',
  });

  assert.equal(plan.narratorVoiceId, 'global-default-voice');
  assert.equal(plan.segments[0].voiceId, 'global-default-voice');
});

test('mergeTimestampOffsets correctly shifts word timestamps per segment duration', () => {
  const seg1 = {
    duration: 2.0,
    words: [
      { w: 'Hola', s: 0.1, e: 0.6 },
      { w: 'amigos', s: 0.7, e: 1.4 },
    ],
  };
  const seg2 = {
    duration: 1.5,
    words: [
      { w: 'cómo', s: 0.2, e: 0.5 },
      { w: 'están', s: 0.6, e: 1.1 },
    ],
  };

  const merged = mergeTimestampOffsets([seg1, seg2]);
  assert.equal(merged.length, 4);

  // Segment 1 (offset 0)
  assert.deepEqual(merged[0], { w: 'Hola', s: 0.1, e: 0.6 });
  assert.deepEqual(merged[1], { w: 'amigos', s: 0.7, e: 1.4 });

  // Segment 2 (offset 2.0)
  assert.deepEqual(merged[2], { w: 'cómo', s: 2.2, e: 2.5 });
  assert.deepEqual(merged[3], { w: 'están', s: 2.6, e: 3.1 });
});

test('mergeTimestampOffsets handles empty and edge inputs', () => {
  assert.deepEqual(mergeTimestampOffsets([]), []);
  assert.deepEqual(mergeTimestampOffsets(null), []);
  assert.deepEqual(mergeTimestampOffsets([{ words: [] }]), []);
});

if (failures > 0) {
  process.exit(1);
}
