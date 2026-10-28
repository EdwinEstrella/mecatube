export default function CustomCheckbox({ checked, disabled, onChange, label, className = '' }) {
  return (
    <label className={`custom-checkbox ${disabled ? 'custom-checkbox--disabled' : ''} ${className}`}>
      <input
        type="checkbox"
        className="custom-checkbox__native"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className={`custom-checkbox__box ${checked ? 'custom-checkbox__box--checked' : ''}`}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label && <span className="settings__card-text custom-checkbox__label">{label}</span>}
    </label>
  );
}
