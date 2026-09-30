import { describe, expect, it } from 'vitest';
import { createWorld, step } from '../sim';
import type { MatchConfig, MutationId, Team, World } from '../sim';
import { botInputs } from '../sim/testing';
import { ARENAS } from './arenas';
import { clock, createFacts, observe, summarise } from './facts';
import type { BattleFacts } from './facts';

function config(seed: number, blue: MutationId[], red: MutationId[], map = ARENAS.meadow): MatchConfig {
  return {
    seed, map, duration: 105, crownOpensAt: 45,
    teams: [{ hero: 'brawler', mutations: blue }, { hero: 'blink', mutations: red }],
  };
}

function play(cfg: MatchConfig, each?: (w: World, f: BattleFacts) => void): { w: World; f: BattleFacts } {
  const w = createWorld(cfg);
  const f = createFacts();
  for (let i = 0; i < 60 * 200 && w.phase !== 'over'; i++) {
    step(w, botInputs(w));
    observe(f, w);
    each?.(w, f);
  }
  return { w, f };
}

const count = (w: World, t: Team) => w.critters.reduce((n, c) => n + (c.alive && c.team === t ? 1 : 0), 0);
const owned = (w: World, t: Team) => w.buildings.filter((b) => b.owner === t).length;

describe('observe', () => {
  it('keeps swarm and building counts exact from events alone, through every spawning Mutation', () => {
    const blue: MutationId[] = ['splitters', 'chainReaction', 'bombers', 'militia', 'royalGuard'];
    const red: MutationId[] = ['conscription', 'bigLitter', 'brutes', 'secondWind'];
    for (const seed of [1, 2]) {
      let checks = 0;
      play(config(seed, blue, red), (w, f) => {
        if (w.tick % 30 !== 0) return;
        checks++;
        for (const t of [0, 1] as const) {
          expect(f.swarm[t], `tick ${w.tick} team ${t}`).toBe(count(w, t));
          expect(f.owned[t], `tick ${w.tick} team ${t}`).toBe(owned(w, t));
        }
      });
      expect(checks).toBeGreaterThan(50);
    }
  }, 60_000);

  it('touches the critter pool only on the first call', () => {
    const w = createWorld(config(3, [], []));
    const f = createFacts();
    step(w, botInputs(w));
    observe(f, w);
    step(w, botInputs(w));
    const trap = new Proxy(w.critters, { get(t, k) { if (k === Symbol.iterator || k === 'length' || /^\d+$/.test(String(k))) throw new Error('scanned'); return Reflect.get(t, k); } });
    expect(() => observe(f, { ...w, critters: trap })).not.toThrow();
  });

  it('records peaks, the end and takedowns', () => {
    const { w, f } = play(config(4, ['rapidFire'], []));
    expect(w.phase).toBe('over');
    expect(f.winner).toBe(w.winner);
    expect(f.reason).toBe(w.winReason);
    expect(f.endTime).toBeCloseTo(w.time);
    expect(f.swarmPeak[0]).toBeGreaterThanOrEqual(10);
    expect(f.takedowns[0]).toBe(w.stats[0].heroKills);
    if (f.endTime > 45.1) expect(f.crownOpenedAt).toBeCloseTo(45, 1);
    else expect(f.crownOpenedAt).toBe(-1);
  }, 60_000);
});

describe('summarise', () => {
  it('gives both sides 2-3 short lines from a real battle', () => {
    for (const seed of [5, 6, 7]) {
      const { w, f } = play(config(seed, [], ['homing']));
      for (const t of [0, 1] as const) {
        const s = summarise(f, w, t);
        expect(s.lines.length).toBeGreaterThanOrEqual(2);
        expect(s.lines.length).toBeLessThanOrEqual(3);
        for (const l of s.lines) expect(l.split(' ').length).toBeLessThanOrEqual(8);
        expect(s.numbers.won).toBe(w.winner === t);
      }
    }
  }, 60_000);

  function fakeWorld(over: Partial<World> = {}): World {
    const w = createWorld(config(1, [], []));
    return { ...w, time: 100, ...over };
  }

  it('leads a loss with the near-miss', () => {
    const f = createFacts();
    f.started = true;
    f.winner = 1; f.reason = 'crown'; f.endTime = 98;
    f.crownPeak = [8.44, 10];
    f.throneLow = [100, 9.2];
    f.swarmPeak = [30, 40];
    const s = summarise(f, fakeWorld(), 0);
    expect(s.lines[0]).toBe('Crown held 8.4 of 10 s');
    expect(s.lines[1]).toBe('Their Throne was down to 9%');
    expect(s.numbers.won).toBe(false);
  });

  it('leads a close time-out loss with the building margin', () => {
    const f = createFacts();
    f.started = true;
    f.winner = 1; f.reason = 'time'; f.owned = [5, 6];
    expect(summarise(f, fakeWorld(), 0).lines[0]).toBe('Lost on buildings by just 1');
  });

  it('leads a win with how it was won, then the brags', () => {
    const f = createFacts();
    f.started = true;
    f.winner = 0; f.reason = 'throne'; f.endTime = 72.4;
    f.takedowns = [3, 1];
    f.swarmPeak = [46, 20];
    const s = summarise(f, fakeWorld(), 0);
    expect(s.lines[0]).toBe('Throne taken at 1:12');
    expect(s.lines).toContain('3 King takedowns');
    expect(s.lines).toContain('Swarm peak 46');
  });

  it('celebrates a comeback over a plain swarm count', () => {
    const f = createFacts();
    f.started = true;
    f.winner = 1; f.reason = 'crown'; f.endTime = 140;
    f.worstDeficit = [0, 3];
    const s = summarise(f, fakeWorld(), 1);
    expect(s.lines[0]).toBe('Crown held at 2:20');
    expect(s.lines[1]).toBe('Came back from 3 buildings down');
  });
});

describe('clock', () => {
  it('formats elapsed seconds as m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(72.9)).toBe('1:12');
    expect(clock(150)).toBe('2:30');
  });
});
