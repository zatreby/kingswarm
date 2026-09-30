import { describe, expect, it } from 'vitest';
import { atan2, clamp, cos, exp, len, rand, randRange, sin } from './math';

describe('seeded PRNG', () => {
  it('produces the same sequence for the same seed and advances state', () => {
    const a = { rng: 42 };
    const b = { rng: 42 };
    const sa = [rand(a), rand(a), rand(a)];
    const sb = [rand(b), rand(b), rand(b)];
    expect(sa).toEqual(sb);
    expect(a.rng).toBe(b.rng);
    expect(a.rng).not.toBe(42);
  });

  it('differs between seeds', () => {
    expect(rand({ rng: 1 })).not.toBe(rand({ rng: 2 }));
  });

  it('stays in [0,1) and is roughly uniform', () => {
    const s = { rng: 7 };
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const v = rand(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });

  it('keeps state a 32-bit integer', () => {
    const s = { rng: 123 };
    for (let i = 0; i < 100; i++) rand(s);
    expect(Number.isInteger(s.rng)).toBe(true);
    expect(s.rng | 0).toBe(s.rng);
  });

  it('randRange maps into [a,b)', () => {
    const s = { rng: 9 };
    for (let i = 0; i < 1000; i++) {
      const v = randRange(s, -2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
    }
  });
});

describe('math helpers', () => {
  it('wraps trig and vector length', () => {
    expect(sin(0)).toBe(0);
    expect(cos(0)).toBe(1);
    expect(atan2(1, 0)).toBeCloseTo(Math.PI / 2);
    expect(exp(0)).toBe(1);
    expect(len(3, 4)).toBe(5);
    expect(clamp(5, 0, 2)).toBe(2);
    expect(clamp(-1, 0, 2)).toBe(0);
  });
});
