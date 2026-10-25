export default function CustomCheckbox({ checked, disabled, onChange, label, className = '' }) {
  return (
    <label
      className={`custom-checkbox ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          margin: 0,
          pointerEvents: 'none',
        }}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '5px',
          border: checked ? '1px solid #4d6bfe' : '1px solid rgba(255, 255, 255, 0.25)',
          background: checked ? '#4d6bfe' : '#15151c',
          display: 'grid',
          placeItems: 'center',
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label && <span className="settings__card-text" style={{ margin: 0 }}>{label}</span>}
    </label>
  );
}
