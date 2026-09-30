import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorld, hashWorld, meadow, step } from '../sim';
import type { MatchConfig, PlayerInput, World } from '../sim';
import { createBot } from './bot';
import { PROFILES, RIVALS, PROXIES, scaleProfile } from './profiles';
import { runMatch } from './match';

function config(seed: number, over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    seed, map: meadow,
    teams: [{ hero: 'brawler', mutations: [] }, { hero: 'brawler', mutations: [] }],
    duration: 150, crownOpensAt: 90, ...over,
  };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

describe('determinism', { timeout: 30_000 }, () => {
  it('same seed and profiles give the same final world', () => {
    const spec = { seed: 7, duration: 40, crownOpensAt: 20, sides: [{ profile: 'average' }, { profile: 'gorm' }] } as const;
    const a = runMatch({ ...spec, sides: [...spec.sides] });
    const b = runMatch({ ...spec, sides: [...spec.sides] });
    expect(a.finalHash).toBe(b.finalHash);
    expect(a.length).toBe(b.length);
    const c = runMatch({ ...spec, seed: 8, sides: [...spec.sides] });
    expect(c.finalHash).not.toBe(a.finalHash);
  });
});

describe('a bot never writes to the world', { timeout: 60_000 }, () => {
  it('leaves the world hash unchanged across think() for every profile', () => {
    for (const id of [...RIVALS, ...PROXIES, 'monkey', 'spamFire', 'crownCamp']) {
      const w = createWorld(config(3, { teams: [{ hero: 'blink', mutations: [] }, { hero: 'warden', mutations: [] }] }));
      const bots = [createBot(0, PROFILES[id], 11), createBot(1, scaleProfile(PROFILES.sable, 8), 12)];
      for (let t = 0; t < 60 * 25; t++) {
        const before = hashWorld(w);
        const inputs = [bots[0].think(w), bots[1].think(w)] as [PlayerInput, PlayerInput];
        expect(hashWorld(w), `${id} mutated the world at tick ${t}`).toBe(before);
        step(w, inputs);
        if (w.phase === 'over') break;
      }
    }
  });

  it('can think on a deep-frozen world (any write would throw in strict mode)', () => {
    const w = createWorld(config(5));
    const bots = [createBot(0, PROFILES.expert, 1), createBot(1, PROFILES.mora, 2)];
    for (let t = 0; t < 60 * 12; t++) {
      if (t % 97 === 0) {
        const frozen = deepFreeze(structuredClone(w)) as World;
        expect(() => { bots[0].think(frozen); bots[1].think(frozen); }).not.toThrow();
      }
      step(w, [bots[0].think(w), bots[1].think(w)]);
    }
  });

  it('src/ai uses no clocks or global randomness and reaches the sim only through its index', () => {
    const dir = __dirname;
    const M = 'Math.';
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
      const src = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src.includes(`${M}random`), `${f} uses global randomness`).toBe(false);
      expect(/\bDate\b|\bperformance\b/.test(src), `${f} reads a clock`).toBe(false);
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        if (m[1].includes('sim')) expect(m[1], `${f} imports sim internals`).toBe('../sim');
      }
    }
  });
});

describe('human-like limits', () => {
  it('presses buttons no faster than its button gap and never holds a button two ticks', () => {
    const w = createWorld(config(9));
    const p = PROFILES.expert;
    const bot = createBot(0, p, 3);
    const foe = createBot(1, PROFILES.gorm, 4);
    let last = -1e9;
    let prev: PlayerInput | null = null;
    for (let t = 0; t < 60 * 60 && w.phase !== 'over'; t++) {
      const i = bot.think(w);
      const pressed = i.dash || i.ability || i.ultimate || i.recall;
      if (pressed) {
        expect(w.time - last).toBeGreaterThanOrEqual(p.skill.buttonGapMs / 1000 - 1e-9);
        last = w.time;
        if (prev) expect(prev.dash || prev.ability || prev.ultimate || prev.recall).toBe(false);
      }
      prev = i;
      step(w, [i, foe.think(w)]);
    }
  });
});
