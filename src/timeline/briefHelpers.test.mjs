import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeriesChapterBrief, buildTitleBrief } from './briefHelpers.js';

test('buildSeriesChapterBrief constructs full context with series, chapter, adjacent chapters, and duration', () => {
  const series = {
    idea: 'Imperios olvidados',
    beginning: 'Surgimiento',
    middle: 'Apogeo y guerras',
    end: 'Colapso final',
    minutes: 12,
    chapters: 3,
  };

  const outline = [
    { number: 1, title: 'El Origen', summary: 'Las primeras tribus se unen.' },
    { number: 2, title: 'La Guerra de los Cien Días', summary: 'El choque entre reyes.' },
    { number: 3, title: 'Cenizas', summary: 'El imperio cae en ruinas.' },
  ];

  // Test chapter 2 (has both prev and next)
  const brief2 = buildSeriesChapterBrief({ series, chapter: outline[1], outline });
  assert.ok(brief2.includes('Idea general: Imperios olvidados'));
  assert.ok(brief2.includes('Inicio de la serie: Surgimiento'));
  assert.ok(brief2.includes('Nudo / enlace: Apogeo y guerras'));
  assert.ok(brief2.includes('Desenlace de la serie: Colapso final'));
  assert.ok(brief2.includes('CAPÍTULO ACTUAL (2 de 3):'));
  assert.ok(brief2.includes('Título: La Guerra de los Cien Días'));
  assert.ok(brief2.includes('Resumen del capítulo: El choque entre reyes.'));
  assert.ok(brief2.includes('Duración objetivo: 12 minutos'));
  assert.ok(brief2.includes('Capítulo anterior: Cap. 1 — El Origen'));
  assert.ok(brief2.includes('Capítulo siguiente: Cap. 3 — Cenizas'));

  // Test chapter 1 (no prev)
  const brief1 = buildSeriesChapterBrief({ series, chapter: outline[0], outline });
  assert.ok(brief1.includes('Capítulo anterior: Ninguno'));
  assert.ok(brief1.includes('Capítulo siguiente: Cap. 2 — La Guerra de los Cien Días'));

  // Test chapter 3 (no next)
  const brief3 = buildSeriesChapterBrief({ series, chapter: outline[2], outline });
  assert.ok(brief3.includes('Capítulo anterior: Cap. 2 — La Guerra de los Cien Días'));
  assert.ok(brief3.includes('Capítulo siguiente: Ninguno'));
});

test('buildTitleBrief formats "Título del video: <texto>" and includes branch type context', () => {
  const brief = buildTitleBrief('Los 10 secretos del Triángulo de las Bermudas', {
    videoType: 'mystery',
    orientation: 'vertical',
  });

  assert.ok(brief.includes('Título del video: Los 10 secretos del Triángulo de las Bermudas'));
  assert.ok(brief.includes('Tipo de video: mystery'));
  assert.ok(brief.includes('Orientación / Formato: vertical'));
});

test('buildTitleBrief handles missing branch context gracefully', () => {
  const brief = buildTitleBrief('Un video sencillo');
  assert.equal(brief, 'Título del video: Un video sencillo');
});
