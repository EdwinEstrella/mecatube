// Visual styles catalog and prompt transformation for workspace-level art style.
// Preserves verbatim prompt-2.txt while substituting style wording at send time.

import {
  NEW_STYLE_SPECS,
  buildStyleReplacements,
  setDefaultFromStrings,
} from './styleSpecs.js';

export const DEFAULT_STYLE_ID = 'stickman';

export const STYLE_CATEGORIES = [
  'Básicos',
  'Cinematográficos',
  'Animación 3D',
  'Artesanales',
  'Arte pintado',
  'Para explicar',
];

// import.meta.glob is compiled away by Vite, so guard on import.meta.env (present only under Vite, absent in plain Node tests)
const styleImages =
  import.meta.env
    ? import.meta.glob('../assets/styles/*.png', { eager: true, query: '?url', import: 'default' })
    : {};

function getNewStyleImage(id) {
  const key = '../assets/styles/' + id + '.png';
  return styleImages[key] || null;
}

export const STYLES = [
  {
    id: 'stickman',
    label: 'Stickman',
    category: 'Básicos',
    description: 'Personajes de palito dibujados a mano con fondo detallado',
    image: new URL('../assets/styles/stickman.png', import.meta.url).href,
    englishDescription: 'Simple hand-drawn 2D stickman cartoon style for an educational explainer video: clean bold black linework, flat colors with minimal soft shading. True stickman characters with stick bodies and empty hands over detailed painted backgrounds.',
  },
  {
    id: 'cartoon',
    label: '2D',
    category: 'Básicos',
    description: 'Personajes redondeados y expresivos con líneas gruesas y colores vivos',
    image: new URL('../assets/styles/cartoon.png', import.meta.url).href,
    englishDescription: 'Classic 2D cartoon style: rounded expressive characters with big eyes, thick clean outlines, bright saturated flat colors, simple cel shading, over a detailed painted background',
  },
  {
    id: 'anime',
    label: 'Anime',
    category: 'Básicos',
    description: 'Estilo anime japonés con sombreado cel y fondos pictóricos',
    image: new URL('../assets/styles/anime.png', import.meta.url).href,
    englishDescription: 'Japanese anime style: expressive characters with large eyes, clean cel shading, soft light glow, painterly anime film background',
  },
  {
    id: '3d',
    label: '3D',
    category: 'Básicos',
    description: 'Estilo animación 3D estilizada con iluminación suave y cinematográfica',
    image: new URL('../assets/styles/3d.png', import.meta.url).href,
    englishDescription: 'Stylized 3D animated movie look: soft rounded 3D characters, soft global illumination, cinematic depth of field, family animation film quality',
  },
  {
    id: 'flat',
    label: 'Plano',
    category: 'Básicos',
    description: 'Ilustración vectorial moderna, formas geométricas y paleta armónica',
    image: new URL('../assets/styles/flat.png', import.meta.url).href,
    englishDescription: 'Modern flat vector illustration: geometric shapes, thin or no outlines, limited harmonious palette, subtle grain texture, minimal shading, editorial infographic look',
  },
  {
    id: 'realistic',
    label: 'Realista',
    category: 'Básicos',
    description: 'Estilo cinematográfico fotorrealista con iluminación y texturas reales',
    image: new URL('../assets/styles/realistic.png', import.meta.url).href,
    englishDescription: 'Photorealistic cinematic style: real people and places, realistic lighting, shallow depth of field, subtle film grain, documentary quality',
  },
  ...NEW_STYLE_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    category: spec.category,
    idealFor: spec.idealFor,
    description: spec.description,
    image: getNewStyleImage(spec.id),
    englishDescription: spec.englishDescription,
  })),
];
export function getStyle(id) {
  return STYLES.find((s) => s.id === id) || STYLES[0];
}

