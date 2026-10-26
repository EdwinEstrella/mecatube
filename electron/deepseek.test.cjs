// Run: node electron/deepseek.test.cjs
const assert = require('node:assert/strict');
const { streamChat } = require('./deepseek.cjs');

// A fake SSE response: one chunk per content piece, then the finish reason
function sse(pieces, finishReason) {
  const lines = pieces.map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
  lines.push(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finishReason }] })}\n\n`, 'data: [DONE]\n\n');
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: {
      getReader() {
        let index = 0;
        return { read: async () => (index < lines.length ? { done: false, value: encoder.encode(lines[index++]) } : { done: true }) };
      },
    },
  };
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok   ${name}`);
}

(async () => {
  await test('a reply cut by the length limit is continued and joined', async () => {
    const bodies = [];
    const replies = [sse(['**Imagen 19 — Escena**\n', 'Wide 16:9 illustration with'], 'length'), sse([' rich detail.\n', '¿Paso al siguiente bloque?'], 'stop')];
    const deltas = [];
    const full = await streamChat({
      apiKey: 'k',
      messages: [{ role: 'user', content: '1' }],
      onDelta: (text) => deltas.push(text),
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(init.body));
        return replies.shift();
      },
    });
    assert.equal(full, '**Imagen 19 — Escena**\nWide 16:9 illustration with rich detail.\n¿Paso al siguiente bloque?');
    assert.equal(bodies.length, 2);
    // The continuation carries the partial reply and asks to resume, without repeating the original request
    const second = bodies[1].messages;
    assert.equal(second[1].role, 'assistant');
    assert.equal(second[1].content, '**Imagen 19 — Escena**\nWide 16:9 illustration with');
    assert.equal(second[2].role, 'user');
    assert.match(second[2].content, /Continúa exactamente/);
    // Streaming updates always show the whole reply so far
    assert.equal(deltas.at(-1), full);
  });

  await test('a complete reply makes a single request', async () => {
    let calls = 0;
    const full = await streamChat({
      apiKey: 'k',
      messages: [{ role: 'user', content: 'hola' }],
      fetchImpl: async () => {
        calls += 1;
        return sse(['Hola'], 'stop');
      },
    });
    assert.equal(full, 'Hola');
    assert.equal(calls, 1);
  });

  await test('continuations are bounded', async () => {
    let calls = 0;
    await streamChat({
      apiKey: 'k',
      messages: [{ role: 'user', content: 'x' }],
      fetchImpl: async () => {
        calls += 1;
        return sse(['parte '], 'length');
      },
    });
    assert.equal(calls, 5);
  });

  console.log(`\n${passed} passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
