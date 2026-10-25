// Service worker: keeps a WebSocket to Mecatube and drives a chat.deepseek.com tab and a Google Flow tab.
// Protocol: see electron/bridge.cjs.

const BRIDGE_URL = 'ws://127.0.0.1:47823';
const DEEPSEEK_ORIGIN = 'https://chat.deepseek.com';
const NEW_CHAT_URL = `${DEEPSEEK_ORIGIN}/`;
const MAX_BACKOFF_MS = 10000;
const KEEPALIVE_MS = 20000;
const TAB_LOAD_TIMEOUT_MS = 30000;
const FLOW_ORIGIN = 'https://flow.google.com';
const FLOW_HOME_URL = `${FLOW_ORIGIN}/`;
const FLOW_PROJECT_PATTERN = /^https:\/\/flow\.google\.com\/project\/[0-9a-f-]{36}/;
const FLOW_STEP_TIMEOUT_MS = 60000;
const FLOW_JOB_TIMEOUT_MS = 6 * 60 * 1000;
const DEEPSEEK_CHAT_PATTERN = /^https:\/\/chat\.deepseek\.com\/a\/chat\/s\/[\w-]+/;
const HISTORY_TIMEOUT_MS = 60000;

let socket = null;
let backoff = 500;
let keepaliveTimer = null;
let reconnectTimer = null;

function send(message) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function connect() {
  clearTimeout(reconnectTimer);
  if (socket && socket.readyState <= WebSocket.OPEN) return;

  try {
    socket = new WebSocket(BRIDGE_URL);
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    backoff = 500;
    clearInterval(keepaliveTimer);
    keepaliveTimer = setInterval(() => send({ type: 'ping' }), KEEPALIVE_MS);
  };

  socket.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === 'prompt') handlePrompt(message);
    else if (message.type === 'flow-generate') handleFlowGenerate(message);
    else if (message.type === 'deepseek-history') handleDeepseekHistory(message);
  };

  socket.onclose = () => {
    clearInterval(keepaliveTimer);
    scheduleReconnect();
  };

  socket.onerror = () => {};
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
}