// Exact replacement pairs per non-stickman style derived from prompt-2.txt
const STYLE_REPLACEMENTS = {
  cartoon: [
    [
      'narrados de YouTube, diseñador de personajes stickman y ingeniero de prompts para',
      'narrados de YouTube, diseñador de personajes cartoon 2D y ingeniero de prompts para',
    ],
    [
      'Tu especialidad es reproducir con exactitud un único estilo visual: stickman 2D\r\ndibujado a mano, educativo, sobre escenarios 2D detallados y bien iluminados.',
      'Tu especialidad es reproducir con exactitud un único estilo visual: cartoon 2D\r\nclásico, educativo, sobre escenarios 2D detallados y bien iluminados.',
    ],
    [
      '**B. Estilo visual único — Stickman 2D educativo dibujado a mano**',
      '**B. Estilo visual único — Cartoon 2D clásico educativo**',
    ],
    [
      `Técnica:
* Personajes: línea negra limpia y marcada, dibujada a mano, con colores planos.
* Escenarios: ilustración 2D pintada a mano, rica en detalle, con profundidad,
texturas, iluminación ambiental y sombras suaves, como un fondo de animación
profesional.
* El contraste entre el stickman plano y el escenario detallado es parte del estilo.
Personajes (stickman verdadero):
* Cabeza grande, perfectamente redonda y blanca.
* Ojos: dos puntos negros pequeños.
* Cejas finas que transmiten la emoción.
* Boca simple; sin nariz.
* CUERPO DE PALITO (obligatorio en todos los personajes, siempre):
* Torso: una sola línea negra delgada, o una prenda simple y plana que cuelga de
los hombros (túnica, camiseta, vestido) sobre esa línea.
* Brazos y piernas: siempre una sola línea negra delgada, del mismo grosor,
visibles por completo. Nunca cubiertos por mangas ni pantalones.
* Manos: círculos pequeños y simples.
* Pies: terminaciones cortas de la línea o puntos pequeños. Nunca zapatos, botas
ni pies grandes.
* Sin volumen corporal: nunca torso ancho, hombros, caderas, piernas gruesas ni
manos o pies realistas.
* Ropa permitida: solo el cabello, una prenda plana en el torso, accesorios
pequeños (collar, cinturón, sombrero, capa, mochila). Nunca pantalones, mangas,
guantes ni calzado.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la prenda y los accesorios hacen reconocible a
cada personaje (ejemplo: cabello castaño despeinado y túnica de piel con textura
sobre un cuerpo de palito).
* Nunca: humanos realistas, anatomía realista, cuerpos de caricatura detallados,
anime, manga, estilo Pixar o Disney, 3D, fotorrealismo.`,
      `Técnica:
* Personajes: dibujo animado clásico 2D con contornos negros limpios y definidos, personajes redondeados y expresivos con colores vivos y sombreado cel simple.
* Escenarios: ilustración 2D pintada a mano, rica en detalle, con profundidad, texturas, iluminación ambiental y sombras suaves, como un fondo de animación profesional.
* Armonía entre personajes cartoon expresivos y escenarios detallados.
Personajes (Cartoon 2D):
* Rasgos faciales expresivos, ojos grandes y vivaces, cejas dinámicas y boca elocuente.
* Proporciones redondeadas y atractivas de caricatura clásica con anatomía simplificada pero sólida.
* Vestuario y accesorios con colores vivos y líneas limpias que definen la identidad de cada personaje.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la vestimenta y los accesorios hacen reconocible a
cada personaje (ejemplo: cabello castaño despeinado y túnica de piel con textura).
* Nunca: figuras esquemáticas simples, fotorrealismo, 3D.`,
    ],
    [
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\nstickman.',
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\ncartoon.',
    ],
    [
      `* La ficha describe solo cabello, prenda plana del torso y accesorios
(sección B). Nunca pantalones, mangas, zapatos ni guantes. Ropa moderna se escribe
como prenda plana: a flat light blue t-shirt shape on the stick torso.`,
      `* La ficha describe rasgos, vestimenta y accesorios
(sección B). Ropa moderna se escribe
como prenda cartoon: a classic light blue t-shirt with clean outlines.`,
    ],
    [
      `* Ejemplo de forma: a stickman man of about 30 with messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
      `* Ejemplo de forma: a cartoon man of about 30 with big expressive eyes, messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
    ],
    [
      `* Nunca reemplaces a un personaje principal por un stickman genérico ni lo
describas con otras palabras.`,
      `* Nunca reemplaces a un personaje principal por un personaje genérico ni lo
describas con otras palabras.`,
    ],
    [
      `* Personajes de fondo: stickmen simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
      `* Personajes de fondo: personajes secundarios simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
    ],
    [
      `parece a un principal; todos los personajes tienen cuerpo de palito sin
pantalones, mangas ni zapatos; ninguna imagen cubre más de 8–10 palabras del`,
      `parece a un principal; todos los personajes mantienen el estilo cartoon 2D con
rasgos y vestuario consistentes; ninguna imagen cubre más de 8–10 palabras del`,
    ],
    [
      `* Colores vivos y de alto contraste: el stickman plano sobre un fondo detallado e
iluminado de forma dramática.`,
      `* Colores vivos y de alto contraste: el personaje cartoon sobre un fondo detallado e
iluminado de forma dramática.`,
    ],
    [
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo stickman.',
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo cartoon 2D.',
    ],
    [
      `Professional 2D stickman character sheet. Simple hand-drawn
2D stickman cartoon style for an educational explainer video: clean bold black
linework, flat colors with minimal soft shading. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin expressive black
eyebrows, simple mouth, no nose. Stick body: the torso is a single thin black line
or a small flat garment shape hanging from the shoulders; arms and legs are always
single thin black lines of equal thickness, fully visible, never covered by
sleeves or trousers; hands are tiny simple circles; feet are tiny short line ends.
Hair, the flat garment and accessories are drawn simply with flat color and light
texture and make the character recognizable. Both hands are always empty: the
character never holds, carries or uses any object in any view or pose. No trousers, no sleeves, no
shoes, no gloves, no thick limbs, no body volume, no realistic hands or feet.`,
      `Professional character sheet. Classic 2D cartoon style: rounded expressive characters with big eyes, thick clean outlines, bright saturated flat colors, simple cel shading, over a detailed painted background. Character design: rounded expressive facial features, large lively eyes, dynamic eyebrows, expressive mouth. Clear cartoon proportions with consistent clothing, hairstyle, colors and accessories that make the character recognizable. Both hands are always empty: the character never holds, carries or uses any object in any view or pose.`,
    ],
    [
      `Never realistic humans, no realistic anatomy, no detailed
cartoon bodies, no anime, no manga, no 3D, no photorealism. No text, no labels, no`,
      `No photorealism, no 3D, no simplistic line art. No text, no labels, no`,
    ],
    [
      `Illustration. Hand-drawn 2D stickman cartoon style for an
educational explainer video. The characters are drawn with clean bold black
linework and flat colors. The environment is a richly detailed hand-painted 2D
illustration with depth, material textures, atmospheric lighting, soft shadows and
cinematic composition, like a professional animated film background. Characters are
true stickmen: large perfectly round white head, tiny black dot eyes, thin
expressive black eyebrows, simple mouth, no nose. Stick body: the torso is a
single thin black line or a small flat garment shape hanging from the shoulders;
arms and legs are always single thin black lines of equal thickness, fully
visible, never covered by sleeves or trousers; hands are tiny simple circles; feet
are tiny short line ends. Hair and the flat garment drawn simply with flat color
and light texture. Main characters keep both hands empty and never hold objects. No trousers, no sleeves, no shoes, no thick limbs, no
body volume, no realistic hands or feet. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
      `Illustration. Classic 2D cartoon style: rounded expressive characters with big eyes, thick clean outlines, bright saturated flat colors, simple cel shading, over a detailed painted background. Main characters keep both hands empty and never hold objects. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
    ],
    [
      'Never realistic humans, no realistic anatomy, no anime, no 3D, no photorealism. No',
      'No photorealism, no 3D, no simplistic line art. No',
    ],
    [
      `* \`[BACKGROUND_CHARACTERS]\` — personajes stickman pequeños de fondo o \`no other
characters\`.`,
      `* \`[BACKGROUND_CHARACTERS]\` — personajes secundarios pequeños de fondo o \`no other
characters\`.`,
    ],
    [
      `Educational explainer illustration, in a simple hand-drawn 2D
stickman cartoon style: pure white background, clean bold black linework, flat
colors with minimal soft shading.`,
      `Educational explainer illustration, in a classic 2D cartoon style: pure white background, clean bold outlines, bright saturated flat colors with simple shading.`,
    ],
    [
      `Any character is a true stickman
with a large round white head and a stick body: thin single black lines for torso,
arms and legs, tiny circle hands, tiny line-end feet, only a small flat garment on
the torso; no trousers, no sleeves, no shoes, no body volume. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
      `Any character is drawn in the same 2D cartoon style with consistent proportions and clothing. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
    ],
    [
      `flat
stickman characters with clean black linework over the same detailed painted
environment, lighting, composition and framing.`,
      `classic 2D
cartoon characters with clean bold outlines over the same detailed painted
environment, lighting, composition and framing.`,
    ],
    [
      `Stick bodies stay as single thin black
lines while moving: arms and legs never thicken or gain sleeves, trousers or
shoes.`,
      `Characters maintain their consistent cartoon anatomy
and clothing while moving.`,
    ],
    [
      `no style change, no 3D,
no realism, no blood, no watermark, no logo.`,
      `no style change, no 3D,
no realism, no simplistic line art, no blood, no watermark, no logo.`,
    ],
    [
      `the
stickman slowly turns his head toward the fire and blinks`,
      `the
character slowly turns his head toward the fire and blinks`,
    ],
    [
      `YouTube thumbnail. Hand-drawn 2D stickman cartoon style: the
character has clean bold black linework and flat bright colors over a detailed,
dramatically lit painted background with depth; bright high-contrast colors and a
clear composition that reads well at small size. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin black eyebrows, simple
mouth, no nose, stick body with single thin black lines for torso, arms and legs,
tiny circle hands, tiny line-end feet, only a small flat garment on the torso, no
trousers, no sleeves, no shoes, no body volume, and must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
      `YouTube thumbnail. Classic 2D cartoon style: rounded expressive characters with big eyes, thick clean outlines, bright saturated flat colors, simple cel shading, over a detailed painted background; bright high-contrast colors and a
clear composition that reads well at small size. The character must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
    ],
    [
      `* Usa únicamente el estilo stickman de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje es un stickman verdadero con cuerpo de palito: torso, brazos y
piernas de una sola línea negra delgada. Nunca pantalones, mangas, zapatos ni
volumen corporal. Nunca humanos realistas ni caricaturas detalladas.`,
      `* Usa únicamente el estilo cartoon 2D de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje mantiene proporciones cartoon 2D consistentes: rasgos expresivos,
líneas limpias y vestuario definido. Nunca humanos realistas ni figuras esquemáticas simples.`,
    ],
  ],

  anime: [
    [
      'narrados de YouTube, diseñador de personajes stickman y ingeniero de prompts para',
      'narrados de YouTube, diseñador de personajes anime y ingeniero de prompts para',
    ],
    [
      'Tu especialidad es reproducir con exactitud un único estilo visual: stickman 2D\r\ndibujado a mano, educativo, sobre escenarios 2D detallados y bien iluminados.',
      'Tu especialidad es reproducir con exactitud un único estilo visual: anime\r\njaponés, educativo, sobre escenarios pictóricos detallados y bien iluminados.',
    ],
    [
      '**B. Estilo visual único — Stickman 2D educativo dibujado a mano**',
      '**B. Estilo visual único — Anime japonés educativo**',
    ],
    [
      `Técnica:
* Personajes: línea negra limpia y marcada, dibujada a mano, con colores planos.
* Escenarios: ilustración 2D pintada a mano, rica en detalle, con profundidad,
texturas, iluminación ambiental y sombras suaves, como un fondo de animación
profesional.
* El contraste entre el stickman plano y el escenario detallado es parte del estilo.
Personajes (stickman verdadero):
* Cabeza grande, perfectamente redonda y blanca.
* Ojos: dos puntos negros pequeños.
* Cejas finas que transmiten la emoción.
* Boca simple; sin nariz.
* CUERPO DE PALITO (obligatorio en todos los personajes, siempre):
* Torso: una sola línea negra delgada, o una prenda simple y plana que cuelga de
los hombros (túnica, camiseta, vestido) sobre esa línea.
* Brazos y piernas: siempre una sola línea negra delgada, del mismo grosor,
visibles por completo. Nunca cubiertos por mangas ni pantalones.
* Manos: círculos pequeños y simples.
* Pies: terminaciones cortas de la línea o puntos pequeños. Nunca zapatos, botas
ni pies grandes.
* Sin volumen corporal: nunca torso ancho, hombros, caderas, piernas gruesas ni
manos o pies realistas.
* Ropa permitida: solo el cabello, una prenda plana en el torso, accesorios
pequeños (collar, cinturón, sombrero, capa, mochila). Nunca pantalones, mangas,
guantes ni calzado.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la prenda y los accesorios hacen reconocible a
cada personaje (ejemplo: cabello castaño despeinado y túnica de piel con textura
sobre un cuerpo de palito).
* Nunca: humanos realistas, anatomía realista, cuerpos de caricatura detallados,
anime, manga, estilo Pixar o Disney, 3D, fotorrealismo.`,
      `Técnica:
* Personajes: estilo anime tradicional, líneas limpias y definidas, sombreado cel con degradados suaves y brillo sutil.
* Escenarios: fondos pictóricos de película de anime, ricos en atmósfera, luz cinematográfica y profundidad.
* Integración fluida de personajes estilizados sobre fondos pictóricos.
Personajes (Anime):
* Ojos grandes y expresivos característicos del anime, cejas finas y boca proporcionada.
* Proporciones estilizadas de anime, cabello detallado con mechones definidos y brillos característicos.
* Vestuario con pliegues naturales y accesorios detallados acordes a la personalidad.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la vestimenta y los accesorios hacen reconocible a
cada personaje (ejemplo: cabello castaño despeinado y túnica de piel con textura).
* Nunca: figuras esquemáticas simples, estilo cartoon occidental exagerado, fotorrealismo, 3D.`,
    ],
    [
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\nstickman.',
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\nanime.',
    ],
    [
      `* La ficha describe solo cabello, prenda plana del torso y accesorios
(sección B). Nunca pantalones, mangas, zapatos ni guantes. Ropa moderna se escribe
como prenda plana: a flat light blue t-shirt shape on the stick torso.`,
      `* La ficha describe rasgos, vestimenta y accesorios
(sección B). Ropa moderna se escribe
como prenda anime: an anime-styled light blue t-shirt with crisp folds.`,
    ],
    [
      `* Ejemplo de forma: a stickman man of about 30 with messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
      `* Ejemplo de forma: an anime man of about 30 with expressive eyes, messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
    ],
    [
      `* Nunca reemplaces a un personaje principal por un stickman genérico ni lo
describas con otras palabras.`,
      `* Nunca reemplaces a un personaje principal por un personaje genérico ni lo
describas con otras palabras.`,
    ],
    [
      `* Personajes de fondo: stickmen simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
      `* Personajes de fondo: personajes secundarios simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
    ],
    [
      `parece a un principal; todos los personajes tienen cuerpo de palito sin
pantalones, mangas ni zapatos; ninguna imagen cubre más de 8–10 palabras del`,
      `parece a un principal; todos los personajes mantienen el estilo anime con
rasgos y vestuario consistentes; ninguna imagen cubre más de 8–10 palabras del`,
    ],
    [
      `* Colores vivos y de alto contraste: el stickman plano sobre un fondo detallado e
iluminado de forma dramática.`,
      `* Colores vivos y de alto contraste: el personaje anime sobre un fondo detallado e
iluminado de forma dramática.`,
    ],
    [
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo stickman.',
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo anime.',
    ],
    [
      `Professional 2D stickman character sheet. Simple hand-drawn
2D stickman cartoon style for an educational explainer video: clean bold black
linework, flat colors with minimal soft shading. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin expressive black
eyebrows, simple mouth, no nose. Stick body: the torso is a single thin black line
or a small flat garment shape hanging from the shoulders; arms and legs are always
single thin black lines of equal thickness, fully visible, never covered by
sleeves or trousers; hands are tiny simple circles; feet are tiny short line ends.
Hair, the flat garment and accessories are drawn simply with flat color and light
texture and make the character recognizable. Both hands are always empty: the
character never holds, carries or uses any object in any view or pose. No trousers, no sleeves, no
shoes, no gloves, no thick limbs, no body volume, no realistic hands or feet.`,
      `Professional character sheet. Japanese anime style: expressive characters with large eyes, clean cel shading, soft light glow, painterly anime film background. Character design: distinct anime facial features, large expressive eyes, detailed hair styling with highlights, refined clothing with clean folds and distinct accessories that make the character recognizable. Both hands are always empty: the character never holds, carries or uses any object in any view or pose.`,
    ],
    [
      `Never realistic humans, no realistic anatomy, no detailed
cartoon bodies, no anime, no manga, no 3D, no photorealism. No text, no labels, no`,
      `No western cartoon style, no 3D, no photorealism, no simplistic line art. No text, no labels, no`,
    ],
    [
      `Illustration. Hand-drawn 2D stickman cartoon style for an
educational explainer video. The characters are drawn with clean bold black
linework and flat colors. The environment is a richly detailed hand-painted 2D
illustration with depth, material textures, atmospheric lighting, soft shadows and
cinematic composition, like a professional animated film background. Characters are
true stickmen: large perfectly round white head, tiny black dot eyes, thin
expressive black eyebrows, simple mouth, no nose. Stick body: the torso is a
single thin black line or a small flat garment shape hanging from the shoulders;
arms and legs are always single thin black lines of equal thickness, fully
visible, never covered by sleeves or trousers; hands are tiny simple circles; feet
are tiny short line ends. Hair and the flat garment drawn simply with flat color
and light texture. Main characters keep both hands empty and never hold objects. No trousers, no sleeves, no shoes, no thick limbs, no
body volume, no realistic hands or feet. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
      `Illustration. Japanese anime style: expressive characters with large eyes, clean cel shading, soft light glow, painterly anime film background. Main characters keep both hands empty and never hold objects. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
    ],
    [
      'Never realistic humans, no realistic anatomy, no anime, no 3D, no photorealism. No',
      'No western cartoon style, no 3D, no photorealism, no simplistic line art. No',
    ],
    [
      `* \`[BACKGROUND_CHARACTERS]\` — personajes stickman pequeños de fondo o \`no other
characters\`.`,
      `* \`[BACKGROUND_CHARACTERS]\` — personajes secundarios pequeños de fondo o \`no other
characters\`.`,
    ],
    [
      `Educational explainer illustration, in a simple hand-drawn 2D
stickman cartoon style: pure white background, clean bold black linework, flat
colors with minimal soft shading.`,
      `Educational explainer illustration, in a Japanese anime style: pure white background, clean linework, cel shading.`,
    ],
    [
      `Any character is a true stickman
with a large round white head and a stick body: thin single black lines for torso,
arms and legs, tiny circle hands, tiny line-end feet, only a small flat garment on
the torso; no trousers, no sleeves, no shoes, no body volume. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
      `Any character is drawn in the same anime style with consistent proportions and clothing. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
    ],
    [
      `flat
stickman characters with clean black linework over the same detailed painted
environment, lighting, composition and framing.`,
      `Japanese anime
characters with clean cel shading over the same painterly anime film
environment, lighting, composition and framing.`,
    ],
    [
      `Stick bodies stay as single thin black
lines while moving: arms and legs never thicken or gain sleeves, trousers or
shoes.`,
      `Characters maintain their consistent anime anatomy
and clothing while moving.`,
    ],
    [
      `no style change, no 3D,
no realism, no blood, no watermark, no logo.`,
      `no style change, no 3D,
no realism, no simplistic line art, no blood, no watermark, no logo.`,
    ],
    [
      `the
stickman slowly turns his head toward the fire and blinks`,
      `the
character slowly turns his head toward the fire and blinks`,
    ],
    [
      `YouTube thumbnail. Hand-drawn 2D stickman cartoon style: the
character has clean bold black linework and flat bright colors over a detailed,
dramatically lit painted background with depth; bright high-contrast colors and a
clear composition that reads well at small size. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin black eyebrows, simple
mouth, no nose, stick body with single thin black lines for torso, arms and legs,
tiny circle hands, tiny line-end feet, only a small flat garment on the torso, no
trousers, no sleeves, no shoes, no body volume, and must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
      `YouTube thumbnail. Japanese anime style: expressive characters with large eyes, clean cel shading, soft light glow, painterly anime film background; bright high-contrast colors and a
clear composition that reads well at small size. The character must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
    ],
    [
      `* Usa únicamente el estilo stickman de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje es un stickman verdadero con cuerpo de palito: torso, brazos y
piernas de una sola línea negra delgada. Nunca pantalones, mangas, zapatos ni
volumen corporal. Nunca humanos realistas ni caricaturas detalladas.`,
      `* Usa únicamente el estilo anime de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje mantiene proporciones anime consistentes: ojos grandes expresivos,
sombreado cel y vestuario definido. Nunca humanos fotorrealistas ni figuras esquemáticas simples.`,
    ],
  ],

  '3d': [
    [
      'narrados de YouTube, diseñador de personajes stickman y ingeniero de prompts para',
      'narrados de YouTube, diseñador de personajes 3D animados y ingeniero de prompts para',
    ],
    [
      'Tu especialidad es reproducir con exactitud un único estilo visual: stickman 2D\r\ndibujado a mano, educativo, sobre escenarios 2D detallados y bien iluminados.',
      'Tu especialidad es reproducir con exactitud un único estilo visual: 3D animado\r\nestilizado, educativo, sobre escenarios 3D detallados y bien iluminados.',
    ],
    [
      '**B. Estilo visual único — Stickman 2D educativo dibujado a mano**',
      '**B. Estilo visual único — 3D animado estilizado educativo**',
    ],
    [
      `Técnica:
* Personajes: línea negra limpia y marcada, dibujada a mano, con colores planos.
* Escenarios: ilustración 2D pintada a mano, rica en detalle, con profundidad,
texturas, iluminación ambiental y sombras suaves, como un fondo de animación
profesional.
* El contraste entre el stickman plano y el escenario detallado es parte del estilo.
Personajes (stickman verdadero):
* Cabeza grande, perfectamente redonda y blanca.
* Ojos: dos puntos negros pequeños.
* Cejas finas que transmiten la emoción.
* Boca simple; sin nariz.
* CUERPO DE PALITO (obligatorio en todos los personajes, siempre):
* Torso: una sola línea negra delgada, o una prenda simple y plana que cuelga de
los hombros (túnica, camiseta, vestido) sobre esa línea.
* Brazos y piernas: siempre una sola línea negra delgada, del mismo grosor,
visibles por completo. Nunca cubiertos por mangas ni pantalones.
* Manos: círculos pequeños y simples.
* Pies: terminaciones cortas de la línea o puntos pequeños. Nunca zapatos, botas
ni pies grandes.
* Sin volumen corporal: nunca torso ancho, hombros, caderas, piernas gruesas ni
manos o pies realistas.
* Ropa permitida: solo el cabello, una prenda plana en el torso, accesorios
pequeños (collar, cinturón, sombrero, capa, mochila). Nunca pantalones, mangas,
guantes ni calzado.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la prenda y los accesorios hacen reconocible a
cada personaje (ejemplo: cabello castaño despeinado y túnica de piel con textura
sobre un cuerpo de palito).
* Nunca: humanos realistas, anatomía realista, cuerpos de caricatura detallados,
anime, manga, estilo Pixar o Disney, 3D, fotorrealismo.`,
      `Técnica:
* Personajes: modelos 3D estilizados con formas suaves y redondeadas, materiales limpios y calidez de película animada familiar.
* Escenarios: entornos 3D con iluminación global suave, profundidad de campo cinematográfica y texturas sutiles.
* Composición cinematográfica de alta calidad de animación por computadora.
Personajes (3D animado):
* Rasgos faciales modelados de forma suave y expresiva, ojos brillantes y cabello estilizado con volumen.
* Anatomía 3D estilizada, proporciones suaves no hiperrealistas, movimiento fluido y creíble.
* Ropa con texturas suaves de tela, accesorios modelados en coherencia con el personaje.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la vestimenta y los accesorios hacen reconocible a
cada personaje (ejemplo: cabello castaño despeinado y túnica de piel con textura).
* Nunca: figuras esquemáticas simples, fotorrealismo humano, 2D plano.`,
    ],
    [
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\nstickman.',
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\n3D.',
    ],
    [
      `* La ficha describe solo cabello, prenda plana del torso y accesorios
(sección B). Nunca pantalones, mangas, zapatos ni guantes. Ropa moderna se escribe
como prenda plana: a flat light blue t-shirt shape on the stick torso.`,
      `* La ficha describe rasgos, vestimenta y accesorios
(sección B). Ropa moderna se escribe
como prenda 3D: a stylized 3D light blue t-shirt with soft fabric textures.`,
    ],
    [
      `* Ejemplo de forma: a stickman man of about 30 with messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
      `* Ejemplo de forma: a stylized 3D man of about 30 with soft rounded features, messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
    ],
    [
      `* Nunca reemplaces a un personaje principal por un stickman genérico ni lo
describas con otras palabras.`,
      `* Nunca reemplaces a un personaje principal por un personaje genérico ni lo
describas con otras palabras.`,
    ],
    [
      `* Personajes de fondo: stickmen simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
      `* Personajes de fondo: personajes secundarios simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
    ],
    [
      `parece a un principal; todos los personajes tienen cuerpo de palito sin
pantalones, mangas ni zapatos; ninguna imagen cubre más de 8–10 palabras del`,
      `parece a un principal; todos los personajes mantienen el estilo 3D animado con
rasgos y vestuario consistentes; ninguna imagen cubre más de 8–10 palabras del`,
    ],
    [
      `* Colores vivos y de alto contraste: el stickman plano sobre un fondo detallado e
iluminado de forma dramática.`,
      `* Colores vivos y de alto contraste: el personaje 3D sobre un fondo detallado e
iluminado de forma dramática.`,
    ],
    [
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo stickman.',
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo 3D animado.',
    ],
    [
      `Professional 2D stickman character sheet. Simple hand-drawn
2D stickman cartoon style for an educational explainer video: clean bold black
linework, flat colors with minimal soft shading. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin expressive black
eyebrows, simple mouth, no nose. Stick body: the torso is a single thin black line
or a small flat garment shape hanging from the shoulders; arms and legs are always
single thin black lines of equal thickness, fully visible, never covered by
sleeves or trousers; hands are tiny simple circles; feet are tiny short line ends.
Hair, the flat garment and accessories are drawn simply with flat color and light
texture and make the character recognizable. Both hands are always empty: the
character never holds, carries or uses any object in any view or pose. No trousers, no sleeves, no
shoes, no gloves, no thick limbs, no body volume, no realistic hands or feet.`,
      `Professional character sheet. Stylized 3D animated movie look: soft rounded 3D characters, soft global illumination, cinematic depth of field, family animation film quality. Character design: soft rounded stylized 3D features, expressive eyes, smooth stylized hair, detailed clothing textures, clean materials and recognizable accessories. Both hands are always empty: the character never holds, carries or uses any object in any view or pose.`,
    ],
    [
      `Never realistic humans, no realistic anatomy, no detailed
cartoon bodies, no anime, no manga, no 3D, no photorealism. No text, no labels, no`,
      `No 2D flat style, no live-action photorealism, no simplistic line art. No text, no labels, no`,
    ],
    [
      `Illustration. Hand-drawn 2D stickman cartoon style for an
educational explainer video. The characters are drawn with clean bold black
linework and flat colors. The environment is a richly detailed hand-painted 2D
illustration with depth, material textures, atmospheric lighting, soft shadows and
cinematic composition, like a professional animated film background. Characters are
true stickmen: large perfectly round white head, tiny black dot eyes, thin
expressive black eyebrows, simple mouth, no nose. Stick body: the torso is a
single thin black line or a small flat garment shape hanging from the shoulders;
arms and legs are always single thin black lines of equal thickness, fully
visible, never covered by sleeves or trousers; hands are tiny simple circles; feet
are tiny short line ends. Hair and the flat garment drawn simply with flat color
and light texture. Main characters keep both hands empty and never hold objects. No trousers, no sleeves, no shoes, no thick limbs, no
body volume, no realistic hands or feet. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
      `Illustration. Stylized 3D animated movie look: soft rounded 3D characters, soft global illumination, cinematic depth of field, family animation film quality. Main characters keep both hands empty and never hold objects. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
    ],
    [
      'Never realistic humans, no realistic anatomy, no anime, no 3D, no photorealism. No',
      'No 2D flat style, no live-action photorealism, no simplistic line art. No',
    ],
    [
      `* \`[BACKGROUND_CHARACTERS]\` — personajes stickman pequeños de fondo o \`no other
characters\`.`,
      `* \`[BACKGROUND_CHARACTERS]\` — personajes secundarios pequeños de fondo o \`no other
characters\`.`,
    ],
    [
      `Educational explainer illustration, in a simple hand-drawn 2D
stickman cartoon style: pure white background, clean bold black linework, flat
colors with minimal soft shading.`,
      `Educational explainer illustration, in a stylized 3D style: pure white background, soft rounded geometry, subtle shadows.`,
    ],
    [
      `Any character is a true stickman
with a large round white head and a stick body: thin single black lines for torso,
arms and legs, tiny circle hands, tiny line-end feet, only a small flat garment on
the torso; no trousers, no sleeves, no shoes, no body volume. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
      `Any character is drawn in the same stylized 3D look with consistent proportions and clothing. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
    ],
    [
      `flat
stickman characters with clean black linework over the same detailed painted
environment, lighting, composition and framing.`,
      `stylized 3D
characters with soft global illumination over the same detailed 3D
environment, lighting, composition and framing.`,
    ],
    [
      `Stick bodies stay as single thin black
lines while moving: arms and legs never thicken or gain sleeves, trousers or
shoes.`,
      `Characters maintain their consistent 3D anatomy
and clothing while moving.`,
    ],
    [
      `no style change, no 3D,
no realism, no blood, no watermark, no logo.`,
      `no style change, no 2D flat style,
no simplistic line art, no blood, no watermark, no logo.`,
    ],
    [
      `the
stickman slowly turns his head toward the fire and blinks`,
      `the
character slowly turns his head toward the fire and blinks`,
    ],
    [
      `YouTube thumbnail. Hand-drawn 2D stickman cartoon style: the
character has clean bold black linework and flat bright colors over a detailed,
dramatically lit painted background with depth; bright high-contrast colors and a
clear composition that reads well at small size. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin black eyebrows, simple
mouth, no nose, stick body with single thin black lines for torso, arms and legs,
tiny circle hands, tiny line-end feet, only a small flat garment on the torso, no
trousers, no sleeves, no shoes, no body volume, and must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
      `YouTube thumbnail. Stylized 3D animated movie look: soft rounded 3D characters, soft global illumination, cinematic depth of field, family animation film quality; bright high-contrast colors and a
clear composition that reads well at small size. The character must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
    ],
    [
      `* Usa únicamente el estilo stickman de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje es un stickman verdadero con cuerpo de palito: torso, brazos y
piernas de una sola línea negra delgada. Nunca pantalones, mangas, zapatos ni
volumen corporal. Nunca humanos realistas ni caricaturas detalladas.`,
      `* Usa únicamente el estilo 3D animado de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje mantiene proporciones 3D animadas consistentes: modelado suave,
iluminación global y vestuario definido. Nunca personajes fotorrealistas ni figuras esquemáticas simples.`,
    ],
  ],

  flat: [
    [
      'narrados de YouTube, diseñador de personajes stickman y ingeniero de prompts para',
      'narrados de YouTube, diseñador de personajes de ilustración plana y ingeniero de prompts para',
    ],
    [
      'Tu especialidad es reproducir con exactitud un único estilo visual: stickman 2D\r\ndibujado a mano, educativo, sobre escenarios 2D detallados y bien iluminados.',
      'Tu especialidad es reproducir con exactitud un único estilo visual: ilustración plana\r\nvectorial, educativa, sobre escenarios geométricos y bien diseñados.',
    ],
    [
      '**B. Estilo visual único — Stickman 2D educativo dibujado a mano**',
      '**B. Estilo visual único — Ilustración plana vectorial moderna**',
    ],
    [
      `Técnica:
* Personajes: línea negra limpia y marcada, dibujada a mano, con colores planos.
* Escenarios: ilustración 2D pintada a mano, rica en detalle, con profundidad,
texturas, iluminación ambiental y sombras suaves, como un fondo de animación
profesional.
* El contraste entre el stickman plano y el escenario detallado es parte del estilo.
Personajes (stickman verdadero):
* Cabeza grande, perfectamente redonda y blanca.
* Ojos: dos puntos negros pequeños.
* Cejas finas que transmiten la emoción.
* Boca simple; sin nariz.
* CUERPO DE PALITO (obligatorio en todos los personajes, siempre):
* Torso: una sola línea negra delgada, o una prenda simple y plana que cuelga de
los hombros (túnica, camiseta, vestido) sobre esa línea.
* Brazos y piernas: siempre una sola línea negra delgada, del mismo grosor,
visibles por completo. Nunca cubiertos por mangas ni pantalones.
* Manos: círculos pequeños y simples.
* Pies: terminaciones cortas de la línea o puntos pequeños. Nunca zapatos, botas
ni pies grandes.
* Sin volumen corporal: nunca torso ancho, hombros, caderas, piernas gruesas ni
manos o pies realistas.
* Ropa permitida: solo el cabello, una prenda plana en el torso, accesorios
pequeños (collar, cinturón, sombrero, capa, mochila). Nunca pantalones, mangas,
guantes ni calzado.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la prenda y los accesorios hacen reconocible a
cada personaje (ejemplo: cabello castaño despeinado y túnica de piel con textura
sobre un cuerpo de palito).
* Nunca: humanos realistas, anatomía realista, cuerpos de caricatura detallados,
anime, manga, estilo Pixar o Disney, 3D, fotorrealismo.`,
      `Técnica:
* Personajes: figuras vectoriales estilizadas con formas geométricas limpias, líneas mínimas o sin contorno, paleta armónica y textura de grano sutil.
* Escenarios: fondos geométricos editoriales con capas de profundidad, sombras gráficas mínimas y estética de infografía moderna.
* Coherencia gráfica editorial y minimalista en toda la composición.
Personajes (Ilustración plana):
* Rasgos simplificados y elegantes, ojos geométricos sutiles y expresiones gráficas limpias.
* Formas geométricas limpias, siluetas icónicas y proporciones modernas sin sombreado complejo.
* Ropa plana con bloques de color definidos, accesorios geométricos sencillos.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la vestimenta y los accesorios hacen reconocible a
cada personaje (ejemplo: cabello castaño despeinado y túnica de piel con textura).
* Nunca: figuras esquemáticas simples, humanos realistas, 3D volumétrico, sombreado fotográfico.`,
    ],
    [
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\nstickman.',
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\nde ilustración plana.',
    ],
    [
      `* La ficha describe solo cabello, prenda plana del torso y accesorios
(sección B). Nunca pantalones, mangas, zapatos ni guantes. Ropa moderna se escribe
como prenda plana: a flat light blue t-shirt shape on the stick torso.`,
      `* La ficha describe rasgos, vestimenta y accesorios
(sección B). Ropa moderna se escribe
como prenda plana: a flat vector light blue t-shirt shape with minimal shading.`,
    ],
    [
      `* Ejemplo de forma: a stickman man of about 30 with messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
      `* Ejemplo de forma: a flat vector illustration of a man of about 30 with messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
    ],
    [
      `* Nunca reemplaces a un personaje principal por un stickman genérico ni lo
describas con otras palabras.`,
      `* Nunca reemplaces a un personaje principal por un personaje genérico ni lo
describas con otras palabras.`,
    ],
    [
      `* Personajes de fondo: stickmen simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
      `* Personajes de fondo: personajes secundarios simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
    ],
    [
      `parece a un principal; todos los personajes tienen cuerpo de palito sin
pantalones, mangas ni zapatos; ninguna imagen cubre más de 8–10 palabras del`,
      `parece a un principal; todos los personajes mantienen el estilo de ilustración plana con
rasgos y vestuario consistentes; ninguna imagen cubre más de 8–10 palabras del`,
    ],
    [
      `* Colores vivos y de alto contraste: el stickman plano sobre un fondo detallado e
iluminado de forma dramática.`,
      `* Colores vivos y de alto contraste: la ilustración plana sobre un fondo armónico e
iluminado de forma dramática.`,
    ],
    [
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo stickman.',
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo de ilustración plana.',
    ],
    [
      `Professional 2D stickman character sheet. Simple hand-drawn
2D stickman cartoon style for an educational explainer video: clean bold black
linework, flat colors with minimal soft shading. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin expressive black
eyebrows, simple mouth, no nose. Stick body: the torso is a single thin black line
or a small flat garment shape hanging from the shoulders; arms and legs are always
single thin black lines of equal thickness, fully visible, never covered by
sleeves or trousers; hands are tiny simple circles; feet are tiny short line ends.
Hair, the flat garment and accessories are drawn simply with flat color and light
texture and make the character recognizable. Both hands are always empty: the
character never holds, carries or uses any object in any view or pose. No trousers, no sleeves, no
shoes, no gloves, no thick limbs, no body volume, no realistic hands or feet.`,
      `Professional character sheet. Modern flat vector illustration: geometric shapes, thin or no outlines, limited harmonious palette, subtle grain texture, minimal shading, editorial infographic look. Character design: geometric stylized proportions, minimalist facial features, clean graphic hair and clothing shapes, limited cohesive palette making the character recognizable. Both hands are always empty: the character never holds, carries or uses any object in any view or pose.`,
    ],
    [
      `Never realistic humans, no realistic anatomy, no detailed
cartoon bodies, no anime, no manga, no 3D, no photorealism. No text, no labels, no`,
      `No 3D, no photorealism, no simplistic line art. No text, no labels, no`,
    ],
    [
      `Illustration. Hand-drawn 2D stickman cartoon style for an
educational explainer video. The characters are drawn with clean bold black
linework and flat colors. The environment is a richly detailed hand-painted 2D
illustration with depth, material textures, atmospheric lighting, soft shadows and
cinematic composition, like a professional animated film background. Characters are
true stickmen: large perfectly round white head, tiny black dot eyes, thin
expressive black eyebrows, simple mouth, no nose. Stick body: the torso is a
single thin black line or a small flat garment shape hanging from the shoulders;
arms and legs are always single thin black lines of equal thickness, fully
visible, never covered by sleeves or trousers; hands are tiny simple circles; feet
are tiny short line ends. Hair and the flat garment drawn simply with flat color
and light texture. Main characters keep both hands empty and never hold objects. No trousers, no sleeves, no shoes, no thick limbs, no
body volume, no realistic hands or feet. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
      `Illustration. Modern flat vector illustration: geometric shapes, thin or no outlines, limited harmonious palette, subtle grain texture, minimal shading, editorial infographic look. Main characters keep both hands empty and never hold objects. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
    ],
    [
      'Never realistic humans, no realistic anatomy, no anime, no 3D, no photorealism. No',
      'No 3D, no photorealism, no simplistic line art. No',
    ],
    [
      `* \`[BACKGROUND_CHARACTERS]\` — personajes stickman pequeños de fondo o \`no other
characters\`.`,
      `* \`[BACKGROUND_CHARACTERS]\` — personajes secundarios pequeños de fondo o \`no other
characters\`.`,
    ],
    [
      `Educational explainer illustration, in a simple hand-drawn 2D
stickman cartoon style: pure white background, clean bold black linework, flat
colors with minimal soft shading.`,
      `Educational explainer illustration, in a modern flat vector illustration style: pure white background, geometric shapes, limited harmonious palette.`,
    ],
    [
      `Any character is a true stickman
with a large round white head and a stick body: thin single black lines for torso,
arms and legs, tiny circle hands, tiny line-end feet, only a small flat garment on
the torso; no trousers, no sleeves, no shoes, no body volume. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
      `Any character is drawn in the same flat vector style with consistent proportions and clothing. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
    ],
    [
      `flat
stickman characters with clean black linework over the same detailed painted
environment, lighting, composition and framing.`,
      `modern flat vector
characters with clean geometric shapes over the same editorial
environment, lighting, composition and framing.`,
    ],
    [
      `Stick bodies stay as single thin black
lines while moving: arms and legs never thicken or gain sleeves, trousers or
shoes.`,
      `Characters maintain their consistent flat vector anatomy
and clothing while moving.`,
    ],
    [
      `no style change, no 3D,
no realism, no blood, no watermark, no logo.`,
      `no style change, no 3D,
no realism, no simplistic line art, no blood, no watermark, no logo.`,
    ],
    [
      `the
stickman slowly turns his head toward the fire and blinks`,
      `the
character slowly turns his head toward the fire and blinks`,
    ],
    [
      `YouTube thumbnail. Hand-drawn 2D stickman cartoon style: the
character has clean bold black linework and flat bright colors over a detailed,
dramatically lit painted background with depth; bright high-contrast colors and a
clear composition that reads well at small size. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin black eyebrows, simple
mouth, no nose, stick body with single thin black lines for torso, arms and legs,
tiny circle hands, tiny line-end feet, only a small flat garment on the torso, no
trousers, no sleeves, no shoes, no body volume, and must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
      `YouTube thumbnail. Modern flat vector illustration: geometric shapes, thin or no outlines, limited harmonious palette, subtle grain texture, minimal shading, editorial infographic look; bright high-contrast colors and a
clear composition that reads well at small size. The character must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
    ],
    [
      `* Usa únicamente el estilo stickman de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje es un stickman verdadero con cuerpo de palito: torso, brazos y
piernas de una sola línea negra delgada. Nunca pantalones, mangas, zapatos ni
volumen corporal. Nunca humanos realistas ni caricaturas detalladas.`,
      `* Usa únicamente el estilo de ilustración plana de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje mantiene proporciones de ilustración vectorial plana: formas geométricas limpias,
paleta armónica y vestuario definido. Nunca personajes fotorrealistas ni figuras esquemáticas simples.`,
    ],
  ],

  realistic: [
    [
      'narrados de YouTube, diseñador de personajes stickman y ingeniero de prompts para',
      'narrados de YouTube, diseñador de personajes realistas y ingeniero de prompts para',
    ],
    [
      'Tu especialidad es reproducir con exactitud un único estilo visual: stickman 2D\r\ndibujado a mano, educativo, sobre escenarios 2D detallados y bien iluminados.',
      'Tu especialidad es reproducir con exactitud un único estilo visual: fotorrealismo\r\ncinematográfico, educativo, sobre escenarios realistas y bien iluminados.',
    ],
    [
      '**B. Estilo visual único — Stickman 2D educativo dibujado a mano**',
      '**B. Estilo visual único — Fotorrealismo cinematográfico documental**',
    ],
    [
      `Técnica:
* Personajes: línea negra limpia y marcada, dibujada a mano, con colores planos.
* Escenarios: ilustración 2D pintada a mano, rica en detalle, con profundidad,
texturas, iluminación ambiental y sombras suaves, como un fondo de animación
profesional.
* El contraste entre el stickman plano y el escenario detallado es parte del estilo.
Personajes (stickman verdadero):
* Cabeza grande, perfectamente redonda y blanca.
* Ojos: dos puntos negros pequeños.
* Cejas finas que transmiten la emoción.
* Boca simple; sin nariz.
* CUERPO DE PALITO (obligatorio en todos los personajes, siempre):
* Torso: una sola línea negra delgada, o una prenda simple y plana que cuelga de
los hombros (túnica, camiseta, vestido) sobre esa línea.
* Brazos y piernas: siempre una sola línea negra delgada, del mismo grosor,
visibles por completo. Nunca cubiertos por mangas ni pantalones.
* Manos: círculos pequeños y simples.
* Pies: terminaciones cortas de la línea o puntos pequeños. Nunca zapatos, botas
ni pies grandes.
* Sin volumen corporal: nunca torso ancho, hombros, caderas, piernas gruesas ni
manos o pies realistas.
* Ropa permitida: solo el cabello, una prenda plana en el torso, accesorios
pequeños (collar, cinturón, sombrero, capa, mochila). Nunca pantalones, mangas,
guantes ni calzado.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la prenda y los accesorios hacen reconocible a
cada personaje (ejemplo: cabello castaño despeinado y túnica de piel con textura
sobre un cuerpo de palito).
* Nunca: humanos realistas, anatomía realista, cuerpos de caricatura detallados,
anime, manga, estilo Pixar o Disney, 3D, fotorrealismo.`,
      `Técnica:
* Personajes: personas reales con iluminación cinematográfica natural, profundidad de campo reducida y grano de película sutil.
* Escenarios: locaciones reales y tangibles con materiales auténticos, iluminación verosímil y calidad fotográfica documental.
* Verosimilitud cinematográfica y fidelidad visual creíble.
Personajes (Realista):
* Anatomía humana real, rasgos faciales y expresiones naturales, textura de piel y cabello realistas.
* Proporciones humanas naturales, postura orgánica y presencia convincente en cámara.
* Vestuario realista con arrugas, telas y materiales auténticos de acuerdo con la época y contexto.
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* Los rasgos faciales, vestimenta y accesorios hacen reconocible a
cada personaje (ejemplo: hombre de unos 30 años con cabello castaño despeinado y túnica de piel con textura).
* Nunca: figuras esquemáticas simples, caricaturas, anime, estilos 3D de animación.`,
    ],
    [
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\nstickman.',
      'relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\nrealistas.',
    ],
    [
      `* La ficha describe solo cabello, prenda plana del torso y accesorios
(sección B). Nunca pantalones, mangas, zapatos ni guantes. Ropa moderna se escribe
como prenda plana: a flat light blue t-shirt shape on the stick torso.`,
      `* La ficha describe rasgos, vestimenta y accesorios
(sección B). Ropa moderna se escribe
como prenda realista: a realistic light blue cotton t-shirt with natural fabric wrinkles.`,
    ],
    [
      `* Ejemplo de forma: a stickman man of about 30 with messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
      `* Ejemplo de forma: a realistic man of about 30 with natural features, messy shoulder-length dark
brown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a
small bone necklace and a thin red headband`,
    ],
    [
      `* Nunca reemplaces a un personaje principal por un stickman genérico ni lo
describas con otras palabras.`,
      `* Nunca reemplaces a un personaje principal por un personaje genérico ni lo
describas con otras palabras.`,
    ],
    [
      `* Personajes de fondo: stickmen simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
      `* Personajes de fondo: personajes secundarios simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,
    ],
    [
      `parece a un principal; todos los personajes tienen cuerpo de palito sin
pantalones, mangas ni zapatos; ninguna imagen cubre más de 8–10 palabras del`,
      `parece a un principal; todos los personajes mantienen el estilo realista con
rasgos y vestuario consistentes; ninguna imagen cubre más de 8–10 palabras del`,
    ],
    [
      `* Colores vivos y de alto contraste: el stickman plano sobre un fondo detallado e
iluminado de forma dramática.`,
      `* Colores vivos y de alto contraste: el personaje realista sobre un fondo detallado e
iluminado de forma dramática.`,
    ],
    [
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo stickman.',
      '* `[IMAGEN_REFERENCIA]` — Opcional: imagen de referencia del estilo realista.',
    ],
    [
      `Professional 2D stickman character sheet. Simple hand-drawn
2D stickman cartoon style for an educational explainer video: clean bold black
linework, flat colors with minimal soft shading. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin expressive black
eyebrows, simple mouth, no nose. Stick body: the torso is a single thin black line
or a small flat garment shape hanging from the shoulders; arms and legs are always
single thin black lines of equal thickness, fully visible, never covered by
sleeves or trousers; hands are tiny simple circles; feet are tiny short line ends.
Hair, the flat garment and accessories are drawn simply with flat color and light
texture and make the character recognizable. Both hands are always empty: the
character never holds, carries or uses any object in any view or pose. No trousers, no sleeves, no
shoes, no gloves, no thick limbs, no body volume, no realistic hands or feet.`,
      `Professional character sheet. Photorealistic cinematic style: real people and places, realistic lighting, shallow depth of field, subtle film grain, documentary quality. Character design: natural human anatomy and proportions, lifelike facial features and skin texture, realistic hair, authentic clothing fabrics and textures with recognizable personal accessories. Both hands are always empty: the character never holds, carries or uses any object in any view or pose.`,
    ],
    [
      `Never realistic humans, no realistic anatomy, no detailed
cartoon bodies, no anime, no manga, no 3D, no photorealism. No text, no labels, no`,
      `No cartoon, no anime, no 3D animation, no simplistic line art. No text, no labels, no`,
    ],
    [
      `Illustration. Hand-drawn 2D stickman cartoon style for an
educational explainer video. The characters are drawn with clean bold black
linework and flat colors. The environment is a richly detailed hand-painted 2D
illustration with depth, material textures, atmospheric lighting, soft shadows and
cinematic composition, like a professional animated film background. Characters are
true stickmen: large perfectly round white head, tiny black dot eyes, thin
expressive black eyebrows, simple mouth, no nose. Stick body: the torso is a
single thin black line or a small flat garment shape hanging from the shoulders;
arms and legs are always single thin black lines of equal thickness, fully
visible, never covered by sleeves or trousers; hands are tiny simple circles; feet
are tiny short line ends. Hair and the flat garment drawn simply with flat color
and light texture. Main characters keep both hands empty and never hold objects. No trousers, no sleeves, no shoes, no thick limbs, no
body volume, no realistic hands or feet. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
      `Illustration. Photorealistic cinematic style: real people and places, realistic lighting, shallow depth of field, subtle film grain, documentary quality. Main characters keep both hands empty and never hold objects. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,
    ],
    [
      'Never realistic humans, no realistic anatomy, no anime, no 3D, no photorealism. No',
      'No cartoon, no anime, no 3D animation, no simplistic line art. No',
    ],
    [
      `* \`[BACKGROUND_CHARACTERS]\` — personajes stickman pequeños de fondo o \`no other
characters\`.`,
      `* \`[BACKGROUND_CHARACTERS]\` — personajes secundarios pequeños de fondo o \`no other
characters\`.`,
    ],
    [
      `Educational explainer illustration, in a simple hand-drawn 2D
stickman cartoon style: pure white background, clean bold black linework, flat
colors with minimal soft shading.`,
      `Educational explainer illustration, in a photorealistic cinematic style: pure white studio background, realistic lighting and textures.`,
    ],
    [
      `Any character is a true stickman
with a large round white head and a stick body: thin single black lines for torso,
arms and legs, tiny circle hands, tiny line-end feet, only a small flat garment on
the torso; no trousers, no sleeves, no shoes, no body volume. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
      `Any character is drawn in the same realistic style with consistent proportions and clothing. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,
    ],
    [
      `flat
stickman characters with clean black linework over the same detailed painted
environment, lighting, composition and framing.`,
      `photorealistic
characters with natural cinematic lighting over the same authentic
environment, lighting, composition and framing.`,
    ],
    [
      `Stick bodies stay as single thin black
lines while moving: arms and legs never thicken or gain sleeves, trousers or
shoes.`,
      `Characters maintain their natural human anatomy
and clothing while moving.`,
    ],
    [
      `no style change, no 3D,
no realism, no blood, no watermark, no logo.`,
      `no style change, no cartoon, no anime,
no simplistic line art, no blood, no watermark, no logo.`,
    ],
    [
      `the
stickman slowly turns his head toward the fire and blinks`,
      `the
character slowly turns his head toward the fire and blinks`,
    ],
    [
      `YouTube thumbnail. Hand-drawn 2D stickman cartoon style: the
character has clean bold black linework and flat bright colors over a detailed,
dramatically lit painted background with depth; bright high-contrast colors and a
clear composition that reads well at small size. The character is a true stickman:
large perfectly round white head, tiny black dot eyes, thin black eyebrows, simple
mouth, no nose, stick body with single thin black lines for torso, arms and legs,
tiny circle hands, tiny line-end feet, only a small flat garment on the torso, no
trousers, no sleeves, no shoes, no body volume, and must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
      `YouTube thumbnail. Photorealistic cinematic style: real people and places, realistic lighting, shallow depth of field, subtle film grain, documentary quality; bright high-contrast colors and a
clear composition that reads well at small size. The character must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
    ],
    [
      `* Usa únicamente el estilo stickman de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje es un stickman verdadero con cuerpo de palito: torso, brazos y
piernas de una sola línea negra delgada. Nunca pantalones, mangas, zapatos ni
volumen corporal. Nunca humanos realistas ni caricaturas detalladas.`,
      `* Usa únicamente el estilo realista de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje mantiene proporciones anatómicas humanas reales: iluminación natural,
texturas realistas y vestuario auténtico. Nunca caricaturas, anime ni figuras esquemáticas simples.`,
    ],
  ],
};

