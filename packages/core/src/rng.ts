// Spec: spec/sprite.md "PRNG". mulberry32 returning uint32. Call order is part of the algorithm.

export interface Rng {
  /** Next uint32. */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** True with probability pct/100. */
  chance(pct: number): boolean;
}

export function createRng(seed: number): Rng {
  let a = seed | 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    next,
    int: (n) => next() % n,
    chance: (pct) => next() % 100 < pct,
  };
}
