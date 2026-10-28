import { CopyButton } from './SceneCards.jsx';
import { isActive, sceneImageUrl, sceneStatusLabel } from './sceneStatus.js';
import { animationVideoUrl, hasSourceImage, hookCount, latestVideo, pendingAnimations } from './animationStatus.js';

const KIND_LABELS = { scene: 'Escena', explanation: 'Explicación' };

function animationHeading(item) {
  const label = KIND_LABELS[item.kind];
  return [`Animación ${String(item.number).padStart(2, '0')}`, label, item.title].filter(Boolean).join(' · ');
}

// Presentational: one card per animation prompt. The container owns the queue, records and sending.
function AnimationCard({
  item,
  record,
  status,
  videoId,
  hasSource,
  sceneRecord,
  canStart,
  onAnimate,
  layout = 'list',
  orientation = 'horizontal',
}) {
  const video = latestVideo(record);
  const label = sceneStatusLabel(status, record);
  const active = isActive(status);
  const number = String(item.number).padStart(2, '0');

  if (layout === 'grid') {
    return (
      <li className="char-card scene-card scene-card--compact">
        <div className="scene-card__compact-header">
          <span className="scene-card__compact-title" title={item.title || ''}>
            {`Animación ${number}`}
          </span>
          <div className="scene-card__compact-badges">
            {item.hook && <span className="scene-card__badge scene-card__badge--hook">Gancho</span>}
            {label.text && <span className={`scene-card__badge scene-card__badge--${label.tone}`}>{label.text}</span>}
          </div>
        </div>

        <div className={`scene-card__media-box scene-card__media-box--${orientation}`}>
          {video ? (
            <video
              className="animation-card__video scene-card__media-video"
              controls
              preload="metadata"
              src={animationVideoUrl(videoId, item.number, video)}
              aria-label={`Animación de la escena ${item.number}`}
            />
          ) : hasSource && sceneRecord?.selectedFile ? (
            <img
              src={sceneImageUrl(videoId, item.number, sceneRecord.selectedFile)}
              alt=""
              loading="lazy"
              className="scene-card__media-img"
            />
          ) : (
            <div className="scene-card__media-empty">
              <span>{hasSource ? 'Sin video' : 'Sin imagen de inicio'}</span>
            </div>
          )}
        </div>

        <div className="char-card__actions scene-card__actions--compact">
          <button
            type="button"
            className="idea-card__choose scene-card__btn--compact"
            disabled={!canStart || active || !hasSource}
            onClick={() => onAnimate(item)}
          >
            {video ? 'Reanimar' : 'Animar en Flow'}
          </button>
        </div>
        {!hasSource && (
          <p className="char-card__hint scene-card__hint--compact">
            Elige la imagen de la escena {number} para poder animarla.
          </p>
        )}

        {status?.state === 'running' && status.captcha && (
          <p className="char-card__captcha" role="alert">
            Flow pide verificación: resuélvela en la pestaña de Flow del navegador.
          </p>
        )}
        {status?.state === 'error' && status.error && <p className="char-card__error">{status.error}</p>}

        <details className="char-card__prompt scene-card__prompt--compact">
          <summary>
            Prompt <span className="char-card__chars">({item.prompt.length.toLocaleString('es')} caracteres)</span>
          </summary>
          <div className="md-code">
            <div className="md-code__header">
              <span>prompt</span>
              <CopyButton text={item.prompt} />
            </div>
            <pre className="scene-card__pre">{item.prompt}</pre>
          </div>
        </details>
      </li>
    );
  }

  return (
    <li className="char-card scene-card">
      <div className="char-card__header">
        <h3 className="char-card__title">{animationHeading(item)}</h3>
        {item.hook && <span className="scene-card__badge scene-card__badge--hook">Gancho</span>}
        {label.text && <span className={`scene-card__badge scene-card__badge--${label.tone}`}>{label.text}</span>}
      </div>

      <details className="char-card__prompt">
        <summary>
          Prompt <span className="char-card__chars">({item.prompt.length.toLocaleString('es')} caracteres)</span>
        </summary>
        <div className="md-code">
          <div className="md-code__header">
            <span>prompt</span>
            <CopyButton text={item.prompt} />
          </div>
          <pre className="scene-card__pre">{item.prompt}</pre>
        </div>
      </details>

      <div className="char-card__actions">
        <button type="button" className="idea-card__choose" disabled={!canStart || active || !hasSource} onClick={() => onAnimate(item)}>
          {video ? 'Reanimar' : 'Animar en Flow'}
        </button>
      </div>
      {!hasSource && <p className="char-card__hint">Elige la imagen de la escena {number} para poder animarla.</p>}

      {status?.state === 'running' && status.captcha && (
        <p className="char-card__captcha" role="alert">
          Flow pide verificación: resuélvela en la pestaña de Flow del navegador.
        </p>
      )}
      {status?.state === 'error' && status.error && <p className="char-card__error">{status.error}</p>}

      {video && (
        <video
          className="animation-card__video"
          controls
          preload="metadata"
          src={animationVideoUrl(videoId, item.number, video)}
          aria-label={`Animación de la escena ${item.number}`}
        />
      )}
    </li>
  );
}

