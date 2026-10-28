import { useState } from 'react';
import { parseTitlesInput, mapTitleStatus, reorderTitles } from './titleBankHelpers.js';

export default function TitleBank({
  titles = [],
  branch,
  videos = [],
  videoStagesMap = {},
  onSaveTitles,
  onCreateTitleVideo,
  onOpenVideo,
}) {
  const [pasteInput, setPasteInput] = useState('');
  const [isPasting, setIsPasting] = useState(false);
  const [creatingTitleId, setCreatingTitleId] = useState(null);

  const handleAddPastedTitles = async (e) => {
    if (e) e.preventDefault();
    if (!pasteInput.trim()) return;

    const newItems = parseTitlesInput(pasteInput, titles);
    if (newItems.length > 0) {
      const merged = [...titles, ...newItems];
      await onSaveTitles(merged);
    }
    setPasteInput('');
    setIsPasting(false);
  };

  const handleDeleteTitle = async (idToDelete) => {
    const updated = titles.filter((t) => t.id !== idToDelete);
    await onSaveTitles(updated);
  };

  const handleMoveUp = async (index) => {
    if (index <= 0) return;
    const reordered = reorderTitles(titles, index, index - 1);
    await onSaveTitles(reordered);
  };

  const handleMoveDown = async (index) => {
    if (index >= titles.length - 1) return;
    const reordered = reorderTitles(titles, index, index + 1);
    await onSaveTitles(reordered);
  };

  const handleCreateVideo = async (titleItem) => {
    setCreatingTitleId(titleItem.id);
    try {
      await onCreateTitleVideo(titleItem);
    } finally {
      setCreatingTitleId(null);
    }
  };

  return (
    <div className="title-bank">
      <div className="title-bank__header">
        <div>
          <h2 className="title-bank__title">Banco de Títulos</h2>
          <p className="title-bank__subtitle">
            Pega y organiza títulos para producir videos individuales con su tema fijado.
          </p>
        </div>
        <div className="title-bank__header-actions">
          <span className="title-bank__counter">
            {titles.length} / 500 títulos
          </span>
          <button
            type="button"
            className="settings__button settings__button--primary"
            onClick={() => setIsPasting((prev) => !prev)}
          >
            {isPasting ? 'Cerrar importador' : '+ Pegar títulos'}
          </button>
        </div>
      </div>

      {isPasting && (
        <form className="title-bank__paste-box" onSubmit={handleAddPastedTitles}>
          <label className="settings__label" htmlFor="title-bank-paste">
            Pegar títulos (uno por línea, hasta 200 caracteres cada uno):
          </label>
          <textarea
            id="title-bank-paste"
            className="settings__textarea title-bank__paste-textarea"
            rows="5"
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            placeholder="Cómo sobrevivir 30 días en el Ártico&#10;El error que destruyó un imperio&#10;10 inventos que cambiaron la historia…"
          />
          <div className="title-bank__paste-actions">
            <button
              type="submit"
              className="settings__button settings__button--primary"
              disabled={!pasteInput.trim()}
            >
              Agregar a la lista
            </button>
            <button
              type="button"
              className="settings__button settings__button--ghost"
              onClick={() => {
                setPasteInput('');
                setIsPasting(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {titles.length === 0 ? (
        <div className="title-bank__empty">
          <p>El banco de títulos está vacío.</p>
          <p className="title-bank__hint">
            Haz clic en &quot;+ Pegar títulos&quot; para añadir ideas o temas de video rápidamente.
          </p>
        </div>
      ) : (
        <div className="title-bank__list">
          {titles.map((titleItem, index) => {
            const video = videos.find((v) => v.id === titleItem.videoId);
            const stages = videoStagesMap[titleItem.videoId]?.stages || [];
            const { status, label: statusLabel } = mapTitleStatus(titleItem, video, stages);
            const isCreating = creatingTitleId === titleItem.id;

            return (
              <div key={titleItem.id || index} className="title-bank__row">
                <div className="title-bank__reorder">
                  <button
                    type="button"
                    className="title-bank__arrow-btn"
                    title="Subir"
                    aria-label="Subir título"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="title-bank__arrow-btn"
                    title="Bajar"
                    aria-label="Bajar título"
                    disabled={index === titles.length - 1}
                    onClick={() => handleMoveDown(index)}
                  >
                    ▼
                  </button>
                </div>

                <div className="title-bank__text-col">
                  <span className="title-bank__text" title={titleItem.text}>
                    {titleItem.text}
                  </span>
                </div>

                <div className="title-bank__status-col">
                  <span
                    className={`title-bank__badge title-bank__badge--${status}`}
                    title={`Estado: ${statusLabel}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="title-bank__actions-col">
                  {titleItem.videoId ? (
                    <button
                      type="button"
                      className="settings__button settings__button--ghost"
                      onClick={() => onOpenVideo(titleItem.videoId)}
                    >
                      Abrir
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="settings__button settings__button--primary"
                      disabled={isCreating}
                      onClick={() => handleCreateVideo(titleItem)}
                    >
                      {isCreating ? 'Creando…' : 'Crear video'}
                    </button>
                  )}

                  <button
                    type="button"
                    className="title-bank__remove-btn"
                    title="Eliminar título"
                    aria-label="Eliminar título"
                    onClick={() => handleDeleteTitle(titleItem.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
