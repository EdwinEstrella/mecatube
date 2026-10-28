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
// Accounts other than the default one carry a "/u/<n>/" prefix
const FLOW_PROJECT_PATTERN = /^https:\/\/flow\.google\.com\/(?:u\/\d+\/)?project\/([0-9a-f-]{36})/;
const FLOW_STEP_TIMEOUT_MS = 60000;
const FLOW_JOB_TIMEOUT_MS = 6 * 60 * 1000;
// Video generation (Flow animations) takes longer than images
const FLOW_ANIMATE_TIMEOUT_MS = 13 * 60 * 1000;
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
      reject(new Error(`Se agotó el tiempo esperando a que cargara la pestaña de ${label}.`));
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
  throw new Error(`La página de ${label} no respondió. Recarga la pestaña de ${label} e inténtalo de nuevo.`);
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
      send({ type: 'error', requestId, message: 'La página de DeepSeek se cerró o se recargó antes de terminar la respuesta.' });
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

// flow.js asks for its page-world helper (flow-main.js) before intercepting the file picker; it must
// run in the MAIN world to patch the page's own HTMLInputElement. Only Flow tabs may ask.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'flow-install-hook') return false;
  const tabId = sender.tab?.id;
  if (tabId === undefined || !sender.url?.startsWith(`${FLOW_ORIGIN}/`)) {
    sendResponse({ ok: false, error: 'Remitente no válido.' });
    return false;
  }
  chrome.scripting
    .executeScript({ target: { tabId }, world: 'MAIN', files: ['flow-main.js'] })
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

// Flow ignores synthetic (isTrusted: false) clicks on its generate button, so flow.js asks for a real
// one: a mouse press/release through the DevTools protocol at viewport coordinates (CSS pixels).
// Chrome shows its "debugging this browser" bar only while attached, which is a fraction of a second.
// A hidden tab does not process input until it is shown, so the Flow tab is brought to the front first.
const TRUSTED_CLICK_TIMEOUT_MS = 10000;

async function bringTabToFront(tabId) {
  const tab = await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  await new Promise((resolve) => setTimeout(resolve, 300));
}

// Attaching shows the debugging bar, which shrinks the viewport and moves the button, so its center is
// measured again after attaching; the coordinates sent by flow.js are only the fallback
async function measureCenter(target, selector, fallback) {
  if (typeof selector !== 'string' || !selector) return fallback;
  await new Promise((resolve) => setTimeout(resolve, 400));
  const expression = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;
  const { result } = await chrome.debugger.sendCommand(target, 'Runtime.evaluate', { expression, returnByValue: true });
  const point = result?.value;
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : fallback;
}

// Each step is bounded and named, so a hang is reported as "<step>: tardó demasiado" instead of silence
async function step(name, promise, timeoutMs = TRUSTED_CLICK_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name}: tardó demasiado`)), timeoutMs);
      }),
    ]);
  } catch (error) {
    throw error.message.startsWith(`${name}:`) ? error : new Error(`${name}: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function trustedClick(tabId, x, y, selector) {
  await step('mostrar la pestaña de Flow', bringTabToFront(tabId));
  const target = { tabId };
  await step('conectar el depurador', chrome.debugger.attach(target, '1.3'));
  try {
    const point = await step('medir el botón', measureCenter(target, selector, { x, y }));
    await step('enviar el clic', dispatchClick(target, point.x, point.y));
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

async function dispatchClick(target, x, y) {
  const base = { x, y, button: 'left', clickCount: 1 };
  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { ...base, type: 'mouseMoved', button: 'none', clickCount: 0 });
  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { ...base, type: 'mousePressed' });
  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'flow-trusted-click') return false;
  const tabId = sender.tab?.id;
  const { x, y, selector } = message;
  if (tabId === undefined || !sender.url?.startsWith(`${FLOW_ORIGIN}/`) || !Number.isFinite(x) || !Number.isFinite(y)) {
    sendResponse({ ok: false, error: 'Solicitud de clic no válida.' });
    return false;
  }
  trustedClick(tabId, x, y, selector)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

