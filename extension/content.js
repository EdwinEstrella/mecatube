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
  stopButton: 'div[role="button"] svg rect, [aria-label*="Stop" i]',
  // Rendered assistant reply (markdown container); one match per assistant message
  assistantMessage: '.ds-markdown',
  // "Thinking" block inside a reply; its text is skipped
  thinkingBlock: '.ds-think-content, [class*="think" i]',
};

const DELTA_THROTTLE_MS = 150;
const STABLE_MS = 1500;
const TIMEOUT_MS = 5 * 60 * 1000;
const POLL_MS = 250;
const URL_WAIT_MS = 3000;

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

if (!window.__mecatubeBridgeLoaded) {
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

  async function runPrompt(text, port) {
    const input = await waitFor(findInput, 15000, 'DeepSeek input box not found.');
    const countBefore = assistantContainers().length;

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

    const observer = new MutationObserver(() => sendDelta(false));
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    try {
      // Done when generation has stopped and the text has been stable for a while
      while (true) {
        if (Date.now() - startedAt > TIMEOUT_MS) throw new Error('Timed out waiting for the DeepSeek reply.');
        await sleep(POLL_MS);
        sendDelta(false);
        if (lastText && !isGenerating() && Date.now() - lastChange >= STABLE_MS) break;
      }
    } finally {
      observer.disconnect();
    }

    sendDelta(true);

    // DeepSeek moves a new chat to /a/chat/s/<id> after the first message
    await waitFor(() => /\/a\/chat\/s\//.test(location.href), URL_WAIT_MS, '').catch(() => {});
    port.postMessage({ type: 'done', text: lastText, deepseekUrl: location.href });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'ping') sendResponse({ ok: true });
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'mecatube-prompt') return;
    port.onMessage.addListener((message) => {
      if (message.type !== 'prompt') return;
      runPrompt(message.text, port).catch((error) => {
        try {
          port.postMessage({ type: 'error', message: error.message });
        } catch {
          // Port already closed
        }
      });
    });
  });
}
