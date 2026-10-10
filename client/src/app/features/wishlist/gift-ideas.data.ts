import { ThemePreset } from '../../core/models';

/** A curated gift idea with a typical price in EUR (used to match the group budget). */
export interface GiftIdea {
  emoji: string;
  en: string;
  sl: string;
  price: number;
}

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

const generic: GiftIdea[] = [
  { emoji: '🧦', en: 'Cosy warm socks', sl: 'Tople mehke nogavice', price: 10 },
  {
    emoji: '☕',
    en: 'Specialty coffee or tea with a nice mug',
    sl: 'Izbrana kava ali čaj s skodelico',
    price: 18,
  },
  { emoji: '🕯️', en: 'Scented candle', sl: 'Dišeča sveča', price: 15 },
  { emoji: '🧩', en: 'Puzzle or board game', sl: 'Sestavljanka ali družabna igra', price: 25 },
  { emoji: '📓', en: 'Beautiful notebook and pen', sl: 'Lep zvezek in pisalo', price: 15 },
  { emoji: '🪴', en: 'Easy-care houseplant', sl: 'Nezahtevna sobna rastlina', price: 15 },
  { emoji: '🧣', en: 'Scarf, hat or gloves', sl: 'Šal, kapa ali rokavice', price: 25 },
  {
    emoji: '🎧',
    en: 'Small gadget (power bank, earbuds case)',
    sl: 'Mala naprava (prenosna baterija, ovitek)',
    price: 30,
  },
  { emoji: '🍷', en: 'A good bottle of wine', sl: 'Dobra steklenica vina', price: 20 },
  {
    emoji: '🎨',
    en: 'Creative kit (painting, crafts)',
    sl: 'Ustvarjalni komplet (slikanje, ročna dela)',
    price: 30,
  },
];

