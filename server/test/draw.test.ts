import { describe, expect, it } from 'vitest';
import {
  DrawImpossibleError,
  checkFeasibility,
  draw,
  insertParticipant,
  mulberry32,
  reassign,
  validatePairs,
  type Exclusion,
  type Pairs,
} from '../src/services/draw.js';

const people = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** Random symmetric exclusions, each person getting at most `perPerson`. */
function randomExclusions(ids: string[], perPerson: number, rng: () => number): Exclusion[] {
  const count = new Map(ids.map((id) => [id, 0]));
  const out: Exclusion[] = [];
  for (let tries = 0; tries < ids.length * perPerson * 3; tries++) {
    const a = ids[Math.floor(rng() * ids.length)];
    const b = ids[Math.floor(rng() * ids.length)];
    if (a === b || count.get(a)! >= perPerson || count.get(b)! >= perPerson) continue;
    if (out.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) continue;
    out.push({ a, b });
    count.set(a, count.get(a)! + 1);
    count.set(b, count.get(b)! + 1);
  }
  return out;
}

describe('draw', () => {
  it.each([2, 3, 4, 5, 10, 20, 30])('produces a valid draw for %i participants', (n) => {
    const ids = people(n);
    const pairs = draw(ids, [], undefined, mulberry32(n));
    expect(validatePairs(ids, pairs)).toBeNull();
  });

  it('pairs two people with each other', () => {
    const pairs = draw(['a', 'b']);
    expect(pairs.get('a')).toBe('b');
    expect(pairs.get('b')).toBe('a');
  });

  it('is deterministic with a seeded rng and varies across seeds', () => {
    const ids = people(12);
    const a = draw(ids, [], undefined, mulberry32(42));
    const b = draw(ids, [], undefined, mulberry32(42));
    expect([...a]).toEqual([...b]);
    const distinct = new Set(
      Array.from({ length: 20 }, (_, s) => JSON.stringify([...draw(ids, [], undefined, mulberry32(s))])),
    );
    expect(distinct.size).toBeGreaterThan(15);
  });

  it('respects exclusions in both directions', () => {
    const ids = ['ana', 'marko', 'eva', 'luka'];
    const exclusions = [{ a: 'ana', b: 'marko' }];
    for (let seed = 0; seed < 200; seed++) {
      const pairs = draw(ids, exclusions, undefined, mulberry32(seed));
      expect(pairs.get('ana')).not.toBe('marko');
      expect(pairs.get('marko')).not.toBe('ana');
    }
  });

  it('avoids previous pairs', () => {
    const ids = people(6);
    const previous = draw(ids, [], undefined, mulberry32(1));
    for (let seed = 0; seed < 100; seed++) {
      const pairs = draw(ids, [], previous, mulberry32(seed));
      for (const [g, r] of previous) expect(pairs.get(g)).not.toBe(r);
    }
  });

  it('handles heavy exclusions (couples in a 30-person group)', () => {
    const ids = people(30);
    // 15 couples plus each person excluded from their neighbour couple.
    const exclusions: Exclusion[] = [];
    for (let i = 0; i < 30; i += 2) exclusions.push({ a: ids[i], b: ids[i + 1] });
    for (let i = 0; i < 28; i++) exclusions.push({ a: ids[i], b: ids[i + 2] });
    const pairs = draw(ids, exclusions, undefined, mulberry32(7));
    expect(validatePairs(ids, pairs, exclusions)).toBeNull();
  });

  it('solves a nearly impossible case with exactly one valid solution', () => {
    // Allowed edges form a single cycle a→b→c→d→e→a: exclude everything else.
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const exclusions: Exclusion[] = [
      { a: 'a', b: 'c' },
      { a: 'a', b: 'd' },
      { a: 'b', b: 'd' },
      { a: 'b', b: 'e' },
      { a: 'c', b: 'e' },
    ];
    // Symmetric rules leave a↔b, b↔c, c↔d, d↔e, e↔a: two cycles (both directions) are valid.
    for (let seed = 0; seed < 50; seed++) {
      const pairs = draw(ids, exclusions, undefined, mulberry32(seed));
      expect(validatePairs(ids, pairs, exclusions)).toBeNull();
    }
  });

  it('runs 1,000 random draws (2–30 people, random rules) and every result is valid', () => {
    const rng = mulberry32(2026);
    let drawn = 0;
    let impossible = 0;
    for (let run = 0; run < 1000; run++) {
      const n = 2 + Math.floor(rng() * 29);
      const ids = people(n);
      const exclusions = randomExclusions(ids, Math.floor(rng() * Math.max(1, n - 2)), rng);
      const feasibility = checkFeasibility(ids, exclusions);
      if (!feasibility.ok) {
        impossible++;
        expect(() => draw(ids, exclusions, undefined, rng)).toThrow(DrawImpossibleError);
        continue;
      }
      const pairs = draw(ids, exclusions, undefined, rng);
      expect(validatePairs(ids, pairs, exclusions)).toBeNull();
      drawn++;
    }
    expect(drawn).toBeGreaterThan(800);
    expect(drawn + impossible).toBe(1000);
  });
});

