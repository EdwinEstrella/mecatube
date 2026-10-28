import { useState, useEffect } from 'react';

export default function SeriesPlanner({
  series = {},
  branchId,
  onSaveSeries,
  onGenerateAiOutline,
  onCreateChapterVideo,
  onOpenVideo,
  videoStagesMap = {},
  isAiGenerating = false,
  aiError = '',
}) {
  const [formData, setFormData] = useState({
    idea: series.idea || '',
    beginning: series.beginning || '',
    middle: series.middle || '',
    end: series.end || '',
    chapters: series.chapters ?? 3,
    minutes: series.minutes ?? 5,
  });

  const [outline, setOutline] = useState(series.outline || []);
  const [saveStatus, setSaveStatus] = useState('');
  const [creatingVideoNumber, setCreatingVideoNumber] = useState(null);

  // Sync with prop changes
  useEffect(() => {
    setFormData({
      idea: series.idea || '',
      beginning: series.beginning || '',
      middle: series.middle || '',
      end: series.end || '',
      chapters: series.chapters ?? 3,
      minutes: series.minutes ?? 5,
    });
    setOutline(series.outline || []);
  }, [series]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveForm = async (e) => {
    if (e) e.preventDefault();
    setSaveStatus('Guardando…');
    try {
      await onSaveSeries({
        ...formData,
        chapters: Number(formData.chapters) || 1,
        minutes: Number(formData.minutes) || 1,
        outline,
      });
      setSaveStatus('Guardado');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch {
      setSaveStatus('Error al guardar');
    }
  };

  const handleGenerateOutline = async () => {
    const generated = await onGenerateAiOutline(formData);
    if (Array.isArray(generated) && generated.length > 0) {
      setOutline(generated);
      await onSaveSeries({
        ...formData,
        chapters: Number(formData.chapters) || 1,
        minutes: Number(formData.minutes) || 1,
        outline: generated,
      });
    }
  };

  const handleUpdateChapter = async (index, field, value) => {
    const updated = outline.map((ch, idx) => (idx === index ? { ...ch, [field]: value } : ch));
    setOutline(updated);
    await onSaveSeries({
      ...formData,
      chapters: Number(formData.chapters) || 1,
      minutes: Number(formData.minutes) || 1,
      outline: updated,
    });
  };

  const handleAddChapter = async () => {
    const nextNumber = outline.length > 0 ? Math.max(...outline.map((c) => c.number || 0)) + 1 : 1;
    const newChapter = {
      number: nextNumber,
      title: `Capítulo ${nextNumber}`,
      summary: '',
      videoId: null,
    };
    const updated = [...outline, newChapter];
    setOutline(updated);
    await onSaveSeries({
      ...formData,
      chapters: updated.length,
      minutes: Number(formData.minutes) || 1,
      outline: updated,
    });
  };

  const handleDeleteChapter = async (index) => {
    const updated = outline.filter((_, idx) => idx !== index);
    setOutline(updated);
    await onSaveSeries({
      ...formData,
      chapters: updated.length || 1,
      minutes: Number(formData.minutes) || 1,
      outline: updated,
    });
  };

  const handleCreateVideo = async (chapter) => {
    setCreatingVideoNumber(chapter.number);
    try {
      await onCreateChapterVideo(chapter, { ...formData, outline });
    } finally {
      setCreatingVideoNumber(null);
    }
  };

  return (
    <div className="series-planner">
      <div className="series-planner__header">
        <div>
          <h2 className="series-planner__title">Planificador de Serie</h2>
          <p className="series-planner__subtitle">
            Estructura el arco narrativo y genera o escribe los capítulos para esta rama.
          </p>
        </div>
        <div className="series-planner__header-actions">
          {saveStatus && <span className="series-planner__status-text">{saveStatus}</span>}
          <button
            type="button"
            className="settings__button settings__button--ghost"
            onClick={handleSaveForm}
          >
            Guardar datos
          </button>
        </div>
      </div>

      <form className="series-planner__form" onSubmit={handleSaveForm}>
        <div className="series-planner__field">
          <label className="settings__label" htmlFor="series-idea">
            Idea de la serie
          </label>
          <textarea
            id="series-idea"
            className="settings__textarea series-planner__textarea"
            rows="2"
            value={formData.idea}
            onChange={(e) => handleChange('idea', e.target.value)}
            placeholder="Tema o premisa principal de toda la serie…"
          />
        </div>

        <div className="series-planner__grid-3">
          <div className="series-planner__field">
            <label className="settings__label" htmlFor="series-beginning">
              Inicio
            </label>
            <textarea
              id="series-beginning"
              className="settings__textarea series-planner__textarea"
              rows="3"
              value={formData.beginning}
              onChange={(e) => handleChange('beginning', e.target.value)}
              placeholder="Cómo arranca la historia y se plantea el conflicto…"
            />
          </div>

          <div className="series-planner__field">
            <label className="settings__label" htmlFor="series-middle">
              Nudo / enlace
            </label>
            <textarea
              id="series-middle"
              className="settings__textarea series-planner__textarea"
              rows="3"
              value={formData.middle}
              onChange={(e) => handleChange('middle', e.target.value)}
              placeholder="Desarrollo central, giros y escalada de tensión…"
            />
          </div>

          <div className="series-planner__field">
            <label className="settings__label" htmlFor="series-end">
              Desenlace
            </label>
            <textarea
              id="series-end"
              className="settings__textarea series-planner__textarea"
              rows="3"
              value={formData.end}
              onChange={(e) => handleChange('end', e.target.value)}
              placeholder="Clímax, resolución y revelación final…"
            />
          </div>
        </div>

        <div className="series-planner__row">
          <div className="series-planner__field series-planner__field--inline">
            <label className="settings__label" htmlFor="series-chapters">
              Número de capítulos (1-50):
            </label>
            <input
              id="series-chapters"
              type="number"
              className="settings__input series-planner__number-input"
              min="1"
              max="50"
              value={formData.chapters}
              onChange={(e) => handleChange('chapters', e.target.value)}
            />
          </div>

          <div className="series-planner__field series-planner__field--inline">
            <label className="settings__label" htmlFor="series-minutes">
              Minutos por capítulo (0.5-60):
            </label>
            <input
              id="series-minutes"
              type="number"
              step="0.5"
              min="0.5"
              max="60"
              className="settings__input series-planner__number-input"
              value={formData.minutes}
              onChange={(e) => handleChange('minutes', e.target.value)}
            />
          </div>

          <div className="series-planner__ai-action">
            <button
              type="button"
              className="settings__button settings__button--primary"
              disabled={isAiGenerating}
              onClick={handleGenerateOutline}
            >
              {isAiGenerating ? 'Generando capítulos con IA…' : '✨ Generar capítulos con IA'}
            </button>
          </div>
        </div>

        {aiError && <p className="chat-messages__error">{aiError}</p>}
      </form>

      <div className="series-planner__outline-section">
        <div className="series-planner__outline-header">
          <h3 className="series-planner__section-title">
            Estructura de Capítulos ({outline.length})
          </h3>
          <button
            type="button"
            className="settings__button settings__button--ghost"
            onClick={handleAddChapter}
          >
            + Agregar capítulo manual
          </button>
        </div>

        {outline.length === 0 ? (
          <div className="series-planner__empty-outline">
            <p>Aún no hay capítulos planificados.</p>
            <p className="series-planner__hint">
              Usa &quot;Generar capítulos con IA&quot; para crear el desglose automáticamente a partir de tu inicio, nudo y desenlace, o agrégalos manualmente.
            </p>
          </div>
        ) : (
          <div className="series-planner__chapters-list">
            {outline.map((chapter, index) => {
              const videoId = chapter.videoId;
              const stageInfo = videoId ? videoStagesMap[videoId] : null;
              const isCreating = creatingVideoNumber === chapter.number;

              return (
                <div key={chapter.number || index} className="series-planner__chapter-card">
                  <div className="series-planner__chapter-top">
                    <span className="series-planner__chapter-badge">
                      Cap. {chapter.number}
                    </span>
                    <input
                      type="text"
                      className="settings__input series-planner__chapter-title-input"
                      value={chapter.title}
                      placeholder="Título del capítulo"
                      onChange={(e) => handleUpdateChapter(index, 'title', e.target.value)}
                    />
                    <div className="series-planner__chapter-actions">
                      {videoId ? (
                        <>
                          {stageInfo && (
                            <span
                              className="series-planner__progress-badge"
                              title={`${stageInfo.doneCount} de ${stageInfo.total} etapas`}
                            >
                              {stageInfo.doneCount}/{stageInfo.total} etapas
                            </span>
                          )}
                          <button
                            type="button"
                            className="settings__button settings__button--ghost"
                            onClick={() => onOpenVideo(videoId)}
                          >
                            Abrir
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="settings__button settings__button--primary"
                          disabled={isCreating}
                          onClick={() => handleCreateVideo(chapter)}
                        >
                          {isCreating ? 'Creando…' : 'Crear video'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="series-planner__remove-btn"
                        title="Eliminar capítulo"
                        aria-label="Eliminar capítulo"
                        onClick={() => handleDeleteChapter(index)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="settings__textarea series-planner__chapter-summary-input"
                    rows="2"
                    value={chapter.summary}
                    placeholder="Resumen del capítulo (2-4 oraciones)…"
                    onChange={(e) => handleUpdateChapter(index, 'summary', e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
