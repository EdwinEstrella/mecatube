// Content script for flow.google.com (Google Flow).
// Creates a project on request, inserts a prompt, submits it, waits for the generation and returns
// the new images through a port. It never clicks anything else and never touches a CAPTCHA: when
// a challenge shows up it only reports it and keeps waiting for the user to solve it.
(function mecatubeFlow() {
  if (typeof window !== 'undefined' && window.__mecatubeFlowLoaded) return;
  if (typeof window !== 'undefined') window.__mecatubeFlowLoaded = true;

  // FRAGILE: every Flow DOM selector and visible string lives here. They were observed live on
  // 2026-10-25 on a Spanish-language account; if Flow changes its markup or locale, adjust only
  // this object.
  const SELECTORS = {
    // Prompt box (ProseMirror editor)
    promptBox: 'div.ProseMirror[role="textbox"][contenteditable="true"]',
    // Submit button (type=submit); its label becomes "Detener" while a generation runs
    submitButton: 'button[aria-label="Iniciar generación"]',
    stopButton: 'button[aria-label="Detener"]',
    // Result tiles
    resultImage: 'img.image[alt="Recuadro que muestra la imagen del usuario"]',
    // Visible text of the home page button that creates a project (matched case/accent-insensitively)
    newProjectText: 'nuevo proyecto',
    // Placeholder tiles show "NN %" while generating
    percentText: /^(\d{1,3})\s?%$/,
    // reCAPTCHA challenge iframe (the badge iframe is "anchor"; the visible challenge is "bframe")
    captchaFrame: 'iframe[src*="recaptcha"][src*="bframe"]',
    // Project URL: https://flow.google.com/project/<uuid>
    projectPath: /^\/project\/([0-9a-f-]{36})(?:\/|$)/,
  };

  const POLL_MS = 700;
  const BOX_TIMEOUT_MS = 30000;
  const SUBMIT_ENABLE_TIMEOUT_MS = 10000;
  const GRACE_MS = 10000;
  const STABLE_POLLS = 3;
  const JOB_TIMEOUT_MS = 5 * 60 * 1000;
  const MIN_CAPTCHA_SIZE = 200;

  // --- Pure helpers (exported for tests) -------------------------------------------------------

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalizeText(text) {
    return String(text ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Highest "NN %" shown by any placeholder tile, or null when none is visible
  function parsePercent(doc) {
    const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */);
    let best = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const match = SELECTORS.percentText.exec(node.nodeValue.trim());
      if (!match) continue;
      const value = Math.min(100, Number(match[1]));
      best = best === null ? value : Math.max(best, value);
    }
    return best;
  }

  function isGenerating(doc) {
    return Boolean(doc.querySelector(SELECTORS.stopButton)) || parsePercent(doc) !== null;
  }

  function imageSources(doc) {
    const sources = [];
    doc.querySelectorAll(SELECTORS.resultImage).forEach((img) => {
      const src = img.currentSrc || img.src || img.getAttribute('src');
      if (src && !sources.includes(src)) sources.push(src);
    });
    return sources;
  }

  // Result images whose src was not in `snapshot` (a Set of src strings), as { src, img }
  function newImages(doc, snapshot) {
    const found = [];
    const seen = new Set();
    doc.querySelectorAll(SELECTORS.resultImage).forEach((img) => {
      const src = img.currentSrc || img.src || img.getAttribute('src');
      if (!src || snapshot.has(src) || seen.has(src)) return;
      seen.add(src);
      found.push({ src, img });
    });
    return found;
  }

  function isElementVisible(el, win) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const style = win.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width >= MIN_CAPTCHA_SIZE && rect.height >= MIN_CAPTCHA_SIZE && rect.right > 0 && rect.bottom > 0;
  }

  // True while a reCAPTCHA challenge is on screen. The invisible badge and off-screen/zero-size
  // frames do not count.
  function isCaptchaVisible(doc) {
    const win = doc.defaultView;
    return Array.from(doc.querySelectorAll(SELECTORS.captchaFrame)).some((frame) => isElementVisible(frame, win));
  }

  function findNewProjectButton(doc) {
    return (
      Array.from(doc.querySelectorAll('button, [role="button"]')).find((el) =>
        normalizeText(el.textContent).includes(SELECTORS.newProjectText),
      ) ?? null
    );
  }

  // Base project URL ("https://flow.google.com/project/<uuid>") for a location, or null
  function projectUrlFrom(location) {
    if (location.origin !== 'https://flow.google.com') return null;
    const match = SELECTORS.projectPath.exec(location.pathname);
    return match ? `${location.origin}/project/${match[1]}` : null;
  }

  // Clears the editor and types the prompt the way a user paste would
  function insertPrompt(doc, box, text) {
    box.focus();
    doc.execCommand('selectAll', false, null);
    doc.execCommand('delete', false, null);
    doc.execCommand('insertText', false, text);
  }

  // Whitespace-insensitive comparison: the editor may turn newlines into paragraphs
  function boxMatches(box, text) {
    const squash = (value) => String(value ?? '').replace(/\s+/g, '');
    return squash(box.textContent) === squash(text);
  }

  function isEnabled(button) {
    return Boolean(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function waitFor(check, timeoutMs, intervalMs = 250) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = check();
      if (value) return value;
      if (Date.now() >= deadline) return null;
      await sleep(intervalMs);
    }
  }

  // --- Jobs ------------------------------------------------------------------------------------

  async function fetchImage(entry) {
    const response = await fetch(entry.src, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {
      mime: blob.type || response.headers.get('content-type') || 'image/webp',
      base64: bytesToBase64(bytes),
      width: entry.img.naturalWidth || 0,
      height: entry.img.naturalHeight || 0,
      sourceUrl: entry.src,
    };
  }

  // post(message) sends { type, ... } to the service worker; throws are reported by the caller
  async function runGenerate({ prompt }, post, doc = document, now = Date.now) {
    const box = await waitFor(() => doc.querySelector(SELECTORS.promptBox), BOX_TIMEOUT_MS);
    if (!box) throw new Error('Flow prompt box not found. Is the project open and signed in?');

    const snapshot = new Set(imageSources(doc));
    insertPrompt(doc, box, prompt);
    await sleep(150);
    if (!boxMatches(box, prompt)) throw new Error('Flow did not accept the prompt text.');

    const submit = await waitFor(() => {
      const button = doc.querySelector(SELECTORS.submitButton);
      return isEnabled(button) ? button : null;
    }, SUBMIT_ENABLE_TIMEOUT_MS);
    if (!submit) throw new Error('The Flow submit button never became available.');

    const startedAt = now();
    submit.click();

    let sawGenerating = false;
    let captchaShown = false;
    let lastPercent = null;
    let stableCount = 0;
    let stableSize = -1;

    for (;;) {
      await sleep(POLL_MS);
      if (now() - startedAt > JOB_TIMEOUT_MS) throw new Error('Timed out waiting for Flow to finish generating.');

      const captcha = isCaptchaVisible(doc);
      if (captcha !== captchaShown) {
        captchaShown = captcha;
        post({ type: 'captcha', active: captcha });
      }

      const percent = parsePercent(doc);
      if (percent !== null && percent !== lastPercent) {
        lastPercent = percent;
        post({ type: 'progress', percent });
      }

      const generating = isGenerating(doc);
      if (generating) sawGenerating = true;
      if (generating || captcha) {
        stableCount = 0;
        continue;
      }
      // Generation has not visibly started yet; give the page a moment before trusting "idle"
      if (!sawGenerating && now() - startedAt < GRACE_MS) continue;

      const fresh = newImages(doc, snapshot);
      if (fresh.length === 0) continue;
      stableCount = fresh.length === stableSize ? stableCount + 1 : 1;
      stableSize = fresh.length;
      if (stableCount < STABLE_POLLS) continue;

      const images = [];
      for (const entry of fresh) {
        try {
          images.push(await fetchImage(entry));
        } catch {
          // A single failed download should not lose the others
        }
      }
      if (images.length === 0) throw new Error('Flow produced images but they could not be downloaded.');
      return images;
    }
  }

  async function runNewProject(post, doc = document) {
    const button = await waitFor(() => findNewProjectButton(doc), BOX_TIMEOUT_MS);
    if (!button) throw new Error('The "Nuevo proyecto" button was not found. Is Flow open and signed in?');
    button.click();
    post({ type: 'clicked' });
  }

  let busy = false;

  function handlePort(port) {
    if (port.name !== 'mecatube-flow') return;
    let open = true;
    port.onDisconnect.addListener(() => {
      open = false;
    });
    const post = (message) => {
      if (open) port.postMessage(message);
    };

    port.onMessage.addListener(async (message) => {
      if (message?.type !== 'generate' && message?.type !== 'new-project') return;
      if (busy) {
        post({ type: 'error', message: 'Flow is already running a job in this tab.' });
        return;
      }
      busy = true;
      try {
        if (message.type === 'new-project') {
          await runNewProject(post);
        } else {
          const images = await runGenerate({ prompt: String(message.prompt ?? '') }, post);
          post({ type: 'result', images });
        }
      } catch (error) {
        post({ type: 'error', message: error?.message ?? String(error) });
      } finally {
        busy = false;
      }
    });
  }

  const api = {
    SELECTORS,
    normalizeText,
    parsePercent,
    isGenerating,
    imageSources,
    newImages,
    isCaptchaVisible,
    findNewProjectButton,
    projectUrlFrom,
    insertPrompt,
    boxMatches,
    isEnabled,
    bytesToBase64,
    runGenerate,
    runNewProject,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof chrome !== 'undefined' && chrome.runtime?.onConnect) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'ping') sendResponse({ ok: true });
    });
    chrome.runtime.onConnect.addListener(handlePort);
  }
})();
