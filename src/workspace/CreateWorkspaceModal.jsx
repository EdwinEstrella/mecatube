import { useState } from 'react';
import StylePicker from './StylePicker.jsx';
import { DEFAULT_STYLE_ID } from '../prompts/styles.js';

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [style, setStyle] = useState(DEFAULT_STYLE_ID);
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
      setError('Por favor ingresa un nombre para el espacio de trabajo.');
      return;
    }
    if (!targetPath.trim()) {
      setError('Por favor selecciona una carpeta para guardar tus trabajos.');
      return;
    }

    setIsBusy(true);
    setError('');
    try {
      await window.electronAPI?.createWorkspace({
        name: name.trim(),
        path: targetPath.trim(),
        style,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo crear el espacio de trabajo.');
      setIsBusy(false);
    }
  };

  return (
    <div
      className="workspace-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="workspace-modal__card">
        <div className="workspace-modal__header">
          <h2 className="workspace-modal__title">
            Nuevo Espacio de Trabajo
          </h2>
          <p className="workspace-modal__description">
            Configura una carpeta donde se guardarán todos tus videos, audios de voz en off, ideas y proyectos.
          </p>
        </div>

        {error && (
          <div className="workspace-modal__error">
            {error}
          </div>
        )}

        <div className="workspace-modal__form">
          <div className="workspace-modal__field">
            <label className="workspace-modal__label">
              Nombre del espacio de trabajo
            </label>
            <input
              type="text"
              className="workspace-modal__input"
              placeholder="Ej: Canal Stickman, Misterios, etc."
              value={name}
              disabled={isBusy}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="workspace-modal__field">
            <label className="workspace-modal__label">
              Carpeta de destino
            </label>
            <div className="workspace-modal__folder-row">
              <input
                type="text"
                className="workspace-modal__input workspace-modal__input--folder"
                readOnly
                placeholder="Ninguna carpeta seleccionada"
                value={targetPath}
              />
              <button
                type="button"
                className="settings__button settings__button--ghost"
                disabled={isBusy}
                onClick={handleSelectFolder}
              >
                Examinar...
              </button>
            </div>
          </div>

          <div className="workspace-modal__field">
            <label className="workspace-modal__label">
              Estilo visual
            </label>
            <StylePicker value={style} onChange={setStyle} disabled={isBusy} />
          </div>
        </div>

        <div className="workspace-modal__actions">
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
