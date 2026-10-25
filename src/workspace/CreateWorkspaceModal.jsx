import { useState } from 'react';

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    setError('');
    try {
      const selected = await window.electronAPI?.selectWorkspaceDirectory();
      if (selected) {
        setTargetPath(selected);
      }
    } catch (err) {
      setError(err.message || 'Error seleccionando la carpeta.');
    }
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Por favor ingresá un nombre para el espacio de trabajo.');
      return;
    }
    if (!targetPath.trim()) {
      setError('Por favor seleccioná una carpeta para guardar tus trabajos.');
      return;
    }

    setIsBusy(true);
    setError('');
    try {
      await window.electronAPI?.createWorkspace({
        name: name.trim(),
        path: targetPath.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo crear el espacio de trabajo.');
      setIsBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        userSelect: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#15151c',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 600, color: '#fff' }}>
            Nuevo Espacio de Trabajo
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.4 }}>
            Configurá una carpeta donde se guardarán todos tus videos, audios de voz en off, ideas y proyectos.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '6px',
              }}
            >
              Nombre del espacio de trabajo
            </label>
            <input
              type="text"
              className="chat-list__rename"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px' }}
              placeholder="Ej: Canal Stickman, Misterios, etc."
              value={name}
              disabled={isBusy}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '6px',
              }}
            >
              Carpeta de destino
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="chat-list__rename"
                style={{
                  flex: 1,
                  boxSizing: 'border-box',
                  padding: '9px 12px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  opacity: targetPath ? 1 : 0.6,
                }}
                readOnly
                placeholder="Ninguna carpeta seleccionada"
                value={targetPath}
              />
              <button
                type="button"
                className="settings__button settings__button--ghost"
                disabled={isBusy}
                onClick={handleSelectFolder}
                style={{ flexShrink: 0 }}
              >
                Examinar...
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <button
            type="button"
            className="settings__button settings__button--ghost"
            disabled={isBusy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="settings__button settings__button--primary"
            disabled={isBusy || !name.trim() || !targetPath.trim()}
            onClick={handleCreate}
          >
            {isBusy ? 'Creando...' : 'Crear y abrir'}
          </button>
        </div>
      </div>
    </div>
  );
}