// flow: the useFlowAnimations result; sceneRecords: stored scenes by number (their chosen image is the
// start frame); characterBusy: a character-sheet job holds the single Flow slot
export default function AnimationCards({
  block,
  animations,
  flow,
  sceneRecords,
  characterBusy,
  layout = 'list',
  orientation = 'horizontal',
}) {
  const canStart = flow.connected && !characterBusy;
  const hooks = hookCount(animations);
  const pendingHooks = pendingAnimations(animations, flow.statuses, flow.records, sceneRecords, { hookOnly: true });
  const pendingAll = pendingAnimations(animations, flow.statuses, flow.records, sceneRecords);
  const queued = animations.some((item) => isActive(flow.statuses[item.number]));
  const withoutImage = animations.filter((item) => !hasSourceImage(sceneRecords?.[item.number])).length;

  return (
    <div className="char-cards scene-cards">
      <div className="scene-cards__bar">
        <span className="scene-cards__title">
          {block ? `Bloque ${block.index} de ${block.total} · Animaciones ${block.from} a ${block.to}` : `${animations.length} animaciones`}
        </span>
        <span className="char-card__hint">
          {hooks} del gancho · {animations.length - withoutImage} con imagen elegida
        </span>
        <button
          type="button"
          className="idea-card__choose"
          disabled={!canStart || pendingHooks.length === 0}
          title={hooks === 0 ? 'Este bloque no tiene animaciones marcadas como gancho.' : undefined}
          onClick={() => flow.generate(pendingHooks)}
        >
          Animar gancho
        </button>
        <button type="button" className="idea-more" disabled={!canStart || pendingAll.length === 0} onClick={() => flow.generate(pendingAll)}>
          Animar todas
        </button>
        <button type="button" className="idea-more" disabled={!queued} onClick={flow.cancel}>
          Detener cola
        </button>
      </div>
      {!flow.connected && <p className="char-card__hint">Conecta la extensión del navegador para animar en Flow.</p>}
      {characterBusy && <p className="char-card__hint">Hay una hoja de personaje generándose; espera a que termine.</p>}
      {withoutImage > 0 && (
        <p className="char-card__hint">
          {withoutImage === 1 ? '1 animación no tiene' : `${withoutImage} animaciones no tienen`} imagen elegida en su escena: elígela en las tarjetas de imágenes.
        </p>
      )}
      {flow.error && <p className="char-card__error">{flow.error}</p>}

      <ol className={`char-cards__list ${layout === 'grid' ? 'char-cards__list--grid' : ''}`}>
        {animations.map((item) => (
          <AnimationCard
            key={item.number}
            item={item}
            record={flow.records[item.number]}
            status={flow.statuses[item.number]}
            videoId={flow.videoId}
            hasSource={hasSourceImage(sceneRecords?.[item.number])}
            sceneRecord={sceneRecords?.[item.number]}
            canStart={canStart}
            onAnimate={(chosen) => flow.generate([chosen])}
            layout={layout}
            orientation={orientation}
          />
        ))}
      </ol>
    </div>
  );
}
