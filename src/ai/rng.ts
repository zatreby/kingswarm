// The bot's own PRNG. Bots never draw from world.rng (that would change the match for everyone)
// nor Math.random (irreproducible): a match replays from (seed, config, bot profiles).

export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed | 0;
  }

  /** mulberry32, [0, 1). */
  next(): number {
    const a = (this.s + 0x6d2b79f5) | 0;
    this.s = a;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Roughly normal, mean 0, sd 1 (Irwin-Hall of 3, rescaled): cheap and bounded at +-3. */
  gauss(): number {
    return (this.next() + this.next() + this.next() - 1.5) * 2;
  }

  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
}

/** Mix a match seed with a team and a salt into a well-spread 32-bit seed. */
export function mixSeed(seed: number, team: number, salt = 0): number {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= (team + 1) * 0x27d4eb2d;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= salt * 0x165667b1;
  h ^= h >>> 16;
  return h | 0;
}
