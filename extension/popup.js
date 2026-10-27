// Constant map strictly restricting external navigation targets
const ALLOWED_URLS = Object.freeze({
  donate: 'https://buy.stripe.com/dRm8wI8Hk0wq3Y692vcEw0h',
  github: 'https://github.com/EdwinEstrella/mecatube'
});

/**
 * Opens an allowed URL in a new browser tab and closes the extension popup.
 * @param {string} url
 */
function openAllowedUrl(url) {
  if (url !== ALLOWED_URLS.donate && url !== ALLOWED_URLS.github) {
    return;
  }

  if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.create === 'function') {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  window.close();
}

/**
 * Reads the extension version from chrome.runtime.getManifest() and displays it.
 */
function loadVersion() {
  const versionElement = document.getElementById('version');
  if (!versionElement) {
    return;
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) {
        versionElement.textContent = `v${manifest.version}`;
        return;
      }
    }
  } catch {
    // Silently continue to fallback
  }

  // Fallback for standalone / headless visual inspections where chrome.runtime is not available
  try {
    fetch('manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.version && !versionElement.textContent) {
          versionElement.textContent = `v${data.version}`;
        }
      })
      .catch(() => {});
  } catch {
    // Ignore fetch errors in restricted contexts
  }
}

/**
 * Initializes the popup DOM elements and event handlers.
 */
function initializePopup() {
  loadVersion();

  const donateButton = document.getElementById('donate-btn');
  if (donateButton) {
    donateButton.addEventListener('click', (event) => {
      event.preventDefault();
      openAllowedUrl(ALLOWED_URLS.donate);
    });
  }

  const githubLink = document.getElementById('github-link');
  if (githubLink) {
    githubLink.addEventListener('click', (event) => {
      event.preventDefault();
      openAllowedUrl(ALLOWED_URLS.github);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}
