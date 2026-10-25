// Page-world (MAIN) helper for Google Flow. Injected on demand by background.js through
// chrome.scripting.executeScript({ world: 'MAIN' }) because the isolated content script cannot
// patch the page's own DOM prototypes.
//
// While "armed" it intercepts the file picker Flow opens for "Subir archivo multimedia": instead of
// the native dialog it fills the input with a File built from the base64 payload sent by flow.js
// and dispatches input + change. The native dialog is never shown. Protocol (window.postMessage):
//   flow.js -> page: { source: 'mecatube-flow-cs', type: 'arm', name, mime, base64 } | { type: 'disarm' }
//   page -> flow.js: { source: 'mecatube-flow-page', type: 'ready' | 'armed' | 'used' | 'disarmed' | 'error' }
(function mecatubeFlowMain() {
  const CS = 'mecatube-flow-cs';
  const PAGE = 'mecatube-flow-page';

  function base64ToBytes(base64) {
    const binary = atob(String(base64 ?? ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { base64ToBytes };
  if (typeof window === 'undefined' || window.__mecatubeFlowMain) return;
  window.__mecatubeFlowMain = true;

  const proto = HTMLInputElement.prototype;
  const original = { click: proto.click, showPicker: proto.showPicker };
  let pending = null;

  const reply = (type, extra = {}) => window.postMessage({ source: PAGE, type, ...extra }, '*');

  function fill(input, payload) {
    const file = new File([base64ToBytes(payload.base64)], payload.name || 'referencia.png', {
      type: payload.mime || 'image/png',
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function intercept(input, fallback) {
    if (!pending || !input || input.type !== 'file') return fallback();
    const payload = pending;
    pending = null;
    try {
      fill(input, payload);
      reply('used');
    } catch (error) {
      reply('error', { message: error?.message ?? String(error) });
    }
    return undefined;
  }

  function arm(payload) {
    pending = payload;
    proto.click = function patchedClick(...args) {
      return intercept(this, () => original.click.apply(this, args));
    };
    if (original.showPicker) {
      proto.showPicker = function patchedShowPicker(...args) {
        return intercept(this, () => original.showPicker.apply(this, args));
      };
    }
    reply('armed');
  }

  function disarm() {
    pending = null;
    proto.click = original.click;
    if (original.showPicker) proto.showPicker = original.showPicker;
    reply('disarmed');
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window || !data || data.source !== CS) return;
    if (data.type === 'arm') arm(data);
    else if (data.type === 'disarm') disarm();
    else if (data.type === 'ping') reply('ready');
  });

  reply('ready');
})();
