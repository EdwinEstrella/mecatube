// Pure: caption style definition, fonts, presets, CSS mapping, and normalization. No DOM, no React.

export const FONTS = [
  { id: 'montserrat', label: 'Montserrat', family: 'Montserrat', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: 'poppins', label: 'Poppins', family: 'Poppins', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: 'roboto', label: 'Roboto', family: 'Roboto', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: 'oswald', label: 'Oswald', family: 'Oswald', weights: [200, 300, 400, 500, 600, 700] },
  { id: 'anton', label: 'Anton', family: 'Anton', weights: [400] },
  { id: 'bebas-neue', label: 'Bebas Neue', family: 'Bebas Neue', weights: [400] },
  { id: 'bangers', label: 'Bangers', family: 'Bangers', weights: [400] },
  { id: 'luckiest-guy', label: 'Luckiest Guy', family: 'Luckiest Guy', weights: [400] },
];

export const PAGE_EFFECTS = [
  { id: 'none', label: 'Sin efecto' },
  { id: 'pop', label: 'Rebote' },
  { id: 'fade', label: 'Aparecer' },
  { id: 'slide-up', label: 'Deslizar hacia arriba' },
  { id: 'zoom', label: 'Zoom desde lejos' },
  { id: 'blur', label: 'Desenfoque' },
  { id: 'typewriter', label: 'Máquina de escribir' },
];

export const WORD_EFFECTS = [
  { id: 'none', label: 'Solo color' },
  { id: 'pop', label: 'Salto' },
  { id: 'bounce', label: 'Brinco' },
  { id: 'shake', label: 'Vibración' },
  { id: 'glow', label: 'Brillo' },
  { id: 'underline', label: 'Subrayado' },
  { id: 'box', label: 'Caja' },
];

export const SHADOW_TYPES = [
  { id: 'none', label: 'Sin sombra' },
  { id: 'soft', label: 'Suave' },
  { id: 'hard', label: 'Dura' },
  { id: 'long', label: 'Larga' },
  { id: 'outline-glow', label: 'Resplandor' },
  { id: 'double', label: 'Doble' },
  { id: 'box', label: 'Fondo' },
];

export const DEFAULT_CAPTION_STYLE = {
  font: 'montserrat',
  weight: 900,
  size: 86,
  uppercase: true,
  textColor: '#FFFFFF',
  highlightColor: '#FFE600',
  altHighlightColor: '#2BFF88',
  strokeColor: '#000000',
  strokeWidth: 12,
  shadowType: 'soft',
  shadowColor: '#000000',
  shadowBlur: 18,
  shadowDistance: 6,
  shadowAngle: 90,
  shadowOpacity: 0.55,
  wordsPerPage: 4,
  position: 'bottom',
  pageEffect: 'pop',
  wordEffect: 'pop',
};

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function snapWeight(weights, targetWeight) {
  if (!Array.isArray(weights) || weights.length === 0) return 400;
  const num = typeof targetWeight === 'number' && Number.isFinite(targetWeight) ? targetWeight : 400;
  return weights.reduce((prev, curr) =>
    Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
  );
}

function validColor(val, fallback) {
  return typeof val === 'string' && HEX_COLOR_REGEX.test(val) ? val : fallback;
}

