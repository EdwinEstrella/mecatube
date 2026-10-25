// Run with: node src/voice/helpers.test.mjs
import assert from 'node:assert/strict';
import { afterRemaining, voiceoverText } from './creditsText.js';
import { ensureScriptVideo } from './scriptVideo.js';
import { extractNarration } from './narration.js';
import { isKnownVoice, voiceDetail } from './voiceDetail.js';

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n     ${error.message}`);
  }
}

const block = (n, title) =>
  [
    `${n}. ${title}`,
    'Formato: Narrativo',
    `Pregunta central: ¿Qué pasó con ${title}?`,
    'Texto de miniatura: "NO LO CREERÁS"',
    'Gatillo principal: curiosidad',
  ].join('\n');
const IDEAS = `10 IDEAS DE VIDEO\n${[1, 2, 3].map((n) => block(n, `Tema ${n}`)).join('\n')}\nSelecciona una idea escribiendo su número (1–10).`;

function fakeApi(videos = []) {
  const created = [];
  return {
    created,
    listVideos: async () => videos,
    createVideo: async (input) => {
      created.push(input);
      return { id: 'new', ...input };
    },
  };
}

await test('afterRemaining: left, clamped at 0, over flag, unknown balance', () => {
  assert.deepEqual(afterRemaining({ remaining: 1000 }, 300), { left: 700, over: false });
  assert.deepEqual(afterRemaining({ remaining: 1000 }, 1000), { left: 0, over: false });
  assert.deepEqual(afterRemaining({ remaining: 100 }, 300), { left: 0, over: true });
  assert.deepEqual(afterRemaining(null, 5), { left: null, over: false });
});

await test('voiceoverText: raw unless clean is on', () => {
  const raw = '  **GANCHO**\nHola   mundo\n';
  assert.equal(voiceoverText(raw, false, extractNarration), raw);
  assert.equal(voiceoverText(raw, true, extractNarration), extractNarration(raw));
});

await test('ensureScriptVideo: reuses the linked video', async () => {
  const api = fakeApi([{ id: 'a', scriptConversationId: 'c1' }, { id: 'b', scriptConversationId: 'c2' }]);
  assert.equal((await ensureScriptVideo(api, 'c2', [])).id, 'b');
  assert.equal(api.created.length, 0);
});

await test('ensureScriptVideo: no chosen idea creates a linked video with the default title', async () => {
  const api = fakeApi();
  const video = await ensureScriptVideo(api, 'c1', [{ role: 'assistant', content: 'hola' }]);
  assert.deepEqual(api.created, [{ scriptConversationId: 'c1' }]);
  assert.equal(video.id, 'new');
});

await test('ensureScriptVideo: title and number come from the chosen idea', async () => {
  const api = fakeApi();
  const messages = [
    { role: 'assistant', content: IDEAS },
    { role: 'user', content: '2' },
  ];
  await ensureScriptVideo(api, 'c1', messages);
  assert.deepEqual(api.created, [{ title: 'Tema 2', scriptConversationId: 'c1', ideaNumber: 2 }]);
});

await test('ensureScriptVideo: refuses without a conversation', async () => {
  await assert.rejects(ensureScriptVideo(fakeApi(), null, []), /saved conversation/);
});

await test('voiceDetail: tagline and creation date, tolerant of missing data', () => {
  assert.equal(voiceDetail({}), '');
  assert.equal(voiceDetail({ tagline: 'calida', createdAt: 'nope' }), 'calida');
  assert.match(voiceDetail({ tagline: 'calida', createdAt: '2026-03-05T12:00:00Z' }), /^calida · created .*2026/);
});

await test('isKnownVoice: looks in both lists', () => {
  assert.equal(isKnownVoice('a', [{ id: 'a' }], []), true);
  assert.equal(isKnownVoice('b', [], [{ id: 'b' }]), true);
  assert.equal(isKnownVoice('c', [{ id: 'a' }], [{ id: 'b' }]), false);
});

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
