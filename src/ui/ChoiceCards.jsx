/**
 * Presentational choice cards component.
 * Renders a compact grid of selectable option cards.
 *
 * @param {Object} props
 * @param {Array<{ id: string, label: string, description?: string, hint?: string, icon?: React.ReactNode }>} props.options
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.disabled=false]
 * @param {number} [props.columns=2]
 * @param {string} [props.ariaLabel]
 */
export default function ChoiceCards({
  options = [],
  value,
  onChange,
  disabled = false,
  columns = 2,
  ariaLabel,
}) {
  return (
    <div
      className={`choice-cards choice-cards--cols-${columns}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isSelected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            className={`choice-card${isSelected ? ' choice-card--selected' : ''}`}
            onClick={() => onChange?.(option.id)}
          >
            <div className="choice-card__header">
              {option.icon && <div className="choice-card__icon">{option.icon}</div>}
              <span className="choice-card__label">{option.label}</span>
              {isSelected && (
                <div className="choice-card__check" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>

            {option.description && (
              <span className="choice-card__description">{option.description}</span>
            )}
            {option.hint && <span className="choice-card__hint">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
