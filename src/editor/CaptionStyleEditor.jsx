// Presentational editor for configuring caption styles with live preview over clips or images.
import { useMemo, useState } from 'react';
import CustomSelect from '../ui/CustomSelect.jsx';
import CustomCheckbox from '../ui/CustomCheckbox.jsx';
import CaptionPreview from './CaptionPreview.jsx';
import {
  FONTS,
  DEFAULT_CAPTION_STYLE,
  PAGE_EFFECTS,
  WORD_EFFECTS,
  SHADOW_TYPES,
  PRESETS,
  normalizeCaptionStyle,
} from './captionStyle.js';

const WEIGHT_LABELS = {
  100: '100 · Fina',
  200: '200 · Extra ligera',
  300: '300 · Ligera',
  400: '400 · Normal',
  500: '500 · Media',
  600: '600 · Seminegrita',
  700: '700 · Negrita',
  800: '800 · Extranegrita',
  900: '900 · Extra negrita',
};

export default function CaptionStyleEditor({
  captionStyle,
  onChange,
  sources = {},
  sceneImages = {},
  available = [],
  words = [],
}) {
  const style = useMemo(() => normalizeCaptionStyle(captionStyle), [captionStyle]);

  const [bgType, setBgType] = useState('video');

  const candidateNumbers = useMemo(() => {
    const set = new Set([
      ...(Array.isArray(available) ? available : []),
      ...Object.keys(sources).map(Number),
      ...Object.keys(sceneImages).map(Number),
    ]);
    const list = Array.from(set).filter((n) => Number.isInteger(n) && n > 0);
    list.sort((a, b) => a - b);
    return list;
  }, [available, sources, sceneImages]);

  const [selectedNumber, setSelectedNumber] = useState(() => candidateNumbers[0] ?? 1);

  const activeNumber = candidateNumbers.includes(selectedNumber)
    ? selectedNumber
    : candidateNumbers[0] ?? 1;

  const background = bgType === 'video' ? sources[activeNumber] : sceneImages[activeNumber];

  const currentFont = FONTS.find((f) => f.id === style.font) || FONTS[0];

  const fontOptions = useMemo(
    () =>
      FONTS.map((f) => ({
        value: f.id,
        label: <span style={{ fontFamily: f.family, fontSize: '0.95rem' }}>{f.label}</span>,
      })),
    []
  );

  const weightOptions = useMemo(
    () =>
      currentFont.weights.map((w) => ({
        value: w,
        label: WEIGHT_LABELS[w] ?? `${w}`,
      })),
    [currentFont]
  );

  const numberOptions = useMemo(
    () =>
      candidateNumbers.map((n) => ({
        value: n,
        label: bgType === 'video' ? `Clip ${n}` : `Escena ${n}`,
      })),
    [candidateNumbers, bgType]
  );

  const pageEffectOptions = useMemo(
    () =>
      PAGE_EFFECTS.map((e) => ({
        value: e.id,
        label: e.label,
      })),
    []
  );

  const wordEffectOptions = useMemo(
    () =>
      WORD_EFFECTS.map((e) => ({
        value: e.id,
        label: e.label,
      })),
    []
  );

  const shadowTypeOptions = useMemo(
    () =>
      SHADOW_TYPES.map((t) => ({
        value: t.id,
        label: t.label,
      })),
    []
  );

  const showBlur = ['soft', 'outline-glow'].includes(style.shadowType);
  const showDistance = ['soft', 'hard', 'double', 'long'].includes(style.shadowType);
  const showAngle = ['soft', 'hard', 'double', 'long'].includes(style.shadowType);
  const showOpacity = style.shadowType !== 'none';

  const handleUpdate = (patch) => {
    onChange?.({ ...style, ...patch });
  };

  return (
    <details open className="auto-edit__caption-section">
      <summary className="auto-edit__caption-summary">Estilo de subtítulos</summary>

      <div className="auto-edit__caption-layout">
        <div className="auto-edit__caption-controls">
          <div className="auto-edit__caption-chips">
            {PRESETS.map((p) => {
              const isMatch =
                style.font === p.style.font &&
                style.textColor === p.style.textColor &&
                style.highlightColor === p.style.highlightColor &&
                style.pageEffect === p.style.pageEffect &&
                style.wordEffect === p.style.wordEffect &&
                style.shadowType === p.style.shadowType;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`settings__button auto-edit__caption-chip ${
                    isMatch ? 'settings__button--primary' : 'settings__button--ghost'
                  }`}
                  onClick={() => onChange?.(p.style)}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="auto-edit__caption-row">
            <div className="auto-edit__caption-field">
              <label className="auto-edit__label">Fuente</label>
              <CustomSelect
                value={style.font}
                options={fontOptions}
                onChange={(font) => handleUpdate({ font })}
                ariaLabel="Fuente de los subtítulos"
              />
            </div>

            <div className="auto-edit__caption-field">
              <label className="auto-edit__label">Grosor</label>
              <CustomSelect
                value={style.weight}
                options={weightOptions}
                onChange={(weight) => handleUpdate({ weight: Number(weight) })}
                ariaLabel="Grosor de la fuente"
              />
            </div>
          </div>

          <div className="auto-edit__caption-field">
            <div className="auto-edit__caption-field-header">
              <label className="auto-edit__label">Tamaño</label>
              <span className="auto-edit__caption-value">{style.size} px</span>
            </div>
            <input
              type="range"
              min={40}
              max={160}
              step={1}
              value={style.size}
              className="auto-edit__caption-range"
              onChange={(e) => handleUpdate({ size: Number(e.target.value) })}
            />
          </div>

          <div className="auto-edit__caption-checkboxes">
            <CustomCheckbox
              checked={style.uppercase}
              label="Mayúsculas"
              onChange={(checked) => handleUpdate({ uppercase: checked })}
            />
          </div>

          <div className="auto-edit__caption-colors">
            <div className="auto-edit__caption-color-item">
              <label className="auto-edit__label">Color del texto</label>
              <div className="auto-edit__color-picker-wrap">
                <input
                  type="color"
                  value={style.textColor}
                  className="auto-edit__color-input"
                  onChange={(e) => handleUpdate({ textColor: e.target.value })}
                />
                <span className="auto-edit__color-hex">{style.textColor}</span>
              </div>
            </div>

            <div className="auto-edit__caption-color-item">
              <label className="auto-edit__label">Color de resaltado</label>
              <div className="auto-edit__color-picker-wrap">
                <input
                  type="color"
                  value={style.highlightColor}
                  className="auto-edit__color-input"
                  onChange={(e) => handleUpdate({ highlightColor: e.target.value })}
                />
                <span className="auto-edit__color-hex">{style.highlightColor}</span>
              </div>
            </div>

            <div className="auto-edit__caption-color-item">
              <label className="auto-edit__label">Segundo color de resaltado</label>
              <div className="auto-edit__color-picker-wrap">
                <input
                  type="color"
                  value={style.altHighlightColor}
                  className="auto-edit__color-input"
                  onChange={(e) => handleUpdate({ altHighlightColor: e.target.value })}
                />
                <span className="auto-edit__color-hex">{style.altHighlightColor}</span>
              </div>
            </div>

            <div className="auto-edit__caption-color-item">
              <label className="auto-edit__label">Color del borde</label>
              <div className="auto-edit__color-picker-wrap">
                <input
                  type="color"
                  value={style.strokeColor}
                  className="auto-edit__color-input"
                  onChange={(e) => handleUpdate({ strokeColor: e.target.value })}
                />
                <span className="auto-edit__color-hex">{style.strokeColor}</span>
              </div>
            </div>
          </div>

          <div className="auto-edit__caption-field">
            <div className="auto-edit__caption-field-header">
              <label className="auto-edit__label">Grosor del borde</label>
              <span className="auto-edit__caption-value">{style.strokeWidth} px</span>
            </div>
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={style.strokeWidth}
              className="auto-edit__caption-range"
              onChange={(e) => handleUpdate({ strokeWidth: Number(e.target.value) })}
            />
          </div>

          <div className="auto-edit__caption-field">
            <label className="auto-edit__label">Sombra</label>
            <CustomSelect
              value={style.shadowType}
              options={shadowTypeOptions}
              onChange={(shadowType) => handleUpdate({ shadowType })}
              ariaLabel="Tipo de sombra"
            />
          </div>

          {style.shadowType !== 'none' && (
            <div className="auto-edit__caption-color-item">
              <label className="auto-edit__label">
                {style.shadowType === 'box' ? 'Color de fondo' : 'Color de sombra'}
              </label>
              <div className="auto-edit__color-picker-wrap">
                <input
                  type="color"
                  value={style.shadowColor}
                  className="auto-edit__color-input"
                  onChange={(e) => handleUpdate({ shadowColor: e.target.value })}
                />
                <span className="auto-edit__color-hex">{style.shadowColor}</span>
              </div>
            </div>
          )}

          {showBlur && (
            <div className="auto-edit__caption-field">
              <div className="auto-edit__caption-field-header">
                <label className="auto-edit__label">Desenfoque</label>
                <span className="auto-edit__caption-value">{style.shadowBlur} px</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={style.shadowBlur}
                className="auto-edit__caption-range"
                onChange={(e) => handleUpdate({ shadowBlur: Number(e.target.value) })}
              />
            </div>
          )}

          {showDistance && (
            <div className="auto-edit__caption-field">
              <div className="auto-edit__caption-field-header">
                <label className="auto-edit__label">Distancia</label>
                <span className="auto-edit__caption-value">{style.shadowDistance} px</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={style.shadowDistance}
                className="auto-edit__caption-range"
                onChange={(e) => handleUpdate({ shadowDistance: Number(e.target.value) })}
              />
            </div>
          )}

          {showAngle && (
            <div className="auto-edit__caption-field">
              <div className="auto-edit__caption-field-header">
                <label className="auto-edit__label">Ángulo</label>
                <span className="auto-edit__caption-value">{style.shadowAngle}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={style.shadowAngle}
                className="auto-edit__caption-range"
                onChange={(e) => handleUpdate({ shadowAngle: Number(e.target.value) })}
              />
            </div>
          )}

          {showOpacity && (
            <div className="auto-edit__caption-field">
              <div className="auto-edit__caption-field-header">
                <label className="auto-edit__label">Opacidad</label>
                <span className="auto-edit__caption-value">{Math.round(style.shadowOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={style.shadowOpacity}
                className="auto-edit__caption-range"
                onChange={(e) => handleUpdate({ shadowOpacity: Number(e.target.value) })}
              />
            </div>
          )}

          <div className="auto-edit__caption-field">
            <div className="auto-edit__caption-field-header">
              <label className="auto-edit__label">Palabras por bloque</label>
              <span className="auto-edit__caption-value">{style.wordsPerPage}</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={style.wordsPerPage}
              className="auto-edit__caption-range"
              onChange={(e) => handleUpdate({ wordsPerPage: Number(e.target.value) })}
            />
          </div>

          <div className="auto-edit__caption-field">
            <label className="auto-edit__label">Posición</label>
            <div className="auto-edit__segmented">
              <button
                type="button"
                className={`settings__button auto-edit__segmented-btn ${
                  style.position === 'bottom' ? 'settings__button--primary' : 'settings__button--ghost'
                }`}
                onClick={() => handleUpdate({ position: 'bottom' })}
              >
                Abajo
              </button>
              <button
                type="button"
                className={`settings__button auto-edit__segmented-btn ${
                  style.position === 'middle' ? 'settings__button--primary' : 'settings__button--ghost'
                }`}
                onClick={() => handleUpdate({ position: 'middle' })}
              >
                Centro
              </button>
              <button
                type="button"
                className={`settings__button auto-edit__segmented-btn ${
                  style.position === 'top' ? 'settings__button--primary' : 'settings__button--ghost'
                }`}
                onClick={() => handleUpdate({ position: 'top' })}
              >
                Arriba
              </button>
            </div>
          </div>

          <div className="auto-edit__caption-row">
            <div className="auto-edit__caption-field">
              <label className="auto-edit__label">Entrada del bloque</label>
              <CustomSelect
                value={style.pageEffect}
                options={pageEffectOptions}
                onChange={(pageEffect) => handleUpdate({ pageEffect })}
                ariaLabel="Entrada del bloque"
              />
            </div>

            <div className="auto-edit__caption-field">
              <label className="auto-edit__label">Efecto de la palabra</label>
              <CustomSelect
                value={style.wordEffect}
                options={wordEffectOptions}
                onChange={(wordEffect) => handleUpdate({ wordEffect })}
                ariaLabel="Efecto de la palabra"
              />
            </div>
          </div>

          <div className="auto-edit__caption-footer">
            <button
              type="button"
              className="settings__button settings__button--ghost"
              onClick={() => onChange?.(DEFAULT_CAPTION_STYLE)}
            >
              Restablecer estilo
            </button>
          </div>
        </div>

        <div className="auto-edit__caption-preview-col">
          <div className="auto-edit__caption-bg-controls">
            <div className="auto-edit__caption-bg-toggle">
              <span className="auto-edit__label">Fondo:</span>
              <div className="auto-edit__segmented">
                <button
                  type="button"
                  className={`settings__button auto-edit__segmented-btn ${
                    bgType === 'video' ? 'settings__button--primary' : 'settings__button--ghost'
                  }`}
                  onClick={() => setBgType('video')}
                >
                  Clip
                </button>
                <button
                  type="button"
                  className={`settings__button auto-edit__segmented-btn ${
                    bgType === 'image' ? 'settings__button--primary' : 'settings__button--ghost'
                  }`}
                  onClick={() => setBgType('image')}
                >
                  Imagen
                </button>
              </div>
            </div>

            {numberOptions.length > 0 && (
              <div className="auto-edit__caption-bg-select">
                <CustomSelect
                  value={activeNumber}
                  options={numberOptions}
                  onChange={(val) => setSelectedNumber(Number(val))}
                  ariaLabel="Seleccionar número de fondo"
                />
              </div>
            )}
          </div>

          <CaptionPreview
            background={background}
            backgroundType={bgType}
            style={style}
            words={words}
          />
        </div>
      </div>
    </details>
  );
}
