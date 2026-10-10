/**
 * Matches gift ideas to one person: what they like, what they don't want and what's on their
 * wishlist. Plain keyword matching on word stems (Slovenian + English, with or without č/š/ž).
 */

export type Topic =
  | 'coffee'
  | 'tea'
  | 'chocolate'
  | 'sweets'
  | 'alcohol'
  | 'honey'
  | 'food'
  | 'cooking'
  | 'books'
  | 'games'
  | 'plants'
  | 'cosy'
  | 'tech'
  | 'music'
  | 'beauty'
  | 'candles'
  | 'outdoor'
  | 'sport'
  | 'art'
  | 'film'
  | 'travel'
  | 'eco'
  | 'writing';

/**
 * Stems match the start of a word after removing diacritics; '=word' must match the whole word
 * (for short stems that would otherwise hit unrelated words, e.g. med/medtem, sol/šola).
 */
const STEMS: Record<Topic, string[]> = {
  coffee: ['kav', 'coffee', 'espresso', 'kapucin', 'cappuccino', 'latte'],
  tea: ['caj', '=tea', 'teas'],
  chocolate: ['cokolad', 'chocolat', 'kakav', 'cocoa', 'pralin', 'gorenjk'],
  sweets: [
    'sladk',
    'sweet',
    'bonbon',
    'candy',
    'piskot',
    'cookie',
    'sladic',
    'dessert',
    'torta',
    'cake',
  ],
  alcohol: [
    'alkohol',
    'alcohol',
    'vino',
    'vina',
    'vinu',
    'vinsk',
    'wine',
    'pivo',
    'piva',
    'pivu',
    'beer',
    'zgan',
    'liker',
    'liqueur',
    'whisk',
    '=gin',
    '=rum',
    'teran',
    'cvicek',
    'rebul',
  ],
  honey: ['=med', '=medu', '=medom', '=medeni', 'honey', 'cebel', '=bee', '=bees', 'beekeep'],
  food: [
    'hran',
    'food',
    '=jesti',
    '=sir',
    '=sira',
    'sirov',
    'cheese',
    'prsut',
    'salam',
    'olje',
    'olja',
    '=oil',
    'zacimb',
    'spice',
    'gurman',
    'delikates',
    '=sol',
    '=soli',
    'salt',
  ],
  cooking: [
    'kuh',
    'cook',
    '=pec',
    'pecen',
    'peciv',
    'pecem',
    '=bake',
    'baking',
    'recept',
    'recipe',
    'kitchen',
  ],
  books: [
    'knjig',
    'book',
    'branj',
    '=brati',
    'read',
    'roman',
    'novel',
    'kriminal',
    'crime',
    '=strip',
    'stripi',
    'comic',
    'poezij',
    'poetry',
  ],
  games: ['igr', 'game', 'druzabn', 'board', 'puzzl', 'sestavljank', '=karte', 'kartanj', 'card'],
  plants: [
    'rastlin',
    'plant',
    '=roze',
    'rozic',
    'flower',
    'vrtnar',
    '=vrt',
    'garden',
    'zelisc',
    'herb',
    'loncnic',
  ],
  cosy: [
    'nogavic',
    'sock',
    'odej',
    'blanket',
    'copat',
    'slipper',
    'cosy',
    'cozy',
    'udob',
    'toplo',
    'warm',
    'zim',
    'winter',
    'pizam',
    'pajam',
  ],
  tech: [
    'tehn',
    'tech',
    'gadget',
    'elektron',
    'telefon',
    'phone',
    'racunal',
    'computer',
    'gaming',
    'polnil',
    'charger',
  ],
  music: [
    'glasb',
    'music',
    'koncert',
    'concert',
    'zvocnik',
    'speaker',
    'slusalk',
    'headphone',
    'vinil',
    'vinyl',
  ],
  beauty: [
    'kozmetik',
    'cosmetic',
    'krem',
    'cream',
    '=milo',
    '=mila',
    'soap',
    'beauty',
    'lepot',
    'nega',
    'nego',
    'skincare',
    'parfum',
    'perfume',
    'kopel',
    'bath',
  ],
  candles: ['svec', 'candle', 'aroma', 'disav', 'scent'],
  outdoor: [
    'narav',
    'nature',
    'hrib',
    '=gore',
    '=gora',
    'gorah',
    'mountain',
    'planin',
    'pohod',
    'hiking',
    '=hike',
    'outdoor',
    'kamp',
    'camping',
    'izlet',
  ],
  sport: [
    'sport',
    '=tek',
    'tekan',
    'running',
    '=run',
    '=kolo',
    'kolesa',
    'bike',
    'kolesar',
    'cycl',
    'fitnes',
    'fitness',
    'joga',
    'yoga',
    'plezan',
    'climb',
    'smuc',
    '=ski',
    'skiing',
  ],
  art: [
    'umetn',
    '=art',
    '=arts',
    'slikan',
    'slikat',
    'paint',
    'risan',
    'risat',
    'draw',
    'ustvarj',
    'craft',
    'rocn',
    '=diy',
    'pleten',
    'knit',
    'muzej',
    'museum',
    'galerij',
    'gallery',
  ],
  film: ['film', 'movie', 'kino', 'cinema', 'serij', 'series', 'gledalisc', 'theat'],
  travel: ['potov', 'travel', 'trip', 'dopust', 'holiday', 'izlet'],
  eco: [
    '=eko',
    'ekolo',
    '=eco',
    'trajnost',
    'sustain',
    'okolj',
    'environment',
    'zero',
    'plastik',
    'recikl',
    'second',
  ],
  writing: ['pisanj', 'pisat', 'writ', 'dnevnik', 'journal', 'zvezek', 'notebook', 'beleznic'],
};

