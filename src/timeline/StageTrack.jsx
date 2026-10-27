export const STATUS_LABELS = { done: 'completada', current: 'en curso', pending: 'pendiente' };

// Presentational: the stage dots joined by a line. Passing onSelect makes each dot/label a button.
export default function StageTrack({ stages, selectedKey, onSelect }) {
  return (
    <ol className="stage-track">
      {stages.map((stage, index) => {
        const isLinked = index > 0 && stages[index - 1].status === 'done';
        const isSelected = stage.key === selectedKey;
        const hint = `${stage.label}: ${STATUS_LABELS[stage.status] ?? stage.status}${stage.overridden ? ' (manual)' : ''}`;
        const dot = (
          <span className="stage-track__dot" aria-hidden="true">
            {stage.status === 'done' ? '✓' : ''}
          </span>
        );
        const content = (
          <>
            {dot}
            <span className="stage-track__label">{stage.label}</span>
            {stage.overridden && <span className="stage-track__manual">manual</span>}
          </>
        );
        return (
          <li
            key={stage.key}
            className={`stage-track__item stage-track__item--${stage.status}${isLinked ? ' stage-track__item--linked' : ''}${
              isSelected ? ' stage-track__item--selected' : ''
            }`}
            title={hint}
            aria-current={isSelected ? 'step' : undefined}
          >
            {onSelect ? (
              <button
                type="button"
                className="stage-track__button"
                aria-label={hint}
                aria-current={isSelected ? 'step' : undefined}
                onClick={() => onSelect(stage)}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