function waitForTabComplete(tabId, label = 'DeepSeek') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Timed out waiting for the ${label} tab to load.`));
    }, TAB_LOAD_TIMEOUT_MS);

    function listener(updatedId, info) {
      if (updatedId === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
    // The tab may already be complete before the listener was attached
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') listener(tabId, { status: 'complete' });
    });
  });
}

// Reuse an existing DeepSeek tab, or open one; navigate it to the target chat if needed
async function prepareTab(deepseekUrl) {
  const target = deepseekUrl || NEW_CHAT_URL;
  const tabs = await chrome.tabs.query({ url: `${DEEPSEEK_ORIGIN}/*` });
  let tab = tabs[0];

  if (!tab) {
    tab = await chrome.tabs.create({ url: target, active: false });
  } else if (tab.url !== target) {
    tab = await chrome.tabs.update(tab.id, { url: target });
  } else if (!deepseekUrl) {
    // Already on the root page; reload to make sure it is an empty chat
    await chrome.tabs.reload(tab.id);
  } else {
    return tab.id;
  }

  await waitForTabComplete(tab.id);
  return tab.id;
}

async function pingContentScript(tabId) {
  try {
    const reply = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    return reply?.ok === true;
  } catch {
    return false;
  }
}

// Tabs opened before the extension was installed have no content script yet
async function ensureContentScript(tabId, file = 'content.js', label = 'DeepSeek') {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await pingContentScript(tabId)) return;
    if (attempt === 1) {
      await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`The ${label} page did not respond. Reload the ${label} tab and try again.`);
}

// The DeepSeek tab serves one job at a time: a prompt in flight or a history read
let deepseekBusy = false;

async function handlePrompt({ requestId, text, deepseekUrl }) {
  if (deepseekBusy) {
    send({ type: 'error', requestId, message: 'DeepSeek está ocupado con otra tarea. Inténtalo de nuevo en unos segundos.' });
    return;
  }
  deepseekBusy = true;
  try {
    const tabId = await prepareTab(deepseekUrl);
    await ensureContentScript(tabId);

    // Content script replies through the port with delta/done/error messages
    const port = chrome.tabs.connect(tabId, { name: 'mecatube-prompt' });
    let finished = false;
    port.onMessage.addListener((message) => {
      send({ ...message, requestId });
      if (message.type === 'done' || message.type === 'error') {
        finished = true;
        deepseekBusy = false;
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => {
      if (finished) return;
      finished = true;
      deepseekBusy = false;
      send({ type: 'error', requestId, message: 'The DeepSeek page closed or reloaded before the reply finished.' });
    });
    port.postMessage({ type: 'prompt', text });
  } catch (error) {
    deepseekBusy = false;
    send({ type: 'error', requestId, message: error.message });
  }
}

// Reads the whole history of a chat so Mecatube can repair stored replies.
// Job: { type: 'deepseek-history', requestId, deepseekUrl }. Replies: history | history-error.
async function handleDeepseekHistory({ requestId, deepseekUrl }) {
  if (deepseekBusy) {
    send({ type: 'history-error', requestId, message: 'DeepSeek está ocupado con otra tarea. Inténtalo de nuevo en unos segundos.' });
    return;
  }
  deepseekBusy = true;
  try {
    if (typeof deepseekUrl !== 'string' || !DEEPSEEK_CHAT_PATTERN.test(deepseekUrl)) {
      throw new Error('La URL del chat de DeepSeek no es válida.');
    }
    const tabId = await prepareTab(deepseekUrl);
    await ensureContentScript(tabId);
    const result = await runTabStep(
      tabId,
      { type: 'history', deepseekUrl },
      { portName: 'mecatube-history', label: 'DeepSeek', settleOn: 'history', timeoutMs: HISTORY_TIMEOUT_MS },
    );
    send({ type: 'history', requestId, messages: result.messages });
  } catch (error) {
    send({ type: 'history-error', requestId, message: error.message });
  } finally {
    deepseekBusy = false;
  }
}

// --- Google Flow --------------------------------------------------------------------------
// Job: { type: 'flow-generate', requestId, prompt, projectUrl }. projectUrl is null for a new project.
// Replies: flow-project, flow-progress, flow-captcha, flow-result, flow-error (see electron/bridge.cjs).
let flowBusy = false;

// Reuse a Flow tab (preferring one already on the project) or open one; navigate when needed
async function prepareFlowTab(projectUrl) {
  const tabs = await chrome.tabs.query({ url: `${FLOW_ORIGIN}/*` });
  const target = projectUrl || FLOW_HOME_URL;
  // A new project starts from a tab that is not inside another project
  let tab = projectUrl
    ? tabs.find((item) => item.url?.startsWith(projectUrl))
    : tabs.find((item) => !FLOW_PROJECT_PATTERN.test(item.url ?? ''));
  if (!tab) tab = tabs[0];

  if (!tab) {
    tab = await chrome.tabs.create({ url: target, active: false });
  } else {
    const onTarget = projectUrl ? tab.url?.startsWith(projectUrl) : !FLOW_PROJECT_PATTERN.test(tab.url ?? '');
    if (onTarget) return tab.id;
    tab = await chrome.tabs.update(tab.id, { url: target });
  }
  await waitForTabComplete(tab.id, 'Flow');
  return tab.id;
}

// The project URL appears after "Nuevo proyecto" is clicked; poll because the page may use pushState
async function waitForProjectUrl(tabId) {
  const deadline = Date.now() + FLOW_STEP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    const match = FLOW_PROJECT_PATTERN.exec(tab.url ?? '');
    if (match) return match[0];
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Flow did not open the new project.');
}

// Runs one step in a content script over a port. onMessage sees every port message; the promise
// settles on the first message of type settleOn, and rejects on an error message, a port
// disconnect, a timeout, or (when stayOn is set) the tab closing or leaving the stayOn URL prefix.
// Every one of those paths becomes a flow-error / history-error upstream, never silence.
function runTabStep(tabId, command, { portName = 'mecatube-flow', label = 'Flow', settleOn, onMessage, timeoutMs, stayOn = null }) {
  return new Promise((resolve, reject) => {
    const port = chrome.tabs.connect(tabId, { name: portName });
    let settled = false;
    const onRemoved = (removedId) => {
      if (removedId === tabId) finish(new Error(`The ${label} tab was closed before the job finished.`));
    };
    const onUpdated = (updatedId, info) => {
      if (updatedId === tabId && stayOn && info.url && !info.url.startsWith(stayOn)) {
        finish(new Error(`The ${label} tab navigated away before the job finished.`));
      }
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      try {
        port.disconnect();
      } catch {
        // already closed
      }
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error(`Timed out waiting for ${label}.`)), timeoutMs);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.onUpdated.addListener(onUpdated);
    port.onMessage.addListener((message) => {
      onMessage?.(message);
      if (message.type === 'error') finish(new Error(message.message));
      else if (message.type === settleOn) finish(null, message);
    });
    port.onDisconnect.addListener(() => finish(new Error(`The ${label} page closed or reloaded before the job finished.`)));
    port.postMessage(command);
  });
}

async function handleFlowGenerate({ requestId, prompt, projectUrl }) {
  if (flowBusy) {
    send({ type: 'flow-error', requestId, message: 'Another Flow job is already running.' });
    return;
  }
  flowBusy = true;
  try {
    let currentProject = projectUrl && FLOW_PROJECT_PATTERN.test(projectUrl) ? projectUrl : null;
    const tabId = await prepareFlowTab(currentProject);
    await ensureContentScript(tabId, 'flow.js', 'Flow');

    if (!currentProject) {
      // The click can navigate the page, which drops the port; the tab URL is the source of truth
      await runTabStep(tabId, { type: 'new-project' }, { settleOn: 'clicked', timeoutMs: FLOW_STEP_TIMEOUT_MS }).catch(
        (error) => {
          if (!/closed or reloaded/.test(error.message)) throw error;
        },
      );
      currentProject = await waitForProjectUrl(tabId);
      send({ type: 'flow-project', requestId, projectUrl: currentProject });
      await waitForTabComplete(tabId, 'Flow');
      await ensureContentScript(tabId, 'flow.js', 'Flow');
    }

    const result = await runTabStep(
      tabId,
      { type: 'generate', prompt },
      {
        settleOn: 'result',
        timeoutMs: FLOW_JOB_TIMEOUT_MS,
        stayOn: currentProject,
        onMessage: (message) => {
          if (message.type === 'progress') send({ type: 'flow-progress', requestId, percent: message.percent });
          else if (message.type === 'captcha') send({ type: 'flow-captcha', requestId, active: message.active === true });
        },
      },
    );
    send({ type: 'flow-result', requestId, projectUrl: currentProject, images: result.images, submitMethod: result.submitMethod ?? null });
  } catch (error) {
    send({ type: 'flow-error', requestId, message: error.message });
  } finally {
    flowBusy = false;
  }
}

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
