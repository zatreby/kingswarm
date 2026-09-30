// Brood Mutations: Splitters, Boomtown, Militia, Big Litter, Brutes.
import { describe, expect, it } from 'vitest';
import { damageCritter } from './combat';
import { idleInput } from './input';
import { aliveCritters, drop, mutWorld, placeHero, put, run, testConfig } from './testing';
import { tuning } from './tuning';
import type { MapDef, MutationId } from './types';
import { DT } from './types';
import { createWorld, swarmCap } from './world';

const X = tuning.mutations;
const withBlue = (muts: MutationId[]) =>
  createWorld(testConfig({ teams: [{ hero: 'brawler', mutations: muts }, { hero: 'brawler', mutations: [] }] }));

describe('Splitters', () => {
  it('a dying critter splits into two Runts (1 HP) holding where it died', () => {
    const w = mutWorld(['splitters']);
    const c = put(w, 0, 10, 9);
    const ev = run(w, 0);
    damageCritter(w, c, 5, 1);
    ev.push(...run(w, 1));
    const runts = aliveCritters(w, 0);
    expect(runts.length).toBe(X.splitters.runts);
    for (const r of runts) {
      expect(r.kind).toBe('runt');
      expect(r.state).toBe('hold');
      expect(r.hp).toBe(tuning.kinds.runt.hp);
      expect(Math.hypot(r.x - 10, r.y - 9)).toBeLessThan(0.5);
    }
    expect(ev.filter((e) => e.type === 'spawn' && e.cause === 'split').length).toBe(2);
  });

  it('Runts cannot split, and a Bomber that explodes does not split', () => {
    const w = mutWorld(['splitters', 'bombers']);
    damageCritter(w, put(w, 0, 10, 9, 'hold', 'runt'), 5, 1);
    drop(w, 0, 6, 5, 'bomber');
    run(w, 1);
    expect(aliveCritters(w, 0).length).toBe(0);
  });

  it('a Bomber killed before it is thrown does split', () => {
    const w = mutWorld(['splitters', 'bombers']);
    damageCritter(w, put(w, 0, 10, 9, 'hold', 'bomber'), 5, 1);
    run(w, 1);
    expect(aliveCritters(w, 0).length).toBe(2);
  });

  it('Runts bite half as often', () => {
    const w = mutWorld(['splitters']);
    const r = put(w, 0, 10, 9, 'hold', 'runt');
    const foe = put(w, 1, 10.5, 9); foe.hp = 50;
    run(w, 1);
    expect(foe.hp).toBe(49);
    expect(r.biteCd).toBeCloseTo(tuning.critter.biteInterval * 2, 9);
  });

  it('without Splitters a critter just dies', () => {
    const w = mutWorld([]);
    damageCritter(w, put(w, 0, 10, 9), 5, 1);
    run(w, 1);
    expect(aliveCritters(w, 0).length).toBe(0);
  });
});

describe('Boomtown', () => {
  const map: Partial<MapDef> = { half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 8, y: 5 }] };
  function throneRate(muts: MutationId[], redTakesHut: boolean): number {
    const w = mutWorld(muts, [], map);
    placeHero(w, 0, 3.5, 9); placeHero(w, 1, 28, 9); // off every capture zone
    if (redTakesHut) w.buildings.find((b) => b.kind === 'hut' && b.x === 8)!.owner = 1;
    const t = w.buildings[w.thrones[0]];
    t.hatchT = 10;
    run(w, 1);
    return (10 - t.hatchT) / DT;
  }

  it('hatches 60% faster while holding fewer buildings than the rival', () => {
    expect(throneRate(['boomtown'], true)).toBeCloseTo(X.boomtown.hatchMul, 9);
  });
  it('normal speed when level or ahead', () => {
    expect(throneRate(['boomtown'], false)).toBeCloseTo(1, 9);
  });
  it('normal speed without Boomtown even when behind', () => {
    expect(throneRate([], true)).toBeCloseTo(1, 9);
  });
});

