import { BUDGET_TOLERANCE, GIFT_IDEAS, STORES, ideaLinks, suggestIdeas } from './gift-ideas.data';

const themes = Object.keys(GIFT_IDEAS) as (keyof typeof GIFT_IDEAS)[];

describe('suggestIdeas', () => {
  it('never suggests a single gift more than 1 € over the budget', () => {
    for (const theme of themes) {
      for (const amount of [5, 10, 15, 20, 25, 30, 50]) {
        const { singles } = suggestIdeas(theme, { amount, currency: 'EUR' });
        for (const i of singles) expect(i.price).toBeLessThanOrEqual(amount + BUDGET_TOLERANCE);
      }
    }
  });

  it('builds bundles of cheaper gifts that add up close to the budget', () => {
    for (const theme of themes) {
      for (const amount of [15, 20, 25, 30]) {
        const { bundles } = suggestIdeas(theme, { amount, currency: 'EUR' });
        for (const b of bundles) {
          expect(b.items.length).toBeGreaterThanOrEqual(2);
          expect(b.items.length).toBeLessThanOrEqual(3);
          expect(b.total).toBeLessThanOrEqual(amount + BUDGET_TOLERANCE);
          expect(b.total).toBeGreaterThanOrEqual(amount * 0.8);
          expect(b.total).toBe(b.items.reduce((s, i) => s + i.price, 0));
          for (const i of b.items) expect(i.price).toBeLessThan(amount);
        }
        // Bundles don't reuse the same item.
        const ids = bundles.flatMap((b) => b.items.map((i) => i.id));
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('offers Slovenian-made combinations for a 20 € budget', () => {
    const s = suggestIdeas('slovenian', { amount: 20, currency: 'EUR' });
    expect(s.budgetApplied).toBe(true);
    expect(s.singles.length).toBeGreaterThan(0);
    expect(s.bundles.length).toBeGreaterThan(0);
    expect(s.singles[0].price).toBeLessThanOrEqual(21);
  });

  it('shows everything without a budget or with a non-EUR budget', () => {
    expect(suggestIdeas('books', { amount: null, currency: 'EUR' })).toMatchObject({
      bundles: [],
      budgetApplied: false,
    });
    expect(suggestIdeas('books', { amount: 5, currency: 'USD' }).budgetApplied).toBe(false);
    expect(suggestIdeas('custom', { amount: null, currency: 'EUR' }).singles[0]).toBe(
      GIFT_IDEAS.none[0],
    );
  });
});

describe('gift idea data', () => {
  it('has both languages, a search phrase and Slovenian store links for every idea', () => {
    const ids = new Set<string>();
    for (const list of Object.values(GIFT_IDEAS)) {
      for (const idea of list) {
        expect(ids.has(idea.id)).toBe(false);
        ids.add(idea.id);
        expect(idea.en.length).toBeGreaterThan(2);
        expect(idea.sl.length).toBeGreaterThan(2);
        expect(idea.q.length).toBeGreaterThan(2);
        const links = ideaLinks(idea);
        expect(links.length).toBeGreaterThan(0);
        for (const l of links) expect(l.url).toMatch(/^https:\/\//);
      }
    }
  });

  it('builds the verified search URLs', () => {
    expect(STORES.ceneje.search('bučno olje')).toBe(
      'https://www.ceneje.si/Iskanje/Izdelki?q=bu%C4%8Dno%20olje',
    );
    expect(STORES.mimovrste.search('med')).toBe('https://www.mimovrste.com/iskanje?s=med');
    expect(STORES.emka.search('kriminalka')).toBe('https://emka.si/search?q=kriminalka');
  });
});
