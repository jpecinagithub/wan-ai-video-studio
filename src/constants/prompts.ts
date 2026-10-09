import type { PromptCategory, PromptExample } from '../types';

/** Categorías de la biblioteca de prompts (fijas, en español). */
export const CATEGORIAS: PromptCategory[] = [
  'Cinematográfico',
  'Naturaleza y paisajes',
  'Historia y época medieval',
  'Ciencia ficción',
  'Fantasía',
  'Animación',
  'Publicidad y productos',
  'Documentales',
  'Viajes',
  'Arquitectura',
];

/**
 * Colección de prompts cinematográficos reutilizables.
 * Están incluidos localmente: no requieren llamadas a modelos de IA.
 * Mezclan español e inglés de forma natural: los modelos suelen responder
 * mejor a descripciones en inglés, pero puedes escribir en el idioma que prefieras.
 */
export const PROMPTS: PromptExample[] = [
  // ── Cinematográfico ────────────────────────────────────────────────
  {
    id: 'cine-1',
    titulo: 'Castillo al amanecer',
    categoria: 'Cinematográfico',
    descripcion: 'Plano aéreo épico con luz dorada suave.',
    prompt:
      'A cinematic aerial shot of a medieval castle surrounded by mountains at sunrise. Soft golden light, realistic atmosphere, slow camera movement, epic historical cinematic style.',
  },
  {
    id: 'cine-2',
    titulo: 'Ciudad bajo la lluvia',
    categoria: 'Cinematográfico',
    descripcion: 'Neón reflejado en asfalto mojado, noche.',
    prompt:
      'A rainy neon-lit city street at night, cinematic mood, reflections on wet asphalt, slow dolly shot, shallow depth of field, film grain.',
  },
  {
    id: 'cine-3',
    titulo: 'Tren nocturno',
    categoria: 'Cinematográfico',
    descripcion: 'Travelling lateral de un tren entre luces de ciudad.',
    prompt:
      'A night train crossing a glowing city bridge, smooth lateral tracking shot, motion blur on the lights, deep blue tones, anamorphic lens flares, cinematic realism.',
  },

  // ── Naturaleza y paisajes ──────────────────────────────────────────
  {
    id: 'nat-1',
    titulo: 'Cascada en el bosque',
    categoria: 'Naturaleza y paisajes',
    descripcion: 'Agua en movimiento entre vegetación densa.',
    prompt:
      'A majestic waterfall deep in a lush green forest, mist rising, sunlight filtering through the canopy, slow cinematic pan, ultra realistic.',
  },
  {
    id: 'nat-2',
    titulo: 'Dunas al atardecer',
    categoria: 'Naturaleza y paisajes',
    descripcion: 'Ondas de arena con sombras alargadas.',
    prompt:
      'Endless desert dunes at sunset, long shadows, wind moving the sand, warm orange light, slow aerial drift, serene and vast.',
  },
  {
    id: 'nat-3',
    titulo: 'Aurora boreal',
    categoria: 'Naturaleza y paisajes',
    descripcion: 'Cortinas de luz verde sobre un lago en calma.',
    prompt:
      'Aurora borealis dancing over a mirror-still arctic lake, stars above, green and violet curtains of light, gentle time-lapse motion, breathtaking natural beauty.',
  },

  // ── Historia y época medieval ──────────────────────────────────────
  {
    id: 'med-1',
    titulo: 'Mercado medieval',
    categoria: 'Historia y época medieval',
    descripcion: 'Vida cotidiana en una plaza de época.',
    prompt:
      'A bustling medieval market square at midday, merchants and townsfolk in period clothing, stone buildings, warm sunlight, handheld camera feel, historical realism.',
  },
  {
    id: 'med-2',
    titulo: 'Niebla antes de la batalla',
    categoria: 'Historia y época medieval',
    descripcion: 'Tensión previa al combate, tono épico.',
    prompt:
      'Two medieval armies facing each other across a foggy field at dawn, banners waving slowly, epic wide shot, muted colors, dramatic tension.',
  },
  {
    id: 'med-3',
    titulo: 'Forja del herrero',
    categoria: 'Historia y época medieval',
    descripcion: 'Chispas y fuego en un taller de la época.',
    prompt:
      'A medieval blacksmith hammering a glowing sword in a dim forge, sparks flying, intense firelight, close-up details of metal and hands, gritty historical realism.',
  },

  // ── Ciencia ficción ────────────────────────────────────────────────
  {
    id: 'scifi-1',
    titulo: 'Estación espacial',
    categoria: 'Ciencia ficción',
    descripcion: 'Interior futurista con hologramas.',
    prompt:
      'Interior of a futuristic space station, holographic displays floating, astronauts walking in zero gravity, cool blue lighting, smooth camera glide, sci-fi realism.',
  },
  {
    id: 'scifi-2',
    titulo: 'Metrópolis del futuro',
    categoria: 'Ciencia ficción',
    descripcion: 'Rascacielos y vehículos voladores.',
    prompt:
      'A sprawling futuristic metropolis at dusk, flying vehicles between skyscrapers, glowing windows, aerial establishing shot, cyberpunk atmosphere.',
  },
  {
    id: 'scifi-3',
    titulo: 'Primer contacto',
    categoria: 'Ciencia ficción',
    descripcion: 'Nave alienígena sobre una ciudad dormida.',
    prompt:
      'A colossal alien spacecraft hovering silently over a sleeping city, beams of light scanning the rooftops, awe and tension, slow majestic camera rise, cinematic sci-fi epic.',
  },

  // ── Fantasía ───────────────────────────────────────────────────────
  {
    id: 'fant-1',
    titulo: 'Bosque encantado',
    categoria: 'Fantasía',
    descripcion: 'Luces mágicas entre árboles antiguos.',
    prompt:
      'An enchanted forest with glowing magical lights floating among ancient trees, fireflies, mystical fog, slow push-in shot, fantasy wonder.',
  },
  {
    id: 'fant-2',
    titulo: 'Dragón sobre el valle',
    categoria: 'Fantasía',
    descripcion: 'Criatura majestuosa en vuelo.',
    prompt:
      'A majestic dragon soaring over a misty valley, wings spread wide, epic scale, dramatic clouds, cinematic wide shot, fantasy epic.',
  },
  {
    id: 'fant-3',
    titulo: 'Portal arcano',
    categoria: 'Fantasía',
    descripcion: 'Hechicera abriendo una puerta a otro mundo.',
    prompt:
      'A hooded sorceress opening a swirling arcane portal in ancient ruins, magical particles and glowing runes, wind rising, dramatic low angle, dark fantasy cinema.',
  },

  // ── Animación ──────────────────────────────────────────────────────
  {
    id: 'anim-1',
    titulo: 'Aventura animada',
    categoria: 'Animación',
    descripcion: 'Estilo dibujos animados, colores vivos.',
    prompt:
      'A cheerful animated forest adventure, stylized cartoon look, vibrant colors, a small fox running through flowers, playful camera moves.',
  },
  {
    id: 'anim-2',
    titulo: 'Robot y globo',
    categoria: 'Animación',
    descripcion: 'Amistad tierna en estilo 3D suave.',
    prompt:
      'A cute little robot holding a red balloon, floating gently above a pastel city, soft 3D cartoon style, warm sunlight, joyful and tender atmosphere.',
  },
  {
    id: 'anim-3',
    titulo: 'Carrera de globos',
    categoria: 'Animación',
    descripcion: 'Persecución aérea llena de color.',
    prompt:
      'Animated hot-air balloon race over colorful patchwork fields, whimsical cartoon style, clouds drifting, cheerful orchestral energy, sweeping aerial shots.',
  },

  // ── Publicidad y productos ─────────────────────────────────────────
  {
    id: 'pub-1',
    titulo: 'Anuncio de reloj',
    categoria: 'Publicidad y productos',
    descripcion: 'Producto de lujo, macro cinematográfico.',
    prompt:
      'Luxury watch commercial, extreme macro shots of gears and dial, dramatic studio lighting, slow rotation, elegant dark background, premium advertising style.',
  },
  {
    id: 'pub-2',
    titulo: 'Perfume en movimiento',
    categoria: 'Publicidad y productos',
    descripcion: 'Frasco elegante entre seda y luz.',
    prompt:
      'Perfume bottle commercial, silk fabric flowing in slow motion around the product, golden rim lighting, luxury beauty aesthetic, ultra smooth camera.',
  },
  {
    id: 'pub-3',
    titulo: 'Café de especialidad',
    categoria: 'Publicidad y productos',
    descripcion: 'Vapor y grano en plano detalle.',
    prompt:
      'Specialty coffee commercial, roasted beans tumbling in slow motion, steam rising from a ceramic cup, warm morning light, cozy premium advertising mood.',
  },

  // ── Documentales ───────────────────────────────────────────────────
  {
    id: 'doc-1',
    titulo: 'Vida en el océano',
    categoria: 'Documentales',
    descripcion: 'Documental naturalista submarino.',
    prompt:
      'Underwater documentary footage of a coral reef, schools of fish, sea turtle gliding by, natural light rays through water, calm narration pace.',
  },
  {
    id: 'doc-2',
    titulo: 'Sabana africana',
    categoria: 'Documentales',
    descripcion: 'Manada de elefantes al amanecer.',
    prompt:
      'African savanna documentary, a herd of elephants walking at dawn, dust in the golden light, long lens wildlife footage, authentic nature documentary feel.',
  },
  {
    id: 'doc-3',
    titulo: 'Glaciar en retroceso',
    categoria: 'Documentales',
    descripcion: 'Paisaje polar con tono divulgativo.',
    prompt:
      'Arctic glacier documentary footage, massive ice formations calving into the sea, deep blue ice textures, helicopter aerial views, solemn informative tone.',
  },

  // ── Viajes ─────────────────────────────────────────────────────────
  {
    id: 'via-1',
    titulo: 'Kioto en primavera',
    categoria: 'Viajes',
    descripcion: 'Cerezos en flor y templos.',
    prompt:
      'Cherry blossoms in Kyoto in spring, petals falling over a traditional temple, soft morning light, gentle breeze, travel film aesthetic.',
  },
  {
    id: 'via-2',
    titulo: 'Santorini al atardecer',
    categoria: 'Viajes',
    descripcion: 'Casas blancas y mar Egeo en hora dorada.',
    prompt:
      'Santorini at golden hour, whitewashed houses above the Aegean sea, slow drone reveal, romantic travel film look, warm cinematic colors.',
  },
  {
    id: 'via-3',
    titulo: 'Carretera por Islandia',
    categoria: 'Viajes',
    descripcion: 'Road movie entre volcanes y cascadas.',
    prompt:
      'Road trip through Iceland, a car driving along a lonely volcanic road, waterfalls and mossy lava fields passing by, moody skies, adventurous travel film style.',
  },

  // ── Arquitectura ───────────────────────────────────────────────────
  {
    id: 'arq-1',
    titulo: 'Catedral gótica',
    categoria: 'Arquitectura',
    descripcion: 'Arquitectura monumental en detalle.',
    prompt:
      'A gothic cathedral facade at golden hour, intricate stone details, dramatic sky, slow upward tilt shot, architectural photography style.',
  },
  {
    id: 'arq-2',
    titulo: 'Rascacielos de cristal',
    categoria: 'Arquitectura',
    descripcion: 'Reflejos urbanos en contrapicado.',
    prompt:
      'Modern glass skyscraper reflecting clouds, dramatic low-angle tilt, minimalist urban composition, crisp daylight, architectural photography elegance.',
  },
  {
    id: 'arq-3',
    titulo: 'Pueblo de montaña',
    categoria: 'Arquitectura',
    descripcion: 'Casas de piedra entre niebla.',
    prompt:
      'Stone mountain village emerging from morning fog, slate roofs and narrow alleys, slow aerial descent, timeless rustic architecture, serene cinematic mood.',
  },
];

/**
 * Alias de compatibilidad con versiones anteriores del código.
 * @deprecated Usa {@link PROMPTS}.
 */
export const PROMPTS_EJEMPLO: PromptExample[] = PROMPTS;
