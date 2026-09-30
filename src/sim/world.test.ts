import { describe, expect, it } from 'vitest';
import { meadow } from './maps';
import { testConfig } from './testing';
import { tuning } from './tuning';
import { ARENA_H, ARENA_W, MAX_CRITTERS } from './types';
import { createWorld } from './world';

describe('createWorld', () => {
  const w = createWorld(testConfig({ teams: [{ hero: 'brawler', mutations: [] }, { hero: 'warden', mutations: [], hatchMul: 1.3 }] }));

  it('mirrors the map through the arena centre and adds the Crown', () => {
    expect(w.buildings.length).toBe(meadow.half.length * 2 + 1);
    const blue = w.buildings[w.thrones[0]];
    const red = w.buildings[w.thrones[1]];
    expect([blue.x, blue.y]).toEqual([3.5, 14.5]);
    expect([red.x, red.y]).toEqual([ARENA_W - 3.5, ARENA_H - 14.5]);
    const crown = w.buildings.find((b) => b.kind === 'crown')!;
    expect([crown.x, crown.y]).toEqual([16, 9]);
    expect(crown.owner).toBe(-1);
    expect(w.obstacles.length).toBe(meadow.obstacles.length * 2 + (meadow.centre?.length ?? 0));
  });

  it('owns the Thrones, leaves huts neutral, sizes buildings from tuning', () => {
    expect(w.buildings[w.thrones[0]].owner).toBe(0);
    expect(w.buildings[w.thrones[1]].owner).toBe(1);
    expect(w.buildings[w.thrones[0]].control).toBe(100);
    for (const b of w.buildings) {
      if (b.kind === 'hut') expect(b.owner).toBe(-1);
      expect(b.r).toBe(tuning.building.radius[b.kind]);
    }
  });

  it('puts each King at his Throne with a starting swarm around him', () => {
    for (const t of [0, 1] as const) {
      const h = w.heroes[t];
      const th = w.buildings[w.thrones[t]];
      expect(h.alive).toBe(true);
      expect(Math.hypot(h.x - th.x, h.y - th.y)).toBeLessThan(th.r + tuning.building.captureMargin);
      const mine = w.critters.filter((c) => c.alive && c.team === t);
      expect(mine.length).toBe(tuning.match.startSwarm);
      for (const c of mine) {
        expect(c.state).toBe('follow');
        expect(Math.hypot(c.x - h.x, c.y - h.y)).toBeLessThan(2);
      }
    }
    expect(w.heroes[0].maxHp).toBe(tuning.hero.hp.brawler);
    expect(w.heroes[1].maxHp).toBe(tuning.hero.hp.warden);
    expect(w.heroes[1].cdMax).toEqual([tuning.abilities.warden.turret.cd, tuning.abilities.warden.rampart.cd]);
  });

  it('allocates the fixed critter pool with stable ids', () => {
    expect(w.critters.length).toBe(MAX_CRITTERS);
    w.critters.forEach((c, i) => expect(c.id).toBe(i));
  });

  it('derives default team modifiers, carrying hatchMul', () => {
    expect(w.mods[0].hatchMul).toBe(1);
    expect(w.mods[1].hatchMul).toBe(1.3);
    expect(w.mods[0].fireIntervalMul).toBe(1);
    expect(w.mods[0].capAdd).toBe(0);
  });

  it('starts in the open phase at tick 0', () => {
    expect(w.tick).toBe(0);
    expect(w.phase).toBe('open');
    expect(w.winner).toBe(-1);
    expect(w.frenzy).toBe(false);
    expect(w.events).toEqual([]);
  });

  it('is plain serialisable data', () => {
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });

  it('draws layout jitter from the seed', () => {
    const a = createWorld(testConfig({ seed: 1 }));
    const b = createWorld(testConfig({ seed: 1 }));
    const c = createWorld(testConfig({ seed: 2 }));
    expect(a).toEqual(b);
    expect(a.critters[0].x).not.toBe(c.critters[0].x);
  });
});
