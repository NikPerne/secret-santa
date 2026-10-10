import { GIFT_IDEAS, suggestIdeas } from './gift-ideas.data';

describe('suggestIdeas', () => {
  it('uses the theme list and respects a EUR budget', () => {
    const ideas = suggestIdeas('slovenian', { amount: 15, currency: 'EUR' });
    expect(ideas.length).toBeGreaterThanOrEqual(3);
    expect(ideas.every((i) => i.price <= 16.5)).toBe(true);
    expect(ideas.every((i) => GIFT_IDEAS.slovenian.includes(i))).toBe(true);
  });

  it('ignores the price filter for other currencies or no budget', () => {
    expect(suggestIdeas('experience', { amount: 5, currency: 'USD' })).toHaveLength(6);
    expect(suggestIdeas('books', { amount: null, currency: 'EUR' })).toHaveLength(6);
  });

  it('falls back to generic ideas for custom themes and to the full list for tiny budgets', () => {
    expect(suggestIdeas('custom', { amount: null, currency: 'EUR' })[0]).toBe(GIFT_IDEAS.none[0]);
    expect(suggestIdeas('experience', { amount: 1, currency: 'EUR' })).toHaveLength(6);
  });

  it('has both languages for every idea', () => {
    for (const list of Object.values(GIFT_IDEAS)) {
      for (const idea of list) {
        expect(idea.en.length).toBeGreaterThan(2);
        expect(idea.sl.length).toBeGreaterThan(2);
      }
    }
  });
});
