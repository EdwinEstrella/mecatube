// Content script for chat.deepseek.com.
// Pastes the prompt, sends it, and streams the assistant reply back through a port.
// It does nothing else: no other page content is read or modified.

// FRAGILE: every DeepSeek DOM selector lives here. If DeepSeek changes its markup,
// adjust only this object.
const SELECTORS = {
  // Prompt input (React-controlled textarea)
  input: 'textarea#chat-input, textarea',
  // Send button; DeepSeek uses a div[role="button"] next to the input
  sendButton: 'div[role="button"][aria-disabled], div[role="button"]',
  // Present only while a reply is being generated (turns the send button into "stop")
  stopButton: 'div[role="button"] svg rect, button svg rect, [aria-label*="Stop" i], [aria-label*="Detener" i], [aria-label*="Parar" i], [title*="Stop" i], [title*="Detener" i], [title*="Parar" i]',
  // Rendered assistant reply (markdown container); one match per assistant message
  assistantMessage: '.ds-markdown',
  // "Thinking" block inside a reply; its text is skipped
  thinkingBlock: '.ds-think-content, [class*="think" i]',
};

// FRAGILE: DeepSeek's internal history API (same origin, authenticated with the page's own token).
// Observed 2026-10-25, internal API, may change. It returns the original Markdown of every message,
// so it is the source of truth for the final reply (the DOM can lag behind while the tab is in the
// background and code blocks are still being rendered).
const HISTORY_API = {
  path: '/api/v0/chat/history_messages',
  sessionParam: 'chat_session_id',
  // localStorage key holding the bearer token: JSON `{ value: "..." }` or a raw string
  tokenKey: 'userToken',
  // Response shape: data.biz_data.chat_messages[]
  messagesPath: ['data', 'biz_data', 'chat_messages'],
  roleUser: 'USER',
  roleAssistant: 'ASSISTANT',
  statusFinished: 'FINISHED',
  fragmentRequest: 'REQUEST',
  // Thinking is a separate fragment type and is deliberately excluded
  fragmentResponse: 'RESPONSE',
  // Chat page path: /a/chat/s/<sessionId>
  sessionPath: /\/a\/chat\/s\/([\w-]+)/,
};

const DELTA_THROTTLE_MS = 150;
const STABLE_MS = 3500;
const TIMEOUT_MS = 5 * 60 * 1000;
const POLL_MS = 250;
const URL_WAIT_MS = 3000;
const API_POLL_MS = 2500;
// Consecutive failed history reads before the reply falls back to the DOM text
const API_MAX_FAILURES = 8;
// Fallback without the API: the DOM text must stay untouched this long
const DOM_FALLBACK_STABLE_MS = 8000;
// The API keeps saying "pending" although the DOM has been done and still for this long: trust the DOM
const API_PENDING_GRACE_MS = 60000;
const HISTORY_FETCH_TIMEOUT_MS = 20000;

// --- Pure history helpers (exported for tests) -------------------------------------------------

function sessionIdFromUrl(url) {
  const match = HISTORY_API.sessionPath.exec(String(url ?? ''));
  return match ? match[1] : null;
}

// The stored token is either JSON `{ value }` or a raw string
function parseToken(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed || null;
    if (parsed && typeof parsed.value === 'string') return parsed.value || null;
    return null;
  } catch {
    return raw.trim();
  }
}

// The chat_messages array of a history response, or null when the shape is not what we expect
function historyMessages(json) {
  let node = json;
  for (const key of HISTORY_API.messagesPath) {
    if (!node || typeof node !== 'object') return null;
    node = node[key];
  }
  return Array.isArray(node) ? node : null;
}

// Joined content of one kind of fragment (REQUEST or RESPONSE) of a history message
function fragmentsText(message, type) {
  if (!message || !Array.isArray(message.fragments)) return '';
  return message.fragments
    .filter((fragment) => fragment && fragment.type === type && typeof fragment.content === 'string')
    .map((fragment) => fragment.content)
    .join('');
}

