import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeriesOutlinePrompt, parseSeriesOutline } from './seriesOutline.js';

test('buildSeriesOutlinePrompt includes all fields, counts, and minutes', () => {
  const prompt = buildSeriesOutlinePrompt({
    idea: 'La caída de Constantinopla',
    beginning: 'El asedio comienza con barcos terrestres',
    middle: 'Las murallas teodosianas resisten los bombardeos',
    end: 'La brecha final y la caída',
    chapters: 4,
    minutes: 8.5,
  });

  assert.ok(prompt.includes('Idea general: La caída de Constantinopla'));
  assert.ok(prompt.includes('Inicio: El asedio comienza'));
  assert.ok(prompt.includes('Nudo / enlace: Las murallas teodosianas'));
  assert.ok(prompt.includes('Desenlace: La brecha final'));
  assert.ok(prompt.includes('Número de capítulos: exactamente 4'));
  assert.ok(prompt.includes('8.5 minutos'));
  assert.ok(prompt.includes('Capítulo 1: <Título del capítulo>'));
});

test('buildSeriesOutlinePrompt clamps chapters between 1 and 50 and minutes between 0.5 and 60', () => {
  const p1 = buildSeriesOutlinePrompt({ chapters: 0, minutes: 0.1 });
  assert.ok(p1.includes('Número de capítulos: exactamente 1'));
  assert.ok(p1.includes('0.5 minutos'));

  const p2 = buildSeriesOutlinePrompt({ chapters: 99, minutes: 120 });
  assert.ok(p2.includes('Número de capítulos: exactamente 50'));
  assert.ok(p2.includes('60 minutos'));
});

test('parseSeriesOutline: standard format with colons and summaries', () => {
  const reply = `
Capítulo 1: La Muralla Inquebrantable
Resumen: Los otomanos rodean la ciudad con sus cañones gigantescos. La población bizantina se prepara para resistir.

Capítulo 2: Barcos por la Montaña
Resumen: Una maniobra inesperada lleva las naves enemigas a través de tierra firme hacia el Cuerno de Oro.

Capítulo 3: El Último Emperador
Resumen: Constantino XI lidera la defensa final ante el asalto masivo en las puertas de la ciudad.
`;

  const outline = parseSeriesOutline(reply);
  assert.equal(outline.length, 3);

  assert.equal(outline[0].number, 1);
  assert.equal(outline[0].title, 'La Muralla Inquebrantable');
  assert.equal(
    outline[0].summary,
    'Los otomanos rodean la ciudad con sus cañones gigantescos. La población bizantina se prepara para resistir.'
  );
  assert.equal(outline[0].videoId, null);

  assert.equal(outline[1].number, 2);
  assert.equal(outline[1].title, 'Barcos por la Montaña');

  assert.equal(outline[2].number, 3);
  assert.equal(outline[2].title, 'El Último Emperador');
});

test('parseSeriesOutline: tolerant to markdown bold, headers, dashes and multiline summaries', () => {
  const reply = `
Aquí tienes el desglose de la serie:

### **Capítulo 1: El Despertar del Titán**
**Resumen:** En las profundidades del océano, los sensores captan un sonido inexplicable.
Un equipo científico viaja al punto de origen sin saber a qué se enfrentan.

### **Capítulo 2 - La Criatura Revelada**
**Resumen:** El submarino de exploración sufre daños graves cuando una enorme silueta emerge.
Deben decidir si huir o intentar comunicarse.
`;

  const outline = parseSeriesOutline(reply);
  assert.equal(outline.length, 2);

  assert.equal(outline[0].number, 1);
  assert.equal(outline[0].title, 'El Despertar del Titán');
  assert.ok(outline[0].summary.includes('profundidades del océano'));
  assert.ok(outline[0].summary.includes('sin saber a qué se enfrentan'));

  assert.equal(outline[1].number, 2);
  assert.equal(outline[1].title, 'La Criatura Revelada');
  assert.ok(outline[1].summary.includes('submarino de exploración'));
});

test('parseSeriesOutline: numbered prefixes like "1. Capítulo 1: ..."', () => {
  const reply = `
1. Capítulo 1: Génesis
Resumen: Todo comenzó con una chispa.

2. Capítulo 2: Desarrollo
Resumen: La tecnología avanzó a un ritmo imparable.
`;

  const outline = parseSeriesOutline(reply);
  assert.equal(outline.length, 2);
  assert.equal(outline[0].number, 1);
  assert.equal(outline[0].title, 'Génesis');
  assert.equal(outline[0].summary, 'Todo comenzó con una chispa.');
});

test('parseSeriesOutline: fallback to simple numbered list if Capítulo keyword is absent', () => {
  const reply = `
1. La Gran Aventura
Los exploradores parten al amanecer en busca de la ciudad perdida.

2. En la Selva Oscura
Peligros acechan mientras el mapa se vuelve cada vez más confuso.
`;

  const outline = parseSeriesOutline(reply);
  assert.equal(outline.length, 2);
  assert.equal(outline[0].number, 1);
  assert.equal(outline[0].title, 'La Gran Aventura');
  assert.equal(outline[0].summary, 'Los exploradores parten al amanecer en busca de la ciudad perdida.');
});

test('parseSeriesOutline: handles empty or non-string input safely', () => {
  assert.deepEqual(parseSeriesOutline(''), []);
  assert.deepEqual(parseSeriesOutline(null), []);
  assert.deepEqual(parseSeriesOutline(undefined), []);
  assert.deepEqual(parseSeriesOutline('   \n\n  '), []);
});
