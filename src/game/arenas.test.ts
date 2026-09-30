import { describe, expect, it } from 'vitest';
import { createWorld, idleInputs, step } from '../sim';
import type { MapDef } from '../sim';
import { ARENAS, placedObstacles, segDist, validateArena } from './arenas';
import { RIVALS, RIVAL_IDS } from './content';

function config(map: MapDef) {
  return {
    seed: 7, map, duration: 105, crownOpensAt: 45,
    teams: [{ hero: 'brawler', mutations: [] }, { hero: 'warden', mutations: [] }],
  } as const;
}

describe('arenas', () => {
  it('every rival has an arena', () => {
    for (const id of RIVAL_IDS) expect(ARENAS[RIVALS[id].arena], id).toBeDefined();
    expect(RIVALS.bumble.arena).toBe('meadow');
  });

  it('ids match their registry keys', () => {
    for (const [id, m] of Object.entries(ARENAS)) expect(m.id).toBe(id);
  });

  for (const [id, map] of Object.entries(ARENAS)) {
    it(`${id} satisfies every layout rule`, () => {
      expect(validateArena(map)).toEqual([]);
    });

    it(`${id} builds a world and runs`, () => {
      const w = createWorld({ ...config(map), teams: [{ hero: 'brawler', mutations: [] }, { hero: 'warden', mutations: [] }] });
      expect(w.buildings.length).toBe(map.half.length * 2 + 1);
      for (let i = 0; i < 120; i++) step(w, idleInputs());
      expect(w.winner).toBe(-1);
    });
  }

  it('tinkerworks has 1-2 Towers per side', () => {
    const towers = ARENAS.tinkerworks.half.filter((b) => b.kind === 'tower').length;
    expect(towers).toBeGreaterThanOrEqual(1);
    expect(towers).toBeLessThanOrEqual(2);
  });

  it('crownhall has a Tower that covers the Crown', () => {
    const t = ARENAS.crownhall.half.find((b) => b.kind === 'tower')!;
    expect(Math.hypot(t.x - 16, t.y - 9)).toBeLessThanOrEqual(4.2);
  });

  it('gullet puts the Thrones closer than any other arena', () => {
    const gap = (m: MapDef) => { const t = m.half.find((b) => b.kind === 'throne')!; return Math.hypot(32 - 2 * t.x, 18 - 2 * t.y); };
    for (const [id, m] of Object.entries(ARENAS)) if (id !== 'gullet') expect(gap(ARENAS.gullet)).toBeLessThan(gap(m) - 6);
  });

  it('sablewood breaks the straight line from each Throne to the Crown', () => {
    const m = ARENAS.sablewood;
    const t = m.half.find((b) => b.kind === 'throne')!;
    for (const [x, y] of [[t.x, t.y], [32 - t.x, 18 - t.y]])
      expect(placedObstacles(m).some((o) => segDist(o.x, o.y, x, y, 16, 9) < o.r + 0.55)).toBe(true);
  });

  it('warren has the most huts', () => {
    const huts = (m: MapDef) => m.half.filter((b) => b.kind === 'hut').length;
    for (const [id, m] of Object.entries(ARENAS)) if (id !== 'warren') expect(huts(ARENAS.warren)).toBeGreaterThan(huts(m));
  });

  it('the validator catches broken layouts', () => {
    const broken: MapDef = {
      id: 'x', name: 'x',
      half: [{ kind: 'throne', x: 3, y: 15 }, { kind: 'hut', x: 3.5, y: 13.5 }, { kind: 'hut', x: 15.5, y: 9 }],
      obstacles: [{ x: 0.5, y: 5, r: 1.4, look: 'rock' }],
      centre: [{ x: 16, y: 4, r: 0.8, look: 'trees' }],
    };
    const problems = validateArena(broken).join('\n');
    expect(problems).toMatch(/buildings per side/);
    expect(problems).toMatch(/overlaps/);
    expect(problems).toMatch(/not in the Blue half/);
    expect(problems).toMatch(/outside/);
    expect(problems).toMatch(/mirror twin/);
  });

  it('the validator catches a blocked Throne-to-hut path', () => {
    const blocked: MapDef = {
      id: 'x', name: 'x',
      half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 9.5, y: 14.5 }, { kind: 'hut', x: 4, y: 7 }, { kind: 'hut', x: 10, y: 4 }],
      obstacles: [{ x: 6.5, y: 14.5, r: 0.6, look: 'rock' }],
    };
    expect(validateArena(blocked).join('\n')).toMatch(/blocks Throne/);
  });
});
