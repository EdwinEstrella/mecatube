// Simple subscription bus for video target choice requests
let currentHandler = null;

export function registerVideoTargetHandler(handler) {
  currentHandler = handler;
  return () => {
    if (currentHandler === handler) {
      currentHandler = null;
    }
  };
}

export function chooseVideoTarget({ slot, video }) {
  if (typeof currentHandler === 'function') {
    return currentHandler({ slot, video });
  }
  return Promise.resolve('new');
}
