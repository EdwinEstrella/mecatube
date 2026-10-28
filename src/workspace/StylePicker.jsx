import { STYLES, DEFAULT_STYLE_ID } from '../prompts/styles.js';

/**
 * Presentational style picker component.
 * Renders a responsive grid of square cards for each visual style.
 *
 * @param {Object} props
 * @param {string} props.value - Selected style ID
 * @param {(styleId: string) => void} props.onChange - Selection handler
 * @param {boolean} [props.disabled=false] - Whether buttons are disabled
 */
export default function StylePicker({ value = DEFAULT_STYLE_ID, onChange, disabled = false }) {
  return (
    <div className="style-picker" role="radiogroup" aria-label="Estilo visual">
      {STYLES.map((style) => {
        const isSelected = (value || DEFAULT_STYLE_ID) === style.id;
        return (
          <button
            key={style.id}
            type="button"
            className={`style-picker__card${isSelected ? ' style-picker__card--selected' : ''}`}
            aria-pressed={isSelected}
            aria-label={`${style.label}: ${style.description}`}
            disabled={disabled}
            onClick={() => onChange?.(style.id)}
          >
            <img src={style.image} alt={style.label} className="style-picker__image" />
            <div className="style-picker__overlay">
              <span className="style-picker__label">{style.label}</span>
              <span className="style-picker__description">{style.description}</span>
            </div>
            {isSelected && (
              <div className="style-picker__badge" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
