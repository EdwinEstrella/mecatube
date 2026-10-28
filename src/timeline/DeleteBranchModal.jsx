import { useEffect, useState } from 'react';

export default function DeleteBranchModal({
  branch,
  isOpen,
  onClose,
  onDeleted,
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsBusy(false);
      setError('');
    }
  }, [isOpen, branch]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isBusy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, onClose]);

  if (!isOpen || !branch) return null;

  const handleDelete = async () => {
    setIsBusy(true);
    setError('');
    try {
      await window.electronAPI.deleteBranch(branch.id);
      onDeleted?.(branch.id);
      onClose();
    } catch (err) {
      const message = err.message
        ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        : 'Error al eliminar la rama.';
      setError(message);
      setIsBusy(false);
    }
  };

  return (
    <div
      className="confirm-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div
        className="confirm-modal__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-branch-title"
      >
        <h2 id="delete-branch-title" className="confirm-modal__title">
          ¿Eliminar rama?
        </h2>
        <p className="confirm-modal__text">
          Se eliminará la rama <strong>{branch.name}</strong>. Esta acción no se puede deshacer.
        </p>

        {error && <p className="confirm-modal__error">{error}</p>}

        <div className="confirm-modal__actions">
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
            className="settings__button settings__button--danger"
            disabled={isBusy}
            onClick={handleDelete}
          >
            {isBusy ? 'Eliminando...' : 'Eliminar rama'}
          </button>
        </div>
      </div>
    </div>
  );
}
