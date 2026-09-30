import { describe, expect, it } from 'vitest';
import { hashWorld } from './hash';
import { step } from './step';
import { botInputs, testConfig } from './testing';
import type { World } from './types';
import { createWorld } from './world';

function play(seed: number, ticks: number, onTick?: (w: World) => void): World {
  const w = createWorld(testConfig({ seed }));
  for (let i = 0; i < ticks && w.phase !== 'over'; i++) {
    step(w, botInputs(w));
    onTick?.(w);
  }
  return w;
}

function assertFinite(w: World): void {
  for (const h of w.heroes)
    for (const v of [h.x, h.y, h.vx, h.vy, h.hp, h.aimX, h.aimY])
      if (!Number.isFinite(v)) throw new Error(`hero ${h.team} non-finite at tick ${w.tick}`);
  for (const c of w.critters) {
    if (!c.alive) continue;
    for (const v of [c.x, c.y, c.vx, c.vy, c.hp])
      if (!Number.isFinite(v)) throw new Error(`critter ${c.id} non-finite at tick ${w.tick}`);
  }
  for (const b of w.buildings) if (!Number.isFinite(b.control)) throw new Error(`building ${b.id} control NaN`);
}

describe('determinism', () => {
  it('same seed + same scripted inputs for 3000 ticks -> identical hash', () => {
    const a = play(1234, 3000);
    const b = play(1234, 3000);
    expect(a.tick).toBe(b.tick);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });

  it('matches tick by tick, not just at the end', () => {
    const ha: number[] = [];
    const hb: number[] = [];
    play(77, 600, (w) => ha.push(hashWorld(w)));
    play(77, 600, (w) => hb.push(hashWorld(w)));
    expect(ha).toEqual(hb);
  });

  it('a different seed diverges', () => {
    expect(hashWorld(play(1, 600))).not.toBe(hashWorld(play(2, 600)));
  });

  it('hash is sensitive to gameplay state', () => {
    const w = createWorld(testConfig());
    const h0 = hashWorld(w);
    w.critters[3].x += 1e-9;
    expect(hashWorld(w)).not.toBe(h0);
    w.critters[3].x -= 1e-9;
    w.heroes[1].cd[0] = 0.5;
    expect(hashWorld(w)).not.toBe(h0);
  });
});

describe('a full scripted match', () => {
  it('reaches over with every value finite on every tick', () => {
    for (const seed of [1, 2, 3]) {
      const cfg = testConfig({ seed, duration: 60, crownOpensAt: 20 });
      const w = createWorld(cfg);
      const seen = new Set<string>();
      for (let i = 0; i < 60 * 400 && w.phase !== 'over'; i++) {
        step(w, botInputs(w));
        assertFinite(w);
        for (const e of w.events) seen.add(e.type);
      }
      expect(w.phase, `seed ${seed}`).toBe('over');
      expect(w.winner).not.toBe(-1);
      expect(w.winReason).not.toBeNull();
      for (const t of ['throw', 'land', 'hatch', 'capture', 'crownOpen', 'matchEnd']) expect(seen, `seed ${seed}`).toContain(t);
    }
  });
});
