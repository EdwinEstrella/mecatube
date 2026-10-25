const STATUS_LABELS = { done: 'completada', current: 'en curso', pending: 'pendiente' };

// Presentational: the ten stage dots joined by a line. Passing onToggle makes each dot a button.
export default function StageTrack({ stages, onToggle }) {
  return (
    <ol className="stage-track">
      {stages.map((stage, index) => {
        const isLinked = index > 0 && stages[index - 1].status === 'done';
        const hint = `${stage.label}: ${STATUS_LABELS[stage.status] ?? stage.status}${stage.overridden ? ' (manual)' : ''}`;
        const dot = (
          <span className="stage-track__dot" aria-hidden="true">
            {stage.status === 'done' ? '✓' : ''}
          </span>
        );
        return (
          <li
            key={stage.key}
            className={`stage-track__item stage-track__item--${stage.status}${isLinked ? ' stage-track__item--linked' : ''}`}
            title={hint}
          >
            {onToggle ? (
              <button type="button" className="stage-track__button" aria-label={hint} onClick={() => onToggle(stage)}>
                {dot}
              </button>
            ) : (
              dot
            )}
            <span className="stage-track__label">{stage.label}</span>
            {stage.overridden && <span className="stage-track__manual">manual</span>}
          </li>
        );
      })}
    </ol>
  );
}
