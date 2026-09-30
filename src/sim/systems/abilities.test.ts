import { describe, expect, it } from 'vitest';
import { damageHero } from '../combat';
import { idleInput, input } from '../input';
import { aliveCritters, bareWorld, placeHero, put, run } from '../testing';
import { tuning } from '../tuning';
import type { HeroId, PlayerInput, World } from '../types';

const A = tuning.abilities;
const blueOnly = (inp: PlayerInput): [PlayerInput, PlayerInput] => [inp, idleInput()];
const abilityEvents = (ev: World['events']) => ev.filter((e) => e.type === 'ability');

function heroWorld(hero: HeroId): World {
  const w = bareWorld({ teams: [{ hero, mutations: [] }, { hero: 'brawler', mutations: [] }] });
  w.mods[0].capMul = 0;
  w.mods[1].capMul = 0;
  placeHero(w, 0, 8, 9);
  placeHero(w, 1, 26, 4);
  return w;
}
function parked(w: World, team: 0 | 1, x: number, y: number) {
  const c = put(w, team, x, y);
  c.stunT = 1e6;
  return c;
}

describe('Brawler: Stomp', () => {
  it('crushes enemy critters within 2.1, hits and pushes the enemy King', () => {
    const w = heroWorld('brawler');
    const near = parked(w, 1, 9.5, 9);
    const far = parked(w, 1, 8 + A.brawler.stomp.radius + 0.5, 9);
    placeHero(w, 1, 8, 10.5);
    const ev = run(w, 1, blueOnly(input({ ability: true })));
    expect(near.alive).toBe(false);
    expect(far.hp).toBe(tuning.critter.hp);
    const r = w.heroes[1];
    expect(r.hp).toBe(r.maxHp - A.brawler.stomp.heroDamage);
    expect(r.y).toBeCloseTo(10.5 + A.brawler.stomp.heroPush, 6);
    expect(abilityEvents(ev)).toEqual([
      expect.objectContaining({ type: 'ability', team: 0, hero: 'brawler', slot: 0, hits: 2 }),
    ]);
    expect(w.heroes[0].cd[0]).toBeCloseTo(A.brawler.stomp.cd, 6);
  });

  it('flings survivors outward', () => {
    const w = heroWorld('brawler');
    const tough = parked(w, 1, 9.5, 9);
    tough.hp = 100;
    run(w, 1, blueOnly(input({ ability: true })));
    expect(tough.vx).toBeGreaterThan(5);
  });
});

describe('Brawler: Kingscall', () => {
  it('heals 40 and summons 8 followers even above the cap', () => {
    const w = heroWorld('brawler');
    const h = w.heroes[0];
    h.hp = 50;
    const ev = run(w, 1, blueOnly(input({ ultimate: true })));
    expect(h.hp).toBeCloseTo(90, 0);
    const mine = aliveCritters(w, 0);
    expect(mine.length).toBe(A.brawler.kingscall.spawn);
    for (const c of mine) {
      expect(c.state).toBe('follow');
      expect(Math.hypot(c.x - h.x, c.y - h.y)).toBeLessThan(1.5);
    }
    expect(abilityEvents(ev)).toEqual([expect.objectContaining({ slot: 1, hero: 'brawler', hits: 8 })]);
    expect(w.heroes[0].cd[1]).toBeCloseTo(A.brawler.kingscall.cd, 6);
  });
});

describe('Blink: Blink', () => {
  it('teleports up to 5.5 toward the aim and brings the followers along', () => {
    const w = heroWorld('blink');
    const f = put(w, 0, 8.5, 9.5, 'follow');
    const held = put(w, 0, 6, 6, 'hold');
    run(w, 1, blueOnly(input({ ability: true, aimX: 20, aimY: 9 })));
    const h = w.heroes[0];
    expect(h.x).toBeCloseTo(8 + A.blink.blink.range, 1);
    expect(h.y).toBeCloseTo(9, 3);
    expect(f.x).toBeCloseTo(8.5 + A.blink.blink.range, 0);
    expect(held.x).toBeCloseTo(6, 1);
  });

  it('stops at the aim point when it is closer, and inside the arena', () => {
    const w = heroWorld('blink');
    run(w, 1, blueOnly(input({ ability: true, aimX: 10, aimY: 9 })));
    expect(w.heroes[0].x).toBeCloseTo(10, 3);

    const w2 = heroWorld('blink');
    placeHero(w2, 0, 2, 9);
    run(w2, 1, blueOnly(input({ ability: true, aimX: -10, aimY: 9 })));
    expect(w2.heroes[0].x).toBeCloseTo(tuning.hero.radius, 6);
  });
});

