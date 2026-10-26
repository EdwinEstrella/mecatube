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
    resultImage:
      'img.image[alt="Recuadro que muestra la imagen del usuario"], img.image[alt="Tarjeta que muestra la imagen de un usuario"]',
    // Visible text of the home page button that creates a project (matched case/accent-insensitively)
    // (the wording differs between accounts: "Nuevo proyecto" / "Proyecto nuevo")
    newProjectTexts: ['nuevo proyecto', 'proyecto nuevo'],
    // Placeholder tiles show "NN %" while generating
    percentText: /^(\d{1,3})\s?%$/,
    // reCAPTCHA challenge iframe (the badge iframe is "anchor"; the visible challenge is "bframe")
    captchaFrame: 'iframe[src*="recaptcha"][src*="bframe"]',
    // Project URL: https://flow.google.com/[u/<n>/]project/<uuid>
    projectPath: /^\/((?:u\/\d+\/)?)project\/([0-9a-f-]{36})(?:\/|$)/,
    // Agent mode chip (aria-pressed="true" / class agent-mode-chip-checked while the agent is on)
    agentChip: 'button.agent-mode-chip',
    agentChipOnClass: 'agent-mode-chip-checked',
    // Settings popover (Material CDK overlay)
    // Flow ships two Spanish wordings depending on the account/rollout; selectors list both
    settingsTrigger: 'button[aria-label="Activador de ajustes"], button[aria-label="Botón de configuración"]',
    overlayPane: '.cdk-overlay-pane',
    radio: '[role="radio"]',
    modelFamilyButton: 'button[aria-label="Seleccionar familia de modelos"]',
    menuItem: '[role="menuitem"]',
    // Reference (ingredient) upload
    addIngredientsButton:
      'button[aria-label="Añadir ingredientes a ventana para peticiones"], button[aria-label="Agregar ingredientes al cuadro de instrucción"]',
    uploadButton: 'button[mattooltip="Subir archivo multimedia"], button[mattooltip="Cargar contenido multimedia"]',
    // After picking a file Flow asks to confirm image rights ("Derechos para usar esta imagen")
    rightsDialog: 'mat-dialog-container',
    rightsAcceptText: ['Acepto', 'Aceptar'],
    // The upload lands in the asset list; it is then added to the prompt as an ingredient chip
    assetRow: '.cdk-overlay-pane button[role="option"].asset-item',
    assetTitle: '.asset-title',
    addToPromptButton: '.cdk-overlay-pane .detail-add-to-prompt-btn',
    ingredientChip: 'img[alt="Imagen del ingrediente"]',
    clearPromptButton: 'button[aria-label="Borrar petición"], button[aria-label="Borrar instrucción"]',
    // Project grid: virtualized tiles with a per-tile options menu
    // The element that actually scrolls (the cdk viewport inside it grows with the content)
    gridViewport: '.cdk-virtual-scrollable',
    gridTile: 'flow-grid-tile-container',
    tileMoreLabel: 'Más opciones',
    tileAddToPromptLabel: ['Añadir a la petición', 'Agregar a la instrucción', 'Agregar a la petición', 'Añadir a la instrucción'],
    // A failed generation ("Has alcanzado tu límite de uso…") becomes an error tile in the grid
    errorTile: 'flow-error-tile',
    errorMessage: '.error-message-text',
    // Animation (video) flow
    tileAnimateLabel: 'Animar',
    videoTile: 'flow-video-tile',
    videoThumb: 'img[alt="Miniatura de vídeo generada"], img[alt="Miniatura de video generada"]',
    videoElement: 'video',
    hoverMarkerAttr: 'data-mecatube-target',
    hoverMarkerSelector: '[data-mecatube-target="1"]',
    // Visible labels
    mediaLabel: 'Imagen',
    videoMediaLabel: 'Vídeo',
    framesLabel: 'Fotogramas',
    aspectLabel: '16:9',
    // Remove controls on attached ingredient chips (matched on aria-label / text)
    removeLabel: /^(eliminar|quitar|borrar|remove|delete|clear|close|cancel|cerrar)\b/,
  };

  // Model id sent by the app -> text Flow shows for it
  const MODEL_LABELS = { 'nano-banana-pro': 'Nano Banana Pro' };
  const VIDEO_MODEL_LABELS = {
    'omni-1.1-flash': 'Omni 1.1 Flash',
    'veo-3.1-lite': 'Veo 3.1 - Lite',
    'veo-3.1-fast': 'Veo 3.1 - Fast',
    'veo-3.1-quality': 'Veo 3.1 - Quality',
  };
  const VIDEO_RESOLUTIONS = ['360p', '720p'];
  const VIDEO_SECONDS = [4, 6, 8, 10];

  const POLL_MS = 700;
  const BOX_TIMEOUT_MS = 30000;
  const SUBMIT_ENABLE_TIMEOUT_MS = 10000;
  const GRACE_MS = 10000;
  const STABLE_POLLS = 3;
  const JOB_TIMEOUT_MS = 5 * 60 * 1000;
  const MIN_CAPTCHA_SIZE = 200;
  // After a submit, generation must visibly start (Detener / "NN %" / new images) within this time
  const START_TIMEOUT_MS = 20000;
  const IMAGE_FETCH_TIMEOUT_MS = 30000;
  const UI_TIMEOUT_MS = 5000;
  // Bounded search for an existing asset: scroll steps of the lazy list and wait per step
  // A busy project grid is tens of screens tall (a real one needed 15 steps to reach an older sheet);
  // the search stops by itself at the end of the grid, this is only a safety bound
  const ASSET_SCROLL_STEPS = 400;
  const ASSET_SCROLL_WAIT_MS = 350;
  const ASSET_END_WAIT_MS = 3000;
  const READY_TIMEOUT_MS = 3 * 60 * 1000;
  const BOX_RESTORE_TIMEOUT_MS = 60000;
  const UPLOAD_TIMEOUT_MS = 30000;
  const RIGHTS_DIALOG_TIMEOUT_MS = 6000;
  const HOOK_TIMEOUT_MS = 10000;
  // Video generation is much slower than images
  const ANIMATE_JOB_TIMEOUT_MS = 12 * 60 * 1000;
  const VIDEO_FETCH_TIMEOUT_MS = 60000;
  const VIDEO_MAX_BYTES = 24 * 1024 * 1024;
  const HOVER_VIDEO_TIMEOUT_MS = 8000;

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
      Array.from(doc.querySelectorAll('button, [role="button"]')).find((el) => {
        const text = normalizeText(el.textContent);
        return SELECTORS.newProjectTexts.some((label) => text.includes(label));
      }) ?? null
    );
  }

  // Base project URL ("https://flow.google.com/[u/<n>/]project/<uuid>") for a location, or null
  function projectUrlFrom(location) {
    if (location.origin !== 'https://flow.google.com') return null;
    const match = SELECTORS.projectPath.exec(location.pathname);
    return match ? `${location.origin}/${match[1]}project/${match[2]}` : null;
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

  // True once a submit took effect: "Detener" is shown, a "NN %" tile exists, or new images appeared
  function hasStarted(doc, snapshot) {
    return isGenerating(doc) || newImages(doc, snapshot).length > 0;
  }

  // Messages of the error tiles Flow shows for this prompt ("Has alcanzado tu límite de uso…"). A
  // failed tile keeps the prompt as its aria-label, which tells our job apart from older failures.
  function promptErrors(doc, prompt) {
    const key = normalizeText(prompt).slice(0, 160);
    return Array.from(doc.querySelectorAll(SELECTORS.gridTile))
      .filter((tile) => tile.querySelector(SELECTORS.errorTile) && normalizeText(tile.getAttribute('aria-label')).slice(0, 160) === key)
      .map((tile) => tile.querySelector(SELECTORS.errorMessage)?.textContent.trim() || 'Flow no pudo completar la generación.');
  }

  // Error for a failure tile that appeared for this prompt after `before` failures were counted
  function newPromptError(doc, prompt, before) {
    const errors = promptErrors(doc, prompt);
    return errors.length > before ? new Error(`Flow rechazó la generación: ${errors[0]}`) : null;
  }

  // Full pointer/mouse sequence at the center of the element, the way a real click arrives
  function pointerClick(doc, el) {
    const win = doc.defaultView;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const Pointer = win.PointerEvent || win.MouseEvent;
    const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: win, button: 0 };
    el.dispatchEvent(new Pointer('pointerdown', { ...init, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    el.dispatchEvent(new win.MouseEvent('mousedown', { ...init, buttons: 1 }));
    el.dispatchEvent(new Pointer('pointerup', { ...init, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    el.dispatchEvent(new win.MouseEvent('mouseup', { ...init, buttons: 0 }));
    el.dispatchEvent(new win.MouseEvent('click', { ...init, buttons: 0, detail: 1 }));
  }

  // Real click through the extension (chrome.debugger); Flow drops untrusted clicks on its submit button.
  // Never throws so submitPrompt can fall back to the synthetic methods; the reason of the last failure
  // is kept for the final error message.
  let lastTrustedClickError = null;
  function trustedClick(el) {
    return new Promise((resolve) => {
      const fail = (reason) => {
        lastTrustedClickError = reason;
        resolve(false);
      };
      if (!el) return fail('no se encontró el botón de generar');
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return fail('la extensión no está disponible');
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      const message = {
        type: 'flow-trusted-click',
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        selector: SELECTORS.submitButton,
      };
      // The background bounds every step; this is the backstop if it never answers at all
      const timer = setTimeout(() => fail('la extensión no respondió (¿se recargó después del último cambio?)'), 45000);
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) return fail(chrome.runtime.lastError.message);
        if (response?.ok !== true) return fail(response?.error ?? 'sin respuesta de la extensión');
        lastTrustedClickError = null;
        resolve(true);
      });
    });
  }

  function pressEnter(doc, box) {
    const win = doc.defaultView;
    box.focus();
    const init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
    for (const type of ['keydown', 'keypress', 'keyup']) box.dispatchEvent(new win.KeyboardEvent(type, init));
  }

  // Submits the prompt and confirms that Flow started generating. Tries a trusted click first (the
  // only one Flow honors today); if nothing starts within startTimeoutMs it falls back to a plain
  // click, a full pointer sequence, then Enter in the editor. Returns the method that worked, or null. A retry is only sent while the
  // prompt is still in the box and the submit button is still enabled, so a slow but successful
  // submit is never sent twice.
  async function submitPrompt(doc, box, prompt, snapshot, { startTimeoutMs = START_TIMEOUT_MS, isAborted = () => false } = {}) {
    const findSubmit = () => doc.querySelector(SELECTORS.submitButton);
    // An immediate failure tile also means the submit took effect: never resend in that case
    const errorsBefore = promptErrors(doc, prompt).length;
    const methods = [
      ['trusted-click', () => trustedClick(findSubmit())],
      ['click', () => findSubmit()?.click()],
      ['pointer-sequence', () => findSubmit() && pointerClick(doc, findSubmit())],
      ['enter-key', () => pressEnter(doc, box)],
    ];
    for (let index = 0; index < methods.length; index += 1) {
      const [name, run] = methods[index];
      if (index > 0) {
        const stillPending = boxMatches(box, prompt) && isEnabled(findSubmit());
        if (stillPending) await run();
      } else {
        await run();
        // Flow ignores the synthetic fallbacks, so a failed trusted click is reported right away
        if (name === 'trusted-click' && lastTrustedClickError) {
          throw new Error(`No se pudo pulsar «Generar» en Flow. Clic real: ${lastTrustedClickError}.`);
        }
      }
      const started = await waitFor(
        () => isAborted() || hasStarted(doc, snapshot) || promptErrors(doc, prompt).length > errorsBefore,
        startTimeoutMs,
      );
      if (isAborted()) throw new Error('Trabajo de Flow cancelado.');
      if (started) return name;
    }
    return null;
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

  // --- Flow setup helpers (pure) -------------------------------------------------------------------

  function modelLabel(id) {
    const label = MODEL_LABELS[String(id ?? '').trim().toLowerCase()];
    if (!label) throw new Error(`Modelo de Flow no soportado: «${id}».`);
    return label;
  }

  function videoModelLabel(id) {
    const label = VIDEO_MODEL_LABELS[String(id ?? '').trim().toLowerCase()];
    if (!label) throw new Error(`Modelo de vídeo de Flow no soportado: «${id}».`);
    return label;
  }

  function secondsLabel(seconds) {
    const n = Number(seconds);
    if (!VIDEO_SECONDS.includes(n)) throw new Error(`Duración de vídeo no válida para Flow: «${seconds}».`);
    return `${n} s`;
  }

  function resolutionLabel(resolution) {
    const value = String(resolution ?? '').trim().toLowerCase();
    if (!VIDEO_RESOLUTIONS.includes(value)) throw new Error(`Resolución de vídeo no válida para Flow: «${resolution}».`);
    return value;
  }

  // Asset uuid inside a flow-content URL (.../image/<uuid>?... or .../video/<uuid>?...); null when absent
  function flowUuidFromUrl(src) {
    const match = /\/(?:image|video)\/([^/?#]+)/.exec(String(src ?? ''));
    return match && ASSET_ID.test(match[1]) ? match[1].toLowerCase() : null;
  }

  // Ids in `current` (array or Set) that were not in `before` (Set or array), in order, without duplicates
  function newVideoIds(before, current) {
    const known = before instanceof Set ? before : new Set(before);
    const fresh = [];
    for (const id of current) if (id && !known.has(id) && !fresh.includes(id)) fresh.push(id);
    return fresh;
  }

  // The first `count` results (Flow puts new results at the top of the grid); everything when count is
  // missing or invalid
  function capResults(list, count) {
    const n = Number(count);
    return Number.isInteger(n) && n > 0 ? list.slice(0, n) : list;
  }

  // Set of what `read()` returns once the grid stops changing (it re-renders after a scroll back to the
  // top): same size on three consecutive polls, at most ~3 s
  async function settledSnapshot(read) {
    let last = new Set(read());
    let stable = 0;
    for (let i = 0; i < 15 && stable < 3; i += 1) {
      await sleep(200);
      const next = new Set(read());
      stable = next.size === last.size && [...next].every((item) => last.has(item)) ? stable + 1 : 0;
      last = next;
    }
    return last;
  }

  function outputsLabel(count) {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 4) throw new Error(`Cantidad de imágenes no válida para Flow: «${count}».`);
    return `x${n}`;
  }

  // Control text often starts with an icon ligature ("crop_16_9 16:9"), so match on the tail.
  // loose: substring match (menu items, model button)
  // label may be a list of alternative wordings
  function labelMatches(text, label, loose = false) {
    if (Array.isArray(label)) return label.some((item) => labelMatches(text, item, loose));
    const haystack = normalizeText(text);
    const needle = normalizeText(label);
    if (!needle) return false;
    if (loose) return haystack.includes(needle);
    return haystack === needle || haystack.endsWith(` ${needle}`);
  }

  // Text of a control without its icon: Flow renders <mat-icon>image</mat-icon><span>Imagen</span>, so
  // textContent glues the ligature to the label ("imageImagen")
  function visibleLabel(el) {
    if (typeof el?.cloneNode !== 'function') return el?.textContent ?? '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('mat-icon, .google-symbols, [data-mat-icon-type]').forEach((icon) => icon.remove());
    return clone.textContent;
  }

  function findByLabel(elements, label, loose = false) {
    return Array.from(elements).find((el) => labelMatches(visibleLabel(el), label, loose)) ?? null;
  }

  // True for the Flow production host and for the legacy labs.google URL (which redirects to it)
  const ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function isFlowUrl(href) {
    try {
      const url = new URL(href);
      if (url.origin === 'https://flow.google.com') return true;
      return url.origin === 'https://labs.google' && url.pathname.startsWith('/fx/tools/flow');
    } catch {
      return false;
    }
  }

  // Flow asset id inside an image URL (https://flow-content.google/image/<uuid>?...); null when absent
  function assetIdFromSrc(src) {
    const match = /\/image\/([^/?#]+)/.exec(String(src ?? ''));
    return match && ASSET_ID.test(match[1]) ? match[1].toLowerCase() : null;
  }

  // A reference is either an image already in the Flow project (assetId: it is selected, not
  // uploaded) or file content to upload; base64 is the upload fallback when an assetId is present
  function normalizeReferences(references) {
    if (!Array.isArray(references)) return [];
    return references.map((ref, index) => {
      const assetId = typeof ref?.assetId === 'string' && ASSET_ID.test(ref.assetId) ? ref.assetId.toLowerCase() : null;
      const base64 = typeof ref?.base64 === 'string' ? ref.base64 : '';
      if (!ref || (!assetId && !base64)) {
        throw new Error(`La imagen de referencia ${index + 1} no tiene contenido.`);
      }
      // A unique name lets the job find its own upload in Flow's asset list (earlier uploads keep theirs)
      const base = String(ref.name || `referencia-${index + 1}.png`);
      const dot = base.lastIndexOf('.');
      const stamp = `-${Date.now().toString(36)}${index}`;
      return {
        name: dot > 0 ? `${base.slice(0, dot)}${stamp}${base.slice(dot)}` : `${base}${stamp}`,
        mime: String(ref.mime || 'image/png'),
        base64,
        assetId,
      };
    });
  }

  function isAgentModeOn(chip) {
    return (
      Boolean(chip) &&
      (chip.getAttribute('aria-pressed') === 'true' || chip.classList.contains(SELECTORS.agentChipOnClass))
    );
  }

  // Prompt box is usable: present, editable and not flagged disabled
  function isBoxReady(box) {
    return (
      Boolean(box) &&
      box.getAttribute('contenteditable') === 'true' &&
      box.getAttribute('aria-disabled') !== 'true'
    );
  }

  // --- Flow setup (DOM) ----------------------------------------------------------------------------

  // A full pointer sequence (it ends in a click) is what Material controls expect
  function press(doc, el) {
    pointerClick(doc, el);
  }

  function overlayItems(doc, selector) {
    return Array.from(doc.querySelectorAll(`${SELECTORS.overlayPane} ${selector}`));
  }

  async function closeOverlays(doc, isOpen) {
    const win = doc.defaultView;
    for (let attempt = 0; attempt < 3 && isOpen(); attempt += 1) {
      const target = doc.activeElement || doc.body;
      const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true, composed: true };
      target.dispatchEvent(new win.KeyboardEvent('keydown', init));
      target.dispatchEvent(new win.KeyboardEvent('keyup', init));
      await waitFor(() => !isOpen(), 1500, 100);
    }
    return !isOpen();
  }

  // Direct mode: with the agent on, an LLM rewrites the prompt and the settings live elsewhere
  async function ensureDirectMode(doc) {
    const chip = doc.querySelector(SELECTORS.agentChip);
    if (!chip || !isAgentModeOn(chip)) return;
    press(doc, chip);
    const off = await waitFor(() => !isAgentModeOn(doc.querySelector(SELECTORS.agentChip)), UI_TIMEOUT_MS);
    if (!off) throw new Error('No se pudo desactivar el modo agente de Flow.');
  }

  async function openSettings(doc) {
    if (overlayItems(doc, SELECTORS.radio).length > 0) return;
    const trigger = doc.querySelector(SELECTORS.settingsTrigger);
    if (!trigger) throw new Error('No se encontró el panel de ajustes de Flow.');
    press(doc, trigger);
    const opened = await waitFor(() => overlayItems(doc, SELECTORS.radio).length > 0, UI_TIMEOUT_MS);
    if (!opened) throw new Error('El panel de ajustes de Flow no se abrió.');
  }

  async function ensureRadio(doc, label, what) {
    await openSettings(doc);
    const radio = findByLabel(overlayItems(doc, SELECTORS.radio), label);
    if (!radio) throw new Error(`No se encontró la opción «${label}» (${what}) en los ajustes de Flow.`);
    if (radio.getAttribute('aria-checked') === 'true') return;
    press(doc, radio);
    const checked = await waitFor(() => {
      const current = findByLabel(overlayItems(doc, SELECTORS.radio), label);
      return current?.getAttribute('aria-checked') === 'true';
    }, UI_TIMEOUT_MS);
    if (!checked) throw new Error(`Flow no aceptó la opción «${label}» (${what}).`);
  }

  async function ensureModel(doc, label) {
    await openSettings(doc);
    const button = overlayItems(doc, SELECTORS.modelFamilyButton)[0];
    if (!button) throw new Error('No se encontró el selector de modelo de Flow.');
    if (labelMatches(visibleLabel(button), label, true)) return;
    press(doc, button);
    const item = await waitFor(() => findByLabel(overlayItems(doc, SELECTORS.menuItem), label, true), UI_TIMEOUT_MS);
    if (!item) throw new Error(`Flow no ofrece el modelo «${label}»; no se usará otro modelo.`);
    press(doc, item);
    const applied = await waitFor(() => {
      const current = overlayItems(doc, SELECTORS.modelFamilyButton)[0];
      return current && labelMatches(visibleLabel(current), label, true);
    }, UI_TIMEOUT_MS);
    if (!applied) throw new Error(`Flow no cambió al modelo «${label}».`);
  }

  // Media = image, 16:9, the requested model and "xN" outputs; applied immediately by Flow
  async function applySettings(doc, { model, outputs }) {
    const modelText = model ? modelLabel(model) : null;
    const outputsText = outputs ? outputsLabel(outputs) : null;
    if (!modelText && !outputsText) return;
    try {
      await ensureRadio(doc, SELECTORS.mediaLabel, 'tipo de medio');
      await ensureRadio(doc, SELECTORS.aspectLabel, 'relación de aspecto');
      if (modelText) await ensureModel(doc, modelText);
      // Last: changing the model can reset the output count
      if (outputsText) await ensureRadio(doc, outputsText, 'cantidad de imágenes');
    } finally {
      await closeOverlays(doc, () => overlayItems(doc, SELECTORS.radio).length > 0 || overlayItems(doc, SELECTORS.menuItem).length > 0);
    }
  }

  // The prompt bar: first ancestor of the box that holds the submit button, plus two levels for the
  // ingredient chips, never one that contains result tiles
  function promptBar(doc, box) {
    let node = box;
    while (node.parentElement && !node.querySelector(SELECTORS.submitButton)) node = node.parentElement;
    for (let i = 0; i < 2 && node.parentElement; i += 1) {
      if (node.parentElement.querySelector(SELECTORS.resultImage)) break;
      node = node.parentElement;
    }
    return node;
  }

  function attachmentCount(bar) {
    return bar.querySelectorAll(SELECTORS.ingredientChip).length;
  }

  function removeControlFor(bar, thumb) {
    let node = thumb;
    for (let depth = 0; depth < 3 && node && node !== bar; depth += 1, node = node.parentElement) {
      const found = Array.from(node.querySelectorAll('button, [role="button"]')).find((control) => {
        if (control.matches(`${SELECTORS.submitButton}, ${SELECTORS.addIngredientsButton}, ${SELECTORS.settingsTrigger}`)) return false;
        const label = normalizeText(control.getAttribute('aria-label') || control.textContent);
        return SELECTORS.removeLabel.test(label);
      });
      if (found) return found;
    }
    return null;
  }

  // Removes ingredients left in the prompt bar by earlier jobs. "Borrar petición" clears the whole
  // prompt (text and chips), which is fine because the text is typed afterwards; per-chip remove
  // controls are the fallback. A chip that cannot be removed stays as an extra reference.
  async function clearReferences(doc, bar) {
    const clear = doc.querySelector(SELECTORS.clearPromptButton);
    if (attachmentCount(bar) > 0 && clear) {
      press(doc, clear);
      await waitFor(() => attachmentCount(bar) === 0, UI_TIMEOUT_MS);
    }
    for (let guard = 0; guard < 10; guard += 1) {
      const before = attachmentCount(bar);
      if (before === 0) return;
      const control = Array.from(bar.querySelectorAll('img, canvas, video')).map((thumb) => removeControlFor(bar, thumb)).find(Boolean);
      if (!control) return;
      press(doc, control);
      const removed = await waitFor(() => attachmentCount(bar) < before, UI_TIMEOUT_MS);
      if (!removed) return;
    }
  }

  // Bridge to the page-world hook (flow-main.js). `install` injects it (service worker).
  function createPageHook(win, install) {
    const waiters = new Set();
    let installed = false;
    win.addEventListener('message', (event) => {
      const data = event.data;
      if (event.source !== win || !data || data.source !== 'mecatube-flow-page') return;
      waiters.forEach((waiter) => waiter(data));
    });
    const expect = (type, timeoutMs) =>
      new Promise((resolve) => {
        const timer = setTimeout(() => {
          waiters.delete(waiter);
          resolve(null);
        }, timeoutMs);
        const waiter = (data) => {
          if (data.type !== type && data.type !== 'error') return;
          clearTimeout(timer);
          waiters.delete(waiter);
          resolve(data);
        };
        waiters.add(waiter);
      });
    const send = (message) => win.postMessage({ source: 'mecatube-flow-cs', ...message }, '*');
    return {
      async arm(reference) {
        if (!installed) {
          await install();
          installed = true;
        }
        const armed = expect('armed', HOOK_TIMEOUT_MS);
        send({ type: 'arm', ...reference });
        const reply = await armed;
        if (!reply || reply.type === 'error') throw new Error('No se pudo preparar la subida de imágenes en Flow.');
      },
      expectUsed: () => expect('used', HOOK_TIMEOUT_MS),
      async disarm() {
        if (!installed) return;
        const done = expect('disarmed', 2000);
        send({ type: 'disarm' });
        await done;
      },
    };
  }

  function installPageHook() {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        reject(new Error('No se pudo inyectar el ayudante de subida de Flow.'));
        return;
      }
      chrome.runtime.sendMessage({ type: 'flow-install-hook' }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          reject(new Error(`No se pudo inyectar el ayudante de subida de Flow. ${response?.error ?? ''}`.trim()));
        } else {
          resolve();
        }
      });
    });
  }

  function findRightsAccept(doc) {
    const dialog = Array.from(doc.querySelectorAll(SELECTORS.rightsDialog)).pop();
    if (!dialog) return null;
    return findByLabel(dialog.querySelectorAll('button'), SELECTORS.rightsAcceptText);
  }

  // The uploaded row is ready once its thumbnail has a real image URL (a spinner is shown before)
  function findUploadedAsset(doc, name) {
    const row = Array.from(doc.querySelectorAll(SELECTORS.assetRow)).find(
      (item) => item.querySelector(SELECTORS.assetTitle)?.textContent.trim() === name,
    );
    const thumb = row?.querySelector('img');
    return thumb && /^https?:/.test(thumb.currentSrc || thumb.src || '') ? row : null;
  }

  const isAssetOverlayOpen = (doc) =>
    Boolean(doc.querySelector(SELECTORS.uploadButton) || doc.querySelector('input[aria-label="Buscar recursos"]'));

  // The project grid tile of a Flow image. Tiles carry a stable data-media-id (the uuid also seen in
  // flow-content.google URLs); asset-list rows do not, and their /asb/ URLs change between page loads.
  function findTileImage(doc, assetId) {
    // resultImage is a selector list, so a suffix cannot be appended to it; the id alone is unique
    return doc.querySelector(`img[data-media-id="${assetId}"]`);
  }

  // The grid is virtualized: tiles exist only near the viewport, so scroll it from the top, bounded
  async function findTileScrolling(doc, assetId) {
    let tile = findTileImage(doc, assetId);
    if (tile) return tile;
    const viewport = doc.querySelector(SELECTORS.gridViewport);
    if (!viewport) return null;
    viewport.scrollTop = 0;
    for (let step = 0; step <= ASSET_SCROLL_STEPS; step += 1) {
      tile = await waitFor(() => findTileImage(doc, assetId), ASSET_SCROLL_WAIT_MS, 100);
      if (tile) return tile;
      const before = viewport.scrollTop;
      viewport.scrollTop = before + Math.max(viewport.clientHeight * 0.8, 200);
      // At the end of the grid the last (oldest) tiles can still be rendering; give them time
      if (viewport.scrollTop === before) return waitFor(() => findTileImage(doc, assetId), ASSET_END_WAIT_MS, 100);
    }
    return findTileImage(doc, assetId);
  }

  // Attaches an image that already lives in the Flow project: its tile → "Más opciones" → "Añadir a la
  // petición". Returns false when the tile is not in this project so the caller can fall back to uploading.
  async function attachBySelection(doc, bar, reference) {
    const before = attachmentCount(bar);
    const isMenuOpen = () => overlayItems(doc, SELECTORS.menuItem).length > 0;
    try {
      const image = await findTileScrolling(doc, reference.assetId);
      if (!image) return false;
      image.scrollIntoView({ block: 'center' });
      const tile = image.closest(SELECTORS.gridTile);
      const more =
        tile &&
        Array.from(tile.querySelectorAll('button')).find((button) => labelMatches(button.getAttribute('aria-label'), SELECTORS.tileMoreLabel, true));
      if (!more) throw new Error('No se encontró el menú de la hoja aprobada en Flow.');
      press(doc, more);
      const item = await waitFor(() => findByLabel(overlayItems(doc, SELECTORS.menuItem), SELECTORS.tileAddToPromptLabel, true), UI_TIMEOUT_MS);
      if (!item) throw new Error('Flow no ofreció «Añadir a la petición» para la hoja aprobada.');
      press(doc, item);
      const attached = await waitFor(() => attachmentCount(bar) > before, UI_TIMEOUT_MS * 2);
      if (!attached) throw new Error('La hoja aprobada no apareció adjunta en Flow.');
      return true;
    } finally {
      await closeOverlays(doc, isMenuOpen);
      // New results appear at the top of the grid
      const viewport = doc.querySelector(SELECTORS.gridViewport);
      if (viewport) viewport.scrollTop = 0;
    }
  }

  async function attachReference(doc, bar, reference, hook) {
    if (reference.assetId) {
      if (await attachBySelection(doc, bar, reference)) return;
      if (!reference.base64) throw new Error('La hoja aprobada no está en este proyecto de Flow.');
    }
    await attachByUpload(doc, bar, reference, hook);
  }

  async function attachByUpload(doc, bar, reference, hook) {
    const before = attachmentCount(bar);
    const isOpen = () => isAssetOverlayOpen(doc);
    await hook.arm(reference);
    try {
      const add = doc.querySelector(SELECTORS.addIngredientsButton);
      if (!add) throw new Error('No se encontró el botón para añadir imágenes de referencia en Flow.');
      press(doc, add);
      const upload = await waitFor(() => doc.querySelector(SELECTORS.uploadButton), UI_TIMEOUT_MS);
      if (!upload) throw new Error('Flow no mostró la opción de subir archivos.');
      const used = hook.expectUsed();
      press(doc, upload);
      const reply = await used;
      if (!reply || reply.type !== 'used') throw new Error('Flow no pidió el archivo de la imagen de referencia.');

      // The user chose to accept Flow's image-rights notice automatically; it may not show every time
      const accept = await waitFor(() => findRightsAccept(doc), RIGHTS_DIALOG_TIMEOUT_MS);
      if (accept) {
        press(doc, accept);
        await waitFor(() => !findRightsAccept(doc), UI_TIMEOUT_MS);
      }

      // The file shows up in the asset list under its (unique) name once uploaded
      const row = await waitFor(() => findUploadedAsset(doc, reference.name), UPLOAD_TIMEOUT_MS);
      if (!row) throw new Error('La imagen de referencia no terminó de subirse a Flow.');
      press(doc, row);
      const addToPrompt = await waitFor(() => {
        const button = doc.querySelector(SELECTORS.addToPromptButton);
        return isEnabled(button) ? button : null;
      }, UI_TIMEOUT_MS);
      if (!addToPrompt) throw new Error('Flow no ofreció «Añadir a petición» para la imagen de referencia.');
      press(doc, addToPrompt);
      const attached = await waitFor(() => attachmentCount(bar) > before, UI_TIMEOUT_MS * 2);
      if (!attached) throw new Error('La imagen de referencia no apareció adjunta en Flow.');
    } finally {
      await hook.disarm();
      await closeOverlays(doc, isOpen);
    }
  }

  async function attachReferences(doc, box, references, hook) {
    const bar = promptBar(doc, box);
    await clearReferences(doc, bar);
    for (const reference of references) await attachReference(doc, bar, reference, hook);
  }

  // --- Jobs ------------------------------------------------------------------------------------

  async function fetchImage(entry) {
    // A hanging download must not keep the job (and this tab's busy flag) alive forever
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    let response;
    let blob;
    try {
      // Results now come from https://flow-content.google, which allows any origin only without
      // credentials; same-origin URLs (flow.google.com/asb/…) still need the session cookies
      const sameOrigin = new URL(entry.src, location.href).origin === location.origin;
      response = await fetch(entry.src, { credentials: sameOrigin ? 'include' : 'omit', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      blob = await response.blob();
    } finally {
      clearTimeout(timer);
    }
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
  // Resolves to { images, submitMethod }. options.isAborted lets the caller stop a job whose port
  // closed; options.startTimeoutMs tunes the "generation must start" window (tests).
  // job: { prompt, model, outputs, references }. options.hook replaces the page-world upload hook (tests).
  async function runGenerate({ prompt, model, outputs, references }, post, doc = document, now = Date.now, options = {}) {
    const isAborted = options.isAborted ?? (() => false);
    const refs = normalizeReferences(references);
    let box = await waitFor(() => doc.querySelector(SELECTORS.promptBox), BOX_TIMEOUT_MS);
    if (!box) throw new Error('No se encontró el cuadro de prompt de Flow. ¿Está abierto el proyecto y con la sesión iniciada?');

    // Never configure or type while a previous generation still runs or the box is locked
    const ready = await waitFor(() => !isAborted() && !isGenerating(doc) && isBoxReady(box), READY_TIMEOUT_MS);
    if (isAborted()) throw new Error('Trabajo de Flow cancelado.');
    if (!ready) throw new Error('El cuadro de prompt de Flow no quedó disponible (¿hay otra generación en curso?).');

    await ensureDirectMode(doc);
    await applySettings(doc, { model, outputs });
    if (refs.length > 0) {
      const hook = options.hook ?? createPageHook(doc.defaultView, installPageHook);
      await attachReferences(doc, box, refs, hook);
    }

    // Adding an ingredient re-renders the editor, so the box found at the start may be detached now
    box = doc.querySelector(SELECTORS.promptBox) ?? box;

    // After the references: their thumbnails must not count as new results. The grid was scrolled to
    // find a sheet, so wait until its top re-renders before taking the snapshot
    const snapshot = await settledSnapshot(() => imageSources(doc));
    insertPrompt(doc, box, prompt);
    const accepted = await waitFor(() => {
      const current = doc.querySelector(SELECTORS.promptBox);
      if (current && current !== box) box = current;
      return boxMatches(box, prompt);
    }, 2000, 150);
    if (!accepted) throw new Error('Flow no aceptó el texto del prompt.');

    const submit = await waitFor(() => {
      const button = doc.querySelector(SELECTORS.submitButton);
      return isEnabled(button) ? button : null;
    }, SUBMIT_ENABLE_TIMEOUT_MS);
    if (!submit) throw new Error('El botón de enviar de Flow nunca estuvo disponible.');

    const startedAt = now();
    const errorsBefore = promptErrors(doc, prompt).length;
    const submitMethod = await submitPrompt(doc, box, prompt, snapshot, {
      startTimeoutMs: options.startTimeoutMs,
      isAborted,
    });
    if (!submitMethod) {
      const detail = lastTrustedClickError ? ` Clic real: ${lastTrustedClickError}.` : ' El clic real se envió, pero Flow no reaccionó.';
      throw new Error(`Flow no empezó a generar (el botón de generar no respondió).${detail}`);
    }

    let sawGenerating = false;
    let captchaShown = false;
    let lastPercent = null;
    let stableCount = 0;
    let stableSize = -1;

    for (;;) {
      await sleep(POLL_MS);
      if (isAborted()) throw new Error('Trabajo de Flow cancelado.');
      if (now() - startedAt > JOB_TIMEOUT_MS) throw new Error('Se agotó el tiempo esperando a que Flow terminara de generar.');

      // Flow turned this request into an error tile (usage limit, policy…): fail now, do not wait it out
      const flowError = newPromptError(doc, prompt, errorsBefore);
      if (flowError) throw flowError;

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

      // New results appear first in the grid; never take more than were requested (old tiles that
      // re-render after scrolling must not be mistaken for results)
      const fresh = capResults(newImages(doc, snapshot), outputs);
      if (fresh.length === 0) continue;
      stableCount = fresh.length === stableSize ? stableCount + 1 : 1;
      stableSize = fresh.length;
      if (stableCount < STABLE_POLLS) continue;

      const images = [];
      let lastError = null;
      for (const entry of fresh) {
        try {
          images.push(await downloadImage(entry));
        } catch (error) {
          // A single failed download should not lose the others
          lastError = error;
        }
      }
      if (images.length === 0) {
        throw new Error(`Flow generó imágenes, pero no se pudieron descargar${lastError ? ` (${lastError.message})` : ''}.`);
      }
      // Resolve only once Flow accepts input again so the app's queue never sends into a locked box
      await waitFor(() => !isAborted() && !isGenerating(doc) && isBoxReady(doc.querySelector(SELECTORS.promptBox)), BOX_RESTORE_TIMEOUT_MS);
      return { images, submitMethod };
    }
  }

  // Video tiles in the grid as [{ id, tile }]; the id is the uuid of the thumbnail (or of the video once injected)
  function videoTiles(doc) {
    const found = [];
    doc.querySelectorAll(SELECTORS.videoTile).forEach((tile) => {
      const thumb = tile.querySelector(SELECTORS.videoThumb);
      const video = tile.querySelector(SELECTORS.videoElement);
      const id =
        flowUuidFromUrl(thumb?.currentSrc || thumb?.src || thumb?.getAttribute?.('src')) ||
        flowUuidFromUrl(video?.currentSrc || video?.src || video?.getAttribute?.('src'));
      if (id) found.push({ id, tile });
    });
    return found;
  }

  function videoIds(doc) {
    return new Set(videoTiles(doc).map((entry) => entry.id));
  }

  // Video settings: Vídeo + Fotogramas + aspect + resolution + duration + model + xN (last, a model
  // change can reset the count). Any control Flow does not offer is an error, never a fallback.
  async function applyVideoSettings(doc, video) {
    const settings = video ?? {};
    const modelText = videoModelLabel(settings.model);
    const resolution = resolutionLabel(settings.resolution);
    const seconds = secondsLabel(settings.seconds);
    const outputsText = outputsLabel(settings.outputs ?? 1);
    const aspect = String(settings.aspect ?? SELECTORS.aspectLabel);
    try {
      await ensureRadio(doc, SELECTORS.videoMediaLabel, 'tipo de medio');
      await ensureRadio(doc, SELECTORS.framesLabel, 'modo de vídeo');
      await ensureRadio(doc, aspect, 'relación de aspecto');
      await ensureRadio(doc, resolution, 'resolución');
      await ensureRadio(doc, seconds, 'duración');
      await ensureModel(doc, modelText);
      await ensureRadio(doc, outputsText, 'cantidad de vídeos');
    } finally {
      await closeOverlays(doc, () => overlayItems(doc, SELECTORS.radio).length > 0 || overlayItems(doc, SELECTORS.menuItem).length > 0);
    }
  }

  // Source image tile -> "Más opciones" -> "Animar": Flow puts the image in the prompt bar as the start frame
  async function startAnimationFromTile(doc, bar, sourceAssetId) {
    const isMenuOpen = () => overlayItems(doc, SELECTORS.menuItem).length > 0;
    try {
      const image = await findTileScrolling(doc, sourceAssetId);
      if (!image) throw new Error('La imagen elegida de la escena no está en este proyecto de Flow.');
      image.scrollIntoView({ block: 'center' });
      const tile = image.closest(SELECTORS.gridTile);
      const more =
        tile &&
        Array.from(tile.querySelectorAll('button')).find((button) => labelMatches(button.getAttribute('aria-label'), SELECTORS.tileMoreLabel, true));
      if (!more) throw new Error('No se encontró el menú de la imagen de la escena en Flow.');
      press(doc, more);
      const item = await waitFor(() => findByLabel(overlayItems(doc, SELECTORS.menuItem), SELECTORS.tileAnimateLabel, true), UI_TIMEOUT_MS);
      if (!item) throw new Error('Flow no ofreció «Animar» para la imagen de la escena.');
      press(doc, item);
      const chip = await waitFor(() => bar.querySelector(SELECTORS.ingredientChip), UI_TIMEOUT_MS * 2);
      if (!chip) throw new Error('La imagen de la escena no quedó como fotograma inicial en Flow.');
    } finally {
      await closeOverlays(doc, isMenuOpen);
      const viewport = doc.querySelector(SELECTORS.gridViewport);
      if (viewport) viewport.scrollTop = 0;
    }
  }

  // Real mouse move over the element through the extension (chrome.debugger); the marker attribute lets
  // the service worker find the element again after the debugging bar shifts the layout.
  // Resolves to null on success or to the failure reason.
  function trustedHover(el) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return resolve('la extensión no está disponible');
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      const message = {
        type: 'flow-trusted-hover',
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        selector: SELECTORS.hoverMarkerSelector,
      };
      const timer = setTimeout(() => resolve('la extensión no respondió'), 45000);
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) return resolve(chrome.runtime.lastError.message);
        resolve(response?.ok === true ? null : (response?.error ?? 'sin respuesta de la extensión'));
      });
    });
  }

  // The <video src> only exists after a trusted hover on the tile
  async function revealVideoUrl(doc, entry) {
    const readSrc = () => {
      const video = entry.tile.querySelector(SELECTORS.videoElement);
      return video ? video.currentSrc || video.src || video.getAttribute('src') || null : null;
    };
    const existing = readSrc();
    if (existing) return existing;
    const viewport = doc.querySelector(SELECTORS.gridViewport);
    if (viewport) viewport.scrollTop = 0;
    entry.tile.setAttribute(SELECTORS.hoverMarkerAttr, '1');
    let lastError = null;
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        lastError = await trustedHover(entry.tile);
        const src = await waitFor(readSrc, HOVER_VIDEO_TIMEOUT_MS, 200);
        if (src) return src;
      }
    } finally {
      entry.tile.removeAttribute(SELECTORS.hoverMarkerAttr);
    }
    throw new Error(`Flow no mostró el vídeo generado${lastError ? ` (${lastError})` : ''}.`);
  }

  async function fetchVideo(src) {
    const tooBig = () => new Error('El vídeo generado es demasiado grande para importarlo (más de 24 MB).');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VIDEO_FETCH_TIMEOUT_MS);
    try {
      // flow-content.google allows any origin only without credentials
      const response = await fetch(src, { credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > VIDEO_MAX_BYTES) throw tooBig();
      const blob = await response.blob();
      if (blob.size > VIDEO_MAX_BYTES) throw tooBig();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { mime: blob.type || response.headers.get('content-type') || 'video/mp4', base64: bytesToBase64(bytes), sourceUrl: src };
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Se agotó el tiempo descargando el vídeo de Flow.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // Animates an image already in the project: tile -> Animar -> video settings -> prompt -> generate ->
  // wait -> hover to reveal the video URL -> download. Resolves to { videos, submitMethod }.
  // job: { prompt, sourceAssetId, video: { model, resolution, seconds, aspect, outputs } }
  async function runAnimate({ prompt, sourceAssetId, video }, post, doc = document, now = Date.now, options = {}) {
    const isAborted = options.isAborted ?? (() => false);
    const assetId = typeof sourceAssetId === 'string' && ASSET_ID.test(sourceAssetId) ? sourceAssetId.toLowerCase() : null;
    if (!assetId) throw new Error('Falta la imagen de la escena para animar.');
    // Validate the settings before touching Flow
    videoModelLabel(video?.model);
    resolutionLabel(video?.resolution);
    secondsLabel(video?.seconds);
    outputsLabel(video?.outputs ?? 1);

    let box = await waitFor(() => doc.querySelector(SELECTORS.promptBox), BOX_TIMEOUT_MS);
    if (!box) throw new Error('No se encontró el cuadro de prompt de Flow. ¿Está abierto el proyecto y con la sesión iniciada?');
    const ready = await waitFor(() => !isAborted() && !isGenerating(doc) && isBoxReady(box), READY_TIMEOUT_MS);
    if (isAborted()) throw new Error('Trabajo de Flow cancelado.');
    if (!ready) throw new Error('El cuadro de prompt de Flow no quedó disponible (¿hay otra generación en curso?).');

    await ensureDirectMode(doc);
    const bar = promptBar(doc, box);
    const clear = doc.querySelector(SELECTORS.clearPromptButton);
    if (clear) {
      press(doc, clear);
      await waitFor(() => attachmentCount(bar) === 0, UI_TIMEOUT_MS);
    }
    await clearReferences(doc, bar);

    await startAnimationFromTile(doc, bar, assetId);
    await applyVideoSettings(doc, video);

    // The grid was scrolled to find the source tile: wait until its top re-renders
    const before = [...(await settledSnapshot(() => videoIds(doc)))];
    // The editor re-renders after the start-frame chip appears
    box = doc.querySelector(SELECTORS.promptBox) ?? box;
    const snapshot = await settledSnapshot(() => imageSources(doc));
    insertPrompt(doc, box, prompt);
    const accepted = await waitFor(() => {
      const current = doc.querySelector(SELECTORS.promptBox);
      if (current && current !== box) box = current;
      return boxMatches(box, prompt);
    }, 2000, 150);
    if (!accepted) throw new Error('Flow no aceptó el texto del prompt.');

    const submit = await waitFor(() => {
      const button = doc.querySelector(SELECTORS.submitButton);
      return isEnabled(button) ? button : null;
    }, SUBMIT_ENABLE_TIMEOUT_MS);
    if (!submit) throw new Error('El botón de enviar de Flow nunca estuvo disponible.');

    const startedAt = now();
    const errorsBefore = promptErrors(doc, prompt).length;
    const submitMethod = await submitPrompt(doc, box, prompt, snapshot, { startTimeoutMs: options.startTimeoutMs, isAborted });
    if (!submitMethod) {
      const detail = lastTrustedClickError ? ` Clic real: ${lastTrustedClickError}.` : ' El clic real se envió, pero Flow no reaccionó.';
      throw new Error(`Flow no empezó a generar (el botón de generar no respondió).${detail}`);
    }

    let sawGenerating = false;
    let captchaShown = false;
    let lastPercent = null;
    let stableCount = 0;
    let stableSize = -1;

    for (;;) {
      await sleep(POLL_MS);
      if (isAborted()) throw new Error('Trabajo de Flow cancelado.');
      if (now() - startedAt > ANIMATE_JOB_TIMEOUT_MS) throw new Error('Se agotó el tiempo esperando a que Flow terminara de generar el vídeo.');

      // Flow turned this request into an error tile (usage limit, policy…): fail now, do not wait it out
      const flowError = newPromptError(doc, prompt, errorsBefore);
      if (flowError) throw flowError;

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
      if (!sawGenerating && now() - startedAt < GRACE_MS) continue;

      const tiles = videoTiles(doc);
      const freshIds = capResults(newVideoIds(before, tiles.map((entry) => entry.id)), video?.outputs);
      if (freshIds.length === 0) continue;
      stableCount = freshIds.length === stableSize ? stableCount + 1 : 1;
      stableSize = freshIds.length;
      if (stableCount < STABLE_POLLS) continue;

      const videos = [];
      let lastError = null;
      for (const entry of tiles.filter((item) => freshIds.includes(item.id))) {
        try {
          videos.push(await fetchVideo(await revealVideoUrl(doc, entry)));
        } catch (error) {
          lastError = error;
        }
      }
      if (videos.length === 0) throw new Error(lastError?.message || 'Flow generó el vídeo, pero no se pudo descargar.');
      await waitFor(() => !isAborted() && !isGenerating(doc) && isBoxReady(doc.querySelector(SELECTORS.promptBox)), BOX_RESTORE_TIMEOUT_MS);
      return { videos, submitMethod };
    }
  }

  // The tile's own pixels: the image is same-origin (flow.google.com/asb/…), so the canvas is not tainted
  async function canvasImage(entry) {
    const img = entry.img;
    if (!img.complete || !img.naturalWidth) throw new Error('la imagen aún no terminó de cargar');
    const canvas = img.ownerDocument.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('no se pudo leer la imagen del lienzo');
    return {
      mime: 'image/png',
      base64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
      width: img.naturalWidth,
      height: img.naturalHeight,
      sourceUrl: entry.src,
    };
  }

  // Right after a generation the tile can still swap its src, so retry with the current one, then fall
  // back to the pixels already rendered on the page
  async function downloadImage(entry) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const src = entry.img.currentSrc || entry.img.src || entry.src;
      try {
        return await fetchImage({ ...entry, src });
      } catch (error) {
        lastError = error;
        await sleep(1000);
      }
    }
    try {
      return await canvasImage(entry);
    } catch (error) {
      throw new Error(`${lastError?.message ?? 'descarga fallida'}; ${error.message}`);
    }
  }

  async function runNewProject(post, doc = document) {
    const button = await waitFor(() => findNewProjectButton(doc), BOX_TIMEOUT_MS);
    if (!button) throw new Error('No se encontró el botón «Nuevo proyecto». ¿Está Flow abierto y con la sesión iniciada?');
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
        post({ type: 'error', message: 'Flow ya está ejecutando un trabajo en esta pestaña.' });
        return;
      }
      busy = true;
      try {
        if (message.type === 'new-project') {
          await runNewProject(post);
        } else if (message.kind === 'animate') {
          const { videos, submitMethod } = await runAnimate(
            { prompt: String(message.prompt ?? ''), sourceAssetId: message.sourceAssetId, video: message.video },
            post, document, Date.now, { isAborted: () => !open },
          );
          post({ type: 'result', images: [], videos, submitMethod });
        } else {
          const { images, submitMethod } = await runGenerate(
            {
              prompt: String(message.prompt ?? ''),
              model: message.model,
              outputs: message.outputs,
              references: message.references,
            },
            post, document, Date.now, {
            isAborted: () => !open,
          });
          post({ type: 'result', images, submitMethod });
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
    hasStarted,
    pointerClick,
    pressEnter,
    submitPrompt,
    bytesToBase64,
    MODEL_LABELS,
    modelLabel,
    outputsLabel,
    videoModelLabel,
    secondsLabel,
    resolutionLabel,
    flowUuidFromUrl,
    newVideoIds,
    capResults,
    videoTiles,
    videoIds,
    labelMatches,
    findByLabel,
    isFlowUrl,
    normalizeReferences,
    assetIdFromSrc,
    isAgentModeOn,
    isBoxReady,
    runGenerate,
    runAnimate,
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
