import { useEffect, useRef, useState } from 'react';

export default function CustomSelect({
  value,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  onChange,
  ariaLabel,
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
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const flatItems = [];
  const groupedStructure = [];

  if (options.length > 0 && 'options' in options[0] && Array.isArray(options[0].options)) {
    options.forEach((group) => {
      groupedStructure.push(group);
      group.options.forEach((opt) => flatItems.push(opt));
    });
  } else {
    const groupsMap = new Map();
    options.forEach((opt) => {
      flatItems.push(opt);
      const groupName = opt.group || '';
      if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, []);
      }
      groupsMap.get(groupName).push(opt);
    });

    if (groupsMap.size === 1 && groupsMap.has('')) {
      groupedStructure.push({ options: groupsMap.get('') });
    } else {
      groupsMap.forEach((opts, name) => {
        groupedStructure.push({ label: name, options: opts });
      });
    }
  }

  const selectedItem = flatItems.find((item) => String(item.value) === String(value));
  const displayText = selectedItem ? selectedItem.label : placeholder;

  return (
    <div
      ref={containerRef}
      className={`custom-select ${className}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <button
        type="button"
        className="custom-select__trigger video-detail__select"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          width: '100%',
          opacity: disabled ? 0.5 : 1,
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
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
          style={{
            flexShrink: 0,
            opacity: 0.6,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="custom-select__menu"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            maxHeight: '260px',
            overflowY: 'auto',
            background: '#15151c',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 100,
            padding: '4px',
          }}
        >
          {groupedStructure.map((group, gIdx) => (
            <div key={group.label || gIdx} className="custom-select__group">
              {group.label && (
                <div
                  style={{
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'rgba(255, 255, 255, 0.4)',
                    padding: '6px 8px 4px',
                    fontWeight: 600,
                  }}
                >
                  {group.label}
                </div>
              )}
              {group.options.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    title={opt.title}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      opacity: opt.disabled ? 0.4 : 1,
                      background: isSelected ? 'rgba(77, 107, 254, 0.2)' : 'transparent',
                      color: isSelected ? '#7189fe' : 'rgba(255, 255, 255, 0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!opt.disabled && !isSelected) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!opt.disabled && !isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange?.(opt.value);
                      setIsOpen(false);
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.label}
                    </span>
                    {isSelected && <span style={{ fontSize: '0.8rem', color: '#7189fe' }}>✓</span>}
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