/** Topics per gift idea id. */
export const IDEA_TOPICS: Record<string, Topic[]> = {
  'g-choc': ['chocolate', 'sweets'],
  'g-socks': ['cosy'],
  'g-tea': ['tea'],
  'g-mug': ['coffee', 'tea'],
  'g-candle': ['candles', 'cosy'],
  'g-notebook': ['writing'],
  'g-plant': ['plants'],
  'g-puzzle': ['games'],
  'g-gloves': ['cosy', 'tech'],
  'g-cards': ['games'],
  'g-wine': ['alcohol'],
  'g-powerbank': ['tech', 'travel'],
  'g-blanket': ['cosy'],
  'g-game': ['games'],
  'g-speaker': ['music', 'tech'],
  's-gorenjka': ['chocolate', 'sweets'],
  's-salt': ['food', 'cooking'],
  's-tea': ['tea'],
  's-honey': ['honey', 'food', 'sweets'],
  's-oil': ['food', 'cooking'],
  's-lect': ['sweets', 'art'],
  's-wine': ['alcohol'],
  's-schnapps': ['alcohol'],
  's-book': ['books'],
  's-cosmetics': ['beauty'],
  's-prsut': ['food'],
  's-potica': ['sweets', 'food'],
  's-slippers': ['cosy'],
  's-lace': ['art'],
  'h-cookies': ['sweets'],
  'h-jam': ['food', 'sweets'],
  'h-soap': ['beauty'],
  'h-candle': ['candles'],
  'h-photo': ['art'],
  'h-knit': ['cosy', 'art'],
  'h-notebook': ['writing', 'art'],
  'h-dinner': ['food', 'cooking'],
  'x-cinema': ['film'],
  'x-cafe': ['coffee', 'food'],
  'x-museum': ['art', 'travel'],
  'x-escape': ['games'],
  'x-climb': ['sport', 'outdoor'],
  'x-theatre': ['film', 'music'],
  'x-spa': ['beauty'],
  'x-cooking': ['cooking', 'food'],
  'b-bookmark': ['books'],
  'b-pocket': ['books'],
  'b-journal': ['writing', 'books'],
  'b-crime': ['books'],
  'b-comic': ['books', 'art'],
  'b-travel': ['books', 'travel'],
  'b-cook': ['books', 'cooking'],
  'b-classic': ['books'],
  'e-bag': ['eco'],
  'e-bar': ['eco', 'beauty'],
  'e-wraps': ['eco', 'cooking'],
  'e-herbs': ['eco', 'plants', 'cooking'],
  'e-bamboo': ['eco'],
  'e-bottle': ['eco', 'outdoor', 'coffee'],
  'e-solar': ['eco', 'outdoor'],
  'e-tree': ['eco', 'plants', 'honey'],
  'w-bar': ['chocolate', 'sweets'],
  'w-candy': ['sweets'],
  'w-cocoa': ['chocolate', 'sweets'],
  'w-cookies': ['sweets'],
  'w-tea': ['tea'],
  'w-pralines': ['chocolate', 'sweets'],
  'w-nuts': ['honey', 'sweets', 'food'],
  'w-baking': ['cooking', 'sweets'],
};

export interface GifteeProfile {
  likes?: string | null;
  dislikes?: string | null;
  /** Titles of items on their wishlist (signals interests too). */
  wishes?: string[];
}

/** Lowercase, no diacritics (č→c, š→s, ž→z, ...), words only. */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** Returns topic → the word that triggered it (as the person wrote it). */
export function findTopics(text: string | null | undefined): Map<Topic, string> {
  const found = new Map<Topic, string>();
  if (!text?.trim()) return found;
  const original = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const words = original.map(normalize);
  for (const [topic, stems] of Object.entries(STEMS) as [Topic, string[]][]) {
    const i = words.findIndex((w) =>
      stems.some((s) => (s.startsWith('=') ? w === s.slice(1) : w.startsWith(s))),
    );
    if (i >= 0) found.set(topic, original[i]);
  }
  return found;
}

export interface Personalization {
  liked: Map<Topic, string>;
  disliked: Map<Topic, string>;
  hasProfile: boolean;
}

export function analyze(profile: GifteeProfile | null | undefined): Personalization {
  const liked = findTopics(
    [profile?.likes, ...(profile?.wishes ?? [])].filter(Boolean).join(' . '),
  );
  const disliked = findTopics(profile?.dislikes);
  // Something they explicitly don't want always wins over a like.
  for (const t of disliked.keys()) liked.delete(t);
  return { liked, disliked, hasProfile: liked.size > 0 || disliked.size > 0 };
}

/** Why an idea fits: the words from their likes/wishlist that matched (empty = no match). */
export function matchReasons(ideaId: string, p: Personalization): string[] {
  return [
    ...new Set(
      (IDEA_TOPICS[ideaId] ?? []).filter((t) => p.liked.has(t)).map((t) => p.liked.get(t)!),
    ),
  ];
}

export function isExcluded(ideaId: string, p: Personalization): boolean {
  return (IDEA_TOPICS[ideaId] ?? []).some((t) => p.disliked.has(t));
}
