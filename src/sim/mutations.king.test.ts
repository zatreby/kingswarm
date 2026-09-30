// King Mutations (Archer Huts, Trample, Royal Guard, Rapid Fire, Long Arm, Second Wind)
// and the King Duos (Conscription, Bloodrage).
import { describe, expect, it } from 'vitest';
import { damageHero } from './combat';
import { idleInput, input } from './input';
import { aliveCritters, drop, mutWorld, placeHero, put, run, testConfig } from './testing';
import { tuning } from './tuning';
import type { MapDef, MutationId, PlayerInput, World } from './types';
import { DT } from './types';
import { createWorld } from './world';

const X = tuning.mutations;
const F = tuning.fire;
const blueOnly = (inp: PlayerInput): [PlayerInput, PlayerInput] => [inp, idleInput()];
const flying = (w: World) => w.critters.filter((c) => c.alive && c.state === 'fly');
const hutMap: Partial<MapDef> = { half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 8, y: 5 }] };

describe('Archer Huts', () => {
  function archerWorld(muts: MutationId[]) {
    const w = mutWorld(muts, [], hutMap);
    w.buildings.find((b) => b.kind === 'hut' && b.x === 8)!.owner = 0;
    placeHero(w, 0, 20, 15);
    placeHero(w, 1, 28, 9);
    return w;
  }

  it('your huts shoot enemy critters in 3.2 for 1, every 0.9 s', () => {
    const w = archerWorld(['archerHuts']);
    const foe = put(w, 1, 10.5, 5); foe.hp = 10; foe.stunT = 99;
    const ev = run(w, 1);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'shot', team: 0, from: 'hut', x: 8, y: 5 }));
    expect(foe.hp).toBe(10 - X.archerHuts.critterDamage);
    run(w, 50);
    expect(foe.hp).toBe(9);
    run(w, 10);
    expect(foe.hp).toBe(8);
  });

  it('your Throne shoots too, and a King takes 3', () => {
    const w = archerWorld(['archerHuts']);
    placeHero(w, 1, 3.5, 12);
    const hp = w.heroes[1].hp;
    run(w, 1);
    expect(w.heroes[1].hp).toBe(hp - X.archerHuts.heroDamage);
  });

  it('nothing out of range, and nothing without Archer Huts', () => {
    const far = archerWorld(['archerHuts']);
    const f1 = put(far, 1, 8 + X.archerHuts.range + 0.2, 5); f1.stunT = 99;
    expect(run(far, 1).some((e) => e.type === 'shot')).toBe(false);
    const plain = archerWorld([]);
    const f2 = put(plain, 1, 10.5, 5); f2.stunT = 99;
    expect(run(plain, 60).some((e) => e.type === 'shot')).toBe(false);
    expect(f2.hp).toBe(tuning.critter.hp);
  });
});

describe('Trample', () => {
  function dashThrough(muts: MutationId[]) {
    const w = mutWorld(muts);
    placeHero(w, 0, 6, 9);
    const inPath = [put(w, 1, 7.5, 9.3), put(w, 1, 8.8, 8.7)];
    const aside = put(w, 1, 8, 10.5);
    for (const f of [...inPath, aside]) { f.hp = 10; f.stunT = 99; }
    run(w, 1, blueOnly(input({ dash: true, moveX: 1 })));
    run(w, 14);
    return { w, inPath, aside };
  }

  it('the dash crushes each enemy critter in its path once (3)', () => {
    const { inPath, aside } = dashThrough(['trample']);
    for (const f of inPath) expect(f.hp).toBe(10 - X.trample.damage);
    expect(aside.hp).toBe(10);
  });

  it('the dash recharges 40% faster', () => {
    const { w } = dashThrough(['trample']);
    run(w, Math.ceil((tuning.hero.dashCooldown * X.trample.dashCdMul) / DT) - 15 + 1);
    expect(w.heroes[0].dashCd).toBe(0);
  });

  it('without Trample the dash hurts nobody and recharges in 2.2 s', () => {
    const { w, inPath } = dashThrough([]);
    for (const f of inPath) expect(f.hp).toBe(10);
    run(w, Math.ceil((tuning.hero.dashCooldown * X.trample.dashCdMul) / DT) - 15 + 1);
    expect(w.heroes[0].dashCd).toBeGreaterThan(0.5);
  });
});

