import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

// Caption glyphs drawn on a 10x10 grid with 1px strokes, matching the Windows caption style used by Chromium-based browsers
function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M2.5 2.5V0.5h7v7h-2" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default function TitleBar() {
  const [isFullScreen, setIsFullScreen] = useState(true);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return undefined;
    api.isFullScreen().then(setIsFullScreen);
    return api.onFullScreenChange(setIsFullScreen);
  }, []);

  return (
    <motion.header
      className="title-bar"
      onDoubleClick={() => window.electronAPI?.toggleFullScreen()}
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="title-bar__brand">
        <span className="title-bar__name">Mecatube</span>
        <span className="title-bar__version">v{__APP_VERSION__}</span>
      </div>

      <div className="title-bar__actions" onDoubleClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="title-bar__button"
          aria-label="Minimize"
          title="Minimize"
          onClick={() => window.electronAPI?.minimizeWindow()}
        >
          <MinimizeIcon />
        </button>
        <button
          type="button"
          className="title-bar__button"
          aria-label={isFullScreen ? 'Restore' : 'Maximize'}
          title={isFullScreen ? 'Restore' : 'Maximize'}
          onClick={() => window.electronAPI?.toggleFullScreen()}
        >
          {isFullScreen ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          type="button"
          className="title-bar__button title-bar__button--close"
          aria-label="Close"
          title="Close"
          onClick={() => window.electronAPI?.closeWindow()}
        >
          <CloseIcon />
        </button>
      </div>
    </motion.header>
  );
}