// Final reply from a history response. minCount is the number of messages the chat had before the
// prompt was sent, so an older finished reply is never mistaken for the new one.
//   { status: 'done', text }        the last message is a finished reply
//   { status: 'pending' }           the reply is still being written (or not there yet)
//   { status: 'error', reason }     unexpected shape or an empty finished reply
function extractFinalText(historyJson, minCount = 0) {
  const messages = historyMessages(historyJson);
  if (!messages) return { status: 'error', reason: 'shape' };
  if (messages.length <= minCount) return { status: 'pending' };
  const last = messages[messages.length - 1];
  if (!last || last.role !== HISTORY_API.roleAssistant) return { status: 'pending' };
  if (last.status !== HISTORY_API.statusFinished || last.has_pending_fragment) return { status: 'pending' };
  const text = fragmentsText(last, HISTORY_API.fragmentResponse).trim();
  if (!text) return { status: 'error', reason: 'empty' };
  return { status: 'done', text };
}

// Whole history as [{ role: 'user' | 'assistant', content }] (messages with another role are skipped)
function extractHistoryMessages(historyJson) {
  const messages = historyMessages(historyJson);
  if (!messages) return null;
  const out = [];
  for (const message of messages) {
    if (message?.role === HISTORY_API.roleUser) {
      out.push({ role: 'user', content: fragmentsText(message, HISTORY_API.fragmentRequest) });
    } else if (message?.role === HISTORY_API.roleAssistant) {
      out.push({ role: 'assistant', content: fragmentsText(message, HISTORY_API.fragmentResponse).trim() });
    }
  }
  return out;
}

// DOM -> Markdown conversion of a reply. Walks the live container (innerText on a detached
// clone has no layout and loses all line breaks) and skips thinking blocks.

// DOM -> Markdown conversion of a reply. Walks the live container (innerText on a detached
// clone has no layout and loses all line breaks) and skips thinking blocks.
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI',
  'BLOCKQUOTE', 'PRE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'HR', 'DETAILS', 'FIGURE',
]);

function isSkipped(node) {
  return node.nodeType === Node.ELEMENT_NODE && node.matches(SELECTORS.thinkingBlock);
}

function hasBlockDescendant(el) {
  return Boolean(el.querySelector('p, div, ul, ol, pre, table, blockquote, h1, h2, h3, h4, h5, h6, hr'));
}

function isMath(el) {
  return el.classList.contains('katex') || el.classList.contains('katex-display');
}

// Prefers the TeX source; falls back to the rendered text
function mathText(el) {
  const tex = el.querySelector('annotation[encoding="application/x-tex"]');
  const text = (tex ? tex.textContent : (el.querySelector('.katex-html') || el).textContent).trim();
  return el.classList.contains('katex-display') ? `$$\n${text}\n$$` : `$${text}$`;
}

// Keeps surrounding whitespace outside the emphasis markers
function wrapInline(content, marker) {
  const match = content.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match[2]) return content;
  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

function fenceFor(text, minLength) {
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map((run) => run.length));
  return '`'.repeat(Math.max(minLength, longest + 1));
}

function plainText(node) {
  return node.textContent.replace(/\s+/g, ' ').replace(/</g, '\\<');
}

function inlineOf(parent) {
  let out = '';
  for (const node of parent.childNodes) {
    if (isSkipped(node)) continue;
    if (node.nodeType === Node.TEXT_NODE) out += plainText(node);
    else if (node.nodeType === Node.ELEMENT_NODE) out += inlineElement(node);
  }
  return out;
}

function inlineElement(el) {
  if (isMath(el)) return mathText(el);
  switch (el.tagName) {
    case 'BR':
      return '  \n';
    case 'STRONG':
    case 'B':
      return wrapInline(inlineOf(el), '**');
    case 'EM':
    case 'I':
      return wrapInline(inlineOf(el), '*');
    case 'DEL':
    case 'S':
      return wrapInline(inlineOf(el), '~~');
    case 'CODE': {
      const text = el.textContent;
      if (!text.trim()) return text;
      const fence = fenceFor(text, 1);
      const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
      return `${fence}${pad}${text}${pad}${fence}`;
    }
    case 'A': {
      const label = inlineOf(el);
      const href = el.getAttribute('href') || '';
      return /^https?:\/\//i.test(href) && label.trim() ? `[${label.trim()}](${href})` : label;
    }
    case 'IMG':
    case 'SCRIPT':
    case 'STYLE':
    case 'BUTTON':
      return '';
    default:
      return inlineOf(el);
  }
}

