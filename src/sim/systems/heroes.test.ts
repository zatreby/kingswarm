import { describe, expect, it } from 'vitest';
import { damageHero } from '../combat';
import { idleInput, input } from '../input';
import { bareWorld, placeHero, put, run } from '../testing';
import { tuning } from '../tuning';
import type { PlayerInput } from '../types';
import { heroSpawnPoint } from '../world';

const T = tuning.hero;
const blueOnly = (inp: PlayerInput): [PlayerInput, PlayerInput] => [inp, idleInput()];

describe('King movement', () => {
  it('reaches top speed in ~0.1 s', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    run(w, 3, blueOnly(input({ moveX: 1 })));
    expect(w.heroes[0].vx).toBeGreaterThan(0);
    expect(w.heroes[0].vx).toBeLessThan(T.speed.brawler);
    run(w, 3, blueOnly(input({ moveX: 1 })));
    expect(w.heroes[0].vx).toBeCloseTo(T.speed.brawler, 5);
  });

  it('stops in ~0.08 s', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    run(w, 20, blueOnly(input({ moveX: 1 })));
    run(w, 3, blueOnly(idleInput()));
    expect(w.heroes[0].vx).toBeGreaterThan(0);
    run(w, 2, blueOnly(idleInput()));
    expect(w.heroes[0].vx).toBe(0);
  });

  it('clamps diagonal input to top speed', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    run(w, 20, blueOnly(input({ moveX: 1, moveY: 1 })));
    const h = w.heroes[0];
    expect(Math.hypot(h.vx, h.vy)).toBeCloseTo(T.speed.brawler, 5);
  });

  it('uses per-hero top speed', () => {
    const w = bareWorld({ teams: [{ hero: 'blink', mutations: [] }, { hero: 'warden', mutations: [] }] });
    placeHero(w, 0, 8, 5);
    placeHero(w, 1, 24, 13);
    run(w, 20, [input({ moveX: 1 }), input({ moveX: -1 })]);
    expect(w.heroes[0].vx).toBeCloseTo(T.speed.blink, 5);
    expect(w.heroes[1].vx).toBeCloseTo(-T.speed.warden, 5);
  });

  it('stays inside the arena', () => {
    const w = bareWorld();
    placeHero(w, 0, 1.5, 9);
    run(w, 60, blueOnly(input({ moveX: -1, moveY: -1 })));
    expect(w.heroes[0].x).toBeCloseTo(T.radius, 6);
    expect(w.heroes[0].y).toBeGreaterThanOrEqual(T.radius);
  });

  it('slides around an obstacle instead of sticking to it', () => {
    const w = bareWorld({}, { obstacles: [{ x: 11, y: 9.3, r: 0.8, look: 'rock' }] });
    placeHero(w, 0, 8, 9);
    const o = w.obstacles[0];
    for (let i = 0; i < 90; i++) {
      run(w, 1, blueOnly(input({ moveX: 1 })));
      const h = w.heroes[0];
      expect(Math.hypot(h.x - o.x, h.y - o.y)).toBeGreaterThanOrEqual(o.r + T.radius - 1e-9);
    }
    expect(w.heroes[0].x).toBeGreaterThan(13);
  });

  it('treats building cores as solid', () => {
    const w = bareWorld();
    placeHero(w, 0, 13, 9);
    run(w, 90, blueOnly(input({ moveX: 1 })));
    const h = w.heroes[0];
    const crown = w.buildings.find((b) => b.kind === 'crown')!;
    expect(Math.hypot(h.x - crown.x, h.y - crown.y)).toBeGreaterThanOrEqual(crown.r * tuning.building.solidFrac + T.radius - 1e-9);
  });

  it('points the aim vector at the aim point', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    run(w, 1, blueOnly(input({ aimX: 8, aimY: 5 })));
    expect(w.heroes[0].aimX).toBeCloseTo(0, 6);
    expect(w.heroes[0].aimY).toBeCloseTo(-1, 6);
  });

  it('ignores non-finite input', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    run(w, 5, blueOnly(input({ moveX: NaN, moveY: Infinity, aimX: NaN })));
    expect(Number.isFinite(w.heroes[0].x)).toBe(true);
    expect(Number.isFinite(w.heroes[0].aimX)).toBe(true);
  });
});

describe('dash', () => {
  it('bursts ~3.5 units along the move direction and emits dash', () => {
    const w = bareWorld();
    placeHero(w, 0, 6, 9);
    const ev = run(w, 1, blueOnly(input({ moveY: -1, dash: true })));
    expect(ev.some((e) => e.type === 'dash' && e.team === 0 && e.dy < -0.99)).toBe(true);
    run(w, 9, blueOnly(input({ moveY: -1 })));
    const moved = 9 - w.heroes[0].y;
    expect(moved).toBeGreaterThan(T.dashSpeed * T.dashTime);
    expect(moved).toBeLessThan(T.dashSpeed * T.dashTime + 0.8);
  });

  it('dashes along the aim when not moving', () => {
    const w = bareWorld();
    placeHero(w, 0, 6, 9);
    run(w, 12, blueOnly(input({ aimX: 20, aimY: 9, dash: true })));
    expect(w.heroes[0].x - 6).toBeGreaterThan(3);
  });

  it('has a 2.2 s cooldown and only fires on the rising edge', () => {
    const w = bareWorld();
    placeHero(w, 0, 6, 9);
    let ev = run(w, 1, blueOnly(input({ moveX: 1, dash: true })));
    expect(ev.filter((e) => e.type === 'dash').length).toBe(1);
    // held: no re-trigger
    ev = run(w, 30, blueOnly(input({ dash: true })));
    expect(ev.filter((e) => e.type === 'dash').length).toBe(0);
    // released and pressed again before cooldown ends: nothing
    run(w, 1, blueOnly(idleInput()));
    ev = run(w, 1, blueOnly(input({ dash: true })));
    expect(ev.filter((e) => e.type === 'dash').length).toBe(0);
    expect(w.heroes[0].dashCd).toBeGreaterThan(0);
    run(w, Math.ceil(T.dashCooldown * 60), blueOnly(idleInput()));
    ev = run(w, 1, blueOnly(input({ moveX: 1, dash: true })));
    expect(ev.filter((e) => e.type === 'dash').length).toBe(1);
  });

  it('is invulnerable while dashing', () => {
    const w = bareWorld();
    placeHero(w, 0, 6, 9);
    run(w, 1, blueOnly(input({ moveX: 1, dash: true })));
    expect(w.heroes[0].invulnT).toBeGreaterThan(0);
    expect(damageHero(w, w.heroes[0], 50, 1)).toBe(0);
    expect(w.heroes[0].hp).toBe(w.heroes[0].maxHp);
    run(w, 12, blueOnly(idleInput()));
    expect(damageHero(w, w.heroes[0], 5, 1)).toBe(5);
  });
});

