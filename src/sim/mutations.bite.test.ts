// Bite Mutations: Leeches, Frostbite, Piercers, Homing.
import { describe, expect, it } from 'vitest';
import { idleInput, input } from './input';
import { drop, mutWorld, placeHero, put, run } from './testing';
import { tuning } from './tuning';
import type { MutationId, PlayerInput, World } from './types';
import { DT } from './types';

const X = tuning.mutations;
const blueOnly = (inp: PlayerInput): [PlayerInput, PlayerInput] => [inp, idleInput()];
const flying = (w: World) => w.critters.filter((c) => c.alive && c.state === 'fly');

describe('Leeches', () => {
  function leech(muts: MutationId[], how: 'land' | 'bite') {
    const w = mutWorld(muts);
    placeHero(w, 0, 4, 4);
    placeHero(w, 1, 11, 9);
    w.heroes[0].hp = 50;
    const foeHp = w.heroes[1].hp;
    if (how === 'land') drop(w, 0, 11, 9.3).biteCd = 5; // the landing only, no follow-up bite
    else put(w, 0, 11.7, 9);
    run(w, 1);
    expect(w.heroes[1].hp).toBeLessThan(foeHp); // the hit landed
    return w.heroes[0].hp;
  }

  it('a landing that hurts the rival King heals your King 2', () => {
    expect(leech(['leeches'], 'land')).toBe(50 + X.leeches.heal);
  });
  it('so does a bite', () => {
    expect(leech(['leeches'], 'bite')).toBe(50 + X.leeches.heal);
  });
  it('never above max HP', () => {
    const w = mutWorld(['leeches']);
    placeHero(w, 1, 11, 9);
    drop(w, 0, 11, 9.3);
    run(w, 1);
    expect(w.heroes[0].hp).toBe(w.heroes[0].maxHp);
  });
  it('no healing without Leeches', () => {
    expect(leech([], 'land')).toBe(50);
    expect(leech([], 'bite')).toBe(50);
  });
});

describe('Frostbite', () => {
  function chill(muts: MutationId[]) {
    const w = mutWorld(muts);
    placeHero(w, 1, 11, 9.8);
    const foe = put(w, 1, 11.5, 9); foe.hp = 50;
    drop(w, 0, 11, 9);
    run(w, 1);
    return { w, foe };
  }

  it('landings slow enemy critters and the King for 2 s', () => {
    const { w, foe } = chill(['frostbite']);
    expect(foe.slowT).toBeCloseTo(X.frostbite.slowTime - DT, 9);
    expect(w.heroes[1].slowT).toBeCloseTo(X.frostbite.slowTime, 9);
  });

  it('no chill without Frostbite', () => {
    const { w, foe } = chill([]);
    expect(foe.slowT).toBe(0);
    expect(w.heroes[1].slowT).toBe(0);
  });

  it('a chilled critter walks 40% slower, a chilled King 25% slower', () => {
    const critterSpeed = (slow: number) => {
      const w = mutWorld([]);
      placeHero(w, 0, 20, 9);
      const c = put(w, 0, 6, 9, 'home');
      c.slowT = slow;
      run(w, 30);
      const x0 = c.x;
      run(w, 30);
      return c.x - x0;
    };
    expect(critterSpeed(10) / critterSpeed(0)).toBeCloseTo(0.6, 2);
    const kingSpeed = (slow: number) => {
      const w = mutWorld([]);
      placeHero(w, 0, 6, 9);
      w.heroes[0].slowT = slow;
      run(w, 10, blueOnly(input({ moveX: 1 })));
      const x0 = w.heroes[0].x;
      run(w, 20, blueOnly(input({ moveX: 1 })));
      return w.heroes[0].x - x0;
    };
    expect(kingSpeed(10) / kingSpeed(0)).toBeCloseTo(0.75, 6);
  });
});