describe('Royal Guard', () => {
  it('starts with 5 Guards that are never thrown and are not ammo', () => {
    const w = createWorld(testConfig({ teams: [{ hero: 'brawler', mutations: ['royalGuard'] }, { hero: 'brawler', mutations: [] }] }));
    const guards = aliveCritters(w, 0).filter((c) => c.kind === 'guard');
    expect(guards.length).toBe(X.royalGuard.count);
    for (const g of guards) {
      expect(g.state).toBe('follow');
      expect(g.hp).toBe(tuning.kinds.guard.hp);
    }
    expect(aliveCritters(w, 1).some((c) => c.kind === 'guard')).toBe(false);
    const h = w.heroes[0];
    const aim = { aimX: h.x + 6, aimY: h.y - 4 };
    for (let i = 0; i < 180; i++) {
      run(w, 1, blueOnly(input({ fire: true, ...aim })));
      for (const g of guards) expect(g.state).not.toBe('fly');
    }
    for (const g of guards) expect(g.alive).toBe(true);
    const ammo = aliveCritters(w, 0).filter((c) => c.state === 'follow' && c.kind !== 'guard').length;
    expect(h.followers).toBe(ammo);
  });

  it('replaces a missing Guard one at a time, every 6 s', () => {
    const w = mutWorld(['royalGuard']); // bare world: all five missing
    placeHero(w, 0, 8, 9);
    const guards = () => aliveCritters(w, 0).filter((c) => c.kind === 'guard').length;
    run(w, Math.floor(X.royalGuard.replaceEvery / DT) - 5);
    expect(guards()).toBe(0);
    const ev = run(w, 10);
    expect(guards()).toBe(1);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'spawn', team: 0, kind: 'guard', cause: 'guard' }));
    run(w, Math.floor(X.royalGuard.replaceEvery / DT));
    expect(guards()).toBe(2);
  });

  it('Guards intercept attackers near the King that a plain follower ignores', () => {
    for (const [kind, engaged] of [['guard', true], ['critter', false]] as const) {
      const w = mutWorld(kind === 'guard' ? ['royalGuard'] : []);
      placeHero(w, 0, 10, 9);
      const g = put(w, 0, 10.6, 9, 'follow', kind);
      g.ox = 0.6; g.oy = 0;
      const foe = put(w, 1, 8.1, 9); foe.hp = 50; foe.stunT = 99;
      run(w, 60);
      expect(foe.hp < 50, kind).toBe(engaged);
    }
  });

  it('no Guards without Royal Guard', () => {
    expect(createWorld(testConfig()).critters.some((c) => c.alive && c.kind === 'guard')).toBe(false);
  });
});

function withFollowers(muts: MutationId[], n: number) {
  const w = mutWorld(muts);
  placeHero(w, 0, 8, 9);
  for (let i = 0; i < n; i++) put(w, 0, 8 + ((i % 5) - 2) * 0.3, 9 + (Math.floor(i / 5) - 2) * 0.3, 'follow');
  return w;
}

