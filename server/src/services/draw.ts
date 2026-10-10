/**
 * Secret Santa draw: pure functions, no I/O.
 *
 * Participants and rules form a bipartite graph of allowed "giver → receiver" edges. A valid
 * draw is a perfect matching in that graph (a permutation with no fixed points, since nobody
 * may draw themselves). Feasibility is decided exactly with maximum matching, and Hall's
 * theorem gives a human-readable explanation when it's impossible.
 */

export type Id = string;
export interface Exclusion {
  a: Id;
  b: Id;
}
export type Pairs = Map<Id, Id>;
export type Rng = () => number;
export type PairList = Iterable<readonly [Id, Id]>;

export type InfeasibleCode = 'too_few' | 'duplicate' | 'cannot_give' | 'cannot_receive' | 'too_constrained';

export type Feasibility = { ok: true } | { ok: false; code: InfeasibleCode; reason: string; people: Id[] };

export class DrawImpossibleError extends Error {
  constructor(
    public readonly code: InfeasibleCode,
    reason: string,
    public readonly people: Id[] = [],
  ) {
    super(reason);
    this.name = 'DrawImpossibleError';
  }
}

/** Small, fast, seedable PRNG (deterministic draws in tests). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const listNames = (ids: Id[], nameOf: (id: Id) => string) => {
  const names = ids.map(nameOf);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
};

/**
 * giver → set of allowed receivers. Exclusions are symmetric; previous pairs forbid giving to the
 * same person again (directional). Unknown ids in rules are ignored.
 */
export function buildAllowed(
  ids: Id[],
  exclusions: Exclusion[] = [],
  previousPairs?: PairList,
): Map<Id, Set<Id>> {
  const present = new Set(ids);
  const forbidden = new Set<string>();
  for (const { a, b } of exclusions) {
    if (!present.has(a) || !present.has(b)) continue;
    forbidden.add(`${a}>${b}`);
    forbidden.add(`${b}>${a}`);
  }
  for (const [g, r] of previousPairs ?? []) forbidden.add(`${g}>${r}`);

  const allowed = new Map<Id, Set<Id>>();
  for (const g of ids) {
    allowed.set(g, new Set(ids.filter((r) => r !== g && !forbidden.has(`${g}>${r}`))));
  }
  return allowed;
}

/**
 * Maximum bipartite matching (Kuhn's augmenting paths). `order`/neighbour order can be shuffled
 * for a randomized result. Returns receiver → giver.
 */
function maxMatching(givers: Id[], allowed: Map<Id, Set<Id>>, rng?: Rng): Map<Id, Id> {
  const matchOfReceiver = new Map<Id, Id>();
  const neighbours = new Map<Id, Id[]>();
  for (const g of givers) {
    const list = [...(allowed.get(g) ?? [])];
    neighbours.set(g, rng ? shuffle(list, rng) : list);
  }
  const tryAugment = (g: Id, seen: Set<Id>): boolean => {
    for (const r of neighbours.get(g) ?? []) {
      if (seen.has(r)) continue;
      seen.add(r);
      const current = matchOfReceiver.get(r);
      if (current === undefined || tryAugment(current, seen)) {
        matchOfReceiver.set(r, g);
        return true;
      }
    }
    return false;
  };
  const matchedGivers = new Set(matchOfReceiver.values());
  for (const g of rng ? shuffle(givers, rng) : givers) {
    if (!matchedGivers.has(g)) tryAugment(g, new Set());
  }
  return matchOfReceiver;
}

