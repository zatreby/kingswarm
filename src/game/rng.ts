// Seeded randomness for the run layer. The sim's PRNG (src/sim/math.ts `rand`) is not exported from
// the sim's public API, so the same mulberry32 is copied here. Game randomness never touches a
// World's rng: drafts and ladders must not change a battle's outcome, and vice versa.

/** mulberry32 state; advanced in place. */
export interface Rng { s: number }

export function rng(seed: number): Rng {
  return { s: seed | 0 };
}

/** [0, 1). */
export function next(r: Rng): number {
  const a = (r.s + 0x6d2b79f5) | 0;
  r.s = a;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, n). */
export function below(r: Rng, n: number): number {
  return Math.floor(next(r) * n);
}

/** Mix any number of integers into one 32-bit seed (order-sensitive, avalanching). */
export function mix(...parts: number[]): number {
  let h = 0x811c9dc5 | 0;
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h | 0;
}

/** Weighted pick; returns the index, or -1 when every weight is 0. */
export function weighted(r: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return -1;
  let x = next(r) * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0 && weights[i] > 0) return i;
  }
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return -1;
}

/** Fisher-Yates on a copy. */
export function shuffled<T>(r: Rng, xs: readonly T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = below(r, i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