export function hexToRgba(hex, opacity) {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return `rgba(0, 0, 0, ${opacity})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function normalizeCaptionStyle(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const fontObj = FONTS.find((f) => f.id === input.font) || FONTS.find((f) => f.id === DEFAULT_CAPTION_STYLE.font);
  const font = fontObj.id;

  const weight = snapWeight(
    fontObj.weights,
    typeof input.weight === 'number' && Number.isFinite(input.weight)
      ? input.weight
      : DEFAULT_CAPTION_STYLE.weight
  );

  const rawSize = typeof input.size === 'number' && Number.isFinite(input.size)
    ? Math.round(input.size)
    : DEFAULT_CAPTION_STYLE.size;
  const size = Math.max(40, Math.min(160, rawSize));

  const uppercase = typeof input.uppercase === 'boolean'
    ? input.uppercase
    : DEFAULT_CAPTION_STYLE.uppercase;

  const textColor = validColor(input.textColor, DEFAULT_CAPTION_STYLE.textColor);
  const highlightColor = validColor(input.highlightColor, DEFAULT_CAPTION_STYLE.highlightColor);
  const altHighlightColor = validColor(input.altHighlightColor, DEFAULT_CAPTION_STYLE.altHighlightColor);
  const strokeColor = validColor(input.strokeColor, DEFAULT_CAPTION_STYLE.strokeColor);

  const rawStroke = typeof input.strokeWidth === 'number' && Number.isFinite(input.strokeWidth)
    ? Math.round(input.strokeWidth)
    : DEFAULT_CAPTION_STYLE.strokeWidth;
  const strokeWidth = Math.max(0, Math.min(24, rawStroke));

  let shadowType;
  if (SHADOW_TYPES.some((t) => t.id === input.shadowType)) {
    shadowType = input.shadowType;
  } else if (typeof input.shadow === 'boolean') {
    shadowType = input.shadow ? 'soft' : 'none';
  } else {
    shadowType = DEFAULT_CAPTION_STYLE.shadowType;
  }

  const shadowColor = validColor(input.shadowColor, DEFAULT_CAPTION_STYLE.shadowColor);

  const rawBlur = typeof input.shadowBlur === 'number' && Number.isFinite(input.shadowBlur)
    ? Math.round(input.shadowBlur)
    : DEFAULT_CAPTION_STYLE.shadowBlur;
  const shadowBlur = Math.max(0, Math.min(40, rawBlur));

  const rawDistance = typeof input.shadowDistance === 'number' && Number.isFinite(input.shadowDistance)
    ? Math.round(input.shadowDistance)
    : DEFAULT_CAPTION_STYLE.shadowDistance;
  const shadowDistance = Math.max(0, Math.min(30, rawDistance));

  const rawAngle = typeof input.shadowAngle === 'number' && Number.isFinite(input.shadowAngle)
    ? Math.round(input.shadowAngle)
    : DEFAULT_CAPTION_STYLE.shadowAngle;
  const shadowAngle = Math.max(0, Math.min(359, rawAngle));

  const rawOpacity = typeof input.shadowOpacity === 'number' && Number.isFinite(input.shadowOpacity)
    ? Math.round(input.shadowOpacity * 100) / 100
    : DEFAULT_CAPTION_STYLE.shadowOpacity;
  const shadowOpacity = Math.max(0, Math.min(1, rawOpacity));

  const rawWords = typeof input.wordsPerPage === 'number' && Number.isFinite(input.wordsPerPage)
    ? Math.round(input.wordsPerPage)
    : DEFAULT_CAPTION_STYLE.wordsPerPage;
  const wordsPerPage = Math.max(1, Math.min(8, rawWords));

  const position = ['bottom', 'middle', 'top'].includes(input.position)
    ? input.position
    : DEFAULT_CAPTION_STYLE.position;

  let defaultPageEffect = DEFAULT_CAPTION_STYLE.pageEffect;
  let defaultWordEffect = DEFAULT_CAPTION_STYLE.wordEffect;

  if (input.animation === 'none') {
    defaultPageEffect = 'none';
    defaultWordEffect = 'none';
  } else if (input.animation === 'pop') {
    defaultPageEffect = 'pop';
    defaultWordEffect = 'pop';
  }

  const pageEffect = PAGE_EFFECTS.some((e) => e.id === input.pageEffect)
    ? input.pageEffect
    : defaultPageEffect;

  const wordEffect = WORD_EFFECTS.some((e) => e.id === input.wordEffect)
    ? input.wordEffect
    : defaultWordEffect;

  return {
    font,
    weight,
    size,
    uppercase,
    textColor,
    highlightColor,
    altHighlightColor,
    strokeColor,
    strokeWidth,
    shadowType,
    shadowColor,
    shadowBlur,
    shadowDistance,
    shadowAngle,
    shadowOpacity,
    wordsPerPage,
    position,
    pageEffect,
    wordEffect,
  };
}

export function buildTextShadow(style) {
  const s = normalizeCaptionStyle(style);
  const { shadowType, shadowColor, shadowBlur, shadowDistance, shadowAngle, shadowOpacity } = s;

  if (shadowType === 'none' || shadowType === 'box') {
    return 'none';
  }

  const rad = (shadowAngle * Math.PI) / 180;
  const dx = Math.round(Math.cos(rad) * shadowDistance) || 0;
  const dy = Math.round(Math.sin(rad) * shadowDistance) || 0;
  const rgba = hexToRgba(shadowColor, shadowOpacity);

  if (shadowType === 'soft') {
    return `${dx}px ${dy}px ${shadowBlur}px ${rgba}`;
  }

  if (shadowType === 'hard') {
    return `${dx}px ${dy}px 0 ${rgba}`;
  }

  if (shadowType === 'long') {
    if (shadowDistance <= 0) return 'none';
    const steps = [];
    for (let i = 1; i <= shadowDistance; i++) {
      const sx = Math.round(Math.cos(rad) * i) || 0;
      const sy = Math.round(Math.sin(rad) * i) || 0;
      steps.push(`${sx}px ${sy}px 0 ${rgba}`);
    }
    return steps.join(', ');
  }

  if (shadowType === 'outline-glow') {
    if (shadowBlur <= 0) return 'none';
    const blurs = [
      Math.max(1, Math.round(shadowBlur * 0.25)),
      Math.max(2, Math.round(shadowBlur * 0.5)),
      Math.max(3, Math.round(shadowBlur * 0.75)),
      shadowBlur,
    ];
    const unique = Array.from(new Set(blurs));
    return unique.map((b) => `0px 0px ${b}px ${rgba}`).join(', ');
  }

  if (shadowType === 'double') {
    const dx2 = Math.round(Math.cos(rad) * (shadowDistance * 2)) || 0;
    const dy2 = Math.round(Math.sin(rad) * (shadowDistance * 2)) || 0;
    const rgba2 = hexToRgba(shadowColor, Math.round(shadowOpacity * 50) / 100);
    return `${dx}px ${dy}px 0 ${rgba}, ${dx2}px ${dy2}px 0 ${rgba2}`;
  }

  return 'none';
}

export function captionCss(style) {
  const s = normalizeCaptionStyle(style);
  const fontObj = FONTS.find((f) => f.id === s.font) || FONTS[0];

  const css = {
    fontFamily: fontObj.family,
    fontWeight: s.weight,
    fontSize: s.size,
    textTransform: s.uppercase ? 'uppercase' : 'none',
    WebkitTextStroke: s.strokeWidth > 0 ? `${s.strokeWidth}px ${s.strokeColor}` : 'none',
    paintOrder: 'stroke fill',
    textShadow: buildTextShadow(s),
    letterSpacing: 1,
    lineHeight: 1.15,
  };

  if (s.shadowType === 'box') {
    css.backgroundColor = hexToRgba(s.shadowColor, s.shadowOpacity);
    css.borderRadius = 16;
    css.padding = '12px 24px';
    css.boxSizing = 'border-box';
    css.width = 'fit-content';
  }

  return css;
}

export const PRESETS = [
  {
    id: 'clasico',
    label: 'Clásico amarillo',
    style: {
      font: 'montserrat',
      weight: 900,
      size: 86,
      uppercase: true,
      textColor: '#FFFFFF',
      highlightColor: '#FFE600',
      altHighlightColor: '#2BFF88',
      strokeColor: '#000000',
      strokeWidth: 12,
      shadowType: 'soft',
      shadowColor: '#000000',
      shadowBlur: 18,
      shadowDistance: 6,
      shadowAngle: 90,
      shadowOpacity: 0.55,
      wordsPerPage: 4,
      position: 'bottom',
      pageEffect: 'pop',
      wordEffect: 'pop',
    },
  },
  {
    id: 'impacto',
    label: 'Impacto (Anton)',
    style: {
      font: 'anton',
      weight: 400,
      size: 92,
      uppercase: true,
      textColor: '#FFFFFF',
      highlightColor: '#FF3366',
      altHighlightColor: '#FFD700',
      strokeColor: '#000000',
      strokeWidth: 10,
      shadowType: 'hard',
      shadowColor: '#000000',
      shadowBlur: 0,
      shadowDistance: 8,
      shadowAngle: 90,
      shadowOpacity: 0.8,
      wordsPerPage: 3,
      position: 'middle',
      pageEffect: 'zoom',
      wordEffect: 'shake',
    },
  },
  {
    id: 'comic',
    label: 'Cómic (Bangers)',
    style: {
      font: 'bangers',
      weight: 400,
      size: 90,
      uppercase: true,
      textColor: '#FFFFFF',
      highlightColor: '#FFE600',
      altHighlightColor: '#00F0FF',
      strokeColor: '#000000',
      strokeWidth: 14,
      shadowType: 'double',
      shadowColor: '#000000',
      shadowBlur: 0,
      shadowDistance: 6,
      shadowAngle: 120,
      shadowOpacity: 0.75,
      wordsPerPage: 4,
      position: 'bottom',
      pageEffect: 'pop',
      wordEffect: 'bounce',
    },
  },
  {
    id: 'minimalista',
    label: 'Minimalista',
    style: {
      font: 'roboto',
      weight: 500,
      size: 68,
      uppercase: false,
      textColor: '#FFFFFF',
      highlightColor: '#60A5FA',
      altHighlightColor: '#A78BFA',
      strokeColor: '#000000',
      strokeWidth: 4,
      shadowType: 'none',
      shadowColor: '#000000',
      shadowBlur: 18,
      shadowDistance: 6,
      shadowAngle: 90,
      shadowOpacity: 0.55,
      wordsPerPage: 5,
      position: 'bottom',
      pageEffect: 'fade',
      wordEffect: 'underline',
    },
  },
  {
    id: 'neon',
    label: 'Neón',
    style: {
      font: 'poppins',
      weight: 800,
      size: 82,
      uppercase: true,
      textColor: '#FFFFFF',
      highlightColor: '#00FFFF',
      altHighlightColor: '#FF00FF',
      strokeColor: '#0A0A1A',
      strokeWidth: 8,
      shadowType: 'outline-glow',
      shadowColor: '#00FFFF',
      shadowBlur: 20,
      shadowDistance: 6,
      shadowAngle: 90,
      shadowOpacity: 0.85,
      wordsPerPage: 4,
      position: 'bottom',
      pageEffect: 'blur',
      wordEffect: 'glow',
    },
  },
  {
    id: 'caja-tiktok',
    label: 'Caja TikTok',
    style: {
      font: 'montserrat',
      weight: 900,
      size: 84,
      uppercase: true,
      textColor: '#FFFFFF',
      highlightColor: '#FFE600',
      altHighlightColor: '#00F0FF',
      strokeColor: '#000000',
      strokeWidth: 10,
      shadowType: 'box',
      shadowColor: '#000000',
      shadowBlur: 18,
      shadowDistance: 6,
      shadowAngle: 90,
      shadowOpacity: 0.65,
      wordsPerPage: 4,
      position: 'bottom',
      pageEffect: 'slide-up',
      wordEffect: 'box',
    },
  },
  {
    id: 'sombra-larga',
    label: 'Sombra larga',
    style: {
      font: 'bebas-neue',
      weight: 400,
      size: 92,
      uppercase: true,
      textColor: '#FFFFFF',
      highlightColor: '#FFE600',
      altHighlightColor: '#FF3366',
      strokeColor: '#000000',
      strokeWidth: 8,
      shadowType: 'long',
      shadowColor: '#000000',
      shadowBlur: 0,
      shadowDistance: 12,
      shadowAngle: 45,
      shadowOpacity: 0.7,
      wordsPerPage: 4,
      position: 'bottom',
      pageEffect: 'pop',
      wordEffect: 'pop',
    },
  },
  {
    id: 'maquina-de-escribir',
    label: 'Máquina de escribir',
    style: {
      font: 'roboto',
      weight: 700,
      size: 74,
      uppercase: false,
      textColor: '#FFFFFF',
      highlightColor: '#FFE600',
      altHighlightColor: '#2BFF88',
      strokeColor: '#000000',
      strokeWidth: 6,
      shadowType: 'soft',
      shadowColor: '#000000',
      shadowBlur: 14,
      shadowDistance: 4,
      shadowAngle: 90,
      shadowOpacity: 0.5,
      wordsPerPage: 4,
      position: 'bottom',
      pageEffect: 'typewriter',
      wordEffect: 'none',
    },
  },
];
