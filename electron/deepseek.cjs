// Direct client for DeepSeek API (api.deepseek.com).
// Supports testing connections, listing models, and SSE streaming for chat completions.

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

async function testConnection(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, error: 'No se proporcionó ninguna API key.' };
  }
  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
    });

    if (response.ok) {
      return { ok: true };
    }
    if (response.status === 401) {
      return { ok: false, error: 'API key no válida o sin autorización.' };
    }
    return { ok: false, error: `DeepSeek devolvió HTTP ${response.status}` };
  } catch (err) {
    return { ok: false, error: err.message || 'Error de red al conectar con DeepSeek.' };
  }
}

// Long replies (an image block is ~38k characters) hit the output limit and arrive cut mid-sentence
// with finish_reason "length". Each cut is followed by a request to continue from the exact point;
// the parts are joined into one reply.
const MAX_CONTINUATIONS = 4;
const CONTINUE_PROMPT =
  'Tu respuesta anterior se cortó por el límite de longitud. Continúa exactamente desde el último carácter que escribiste, ' +
  'sin repetir nada, sin saludar y sin explicar: solo el texto que falta, con el mismo formato.';

// Streams chat completion using Server-Sent Events (SSE), continuing automatically when cut
async function streamChat({ apiKey, messages, model = 'deepseek-chat', onDelta, signal, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('La API key de DeepSeek no está configurada.');
  let full = '';
  let history = messages;
  for (let round = 0; round <= MAX_CONTINUATIONS; round += 1) {
    const { content, finishReason } = await streamOnce({
      apiKey,
      messages: history,
      model,
      signal,
      fetchImpl,
      onDelta: (partial) => onDelta?.(full + partial),
    });
    full += content;
    if (finishReason !== 'length' || !content) break;
    history = [...messages, { role: 'assistant', content: full }, { role: 'user', content: CONTINUE_PROMPT }];
  }
  return full;
}

async function streamOnce({ apiKey, messages, model, onDelta, signal, fetchImpl }) {
  const response = await fetchImpl(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson?.error?.message || '';
    } catch {}
    throw new Error(`Error de la API de DeepSeek (${response.status}): ${errorDetail || response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf8');
  let accumulated = '';
  let buffer = '';
  let finishReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') continue;

      try {
        const json = JSON.parse(dataStr);
        const choice = json.choices?.[0];
        const content = choice?.delta?.content;
        if (content) {
          accumulated += content;
          onDelta?.(accumulated);
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      } catch {
        // partial json line, ignore
      }
    }
  }

  return { content: accumulated, finishReason };
}

module.exports = {
  testConnection,
  streamChat,
};
