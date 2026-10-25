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

// Streams chat completion using Server-Sent Events (SSE)
async function streamChat({ apiKey, messages, model = 'deepseek-chat', onDelta, signal }) {
  if (!apiKey) throw new Error('La API key de DeepSeek no está configurada.');

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
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
      } catch {
        // partial json line, ignore
      }
    }
  }

  return accumulated;
}

module.exports = {
  testConnection,
  streamChat,
};
