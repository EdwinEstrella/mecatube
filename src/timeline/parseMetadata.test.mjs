// Run with: node --test src/timeline/parseMetadata.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata, parseMetadataFromContent, stripWrapping } from './parseMetadata.js';

// Realistic sample matching Prompt 1 (src/prompts/prompt-1.txt ETAPA 4) output format
const REALISTIC_PROMPT_1_SAMPLE = `
**METADATOS DE PUBLICACIÓN**

**1. TÍTULOS (2 opciones)**
\`\`\`
Opción 1: El misterio del submarino que desapareció sin dejar rastro
Opción 2: ¿Qué le pasó realmente a la tripulación del USS Scorpion?
\`\`\`

**2. PROMPTS DE MINIATURA (2 prompts)**
Para generar la miniatura, sube o selecciona la imagen de tu personaje principal en ChatGPT o en Flow y luego pega el prompt correspondiente.
Texto de miniatura: "NO LO CREERÁS"

\`\`\`
YouTube thumbnail, wide 16:9, dramatic lighting. A naval officer with a terrified expression looking at a glowing radar screen.
\`\`\`

\`\`\`
YouTube thumbnail, wide 16:9, split composition. A sunken submarine on the dark ocean floor with mystery light.
\`\`\`

**3. DESCRIPCIÓN**
\`\`\`
En mayo de 1968, el submarino nuclear USS Scorpion desapareció con 99 hombres a bordo en el Océano Atlántico.

Durante décadas, los informes oficiales ocultaron lo que realmente ocurrió en las profundidades. Esta es la investigación completa.

#MisteriosMilitares #Submarinos #HistoriaOculta
\`\`\`

**4. ETIQUETAS**
\`\`\`
uss scorpion, submarino nuclear, misterios navales, guerra fria, naufragios historicos, secretos desclasificados, accidentes militares, sosus, armada de estados unidos, documentales de historia, tecnologia naval, conspiraciones reales, enigmas del oceano, desastres submarinos, historia militar
\`\`\`
`.trim();

test('parses realistic sample built from prompt-1 template (bold headings, code fences, accents)', () => {
  const result = parseMetadata(REALISTIC_PROMPT_1_SAMPLE);

  assert.ok(result !== null);
  assert.deepEqual(result.titles, [
    'El misterio del submarino que desapareció sin dejar rastro',
    '¿Qué le pasó realmente a la tripulación del USS Scorpion?',
  ]);
  assert.equal(result.thumbnailText, 'NO LO CREERÁS');
  assert.ok(result.description.includes('En mayo de 1968, el submarino nuclear USS Scorpion desapareció'));
  assert.ok(result.description.includes('#MisteriosMilitares #Submarinos #HistoriaOculta'));
  assert.equal(result.tags.length, 15);
  assert.equal(result.tags[0], 'uss scorpion');
  assert.equal(result.tags[14], 'historia militar');
});

test('handles metadata without code fences (optional code fences)', () => {
  const rawSample = `
METADATOS DE PUBLICACION
1. TITULOS
Opcion 1: Los secretos de la Atlantida
Opcion 2: Donde esta la ciudad perdida

2. PROMPTS DE MINIATURA
Prompt de miniatura 1
Texto de miniatura: ¿EXISTIO?

3. DESCRIPCION
Una exploracion profunda sobre los mitos y evidencias de la Atlantida.

4. ETIQUETAS
atlantida, arqueologia, misterios antiguos, historia perdida
`;

  const result = parseMetadata(rawSample);
  assert.ok(result !== null);
  assert.deepEqual(result.titles, [
    'Los secretos de la Atlantida',
    'Donde esta la ciudad perdida',
  ]);
  assert.equal(result.thumbnailText, '¿EXISTIO?');
  assert.equal(result.description, 'Una exploracion profunda sobre los mitos y evidencias de la Atlantida.');
  assert.deepEqual(result.tags, ['atlantida', 'arqueologia', 'misterios antiguos', 'historia perdida']);
});

