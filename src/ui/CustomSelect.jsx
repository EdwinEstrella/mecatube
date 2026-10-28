import { useState, useRef, useEffect } from 'react';

export default function CustomSelect({
  value,
  options = [],
  groups = null,
  placeholder = 'Seleccionar...',
  ariaLabel = 'Selector',
  disabled = false,
  onChange,
  className = '',
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Support both flat options array and grouped structure
  const groupedStructure = groups
    ? groups
    : [{ label: null, options: options }];

  const allOptions = groupedStructure.flatMap((g) => g.options || []);
  const selectedItem = allOptions.find((opt) => String(opt.value) === String(value));
  const displayText = selectedItem ? selectedItem.label : placeholder;

  return (
    <div
      ref={containerRef}
      className={`custom-select ${className}`}
      style={style}
    >
      <button
        type="button"
        className={`custom-select__trigger video-detail__select ${disabled ? 'custom-select__trigger--disabled' : ''}`}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
      >
        <span className="custom-select__trigger-text">
          {displayText}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`custom-select__arrow ${isOpen ? 'custom-select__arrow--open' : ''}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="custom-select__menu"
          role="listbox"
        >
          {groupedStructure.map((group, gIdx) => (
            <div key={group.label || gIdx} className="custom-select__group">
              {group.label && (
                <div className="custom-select__group-label">
                  {group.label}
                </div>
              )}
              {group.options.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                const optClasses = [
                  'custom-select__option',
                  isSelected ? 'custom-select__option--selected' : '',
                  opt.disabled ? 'custom-select__option--disabled' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    title={opt.title}
                    className={optClasses}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange?.(opt.value);
                      setIsOpen(false);
                    }}
                  >
                    <span className="custom-select__option-text">
                      {opt.label}
                    </span>
                    {isSelected && <span className="custom-select__check">✓</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