describe('Blink: Vortex', () => {
  it('pulls enemy critters to a point up to 6 away and stuns them', () => {
    const w = heroWorld('blink');
    const inR = parked(w, 1, 14, 11);
    inR.stunT = 0;
    inR.hp = 100;
    const outR = parked(w, 1, 14, 9 + A.blink.vortex.radius + 0.5);
    outR.stunT = 0;
    const ev = run(w, 1, blueOnly(input({ ultimate: true, aimX: 20, aimY: 9 })));
    expect(inR.stunT).toBeGreaterThan(A.blink.vortex.critterStun - 0.05);
    expect(outR.stunT).toBe(0);
    expect(w.zones).toContainEqual(expect.objectContaining({ kind: 'vortex', team: 0, x: 14, y: 9 }));
    expect(abilityEvents(ev)).toEqual([expect.objectContaining({ slot: 1, hero: 'blink', tx: 14, ty: 9, hits: 1 })]);
    run(w, 40);
    expect(Math.hypot(inR.x - 14, inR.y - 9)).toBeLessThan(0.8);
  });

  it('drags the enemy King up to 2.25, stuns him 1.2 s and deals 10', () => {
    const w = heroWorld('blink');
    placeHero(w, 1, 14, 12);
    run(w, 1, blueOnly(input({ ultimate: true, aimX: 14, aimY: 9 })));
    const r = w.heroes[1];
    expect(r.y).toBeCloseTo(12 - A.blink.vortex.heroPull, 6);
    expect(r.stunT).toBeGreaterThan(A.blink.vortex.heroStun - 0.05);
    expect(r.hp).toBe(r.maxHp - A.blink.vortex.heroDamage);
  });

  it('zone expires', () => {
    const w = heroWorld('blink');
    run(w, 1, blueOnly(input({ ultimate: true, aimX: 14, aimY: 9 })));
    run(w, Math.ceil(A.blink.vortex.zoneLife * 60) + 1);
    expect(w.zones.length).toBe(0);
  });
});

describe('Warden: Turret', () => {
  it('plants a turret up to 4 away that shoots the nearest enemy every 0.45 s, then expires after 12 s', () => {
    const w = heroWorld('warden');
    const target = parked(w, 1, 14.5, 9);
    const ev = run(w, 1, blueOnly(input({ ability: true, aimX: 20, aimY: 9 })));
    expect(w.turrets.length).toBe(1);
    expect(w.turrets[0]).toMatchObject({ team: 0, x: 12, y: 9 });
    expect(ev).toContainEqual(expect.objectContaining({ type: 'turretPlaced', team: 0, x: 12, y: 9 }));
    expect(abilityEvents(ev)).toEqual([expect.objectContaining({ slot: 0, hero: 'warden' })]);
    run(w, 1);
    expect(target.hp).toBe(tuning.critter.hp - A.warden.turret.critterDamage);
    const ev2 = run(w, 30);
    expect(target.hp).toBe(tuning.critter.hp - 2 * A.warden.turret.critterDamage);
    expect(ev2.filter((e) => e.type === 'shot' && e.from === 'turret').length).toBe(1);
    const ev3 = run(w, 12 * 60);
    expect(w.turrets.length).toBe(0);
    expect(ev3).toContainEqual(expect.objectContaining({ type: 'turretExpired', team: 0 }));
  });

  it('shoots enemy Kings for 4', () => {
    const w = heroWorld('warden');
    placeHero(w, 1, 14, 10);
    run(w, 2, blueOnly(input({ ability: true, aimX: 12, aimY: 9 })));
    expect(w.heroes[1].hp).toBe(w.heroes[1].maxHp - A.warden.turret.heroDamage);
  });
});

describe('Warden: Rampart', () => {
  it('shields 70 for 4 s and heals 45', () => {
    const w = heroWorld('warden');
    const h = w.heroes[0];
    h.hp = 100;
    run(w, 1, blueOnly(input({ ultimate: true })));
    expect(h.hp).toBeCloseTo(145, 0);
    expect(h.shield).toBe(A.warden.rampart.shield);
    damageHero(w, h, 50, 1);
    expect(h.shield).toBe(20);
    expect(h.hp).toBeCloseTo(145, 0);
    run(w, 4 * 60 + 2);
    expect(h.shield).toBe(0);
  });
});

describe('ability rules', () => {
  it('act on the rising edge only and fail silently on cooldown', () => {
    const w = heroWorld('warden');
    let ev = run(w, 30, blueOnly(input({ ultimate: true })));
    expect(abilityEvents(ev).length).toBe(1);
    run(w, 1);
    ev = run(w, 1, blueOnly(input({ ultimate: true })));
    expect(abilityEvents(ev).length).toBe(0);
  });

  it('fail silently while stunned or dead', () => {
    const w = heroWorld('brawler');
    w.heroes[0].stunT = 1;
    expect(abilityEvents(run(w, 1, blueOnly(input({ ability: true, ultimate: true })))).length).toBe(0);
    const w2 = heroWorld('brawler');
    damageHero(w2, w2.heroes[0], 1e6, 1);
    expect(abilityEvents(run(w2, 1, blueOnly(input({ ability: true, ultimate: true })))).length).toBe(0);
  });
});
