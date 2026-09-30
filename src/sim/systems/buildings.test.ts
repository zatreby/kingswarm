import { describe, expect, it } from 'vitest';
import { bareWorld, noHatch, placeHero, put, run, runUntil } from '../testing';
import { tuning } from '../tuning';
import type { MapDef, World } from '../types';

const B = tuning.building;
const hutMap: Partial<MapDef> = { half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 8, y: 5 }] };
const HUT = 1; // Blue-half hut index (throne 0, hut 1, Red throne 2, Red hut 3, crown 4)

function hutWorld(hatching = false): World {
  const w = bareWorld({}, hutMap);
  if (!hatching) noHatch(w); // hatchlings would contest the zones under test
  // Kings out of every zone so only placed critters count
  placeHero(w, 0, 6, 12);
  placeHero(w, 1, 26, 6);
  return w;
}
/** A critter parked just inside the hut's capture zone. */
function onHut(w: World, team: 0 | 1, n = 1) {
  const hut = w.buildings[HUT];
  const out = [];
  const d = hut.r + 0.2;
  for (let i = 0; i < n; i++) {
    // spread round the ring so separation does not shove anyone out of the zone
    const a = (i / n) * 2 * Math.PI;
    const c = put(w, team, hut.x + Math.cos(a) * d, hut.y + Math.sin(a) * d);
    c.stunT = 1e6; // parked: no wandering, no fighting
    out.push(c);
  }
  return out;
}

describe('capture by presence', () => {
  it('fills a neutral building for the only team present at 20/s x (1 + 0.25 x presence)', () => {
    const w = hutWorld();
    onHut(w, 0);
    run(w, 60);
    const hut = w.buildings[HUT];
    expect(hut.presence).toEqual([1, 0]);
    expect(hut.claimant).toBe(0);
    expect(hut.control).toBeCloseTo(25, 6);
    const ev = run(w, 3 * 60 + 2);
    expect(hut.owner).toBe(0);
    expect(hut.control).toBe(100);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'capture', team: 0, prev: -1, building: HUT, kind: 'hut' }));
    expect(w.stats[0].captures).toBe(1);
  });

  it('counts a King as 4 and caps the multiplier at 3', () => {
    const w = hutWorld();
    placeHero(w, 0, 8, 5 + B.radius.hut + 0.2);
    run(w, 30);
    expect(w.buildings[HUT].presence[0]).toBe(B.kingPresence);
    expect(w.buildings[HUT].control).toBeCloseTo(0.5 * 20 * 2, 6);

    const w2 = hutWorld();
    onHut(w2, 1, 12);
    run(w2, 30);
    expect(w2.buildings[HUT].control).toBeCloseTo(0.5 * 20 * 3, 6);
  });

  it('resets progress when the claimant changes', () => {
    const w = hutWorld();
    const [blue] = onHut(w, 0);
    run(w, 60);
    blue.alive = false;
    onHut(w, 1);
    run(w, 30);
    const hut = w.buildings[HUT];
    expect(hut.claimant).toBe(1);
    expect(hut.control).toBeCloseTo(12.5, 6);
  });

  it('freezes when contested', () => {
    const w = hutWorld();
    onHut(w, 0);
    run(w, 60);
    onHut(w, 1);
    const before = w.buildings[HUT].control;
    run(w, 60);
    expect(w.buildings[HUT].control).toBe(before);
  });

  it('drains an owned building when only the enemy is present, then flips it at 30', () => {
    const w = hutWorld();
    const hut = w.buildings[HUT];
    hut.owner = 0; hut.control = 100; hut.claimant = 0;
    onHut(w, 1);
    run(w, 60);
    expect(hut.owner).toBe(0);
    expect(hut.control).toBeCloseTo(75, 6);
    const ev = runUntil(w, 'capture', 3 * 60 + 2);
    expect(hut.owner).toBe(1);
    expect(hut.control).toBe(B.flipControl);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'capture', team: 1, prev: 0, building: HUT }));
  });

  it('regains 25/s when only the owner is present, and freezes when contested', () => {
    const w = hutWorld();
    const hut = w.buildings[HUT];
    hut.owner = 0; hut.control = 50; hut.claimant = 0;
    onHut(w, 0);
    run(w, 60);
    expect(hut.control).toBeCloseTo(75, 6);
    onHut(w, 1);
    run(w, 60);
    expect(hut.control).toBeCloseTo(75, 6);
  });

  it('is reversible: a fresh flip can be taken straight back', () => {
    const w = hutWorld();
    const hut = w.buildings[HUT];
    hut.owner = 1; hut.control = B.flipControl; hut.claimant = 1;
    onHut(w, 0);
    run(w, Math.ceil((B.flipControl / 25) * 60) + 1);
    expect(hut.owner).toBe(0);
  });

  it('capturing the enemy Throne wins the match', () => {
    const w = hutWorld();
    placeHero(w, 0, 10, 9);
    const th = w.buildings[w.thrones[0]];
    th.hatchT = 1e9; // no defenders popping out mid-spec
    for (let i = 0; i < 10; i++) {
      const c = put(w, 1, th.x + th.r + 0.2, th.y - 0.5 + i * 0.1);
      c.stunT = 1e6;
    }
    const ev = run(w, 3 * 60);
    expect(w.phase).toBe('over');
    expect(w.winner).toBe(1);
    expect(w.winReason).toBe('throne');
    expect(ev).toContainEqual({ type: 'matchEnd', winner: 1, reason: 'throne' });
  });
});