export const GIFT_IDEAS: Record<Exclude<ThemePreset, 'custom'>, GiftIdea[]> = {
  none: generic,
  slovenian: [
    {
      emoji: '🍯',
      en: 'Honey from a Slovenian beekeeper (Carniolan bee)',
      sl: 'Med slovenskega čebelarja (kranjska čebela)',
      price: 10,
    },
    { emoji: '🫒', en: 'Styrian pumpkin seed oil', sl: 'Štajersko bučno olje', price: 10 },
    {
      emoji: '🧂',
      en: 'Piran sea salt or salt flower',
      sl: 'Piranska sol ali solni cvet',
      price: 8,
    },
    {
      emoji: '❤️',
      en: 'Decorated gingerbread heart (lectovo srce)',
      sl: 'Lectovo srce',
      price: 12,
    },
    {
      emoji: '🍷',
      en: 'Slovenian wine (Cviček, Teran, Rebula)',
      sl: 'Slovensko vino (cviček, teran, rebula)',
      price: 15,
    },
    { emoji: '🥩', en: 'Kras prosciutto and cheese', sl: 'Kraški pršut in sir', price: 30 },
    { emoji: '🥮', en: 'Homemade potica', sl: 'Domača potica', price: 20 },
    { emoji: '🪡', en: 'Idrija lace', sl: 'Idrijska čipka', price: 35 },
    {
      emoji: '🏺',
      en: 'Ceramics by a Slovenian designer',
      sl: 'Keramika slovenskega oblikovalca',
      price: 30,
    },
    { emoji: '📖', en: 'Book by a Slovenian author', sl: 'Knjiga slovenskega avtorja', price: 20 },
    {
      emoji: '🧴',
      en: 'Slovenian natural cosmetics',
      sl: 'Slovenska naravna kozmetika',
      price: 20,
    },
    {
      emoji: '🧦',
      en: 'Slovenian-made wool slippers or socks',
      sl: 'Volnene copate ali nogavice slovenske izdelave',
      price: 25,
    },
  ],
  handmade: [
    {
      emoji: '🍪',
      en: 'Home-baked cookies in a pretty jar',
      sl: 'Domači piškoti v lepem kozarcu',
      price: 8,
    },
    {
      emoji: '🧶',
      en: 'Knitted or crocheted hat/scarf',
      sl: 'Pletena ali kvačkana kapa/šal',
      price: 15,
    },
    { emoji: '🕯️', en: 'Hand-poured candle', sl: 'Doma ulita sveča', price: 10 },
    {
      emoji: '🖼️',
      en: 'Framed photo collage or drawing',
      sl: 'Uokvirjen kolaž fotografij ali risba',
      price: 15,
    },
    { emoji: '🍓', en: 'Homemade jam or liqueur', sl: 'Domača marmelada ali liker', price: 10 },
    {
      emoji: '🧼',
      en: 'Homemade soap or bath salts',
      sl: 'Doma narejeno milo ali kopalna sol',
      price: 10,
    },
    { emoji: '📒', en: 'Hand-bound notebook', sl: 'Ročno vezan zvezek', price: 12 },
    {
      emoji: '🎟️',
      en: 'Voucher for a homemade dinner',
      sl: 'Bon za doma pripravljeno večerjo',
      price: 20,
    },
  ],
  experience: [
    { emoji: '🎬', en: 'Cinema tickets', sl: 'Vstopnice za kino', price: 15 },
    { emoji: '♨️', en: 'Spa or sauna voucher', sl: 'Bon za wellness ali savno', price: 40 },
    {
      emoji: '🧗',
      en: 'Climbing or escape room session',
      sl: 'Plezanje ali soba pobega',
      price: 30,
    },
    { emoji: '🍝', en: 'Cooking class', sl: 'Tečaj kuhanja', price: 50 },
    {
      emoji: '🎭',
      en: 'Theatre or concert tickets',
      sl: 'Vstopnice za gledališče ali koncert',
      price: 35,
    },
    { emoji: '☕', en: 'Café or brunch voucher', sl: 'Bon za kavo ali zajtrk', price: 15 },
    { emoji: '🛶', en: 'Kayak or SUP rental', sl: 'Najem kajaka ali SUP-a', price: 30 },
    { emoji: '🏛️', en: 'Museum or gallery pass', sl: 'Vstopnica za muzej ali galerijo', price: 12 },
  ],
  books: [
    { emoji: '🔎', en: 'A gripping crime novel', sl: 'Napet kriminalni roman', price: 18 },
    {
      emoji: '🍳',
      en: 'Cookbook from their favourite cuisine',
      sl: 'Kuharska knjiga njihove najljubše kuhinje',
      price: 25,
    },
    {
      emoji: '🗺️',
      en: 'Travel guide for their dream trip',
      sl: 'Turistični vodnik za sanjsko potovanje',
      price: 20,
    },
    { emoji: '📚', en: 'Beautiful edition of a classic', sl: 'Lepa izdaja klasike', price: 25 },
    { emoji: '🎨', en: 'Graphic novel or comic', sl: 'Grafični roman ali strip', price: 20 },
    { emoji: '🔖', en: 'Bookmark and reading light', sl: 'Kazalka in lučka za branje', price: 12 },
    { emoji: '🎧', en: 'Audiobook subscription', sl: 'Naročnina na zvočne knjige', price: 10 },
    { emoji: '🖊️', en: 'Journal with prompts', sl: 'Dnevnik z vprašanji', price: 15 },
  ],
  eco: [
    {
      emoji: '🥤',
      en: 'Reusable bottle or coffee cup',
      sl: 'Steklenica ali lonček za večkratno uporabo',
      price: 15,
    },
    { emoji: '🐝', en: 'Beeswax food wraps', sl: 'Voščene ovojnice za hrano', price: 12 },
    { emoji: '🌱', en: 'Herb-growing kit', sl: 'Komplet za gojenje zelišč', price: 15 },
    { emoji: '🛍️', en: 'Organic cotton tote bag', sl: 'Bombažna nakupovalna vrečka', price: 10 },
    { emoji: '♻️', en: 'Great second-hand find', sl: 'Odlična rabljena najdba', price: 15 },
    {
      emoji: '🧴',
      en: 'Zero-waste soap or shampoo bar',
      sl: 'Trdo milo ali šampon brez embalaže',
      price: 10,
    },
    {
      emoji: '🌳',
      en: 'Adopt a tree or bee hive in their name',
      sl: 'Posvojitev drevesa ali panja v njihovem imenu',
      price: 30,
    },
    {
      emoji: '🔦',
      en: 'Solar lantern or power bank',
      sl: 'Sončna svetilka ali baterija',
      price: 25,
    },
  ],
  sweets: [
    {
      emoji: '🍫',
      en: 'Craft chocolate selection',
      sl: 'Izbor ročno izdelane čokolade',
      price: 15,
    },
    { emoji: '🍪', en: 'Box of Christmas cookies', sl: 'Škatla božičnih piškotov', price: 10 },
    { emoji: '☕', en: 'Hot chocolate kit', sl: 'Komplet za vročo čokolado', price: 12 },
    { emoji: '🍬', en: 'Jar of favourite sweets', sl: 'Kozarec najljubših sladkarij', price: 8 },
    {
      emoji: '🍯',
      en: 'Honey and nut gift set',
      sl: 'Darilni komplet medu in oreščkov',
      price: 18,
    },
    { emoji: '🧁', en: 'Baking kit with a recipe', sl: 'Komplet za peko z receptom', price: 20 },
    { emoji: '🍵', en: 'Fine tea with a treat', sl: 'Izbran čaj s sladkim priboljškom', price: 15 },
    { emoji: '🎂', en: 'Voucher for a pastry shop', sl: 'Bon za slaščičarno', price: 20 },
  ],
};

/**
 * Up to `limit` ideas for the group's theme that fit the budget (EUR only; other currencies
 * skip the price filter). Custom themes fall back to generic ideas.
 */
export function suggestIdeas(
  preset: ThemePreset,
  budget: { amount: number | null; currency: string },
  limit = 6,
): GiftIdea[] {
  const list = GIFT_IDEAS[preset === 'custom' ? 'none' : preset];
  const max = budget.amount !== null && budget.currency === 'EUR' ? budget.amount * 1.1 : Infinity;
  const fitting = list.filter((i) => i.price <= max);
  return (fitting.length >= 3 ? fitting : list).slice(0, limit);
}
