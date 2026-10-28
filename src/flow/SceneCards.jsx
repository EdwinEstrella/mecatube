import { useEffect, useRef, useState } from 'react';
import { isActive, latestFiles, pendingScenes, selectedCount, sceneImageUrl, sceneStatusLabel } from './sceneStatus.js';
import ImageLightbox from '../ui/ImageLightbox.jsx';

export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <button type="button" className="md-code__copy" onClick={handleCopy}>
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

const KIND_LABELS = { scene: 'Escena', explanation: 'Explicación' };

function sceneHeading(scene) {
  const label = KIND_LABELS[scene.kind];
  return [`Imagen ${String(scene.number).padStart(2, '0')}`, label, scene.title].filter(Boolean).join(' · ');
}

// Presentational: one card per image prompt. The container owns the queue, records and sending.
// labels (optional): { heading, generate, regenerate, images } overrides for non-scene items (the thumbnail)
function SceneCard({
  scene,
  record,
  status,
  videoId,
  canStart,
  onGenerate,
  onSelect,
  labels = {},
  layout = 'list',
  orientation = 'horizontal',
  onZoom,
}) {
  // Only the latest pair: regenerating replaces the previous images
  const files = latestFiles(record);
  const label = sceneStatusLabel(status, record);
  const active = isActive(status);
  const sheets = scene.sheetRefs?.length > 0 ? `Hoja${scene.sheetRefs.length > 1 ? 's' : ''} ${scene.sheetRefs.join(', ')}` : '';

  const [showZoom, setShowZoom] = useState(false);
  const [activeOption, setActiveOption] = useState(null);
  const [showAllOptions, setShowAllOptions] = useState(false);

  useEffect(() => {
    setShowZoom(false);
    setActiveOption(null);
    setShowAllOptions(false);
  }, [scene.number, record?.selectedFile]);

  if (layout === 'grid') {
    const selectedFile = record?.selectedFile && files.includes(record.selectedFile) ? record.selectedFile : null;
    const hasSelection = Boolean(selectedFile);
    const compactHeading = labels.heading ?? `Imagen ${String(scene.number).padStart(2, '0')}`;

    return (
      <li className="char-card scene-card scene-card--compact">
        <div className="scene-card__compact-header">
          <span className="scene-card__compact-title" title={scene.title || labels.heading || ''}>
            {compactHeading}
          </span>
          <div className="scene-card__compact-badges">
            {scene.hook && <span className="scene-card__badge scene-card__badge--hook">Gancho</span>}
            {label.text && <span className={`scene-card__badge scene-card__badge--${label.tone}`}>{label.text}</span>}
          </div>
        </div>

        <div className={`scene-card__media-box scene-card__media-box--${orientation}`}>
          {files.length === 0 ? (
            <div className="scene-card__media-empty">
              {status?.state === 'running' ? (
                <span>{label.text || 'Generando…'}</span>
              ) : (
                <span>Sin imagen</span>
              )}
            </div>
          ) : hasSelection && !showAllOptions ? (
            <div
              className="scene-card__media-clickable"
              onClick={() => setShowZoom((v) => !v)}
              role="button"
              tabIndex={0}
              aria-label="Imagen seleccionada"
            >
              <img
                src={sceneImageUrl(videoId, scene.number, selectedFile)}
                alt={scene.title || ''}
                loading="lazy"
                className="scene-card__media-img"
              />
              {showZoom && (
                <button
                  type="button"
                  className="scene-card__zoom-btn"
                  title="Ampliar imagen"
                  aria-label="Ampliar imagen"
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoom?.(sceneImageUrl(videoId, scene.number, selectedFile), labels.heading ?? sceneHeading(scene));
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              )}
              {files.length > 1 && (
                <button
                  type="button"
                  className="scene-card__change-btn"
                  title="Ver opciones generadas"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllOptions(true);
                  }}
                >
                  Cambiar
                </button>
              )}
            </div>
          ) : (
            <div className="scene-card__thumbs-grid">
              {files.map((file) => {
                const isRevealed = activeOption === file;
                const isSelected = selectedFile === file;
                const url = sceneImageUrl(videoId, scene.number, file);
                return (
                  <div key={file} className={`scene-card__thumb-wrap${isSelected ? ' scene-card__thumb-wrap--selected' : ''}`}>
                    <div
                      className="scene-card__thumb-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveOption(isRevealed ? null : file)}
                      aria-label="Opción de imagen"
                    >
                      <img src={url} alt="" loading="lazy" className="scene-card__thumb-img" />
                      {isRevealed && (
                        <>
                          <button
                            type="button"
                            className="scene-card__zoom-btn"
                            title="Ampliar imagen"
                            aria-label="Ampliar imagen"
                            onClick={(e) => {
                              e.stopPropagation();
                              onZoom?.(url, labels.heading ?? sceneHeading(scene));
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="scene-card__use-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(scene.number, file);
                              setShowAllOptions(false);
                            }}
                          >
                            Usar esta
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasSelection && showAllOptions && (
                <button
                  type="button"
                  className="scene-card__cancel-change-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllOptions(false);
                  }}
                >
                  Ocultar
                </button>
              )}
            </div>
          )}
        </div>

        <div className="char-card__actions scene-card__actions--compact">
          <button
            type="button"
            className="idea-card__choose scene-card__btn--compact"
            disabled={!canStart || active}
            onClick={() => onGenerate(scene)}
          >
            {files.length > 0 ? (labels.regenerate ?? 'Regenerar') : (labels.generate ?? 'Generar en Flow')}
          </button>
        </div>

        {status?.state === 'running' && status.captcha && (
          <p className="char-card__captcha" role="alert">
            Flow pide verificación: resuélvela en la pestaña de Flow del navegador.
          </p>
        )}
        {status?.state === 'error' && status.error && <p className="char-card__error">{status.error}</p>}

        <details className="char-card__prompt scene-card__prompt--compact">
          <summary>
            Prompt <span className="char-card__chars">({scene.prompt.length.toLocaleString('es')} caracteres)</span>
          </summary>
          <div className="md-code">
            <div className="md-code__header">
              <span>prompt</span>
              <CopyButton text={scene.prompt} />
            </div>
            <pre className="scene-card__pre">{scene.prompt}</pre>
          </div>
        </details>
      </li>
    );
  }

  return (
    <li className="char-card scene-card">
      <div className="char-card__header">
        <h3 className="char-card__title">{labels.heading ?? sceneHeading(scene)}</h3>
        {scene.hook && <span className="scene-card__badge scene-card__badge--hook">Gancho</span>}
        {label.text && <span className={`scene-card__badge scene-card__badge--${label.tone}`}>{label.text}</span>}
      </div>
      {sheets && <p className="char-card__role">{sheets} como referencia</p>}

      <details className="char-card__prompt">
        <summary>
          Prompt <span className="char-card__chars">({scene.prompt.length.toLocaleString('es')} caracteres)</span>
        </summary>
        <div className="md-code">
          <div className="md-code__header">
            <span>prompt</span>
            <CopyButton text={scene.prompt} />
          </div>
          <pre className="scene-card__pre">{scene.prompt}</pre>
        </div>
      </details>

      <div className="char-card__actions">
        <button type="button" className="idea-card__choose" disabled={!canStart || active} onClick={() => onGenerate(scene)}>
          {files.length > 0 ? (labels.regenerate ?? 'Regenerar en Flow') : (labels.generate ?? 'Generar en Flow')}
        </button>
      </div>

      {status?.state === 'running' && status.captcha && (
        <p className="char-card__captcha" role="alert">
          Flow pide verificación: resuélvela en la pestaña de Flow del navegador.
        </p>
      )}
      {status?.state === 'error' && status.error && <p className="char-card__error">{status.error}</p>}

      {files.length > 0 && (
        <ul className="scene-card__grid" aria-label={labels.images ?? `Imágenes de la escena ${scene.number}`}>
          {files.map((file) => {
            const selected = record.selectedFile === file;
            return (
              <li key={file} className="scene-card__thumb">
                <button
                  type="button"
                  className={`char-card__image${selected ? ' char-card__image--selected' : ''}`}
                  aria-pressed={selected}
                  aria-label={selected ? 'Imagen seleccionada' : 'Seleccionar esta imagen'}
                  onClick={() => onSelect(scene.number, file)}
                >
                  <img src={sceneImageUrl(videoId, scene.number, file)} alt="" loading="lazy" />
                  {selected && (
                    <span className="char-card__selected-badge">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Seleccionada
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

const THUMBNAIL_LABELS = {
  generate: 'Generar miniatura en Flow',
  regenerate: 'Regenerar miniatura',
  images: 'Imágenes de la miniatura',
};

// The thumbnail: one card on the scene pipeline (reserved scene number), without the block bar.
// thumbnail: parseThumbnail result; flow: the useFlowScenes result
export function ThumbnailCard({ thumbnail, flow, characterBusy, layout = 'list', orientation = 'horizontal' }) {
  const [lightboxImage, setLightboxImage] = useState(null);
  const canStart = flow.connected && !characterBusy;
  const heading = thumbnail.title ? `Miniatura · ${thumbnail.title}` : 'Miniatura';
  return (
    <div className="char-cards scene-cards">
      {!flow.connected && <p className="char-card__hint">Conecta la extensión del navegador para generar en Flow.</p>}
      {characterBusy && <p className="char-card__hint">Hay una hoja de personaje generándose; espera a que termine.</p>}
      {flow.error && <p className="char-card__error">{flow.error}</p>}
      <ol className={`char-cards__list ${layout === 'grid' ? 'char-cards__list--grid' : ''}`}>
        <SceneCard
          scene={thumbnail}
          record={flow.records[thumbnail.number]}
          status={flow.statuses[thumbnail.number]}
          videoId={flow.videoId}
          canStart={canStart}
          onGenerate={(item) => flow.generate([item])}
          onSelect={flow.select}
          labels={{ ...THUMBNAIL_LABELS, heading }}
          layout={layout}
          orientation={orientation}
          onZoom={(src, title) => setLightboxImage({ src, title })}
        />
      </ol>
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          title={lightboxImage.title}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}

// flow: the useFlowScenes result; characterBusy: a character-sheet job holds the single Flow slot
export default function SceneCards({ block, scenes, flow, characterBusy, layout = 'list', orientation = 'horizontal' }) {
  const [lightboxImage, setLightboxImage] = useState(null);
  const canStart = flow.connected && !characterBusy;
  const pending = pendingScenes(scenes, flow.statuses, flow.records);
  const queued = scenes.some((scene) => isActive(flow.statuses[scene.number]));

  return (
    <div className="char-cards scene-cards">
      <div className="scene-cards__bar">
        <span className="scene-cards__title">
          {block ? `Bloque ${block.index} de ${block.total} · Imágenes ${block.from} a ${block.to}` : `${scenes.length} imágenes`}
        </span>
        <span className="char-card__hint">
          {selectedCount(scenes, flow.records)} de {scenes.length} elegidas
        </span>
        <button type="button" className="idea-card__choose" disabled={!canStart || pending.length === 0} onClick={() => flow.generate(pending)}>
          Generar todas
        </button>
        <button type="button" className="idea-more" disabled={!queued} onClick={flow.cancel}>
          Detener cola
        </button>
        {flow.projectUrl && (
          <button type="button" className="idea-more" onClick={flow.openProject}>
            Abrir en Flow
          </button>
        )}
      </div>
      {!flow.connected && <p className="char-card__hint">Conecta la extensión del navegador para generar en Flow.</p>}
      {characterBusy && <p className="char-card__hint">Hay una hoja de personaje generándose; espera a que termine.</p>}
      {flow.error && <p className="char-card__error">{flow.error}</p>}

      <ol className={`char-cards__list ${layout === 'grid' ? 'char-cards__list--grid' : ''}`}>
        {scenes.map((scene) => (
          <SceneCard
            key={scene.number}
            scene={scene}
            record={flow.records[scene.number]}
            status={flow.statuses[scene.number]}
            videoId={flow.videoId}
            canStart={canStart}
            onGenerate={(item) => flow.generate([item])}
            onSelect={flow.select}
            layout={layout}
            orientation={orientation}
            onZoom={(src, title) => setLightboxImage({ src, title })}
          />
        ))}
      </ol>
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          title={lightboxImage.title}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
