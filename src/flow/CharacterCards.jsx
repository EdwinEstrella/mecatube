import { useEffect, useRef, useState } from 'react';
import { allSelected, characterImageUrl } from './characterStatus.js';

function CopyButton({ text }) {
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
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function progressText(job) {
  if (job.captcha) return null;
  if (job.stage === 'project') return 'Proyecto de Flow creado. Generando…';
  if (job.stage === 'starting') return 'Preparando Flow…';
  return job.percent === null || job.percent === undefined ? 'Generando en Flow…' : `Generando en Flow… ${job.percent} %`;
}

// Presentational: one card per character sheet. The container owns jobs, records and sending.
function CharacterCard({ card, record, videoId, job, canStart, hasProject, error, onGenerate, onSelect, onOpenFlow }) {
  const running = Boolean(job) && job.characterKey === card.key;
  const files = (record?.generations ?? []).flatMap((generation) => generation.files);
  const hasGenerations = files.length > 0;

  return (
    <li className="char-card">
      <div className="char-card__header">
        <h3 className="char-card__title">{card.title}</h3>
        {record?.approved && <span className="idea-card__badge idea-card__badge--chosen">Aprobado</span>}
      </div>
      {card.role && <p className="char-card__role">{card.role}</p>}

      <details className="char-card__prompt">
        <summary>Prompt</summary>
        <div className="md-code">
          <div className="md-code__header">
            <span>prompt</span>
            <CopyButton text={card.prompt} />
          </div>
          <pre>{card.prompt}</pre>
        </div>
      </details>

      <div className="char-card__actions">
        <button type="button" className="idea-card__choose" disabled={!canStart || running} onClick={() => onGenerate(card)}>
          {hasGenerations ? 'Regenerar' : 'Generar en Flow'}
        </button>
        {hasProject && (
          <button type="button" className="idea-more" onClick={onOpenFlow}>
            Abrir en Flow
          </button>
        )}
        {running && progressText(job) && <span className="char-card__status">{progressText(job)}</span>}
      </div>

      {running && job.captcha && (
        <p className="char-card__captcha" role="alert">
          Flow pide verificación: resuélvela en la pestaña de Flow del navegador.
        </p>
      )}
      {error && <p className="char-card__error">{error}</p>}

      {hasGenerations && (
        <ul className="char-card__grid" aria-label={`Imágenes de ${card.title}`}>
          {files.map((file) => {
            const selected = record.selectedFile === file;
            return (
              <li key={file}>
                <button
                  type="button"
                  className={`char-card__image${selected ? ' char-card__image--selected' : ''}`}
                  aria-pressed={selected}
                  aria-label={selected ? 'Imagen seleccionada' : 'Seleccionar esta imagen'}
                  onClick={() => onSelect(card.key, file)}
                >
                  <img src={characterImageUrl(videoId, card.key, file)} alt="" loading="lazy" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

// flow: the useFlowCharacters result; isOpen: this is the latest sheets message with no reply after it
export default function CharacterCards({ characters, flow, isOpen, canSend, onApprove, onRequestChanges }) {
  const keys = characters.map((card) => card.key);
  const busy = flow.job !== null;
  const canStart = flow.connected && !busy;

  return (
    <div className="char-cards">
      <ol className="char-cards__list">
        {characters.map((card) => (
          <CharacterCard
            key={card.key}
            card={card}
            record={flow.records[card.key]}
            videoId={flow.videoId}
            job={flow.job}
            canStart={canStart}
            hasProject={Boolean(flow.projectUrl)}
            error={flow.errors[card.key]}
            onGenerate={flow.generate}
            onSelect={flow.select}
            onOpenFlow={flow.openProject}
          />
        ))}
      </ol>
      {!flow.connected && <p className="char-card__hint">Conecta la extensión del navegador para generar en Flow.</p>}
      {flow.errors._ && <p className="char-card__error">{flow.errors._}</p>}

      {isOpen && (
        <div className="char-approval">
          <button
            type="button"
            className="idea-card__choose"
            disabled={!canSend || !allSelected(flow.records, keys)}
            onClick={() => onApprove(keys)}
          >
            Aprobar personaje
          </button>
          <button type="button" className="idea-more" disabled={!canSend} onClick={() => onRequestChanges(keys)}>
            Pedir cambios
          </button>
          {!allSelected(flow.records, keys) && <span className="char-card__hint">Elige una imagen por personaje para aprobar.</span>}
        </div>
      )}
    </div>
  );
}