describe('feasibility', () => {
  const name = (id: string) => id.toUpperCase();

  it('needs at least two people', () => {
    const res = checkFeasibility(['solo']);
    expect(res).toMatchObject({ ok: false, code: 'too_few' });
    expect(() => draw(['solo'])).toThrow(/at least 2/);
  });

  it('rejects duplicates', () => {
    expect(checkFeasibility(['a', 'a'])).toMatchObject({ ok: false, code: 'duplicate' });
  });

  it('explains when someone can give to nobody', () => {
    const res = checkFeasibility(
      ['ana', 'bo', 'cy'],
      [
        { a: 'ana', b: 'bo' },
        { a: 'ana', b: 'cy' },
      ],
      undefined,
      name,
    );
    expect(res).toMatchObject({ ok: false, code: 'cannot_give', people: ['ana'] });
    if (!res.ok) expect(res.reason).toContain('ANA');
  });

  it('explains Hall violations: three people who can only give to two', () => {
    // a, b, c may only give to d or e → 3 givers, 2 receivers.
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const exclusions: Exclusion[] = [
      { a: 'a', b: 'b' },
      { a: 'a', b: 'c' },
      { a: 'b', b: 'c' },
    ];
    const res = checkFeasibility(ids, exclusions, undefined, name);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('too_constrained');
      expect(new Set(res.people)).toEqual(new Set(['a', 'b', 'c']));
      expect(res.reason).toMatch(/can only give to 2 people/);
    }
    expect(() => draw(ids, exclusions)).toThrow(DrawImpossibleError);
  });

  it('two people with an exclusion between them is impossible', () => {
    expect(checkFeasibility(['a', 'b'], [{ a: 'a', b: 'b' }]).ok).toBe(false);
  });

  it('ignores rules about people who are not in the draw', () => {
    expect(checkFeasibility(['a', 'b'], [{ a: 'a', b: 'zed' }]).ok).toBe(true);
  });

  it('agrees with brute force on small random cases', () => {
    const rng = mulberry32(99);
    const permutations = (arr: string[]): string[][] =>
      arr.length <= 1
        ? [arr]
        : arr.flatMap((x, i) =>
            permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]),
          );
    for (let run = 0; run < 200; run++) {
      const n = 2 + Math.floor(rng() * 5);
      const ids = people(n);
      const exclusions = randomExclusions(ids, Math.floor(rng() * n), rng);
      const brute = permutations(ids).some(
        (perm) => validatePairs(ids, new Map(ids.map((g, i) => [g, perm[i]])), exclusions) === null,
      );
      expect(checkFeasibility(ids, exclusions).ok).toBe(brute);
    }
  });
});