/** Checks whether a valid draw exists and explains why not when it doesn't. */
export function checkFeasibility(
  ids: Id[],
  exclusions: Exclusion[] = [],
  previousPairs?: PairList,
  nameOf: (id: Id) => string = (id) => id,
): Feasibility {
  if (new Set(ids).size !== ids.length) {
    return { ok: false, code: 'duplicate', reason: 'Someone is listed twice.', people: [] };
  }
  if (ids.length < 2) {
    return {
      ok: false,
      code: 'too_few',
      reason: 'You need at least 2 participants to draw names.',
      people: [...ids],
    };
  }
  const allowed = buildAllowed(ids, exclusions, previousPairs);

  for (const g of ids) {
    if (allowed.get(g)!.size === 0) {
      return {
        ok: false,
        code: 'cannot_give',
        reason: `Too many rules for ${nameOf(g)}: they can't give to anyone. Remove one of their rules.`,
        people: [g],
      };
    }
  }
  for (const r of ids) {
    if (!ids.some((g) => allowed.get(g)!.has(r))) {
      return {
        ok: false,
        code: 'cannot_receive',
        reason: `Too many rules for ${nameOf(r)}: nobody can give to them. Remove one of their rules.`,
        people: [r],
      };
    }
  }

  const matching = maxMatching(ids, allowed);
  if (matching.size === ids.length) return { ok: true };

  // Hall's theorem: from an unmatched giver, the givers reachable by alternating paths (S) can
  // only reach |S| - 1 receivers between them. That set is the explanation.
  const giverOf = matching;
  const receiverOf = new Map([...matching].map(([r, g]) => [g, r]));
  const start = ids.find((g) => !receiverOf.has(g))!;
  const S = new Set<Id>([start]);
  const N = new Set<Id>();
  const queue = [start];
  while (queue.length) {
    const g = queue.shift()!;
    for (const r of allowed.get(g)!) {
      if (N.has(r)) continue;
      N.add(r);
      const next = giverOf.get(r);
      if (next !== undefined && !S.has(next)) {
        S.add(next);
        queue.push(next);
      }
    }
  }
  const people = [...S];
  return {
    ok: false,
    code: 'too_constrained',
    reason:
      `Too many rules: ${listNames(people, nameOf)} can only give to ${N.size} ` +
      `${N.size === 1 ? 'person' : 'people'} between them (${listNames([...N], nameOf)}). ` +
      'Remove a rule for one of them.',
    people,
  };
}

/** Returns null when `pairs` is a valid draw for `ids`, or a description of the first problem. */
export function validatePairs(
  ids: Id[],
  pairs: Pairs,
  exclusions: Exclusion[] = [],
  previousPairs?: PairList,
): string | null {
  if (pairs.size !== ids.length) return `expected ${ids.length} pairs, got ${pairs.size}`;
  const allowed = buildAllowed(ids, exclusions, previousPairs);
  const received = new Set<Id>();
  for (const g of ids) {
    const r = pairs.get(g);
    if (r === undefined) return `${g} has no receiver`;
    if (r === g) return `${g} draws themselves`;
    if (!allowed.get(g)!.has(r)) return `${g} → ${r} breaks a rule`;
    if (received.has(r)) return `${r} receives twice`;
    received.add(r);
  }
  return null;
}

const MAX_BACKTRACK_STEPS = 20_000;

/**
 * Randomized backtracking with "most constrained giver first" and forward checking. Returns null
 * if the step budget runs out (the caller then falls back to randomized matching).
 */
function backtrack(ids: Id[], allowed: Map<Id, Set<Id>>, rng: Rng): Pairs | null {
  const pairs: Pairs = new Map();
  const used = new Set<Id>();
  let steps = 0;

  const available = (g: Id) => [...allowed.get(g)!].filter((r) => !used.has(r));

  const solve = (): boolean | null => {
    if (++steps > MAX_BACKTRACK_STEPS) return null;
    const remaining = ids.filter((g) => !pairs.has(g));
    if (!remaining.length) return true;

    let best: Id | undefined;
    let bestOptions: Id[] = [];
    for (const g of shuffle(remaining, rng)) {
      const opts = available(g);
      if (opts.length === 0) return false; // forward check: dead end
      if (best === undefined || opts.length < bestOptions.length) {
        best = g;
        bestOptions = opts;
      }
    }
    for (const r of shuffle(bestOptions, rng)) {
      pairs.set(best!, r);
      used.add(r);
      const res = solve();
      if (res !== false) return res;
      pairs.delete(best!);
      used.delete(r);
    }
    return false;
  };

  return solve() === true ? pairs : null;
}

/**
 * Draws names. Throws DrawImpossibleError (with a readable reason) when the rules make it impossible.
 * `previousPairs` (e.g. last year's) are avoided as a hard rule.
 */
export function draw(
  ids: Id[],
  exclusions: Exclusion[] = [],
  previousPairs?: PairList,
  rng: Rng = Math.random,
  nameOf?: (id: Id) => string,
): Pairs {
  const prev = previousPairs ? [...previousPairs] : undefined;
  const feasibility = checkFeasibility(ids, exclusions, prev, nameOf);
  if (!feasibility.ok)
    throw new DrawImpossibleError(feasibility.code, feasibility.reason, feasibility.people);

  const allowed = buildAllowed(ids, exclusions, prev);
  const result = backtrack(ids, allowed, rng);
  if (result) return result;

  // Fallback (pathological rule sets): randomized maximum matching always succeeds when feasible.
  const matching = maxMatching(ids, allowed, rng);
  return new Map([...matching].map(([r, g]) => [g, r]));
}

