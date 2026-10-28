import { useEffect } from 'react';

export default function ImageLightbox({ src, alt = '', title = '', onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      className="image-lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Vista previa de imagen'}
    >
      <div className="image-lightbox__content" onClick={(e) => e.stopPropagation()}>
        <div className="image-lightbox__header">
          {title && <span className="image-lightbox__title">{title}</span>}
          <button
            type="button"
            className="image-lightbox__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
        <div className="image-lightbox__body">
          <img src={src} alt={alt || title || ''} className="image-lightbox__img" />
        </div>
      </div>
    </div>
  );
}
