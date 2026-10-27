// Browser-only: probes video clip durations via detached <video> elements with concurrency limit.

const TIMEOUT_MS = 8000;
const CONCURRENCY = 4;

function probeClip(url) {
  return new Promise((resolve) => {
    if (!url || typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    let settled = false;
    let timer = null;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.src = '';
      try {
        video.load();
      } catch {
        // Detached element cleanup
      }
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, TIMEOUT_MS);

    video.onloadedmetadata = () => {
      const dur = video.duration;
      cleanup();
      if (typeof dur === 'number' && Number.isFinite(dur) && dur > 0) {
        resolve(dur);
      } else {
        resolve(null);
      }
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.src = url;
  });
}

export async function probeDurations(urlsByNumber) {
  if (!urlsByNumber || typeof urlsByNumber !== 'object') {
    return {};
  }

  const entries = Object.entries(urlsByNumber);
  if (entries.length === 0) {
    return {};
  }

  const results = {};
  let cursor = 0;

  const workers = Array.from({ length: Math.min(CONCURRENCY, entries.length) }, async () => {
    while (cursor < entries.length) {
      const currentIndex = cursor;
      cursor += 1;
      const [key, url] = entries[currentIndex];
      const duration = await probeClip(url);
      if (typeof duration === 'number' && Number.isFinite(duration)) {
        const num = Number(key);
        results[Number.isNaN(num) ? key : num] = duration;
      }
    }
  });

  await Promise.all(workers);
  return results;
}
