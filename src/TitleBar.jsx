import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import CreateWorkspaceModal from './workspace/CreateWorkspaceModal.jsx';
import UpdateButton from './updates/UpdateButton.jsx';
import logoUrl from './assets/logo.png';

// Crisp 12px caption glyphs matching the user's Electron reference frame
function MinimizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1" y="5" width="10" height="1" fill="currentColor" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1" y="3" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
      <polyline points="3 3 3 1 11 1 11 9" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default function TitleBar() {
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const menuRef = useRef(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return undefined;
    api.isFullScreen().then(setIsFullScreen);
    api.getCurrentWorkspace?.().then(setCurrentWorkspace);
    api.listWorkspaces?.().then(setWorkspaces);
    return api.onFullScreenChange(setIsFullScreen);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isMenuOpen]);

  return (
    <>
      <motion.header
        className="title-bar"
        onDoubleClick={() => window.electronAPI?.toggleFullScreen()}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="title-bar__left">
          <div className="title-bar__brand">
            <img src={logoUrl} alt="Mecatube logo" className="title-bar__logo" />
            <span className="title-bar__name">Mecatube</span>
            <span className="title-bar__version">v{__APP_VERSION__}</span>
          </div>

          <div className="title-bar__menu-container" ref={menuRef} onDoubleClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`title-bar__menu-btn${isMenuOpen ? ' title-bar__menu-btn--active' : ''}`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
            >
              Archivo
            </button>

            {currentWorkspace && (
              <span
                className="title-bar__workspace-tag"
                title={`Carpeta: ${currentWorkspace.path} (Click para abrir en el Explorador)`}
                onClick={() => window.electronAPI?.revealWorkspace?.()}
              >
                📁 {currentWorkspace.name}
              </span>
            )}

            {isMenuOpen && (
              <div className="title-bar__dropdown">
                <button
                  type="button"
                  className="title-bar__dropdown-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsModalOpen(true);
                  }}
                >
                  <span>➕ Crear espacio de trabajo nuevo...</span>
                </button>
                <button
                  type="button"
                  className="title-bar__dropdown-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    window.electronAPI?.revealWorkspace?.();
                  }}
                >
                  <span>📂 Abrir carpeta en el Explorador</span>
                </button>

                {workspaces && workspaces.length > 1 && (
                  <>
                    <div className="title-bar__dropdown-divider" />
                    <div className="title-bar__dropdown-header">Espacios de trabajo</div>
                    {workspaces.map((ws) => {
                      const isActive = ws.id === currentWorkspace?.id;
                      return (
                        <button
                          key={ws.id}
                          type="button"
                          className={`title-bar__dropdown-item${isActive ? ' title-bar__dropdown-item--active' : ''}`}
                          onClick={async () => {
                            setIsMenuOpen(false);
                            if (!isActive) {
                              await window.electronAPI?.switchWorkspace?.(ws.id);
                            }
                          }}
                        >
                          <span className="title-bar__dropdown-text">
                            {ws.name}
                          </span>
                          {isActive && <span className="title-bar__dropdown-check">✓</span>}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="title-bar__update-slot" onDoubleClick={(event) => event.stopPropagation()}>
          <UpdateButton />
        </div>

        <div className="title-bar__actions" onDoubleClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="title-bar__button"
            aria-label="Minimizar"
            title="Minimizar"
            onClick={() => window.electronAPI?.minimizeWindow()}
          >
            <MinimizeIcon />
          </button>
          <button
            type="button"
            className="title-bar__button"
            aria-label={isFullScreen ? 'Restaurar' : 'Maximizar'}
            title={isFullScreen ? 'Restaurar' : 'Maximizar'}
            onClick={() => window.electronAPI?.toggleFullScreen()}
          >
            {isFullScreen ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button
            type="button"
            className="title-bar__button title-bar__button--close"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={() => window.electronAPI?.closeWindow()}
          >
            <CloseIcon />
          </button>
        </div>
      </motion.header>

      <CreateWorkspaceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
