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
  shadow: true,
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

  const shadow = typeof input.shadow === 'boolean'
    ? input.shadow
    : DEFAULT_CAPTION_STYLE.shadow;

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
    shadow,
    wordsPerPage,
    position,
    pageEffect,
    wordEffect,
  };
}

export function captionCss(style) {
  const s = normalizeCaptionStyle(style);
  const fontObj = FONTS.find((f) => f.id === s.font) || FONTS[0];

  return {
    fontFamily: fontObj.family,
    fontWeight: s.weight,
    fontSize: s.size,
    textTransform: s.uppercase ? 'uppercase' : 'none',
    WebkitTextStroke: s.strokeWidth > 0 ? `${s.strokeWidth}px ${s.strokeColor}` : 'none',
    paintOrder: 'stroke fill',
    textShadow: s.shadow ? '0 6px 18px rgba(0,0,0,0.55)' : 'none',
    letterSpacing: 1,
    lineHeight: 1.15,
  };
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
      shadow: true,
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
      shadow: true,
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
      shadow: true,
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
      shadow: false,
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
      shadow: true,
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
      shadow: true,
      wordsPerPage: 4,
      position: 'bottom',
      pageEffect: 'slide-up',
      wordEffect: 'box',
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
      shadow: true,
      wordsPerPage: 4,
      position: 'bottom',
      pageEffect: 'typewriter',
      wordEffect: 'none',
    },
  },
];