test('returns null for no-metadata cases', () => {
  assert.equal(parseMetadata(null), null);
  assert.equal(parseMetadata(''), null);
  assert.equal(parseMetadata('Hola! Aquí tienes el guion del video... GANCHO ... DESARROLLO'), null);
  assert.equal(parseMetadata([]), null);
  assert.equal(
    parseMetadata([
      { role: 'user', content: 'siguiente' },
      { role: 'assistant', content: '¿Te gustaría hacer alguna corrección al guion?' },
    ]),
    null
  );
});

test('parses metadata from the LAST assistant message in a conversation array', () => {
  const messages = [
    { role: 'user', content: 'Dame ideas' },
    { role: 'assistant', content: '10 IDEAS DE VIDEO...' },
    { role: 'user', content: 'siguiente' },
    {
      role: 'assistant',
      content: `METADATOS DE PUBLICACIÓN\n1. TÍTULOS\n\`\`\`\nOpción 1: Título Viejo\n\`\`\`\n4. ETIQUETAS\n\`\`\`\nviejo\n\`\`\``,
    },
    { role: 'user', content: 'Cambia los títulos y etiquetas' },
    {
      role: 'assistant',
      content: `METADATOS DE PUBLICACIÓN\n1. TÍTULOS\n\`\`\`\nOpción 1: Título Nuevo\n\`\`\`\n3. DESCRIPCIÓN\n\`\`\`\nNueva descripción\n\`\`\`\n4. ETIQUETAS\n\`\`\`\nnuevo, actualizado\n\`\`\``,
    },
    { role: 'user', content: 'Perfecto gracias' },
  ];

  const result = parseMetadata(messages);
  assert.ok(result !== null);
  assert.deepEqual(result.titles, ['Título Nuevo']);
  assert.equal(result.description, 'Nueva descripción');
  assert.deepEqual(result.tags, ['nuevo', 'actualizado']);
  assert.equal(result.thumbnailText, null);
});

test('tolerates title lines without Opción prefix and strips quotes', () => {
  const sample = `
**METADATOS DE PUBLICACIÓN**
### 1. TÍTULOS
\`\`\`
"Primer Título Increíble"
«Segundo Título Fabuloso»
\`\`\`
### 3. DESCRIPCIÓN
\`\`\`
Breve descripción del video.
\`\`\`
### 4. ETIQUETAS
\`\`\`
#etiqueta1, #etiqueta2
\`\`\`
`;

  const result = parseMetadata(sample);
  assert.ok(result !== null);
  assert.deepEqual(result.titles, ['Primer Título Increíble', 'Segundo Título Fabuloso']);
  assert.deepEqual(result.tags, ['etiqueta1', 'etiqueta2']);
  assert.equal(result.thumbnailText, null);
});

test('stripWrapping correctly trims various quote styles', () => {
  assert.equal(stripWrapping('"hola"'), 'hola');
  assert.equal(stripWrapping('«hola»'), 'hola');
  assert.equal(stripWrapping('“hola”'), 'hola');
  assert.equal(stripWrapping("'hola'"), 'hola');
  assert.equal(stripWrapping('`hola`'), 'hola');
  assert.equal(stripWrapping('   "texto con espacios"   '), 'texto con espacios');
});

