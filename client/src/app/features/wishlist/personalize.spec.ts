import { suggestIdeas } from './gift-ideas.data';
import { IDEA_TOPICS, analyze, findTopics } from './personalize';
import { GIFT_IDEAS } from './gift-ideas.data';

describe('findTopics', () => {
  it('understands Slovenian and English, with or without č/š/ž', () => {
    expect([...findTopics('Rada pije kavo in bere kriminalke').keys()]).toEqual(
      expect.arrayContaining(['coffee', 'books']),
    );
    expect(findTopics('cokolada').get('chocolate')).toBe('cokolada');
    expect(findTopics('Čokolada').get('chocolate')).toBe('Čokolada');
    expect(findTopics('loves hiking and board games').has('outdoor')).toBe(true);
  });

  it('does not trip over short look-alike words', () => {
    // "medtem" is not honey, "šola" is not salt, "rumena" is not rum, "beer" is not bees.
    expect(findTopics('medtem pa šola in rumena barva').size).toBe(0);
    expect(findTopics('beer').has('honey')).toBe(false);
    expect(findTopics('beer').has('alcohol')).toBe(true);
  });
});

describe('personalized suggestions', () => {
  it('puts ideas matching their likes first and says why', () => {
    const s = suggestIdeas(
      'none',
      { amount: 15, currency: 'EUR' },
      { likes: 'Obožuje čaj in knjige' },
    );
    expect(s.personalized).toBe(true);
    const first = s.singles[0];
    expect(first.because.length).toBeGreaterThan(0);
    expect(IDEA_TOPICS[first.idea.id].some((t) => t === 'tea' || t === 'books')).toBe(true);
    for (const i of s.singles) expect(i.idea.price).toBeLessThanOrEqual(16);
  });

  it('removes everything in their "please no" list', () => {
    const s = suggestIdeas(
      'slovenian',
      { amount: 20, currency: 'EUR' },
      { dislikes: 'Brez alkohola, ne maram čokolade' },
    );
    const all = [...s.singles, ...s.bundles.flatMap((b) => b.items)];
    for (const i of all) {
      expect(IDEA_TOPICS[i.idea.id]).not.toContain('alcohol');
      expect(IDEA_TOPICS[i.idea.id]).not.toContain('chocolate');
    }
    expect(s.avoided).toEqual(expect.arrayContaining(['alkohola', 'čokolade']));
  });

  it('a dislike wins over a like for the same topic', () => {
    const p = analyze({ likes: 'vino', dislikes: 'vino ne' });
    expect(p.liked.has('alcohol')).toBe(false);
  });

  it('uses their wishlist titles as interests and keeps the theme', () => {
    const s = suggestIdeas(
      'slovenian',
      { amount: 12, currency: 'EUR' },
      { wishes: ['Med iz Bohinja'] },
    );
    expect(s.singles[0].idea.id).toBe('s-honey');
    const slovenianIds = new Set(GIFT_IDEAS.slovenian.map((i) => i.id));
    for (const i of s.singles) expect(slovenianIds.has(i.idea.id)).toBe(true);
  });

  it('prefers bundles that contain things they like', () => {
    const s = suggestIdeas('sweets', { amount: 20, currency: 'EUR' }, { likes: 'tea' });
    expect(s.bundles.length).toBeGreaterThan(0);
    expect(s.bundles[0].items.some((i) => i.because.length > 0)).toBe(true);
    for (const b of s.bundles) expect(b.total).toBeLessThanOrEqual(21);
  });

  it('falls back to general ideas when they wrote nothing', () => {
    const s = suggestIdeas('none', { amount: 20, currency: 'EUR' }, {});
    expect(s.personalized).toBe(false);
    expect(s.singles.every((i) => i.because.length === 0)).toBe(true);
  });

  it('has topics for every idea', () => {
    for (const list of Object.values(GIFT_IDEAS)) {
      for (const idea of list) expect(IDEA_TOPICS[idea.id]?.length).toBeGreaterThan(0);
    }
  });
});
