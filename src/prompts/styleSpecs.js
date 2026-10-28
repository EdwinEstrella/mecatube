// Specifications for the 20 new visual styles and replacement builder.
// Generates exact replacement pairs for prompt-2.txt transformations.

let defaultFromStrings = null;

export function setDefaultFromStrings(strings) {
  defaultFromStrings = strings;
}

export function buildStyleReplacements(spec, baseFromStrings = defaultFromStrings) {
  const from = baseFromStrings || defaultFromStrings;
  if (!from || !Array.isArray(from) || from.length < 25) {
    throw new Error(`Base from strings required for buildStyleReplacements (${spec?.id})`);
  }

  const to = [
    // 0: role
    `narrados de YouTube, diseñador de personajes ${spec.roleNoun} y ingeniero de prompts para`,

    // 1: specialty
    `Tu especialidad es reproducir con exactitud un único estilo visual: ${spec.specialtyLine}`,

    // 2: section B title
    `**B. Estilo visual único — ${spec.sectionBTitle}**`,

    // 3: technique & characters block
    spec.charactersAndBackgroundsBlock || `Técnica:
${spec.techniqueBullets}
Personajes (${spec.charactersHeading}):
${spec.characterBullets}
* Manos vacías: el personaje principal nunca sostiene objetos en las manos
(micrófono, lupa, lanza, libro, herramienta, arma, taza). Ni en la hoja de
personaje ni en las escenas, animaciones o miniatura. Gesticula, señala o
interactúa con el entorno con las manos libres.
* El cabello, la vestimenta y los accesorios hacen reconocible a
cada personaje (${spec.clothingExample || 'ejemplo: cabello castaño despeinado y túnica de piel con textura'}).
* Nunca: ${spec.neverLine}.`,

    // 4: props
    `relojes de arena, esqueletos, mapas, herramientas o los mismos personajes\r\n${spec.propsNoun}.`,

    // 5: shirt
    `* La ficha describe rasgos, vestimenta y accesorios
(sección B). Ropa moderna se escribe
como prenda ${spec.shirtNoun}: ${spec.shirtExample}`,

    // 6: form example
    `* Ejemplo de forma: ${spec.formExample}`,

    // 7: generic character (constant)
    `* Nunca reemplaces a un personaje principal por un personaje genérico ni lo
describas con otras palabras.`,

    // 8: background characters (constant)
    `* Personajes de fondo: personajes secundarios simples que no comparten el cabello, la ropa ni
los colores de los personajes principales, para que nunca se confundan con ellos.`,

    // 9: consistency
    `parece a un principal; todos los personajes mantienen el estilo ${spec.consistencyPhrase} con
rasgos y vestuario consistentes; ninguna imagen cubre más de 8–10 palabras del`,

    // 10: contrast
    spec.contrastLine || `* Colores vivos y de alto contraste: ${spec.contrastPhrase} sobre un fondo detallado e
iluminado de forma dramática.`,

    // 11: reference
    `* \`[IMAGEN_REFERENCIA]\` — Opcional: imagen de referencia del estilo ${spec.referencePhrase}.`,

    // 12: character sheet description
    spec.characterSheetFull || `Professional character sheet. ${spec.englishDescription}. Character design: ${spec.characterSheetDetails}. Both hands are always empty: the character never holds, carries or uses any object in any view or pose.`,

    // 13: negative prompt stage 2 / section B
    `${spec.negativePromptSectionB}. No text, no labels, no`,

    // 14: illustration description
    spec.illustrationFull || `Illustration. ${spec.englishDescription}. Main characters keep both hands empty and never hold objects. Each main character must match its
character sheet reference exactly: same head, face, proportions, hair, clothing,
colors and accessories.`,

    // 15: negative prompt stage 3
    `${spec.negativePromptStage3 || spec.negativePromptSectionB}. No`,

    // 16: background characters placeholder note (constant)
    `* \`[BACKGROUND_CHARACTERS]\` — personajes secundarios pequeños de fondo o \`no other
characters\`.`,

    // 17: explainer description
    `Educational explainer illustration, in a ${spec.explainerDescription}`,

    // 18: explainer characters
    `Any character is drawn in ${spec.explainerCharacterPhrase}. Each main character
must match its character sheet reference exactly: same head, face, proportions,
hair, clothing, colors and accessories, with empty hands.`,

    // 19: animation look & environment
    `${spec.animationLookPhrase} over the same ${spec.animationEnvPhrase}
environment, lighting, composition and framing.`,

    // 20: anatomy movement
    `Characters maintain their ${spec.anatomyMovementPhrase}
and clothing while moving.`,

    // 21: negative prompt animation
    `${spec.negativePromptAnimation},
no simplistic line art, no blood, no watermark, no logo.`,

    // 22: blinks (constant)
    `the
character slowly turns his head toward the fire and blinks`,

    // 23: thumbnail
    spec.thumbnailFull || `YouTube thumbnail. ${spec.englishDescription}; bright high-contrast colors and a
clear composition that reads well at small size. The character must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,

    // 24: summary rule
    `* Usa únicamente el estilo ${spec.knowledgeBaseStylePhrase} de la Base de Conocimiento. No mezcles otros
estilos.
* Todo personaje mantiene proporciones ${spec.characterSummaryPhrase}: ${spec.characterSummaryDetail}. Nunca ${spec.characterSummaryNever}.`,
  ];

  return from.map((f, i) => [f, to[i]]);
}

export const NEW_STYLE_SPECS = [
  // ---------------------------------------------------------------------------
  // Cinematográficos
  // ---------------------------------------------------------------------------
  {
    id: 'cine-realista',
    label: 'Cine realista',
    category: 'Cinematográficos',
    idealFor: 'Historias, documental',
    description: 'Video de cine realista, iluminación cinematográfica, profundidad de campo y gran calidad',
    englishDescription: 'Realistic cinematic movie style: high-end cinema lighting, natural depth of field, realistic human anatomy, subtle camera motion blur, documentary and feature film production quality',
    roleNoun: 'de cine realista',
    specialtyLine: 'cine realista\r\ncinematográfico, educativo, sobre escenarios reales y cinematográficos bien iluminados.',
    sectionBTitle: 'Cine realista cinematográfico de alta producción',
    techniqueBullets: `* Personajes: seres humanos de aspecto realista con anatomía natural, expresiones sutiles y presencia cinematográfica auténtica.
* Escenarios: entornos cinematográficos reales o fotorrealistas con iluminación de set de cine, profundidad de campo óptica y texturas auténticas.
* Atmósfera visual de documental o película de gran producción cinematográfica.`,
    charactersHeading: 'Cine realista',
    characterBullets: `* Rasgos faciales naturales, piel realista y ojos expresivos sin exageración de caricatura.
* Anatomía humana real con proporciones creíbles y vestuario de materiales y texturas auténticas.
* Iluminación de cine con luz principal, de relleno y contraluz suave.`,
    clothingExample: 'ejemplo: cabello castaño natural y túnica de tela auténtica',
    neverLine: 'caricaturas, anime, personajes 3D estilizados, figuras esquemáticas simples',
    propsNoun: 'de cine realista',
    shirtNoun: 'cinematográfica realista',
    shirtExample: 'a realistic light blue cotton t-shirt with natural fabric wrinkles.',
    formExample: 'a realistic cinematic man of about 30 with natural features, messy shoulder-length dark\nbrown hair, wearing a ragged brown fur tunic tied with a thin leather cord, a\nsmall bone necklace and a thin red headband',
    consistencyPhrase: 'cine realista',
    contrastPhrase: 'el personaje de cine realista',
    referencePhrase: 'cine realista cinematográfico',
    characterSheetDetails: 'natural human anatomy and proportions, lifelike facial features, realistic hair styling, authentic textiles and recognizable personal accessories',
    negativePromptSectionB: 'No cartoon, no anime, no 3D animation, no simplistic line art',
    explainerDescription: 'photorealistic cinematic style: pure white studio background, realistic film lighting and textures.',
    explainerCharacterPhrase: 'the same realistic cinematic style with natural human proportions and clothing',
    animationLookPhrase: 'realistic cinematic\ncharacters with natural film lighting',
    animationEnvPhrase: 'cinematic production',
    anatomyMovementPhrase: 'natural human anatomy',
    negativePromptAnimation: 'no style change, no cartoon, no anime',
    knowledgeBaseStylePhrase: 'cine realista',
    characterSummaryPhrase: 'anatómicas humanas reales',
    characterSummaryDetail: 'iluminación cinematográfica, texturas realistas y vestuario auténtico',
    characterSummaryNever: 'caricaturas, anime ni figuras esquemáticas simples',
  },
  {
    id: 'cine-negro',
    label: 'Cine negro',
    category: 'Cinematográficos',
    idealFor: 'Misterio, historia',
    description: 'Noir en blanco y negro, alto contraste, sombras dramáticas, detective y grano de película',
    englishDescription: 'Black-and-white film noir style: dramatic high-contrast chiaroscuro lighting, deep shadows, venetian blind light patterns, gritty film grain, elegant vintage detective atmosphere',
    roleNoun: 'de cine negro',
    specialtyLine: 'cine negro\r\nnoir, dramático, sobre escenarios oscuros con alto contraste y sombras marcadas.',
    sectionBTitle: 'Cine negro noir clásico en blanco y negro',
    techniqueBullets: `* Personajes: estética noir en riguroso blanco y negro, rostros iluminados por claroscuros marcados y siluetas elegantes.
* Escenarios: calles húmedas, callejones sombríos, oficinas con persianas venecianas y niebla nocturna cinematográfica.
* Alto contraste dramático entre sombras profundas y luces duras en escala de grises.`,
    charactersHeading: 'Cine negro',
    characterBullets: `* Rostros con sombras teatrales duras, expresiones intensas de novela detectivesca en blanco y negro.
* Gabardinas, sombreros fedora, trajes clásicos de época y siluetas estilizadas en rigurosa escala de grises.
* Grano de película vintage visible y elegancia clásica en blanco y negro.`,
    clothingExample: 'ejemplo: sombrero fedora, gabardina oscura y expresión decidida en blanco y negro',
    neverLine: 'colores vivos, saturación de color, caricaturas infantiles, 3D brillante, figuras esquemáticas simples',
    propsNoun: 'noir en blanco y negro',
    shirtNoun: 'noir clásica',
    shirtExample: 'a monochrome vintage t-shirt in stark black and white lighting.',
    formExample: 'a film noir detective man of about 30 in black and white with intense shadowed eyes, dark\nmessy hair, wearing a dark trench tunic tied with a leather cord, a\nsmall bone pendant and a dark headband',
    consistencyPhrase: 'cine negro en blanco y negro',
    contrastLine: `* Alto contraste en blanco y negro: el personaje noir en claroscuro sobre un fondo detallado e
iluminado de forma dramática.`,
    referencePhrase: 'cine negro noir',
    characterSheetDetails: 'monochrome film noir character design, sharp chiaroscuro facial shading, high-contrast black-and-white tones, period clothing and moody silhouette',
    negativePromptSectionB: 'No color, no vibrant palette, no cartoon, no 3D animation, no simplistic line art',
    explainerDescription: 'monochrome film noir style: clean stark white background with dramatic black ink shadows, high-contrast monochrome tones.',
    explainerCharacterPhrase: 'the same monochrome film noir look with dramatic chiaroscuro shading and period clothing',
    animationLookPhrase: 'monochrome film noir\ncharacters with deep chiaroscuro shadows',
    animationEnvPhrase: 'shadowy atmospheric noir',
    anatomyMovementPhrase: 'consistent film noir anatomy',
    negativePromptAnimation: 'no color, no vibrant colors, no style change, no 3D animation',
    thumbnailFull: `YouTube thumbnail. Black-and-white film noir style: dramatic high-contrast chiaroscuro lighting, deep shadows, venetian blind light patterns, gritty film grain, elegant vintage detective atmosphere; dramatic high-contrast black-and-white tones and a
clear composition that reads well at small size. The character must match its character sheet
reference exactly: same head, face, proportions, hair, clothing, colors,
accessories, with empty hands.`,
    knowledgeBaseStylePhrase: 'cine negro',
    characterSummaryPhrase: 'noir en blanco y negro consistentes',
    characterSummaryDetail: 'alto contraste en claroscuro, sombras profundas y estética de época en escala de grises',
    characterSummaryNever: 'colores, caricaturas ni figuras esquemáticas simples',
  },
  {
    id: 'neon-futurista',
    label: 'Neón futurista',
    category: 'Cinematográficos',
    idealFor: 'Tecnología, futuro',
    description: '3D futurista con luces neón brillantes, reflejos de lluvia y atmósfera oscura e intensa',
    englishDescription: 'Futuristic cyberpunk 3D style: glowing vibrant neon lights, wet rain-slicked pavement reflections, holographic displays, dark moody atmospheric cinematic lighting',
    roleNoun: 'neón futurista',
    specialtyLine: 'neón futurista\r\ncyberpunk 3D, atmosférico, sobre escenarios oscuros iluminados por luces de neón y hologramas.',
    sectionBTitle: 'Neón futurista 3D cyberpunk de alta intensidad',
    techniqueBullets: `* Personajes: modelos 3D futuristas con sutiles acentos cibernéticos, siluetas marcadas y reflejos de luces de neón en ropa y piel.
* Escenarios: metrópolis nocturnas futuristas, lluvia, asfalto mojado con reflejos resplandecientes, pantallas holográficas y cables urbanos.
* Paleta nocturna oscura dominada por contrastes de magenta, cian, púrpura y azul eléctrico resplandeciente.`,
    charactersHeading: 'Neón futurista',
    characterBullets: `* Rasgos definidos iluminados por resplandores laterales de neón en tonos cian y magenta.
* Indumentaria urbana futurista, telas técnicas, detalles lumínicos y accesorios tecnológicos sutiles.
* Iluminación volumétrica con niebla iluminada por neones y reflejos especulares húmedos.`,
    clothingExample: 'ejemplo: cabello oscuro con reflejos cian y chaqueta técnica con ribetes fluorescentes',
    neverLine: 'estilo retro sepia, caricaturas infantiles, dibujo esquemático, figuras esquemáticas simples',
    propsNoun: 'neón futuristas',
    shirtNoun: 'futurista de neón',
    shirtExample: 'a high-tech dark t-shirt with subtle glowing neon trim and fiber optics.',
    formExample: 'a futuristic cyberpunk man of about 30 illuminated by cyan and magenta rim light, messy dark\nbrown hair, wearing a dark technical tunic tied with a luminescent cord, a\nsmall metallic pendant and a glowing cyan headband',
    consistencyPhrase: 'neón futurista 3D',
    contrastPhrase: 'el personaje de neón futurista con resplandores luminosos',
    referencePhrase: 'neón futurista cyberpunk',
    characterSheetDetails: 'futuristic 3D cyberpunk character design, moody ambient lighting with vivid neon rim highlights, techwear clothing details and sleek silhouette',
    negativePromptSectionB: 'No bright daylight, no vintage sepia, no cartoon, no simplistic line art',
    explainerDescription: 'futuristic neon style: clean dark background with crisp vibrant glowing neon outlines and holographic accents.',
    explainerCharacterPhrase: 'the same futuristic neon 3D style with consistent glowing rim lights and technical apparel',
    animationLookPhrase: 'futuristic 3D\ncharacters with vibrant glowing neon rim lighting',
    animationEnvPhrase: 'rain-slicked cyberpunk',
    anatomyMovementPhrase: 'consistent futuristic 3D anatomy',
    negativePromptAnimation: 'no daylight style change, no flat cartoon, no simplistic line art',
    knowledgeBaseStylePhrase: 'neón futurista',
    characterSummaryPhrase: '3D futuristas consistentes',
    characterSummaryDetail: 'iluminación de neón cian y magenta, reflejos luminosos y vestuario cyberpunk',
    characterSummaryNever: 'estilo vintage, caricaturas planas ni figuras esquemáticas simples',
  },
  {
    id: 'poster-vintage',
    label: 'Póster vintage',
    category: 'Cinematográficos',
    idealFor: 'Viajes, curiosidades',
    description: 'Póster de viaje nostálgico, ilustración retro, tonos sepia cálidos y publicidad clásica',
    englishDescription: 'Vintage travel poster style: nostalgic mid-century retro illustration, warm sepia and muted earthy tones, clean screen-print textures, classic advertising aesthetics',
    roleNoun: 'de póster vintage',
    specialtyLine: 'póster vintage\r\nretro, nostálgico, sobre escenarios ilustrados con tonos cálidos y estética de publicidad clásica.',
    sectionBTitle: 'Póster vintage nostálgico e ilustración retro clásica',
    techniqueBullets: `* Personajes: ilustración estilizada de mediados de siglo XX, líneas elegantes, sombreado sutil con tramas y texturas de imprenta litográfica.
* Escenarios: paisajes evocadores, monumentos majestuosos y cielos en degradado con atmósfera dorada de vacaciones nostálgicas.
* Paleta cálida y envejecida: tonos sepia, ocre, mostaza, azul marino apagado y verde oliva con textura de papel de grabado.`,
    charactersHeading: 'Póster vintage',
    characterBullets: `* Siluetas esbeltas y elegantes con estética de cartelismo publicitario clásico de mediados de siglo.
* Vestuario de explorador, viajero o ropa clásica con pliegues limpios y estilizados.
* Textura de impresión serigráfica con ligeras imperfecciones de tinta vintage.`,
    clothingExample: 'ejemplo: peinado retro clásico y túnica en tonos sepia y cuero envejecido',
    neverLine: '3D moderno brillante, luces de neón cyberpunk, anime moderno, figuras esquemáticas simples',
    propsNoun: 'de póster vintage',
    shirtNoun: 'vintage de cartel',
    shirtExample: 'a screen-printed vintage light blue t-shirt with retro muted color palette.',
    formExample: 'a vintage poster illustrated man of about 30 in elegant mid-century retro style, messy shoulder-length dark\nbrown hair, wearing a warm sepia fur tunic tied with a woven cord, a\nsmall bone necklace and a muted red headband',
    consistencyPhrase: 'póster vintage',
    contrastPhrase: 'el personaje de póster vintage sobre un paisaje retro',
    referencePhrase: 'póster vintage retro',
    characterSheetDetails: 'vintage mid-century travel poster illustration, screen-printed textures, muted nostalgic earth tones, retro graphic clothing and classic adventurer silhouette',
    negativePromptSectionB: 'No modern 3D, no neon, no photorealism, no anime, no simplistic line art',
    explainerDescription: 'vintage travel poster style: warm aged parchment background, clean retro screen-print ink outlines, muted vintage palette.',
    explainerCharacterPhrase: 'the same vintage retro poster illustration style with consistent mid-century proportions and clothing',
    animationLookPhrase: 'vintage mid-century\nposter characters with warm screen-print textures',
    animationEnvPhrase: 'nostalgic retro travel',
    anatomyMovementPhrase: 'consistent retro poster anatomy',
    negativePromptAnimation: 'no modern 3D, no neon glow, no style change, no simplistic line art',
    knowledgeBaseStylePhrase: 'póster vintage',
    characterSummaryPhrase: 'de cartel retro consistentes',
    characterSummaryDetail: 'tonos sepia cálidos, textura serigráfica y elegancia publicitaria clásica',
    characterSummaryNever: 'neón moderno, 3D brillante ni figuras esquemáticas simples',
  },

  // ---------------------------------------------------------------------------
  // Animación 3D
  // ---------------------------------------------------------------------------
  {
    id: '3d-pelicula',
    label: '3D de película',
    category: 'Animación 3D',
    idealFor: 'Cuentos, fe, infantil',
    description: 'Animación 3D vibrante, personajes expresivos, iluminación perfecta y cámara de cine',
    englishDescription: 'Vibrant 3D animated feature film style: highly expressive character design, cinematic studio lighting with soft fill, emotional storytelling atmosphere, premium animation studio quality',
    roleNoun: 'de 3D de película',
    specialtyLine: '3D de película\r\nvibrante, cinematográfico, sobre escenarios 3D ricos en iluminación y calidez de largometraje animado.',
    sectionBTitle: 'Animación 3D de película cinematográfica de gran calidad',
    techniqueBullets: `* Personajes: modelos 3D estilizados de nivel de largometraje animado, ojos grandes brillantes y expresivos, piel con sub-surface scattering suave.
* Escenarios: escenarios 3D detallados con iluminación global cinematográfica, efectos de atmósfera cálida y lentes de cámara de cine.
* Riqueza emotiva en la composición, luz suave de atardecer o estudio y acabados de gran producción.`,
    charactersHeading: '3D de película',
    characterBullets: `* Modelado 3D carismático con expresiones faciales profundas y emotivas de película familiar.
* Pelo estilizado con textura y volumen suave, ropa con tejidos creíbles y caída natural.
* Iluminación cinematográfica completa con luz de recorte cálida y sombras suaves.`,
    clothingExample: 'ejemplo: cabello castaño estilizado con volumen y túnica de lana cálida con textura',
    neverLine: 'figuras esquemáticas simples, dibujo 2D plano, fotorrealismo humano inquietante, stop motion rudo',
    propsNoun: '3D de película',
    shirtNoun: '3D de película',
    shirtExample: 'a premium stylized 3D animated light blue t-shirt with soft woven cotton texture.',
    formExample: 'a vibrant 3D animated movie man of about 30 with expressive eyes, messy shoulder-length stylized dark\nbrown hair, wearing a ragged brown fur tunic tied with a leather cord, a\nsmall bone necklace and a thin red headband',
    consistencyPhrase: '3D de película animada',
    contrastPhrase: 'el personaje 3D animado de película',
    referencePhrase: '3D de película animada',
    characterSheetDetails: 'feature animation 3D character design, expressive facial features, smooth stylized hair grooms, tactile clothing materials and cinematic lighting',
    negativePromptSectionB: 'No 2D flat drawing, no live-action photorealism, no simplistic line art',
    explainerDescription: 'vibrant 3D movie animation style: pure white background, soft global illumination, rounded 3D models with gentle contact shadows.',
    explainerCharacterPhrase: 'the same vibrant 3D animated movie look with consistent proportions and clothing',
    animationLookPhrase: 'vibrant 3D animated\ncharacters with cinematic studio lighting',
    animationEnvPhrase: 'rich cinematic 3D',
    anatomyMovementPhrase: 'consistent 3D feature animation anatomy',
    negativePromptAnimation: 'no 2D flat style, no live-action realism, no simplistic line art',
    knowledgeBaseStylePhrase: '3D de película',
    characterSummaryPhrase: '3D de largometraje consistentes',
    characterSummaryDetail: 'modelado estilizado expresivo, iluminación global suave y texturas de alta calidad',
    characterSummaryNever: 'figuras 2D planas, fotorrealismo frío ni figuras esquemáticas simples',
  },
  {
    id: 'plastilina',
    label: 'Plastilina',
    category: 'Animación 3D',
    idealFor: 'Humor, cuentos cortos',
    description: 'Plastilina con huellas visibles, personajes expresivos, luz cálida y stop motion fluido',
    englishDescription: 'Claymation clay stop-motion style: sculpted plasticine characters with visible fingerprint textures, tactile clay figures, warm cozy studio lighting, playful tactile handcrafted feel',
    roleNoun: 'de animación en plastilina',
    specialtyLine: 'plastilina stop motion\r\nartesanal, táctil, sobre maquetas en miniatura con iluminación cálida de estudio.',
    sectionBTitle: 'Plastilina artesanal stop motion táctil',
    techniqueBullets: `* Personajes: figuras modeladas a mano en plastilina o arcilla polimérica con huellas dactilares sutiles visibles y formas suaves y maleables.
* Escenarios: maquetas hechas a mano con materiales táctiles, cartón, fieltro, madera y elementos en miniatura iluminados con luz de foco cálido.
* Estética de animación stop motion entrañable con imperfecciones artesanales encantadoras.`,
    charactersHeading: 'Plastilina',
    characterBullets: `* Ojos de bolita brillante o arcilla con párpados moldeados, bocas modeladas con expresividad cómica.
* Cuerpos de plastilina con volumen táctil, extremidades moldeadas sin esqueletos realistas.
* Ropa y accesorios esculpidos en capas de plastilina de colores vivos con bordes redondeados.`,
    clothingExample: 'ejemplo: cabello moldeado en mechones de plastilina castaña y túnica de arcilla marrón',
    neverLine: 'modelado digital 3D hiper-limpio, fotorrealismo humano, dibujos 2D planos, figuras esquemáticas simples',
    propsNoun: 'modelados en plastilina',
    shirtNoun: 'de plastilina',
    shirtExample: 'a sculpted claymation light blue t-shirt with soft clay seams and subtle thumbprints.',
    formExample: 'a claymation stop-motion man of about 30 sculpted in plasticine with lively round eyes, messy dark\nbrown clay hair, wearing a ragged brown clay tunic with finger-molded textures, a\nsmall clay bone necklace and a red clay headband',
    consistencyPhrase: 'plastilina stop motion',
    contrastPhrase: 'el personaje de plastilina táctil',
    referencePhrase: 'plastilina stop motion',
    characterSheetDetails: 'sculpted plasticine stop-motion character design, tactile clay thumbprints, expressive clay facial sculpt, rounded handmade proportions and cozy studio lighting',
    negativePromptSectionB: 'No CGI digital smoothness, no 2D flat drawing, no live action, no simplistic line art',
    explainerDescription: 'claymation stop-motion style: pure white tabletop background, tactile sculpted clay models with soft physical contact shadows.',
    explainerCharacterPhrase: 'the same tactile claymation style with consistent sculpted proportions and clothing',
    animationLookPhrase: 'sculpted claymation\ncharacters with tactile plasticine textures',
    animationEnvPhrase: 'handcrafted miniature stop-motion',
    anatomyMovementPhrase: 'consistent sculpted clay anatomy',
    negativePromptAnimation: 'no smooth CGI, no 2D flat drawing, no simplistic line art',
    knowledgeBaseStylePhrase: 'plastilina',
    characterSummaryPhrase: 'de plastilina modelada consistentes',
    characterSummaryDetail: 'textura táctil de arcilla con huellas visibles, formas maleables y luz cálida de taller',
    characterSummaryNever: 'CGI pulido frío, dibujo 2D plano ni figuras esquemáticas simples',
  },
  {
    id: '3d-pastel',
    label: '3D suave pastel',
    category: 'Animación 3D',
    idealFor: 'Productos, tips',
    description: '3D suave con formas orgánicas, sombras delicadas, colores pastel y toque amigable táctil',
    englishDescription: 'Soft 3D pastel style: gentle squishy organic shapes, delicate diffused shadows, soothing pastel color palette, friendly tactile matte surfaces and clean minimalist design',
    roleNoun: 'de 3D suave pastel',
    specialtyLine: '3D suave pastel\r\namigable, táctil, sobre escenarios limpios con iluminación difusa y paleta pastel relajante.',
    sectionBTitle: '3D suave pastel con formas orgánicas y diseño amigable',
    techniqueBullets: `* Personajes: modelado 3D suave con bordes curvados y redondeados, materiales mate aterciopelados y proporciones tiernas y amigables.
* Escenarios: entornos minimalistas limpios con geometrías orgánicas simples, iluminación difusa suave y sombras casi imperceptibles.
* Paleta de colores pastel armoniosa: tonos menta, melocotón, lavanda, crema y azul cielo sereno.`,
    charactersHeading: '3D suave pastel',
    characterBullets: `* Formas blanditas y redondeadas sin aristas vivas, expresiones faciales dulces, minimalistas y alegres.
* Siluetas limpias y táctiles con acabados mate de tacto gomoso o cerámica suave.
* Vestuario simple con formas redondeadas en tonos pastel suaves.`,
    clothingExample: 'ejemplo: cabello castaño suavemente redondeado y túnica en tono marrón pastel suave',
    neverLine: 'luces oscuras dramáticas, texturas ásperas o sucias, violencia, figuras esquemáticas simples',
    propsNoun: '3D en tonos pastel',
    shirtNoun: '3D pastel',
    shirtExample: 'a smooth rounded matte 3D pastel blue t-shirt with soft pillowy volume.',
    formExample: 'a cute soft 3D pastel man of about 30 with gentle rounded features, soft dark\nbrown hair shapes, wearing a warm soft pastel brown tunic, a\nsmall stylized pendant and a gentle red headband',
    consistencyPhrase: '3D suave pastel',
    contrastPhrase: 'el personaje 3D pastel sobre un fondo armónico',
    referencePhrase: '3D suave pastel',
    characterSheetDetails: 'soft organic 3D character design, matte velvety materials, delicate pastel color palette, pillowy rounded features and serene ambient lighting',
    negativePromptSectionB: 'No dark gritty textures, no sharp harsh edges, no harsh shadows, no simplistic line art',
    explainerDescription: 'soft 3D pastel style: pure white background, gentle pillowy rounded 3D shapes with delicate diffused pastel shadows.',
    explainerCharacterPhrase: 'the same soft 3D pastel style with consistent pillowy proportions and clothing',
    animationLookPhrase: 'soft organic 3D\ncharacters with diffused pastel lighting',
    animationEnvPhrase: 'clean minimalist pastel 3D',
    anatomyMovementPhrase: 'consistent soft rounded 3D anatomy',
    negativePromptAnimation: 'no dark gritty look, no sharp edges, no simplistic line art',
    knowledgeBaseStylePhrase: '3D suave pastel',
    characterSummaryPhrase: '3D orgánicas suaves consistentes',
    characterSummaryDetail: 'formas blanditas redondeadas, acabado mate aterciopelado y paleta de colores pastel',
    characterSummaryNever: 'sombras oscuras duras, realismo tosco ni figuras esquemáticas simples',
  },
  {
    id: 'low-poly',
    label: 'Low poly',
    category: 'Animación 3D',
    idealFor: 'Gaming, tecnología',
    description: '3D con figuras geométricas facetadas, colores vivos y estética de videojuego moderno',
    englishDescription: 'Low-poly 3D geometric style: faceted polygonal meshes with flat shaded faces, sharp geometric edges, vibrant saturated color scheme, modern indie video game aesthetic',
    roleNoun: 'de low poly 3D',
    specialtyLine: 'low poly 3D\r\ngeométrico, facetado, sobre escenarios poligonales limpios con iluminación dinámica de videojuego.',
    sectionBTitle: 'Low poly 3D geométrico facetado y moderno',
    techniqueBullets: `* Personajes: modelos 3D con mallas poligonales facetadas visibles de bajo número de polígonos, caras planas sin suavizado artificial y aristas nítidas.
* Escenarios: paisajes geométricos angulares con árboles piramidales, rocas poliédricas y agua facetada con reflejos de luz plana.
* Colores vivos y saturados con iluminación de sol angular y sombras geométricas limpias.`,
    charactersHeading: 'Low poly',
    characterBullets: `* Figuras humanas o criaturas estilizadas compuestas por polígonos planos geométricos facetados reconocibles.
* Rasgos faciales geométricos angulares con ojos simples y cabello modelado en bloques poligonales.
* Ropa y vestuario compuesto por planos geométricos definidos con colores sólidos por cara.`,
    clothingExample: 'ejemplo: cabello modelado en prismas castaños y túnica de planos poligonales marrones',
    neverLine: 'modelado curvo suave hiperrealista, texturas fotográficas complejas, dibujo 2D plano, figuras esquemáticas simples',
    propsNoun: 'low poly facetados',
    shirtNoun: 'low poly',
    shirtExample: 'a faceted geometric low-poly 3D light blue t-shirt with flat-shaded polygons.',
    formExample: 'a stylized low-poly 3D man of about 30 made of crisp faceted geometric polygons, angular dark\nbrown polygonal hair blocks, wearing a faceted brown tunic, a\nsmall geometric bone pendant and an angular red headband',
    consistencyPhrase: 'low poly 3D facetado',
    contrastPhrase: 'el personaje low poly geométrico',
    referencePhrase: 'low poly 3D',
    characterSheetDetails: 'geometric low-poly 3D character design, flat-shaded polygonal facets, crisp angular edges, vibrant color scheme and stylized video game proportions',
    negativePromptSectionB: 'No smooth high-poly curves, no photo textures, no 2D drawing, no simplistic line art',
    explainerDescription: 'low-poly 3D geometric style: pure white background, crisp flat-shaded polygonal models with sharp angular geometric shadows.',
    explainerCharacterPhrase: 'the same faceted low-poly 3D look with consistent geometric proportions and clothing',
    animationLookPhrase: 'faceted low-poly 3D\ncharacters with crisp flat-shaded polygon lighting',
    animationEnvPhrase: 'geometric low-poly indie game',
    anatomyMovementPhrase: 'consistent low-poly geometric anatomy',
    negativePromptAnimation: 'no smooth curved mesh, no photo textures, no simplistic line art',
    knowledgeBaseStylePhrase: 'low poly',
    characterSummaryPhrase: 'geométricas facetadas consistentes',
    characterSummaryDetail: 'mallas poligonales de caras planas, aristas angulares y colores vivos limpios',
    characterSummaryNever: 'superficies curvas pulidas, texturas fotográficas ni figuras esquemáticas simples',
  },

  // ---------------------------------------------------------------------------
  // Artesanales
  // ---------------------------------------------------------------------------
  {
    id: 'papel-recortado',
    label: 'Papel recortado',
    category: 'Artesanales',
    idealFor: 'Cuentos, explicaciones',
    description: 'Collage de papel recortado en capas, sombras suaves, textura de cartulina y stop motion',
    englishDescription: 'Layered paper cutout craft style: intricate stacked paper collage, delicate cast drop shadows between physical paper layers, fibrous cardstock textures, handcrafted stop-motion aesthetic',
    roleNoun: 'de papel recortado en capas',
    specialtyLine: 'papel recortado en capas\r\nartesanal, tipo collage, sobre escenarios construidos con planos de cartulina superpuestos.',
    sectionBTitle: 'Papel recortado artesanal en capas superpuestas',
    techniqueBullets: `* Personajes: figuras construidas mediante capas recortadas de cartulina y papel texturizado, con bordes de corte nítidos y sombras proyectadas entre capas.
* Escenarios: escenarios en relieve construidos con múltiples planos de papel superpuestos con profundidad táctil real y luces rasantes.
* Textura de papel verjurado, cartulina mate y movimiento sugerido de animación stop motion de recortes.`,
    charactersHeading: 'Papel recortado',
    characterBullets: `* Siluetas recortadas con tijera o cúter con capas visibles que forman el rostro, cabello y vestimenta.
* Extremidades ensambladas en capas de cartulina que conservan la articulación artesanal del papel.
* Vestuario con texturas de papeles de colores, estampados suaves y sombras de separación física.`,
    clothingExample: 'ejemplo: cabello de capas de papel castaño recortado y túnica de cartulina con textura',
    neverLine: '3D digital brillante, fotorrealismo humano, líneas de cómic con tinta negra gruesa, figuras esquemáticas simples',
    propsNoun: 'de papel recortado',
    shirtNoun: 'de papel recortado',
    shirtExample: 'a layered cut-paper light blue t-shirt shape with clean scissor-cut edges and cardstock texture.',
    formExample: 'a layered paper cutout man of about 30 handcrafted from textured paper sheets, layered dark\nbrown paper hair, wearing a torn-edge brown craft paper tunic, a\nsmall paper bone cutout and a red paper headband',
    consistencyPhrase: 'papel recortado en capas',
    contrastPhrase: 'el personaje de papel recortado con sombras entre capas',
    referencePhrase: 'papel recortado artesanal',
    characterSheetDetails: 'layered cut-paper craft character design, textured fibrous cardstock layers, delicate drop shadows beneath cut edges and handcrafted papercraft silhouette',
    negativePromptSectionB: 'No glossy digital 3D, no photorealism, no harsh comic ink, no simplistic line art',
    explainerDescription: 'layered paper cutout style: pure white textured paper background, clean layered paper craft illustrations with subtle paper drop shadows.',
    explainerCharacterPhrase: 'the same layered paper cutout style with consistent handcrafted paper proportions and clothing',
    animationLookPhrase: 'layered paper cutout\ncharacters with physical paper shadow depth',
    animationEnvPhrase: 'multiplane papercraft collage',
    anatomyMovementPhrase: 'consistent papercraft cutout anatomy',
    negativePromptAnimation: 'no digital 3D look, no smooth vector, no simplistic line art',
    knowledgeBaseStylePhrase: 'papel recortado',
    characterSummaryPhrase: 'de papel recortado en capas consistentes',
    characterSummaryDetail: 'texturas de cartulina, bordes recortados limpios y sombras proyectadas en relieve',
    characterSummaryNever: '3D digital brillante, fotorrealismo ni figuras esquemáticas simples',
  },
  {
    id: 'origami',
    label: 'Origami',
    category: 'Artesanales',
    idealFor: 'Ideas, transformaciones',
    description: 'Figuras de papel plegado con pliegues nítidos, colores sólidos y luz suave de estudio',
    englishDescription: 'Japanese origami folded paper style: precise sharp creases, crisp geometric folds, clean solid vibrant paper colors, soft studio photography lighting, elegant paper craft art',
    roleNoun: 'de origami plegado',
    specialtyLine: 'origami en papel plegado\r\nelegante, geométrico, sobre escenarios limpios con iluminación suave de estudio fotográfico.',
    sectionBTitle: 'Origami de papel plegado japonés geométrico y limpio',
    techniqueBullets: `* Personajes: figuras construidas íntegramente mediante pliegues geométricos de papel origami, con aristas dobladas nítidas y volumen facetado natural.
* Escenarios: composiciones minimalistas y elegantes creadas con hojas de papel plegado, superficies limpias y luz lateral suave de estudio.
* Textura de papel kami o washi japonés de color sólido con microtextura sutil de fibra vegetal.`,
    charactersHeading: 'Origami',
    characterBullets: `* Figuras humanas o criaturas estilizadas reconocibles formadas enteramente por dobleces de papel nítidos.
* Sin cortes ni dibujos añadidos: las facetas, dobleces y sombras del papel crean las facciones y la silueta.
* Proporciones limpias de papiroflexia tradicional con papel de colores sólidos y pliegues firmes.`,
    clothingExample: 'ejemplo: pliegues de papel castaño para el cabello y dobleces de papel marrón para la túnica',
    neverLine: 'curvas orgánicas hiperrealistas, texturas fotográficas complejas, caricaturas dibujadas, figuras esquemáticas simples',
    propsNoun: 'plegados en origami',
    shirtNoun: 'en origami plegado',
    shirtExample: 'a sharply folded origami paper light blue t-shirt with crisp geometric paper creases.',
    formExample: 'a Japanese origami folded paper man of about 30 with sharp geometric folds, folded dark\nbrown paper hair geometry, wearing an origami brown folded tunic, a\nsmall paper fold pendant and a crisp red paper headband',
    consistencyPhrase: 'origami en papel plegado',
    contrastPhrase: 'la figura de origami plegado con sombras suaves',
    referencePhrase: 'origami de papel plegado',
    characterSheetDetails: 'Japanese origami folded paper character design, crisp geometric paper creases, authentic paper craft folds, solid paper colors and studio lighting',
    negativePromptSectionB: 'No organic curved realism, no drawn comic lines, no digital CGI gloss, no simplistic line art',
    explainerDescription: 'Japanese origami style: pure white studio background, sharp folded geometric paper models with delicate paper contact shadows.',
    explainerCharacterPhrase: 'the same geometric origami paper style with consistent paper fold proportions and clothing',
    animationLookPhrase: 'crisp origami folded\npaper characters with sharp geometric paper creases',
    animationEnvPhrase: 'elegant minimalist origami paper',
    anatomyMovementPhrase: 'consistent folded origami paper anatomy',
    negativePromptAnimation: 'no organic curves, no smooth mesh, no simplistic line art',
    knowledgeBaseStylePhrase: 'origami',
    characterSummaryPhrase: 'de papel plegado origami consistentes',
    characterSummaryDetail: 'pliegues nítidos geométricos, facetas de papel kami y luz suave de estudio',
    characterSummaryNever: 'rostros dibujados, texturas realistas ni figuras esquemáticas simples',
  },
  {
    id: 'marionetas',
    label: 'Marionetas',
    category: 'Artesanales',
    idealFor: 'Cuentos, moralejas',
    description: 'Teatro de marionetas de tela y madera, detalles artesanales, luz cálida y ambiente teatral',
    englishDescription: 'Handcrafted puppet theater style: whimsical wooden and felt marionette puppets, visible seams and wood grain carving, warm theatrical stage lighting, nostalgic storybook stagecraft',
    roleNoun: 'de teatro de marionetas',
    specialtyLine: 'teatro de marionetas\r\nartesanal, clásico, sobre escenarios de caja de teatro con decorados de madera y luz cálida.',
    sectionBTitle: 'Teatro de marionetas artesanal de madera y tela',
    techniqueBullets: `* Personajes: marionetas o títeres tallados en madera con articulaciones de tela, ojos pintados o botones y acabados hechos a mano.
* Escenarios: escenarios de pequeño teatro de títeres, bastidores pintados, telones de terciopelo e iluminación cálida de candilejas.
* Riqueza táctil de materiales reales: veta de madera tallada, puntadas visibles, fieltro, lana y cuerdas de control sutiles.`,
    charactersHeading: 'Marionetas',
    characterBullets: `* Facciones talladas en madera con textura de pintura artesanal y expresiones teatrales nostálgicas.
* Cuerpos articulados con clavijas de madera y uniones visibles que transmiten encanto artesanal.
* Vestuario confeccionado en tela real, paño y lana con costuras visibles acordes a la escala del títere.`,
    clothingExample: 'ejemplo: cabello de estambre o lana castaña y túnica de tela cosida a mano',
    neverLine: '3D digital liso, fotorrealismo humano, dibujo plano digital, figuras esquemáticas simples',
    propsNoun: 'artesanales de marioneta',
    shirtNoun: 'de tela de marioneta',
    shirtExample: 'a miniature handcrafted stitched felt light blue t-shirt with visible thread seams.',
    formExample: 'a handcrafted wooden marionette man of about 30 with carved wooden features and painted eyes, brown\nyarn hair, wearing a stitched rustic burlap tunic, a\nsmall carved bone bead necklace and a red fabric ribbon headband',
    consistencyPhrase: 'teatro de marionetas artesanal',
    contrastPhrase: 'el títere de madera y tela',
    referencePhrase: 'teatro de marionetas',
    characterSheetDetails: 'handcrafted wooden puppet character design, visible carved wood grain, stitched fabric textiles, button joint accents and warm theatrical stagecraft',
    negativePromptSectionB: 'No CGI smoothness, no live-action human realism, no flat drawing, no simplistic line art',
    explainerDescription: 'handcrafted puppet theater style: pure white stage background, handcrafted wooden and fabric marionette models with warm physical shadows.',
    explainerCharacterPhrase: 'the same handcrafted puppet style with consistent wooden and fabric proportions and clothing',
    animationLookPhrase: 'handcrafted wooden puppet\ncharacters with visible stitched fabric textures',
    animationEnvPhrase: 'storybook theatrical stagecraft',
    anatomyMovementPhrase: 'consistent handcrafted puppet anatomy',
    negativePromptAnimation: 'no CGI smoothness, no live-action realism, no simplistic line art',
    knowledgeBaseStylePhrase: 'marionetas',
    characterSummaryPhrase: 'de títeres artesanales consistentes',
    characterSummaryDetail: 'madera tallada, uniones visibles, telas cosidas y calidez de teatro de cuentos',
    characterSummaryNever: 'CGI digital pulido, humanos fotorrealistas ni figuras esquemáticas simples',
  },
  {
    id: 'crayon-infantil',
    label: 'Crayón infantil',
    category: 'Artesanales',
    idealFor: 'Infantil, recuerdos',
    description: 'Dibujo infantil con crayones, líneas temblorosas, colores vivos y papel con textura',
    englishDescription: 'Children wax crayon drawing style: expressive shaky wax crayon strokes, bright joyful colors, rich textured drawing paper tooth, charming naive storybook art style',
    roleNoun: 'de dibujo infantil con crayón',
    specialtyLine: 'dibujo infantil con crayón\r\ningenuo, alegre, sobre papel con textura rugosa y trazos de cera de colores vivos.',
    sectionBTitle: 'Dibujo infantil con crayón de cera y textura de papel',
    techniqueBullets: `* Personajes: figuras dibujadas con trazos gruesos de crayón de cera, líneas temblorosas e ingenuas llenas de vitalidad y encanto infantil.
* Escenarios: fondos dibujados como en un cuaderno escolar con sol radiante, nubes esponjosas de cera y papel rugoso visible.
* Colores de cera puros y saturados con acumulación de pigmento pastoso y zonas donde el blanco del papel se transparenta.`,
    charactersHeading: 'Crayón infantil',
    characterBullets: `* Proporciones ingenuas y espontáneas de dibujo de niño, con ojos circulares sencillos y sonrisas amplias de cera.
* Contornos marcados con cera de colores y rellenos texturizados con la trama visible de la cera sobre el papel.
* Vestuario y detalles representados con sencillez entrañable y alegre desparpajo infantil.`,
    clothingExample: 'ejemplo: cabello trazado con crayón castaño y túnica coloreada con cera marrón',
    neverLine: '3D digital, fotorrealismo adulto, diseño vectorial frío, figuras esquemáticas simples',
    propsNoun: 'dibujados con crayón',
    shirtNoun: 'de crayón de cera',
    shirtExample: 'a naive child-like wax-crayon drawn light blue t-shirt with textured coloring.',
    formExample: 'a charming child-style wax-crayon drawn man of about 30 with enthusiastic round eyes, messy dark\nbrown crayon hair strokes, wearing a heavily colored brown wax tunic, a\nsmall yellow crayon bone pendant and a bright red crayon headband',
    consistencyPhrase: 'dibujo infantil con crayón',
    contrastPhrase: 'el personaje de crayón de cera',
    referencePhrase: 'dibujo con crayón infantil',
    characterSheetDetails: 'naive children wax crayon character illustration, energetic textured crayon strokes, bright joyful colors, tactile paper tooth and charming storybook spontaneity',
    negativePromptSectionB: 'No sterile digital 3D, no photorealism, no vector geometry, no simplistic line art',
    explainerDescription: 'children wax crayon style: textured white drawing paper background, bold colorful wax crayon drawings with authentic paper texture.',
    explainerCharacterPhrase: 'the same naive wax crayon style with consistent joyful proportions and clothing',
    animationLookPhrase: 'expressive wax crayon\ncharacters with vibrant textured crayon strokes',
    animationEnvPhrase: 'textured storybook crayon drawing',
    anatomyMovementPhrase: 'consistent wax crayon character anatomy',
    negativePromptAnimation: 'no digital vector, no 3D smoothness, no simplistic line art',
    knowledgeBaseStylePhrase: 'crayón infantil',
    characterSummaryPhrase: 'de dibujo infantil con crayón consistentes',
    characterSummaryDetail: 'trazos de cera gruesos y texturizados, colores vivos alegres y papel rugoso visible',
    characterSummaryNever: 'fotorrealismo, vector frío ni figuras esquemáticas simples',
  },

  // ---------------------------------------------------------------------------
  // Arte pintado
  // ---------------------------------------------------------------------------
  {
    id: 'anime-pintado',
    label: 'Anime pintado a mano',
    category: 'Arte pintado',
    idealFor: 'Reflexiones, música',
    description: 'Anime mágico con fondos dibujados a mano, personajes encantadores y luz natural de ensueño',
    englishDescription: 'Hand-painted magical anime style: lush hand-painted gouache and watercolor backgrounds, charming characters, soft natural sunlight, gentle breezy dreamlike nostalgic atmosphere',
    roleNoun: 'de anime pintado a mano',
    specialtyLine: 'anime tradicional pintado a mano\r\npoético, mágico, sobre fondos pictóricos en gouache y luz dorada de ensueño.',
    sectionBTitle: 'Anime mágico con fondos tradicionales pintados a mano',
    techniqueBullets: `* Personajes: dibujo de anime tradicional con líneas delicadas dibujadas a mano, coloreado suave y calidez nostálgica de largometraje clásico de animación.
* Escenarios: fondos espectaculares pintados a mano con gouache y acuarela, cielos esponjosos, vegetación exuberante y viento visible en la hierba.
* Luz solar natural dorada, sombras suaves con color y atmósfera poética y pacífica.`,
    charactersHeading: 'Anime pintado a mano',
    characterBullets: `* Ojos expresivos y dulces característicos del anime clásico con brillos naturales y miradas reflexivas.
* Cabello detallado que responde al viento suave con mechones fluidos y sombreado suave pictórico.
* Vestuario cotidiano o de fantasía con pliegues orgánicos y telas que transmiten movimiento y ligereza.`,
    clothingExample: 'ejemplo: cabello castaño mecido por el viento y túnica de tela rústica suave',
    neverLine: 'estilo 3D CGI moderno, fotorrealismo humano, cómic occidental tosco, figuras esquemáticas simples',
    propsNoun: 'de anime pintado a mano',
    shirtNoun: 'de anime tradicional',
    shirtExample: 'a hand-painted anime light blue cotton t-shirt with soft gouache brush highlights.',
    formExample: 'a hand-painted classic anime man of about 30 with expressive warm eyes, windswept shoulder-length dark\nbrown hair, wearing a soft painted brown fur tunic, a\nsmall bone necklace and a fluttering red headband',
    consistencyPhrase: 'anime pintado a mano',
    contrastPhrase: 'el personaje de anime sobre un fondo pictórico',
    referencePhrase: 'anime clásico pintado a mano',
    characterSheetDetails: 'hand-painted classic anime character design, delicate hand-drawn lines, charming expressive eyes, soft watercolor and gouache coloring and breezy poetic mood',
    negativePromptSectionB: 'No harsh digital 3D CGI, no live action, no western comic, no simplistic line art',
    explainerDescription: 'hand-painted magical anime style: pure white background, delicate hand-drawn anime linework with soft watercolor wash shading.',
    explainerCharacterPhrase: 'the same hand-painted anime look with consistent proportions and clothing',
    animationLookPhrase: 'hand-painted anime\ncharacters with soft natural sunlight glow',
    animationEnvPhrase: 'dreamlike painterly gouache',
    anatomyMovementPhrase: 'consistent hand-painted anime anatomy',
    negativePromptAnimation: 'no 3D CGI, no western comic style, no simplistic line art',
    knowledgeBaseStylePhrase: 'anime pintado a mano',
    characterSummaryPhrase: 'de anime pictórico tradicional consistentes',
    characterSummaryDetail: 'líneas suaves a mano, coloreado pictórico cálido y fondos en gouache de ensueño',
    characterSummaryNever: 'CGI 3D frío, fotorrealismo ni figuras esquemáticas simples',
  },
  {
    id: 'acuarela',
    label: 'Acuarela',
    category: 'Arte pintado',
    idealFor: 'Poesía, fe, frases',
    description: 'Acuarela fluida, colores difuminados, pinceladas delicadas y textura de papel visible',
    englishDescription: 'Fluid watercolor painting style: delicate transparent color washes, soft pigment bleeding, expressive brush strokes, soft edges, visible cold-press textured cotton paper grain',
    roleNoun: 'de ilustración en acuarela',
    specialtyLine: 'acuarela fluida tradicional\r\ndelicada, poética, sobre papel de algodón con pigmentos transparentes y bordes suaves.',
    sectionBTitle: 'Acuarela tradicional fluida sobre papel de algodón',
    techniqueBullets: `* Personajes: figuras pintadas con aguadas transparentes de acuarela, manchas de color difuminadas y trazos de pincel sueltos pero precisos.
* Escenarios: fondos etéreos con degradados húmedo sobre húmedo, salpicaduras delicadas y fusión suave de colores luminosos.
* Textura palpable de papel de acuarela prensado en frío con bordes de agua secos y veladuras suaves.`,
    charactersHeading: 'Acuarela',
    characterBullets: `* Rasgos faciales sugeridos con pinceladas delicadas, ojos expresivos con toques mínimos de pigmento oscuro.
* Siluetas orgánicas con transiciones de color suaves y manchas luminosas que dan volumen y emoción.
* Vestuario compuesto por lavados de acuarela con pliegues sugeridos por sombras transparentes.`,
    clothingExample: 'ejemplo: cabello en pinceladas castañas y túnica en aguada marrón con bordes de agua',
    neverLine: 'líneas de vector digitales nítidas, modelado 3D, fotorrealismo estricto, figuras esquemáticas simples',
    propsNoun: 'pintados en acuarela',
    shirtNoun: 'en acuarela',
    shirtExample: 'a loose watercolor wash light blue t-shirt with delicate pigment bleeding and paper texture.',
    formExample: 'a lyrical watercolor painted man of about 30 with expressive soft eyes, loose brushstroke dark\nbrown hair, wearing an earthy brown watercolor wash tunic, a\nsmall delicate bone pendant and a soft crimson watercolor headband',
    consistencyPhrase: 'acuarela tradicional',
    contrastPhrase: 'el personaje en acuarela fluida',
    referencePhrase: 'acuarela tradicional',
    characterSheetDetails: 'fluid watercolor character design, transparent pigment washes, delicate wet-on-dry brushwork, soft blending edges and visible cotton paper grain',
    negativePromptSectionB: 'No sharp digital vectors, no 3D rendering, no harsh ink, no simplistic line art',
    explainerDescription: 'fluid watercolor style: textured cold-press white watercolor paper background, delicate transparent watercolor washes and soft brushstrokes.',
    explainerCharacterPhrase: 'the same fluid watercolor style with consistent painterly proportions and clothing',
    animationLookPhrase: 'fluid watercolor\ncharacters with soft bleeding pigment washes',
    animationEnvPhrase: 'delicate wet-on-wet watercolor',
    anatomyMovementPhrase: 'consistent painterly watercolor anatomy',
    negativePromptAnimation: 'no digital vectors, no 3D rendering, no simplistic line art',
    knowledgeBaseStylePhrase: 'acuarela',
    characterSummaryPhrase: 'de acuarela fluida consistentes',
    characterSummaryDetail: 'transparencias de pigmento, pinceladas delicadas y textura de papel de algodón',
    characterSummaryNever: 'líneas vectoriales duras, 3D digital ni figuras esquemáticas simples',
  },
  {
    id: 'tinta-china',
    label: 'Tinta china',
    category: 'Arte pintado',
    idealFor: 'Estoicismo, filosofía',
    description: 'Tinta oriental tradicional, trazos negros sobre papel de arroz y ambiente zen poético',
    englishDescription: 'Traditional East Asian sumi-e ink wash painting: minimalist black ink brush calligraphy strokes on fibrous rice paper, delicate wash gradients, harmonious negative space, poetic zen atmosphere',
    roleNoun: 'de pintura en tinta china',
    specialtyLine: 'tinta china sumi-e tradicional\r\nzen, minimalista, sobre papel de arroz con trazos caligráficos fluidos y espacio negativo.',
    sectionBTitle: 'Tinta china sumi-e tradicional sobre papel de arroz',
    techniqueBullets: `* Personajes: figuras plasmadas con pinceladas de tinta negra de caligrafía tradicional oriental, variando de trazos secos enérgicos a lavados diluidos.
* Escenarios: montañas brumosas, ramas de bambú, niebla etérea y grandes extensiones de papel de arroz que respiran serenidad.
* Filosofía minimalista donde cada trazo cuenta, contrastes limpios de negro profundo y gris humo sobre blanco roto.`,
    charactersHeading: 'Tinta china',
    characterBullets: `* Rasgos faciales capturados con pocas pinceladas elocuentes y dominio del espacio negativo.
* Siluetas fluidas y elegantes que transmiten calma, sabiduría y dinamismo contenido.
* Vestuario con pliegues dibujados mediante pinceladas caligráficas amplias y seguras.`,
    clothingExample: 'ejemplo: cabello en pinceladas enérgicas de tinta negra y túnica con aguadas de tinta gris',
    neverLine: 'colores chillones, degradados digitales, 3D brillante, figuras esquemáticas simples',
    propsNoun: 'en tinta china',
    shirtNoun: 'en tinta china',
    shirtExample: 'a minimalist ink-wash light blue or grey t-shirt rendered with calligraphy brush strokes.',
    formExample: 'a traditional sumi-e ink brush man of about 30 with serene expressive eyes, flowing black\ncalligraphy ink hair strokes, wearing an ink-wash grey and black tunic, a\nsmall brush-drawn pendant and a subtle ink headband',
    consistencyPhrase: 'tinta china sumi-e',
    contrastPhrase: 'el personaje en tinta oriental sobre el papel de arroz',
    referencePhrase: 'tinta china sumi-e',
    characterSheetDetails: 'East Asian sumi-e ink wash character design, masterful calligraphy brushwork, expressive black and grey ink washes, rice paper texture and harmonious zen negative space',
    negativePromptSectionB: 'No vibrant neon colors, no digital 3D rendering, no Western comic ink, no simplistic line art',
    explainerDescription: 'traditional ink wash style: clean fibrous rice paper background, minimalist black ink brush strokes and delicate grey washes.',
    explainerCharacterPhrase: 'the same sumi-e ink brush style with consistent calligraphic proportions and clothing',
    animationLookPhrase: 'traditional ink wash\ncharacters with fluid calligraphy brush strokes',
    animationEnvPhrase: 'serene misty ink wash landscape',
    anatomyMovementPhrase: 'consistent brush ink anatomy',
    negativePromptAnimation: 'no bright neon colors, no 3D rendering, no simplistic line art',
    knowledgeBaseStylePhrase: 'tinta china',
    characterSummaryPhrase: 'de tinta sumi-e consistentes',
    characterSummaryDetail: 'trazos caligráficos minimalistas, aguadas en escala de grises y papel de arroz',
    characterSummaryNever: 'colores chillones, 3D pulido ni figuras esquemáticas simples',
  },
  {
    id: 'comic',
    label: 'Cómic',
    category: 'Arte pintado',
    idealFor: 'Acción, historias épicas',
    description: 'Novela gráfica dinámica, tinta marcada, puntos de trama, viñetas y encuadres enérgicos.',
    englishDescription: 'Dynamic graphic novel comic book style: bold black ink linework, stylized halftone Ben-Day dot screens, dramatic cinematic panel angles, vivid action-packed pop-art color palette',
    roleNoun: 'de cómic y novela gráfica',
    specialtyLine: 'cómic y novela gráfica\r\ndinámico, heroico, sobre viñetas enérgicas con entintado marcado y puntos de trama.',
    sectionBTitle: 'Cómic y novela gráfica dinámica con entintado potente',
    techniqueBullets: `* Personajes: entintado negro audaz y marcado con plumilla y pincel, tramas de puntos Ben-Day, sombreado con rayado cruzado y anatomía heroica expresiva.
* Escenarios: encuadres en perspectiva forzada, fondos detallados con líneas de acción dinámicas y arquitectura urbana o paisajes dramáticos.
* Paleta de colores vivos y saturados de imprenta clásica de cómic con alto contraste e impacto visual.`,
    charactersHeading: 'Cómic',
    characterBullets: `* Mandíbulas decididas, miradas intensas con cejas angulares y rasgos angulosos de novela gráfica.
* Siluetas potentes con líneas de contorno gruesas que recortan al personaje con fuerza.
* Vestuario con pliegues marcados por sombras de tinta negra sólida y tramas de semitono.`,
    clothingExample: 'ejemplo: cabello castaño con brillos marcados y túnica con sombras de tinta negra',
    neverLine: 'fotorrealismo estricto, 3D blando, acuarela difusa sin contornos, figuras esquemáticas simples',
    propsNoun: 'de cómic',
    shirtNoun: 'de cómic',
    shirtExample: 'a bold graphic novel comic book light blue t-shirt with heavy ink outlines and halftone dots.',
    formExample: 'a dynamic comic book man of about 30 with bold inky lines and intense eyes, angular dark\nbrown hair with graphic highlights, wearing a crosshatched brown fur tunic, a\nsmall ink-outlined bone necklace and a bold red headband',
    consistencyPhrase: 'cómic dinámico',
    contrastPhrase: 'el personaje de cómic con entintado marcado',
    referencePhrase: 'cómic y novela gráfica',
    characterSheetDetails: 'dynamic comic book graphic novel character design, bold black inking, halftone dot screening, expressive hero proportions and vibrant pop-art colors',
    negativePromptSectionB: 'No live-action photorealism, no soft 3D CGI, no fuzzy lineless art, no simplistic line art',
    explainerDescription: 'dynamic comic book style: pure white background, bold black comic ink outlines with vibrant flat pop-art colors and subtle Ben-Day dots.',
    explainerCharacterPhrase: 'the same dynamic comic book style with consistent inking proportions and clothing',
    animationLookPhrase: 'dynamic comic book\ncharacters with bold black ink outlines',
    animationEnvPhrase: 'dramatic graphic novel panel',
    anatomyMovementPhrase: 'consistent comic book anatomy',
    negativePromptAnimation: 'no photorealism, no 3D CGI, no simplistic line art',
    knowledgeBaseStylePhrase: 'cómic',
    characterSummaryPhrase: 'de cómic y novela gráfica consistentes',
    characterSummaryDetail: 'entintado negro potente, tramas de semitono y encuadres de acción enérgicos',
    characterSummaryNever: 'fotorrealismo, 3D suave ni figuras esquemáticas simples',
  },

  // ---------------------------------------------------------------------------
  // Para explicar
  // ---------------------------------------------------------------------------
  {
    id: 'pizarra-tiza',
    label: 'Pizarra con tiza',
    category: 'Para explicar',
    idealFor: 'Educación, explicaciones',
    description: 'Dibujos de tiza de colores sobre pizarra negra, trazo visible, divertido y educativo',
    englishDescription: 'Chalkboard art style: colorful hand-drawn chalk illustrations on a dark textured slate chalkboard, dusty powdery chalk strokes, playful educational diagrams, visible chalkboard texture',
    roleNoun: 'de pizarra con tiza',
    specialtyLine: 'pizarra con tiza\r\neducativo, divertido, sobre pizarras oscuras de aula con trazos de tiza de colores y polvo visible.',
    sectionBTitle: 'Ilustración en pizarra negra con tizas de colores',
    techniqueBullets: `* Personajes: figuras dibujadas con tizas de colores sobre pizarra negra, con trazos polvorientos, líneas enérgicas de tiza y sombreados difuminados con borrador.
* Escenarios: fondos de pizarra escolar negra o verde muy oscura con textura mineral, restos de polvo de tiza y esquemas explicativos.
* Estética divertida y educativa que recuerda a las explicaciones en clase con tizas blancas, amarillas, azules y rojas.`,
    charactersHeading: 'Pizarra con tiza',
    characterBullets: `* Personajes carismáticos y pedagógicos dibujados con líneas de tiza nítidas pero texturizadas.
* Expresiones faciales claras y comunicativas, ojos y cejas trazados con tiza blanca brillante.
* Ropa y complementos sugeridos con trazos de tizas de colores sobre el fondo oscuro de pizarra.`,
    clothingExample: 'ejemplo: cabello trazado con tiza marrón y túnica con rayas de tiza de color',
    neverLine: 'fondos blancos brillantes en escenas, 3D digital, fotorrealismo, figuras esquemáticas simples',
    propsNoun: 'de tiza sobre pizarra',
    shirtNoun: 'de tiza',
    shirtExample: 'a chalk-drawn light blue t-shirt illustration with dusty chalk hatching on a chalkboard.',
    formExample: 'a cheerful chalkboard-drawn man of about 30 sketched in vibrant white and colored chalk, messy dark\nbrown chalk-hatched hair, wearing a chalk-drawn brown tunic, a\nsmall white chalk bone pendant and a red chalk headband',
    consistencyPhrase: 'pizarra con tiza',
    contrastPhrase: 'el dibujo de tiza brillante sobre la pizarra oscura',
    referencePhrase: 'pizarra con tiza educativa',
    characterSheetDetails: 'educational chalkboard character art, textured chalk strokes on dark slate, vibrant colored chalk shading, visible chalk dust and engaging teacher-sketch silhouette',
    negativePromptSectionB: 'No CGI 3D, no photorealism, no vector gloss, no simplistic line art',
    explainerDescription: 'chalkboard art style: black chalkboard background, colorful chalk drawings, dusty powdery chalk textures with clean educational diagram linework.',
    explainerCharacterPhrase: 'the same chalkboard art style with consistent chalk-drawn proportions and clothing',
    animationLookPhrase: 'textured chalkboard chalk\ncharacters with visible chalk dust strokes',
    animationEnvPhrase: 'dark slate educational chalkboard',
    anatomyMovementPhrase: 'consistent chalk-drawn character anatomy',
    negativePromptAnimation: 'no CGI 3D, no photorealism, no simplistic line art',
    knowledgeBaseStylePhrase: 'pizarra con tiza',
    characterSummaryPhrase: 'de dibujo en pizarra con tiza consistentes',
    characterSummaryDetail: 'trazos de tiza polvorientos de colores sobre fondo oscuro y espíritu pedagógico',
    characterSummaryNever: '3D digital, fotorrealismo ni figuras esquemáticas simples',
  },
  {
    id: 'vectorial-plano',
    label: 'Vectorial plano',
    category: 'Para explicar',
    idealFor: 'Tutoriales, finanzas',
    description: 'Ilustración vectorial plana, formas y colores audaces, diseño moderno y minimalista',
    englishDescription: 'Bold flat vector illustration style: sharp geometric silhouettes, bold vibrant color blocking, zero outlines, crisp clean corporate and editorial tech aesthetic',
    roleNoun: 'de ilustración vectorial plana',
    specialtyLine: 'ilustración vectorial plana\r\nmoderna, audaz, sobre escenarios limpios con geometrías precisas y paleta corporativa elegante.',
    sectionBTitle: 'Ilustración vectorial plana moderna con colores audaces',
    techniqueBullets: `* Personajes: siluetas vectoriales limpias con curvas perfectas de Bézier, sin contornos negros, con bloques de color plano vibrante y sombras geométricas simples.
* Escenarios: entornos editoriales de tecnología, finanzas o negocios, con composiciones equilibradas, perspectiva isométrica o frontal limpia y minimalismo.
* Paleta cromática audaz pero armoniosa con alto contraste gráfico y estética de app moderna o editorial de primer nivel.`,
    charactersHeading: 'Vectorial plano',
    characterBullets: `* Proporciones corporales estilizadas y modernas con anatomía sintetizada en formas geométricas bellas.
* Rasgos faciales minimalistas pero muy elocuentes y profesionales.
* Vestuario contemporáneo con cortes geométricos limpios, sin arrugas superfluas y con combinaciones de color sólidas.`,
    clothingExample: 'ejemplo: cabello castaño en bloque vectorial limpio y túnica con silueta geométrica',
    neverLine: 'texturas sucias o grunge, modelado 3D realista, sombreados complejos de degradado fotográfico, figuras esquemáticas simples',
    propsNoun: 'vectoriales planos',
    shirtNoun: 'vectorial plana',
    shirtExample: 'a bold flat vector light blue t-shirt shape with clean geometry and zero outlines.',
    formExample: 'a bold flat vector illustration of a man of about 30 with sharp geometric features, neat dark\nbrown vector hair shapes, wearing a clean brown vector tunic, a\nsmall geometric bone pendant and a flat red headband',
    consistencyPhrase: 'vectorial plano audaz',
    contrastPhrase: 'la ilustración vectorial plana sobre un fondo limpio',
    referencePhrase: 'ilustración vectorial plana',
    characterSheetDetails: 'modern bold flat vector character design, crisp geometric silhouettes, solid color blocking, zero outlines, professional editorial proportions and clean modern styling',
    negativePromptSectionB: 'No grunge textures, no 3D rendering, no sketch pencil lines, no simplistic line art',
    explainerDescription: 'bold flat vector illustration style: pure white background, sharp geometric shapes, bold flat color blocking and zero outlines.',
    explainerCharacterPhrase: 'the same bold flat vector style with consistent geometric proportions and clothing',
    animationLookPhrase: 'bold flat vector\ncharacters with clean geometric silhouettes',
    animationEnvPhrase: 'modern minimalist editorial',
    anatomyMovementPhrase: 'consistent flat vector anatomy',
    negativePromptAnimation: 'no grunge textures, no 3D rendering, no simplistic line art',
    knowledgeBaseStylePhrase: 'vectorial plano',
    characterSummaryPhrase: 'vectoriales planas audaces consistentes',
    characterSummaryDetail: 'siluetas geométricas limpias, bloques de color sólido sin contornos y diseño moderno',
    characterSummaryNever: 'texturas sucias, fotorrealismo ni figuras esquemáticas simples',
  },
  {
    id: 'isometrico-3d',
    label: 'Isométrico 3D',
    category: 'Para explicar',
    idealFor: 'Negocios, procesos',
    description: '3D isométrico detallado, perspectiva en ángulo, mucho detalle y proporciones perfectas',
    englishDescription: 'Detailed 3D isometric style: orthographic angled perspective, intricate miniature diorama environments, clean studio lighting, crisp geometry and perfect structural proportions',
    roleNoun: 'de 3D isométrico',
    specialtyLine: '3D isométrico detallado\r\npreciso, técnico, sobre escenarios tipo maqueta o diorama en perspectiva ortogonal en ángulo.',
    sectionBTitle: '3D isométrico detallado con perspectiva ortogonal en ángulo',
    techniqueBullets: `* Personajes: modelos 3D estilizados a escala de diorama o maqueta isométrica, proporciones cuidadas y encaje perfecto en el escenario ortogonal.
* Escenarios: escenarios en perspectiva isométrica fija a 30 grados, como cortes transversales de edificios, ciudades en miniatura o cuartos de control.
* Iluminación de estudio limpia y suave con sombras paralelas sutiles que realzan la arquitectura y la claridad del proceso.`,
    charactersHeading: 'Isométrico 3D',
    characterBullets: `* Personajes proporcionados para vista isométrica elevada, con siluetas nítidas y poses legibles a distancia.
* Rostros simplificados pero expresivos, peinados estilizados y vestimenta con colores distintivos.
* Integración natural en entornos modulares, oficinas, fábricas, mapas y procesos organizacionales.`,
    clothingExample: 'ejemplo: cabello castaño estilizado y túnica marrón modelada en miniatura isométrica',
    neverLine: 'perspectiva cónica con gran angular distorsionado, dibujo plano a mano alzada, figuras esquemáticas simples',
    propsNoun: 'isométricos 3D',
    shirtNoun: '3D isométrica',
    shirtExample: 'a miniature stylized 3D isometric light blue t-shirt with clean geometric edges.',
    formExample: 'a miniature 3D isometric man of about 30 designed for orthographic perspective, neat dark\nbrown stylized hair, wearing a clean miniature brown tunic, a\nsmall geometric bone pendant and a thin red headband',
    consistencyPhrase: '3D isométrico',
    contrastPhrase: 'el personaje isométrico 3D en el diorama',
    referencePhrase: '3D isométrico detallado',
    characterSheetDetails: 'detailed 3D isometric character design, miniature diorama proportions, clean orthographic perspective silhouette, crisp geometry and soft studio shadows',
    negativePromptSectionB: 'No distorted perspective, no hand-drawn sketchiness, no live action, no simplistic line art',
    explainerDescription: 'detailed 3D isometric style: pure white background, orthographic angled 3D models with crisp geometric forms and soft contact shadows.',
    explainerCharacterPhrase: 'the same detailed 3D isometric look with consistent miniature proportions and clothing',
    animationLookPhrase: 'detailed 3D isometric\ncharacters with orthographic studio lighting',
    animationEnvPhrase: 'intricate miniature diorama',
    anatomyMovementPhrase: 'consistent 3D isometric anatomy',
    negativePromptAnimation: 'no distorted camera perspective, no 2D sketch, no simplistic line art',
    knowledgeBaseStylePhrase: 'isométrico 3D',
    characterSummaryPhrase: '3D isométricas de diorama consistentes',
    characterSummaryDetail: 'perspectiva ortogonal en ángulo, geometría nítida y proporciones de maqueta detallada',
    characterSummaryNever: 'perspectiva distorsionada, fotorrealismo frío ni figuras esquemáticas simples',
  },
  {
    id: 'pixel-art',
    label: 'Pixel art',
    category: 'Para explicar',
    idealFor: 'Gaming, curiosidades',
    description: 'Pixel art retro de 8 bits, píxeles marcados, pocos colores y vibra de videojuego clásico.',
    englishDescription: 'Retro 8-bit pixel art style: crisp square pixel grid, limited nostalgic color palette, clean pixel-perfect sprite work, classic vintage arcade video game aesthetic',
    roleNoun: 'de pixel art retro',
    specialtyLine: 'pixel art retro de 8 bits\r\nnostálgico, de videojuego clásico, sobre escenarios con cuadrícula de píxeles nítidos y paleta reducida.',
    sectionBTitle: 'Pixel art retro de 8 bits con cuadrícula visible y limpia',
    techniqueBullets: `* Personajes: sprites dibujados píxel por píxel con cuadrícula cuadrada visible de alta nitidez, sin interpolación borrosa ni suavizado antialiasing accidental.
* Escenarios: fondos de videojuego clásico retro de 8/16 bits con azulejos detallados, cielos pixelados y paleta de colores reducida y contrastada.
* Estética vintage de arcade y consolas clásicas con proporciones de sprite legibles y encanto retro auténtico.`,
    charactersHeading: 'Pixel art',
    characterBullets: `* Sprites de personajes con píxeles definidos que marcan ojos, sonrisa y expresión a escala pequeña pero clara.
* Siluetas icónicas de videojuego con contornos de píxel oscuro y sombreado por agrupamiento de píxeles.
* Ropa y accesorios representados con bloques de píxeles de colores sólidos fácilmente identificables.`,
    clothingExample: 'ejemplo: cabello castaño pixelado en bloques y túnica de píxeles marrones',
    neverLine: 'vectores suaves de alta resolución, modelos 3D poligonales, fotorrealismo, figuras esquemáticas simples',
    propsNoun: 'en pixel art de 8 bits',
    shirtNoun: 'en pixel art',
    shirtExample: 'a pixel-perfect 8-bit sprite light blue t-shirt with visible square pixels.',
    formExample: 'a retro 8-bit pixel art man sprite of about 30 with distinct square pixels, dark\nbrown pixelated hair clusters, wearing an earthy brown pixel tunic, a\nsmall pixelated bone necklace and a red pixel headband',
    consistencyPhrase: 'pixel art retro',
    contrastPhrase: 'el sprite de pixel art sobre el escenario de píxeles',
    referencePhrase: 'pixel art retro de 8 bits',
    characterSheetDetails: 'authentic 8-bit pixel art character sprite design, crisp square pixel grid, limited color palette, clean cluster shading and vintage arcade silhouette',
    negativePromptSectionB: 'No smooth vector lines, no high-res 3D, no blurry antialiasing, no simplistic line art',
    explainerDescription: 'retro 8-bit pixel art style: pure white background, crisp pixel-perfect sprites on a clean square pixel grid.',
    explainerCharacterPhrase: 'the same retro pixel art sprite look with consistent pixel grid proportions and clothing',
    animationLookPhrase: 'retro 8-bit pixel art\ncharacters with crisp square pixel sprite animation',
    animationEnvPhrase: 'classic vintage arcade video game',
    anatomyMovementPhrase: 'consistent pixel art sprite anatomy',
    negativePromptAnimation: 'no smooth high-res rendering, no 3D, no simplistic line art',
    knowledgeBaseStylePhrase: 'pixel art',
    characterSummaryPhrase: 'de sprite pixel art consistentes',
    characterSummaryDetail: 'cuadrícula de píxeles nítida, paleta de colores de videojuego retro y encanto de 8 bits',
    characterSummaryNever: 'líneas suaves de alta resolución, 3D ni figuras esquemáticas simples',
  },
];