describe('Rapid Fire', () => {
  it('fires 60% faster with a 1.8x wider spread', () => {
    const w = withFollowers(['rapidFire'], 60);
    const ev = run(w, 60, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    const volleys = ev.filter((e) => e.type === 'throw').length;
    expect(volleys).toBeGreaterThanOrEqual(12); // 1 s / (0.13 / 1.6) = 12.3 intervals
    let widest = 0;
    for (const c of w.critters) if (c.alive && c.state !== 'follow') widest = Math.max(widest, Math.abs(c.ty - 9));
    expect(widest).toBeGreaterThan(F.scatter);
    expect(widest).toBeLessThanOrEqual(F.scatter * X.rapidFire.scatterMul + 1e-9);
  });

  it('8 volleys a second without it', () => {
    const w = withFollowers([], 60);
    const ev = run(w, 60, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    expect(ev.filter((e) => e.type === 'throw').length).toBe(8);
  });
});

describe('Long Arm', () => {
  it('+40% throw range and 25% faster flight', () => {
    for (const [muts, rangeMul, speedMul] of [[['longArm'], X.longArm.rangeMul, X.longArm.flightSpeedMul], [[], 1, 1]] as const) {
      const w = withFollowers([...muts], 3);
      run(w, 1, blueOnly(input({ fire: true, aimX: 30, aimY: 9 })));
      for (const c of flying(w)) {
        expect(Math.abs(c.tx - (8 + F.range * rangeMul))).toBeLessThanOrEqual(F.scatter + 1e-9);
        const dur = Math.hypot(c.tx - c.sx, c.ty - c.sy) / (F.flightSpeed * speedMul) + F.flightBase;
        expect(c.flightDur).toBeCloseTo(dur, 9);
      }
    }
  });
});

describe('Second Wind', () => {
  function lethal(muts: MutationId[]) {
    const w = mutWorld(muts);
    placeHero(w, 0, 10, 9);
    w.heroes[0].hp = 3;
    const near = put(w, 1, 12, 9); near.hp = 10;
    const far = put(w, 1, 13.5, 9); far.hp = 10;
    drop(w, 1, 10, 9.3);
    const ev = run(w, 1);
    return { w, ev, near, far };
  }

  it('once per battle a lethal hit leaves the King at half HP with a stunning shockwave', () => {
    const { w, ev, near, far } = lethal(['secondWind']);
    const h = w.heroes[0];
    expect(h.alive).toBe(true);
    expect(h.hp).toBe(h.maxHp * X.secondWind.hpFrac);
    expect(h.spent).toContain('secondWind');
    expect(ev).toContainEqual(expect.objectContaining({ type: 'secondWind', team: 0 }));
    expect(ev.some((e) => e.type === 'heroDown')).toBe(false);
    expect(near.stunT).toBeCloseTo(X.secondWind.stun - DT, 9);
    expect(near.vx).toBeGreaterThan(0); // knocked away from him
    expect(far.stunT).toBe(0);
    // spent: the next lethal hit fells him
    h.hp = 1;
    drop(w, 1, 10, 9.3);
    expect(run(w, 1).some((e) => e.type === 'heroDown')).toBe(true);
  });

  it('without Second Wind the King falls', () => {
    const { w, ev } = lethal([]);
    expect(w.heroes[0].alive).toBe(false);
    expect(ev.some((e) => e.type === 'heroDown')).toBe(true);
  });
});

describe('Conscription (duo)', () => {
  function fell(muts: MutationId[]) {
    const w = mutWorld(muts);
    placeHero(w, 1, 10, 9);
    w.heroes[1].hp = 1;
    const follower = put(w, 1, 10.8, 9, 'follow');
    const holder = put(w, 1, 12.5, 9.5);
    const far = put(w, 1, 10, 13.5);
    for (const c of [follower, holder, far]) c.biteCd = 5;
    drop(w, 0, 10, 9.3).biteCd = 5;
    const ev = run(w, 1);
    expect(w.heroes[1].alive).toBe(false);
    return { ev, follower, holder, far };
  }

  it('when the rival King falls, his critters within 4 join you', () => {
    const { ev, follower, holder, far } = fell(['conscription']);
    for (const c of [follower, holder]) {
      expect(c.team).toBe(0);
      expect(c.state).toBe('home');
    }
    expect(far.team).toBe(1);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'conscript', team: 0, count: 2 }));
  });

  it('without Conscription they stay his', () => {
    const { follower, holder } = fell([]);
    expect(follower.team).toBe(1);
    expect(holder.team).toBe(1);
  });
});

describe('Bloodrage (duo)', () => {
  const B = X.bloodrage;
  function rage(muts: MutationId[]) {
    const w = mutWorld(muts);
    placeHero(w, 0, 6, 9);
    placeHero(w, 1, 10, 9);
    w.heroes[1].hp = 1;
    drop(w, 0, 10, 9.3);
    run(w, 1);
    expect(w.heroes[0].rampageT).toBeGreaterThan(0);
    return w;
  }
  const hit = (w: World) => damageHero(w, w.heroes[0], 1, 1);
  const secs = (s: number) => Math.round(s / DT);

  it('Rampage has no timer until 3 hits (but lasts at least 8 s)', () => {
    const w = rage(['bloodrage']);
    run(w, secs(1));
    hit(w); hit(w); hit(w);
    run(w, secs(B.minTime - 1) - 3);
    expect(w.heroes[0].rampageT).toBeGreaterThan(0);
    run(w, 6);
    expect(w.heroes[0].rampageT).toBe(0);
  });

  it('after 8 s, the third hit ends it', () => {
    const w = rage(['bloodrage']);
    run(w, secs(12));
    expect(w.heroes[0].rampageT).toBeGreaterThan(0);
    hit(w); hit(w);
    run(w, 2);
    expect(w.heroes[0].rampageT).toBeGreaterThan(0);
    hit(w);
    run(w, 1);
    expect(w.heroes[0].rampageT).toBe(0);
  });

  it('ends at 25 s at the latest', () => {
    const w = rage(['bloodrage']);
    run(w, secs(B.maxTime) - 3);
    expect(w.heroes[0].rampageT).toBeGreaterThan(0);
    run(w, 6);
    expect(w.heroes[0].rampageT).toBe(0);
  });

  it('without Bloodrage Rampage lasts 8 s', () => {
    const w = rage([]);
    run(w, secs(tuning.hero.rampageTime) - 3);
    expect(w.heroes[0].rampageT).toBeGreaterThan(0);
    run(w, 6);
    expect(w.heroes[0].rampageT).toBe(0);
  });
});
