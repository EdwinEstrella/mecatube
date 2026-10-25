import { useEffect, useRef, useState } from 'react';
import { allFiles, isActive, pendingScenes, selectedCount, sceneImageUrl, sceneStatusLabel } from './sceneStatus.js';

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
function SceneCard({ scene, record, status, videoId, canStart, onGenerate, onSelect }) {
  const files = allFiles(record);
  const label = sceneStatusLabel(status, record);
  const active = isActive(status);
  const sheets = scene.sheetRefs.length > 0 ? `Hoja${scene.sheetRefs.length > 1 ? 's' : ''} ${scene.sheetRefs.join(', ')}` : '';

  return (
    <li className="char-card scene-card">
      <div className="char-card__header">
        <h3 className="char-card__title">{sceneHeading(scene)}</h3>
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
          {files.length > 0 ? 'Regenerar en Flow' : 'Generar en Flow'}
        </button>
      </div>

      {status?.state === 'running' && status.captcha && (
        <p className="char-card__captcha" role="alert">
          Flow pide verificación: resuélvela en la pestaña de Flow del navegador.
        </p>
      )}
      {status?.state === 'error' && status.error && <p className="char-card__error">{status.error}</p>}

      {files.length > 0 && (
        <ul className="scene-card__grid" aria-label={`Imágenes de la escena ${scene.number}`}>
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

// flow: the useFlowScenes result; characterBusy: a character-sheet job holds the single Flow slot
export default function SceneCards({ block, scenes, flow, characterBusy }) {
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

      <ol className="char-cards__list">
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
          />
        ))}
      </ol>
    </div>
  );
}
