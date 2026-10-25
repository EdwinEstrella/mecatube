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
//       { type: 'flow-result',   requestId, projectUrl, images: [{ mime, base64, width, height, sourceUrl }] }
//       { type: 'flow-error',    requestId, message }
const { WebSocketServer } = require('ws');

const BRIDGE_HOST = '127.0.0.1';
const BRIDGE_PORT = 47823;
const EXTENSION_ORIGIN_PREFIX = 'chrome-extension://';
// Flow results carry base64 images; the ws default is far higher, this is a sane ceiling
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

function createBridge({ port = BRIDGE_PORT, host = BRIDGE_HOST } = {}) {
  let server = null;
  let client = null;
  const statusListeners = new Set();
  const messageListeners = new Set();

  const emitStatus = () => {
    const connected = client !== null;
    statusListeners.forEach((listener) => listener(connected));
  };

  function handleConnection(socket) {
    // A new extension connection replaces the previous one
    const previous = client;
    client = socket;
    if (previous && previous !== socket) previous.close(1000, 'replaced');
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
      messageListeners.forEach((listener) => listener(message));
    });

    socket.on('close', () => {
      // Ignore close events from a connection that was already replaced
      if (client !== socket) return;
      client = null;
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

  function subscribe(set, listener) {
    set.add(listener);
    return () => set.delete(listener);
  }

  return {
    start,
    stop,
    sendPrompt,
    sendFlowJob,
    isConnected: () => client !== null,
    onStatusChange: (listener) => subscribe(statusListeners, listener),
    onMessage: (listener) => subscribe(messageListeners, listener),
  };
}

module.exports = { createBridge, BRIDGE_HOST, BRIDGE_PORT, MAX_MESSAGE_BYTES };