// Language from `language-xxx` on the code/pre element, else from a short header label
function codeLanguage(wrapper, pre) {
  const holders = [pre.querySelector('code'), pre, wrapper].filter(Boolean);
  for (const holder of holders) {
    const match = /(?:^|\s)language-([\w+#.-]+)/.exec(holder.className || '');
    if (match) return match[1];
  }
  if (wrapper !== pre) {
    for (const el of wrapper.querySelectorAll('span, div')) {
      if (el.contains(pre) || pre.contains(el) || el.children.length) continue;
      const label = el.textContent.trim();
      if (/^[A-Za-z][\w+#.-]{0,19}$/.test(label) && !/^(copy|copied|download|run|edit)$/i.test(label)) {
        return label.toLowerCase();
      }
    }
  }
  return '';
}

function codeBlock(wrapper, pre) {
  const code = pre.textContent.replace(/\n$/, '');
  const fence = fenceFor(code, 3);
  return { type: 'code', text: `${fence}${codeLanguage(wrapper, pre)}\n${code}\n${fence}` };
}

// DeepSeek wraps each code block in a div with a header (language + Copy button) before the pre
function isCodeWrapper(el) {
  if (el.tagName === 'PRE' || !el.querySelector('pre')) return false;
  if (/code-block/i.test(el.className)) return true;
  const hasDirectPre = Array.from(el.children).some((child) => child.tagName === 'PRE');
  const hasText = el.querySelector(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > ul, :scope > ol, :scope > table, :scope > blockquote');
  return hasDirectPre && !hasText;
}

function tableBlock(table) {
  const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.children)
      .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
      .map((cell) => inlineOf(cell).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()),
  );
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (!width) return null;
  const pad = (row) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? '').join(' | ')} |`;
  const [head, ...body] = rows;
  const lines = [pad(head), `| ${Array(width).fill('---').join(' | ')} |`, ...body.map(pad)];
  return { type: 'table', text: lines.join('\n') };
}

function listBlock(list) {
  const ordered = list.tagName === 'OL';
  const start = ordered ? parseInt(list.getAttribute('start') || '1', 10) || 1 : 1;
  const items = [];
  let index = 0;
  for (const child of list.children) {
    if (child.tagName !== 'LI' || isSkipped(child)) continue;
    const marker = ordered ? `${start + index}. ` : '- ';
    index += 1;
    const body = joinBlocks(blocksOf(child), true);
    const indent = ' '.repeat(marker.length);
    items.push(marker + body.split('\n').map((line, i) => (i === 0 || !line ? line : indent + line)).join('\n'));
  }
  return items.length ? { type: 'list', text: items.join('\n') } : null;
}

function blockElement(el) {
  if (isMath(el)) return [{ type: 'p', text: mathText(el) }];
  if (isCodeWrapper(el)) return [codeBlock(el, el.querySelector('pre'))];
  const tag = el.tagName;
  if (tag === 'PRE') return [codeBlock(el, el)];
  if (tag === 'HR') return [{ type: 'p', text: '---' }];
  if (/^H[1-6]$/.test(tag)) {
    const text = inlineOf(el).trim();
    return text ? [{ type: 'p', text: `${'#'.repeat(Number(tag[1]))} ${text}` }] : [];
  }
  if (tag === 'P') {
    const text = inlineOf(el).trim();
    return text ? [{ type: 'p', text }] : [];
  }
  if (tag === 'UL' || tag === 'OL') {
    const block = listBlock(el);
    return block ? [block] : [];
  }
  if (tag === 'TABLE') {
    const block = tableBlock(el);
    return block ? [block] : [];
  }
  if (tag === 'BLOCKQUOTE') {
    const inner = joinBlocks(blocksOf(el), false);
    if (!inner) return [];
    return [{ type: 'quote', text: inner.split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n') }];
  }
  return blocksOf(el);
}

// Splits an element's children into Markdown blocks; loose inline content becomes paragraphs
function blocksOf(parent) {
  const blocks = [];
  let run = '';
  const flush = () => {
    const text = run.trim();
    if (text) blocks.push({ type: 'p', text });
    run = '';
  };
  for (const node of parent.childNodes) {
    if (isSkipped(node)) continue;
    if (node.nodeType === Node.TEXT_NODE) {
      run += plainText(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const isBlock = isMath(node)
        ? node.classList.contains('katex-display')
        : BLOCK_TAGS.has(node.tagName) || hasBlockDescendant(node);
      if (isBlock) {
        flush();
        blocks.push(...blockElement(node));
      } else {
        run += inlineElement(node);
      }
    }
  }
  flush();
  return blocks;
}

// Tight joining (inside list items) keeps a nested list directly under its parent line
function joinBlocks(blocks, tight) {
  let out = '';
  blocks.forEach((block, i) => {
    if (i > 0) out += tight && block.type === 'list' ? '\n' : '\n\n';
    out += block.text;
  });
  return out;
}

function toMarkdown(container) {
  return joinBlocks(blocksOf(container), false).replace(/\n{3,}/g, '\n\n').trim();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HISTORY_API,
    sessionIdFromUrl,
    parseToken,
    historyMessages,
    fragmentsText,
    extractFinalText,
    extractHistoryMessages,
    toMarkdown,
  };
}

if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && !window.__mecatubeBridgeLoaded) {
  window.__mecatubeBridgeLoaded = true;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(getter, timeoutMs, message) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = getter();
      if (value) return value;
      await sleep(POLL_MS);
    }
    throw new Error(message);
  }

  function findInput() {
    return document.querySelector(SELECTORS.input);
  }

  function findSendButton(input) {
    // Prefer the button closest to the input; fall back to the last match on the page
    const scope = input.closest('form') || input.parentElement?.parentElement?.parentElement || document;
    const inScope = scope.querySelectorAll(SELECTORS.sendButton);
    const all = inScope.length ? inScope : document.querySelectorAll(SELECTORS.sendButton);
    return all[all.length - 1] || null;
  }

  function isGenerating() {
    return Boolean(document.querySelector(SELECTORS.stopButton));
  }

  // Reply as Markdown (see toMarkdown); thinking blocks are skipped
  // Reply as Markdown (see toMarkdown); thinking blocks are skipped
  function readText(container) {
    return toMarkdown(container);
  }

  // Replies to read: all markdown containers that are not inside a thinking block
  function assistantContainers() {
    return Array.from(document.querySelectorAll(SELECTORS.assistantMessage)).filter(
      (node) => !node.closest(SELECTORS.thinkingBlock),
    );
  }

  // Sets a React-controlled textarea value so React notices the change
  function setInputValue(input, text) {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function submit(input) {
    const enter = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent('keydown', enter));
    input.dispatchEvent(new KeyboardEvent('keyup', enter));

    // Fallback: if the text is still in the input shortly after, click the send button
    setTimeout(() => {
      if (input.value.trim()) findSendButton(input)?.click();
    }, 400);
  }

  // Reads the bearer token from the page's own storage; it is only ever used for the same-origin
  // history request below and is never logged, stored or sent anywhere else.
  function readToken() {
    try {
      return parseToken(window.localStorage.getItem(HISTORY_API.tokenKey));
    } catch {
      return null;
    }
  }

  // Full chat history JSON for a session. Throws a generic Error (no token, no response body).
  async function fetchHistory(sessionId) {
    const token = readToken();
    if (!token) throw new Error('DeepSeek token not available.');
    const url = `${location.origin}${HISTORY_API.path}?${HISTORY_API.sessionParam}=${encodeURIComponent(sessionId)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HISTORY_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`DeepSeek history request failed (HTTP ${response.status}).`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Number of messages the chat already has (0 for a chat that does not exist yet); null when unknown
  async function historyCount(sessionId) {
    if (!sessionId) return 0;
    try {
      return historyMessages(await fetchHistory(sessionId))?.length ?? null;
    } catch {
      return null;
    }
  }

  async function runPrompt(text, port) {
    const input = await waitFor(findInput, 15000, 'DeepSeek input box not found.');
    const countBefore = assistantContainers().length;
    // Messages already in the chat: the final reply must come after them. If the baseline cannot be
    // read, each earlier assistant message is assumed to have a user message before it.
    const historyBefore = (await historyCount(sessionIdFromUrl(location.href))) ?? countBefore * 2;

    setInputValue(input, text);
    await sleep(150);
    submit(input);

    const startedAt = Date.now();
    const container = await waitFor(
      () => {
        const all = assistantContainers();
        return all.length > countBefore ? all[all.length - 1] : null;
      },
      60000,
      'No reply appeared in DeepSeek.',
    );

    let lastText = '';
    let lastChange = Date.now();
    let lastMutation = Date.now();
    let lastSent = 0;

    const sendDelta = (force) => {
      const current = readText(container);
      if (current !== lastText) {
        lastText = current;
        lastChange = Date.now();
      }
      const now = Date.now();
      if (current && (force || now - lastSent >= DELTA_THROTTLE_MS)) {
        lastSent = now;
        port.postMessage({ type: 'delta', text: current });
      }
    };

    const observer = new MutationObserver(() => {
      lastMutation = Date.now();
      sendDelta(false);
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    // The DOM drives the live `delta` display only. The final text comes from the history API
    // (original Markdown, complete code blocks) once the reply is FINISHED; the DOM text is the
    // fallback when the API cannot be used.
    let finalText = null;
    let source = 'api';
    let apiFailures = 0;
    let apiPoll = 0;
    let domDoneSince = null;

    try {
      while (finalText === null) {
        if (Date.now() - startedAt > TIMEOUT_MS) throw new Error('Timed out waiting for the DeepSeek reply.');
        await sleep(POLL_MS);
        sendDelta(false);

        const now = Date.now();
        const domDone = Boolean(lastText) && !isGenerating() && now - lastChange >= STABLE_MS;
        if (domDone && domDoneSince === null) domDoneSince = now;
        if (!domDone) domDoneSince = null;

        const apiUsable = apiFailures < API_MAX_FAILURES;
        if (apiUsable && now - apiPoll >= API_POLL_MS) {
          apiPoll = now;
          const sessionId = sessionIdFromUrl(location.href);
          if (sessionId) {
            try {
              const result = extractFinalText(await fetchHistory(sessionId), historyBefore);
              if (result.status === 'done') {
                finalText = result.text;
                break;
              }
              apiFailures = result.status === 'error' ? apiFailures + 1 : 0;
            } catch {
              apiFailures += 1;
            }
          }
        }

        if (!apiUsable) {
          // No API: accept the DOM text only after generation stopped and nothing changed for a while
          if (domDone && now - lastMutation >= DOM_FALLBACK_STABLE_MS) {
            finalText = lastText;
            source = 'dom';
          }
        } else if (domDoneSince !== null && now - domDoneSince >= API_PENDING_GRACE_MS) {
          // The API has not confirmed the reply long after the DOM went quiet: stop waiting for it
          finalText = lastText;
          source = 'dom';
        }
      }
    } finally {
      observer.disconnect();
    }

    // Show the final text before `done`, so the live view matches what gets stored
    port.postMessage({ type: 'delta', text: finalText });

    // DeepSeek moves a new chat to /a/chat/s/<id> after the first message
    await waitFor(() => /\/a\/chat\/s\//.test(location.href), URL_WAIT_MS, '').catch(() => {});
    port.postMessage({ type: 'done', text: finalText, deepseekUrl: location.href, source });
  }

  // Whole history of the chat in the current tab, for repairing stored conversations
  async function runHistory(deepseekUrl, port) {
    const sessionId = sessionIdFromUrl(deepseekUrl);
    if (!sessionId) throw new Error('La URL del chat de DeepSeek no es válida.');
    let json;
    try {
      json = await fetchHistory(sessionId);
    } catch (error) {
      throw new Error(`No se pudo leer el historial de DeepSeek: ${error.message}`);
    }
    const messages = extractHistoryMessages(json);
    if (!messages) throw new Error('DeepSeek devolvió un formato de historial inesperado.');
    port.postMessage({ type: 'history', messages });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'ping') sendResponse({ ok: true });
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'mecatube-prompt' && port.name !== 'mecatube-history') return;
    const reportError = (error) => {
      try {
        port.postMessage({ type: 'error', message: error.message });
      } catch {
        // Port already closed
      }
    };
    port.onMessage.addListener((message) => {
      if (port.name === 'mecatube-prompt' && message.type === 'prompt') {
        runPrompt(message.text, port).catch(reportError);
      } else if (port.name === 'mecatube-history' && message.type === 'history') {
        runHistory(message.deepseekUrl, port).catch(reportError);
      }
    });
  });
}
