import { ThemePreset } from '../../core/models';

/** Slovenian online stores / price comparison with search URLs that were verified to work. */
export const STORES = {
  ceneje: {
    name: 'Ceneje.si',
    search: (q: string) => `https://www.ceneje.si/Iskanje/Izdelki?q=${encodeURIComponent(q)}`,
  },
  mimovrste: {
    name: 'Mimovrste',
    search: (q: string) => `https://www.mimovrste.com/iskanje?s=${encodeURIComponent(q)}`,
  },
  emka: {
    name: 'Emka',
    search: (q: string) => `https://emka.si/search?q=${encodeURIComponent(q)}`,
  },
  mercator: {
    name: 'Mercator',
    search: (q: string) => `https://www.mercator.si/iskanje/?q=${encodeURIComponent(q)}`,
  },
  google: {
    name: 'Google',
    search: (q: string) =>
      `https://www.google.com/search?q=${encodeURIComponent(`${q} Slovenija`)}&gl=si&hl=sl`,
  },
} as const;
export type StoreId = keyof typeof STORES;

/** A curated gift idea with a typical Slovenian shop price in EUR. */
export interface GiftIdea {
  id: string;
  emoji: string;
  en: string;
  sl: string;
  price: number;
  /** Slovenian search phrase used for the store links. */
  q: string;
  /** Where to look, best first (at most two links are shown). */
  stores: StoreId[];
}

export interface StoreLink {
  name: string;
  url: string;
}

export const ideaLinks = (idea: GiftIdea): StoreLink[] =>
  idea.stores.slice(0, 2).map((s) => ({ name: STORES[s].name, url: STORES[s].search(idea.q) }));

export const THEME_EMOJI: Record<ThemePreset, string> = {
  none: '🎁',
  slovenian: '🇸🇮',
  handmade: '🧶',
  experience: '🎟️',
  books: '📚',
  eco: '🌱',
  sweets: '🍫',
  custom: '✨',
};

const C: StoreId[] = ['ceneje', 'mimovrste'];
const FOOD: StoreId[] = ['mercator', 'ceneje'];

const generic: GiftIdea[] = [
  {
    id: 'g-choc',
    emoji: '🍫',
    en: 'Bar of good chocolate',
    sl: 'Tablica dobre čokolade',
    price: 3,
    q: 'čokolada',
    stores: FOOD,
  },
  {
    id: 'g-socks',
    emoji: '🧦',
    en: 'Cosy warm socks',
    sl: 'Tople mehke nogavice',
    price: 8,
    q: 'tople nogavice',
    stores: C,
  },
  {
    id: 'g-tea',
    emoji: '🍵',
    en: 'Box of fine tea',
    sl: 'Škatla izbranega čaja',
    price: 6,
    q: 'čaj darilni',
    stores: FOOD,
  },
  {
    id: 'g-mug',
    emoji: '☕',
    en: 'A nice mug',
    sl: 'Lepa skodelica',
    price: 9,
    q: 'skodelica za kavo',
    stores: C,
  },
  {
    id: 'g-candle',
    emoji: '🕯️',
    en: 'Scented candle',
    sl: 'Dišeča sveča',
    price: 12,
    q: 'dišeča sveča',
    stores: C,
  },
  {
    id: 'g-notebook',
    emoji: '📓',
    en: 'Beautiful notebook',
    sl: 'Lep zvezek',
    price: 10,
    q: 'zvezek beležka',
    stores: C,
  },
  {
    id: 'g-plant',
    emoji: '🪴',
    en: 'Easy-care houseplant',
    sl: 'Nezahtevna sobna rastlina',
    price: 14,
    q: 'sobna rastlina',
    stores: C,
  },
  {
    id: 'g-puzzle',
    emoji: '🧩',
    en: 'Jigsaw puzzle (1000 pieces)',
    sl: 'Sestavljanka (1000 kosov)',
    price: 15,
    q: 'sestavljanka 1000',
    stores: C,
  },
  {
    id: 'g-gloves',
    emoji: '🧤',
    en: 'Touchscreen winter gloves',
    sl: 'Zimske rokavice za zaslon na dotik',
    price: 13,
    q: 'rokavice zaslon na dotik',
    stores: C,
  },
  {
    id: 'g-cards',
    emoji: '🃏',
    en: 'Card or party game',
    sl: 'Igra s kartami ali družabna igra',
    price: 18,
    q: 'družabna igra s kartami',
    stores: C,
  },
  {
    id: 'g-wine',
    emoji: '🍷',
    en: 'A good bottle of wine',
    sl: 'Dobra steklenica vina',
    price: 12,
    q: 'vino',
    stores: FOOD,
  },
  {
    id: 'g-powerbank',
    emoji: '🔋',
    en: 'Power bank',
    sl: 'Prenosna baterija (powerbank)',
    price: 20,
    q: 'prenosna baterija powerbank',
    stores: C,
  },
  {
    id: 'g-blanket',
    emoji: '🛋️',
    en: 'Soft fleece blanket',
    sl: 'Mehka odejica',
    price: 22,
    q: 'odeja fleece',
    stores: C,
  },
  {
    id: 'g-game',
    emoji: '🎲',
    en: 'Board game',
    sl: 'Družabna igra',
    price: 30,
    q: 'družabna igra',
    stores: C,
  },
  {
    id: 'g-speaker',
    emoji: '🔊',
    en: 'Small Bluetooth speaker',
    sl: 'Mali Bluetooth zvočnik',
    price: 28,
    q: 'bluetooth zvočnik',
    stores: C,
  },
];

