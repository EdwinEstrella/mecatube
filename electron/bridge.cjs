// Local WebSocket bridge between Mecatube and the DeepSeek browser extension.
//
// Server binds to 127.0.0.1 only and accepts only `chrome-extension://` origins.
// Messages are JSON objects with a `type` field.
//
//   Mecatube -> extension
//     { type: 'prompt', requestId, text, deepseekUrl }   deepseekUrl is null for a new chat
//
//   extension -> Mecatube
//     { type: 'delta', requestId, text }                  full reply text so far (not an increment)
//     { type: 'done',  requestId, text, deepseekUrl }     final reply text and the chat URL
//     { type: 'error', requestId, message }
//     { type: 'ping' }                                    keepalive, answered with { type: 'pong' }
//
//   Google Flow jobs (one at a time)
//     Mecatube -> extension
//       { type: 'flow-generate', requestId, prompt, projectUrl }   projectUrl is null to create a project
//     extension -> Mecatube
//       { type: 'flow-project',  requestId, projectUrl }           the project that was just created
//       { type: 'flow-progress', requestId, percent }              percent may be absent
//       { type: 'flow-captcha',  requestId, active }               a reCAPTCHA challenge appeared / went away
//       { type: 'flow-result',   requestId, projectUrl, images: [{ mime, base64, width, height, sourceUrl }], submitMethod }
//       { type: 'flow-error',    requestId, message }
//
//   DeepSeek history (repairs stored replies; never runs while a prompt is in flight)
//     Mecatube -> extension
//       { type: 'deepseek-history', requestId, deepseekUrl }
//     extension -> Mecatube
//       { type: 'history',       requestId, messages: [{ role: 'user' | 'assistant', content }] }
//       { type: 'history-error', requestId, message }
//   The final `done` of a prompt also carries `source` ('api' | 'dom'): where the reply text came from.
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');

const BRIDGE_HOST = '127.0.0.1';
const BRIDGE_PORT = 47823;
const EXTENSION_ORIGIN_PREFIX = 'chrome-extension://';
// Flow results carry base64 images; the ws default is far higher, this is a sane ceiling
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;
const HISTORY_TIMEOUT_MS = 90 * 1000;
const HISTORY_ROLES = new Set(['user', 'assistant']);

// Keeps only well-formed { role, content } entries of a history reply
function sanitizeHistory(messages) {
  if (!Array.isArray(messages)) return null;
  const clean = [];
  for (const item of messages) {
    if (!item || !HISTORY_ROLES.has(item.role) || typeof item.content !== 'string') return null;
    clean.push({ role: item.role, content: item.content });
  }
  return clean;
}

function createBridge({ port = BRIDGE_PORT, host = BRIDGE_HOST } = {}) {
  let server = null;
  let client = null;
  const statusListeners = new Set();
  const messageListeners = new Set();
  // History requests waiting for the extension: requestId -> { resolve, reject, timer }
  const pendingHistory = new Map();

  const emitStatus = () => {
    const connected = client !== null;
    statusListeners.forEach((listener) => listener(connected));
  };

  function settleHistory(requestId, error, messages) {
    const entry = pendingHistory.get(requestId);
    if (!entry) return false;
    pendingHistory.delete(requestId);
    clearTimeout(entry.timer);
    if (error) entry.reject(error);
    else entry.resolve(messages);
    return true;
  }

  function failAllHistory(message) {
    for (const requestId of Array.from(pendingHistory.keys())) settleHistory(requestId, new Error(message));
  }

  function handleConnection(socket) {
    // A new extension connection replaces the previous one. Work started on the old connection can
    // never finish (the service worker that held it is gone), so listeners see a disconnect first.
    const previous = client;
    client = socket;
    if (previous && previous !== socket) {
      previous.close(1000, 'replaced');
      failAllHistory('La extensión del navegador se reinició.');
      statusListeners.forEach((listener) => listener(false));
    }
    emitStatus();

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      if (message.type === 'history' || message.type === 'history-error') {
        // Answers to requestHistory; they never reach the general listeners
        if (message.type === 'history-error') {
          settleHistory(message.requestId, new Error(String(message.message ?? 'DeepSeek no devolvió el historial.')));
          return;
        }
        const messages = sanitizeHistory(message.messages);
        settleHistory(message.requestId, messages ? null : new Error('DeepSeek devolvió un historial con formato inesperado.'), messages);
        return;
      }
      messageListeners.forEach((listener) => listener(message));
    });

    socket.on('close', () => {
      // Ignore close events from a connection that was already replaced
      if (client !== socket) return;
      client = null;
      failAllHistory('La extensión del navegador se desconectó.');
      emitStatus();
    });

    socket.on('error', () => {});
  }

  function start() {
    if (server) return;
    try {
      server = new WebSocketServer({
        port,
        host,
        maxPayload: MAX_MESSAGE_BYTES,
        verifyClient: ({ origin }) =>
          typeof origin === 'string' && origin.startsWith(EXTENSION_ORIGIN_PREFIX),
      });
    } catch (error) {
      console.error('Bridge failed to start:', error.message);
      server = null;
      return;
    }

    // Covers listen errors such as EADDRINUSE without crashing the app
    server.on('error', (error) => {
      console.error('Bridge server error:', error.message);
    });
    server.on('connection', handleConnection);
  }

  function stop() {
    failAllHistory('El puente con la extensión se detuvo.');
    client?.terminate();
    client = null;
    server?.close();
    server = null;
  }

  function sendPrompt({ requestId, text, deepseekUrl }) {
    if (!client || client.readyState !== client.OPEN) {
      throw new Error('The DeepSeek extension is not connected.');
    }
    client.send(JSON.stringify({ type: 'prompt', requestId, text, deepseekUrl: deepseekUrl ?? null }));
  }

  function sendFlowJob({ requestId, prompt, projectUrl }) {
    if (!client || client.readyState !== client.OPEN) {
      throw new Error('The browser extension is not connected.');
    }
    client.send(JSON.stringify({ type: 'flow-generate', requestId, prompt, projectUrl: projectUrl ?? null }));
  }

  // Asks the extension for the full history of a DeepSeek chat; resolves to [{ role, content }]
  function requestHistory({ deepseekUrl, timeoutMs = HISTORY_TIMEOUT_MS }) {
    return new Promise((resolve, reject) => {
      if (!client || client.readyState !== client.OPEN) {
        reject(new Error('La extensión del navegador no está conectada.'));
        return;
      }
      const requestId = crypto.randomUUID();
      const timer = setTimeout(
        () => settleHistory(requestId, new Error('DeepSeek tardó demasiado en devolver el historial.')),
        timeoutMs,
      );
      timer.unref?.();
      pendingHistory.set(requestId, { resolve, reject, timer });
      try {
        client.send(JSON.stringify({ type: 'deepseek-history', requestId, deepseekUrl }));
      } catch (error) {
        settleHistory(requestId, error);
      }
    });
  }

  function subscribe(set, listener) {
    set.add(listener);
    return () => set.delete(listener);
  }

  return {
    start,
    stop,
    sendPrompt,
    sendFlowJob,
    requestHistory,
    isConnected: () => client !== null,
    onStatusChange: (listener) => subscribe(statusListeners, listener),
    onMessage: (listener) => subscribe(messageListeners, listener),
  };
}

module.exports = { createBridge, BRIDGE_HOST, BRIDGE_PORT, MAX_MESSAGE_BYTES };
