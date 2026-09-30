import { describe, expect, it } from 'vitest';
import { idleInput, input } from '../input';
import { bareWorld, placeHero, put, run, runUntil } from '../testing';
import { tuning } from '../tuning';
import type { PlayerInput, World } from '../types';

const F = tuning.fire;
const blueOnly = (inp: PlayerInput): [PlayerInput, PlayerInput] => [inp, idleInput()];
const flying = (w: World) => w.critters.filter((c) => c.alive && c.state === 'fly');

function withFollowers(n: number, hutAt?: { x: number; y: number }) {
  const w = bareWorld({}, hutAt ? { half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', ...hutAt }] } : {});
  placeHero(w, 0, 8, 9);
  for (let i = 0; i < n; i++) put(w, 0, 8 + ((i % 5) - 2) * 0.3, 9 + (Math.floor(i / 5) - 2) * 0.3, 'follow');
  return w;
}

describe('swarm gun', () => {
  it('throws up to 3 followers per volley and emits throw', () => {
    const w = withFollowers(10);
    const ev = run(w, 1, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    expect(flying(w).length).toBe(3);
    const t = ev.find((e) => e.type === 'throw');
    expect(t).toMatchObject({ type: 'throw', team: 0, count: 3 });
    expect(w.stats[0].thrown).toBe(3);
    expect(w.heroes[0].followers).toBe(7);
  });

  it('fires every 0.13 s while held', () => {
    const w = withFollowers(40);
    const ev = run(w, 60, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    const volleys = ev.filter((e) => e.type === 'throw').length;
    // 1 s / 0.13 s = 7.7 intervals, so 8 volleys counting the one at t=0
    expect(volleys).toBe(8);
    expect(w.stats[0].thrown).toBe(24);
  });

  it('does nothing when fire is not held', () => {
    const w = withFollowers(10);
    run(w, 30, blueOnly(input({ aimX: 12, aimY: 9 })));
    expect(w.stats[0].thrown).toBe(0);
  });

  it('prefers the followers closest to the aim point', () => {
    const w = bareWorld();
    placeHero(w, 0, 8, 9);
    const right = [put(w, 0, 9, 8.6, 'follow'), put(w, 0, 9, 9, 'follow'), put(w, 0, 9, 9.4, 'follow')];
    const left = [put(w, 0, 7, 8.6, 'follow'), put(w, 0, 7, 9, 'follow'), put(w, 0, 7, 9.4, 'follow')];
    run(w, 1, blueOnly(input({ fire: true, aimX: 14, aimY: 9 })));
    for (const c of right) expect(c.state).toBe('fly');
    for (const c of left) expect(c.state).toBe('follow');
  });

  it('clamps the target to throw range, with scatter', () => {
    const w = withFollowers(10);
    run(w, 1, blueOnly(input({ fire: true, aimX: 30, aimY: 9 })));
    const h = w.heroes[0];
    for (const c of flying(w)) {
      expect(c.tx).toBeLessThanOrEqual(h.x + F.range + F.scatter + 1e-9);
      expect(c.tx).toBeGreaterThanOrEqual(h.x + F.range - F.scatter - 1e-9);
      expect(Math.abs(c.ty - 9)).toBeLessThanOrEqual(F.scatter + 1e-9);
    }
  });

  it('flies for distance / 15.5 + 0.12 s, then lands and emits land', () => {
    const w = withFollowers(1);
    const c = w.critters.find((k) => k.alive && k.team === 0)!;
    run(w, 1, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    expect(c.state).toBe('fly');
    const dur = Math.hypot(c.tx - c.sx, c.ty - c.sy) / F.flightSpeed + F.flightBase;
    expect(c.flightDur).toBeCloseTo(dur, 9);
    const ticks = Math.ceil(dur * 60);
    run(w, ticks - 2, blueOnly(idleInput()));
    expect(c.state).toBe('fly');
    const ev = run(w, 3, blueOnly(idleInput()));
    expect(c.state).not.toBe('fly');
    expect(ev).toContainEqual(expect.objectContaining({ type: 'land', team: 0, critter: c.id }));
    expect(c.x).toBeCloseTo(c.tx, 9);
  });

  it('cannot be hit while in the air', () => {
    const w = withFollowers(1);
    const c = w.critters.find((k) => k.alive && k.team === 0)!;
    run(w, 1, blueOnly(input({ fire: true, aimX: 14, aimY: 9 })));
    const enemy = put(w, 1, c.x, c.y, 'hold');
    enemy.stunT = 0;
    run(w, 10);
    expect(c.hp).toBe(tuning.critter.hp);
  });

  it('flies over obstacles', () => {
    const w = bareWorld({}, { obstacles: [{ x: 10.5, y: 9, r: 0.9, look: 'rock' }] });
    placeHero(w, 0, 8, 9);
    const c = put(w, 0, 8.3, 9, 'follow');
    run(w, 1, blueOnly(input({ fire: true, aimX: 13, aimY: 9 })));
    run(w, 40);
    expect(c.x).toBeGreaterThan(12);
  });

  it('with no followers emits noAmmo at most once per second', () => {
    const w = withFollowers(0);
    const ev = run(w, 120, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    expect(ev.filter((e) => e.type === 'noAmmo').length).toBe(2);
  });

  it('does not fire while stunned', () => {
    const w = withFollowers(5);
    w.heroes[0].stunT = 1;
    run(w, 30, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    expect(w.stats[0].thrown).toBe(0);
  });
});

describe('landing', () => {
  it('damages and knocks back enemy critters within 0.7', () => {
    const w = withFollowers(1);
    const enemy = put(w, 1, 12, 9, 'hold');
    enemy.stunT = 5;
    const bystander = put(w, 1, 12, 11, 'hold');
    bystander.stunT = 5;
    run(w, 1, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    for (const c of flying(w)) c.biteCd = 5; // isolate the splash from the bite that follows it
    const ev = runUntil(w, 'land', 40);
    const land = ev.find((e) => e.type === 'land')!;
    expect(land).toMatchObject({ hits: 1, hitHero: false });
    if (land.type !== 'land') throw new Error();
    expect(enemy.hp).toBe(tuning.critter.hp - F.landDamage);
    expect(bystander.hp).toBe(tuning.critter.hp);
    const away = (enemy.x - land.x) * enemy.vx + (enemy.y - land.y) * enemy.vy;
    expect(Math.hypot(enemy.vx, enemy.vy)).toBeGreaterThan(1);
    expect(away).toBeGreaterThanOrEqual(0);
  });

  it('hurts the enemy King within 0.9 for 4', () => {
    const w = withFollowers(1);
    placeHero(w, 1, 12, 9);
    run(w, 1, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    for (const c of flying(w)) c.biteCd = 5;
    const ev = runUntil(w, 'land', 40);
    expect(ev.find((e) => e.type === 'land')).toMatchObject({ hitHero: true });
    expect(w.heroes[1].hp).toBe(w.heroes[1].maxHp - F.landHeroDamage);
  });

  it('garrisons when it lands in a building capture zone', () => {
    const w = withFollowers(1, { x: 12, y: 9 });
    const hut = w.buildings.findIndex((b) => b.kind === 'hut' && b.x === 12);
    const c = w.critters.find((k) => k.alive && k.team === 0)!;
    run(w, 1, blueOnly(input({ fire: true, aimX: 12, aimY: 9 })));
    run(w, 40);
    expect(c.state).toBe('garrison');
    expect(c.building).toBe(hut);
    run(w, 600);
    expect(c.state).toBe('garrison');
    expect(Math.hypot(c.x - 12, c.y - 9)).toBeLessThan(w.buildings[hut].r + tuning.building.captureMargin);
  });

  it('holds ~2.5 s in the open, then runs home and rejoins the King', () => {
    const w = withFollowers(1);
    const c = w.critters.find((k) => k.alive && k.team === 0)!;
    run(w, 1, blueOnly(input({ fire: true, aimX: 13, aimY: 9 })));
    run(w, 30);
    expect(c.state).toBe('hold');
    const landedAt = [c.x, c.y];
    run(w, Math.floor(F.holdTime * 60) - 30);
    expect(c.state).toBe('hold');
    expect(Math.hypot(c.x - landedAt[0], c.y - landedAt[1])).toBeLessThan(0.3);
    run(w, 40);
    expect(c.state).toBe('home');
    run(w, 90);
    expect(c.state).toBe('follow');
  });

  it('keeps holding while an enemy is near', () => {
    const w = withFollowers(1);
    const c = w.critters.find((k) => k.alive && k.team === 0)!;
    const enemy = put(w, 1, 14.2, 9, 'hold');
    enemy.hp = 1e6;
    enemy.stunT = 1e6;
    run(w, 1, blueOnly(input({ fire: true, aimX: 13, aimY: 9 })));
    run(w, 5 * 60);
    expect(c.state).toBe('hold');
  });
});

describe('recall', () => {
  it('sends every held and garrisoned critter home, and emits recall with the count', () => {
    const w = bareWorld({}, { half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 12, y: 9 }] });
    placeHero(w, 0, 8, 9);
    const held = put(w, 0, 10, 12, 'hold');
    const garr = put(w, 0, 12.6, 9, 'hold');
    garr.state = 'garrison';
    garr.building = 1;
    const fol = put(w, 0, 8.5, 9, 'follow');
    const ev = run(w, 1, blueOnly(input({ recall: true })));
    expect(held.state).toBe('home');
    expect(garr.state).toBe('home');
    expect(fol.state).toBe('follow');
    expect(ev).toContainEqual(expect.objectContaining({ type: 'recall', team: 0, count: 2 }));
    // held button: no second recall
    const ev2 = run(w, 5, blueOnly(input({ recall: true })));
    expect(ev2.filter((e) => e.type === 'recall').length).toBe(0);
    run(w, 90, blueOnly(idleInput()));
    expect(held.state).toBe('follow');
    expect(garr.state).toBe('follow');
  });
});
