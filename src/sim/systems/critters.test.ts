import { describe, expect, it } from 'vitest';
import { damageHero } from '../combat';
import { idleInput, input } from '../input';
import { bareWorld, noHatch, placeHero, put, run } from '../testing';
import { tuning } from '../tuning';
import type { PlayerInput } from '../types';

const C = tuning.critter;
const blueOnly = (inp: PlayerInput): [PlayerInput, PlayerInput] => [inp, idleInput()];

describe('melee', () => {
  it('opposing critters bite each other to death', () => {
    const w = noHatch(bareWorld());
    const a = put(w, 0, 10, 9);
    const b = put(w, 1, 10.5, 9);
    b.hp = 2; // Red is weaker and falls first
    const ev = run(w, 4 * 60);
    expect(b.alive).toBe(false);
    expect(a.alive).toBe(true);
    expect(ev.filter((e) => e.type === 'critterDied')).toEqual([expect.objectContaining({ team: 1 })]);
    expect(w.stats[1].crittersLost).toBe(1);
    expect(w.stats[0].crittersKilled).toBe(1);
  });

  it('resolves mutual bites simultaneously, so pool order gives no edge', () => {
    for (const [first, second] of [[0, 1], [1, 0]] as const) {
      const w = noHatch(bareWorld());
      const a = put(w, first, 10, 9);
      const b = put(w, second, 10.5, 9);
      a.hp = b.hp = 1;
      const ev = run(w, 1);
      expect(a.alive || b.alive, `lower id is team ${first}`).toBe(false);
      expect(ev.filter((e) => e.type === 'critterDied').length).toBe(2);
      expect(w.stats[0].crittersKilled).toBe(1);
      expect(w.stats[1].crittersKilled).toBe(1);
    }
  });

  it('bites once per 0.7 s for 1', () => {
    const w = bareWorld();
    const a = put(w, 0, 10, 9);
    a.stunT = 1e6; // a punching bag
    const b = put(w, 1, 10.5, 9);
    b.biteCd = 0;
    run(w, 1);
    expect(a.hp).toBe(C.hp - C.biteDamage);
    run(w, Math.floor(C.biteInterval * 60) - 2);
    expect(a.hp).toBe(C.hp - C.biteDamage);
    run(w, 3);
    expect(a.hp).toBe(C.hp - 2 * C.biteDamage);
  });

  it('bites an enemy King for 2', () => {
    const w = bareWorld();
    placeHero(w, 1, 20, 9);
    w.heroes[1].swingCd = 1e6; // King does not swing back in this spec
    put(w, 0, 20.7, 9);
    run(w, 1);
    expect(w.heroes[1].hp).toBe(w.heroes[1].maxHp - C.biteHeroDamage);
  });

  it('does not chase beyond its aggro radius', () => {
    const w = bareWorld();
    const a = put(w, 0, 10, 9);
    const b = put(w, 1, 10 + C.aggro.hold + 0.5, 9);
    b.stunT = 1e6;
    run(w, 60);
    expect(a.x).toBeCloseTo(10, 1);
  });
});

describe('movement', () => {
  it('followers keep up with a running King', () => {
    const w = bareWorld({ teams: [{ hero: 'blink', mutations: [] }, { hero: 'brawler', mutations: [] }] });
    placeHero(w, 0, 5, 9);
    const fs = [0, 1, 2, 3, 4, 5].map((i) => put(w, 0, 5 + (i % 3) * 0.4 - 0.4, 9 + (i < 3 ? -0.5 : 0.5), 'follow'));
    run(w, 90, blueOnly(input({ moveX: 1 })));
    const h = w.heroes[0];
    expect(h.x).toBeGreaterThan(12);
    for (const c of fs) expect(Math.hypot(c.x - h.x, c.y - h.y)).toBeLessThan(2.6);
  });

  it('home critters run to the King and become followers on arrival', () => {
    const w = bareWorld();
    placeHero(w, 0, 6, 9);
    const c = put(w, 0, 12, 12, 'home');
    run(w, 30);
    expect(c.state).toBe('home');
    run(w, 60);
    expect(c.state).toBe('follow');
    expect(Math.hypot(c.x - 6, c.y - 9)).toBeLessThan(C.homeArrive + 0.2);
  });

  it('separates overlapping critters', () => {
    const w = bareWorld();
    const a = put(w, 0, 10, 9);
    const b = put(w, 0, 10, 9);
    run(w, 60);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(C.radius * 2 * 0.8);
  });

  it('walks around an obstacle that sits on its path', () => {
    const w = bareWorld({}, { obstacles: [{ x: 9, y: 9, r: 0.9, look: 'rock' }] });
    placeHero(w, 0, 6, 9);
    const c = put(w, 0, 12, 9, 'home');
    const o = w.obstacles[0];
    for (let i = 0; i < 120; i++) {
      run(w, 1);
      expect(Math.hypot(c.x - o.x, c.y - o.y)).toBeGreaterThanOrEqual(o.r + C.radius - 1e-9);
    }
    expect(c.state).toBe('follow');
  });

  it('walks around a building core that sits on its path', () => {
    const w = bareWorld({}, { half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 9, y: 9 }] });
    placeHero(w, 0, 6, 9);
    const c = put(w, 0, 12, 9, 'home');
    run(w, 120);
    expect(c.state).toBe('follow');
  });

  it('stays inside the arena', () => {
    const w = bareWorld();
    const c = put(w, 0, 0.3, 0.3);
    c.vx = -20; c.vy = -20; c.stunT = 1;
    run(w, 30);
    expect(c.x).toBeGreaterThanOrEqual(C.radius);
    expect(c.y).toBeGreaterThanOrEqual(C.radius);
  });
});

describe('when the King falls', () => {
  it('followers hold where they stand, then idle at the nearest building', () => {
    const w = bareWorld({}, { half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 9, y: 9 }] });
    placeHero(w, 0, 7, 9);
    const f = put(w, 0, 7.5, 9, 'follow');
    const hm = put(w, 0, 11, 11, 'home');
    damageHero(w, w.heroes[0], 1e6, 1);
    expect(f.state).toBe('hold');
    expect(hm.state).toBe('hold');
    run(w, Math.ceil(tuning.fire.holdTime * 60) + 2);
    expect(f.state).toBe('garrison');
    expect(f.building).toBe(1);
  });
});
