import { useEffect } from 'react';

// Presentational: asks before deleting a chat and spells out which data goes with it
export default function DeleteChatDialog({ title, hasVideo, isBusy, error, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !isBusy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isBusy, onCancel]);

  return (
    <div
      className="confirm-modal"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onCancel();
      }}
    >
      <div className="confirm-modal__card" role="alertdialog" aria-modal="true" aria-labelledby="delete-chat-title">
        <h2 id="delete-chat-title" className="confirm-modal__title">
          ¿Eliminar este chat?
        </h2>
        <p className="confirm-modal__text">
          Vas a eliminar <strong>{title || 'Sin título'}</strong>. Esta acción no se puede deshacer.
        </p>
        <p className="confirm-modal__text">Se eliminará de Mecatube:</p>
        <ul className="confirm-modal__list">
          <li>La conversación y todos sus mensajes</li>
          {hasVideo && (
            <>
              <li>Las hojas de personajes y las imágenes de las escenas</li>
              <li>El audio de la voz en off</li>
              <li>Los datos del video y su línea de tiempo</li>
            </>
          )}
        </ul>
        {hasVideo && (
          <p className="confirm-modal__note">
            Las imágenes que ya están en Google Flow no se eliminan de Flow, solo de Mecatube.
          </p>
        )}
        {error && <p className="confirm-modal__error">{error}</p>}
        <div className="confirm-modal__actions">
          <button type="button" className="settings__button" disabled={isBusy} onClick={onCancel} autoFocus>
            Cancelar
          </button>
          <button
            type="button"
            className="settings__button settings__button--danger"
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? 'Eliminando…' : 'Eliminar todo'}
          </button>
        </div>
      </div>
    </div>
  );
}
