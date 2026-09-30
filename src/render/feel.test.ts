import { describe, it, expect } from 'vitest';
import { Trauma, HitStop, FlashLimiter, budgetAllows, Prio, BUDGET, SHAKE_SOURCES, wobble, easeOutBack } from './feel';

describe('trauma shake', () => {
  it('caps each source so many small hits never stack into a big shake', () => {
    const t = new Trauma();
    for (let i = 0; i < 1000; i++) t.add('land', 0.003);
    expect(t.value).toBeCloseTo(SHAKE_SOURCES.land, 5);
  });
  it('sums sources up to 1 and decays linearly to 0', () => {
    const t = new Trauma();
    t.add('big', 0.9); t.add('heroDown', 0.5);
    expect(t.value).toBe(1);
    t.reset(); t.add('capture', 0.3);
    t.update(0.1);
    expect(t.value).toBeCloseTo(0.15, 5);
    t.update(1);
    expect(t.value).toBe(0);
  });
  it('shake is trauma squared, scaled by the player setting, and zero when off', () => {
    const t = new Trauma(), o = { pitch: 0, yaw: 0, roll: 0 };
    t.add('big', 0.5);
    t.update(0.01);
    t.angles(0, o);
    expect(Math.abs(o.roll) + Math.abs(o.pitch) + Math.abs(o.yaw)).toBe(0);
    let max = 0;
    for (let i = 0; i < 200; i++) { t.update(0.0005); t.angles(1, o); max = Math.max(max, Math.abs(o.roll)); }
    expect(max).toBeLessThanOrEqual(0.25 * 1.5 * Math.PI / 180 + 1e-9);
    expect(max).toBeGreaterThan(0);
  });
});

describe('hit-stop', () => {
  it('never exceeds the 120 ms cap and ends', () => {
    const h = new HitStop();
    h.request(500);
    let ms = 0;
    while (h.update(1)) ms++;
    expect(ms).toBeLessThanOrEqual(120);
    expect(h.active).toBe(false);
  });
  it('halves requests that arrive in a burst', () => {
    const h = new HitStop();
    h.request(60); h.update(60);
    h.request(100); // 60 ms after the last one: halved to 50
    let ms = 0;
    while (h.update(1)) ms++;
    expect(ms).toBe(50);
  });
});

describe('flash limiter', () => {
  it('allows at most 3 flashes in any second', () => {
    const f = new FlashLimiter();
    const ok = [0, 0.1, 0.2, 0.3, 0.5, 0.99, 1.05, 1.11].map((t) => f.tryFlash(t));
    expect(ok).toEqual([true, true, true, false, false, false, true, true]);
  });
});

describe('particle budget', () => {
  it('drops ambient first and always lets critical through below the cap', () => {
    const cap = BUDGET.cap;
    expect(budgetAllows(Math.floor(cap * 0.7), Prio.Ambient)).toBe(false);
    expect(budgetAllows(Math.floor(cap * 0.7), Prio.Medium)).toBe(true);
    expect(budgetAllows(cap - 1, Prio.Critical)).toBe(true);
    expect(budgetAllows(cap, Prio.Critical)).toBe(false);
  });
});

describe('easing', () => {
  it('wobble starts at 1 and rings down; easeOutBack overshoots then lands on 1', () => {
    expect(wobble(0)).toBe(1);
    expect(Math.abs(wobble(0.6))).toBeLessThan(0.01);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map((t) => easeOutBack(t)))).toBeGreaterThan(1);
  });
});