// Flow injects a tile's <video> only on a trusted hover (synthetic events do nothing), so flow.js asks
// for a real mouse move over a marked element. Same safeguards as the trusted click: tab to front,
// debugger attached only briefly, center re-measured after attaching, every step bounded.
async function trustedHover(tabId, x, y, selector) {
  await step('mostrar la pestaña de Flow', bringTabToFront(tabId));
  const target = { tabId };
  await step('conectar el depurador', chrome.debugger.attach(target, '1.3'));
  try {
    const point = await step('medir el vídeo', measureCenter(target, selector, { x, y }));
    const base = { x: point.x, y: point.y, button: 'none', clickCount: 0, type: 'mouseMoved' };
    // A small approach move first so the page sees the pointer enter the tile
    await step('mover el ratón', chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { ...base, x: point.x - 6, y: point.y - 6 }));
    await step('mover el ratón', chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', base));
    // Keep the debugger attached briefly so the hover handler runs while the pointer is there
    await new Promise((resolve) => setTimeout(resolve, 600));
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'flow-trusted-hover') return false;
  const tabId = sender.tab?.id;
  const { x, y, selector } = message;
  if (tabId === undefined || !sender.url?.startsWith(`${FLOW_ORIGIN}/`) || !Number.isFinite(x) || !Number.isFinite(y)) {
    sendResponse({ ok: false, error: 'Solicitud de hover no válida.' });
    return false;
  }
  trustedHover(tabId, x, y, selector)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

function flowProjectId(url) {
  return FLOW_PROJECT_PATTERN.exec(url ?? '')?.[1] ?? null;
}

// Flow home for the same Google account as url ("https://flow.google.com/u/4/" keeps account 4)
function flowHomeFor(url) {
  const account = /^https:\/\/flow\.google\.com\/(u\/\d+\/)/.exec(url ?? '')?.[1] ?? '';
  return `${FLOW_HOME_URL}${account}`;
}

// Reuse a Flow tab (preferring one already on the project) or open one; navigate when needed
async function prepareFlowTab(projectUrl) {
  const tabs = await chrome.tabs.query({ url: `${FLOW_ORIGIN}/*` });
  const projectId = flowProjectId(projectUrl);
  // A new project starts from a tab that is not inside another project
  let tab = projectId
    ? tabs.find((item) => flowProjectId(item.url) === projectId)
    : tabs.find((item) => !flowProjectId(item.url));
  if (!tab) tab = tabs[0];
  const target = projectUrl || flowHomeFor(tab?.url);

  if (!tab) {
    tab = await chrome.tabs.create({ url: target, active: false });
  } else {
    const onTarget = projectId ? flowProjectId(tab.url) === projectId : !flowProjectId(tab.url);
    if (onTarget) return tab.id;
    tab = await chrome.tabs.update(tab.id, { url: target });
  }
  await waitForTabComplete(tab.id, 'Flow');
  return tab.id;
}

// A deleted project redirects to /404?reason=project, possibly after load via pushState, so poll briefly.
// Returns the project URL as the tab shows it (Flow may add the account prefix), or null when it is gone
async function projectStillExists(tabId, projectUrl) {
  const projectId = flowProjectId(projectUrl);
  const deadline = Date.now() + 4000;
  let tab = null;
  while (Date.now() < deadline) {
    tab = await chrome.tabs.get(tabId);
    if (flowProjectId(tab.url) !== projectId) return null;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return FLOW_PROJECT_PATTERN.exec(tab.url)[0];
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
  throw new Error('Flow no abrió el nuevo proyecto.');
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
      if (removedId === tabId) finish(new Error(`La pestaña de ${label} se cerró antes de terminar el trabajo.`));
    };
    const onUpdated = (updatedId, info) => {
      if (updatedId === tabId && stayOn && info.url && !info.url.startsWith(stayOn)) {
        finish(new Error(`La pestaña de ${label} cambió de página antes de terminar el trabajo.`));
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
    const timer = setTimeout(() => finish(new Error(`Se agotó el tiempo esperando a ${label}.`)), timeoutMs);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.onUpdated.addListener(onUpdated);
    port.onMessage.addListener((message) => {
      onMessage?.(message);
      if (message.type === 'error') finish(new Error(message.message));
      else if (message.type === settleOn) finish(null, message);
    });
    port.onDisconnect.addListener(() => finish(new Error(`La página de ${label} se cerró o se recargó antes de terminar el trabajo.`)));
    port.postMessage(command);
  });
}

// model / outputs / references (and, for kind 'animate', sourceAssetId / video) travel to the Flow tab
// untouched; flow.js decides what to do with them
async function handleFlowGenerate({ requestId, prompt, projectUrl, model, outputs, references, kind, sourceAssetId, video, aspect, orientation }) {
  if (flowBusy) {
    send({ type: 'flow-error', requestId, message: 'Ya hay otro trabajo de Flow en curso.' });
    return;
  }
  flowBusy = true;
  try {
    let currentProject = projectUrl && FLOW_PROJECT_PATTERN.test(projectUrl) ? projectUrl : null;
    const tabId = await prepareFlowTab(currentProject);
    if (currentProject) {
      const liveProject = await projectStillExists(tabId, currentProject);
      if (!liveProject) {
        // The saved project was deleted in Flow: start a new one (same account) instead of failing
        const { url } = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId, { url: flowHomeFor(url?.includes('/u/') ? url : currentProject) });
        await waitForTabComplete(tabId, 'Flow');
      }
      currentProject = liveProject;
    }
    await ensureContentScript(tabId, 'flow.js', 'Flow');

    if (!currentProject) {
      // The click can navigate the page, which drops the port; the tab URL is the source of truth
      await runTabStep(tabId, { type: 'new-project' }, { settleOn: 'clicked', timeoutMs: FLOW_STEP_TIMEOUT_MS }).catch(
        (error) => {
          if (!/se cerró o se recargó/.test(error.message)) throw error;
        },
      );
      currentProject = await waitForProjectUrl(tabId);
      send({ type: 'flow-project', requestId, projectUrl: currentProject });
      await waitForTabComplete(tabId, 'Flow');
      await ensureContentScript(tabId, 'flow.js', 'Flow');
    }

    // A hidden tab does not render the virtualized grid while it scrolls, so a sheet or scene far down
    // would never appear and the job would fall back to uploading it; show the tab before searching
    if (sourceAssetId || references?.some((reference) => reference?.assetId)) await bringTabToFront(tabId);

    const result = await runTabStep(
      tabId,
      { type: 'generate', prompt, model, outputs, references, kind, sourceAssetId, video, aspect, orientation },
      {
        settleOn: 'result',
        timeoutMs: kind === 'animate' ? FLOW_ANIMATE_TIMEOUT_MS : FLOW_JOB_TIMEOUT_MS,
        stayOn: currentProject,
        onMessage: (message) => {
          if (message.type === 'progress') send({ type: 'flow-progress', requestId, percent: message.percent });
          else if (message.type === 'captcha') send({ type: 'flow-captcha', requestId, active: message.active === true });
        },
      },
    );
    send({ type: 'flow-result', requestId, projectUrl: currentProject, images: result.images, videos: result.videos, submitMethod: result.submitMethod ?? null });
  } catch (error) {
    send({ type: 'flow-error', requestId, message: error.message });
  } finally {
    flowBusy = false;
  }
}

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