describe('Militia', () => {
  const map: Partial<MapDef> = { half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 8, y: 5 }] };
  function captureHut(muts: MutationId[]) {
    const w = mutWorld(muts, [], map); // no hatching: the guards are free, not cap-limited
    const hut = w.buildings.find((b) => b.kind === 'hut' && b.x === 8)!;
    placeHero(w, 0, 8, 5 + hut.r);
    placeHero(w, 1, 28, 9);
    const ev = run(w, 60 * 3);
    expect(hut.owner).toBe(0);
    return { w, hut, ev };
  }

  it('a captured building instantly gains 3 free garrisoned critters', () => {
    const { w, hut, ev } = captureHut(['militia']);
    const g = aliveCritters(w, 0).filter((c) => c.state === 'garrison' && c.building === hut.id);
    expect(g.length).toBe(X.militia.guards);
    expect(ev.filter((e) => e.type === 'spawn' && e.cause === 'militia').length).toBe(X.militia.guards);
  });

  it('without Militia a capture adds nobody', () => {
    const { w } = captureHut([]);
    expect(aliveCritters(w, 0).length).toBe(0);
  });

  it('garrisons bite twice as hard', () => {
    for (const [muts, dmg] of [[['militia'], 2], [[], 1]] as const) {
      const w = mutWorld([...muts], [], map);
      const hut = w.buildings.find((b) => b.kind === 'hut' && b.x === 8)!;
      const g = put(w, 0, 8.8, 5, 'garrison');
      g.building = hut.id; g.ox = 0.8; g.oy = 0;
      const foe = put(w, 1, 9.3, 5); foe.hp = 50;
      run(w, 1);
      expect(foe.hp).toBe(50 - dmg);
    }
  });
});

describe('Big Litter', () => {
  it('+10 swarm cap and the battle starts with a full swarm', () => {
    const plain = withBlue([]);
    const w = withBlue(['bigLitter']);
    expect(swarmCap(w, 0)).toBe(swarmCap(plain, 0) + X.bigLitter.capAdd);
    expect(aliveCritters(w, 0).length).toBe(swarmCap(w, 0));
    expect(aliveCritters(plain, 0).length).toBe(tuning.match.startSwarm);
  });
});

describe('Brutes', () => {
  it('every critter is a Brute with 3x HP, and the swarm cap is halved', () => {
    const plain = withBlue([]);
    const w = withBlue(['brutes']);
    const blue = aliveCritters(w, 0);
    expect(blue.length).toBeGreaterThan(0);
    for (const c of blue) {
      expect(c.kind).toBe('brute');
      expect(c.hp).toBe(tuning.critter.hp * 3);
    }
    expect(aliveCritters(w, 1).every((c) => c.kind === 'critter')).toBe(true);
    expect(swarmCap(w, 0)).toBe(Math.floor(swarmCap(plain, 0) / 2));
  });

  it('Brutes walk about 25% slower', () => {
    const speed = (kind: 'critter' | 'brute') => {
      const w = mutWorld([]);
      placeHero(w, 0, 20, 9);
      const c = put(w, 0, 6, 9, 'home', kind);
      run(w, 30);
      const x0 = c.x;
      run(w, 30);
      return (c.x - x0) / 0.5;
    };
    expect(speed('brute') / speed('critter')).toBeCloseTo(0.75, 2);
  });

  it('a Brute lands heavy: 1.0 splash for 3', () => {
    for (const [kind, hit] of [['brute', true], ['critter', false]] as const) {
      const w = mutWorld([]);
      const foe = put(w, 1, 11.9, 9); foe.hp = 20;
      drop(w, 0, 11, 9, kind);
      run(w, 1, [idleInput(), idleInput()]);
      expect(foe.hp).toBe(hit ? 20 - 3 : 20);
    }
  });
});