describe('hatching', () => {
  const hatches = (ev: World['events'], team: 0 | 1) => ev.filter((e) => e.type === 'hatch' && e.team === team).length;

  it('hatches one critter per interval at each owned building, running home', () => {
    const w = hutWorld(true);
    const ev = run(w, 14 * 60);
    const n = hatches(ev, 0);
    expect(n).toBeGreaterThanOrEqual(9);
    expect(n).toBeLessThanOrEqual(10);
    const e = ev.find((x) => x.type === 'hatch' && x.team === 0)!;
    if (e.type !== 'hatch') throw new Error();
    expect(e.building).toBe(w.thrones[0]);
    expect(['home', 'follow']).toContain(w.critters[e.critter].state);
  });

  it('huts hatch slower than thrones', () => {
    const w = hutWorld(true);
    const hut = w.buildings[HUT];
    hut.owner = 0; hut.control = 100;
    w.buildings[w.thrones[0]].hatchT = 1e9; // isolate the hut from the cap
    const ev = run(w, 26 * 60);
    const fromHut = ev.filter((e) => e.type === 'hatch' && e.building === HUT).length;
    expect(fromHut).toBeGreaterThanOrEqual(9);
    expect(fromHut).toBeLessThanOrEqual(10);
  });

  it('stops at the swarm cap: 14 + 7 per owned building', () => {
    const w = hutWorld(true);
    const cap = B.capBase + B.capPerBuilding * 1;
    for (let i = 0; i < cap; i++) put(w, 0, 2 + (i % 5) * 0.6, 2 + Math.floor(i / 5) * 0.6).stunT = 1e6;
    const ev = run(w, 5 * 60);
    expect(hatches(ev, 0)).toBe(0);
    w.buildings[HUT].owner = 0; // cap +7
    const ev2 = run(w, 5 * 60);
    expect(hatches(ev2, 0)).toBeGreaterThan(0);
  });

  it('halves intervals during Frenzy and honours hatchMul', () => {
    const w = hutWorld(true);
    w.frenzy = true;
    const n = hatches(run(w, 14 * 60), 0);
    expect(n).toBeGreaterThanOrEqual(19);
    expect(n).toBeLessThanOrEqual(20);

    const w2 = bareWorld({ teams: [{ hero: 'brawler', mutations: [], hatchMul: 2 }, { hero: 'brawler', mutations: [] }] }, hutMap);
    placeHero(w2, 0, 6, 12);
    const n2 = hatches(run(w2, 14 * 60), 0);
    expect(n2).toBeGreaterThanOrEqual(19);
    expect(n2).toBeLessThanOrEqual(20);
  });
});

describe('towers', () => {
  const towerMap: Partial<MapDef> = { half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'tower', x: 8, y: 5 }] };

  it('start owned by their half and shoot the nearest enemy in range every 0.6 s', () => {
    const w = bareWorld({}, towerMap);
    const tower = w.buildings[HUT];
    expect(tower.owner).toBe(0);
    const target = put(w, 1, 8 + 3, 5);
    target.stunT = 1e6;
    const far = put(w, 1, 8, 5 + B.towerRange + 0.5);
    far.stunT = 1e6;
    const ev = run(w, 1);
    expect(target.hp).toBe(tuning.critter.hp - B.towerCritterDamage);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'shot', team: 0, from: 'tower', tx: target.x, ty: target.y }));
    run(w, 34);
    expect(target.alive).toBe(true);
    run(w, 3);
    expect(target.alive).toBe(false);
    expect(far.hp).toBe(tuning.critter.hp);
  });

  it('shoot enemy Kings for 5', () => {
    const w = bareWorld({}, towerMap);
    placeHero(w, 1, 8, 7.5);
    run(w, 1);
    expect(w.heroes[1].hp).toBe(w.heroes[1].maxHp - B.towerHeroDamage);
  });

  it('do not waste shots on an invulnerable King', () => {
    const w = bareWorld({}, towerMap);
    placeHero(w, 1, 8, 7);
    w.heroes[1].invulnT = 1;
    const c = put(w, 1, 8, 8.5);
    c.stunT = 1e6;
    run(w, 1);
    expect(c.hp).toBe(tuning.critter.hp - B.towerCritterDamage);
  });

  it('never hatch, and shoot for whoever owns them', () => {
    const w = bareWorld({}, towerMap);
    const tower = w.buildings[HUT];
    const ev = run(w, 10 * 60);
    expect(ev.filter((e) => e.type === 'hatch' && e.building === HUT).length).toBe(0);
    tower.owner = 1;
    const blue = put(w, 0, 9, 5);
    blue.stunT = 1e6;
    run(w, 1);
    expect(blue.hp).toBe(tuning.critter.hp - B.towerCritterDamage);
  });
});
