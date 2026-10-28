import { useEffect, useState, useRef } from 'react';
import { registerVideoTargetHandler } from './videoTargetDialog.js';

export default function VideoTargetDialog() {
  const queueRef = useRef([]);
  const activeRef = useRef(null);
  const [currentRequest, setCurrentRequest] = useState(null);

  useEffect(() => {
    return registerVideoTargetHandler(({ slot, video }) => {
      return new Promise((resolve) => {
        const item = { slot, video, resolve };
        if (!activeRef.current) {
          activeRef.current = item;
          setCurrentRequest(item);
        } else {
          queueRef.current.push(item);
        }
      });
    });
  }, []);

  const handleChoice = (choice) => {
    if (!activeRef.current) return;
    const { resolve } = activeRef.current;
    activeRef.current = null;
    resolve(choice);

    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      activeRef.current = next;
      setCurrentRequest(next);
    } else {
      setCurrentRequest(null);
    }
  };

  useEffect(() => {
    if (!currentRequest) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleChoice(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentRequest]);

  if (!currentRequest) return null;

  const { slot, video } = currentRequest;
  const isIllustrator = slot === 'illustrator';
  const title = isIllustrator
    ? 'Este video ya tiene un chat de ilustración'
    : 'Este video ya tiene un chat de guion';
  const videoTitle = video?.title || 'Video sin título';
  const warningText = isIllustrator
    ? 'Se borrarán los personajes, escenas y animaciones de este video.'
    : 'El video tomará el guion de este chat.';

  return (
    <div
      className="confirm-modal"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleChoice(null);
      }}
    >
      <div
        className="confirm-modal__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="video-target-title"
      >
        <h2 id="video-target-title" className="confirm-modal__title">
          {title}
        </h2>
        <p className="confirm-modal__text">
          Video actual: <strong>{videoTitle}</strong>
        </p>
        <p className="confirm-modal__note">
          {warningText}
        </p>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="settings__button"
            onClick={() => handleChoice(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="settings__button"
            title={warningText}
            onClick={() => handleChoice('current')}
          >
            Usar el video actual
          </button>
          <button
            type="button"
            className="settings__button settings__button--primary"
            onClick={() => handleChoice('new')}
            autoFocus
          >
            Crear video nuevo
          </button>
        </div>
      </div>
    </div>
  );
}