export const GIFT_IDEAS: Record<Exclude<ThemePreset, 'custom'>, GiftIdea[]> = {
  none: generic,
  slovenian: [
    {
      id: 's-gorenjka',
      emoji: '🍫',
      en: 'Gorenjka chocolate',
      sl: 'Čokolada Gorenjka',
      price: 3,
      q: 'gorenjka čokolada',
      stores: FOOD,
    },
    {
      id: 's-salt',
      emoji: '🧂',
      en: 'Piran sea salt or salt flower',
      sl: 'Piranska sol ali solni cvet',
      price: 6,
      q: 'piranska sol solni cvet',
      stores: ['ceneje', 'mercator'],
    },
    {
      id: 's-tea',
      emoji: '🌿',
      en: 'Slovenian herbal tea',
      sl: 'Slovenski zeliščni čaj',
      price: 5,
      q: 'zeliščni čaj slovenski',
      stores: FOOD,
    },
    {
      id: 's-honey',
      emoji: '🍯',
      en: 'Honey from a Slovenian beekeeper',
      sl: 'Med slovenskega čebelarja',
      price: 9,
      q: 'slovenski med',
      stores: ['ceneje', 'mercator'],
    },
    {
      id: 's-oil',
      emoji: '🫒',
      en: 'Styrian pumpkin seed oil',
      sl: 'Štajersko bučno olje',
      price: 10,
      q: 'bučno olje',
      stores: ['ceneje', 'mercator'],
    },
    {
      id: 's-lect',
      emoji: '❤️',
      en: 'Decorated gingerbread heart (lectovo srce)',
      sl: 'Lectovo srce',
      price: 8,
      q: 'lectovo srce',
      stores: ['ceneje', 'google'],
    },
    {
      id: 's-wine',
      emoji: '🍷',
      en: 'Slovenian wine (Cviček, Teran, Rebula)',
      sl: 'Slovensko vino (cviček, teran, rebula)',
      price: 11,
      q: 'teran vino',
      stores: FOOD,
    },
    {
      id: 's-schnapps',
      emoji: '🥃',
      en: 'Small bottle of Slovenian schnapps or liqueur',
      sl: 'Steklenička slovenskega žganja ali likerja',
      price: 12,
      q: 'slovenski liker žganje',
      stores: ['ceneje', 'mercator'],
    },
    {
      id: 's-book',
      emoji: '📖',
      en: 'Book by a Slovenian author',
      sl: 'Knjiga slovenskega avtorja',
      price: 20,
      q: 'slovenski avtor roman',
      stores: ['emka', 'ceneje'],
    },
    {
      id: 's-cosmetics',
      emoji: '🧴',
      en: 'Slovenian natural cosmetics',
      sl: 'Slovenska naravna kozmetika',
      price: 15,
      q: 'naravna kozmetika slovenska',
      stores: C,
    },
    {
      id: 's-prsut',
      emoji: '🥩',
      en: 'Kras prosciutto',
      sl: 'Kraški pršut',
      price: 18,
      q: 'kraški pršut',
      stores: ['ceneje', 'mercator'],
    },
    {
      id: 's-potica',
      emoji: '🥮',
      en: 'Potica',
      sl: 'Potica',
      price: 16,
      q: 'potica',
      stores: ['mercator', 'ceneje'],
    },
    {
      id: 's-slippers',
      emoji: '🧦',
      en: 'Slovenian-made wool slippers',
      sl: 'Volnene copate slovenske izdelave',
      price: 25,
      q: 'volnene copate',
      stores: C,
    },
    {
      id: 's-lace',
      emoji: '🪡',
      en: 'Idrija lace (small piece)',
      sl: 'Idrijska čipka (manjši izdelek)',
      price: 30,
      q: 'idrijska čipka',
      stores: ['google', 'ceneje'],
    },
  ],
  handmade: [
    {
      id: 'h-cookies',
      emoji: '🍪',
      en: 'Home-baked cookies in a pretty jar',
      sl: 'Domači piškoti v lepem kozarcu',
      price: 6,
      q: 'kozarec za piškote',
      stores: C,
    },
    {
      id: 'h-jam',
      emoji: '🍓',
      en: 'Homemade jam or liqueur',
      sl: 'Domača marmelada ali liker',
      price: 5,
      q: 'kozarci za vlaganje',
      stores: C,
    },
    {
      id: 'h-soap',
      emoji: '🧼',
      en: 'Homemade soap or bath salts',
      sl: 'Doma narejeno milo ali kopalna sol',
      price: 8,
      q: 'milo izdelava komplet',
      stores: C,
    },
    {
      id: 'h-candle',
      emoji: '🕯️',
      en: 'Hand-poured candle',
      sl: 'Doma ulita sveča',
      price: 10,
      q: 'komplet za izdelavo sveč',
      stores: C,
    },
    {
      id: 'h-photo',
      emoji: '🖼️',
      en: 'Framed photo collage or drawing',
      sl: 'Uokvirjen kolaž fotografij ali risba',
      price: 12,
      q: 'okvir za slike',
      stores: C,
    },
    {
      id: 'h-knit',
      emoji: '🧶',
      en: 'Knitted hat or scarf',
      sl: 'Pletena kapa ali šal',
      price: 15,
      q: 'volna za pletenje',
      stores: C,
    },
    {
      id: 'h-notebook',
      emoji: '📒',
      en: 'Hand-bound notebook',
      sl: 'Ročno vezan zvezek',
      price: 9,
      q: 'papir za vezavo zvezek',
      stores: C,
    },
    {
      id: 'h-dinner',
      emoji: '🍲',
      en: 'Voucher for a homemade dinner',
      sl: 'Bon za doma pripravljeno večerjo',
      price: 20,
      q: 'kuharska knjiga',
      stores: ['emka', 'ceneje'],
    },
  ],
  experience: [
    {
      id: 'x-cinema',
      emoji: '🎬',
      en: 'Cinema tickets',
      sl: 'Vstopnice za kino',
      price: 10,
      q: 'kino vstopnica darilni bon',
      stores: ['google', 'ceneje'],
    },
    {
      id: 'x-cafe',
      emoji: '☕',
      en: 'Café or brunch voucher',
      sl: 'Bon za kavo ali zajtrk',
      price: 12,
      q: 'darilni bon zajtrk',
      stores: ['google', 'ceneje'],
    },
    {
      id: 'x-museum',
      emoji: '🏛️',
      en: 'Museum or gallery tickets',
      sl: 'Vstopnica za muzej ali galerijo',
      price: 8,
      q: 'muzej vstopnica',
      stores: ['google', 'ceneje'],
    },
    {
      id: 'x-escape',
      emoji: '🔐',
      en: 'Escape room',
      sl: 'Soba pobega',
      price: 25,
      q: 'soba pobega darilni bon',
      stores: ['google', 'ceneje'],
    },
    {
      id: 'x-climb',
      emoji: '🧗',
      en: 'Climbing or bouldering session',
      sl: 'Plezanje ali balvanski center',
      price: 15,
      q: 'plezalni center darilni bon',
      stores: ['google', 'ceneje'],
    },
    {
      id: 'x-theatre',
      emoji: '🎭',
      en: 'Theatre or concert ticket',
      sl: 'Vstopnica za gledališče ali koncert',
      price: 20,
      q: 'vstopnice gledališče koncert',
      stores: ['google', 'ceneje'],
    },
    {
      id: 'x-spa',
      emoji: '♨️',
      en: 'Spa or sauna voucher',
      sl: 'Bon za wellness ali savno',
      price: 30,
      q: 'wellness darilni bon',
      stores: ['ceneje', 'google'],
    },
    {
      id: 'x-cooking',
      emoji: '🍝',
      en: 'Cooking class',
      sl: 'Tečaj kuhanja',
      price: 40,
      q: 'tečaj kuhanja darilni bon',
      stores: ['google', 'ceneje'],
    },
  ],
  books: [
    {
      id: 'b-bookmark',
      emoji: '🔖',
      en: 'Bookmark and reading light',
      sl: 'Kazalka in lučka za branje',
      price: 8,
      q: 'lučka za branje',
      stores: C,
    },
    {
      id: 'b-pocket',
      emoji: '📕',
      en: 'Pocket paperback',
      sl: 'Žepna knjiga',
      price: 10,
      q: 'žepna knjiga',
      stores: ['emka', 'ceneje'],
    },
    {
      id: 'b-journal',
      emoji: '🖊️',
      en: 'Journal with prompts',
      sl: 'Dnevnik z vprašanji',
      price: 15,
      q: 'dnevnik',
      stores: ['emka', 'ceneje'],
    },
    {
      id: 'b-crime',
      emoji: '🔎',
      en: 'A gripping crime novel',
      sl: 'Napet kriminalni roman',
      price: 20,
      q: 'kriminalka',
      stores: ['emka', 'ceneje'],
    },
    {
      id: 'b-comic',
      emoji: '🎨',
      en: 'Graphic novel or comic',
      sl: 'Grafični roman ali strip',
      price: 18,
      q: 'strip grafični roman',
      stores: ['emka', 'ceneje'],
    },
    {
      id: 'b-travel',
      emoji: '🗺️',
      en: 'Travel guide for their dream trip',
      sl: 'Turistični vodnik za sanjsko potovanje',
      price: 22,
      q: 'turistični vodnik',
      stores: ['emka', 'ceneje'],
    },
    {
      id: 'b-cook',
      emoji: '🍳',
      en: 'Cookbook',
      sl: 'Kuharska knjiga',
      price: 25,
      q: 'kuharska knjiga',
      stores: ['emka', 'ceneje'],
    },
    {
      id: 'b-classic',
      emoji: '📚',
      en: 'Beautiful edition of a classic',
      sl: 'Lepa izdaja klasike',
      price: 28,
      q: 'klasika trda vezava',
      stores: ['emka', 'ceneje'],
    },
  ],
  eco: [
    {
      id: 'e-bag',
      emoji: '🛍️',
      en: 'Organic cotton tote bag',
      sl: 'Bombažna nakupovalna vrečka',
      price: 6,
      q: 'bombažna vrečka',
      stores: C,
    },
    {
      id: 'e-bar',
      emoji: '🧴',
      en: 'Zero-waste soap or shampoo bar',
      sl: 'Trdo milo ali trdi šampon',
      price: 7,
      q: 'trdi šampon',
      stores: C,
    },
    {
      id: 'e-wraps',
      emoji: '🐝',
      en: 'Beeswax food wraps',
      sl: 'Voščene ovojnice za hrano',
      price: 10,
      q: 'voščene ovojnice',
      stores: C,
    },
    {
      id: 'e-herbs',
      emoji: '🌱',
      en: 'Herb-growing kit',
      sl: 'Komplet za gojenje zelišč',
      price: 12,
      q: 'komplet za gojenje zelišč',
      stores: C,
    },
    {
      id: 'e-bamboo',
      emoji: '🪥',
      en: 'Bamboo toothbrush set',
      sl: 'Bambusove zobne ščetke',
      price: 5,
      q: 'bambusova zobna ščetka',
      stores: C,
    },
    {
      id: 'e-bottle',
      emoji: '🥤',
      en: 'Reusable bottle or coffee cup',
      sl: 'Steklenica ali lonček za večkratno uporabo',
      price: 15,
      q: 'termo steklenica',
      stores: C,
    },
    {
      id: 'e-solar',
      emoji: '🔦',
      en: 'Solar lantern',
      sl: 'Sončna svetilka',
      price: 18,
      q: 'solarna svetilka',
      stores: C,
    },
    {
      id: 'e-tree',
      emoji: '🌳',
      en: 'Adopt a beehive or tree in their name',
      sl: 'Posvojitev panja ali drevesa v njihovem imenu',
      price: 30,
      q: 'posvojitev panja',
      stores: ['google', 'ceneje'],
    },
  ],
  sweets: [
    {
      id: 'w-bar',
      emoji: '🍫',
      en: 'Bar of craft chocolate',
      sl: 'Tablica ročno izdelane čokolade',
      price: 4,
      q: 'ročno izdelana čokolada',
      stores: FOOD,
    },
    {
      id: 'w-candy',
      emoji: '🍬',
      en: 'Jar of favourite sweets',
      sl: 'Kozarec najljubših bonbonov',
      price: 5,
      q: 'bonboni',
      stores: FOOD,
    },
    {
      id: 'w-cocoa',
      emoji: '☕',
      en: 'Hot chocolate mix',
      sl: 'Vroča čokolada v prahu',
      price: 6,
      q: 'vroča čokolada',
      stores: FOOD,
    },
    {
      id: 'w-cookies',
      emoji: '🍪',
      en: 'Box of Christmas cookies',
      sl: 'Škatla božičnih piškotov',
      price: 8,
      q: 'božični piškoti',
      stores: FOOD,
    },
    {
      id: 'w-tea',
      emoji: '🍵',
      en: 'Fine tea',
      sl: 'Izbran čaj',
      price: 7,
      q: 'čaj',
      stores: FOOD,
    },
    {
      id: 'w-pralines',
      emoji: '🎁',
      en: 'Box of pralines',
      sl: 'Bonboniera pralinejev',
      price: 12,
      q: 'pralineji bonboniera',
      stores: FOOD,
    },
    {
      id: 'w-nuts',
      emoji: '🥜',
      en: 'Honey and nut gift set',
      sl: 'Darilni komplet medu in oreščkov',
      price: 15,
      q: 'med oreščki darilni',
      stores: ['ceneje', 'mercator'],
    },
    {
      id: 'w-baking',
      emoji: '🧁',
      en: 'Baking kit with a recipe',
      sl: 'Komplet za peko z receptom',
      price: 18,
      q: 'modelčki za peko piškotov',
      stores: C,
    },
  ],
};

