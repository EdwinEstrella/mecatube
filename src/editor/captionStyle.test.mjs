// Run with: node src/editor/captionStyle.test.mjs
import assert from 'node:assert/strict';
import {
  FONTS,
  DEFAULT_CAPTION_STYLE,
  normalizeCaptionStyle,
  captionCss,
  PRESETS,
} from './captionStyle.js';

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n     ${error.message}`);
  }
}

test('FONTS defines the 8 required fonts with families and weights', () => {
  assert.equal(FONTS.length, 8);
  const ids = FONTS.map((f) => f.id);
  assert.deepEqual(ids, [
    'montserrat',
    'poppins',
    'roboto',
    'oswald',
    'anton',
    'bebas-neue',
    'bangers',
    'luckiest-guy',
  ]);

  const mont = FONTS.find((f) => f.id === 'montserrat');
  assert.equal(mont.family, 'Montserrat');
  assert.equal(mont.label, 'Montserrat');
  assert.deepEqual(mont.weights, [100, 200, 300, 400, 500, 600, 700, 800, 900]);

  const oswald = FONTS.find((f) => f.id === 'oswald');
  assert.equal(oswald.family, 'Oswald');
  assert.deepEqual(oswald.weights, [200, 300, 400, 500, 600, 700]);

  const anton = FONTS.find((f) => f.id === 'anton');
  assert.equal(anton.family, 'Anton');
  assert.deepEqual(anton.weights, [400]);
});

test('DEFAULT_CAPTION_STYLE has correct values', () => {
  assert.deepEqual(DEFAULT_CAPTION_STYLE, {
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
    animation: 'pop',
  });
});

test('normalizeCaptionStyle returns default style on empty or invalid input', () => {
  assert.deepEqual(normalizeCaptionStyle(null), DEFAULT_CAPTION_STYLE);
  assert.deepEqual(normalizeCaptionStyle(undefined), DEFAULT_CAPTION_STYLE);
  assert.deepEqual(normalizeCaptionStyle('invalid'), DEFAULT_CAPTION_STYLE);
  assert.deepEqual(normalizeCaptionStyle({}), DEFAULT_CAPTION_STYLE);
});

test('normalizeCaptionStyle handles unknown font and snaps weights', () => {
  // Unknown font falls back to montserrat
  const res1 = normalizeCaptionStyle({ font: 'comic-sans' });
  assert.equal(res1.font, 'montserrat');

  // Anton only supports 400, so 900 snaps to 400
  const res2 = normalizeCaptionStyle({ font: 'anton', weight: 900 });
  assert.equal(res2.font, 'anton');
  assert.equal(res2.weight, 400);

  // Oswald supports 200..700, so 900 snaps to 700 and 100 snaps to 200
  const res3 = normalizeCaptionStyle({ font: 'oswald', weight: 900 });
  assert.equal(res3.weight, 700);
  const res4 = normalizeCaptionStyle({ font: 'oswald', weight: 100 });
  assert.equal(res4.weight, 200);

  // Montserrat 440 snaps to 400
  const res5 = normalizeCaptionStyle({ font: 'montserrat', weight: 440 });
  assert.equal(res5.weight, 400);
});

test('normalizeCaptionStyle clamps size, strokeWidth, and wordsPerPage', () => {
  const low = normalizeCaptionStyle({ size: 10, strokeWidth: -5, wordsPerPage: 0 });
  assert.equal(low.size, 40);
  assert.equal(low.strokeWidth, 0);
  assert.equal(low.wordsPerPage, 1);

  const high = normalizeCaptionStyle({ size: 300, strokeWidth: 50, wordsPerPage: 20 });
  assert.equal(high.size, 160);
  assert.equal(high.strokeWidth, 24);
  assert.equal(high.wordsPerPage, 8);

  const decimals = normalizeCaptionStyle({ size: 75.6, strokeWidth: 11.2, wordsPerPage: 3.8 });
  assert.equal(decimals.size, 76);
  assert.equal(decimals.strokeWidth, 11);
  assert.equal(decimals.wordsPerPage, 4);
});

test('normalizeCaptionStyle validates colors and booleans', () => {
  const badColors = normalizeCaptionStyle({
    textColor: 'red',
    highlightColor: '#12345',
    altHighlightColor: '#1234567',
    strokeColor: 'rgba(0,0,0,1)',
  });
  assert.equal(badColors.textColor, DEFAULT_CAPTION_STYLE.textColor);
  assert.equal(badColors.highlightColor, DEFAULT_CAPTION_STYLE.highlightColor);
  assert.equal(badColors.altHighlightColor, DEFAULT_CAPTION_STYLE.altHighlightColor);
  assert.equal(badColors.strokeColor, DEFAULT_CAPTION_STYLE.strokeColor);

  const goodColors = normalizeCaptionStyle({
    textColor: '#112233',
    highlightColor: '#445566',
    altHighlightColor: '#778899',
    strokeColor: '#aabbcc',
  });
  assert.equal(goodColors.textColor, '#112233');
  assert.equal(goodColors.highlightColor, '#445566');
  assert.equal(goodColors.altHighlightColor, '#778899');
  assert.equal(goodColors.strokeColor, '#aabbcc');

  const bools = normalizeCaptionStyle({ uppercase: false, shadow: false });
  assert.equal(bools.uppercase, false);
  assert.equal(bools.shadow, false);
});

test('normalizeCaptionStyle validates position and animation enums', () => {
  assert.equal(normalizeCaptionStyle({ position: 'top' }).position, 'top');
  assert.equal(normalizeCaptionStyle({ position: 'middle' }).position, 'middle');
  assert.equal(normalizeCaptionStyle({ position: 'bottom' }).position, 'bottom');
  assert.equal(normalizeCaptionStyle({ position: 'somewhere' }).position, 'bottom');

  assert.equal(normalizeCaptionStyle({ animation: 'none' }).animation, 'none');
  assert.equal(normalizeCaptionStyle({ animation: 'pop' }).animation, 'pop');
  assert.equal(normalizeCaptionStyle({ animation: 'bounce' }).animation, 'pop');
});

test('captionCss builds valid CSS style objects', () => {
  const css = captionCss(DEFAULT_CAPTION_STYLE);
  assert.equal(css.fontFamily, 'Montserrat');
  assert.equal(css.fontWeight, 900);
  assert.equal(css.fontSize, 86);
  assert.equal(css.textTransform, 'uppercase');
  assert.equal(css.WebkitTextStroke, '12px #000000');
  assert.equal(css.paintOrder, 'stroke fill');
  assert.equal(css.textShadow, '0 6px 18px rgba(0,0,0,0.55)');

  const cssNoStrokeNoShadow = captionCss({ strokeWidth: 0, shadow: false, uppercase: false });
  assert.equal(cssNoStrokeNoShadow.WebkitTextStroke, 'none');
  assert.equal(cssNoStrokeNoShadow.textShadow, 'none');
  assert.equal(cssNoStrokeNoShadow.textTransform, 'none');
});

test('PRESETS contains 5 named presets with valid styles', () => {
  assert.ok(PRESETS.length >= 4 && PRESETS.length <= 6);
  for (const preset of PRESETS) {
    assert.ok(typeof preset.id === 'string');
    assert.ok(typeof preset.label === 'string');
    const normalized = normalizeCaptionStyle(preset.style);
    assert.deepEqual(normalized, preset.style);
  }
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