describe('reassign after someone drops out', () => {
  it("reconnects the dropout's Santa with the dropout's receiver (1 change)", () => {
    // Cycle a→b→c→d→e→a; c drops out → b should now give to d.
    const pairs: Pairs = new Map([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['d', 'e'],
      ['e', 'a'],
    ]);
    const { pairs: next, changed } = reassign(pairs, 'c', [], undefined, mulberry32(1));
    expect(validatePairs(['a', 'b', 'd', 'e'], next)).toBeNull();
    expect(next.get('b')).toBe('d');
    expect(changed).toEqual(['b']);
  });

  it('handles a 2-cycle with the dropout by changing two people', () => {
    const pairs: Pairs = new Map([
      ['a', 'b'],
      ['b', 'a'],
      ['c', 'd'],
      ['d', 'c'],
    ]);
    const { pairs: next, changed } = reassign(pairs, 'b', [], undefined, mulberry32(3));
    const ids = ['a', 'c', 'd'];
    expect(validatePairs(ids, next)).toBeNull();
    expect(changed).toHaveLength(2);
  });

  it('respects exclusions when reconnecting', () => {
    // b→c→d, but b and d are excluded, so b can't simply take d.
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const exclusions = [{ a: 'b', b: 'd' }];
    const pairs: Pairs = new Map([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['d', 'e'],
      ['e', 'f'],
      ['f', 'a'],
    ]);
    const { pairs: next, changed } = reassign(pairs, 'c', exclusions, undefined, mulberry32(5));
    expect(
      validatePairs(
        ids.filter((i) => i !== 'c'),
        next,
        exclusions,
      ),
    ).toBeNull();
    expect(changed.length).toBeLessThanOrEqual(3);
  });

  it('keeps most pairs unchanged across many random dropouts', () => {
    const rng = mulberry32(11);
    for (let run = 0; run < 200; run++) {
      const n = 3 + Math.floor(rng() * 28);
      const ids = people(n);
      const exclusions = randomExclusions(ids, 2, rng);
      if (!checkFeasibility(ids, exclusions).ok) continue;
      const pairs = draw(ids, exclusions, undefined, rng);
      const removed = ids[Math.floor(rng() * n)];
      const rest = ids.filter((i) => i !== removed);
      if (!checkFeasibility(rest, exclusions).ok) {
        expect(() => reassign(pairs, removed, exclusions, undefined, rng)).toThrow(DrawImpossibleError);
        continue;
      }
      const { pairs: next, changed } = reassign(pairs, removed, exclusions, undefined, rng);
      expect(validatePairs(rest, next, exclusions)).toBeNull();
      if (n >= 6) expect(changed.length).toBeLessThanOrEqual(4);
    }
  });

  it('refuses when only one person would remain', () => {
    const pairs: Pairs = new Map([
      ['a', 'b'],
      ['b', 'a'],
    ]);
    expect(() => reassign(pairs, 'a')).toThrow(DrawImpossibleError);
  });
});

describe('late joiners', () => {
  it('slots a newcomer in by changing one existing pair', () => {
    const ids = people(8);
    const pairs = draw(ids, [], undefined, mulberry32(4));
    const { pairs: next, changed } = insertParticipant(pairs, 'new', [], undefined, mulberry32(4));
    expect(validatePairs([...ids, 'new'], next)).toBeNull();
    expect(changed).toHaveLength(2);
    expect(changed).toContain('new');
  });

  it("respects the newcomer's exclusions", () => {
    const ids = people(5);
    const exclusions = [
      { a: 'new', b: 'p1' },
      { a: 'new', b: 'p2' },
    ];
    for (let seed = 0; seed < 50; seed++) {
      const pairs = draw(ids, [], undefined, mulberry32(seed));
      const { pairs: next } = insertParticipant(pairs, 'new', exclusions, undefined, mulberry32(seed));
      expect(validatePairs([...ids, 'new'], next, exclusions)).toBeNull();
    }
  });
});