export interface Suggestions {
  /** Single gifts, at most 1 € over the budget, closest to the budget first. */
  singles: GiftIdea[];
  /** Combos of 2–3 cheaper gifts that together come close to the budget (≤ budget + 1 €). */
  bundles: { items: GiftIdea[]; total: number }[];
  /** False when the budget is unknown or not in EUR (prices are EUR estimates). */
  budgetApplied: boolean;
}

/** Allowed overshoot for any suggestion. */
export const BUDGET_TOLERANCE = 1;

function combos<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combos(items.slice(i + 1), k - 1)) out.push([item, ...rest]);
  });
  return out;
}

/**
 * Theme- and budget-aware ideas. With a EUR budget: single gifts cost at most budget + 1 €, and
 * bundles of cheaper gifts add up to between ~80 % of the budget and budget + 1 €.
 */
export function suggestIdeas(
  preset: ThemePreset,
  budget: { amount: number | null; currency: string },
  limits = { singles: 6, bundles: 3 },
): Suggestions {
  const list = GIFT_IDEAS[preset === 'custom' ? 'none' : preset];
  if (budget.amount === null || budget.amount <= 0 || budget.currency !== 'EUR') {
    return { singles: list.slice(0, limits.singles), bundles: [], budgetApplied: false };
  }
  const max = budget.amount + BUDGET_TOLERANCE;
  const min = budget.amount * 0.8;

  const singles = list
    .filter((i) => i.price <= max)
    .sort((a, b) => Math.abs(budget.amount! - a.price) - Math.abs(budget.amount! - b.price))
    .slice(0, limits.singles);

  // Bundles: only from items clearly below the budget, preferring totals closest to the budget
  // and not repeating an item across bundles.
  const cheap = list.filter((i) => i.price < budget.amount!);
  const candidates = [...combos(cheap, 2), ...combos(cheap, 3)]
    .map((items) => ({ items, total: items.reduce((s, i) => s + i.price, 0) }))
    .filter((b) => b.total >= min && b.total <= max)
    .sort(
      (a, b) =>
        Math.abs(budget.amount! - a.total) - Math.abs(budget.amount! - b.total) ||
        a.items.length - b.items.length,
    );
  const bundles: Suggestions['bundles'] = [];
  const used = new Set<string>();
  for (const b of candidates) {
    if (bundles.length >= limits.bundles) break;
    if (b.items.some((i) => used.has(i.id))) continue;
    bundles.push(b);
    b.items.forEach((i) => used.add(i.id));
  }
  return { singles, bundles, budgetApplied: true };
}