describe('Piercers', () => {
  function pierceSetup(muts: MutationId[]) {
    const w = mutWorld(muts);
    placeHero(w, 0, 6, 9);
    const c = put(w, 0, 6.6, 9, 'follow');
    const onPath = [put(w, 1, 8.5, 9), put(w, 1, 10, 9)];
    const offPath = put(w, 1, 9, 10.3);
    for (const f of [...onPath, offPath]) { f.hp = 10; f.stunT = 5; } // stunned: they stand still
    placeHero(w, 1, 11, 9);
    return { w, c, onPath, offPath };
  }

  it('thrown critters fly flat at 26 u/s, hitting each enemy along the path once', () => {
    const { w, c, onPath, offPath } = pierceSetup(['piercers']);
    const kingHp = w.heroes[1].hp;
    run(w, 1, blueOnly(input({ fire: true, aimX: 12.5, aimY: 9 })));
    expect(c.state).toBe('fly');
    expect(c.flat).toBe(true);
    expect(c.flightDur).toBeCloseTo(Math.hypot(c.tx - c.sx, c.ty - c.sy) / X.piercers.speed, 9);
    run(w, 17); // ~15 ticks of flight; too soon for it to walk over and bite
    expect(c.state).not.toBe('fly');
    for (const f of onPath) expect(f.hp).toBe(10 - X.piercers.critterDamage);
    expect(offPath.hp).toBe(10);
    expect(kingHp - w.heroes[1].hp).toBe(X.piercers.heroDamage);
  });

  it('lands without the landing splash', () => {
    const w = mutWorld(['piercers']);
    const foe = put(w, 1, 11.6, 9); foe.hp = 10; foe.stunT = 5;
    const c = drop(w, 0, 11, 9);
    c.flat = true;
    c.biteCd = 5;
    run(w, 1);
    expect(foe.hp).toBe(10);
  });

  it('without Piercers throws arc and fly over the enemies in between', () => {
    const { w, c, onPath } = pierceSetup([]);
    run(w, 1, blueOnly(input({ fire: true, aimX: 12.5, aimY: 9 })));
    expect(c.flat).toBe(false);
    run(w, 5);
    for (const f of onPath) expect(f.hp).toBe(10);
  });
});

describe('Homing', () => {
  function throwNear(muts: MutationId[], foeAt: [number, number], king?: [number, number]) {
    const w = mutWorld(muts);
    placeHero(w, 0, 6, 9);
    for (let i = 0; i < 3; i++) put(w, 0, 6.5, 8.7 + i * 0.3, 'follow');
    const foe = put(w, 1, foeAt[0], foeAt[1]); foe.stunT = 5;
    if (king) placeHero(w, 1, king[0], king[1]);
    const ev = run(w, 1, blueOnly(input({ fire: true, aimX: 11, aimY: 9 })));
    const t = ev.find((e) => e.type === 'throw')!;
    return { w, t };
  }
  const sc = tuning.fire.scatter + 1e-9;

  it('pulls the landing point to the nearest enemy within 2 of the aim', () => {
    const { w, t } = throwNear(['homing'], [12.5, 9.6]);
    expect(t).toMatchObject({ tx: 12.5, ty: 9.6 });
    for (const c of flying(w)) {
      expect(Math.abs(c.tx - 12.5)).toBeLessThanOrEqual(sc);
      expect(Math.abs(c.ty - 9.6)).toBeLessThanOrEqual(sc);
    }
  });

  it('prefers the King when he is the nearest', () => {
    const { t } = throwNear(['homing'], [12.5, 9.6], [11.3, 8.8]);
    expect(t).toMatchObject({ tx: 11.3, ty: 8.8 });
  });

  it('ignores enemies further than 2 from the aim', () => {
    const { t } = throwNear(['homing'], [13.5, 9]);
    expect(t).toMatchObject({ tx: 11, ty: 9 });
  });

  it('no pull without Homing', () => {
    const { w, t } = throwNear([], [12.5, 9.6]);
    expect(t).toMatchObject({ tx: 11, ty: 9 });
    for (const c of flying(w)) expect(Math.abs(c.tx - 11)).toBeLessThanOrEqual(sc);
  });
});