function* combinations<T>(items: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= items.length - k; i++) {
    for (const rest of combinations(items.slice(i + 1), k - 1)) yield [items[i], ...rest];
  }
}

/** Perfect matching of `givers` onto exactly `receivers`, or null. */
function matchExactly(givers: Id[], receivers: Id[], allowed: Map<Id, Set<Id>>, rng: Rng): Pairs | null {
  const pool = new Set(receivers);
  const restricted = new Map(
    givers.map((g) => [g, new Set([...allowed.get(g)!].filter((r) => pool.has(r)))]),
  );
  const m = maxMatching(givers, restricted, rng);
  return m.size === givers.length ? new Map([...m].map(([r, g]) => [g, r])) : null;
}

export interface RepairResult {
  pairs: Pairs;
  /** Givers whose receiver changed (they should be told). */
  changed: Id[];
}

/**
 * Fixes a partial assignment where `openGivers` have no receiver and `openReceivers` nobody gives
 * to them, changing as few existing pairs as possible: first only the open givers, then releasing
 * 1, 2 or 3 extra givers, and finally a full redraw.
 */
function repair(
  ids: Id[],
  kept: Pairs,
  openGivers: Id[],
  openReceivers: Id[],
  exclusions: Exclusion[],
  previousPairs: PairList | undefined,
  rng: Rng,
  original: Pairs,
): RepairResult {
  const prev = previousPairs ? [...previousPairs] : undefined;
  const allowed = buildAllowed(ids, exclusions, prev);
  const others = shuffle(
    ids.filter((g) => kept.has(g)),
    rng,
  );

  // A consistent assignment always has as many open givers as open receivers.
  const repairable = openGivers.length === openReceivers.length;
  for (let extra = 0; repairable && extra <= Math.min(3, others.length); extra++) {
    for (const released of combinations(others, extra)) {
      const givers = [...openGivers, ...released];
      const receivers = [...openReceivers, ...released.map((g) => kept.get(g)!)];
      const solved = matchExactly(givers, receivers, allowed, rng);
      if (!solved) continue;
      const pairs = new Map(kept);
      for (const [g, r] of solved) pairs.set(g, r);
      return { pairs, changed: ids.filter((g) => original.get(g) !== pairs.get(g)) };
    }
  }

  const pairs = draw(ids, exclusions, prev, rng);
  return { pairs, changed: ids.filter((g) => original.get(g) !== pairs.get(g)) };
}

/** Removes someone after the draw with minimal changes to everyone else's match. */
export function reassign(
  current: Pairs,
  removedId: Id,
  exclusions: Exclusion[] = [],
  previousPairs?: PairList,
  rng: Rng = Math.random,
  nameOf?: (id: Id) => string,
): RepairResult {
  const ids = [...current.keys()].filter((id) => id !== removedId);
  const feasibility = checkFeasibility(ids, exclusions, previousPairs, nameOf);
  if (!feasibility.ok)
    throw new DrawImpossibleError(feasibility.code, feasibility.reason, feasibility.people);

  const kept: Pairs = new Map();
  const openGivers: Id[] = [];
  for (const [g, r] of current) {
    if (g === removedId) continue;
    if (r === removedId) openGivers.push(g);
    else kept.set(g, r);
  }
  const removedGaveTo = current.get(removedId);
  const openReceivers = removedGaveTo !== undefined && removedGaveTo !== removedId ? [removedGaveTo] : [];
  return repair(ids, kept, openGivers, openReceivers, exclusions, previousPairs, rng, current);
}

/** Adds a late joiner after the draw, changing as few existing pairs as possible. */
export function insertParticipant(
  current: Pairs,
  newId: Id,
  exclusions: Exclusion[] = [],
  previousPairs?: PairList,
  rng: Rng = Math.random,
  nameOf?: (id: Id) => string,
): RepairResult {
  if (current.has(newId)) return { pairs: new Map(current), changed: [] };
  const ids = [...current.keys(), newId];
  const feasibility = checkFeasibility(ids, exclusions, previousPairs, nameOf);
  if (!feasibility.ok)
    throw new DrawImpossibleError(feasibility.code, feasibility.reason, feasibility.people);
  return repair(ids, new Map(current), [newId], [newId], exclusions, previousPairs, rng, current);
}