// T8 Multi-platform vertical metadata tests
test('parses multi-platform vertical metadata with code blocks (Shorts / TikTok / Reels)', () => {
  const verticalReply = `
METADATOS DE PUBLICACIÓN

YOUTUBE SHORTS
Título:
\`\`\`
¿Qué hacían los romanos antes de dormir? #Shorts
\`\`\`
Descripción:
\`\`\`
Descubre la extraña costumbre nocturna de la Antigua Roma. Suscríbete para más curiosidades.
\`\`\`
Etiquetas:
\`\`\`
roma antigua, historia, curiosidades, shorts, datos historicos
\`\`\`

TIKTOK
Descripción:
\`\`\`
La perturbadora costumbre nocturna de los romanos 😱 ¿Lo sabías? #curiosidades #historia #aprendeentiktok
\`\`\`
Hashtags:
\`\`\`
#curiosidades #historia #aprendeentiktok #datoscuriosos
\`\`\`

INSTAGRAM REELS
Descripción:
\`\`\`
Ni te imaginas lo que hacían los romanos en su habitación... Sígueme para más datos insólitos.
\`\`\`
Hashtags:
\`\`\`
#historiaantigua #curiosidadeshistoricas #reelsinstagram #datosreales
\`\`\`
`.trim();

  const result = parseMetadata(verticalReply);
  assert.ok(result !== null);
  assert.ok(result.platforms !== null);

  // YouTube Shorts
  assert.equal(result.platforms.youtubeShorts.title, '¿Qué hacían los romanos antes de dormir? #Shorts');
  assert.ok(result.platforms.youtubeShorts.description.includes('costumbre nocturna'));
  assert.deepEqual(result.platforms.youtubeShorts.tags, [
    'roma antigua',
    'historia',
    'curiosidades',
    'shorts',
    'datos historicos',
  ]);

  // TikTok
  assert.ok(result.platforms.tiktok.caption.includes('La perturbadora costumbre nocturna'));
  assert.ok(result.platforms.tiktok.hashtags.includes('#curiosidades'));
  assert.ok(result.platforms.tiktok.hashtags.includes('#historia'));

  // Instagram Reels
  assert.ok(result.platforms.instagramReels.caption.includes('Ni te imaginas lo que hacían'));
  assert.ok(result.platforms.instagramReels.hashtags.includes('#historiaantigua'));
  assert.ok(result.platforms.instagramReels.hashtags.includes('#reelsinstagram'));

  // Backwards compatible fields
  assert.deepEqual(result.titles, ['¿Qué hacían los romanos antes de dormir? #Shorts']);
  assert.ok(result.description.includes('costumbre nocturna'));
  assert.equal(result.tags.length, 5);
});

test('parses multi-platform vertical metadata with markdown headers, bold, numbering and emojis', () => {
  const emojiReply = `
**METADATOS DE PUBLICACIÓN**

### 1. 🎬 YOUTUBE SHORTS
**Título:**
¿Qué pasaría si caes en un agujero negro? #Shorts

**Descripción:**
La física extrema explicada en menos de 60 segundos con animación stickman.

**Etiquetas:**
espacio, agujero negro, ciencia, fisica, astrofisica

### 2. 📱 TIKTOK
**Descripción (caption):**
Lo que nadie te contó sobre los agujeros negros 🕳️🚀 #ciencia #espacio #fyp

**Hashtags:**
#ciencia, #espacio, #fyp, #parati

### 3. 📸 INSTAGRAM REELS
**Descripción:**
¿Es posible sobrevivir a un agujero negro? La respuesta te va a sorprender. Dale like y comparte.

**Hashtags:**
#astronomia #espacioexterior #cienciaparatodos
`.trim();

  const result = parseMetadata(emojiReply);
  assert.ok(result !== null);
  assert.ok(result.platforms !== null);

  assert.equal(result.platforms.youtubeShorts.title, '¿Qué pasaría si caes en un agujero negro? #Shorts');
  assert.equal(result.platforms.youtubeShorts.tags.length, 5);
  assert.ok(result.platforms.tiktok.caption.includes('Lo que nadie te contó'));
  assert.ok(result.platforms.tiktok.hashtags.includes('#ciencia'));
  assert.ok(result.platforms.instagramReels.caption.includes('¿Es posible sobrevivir'));
  assert.ok(result.platforms.instagramReels.hashtags.includes('#astronomia'));
});