describe('King damage, regen, death, respawn, rampage', () => {
  it('takes damage, then regenerates after 3 s unhurt', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    const h = w.heroes[0];
    damageHero(w, h, 20, 1);
    w.events.length = 0;
    expect(h.hp).toBe(110);
    run(w, 170);
    expect(h.hp).toBe(110);
    run(w, 70);
    expect(h.hp).toBeGreaterThan(110);
    expect(h.hp).toBeLessThan(110 + T.regenPerSec * 1.2);
  });

  it('emits heroHit and counts damage to the attacker', () => {
    const w = bareWorld();
    damageHero(w, w.heroes[0], 7, 1);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'heroHit', team: 0, by: 1, dmg: 7, shielded: false }));
    expect(w.stats[1].damageToHero).toBe(7);
  });

  it('falls at 0 hp: followers hold, killer gets Rampage, respawns after 5 s with grace', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    placeHero(w, 1, 20, 9);
    const f = put(w, 0, 8.5, 9, 'follow');
    const h = w.heroes[0];
    damageHero(w, h, 1000, 1);
    expect(h.alive).toBe(false);
    expect(h.hp).toBe(0);
    expect(f.state).toBe('hold');
    expect(w.events.map((e) => e.type)).toEqual(expect.arrayContaining(['heroDown', 'rampage']));
    expect(w.heroes[1].rampageT).toBe(T.rampageTime);
    expect(w.heroes[1].kills).toBe(1);
    expect(w.stats[1].heroKills).toBe(1);

    // dead Kings ignore input
    run(w, 60, blueOnly(input({ moveX: 1, fire: true, dash: true })));
    expect(h.alive).toBe(false);

    const ev = run(w, Math.ceil((T.respawnTime - 1) * 60) + 1);
    expect(h.alive).toBe(true);
    expect(h.hp).toBe(h.maxHp);
    const [sx, sy] = heroSpawnPoint(w, 0);
    expect(h.x).toBeCloseTo(sx, 6);
    expect(h.y).toBeCloseTo(sy, 6);
    expect(h.invulnT).toBeGreaterThan(0.9);
    expect(ev.some((e) => e.type === 'heroRespawn' && e.team === 0)).toBe(true);
  });

  it('Rampage: speed x1.3 and cooldowns tick twice as fast, for 8 s', () => {
    const w = bareWorld();
    placeHero(w, 1, 20, 9);
    const r = w.heroes[1];
    r.rampageT = T.rampageTime;
    r.cd = [4, 4];
    r.dashCd = 2;
    run(w, 30, [idleInput(), input({ moveX: 1 })]);
    expect(r.vx).toBeCloseTo(T.speed.brawler * T.rampageSpeedMul, 5);
    expect(r.cd[0]).toBeCloseTo(3, 5);
    expect(r.dashCd).toBeCloseTo(1, 5);
    run(w, 8 * 60);
    expect(r.rampageT).toBe(0);
  });

  it('shield absorbs damage first', () => {
    const w = bareWorld();
    const h = w.heroes[0];
    h.shield = 10;
    h.shieldT = 4;
    damageHero(w, h, 15, 1);
    expect(h.shield).toBe(0);
    expect(h.hp).toBe(h.maxHp - 5);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'heroHit', shielded: true }));
  });
});

describe('auto-swing', () => {
  it('hits enemy critters within 0.9 for 1 damage with knockback, every 0.4 s', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    const near = put(w, 1, 8.6, 9);
    near.stunT = 10; // keep it from walking back or biting
    const far = put(w, 1, 8, 10.5);
    far.stunT = 10;
    run(w, 1);
    expect(near.hp).toBe(tuning.critter.hp - T.swingDamage);
    expect(near.vx).toBeGreaterThan(0);
    expect(far.hp).toBe(tuning.critter.hp);
    // pinned in place: a second swing lands 0.4 s later, not sooner
    near.x = 8.6; near.y = 9; near.vx = near.vy = 0;
    run(w, 20);
    near.x = 8.6; near.y = 9; near.vx = near.vy = 0;
    expect(near.hp).toBe(tuning.critter.hp - T.swingDamage);
    run(w, 5);
    expect(near.hp).toBe(tuning.critter.hp - 2 * T.swingDamage);
  });

  it('ignores own critters', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    const own = put(w, 0, 8.5, 9);
    run(w, 30);
    expect(own.hp).toBe(tuning.critter.hp);
  });
});