const BASE_FROM_STRINGS = STYLE_REPLACEMENTS.cartoon.map(([from]) => from);
setDefaultFromStrings(BASE_FROM_STRINGS);

for (const spec of NEW_STYLE_SPECS) {
  STYLE_REPLACEMENTS[spec.id] = buildStyleReplacements(spec, BASE_FROM_STRINGS);
}

function replaceSubstring(text, from, to) {
  if (typeof text !== 'string') return '';
  if (text.includes(from)) {
    return text.replaceAll(from, to);
  }
  if (from.includes('\r\n') && !text.includes('\r\n')) {
    const lfFrom = from.replaceAll('\r\n', '\n');
    const lfTo = to.replaceAll('\r\n', '\n');
    if (text.includes(lfFrom)) {
      return text.replaceAll(lfFrom, lfTo);
    }
  } else if (!from.includes('\r\n') && text.includes('\r\n')) {
    const crlfFrom = from.replaceAll(/(?<!\r)\n/g, '\r\n');
    const crlfTo = to.replaceAll(/(?<!\r)\n/g, '\r\n');
    if (text.includes(crlfFrom)) {
      return text.replaceAll(crlfFrom, crlfTo);
    }
  }
  return text;
}

export function applyStyle(promptText, styleId) {
  if (typeof promptText !== 'string') return '';
  const resolved = getStyle(styleId);
  if (!resolved || resolved.id === DEFAULT_STYLE_ID) {
    return promptText;
  }

  const replacements = STYLE_REPLACEMENTS[resolved.id];
  if (!replacements || !Array.isArray(replacements)) {
    return promptText;
  }

  let result = promptText;
  for (const [from, to] of replacements) {
    result = replaceSubstring(result, from, to);
  }

  return result;
}
