// Boom Mutations (and the Boom Duos): Bombers, Shockwave, Scorch, Chain Reaction, Cryo Bombs.
import { describe, expect, it } from 'vitest';
import { damageCritter } from './combat';
import { idleInput, input } from './input';
import { aliveCritters, drop, mutWorld, placeHero, put, run } from './testing';
import { testConfig } from './testing';
import { tuning } from './tuning';
import type { MutationId, PlayerInput, World } from './types';
import { DT } from './types';
import { createWorld } from './world';

const X = tuning.mutations;
const blueOnly = (inp: PlayerInput): [PlayerInput, PlayerInput] => [inp, idleInput()];

/** Enemy (Red) critters around (x, y) at distance d, tough enough to survive, standing still. */
function ring(w: World, x: number, y: number, d: number, hp = 50) {
  return [put(w, 1, x + d, y), put(w, 1, x - d, y), put(w, 1, x, y + d)].map((c) => { c.hp = hp; return c; });
}

describe('Bombers', () => {
  it('makes every 4th critter born a Bomber (start swarm of 10 -> 2 Bombers)', () => {
    const w = createWorld(testConfig({ teams: [{ hero: 'brawler', mutations: ['bombers'] }, { hero: 'brawler', mutations: [] }] }));
    const blue = aliveCritters(w, 0).filter((c) => c.kind !== 'guard');
    expect(blue.filter((c) => c.kind === 'bomber').length).toBe(2);
    expect(aliveCritters(w, 1).some((c) => c.kind === 'bomber')).toBe(false);
    expect(w.born[0]).toBe(10);
  });

  it('hatches Bombers on the same 1-in-4 cadence', () => {
    const w = mutWorld(['bombers']);
    w.mods[0].capMul = 1;
    placeHero(w, 0, 6, 9);
    const hatched: string[] = [];
    for (let i = 0; i < 60 * 12 && hatched.length < 8; i++) {
      run(w, 1);
      for (const e of w.events) if (e.type === 'hatch' && e.team === 0) hatched.push(w.critters[e.critter].kind);
    }
    expect(hatched).toEqual(['critter', 'critter', 'critter', 'bomber', 'critter', 'critter', 'critter', 'bomber']);
  });

  it('a landing Bomber explodes (r 1.5: 3 to critters, 8 to the King) and is gone', () => {
    const w = mutWorld(['bombers']);
    placeHero(w, 1, 11, 9.9);
    const hp0 = w.heroes[1].hp;
    const foes = ring(w, 11, 9, 1.2, 3);
    const b = drop(w, 0, 11, 9, 'bomber');
    const ev = run(w, 1);
    expect(b.alive).toBe(false);
    for (const f of foes) expect(f.alive).toBe(false);
    expect(w.heroes[1].hp).toBe(hp0 - X.bombers.heroDamage);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'explode', team: 0, x: 11, y: 9, r: X.bombers.radius, frozen: false }));
    expect(ev).toContainEqual(expect.objectContaining({ type: 'land', team: 0, kind: 'bomber' }));
  });

  it('without Bombers, a critter landing in the same spot only splashes 0.7', () => {
    const w = mutWorld([]);
    const foes = ring(w, 11, 9, 1.2, 3);
    const c = drop(w, 0, 11, 9);
    const ev = run(w, 1);
    expect(c.alive).toBe(true);
    for (const f of foes) expect(f.hp).toBe(3);
    expect(ev.some((e) => e.type === 'explode')).toBe(false);
    expect(createWorld(testConfig()).critters.some((k) => k.alive && k.kind === 'bomber')).toBe(false);
  });
});

describe('Shockwave', () => {
  function landNextTo(muts: MutationId[]) {
    const w = mutWorld(muts);
    const foe = put(w, 1, 11.5, 9);
    foe.hp = 50;
    const c = drop(w, 0, 11, 9);
    run(w, 1);
    c.alive = false; // take the thrower out so the foe has nothing to chase
    const x0 = foe.x;
    run(w, 12);
    return { foe, moved: foe.x - x0 };
  }

  it('landings knock enemies 2.5x harder and stun them 0.4 s', () => {
    const plain = landNextTo([]);
    const shock = landNextTo(['shockwave']);
    expect(plain.foe.stunT).toBe(0);
    // stunned on landing, 12 ticks have passed since
    expect(shock.foe.stunT).toBeCloseTo(X.shockwave.stun - 13 * DT, 6);
    expect(shock.moved).toBeGreaterThan(plain.moved * 2);
  });

  it('sets the landing modifiers only for its own team', () => {
    const w = mutWorld(['shockwave']);
    expect(w.mods[0].landKnockMul).toBe(X.shockwave.knockMul);
    expect(w.mods[0].landStun).toBe(X.shockwave.stun);
    expect(w.mods[1].landKnockMul).toBe(1);
    expect(w.mods[1].landStun).toBe(0);
  });
});

describe('Scorch', () => {
  it('every landing leaves a 3 s burning patch that hurts enemy critters, not Kings', () => {
    const w = mutWorld(['scorch']);
    const foe = put(w, 1, 11.8, 9); // inside the patch (0.9), outside the splash (0.7)
    foe.hp = 50;
    placeHero(w, 1, 11, 9.8);
    const kingHp = w.heroes[1].hp;
    const c = drop(w, 0, 11, 9);
    run(w, 1);
    c.alive = false;
    foe.x = foe.tx = 11.8; foe.y = foe.ty = 9; foe.vx = foe.vy = 0;
    expect(w.zones).toContainEqual(expect.objectContaining({ kind: 'scorch', team: 0, x: 11, y: 9, r: X.scorch.radius, life: X.scorch.life }));
    expect(foe.hp).toBe(50);
    run(w, 32);
    expect(foe.hp).toBe(49);
    run(w, 30);
    expect(foe.hp).toBe(48);
    run(w, 60 * 3);
    expect(w.zones.filter((z) => z.kind === 'scorch').length).toBe(0);
    expect(foe.hp).toBeGreaterThanOrEqual(50 - 6);
    expect(foe.hp).toBeLessThanOrEqual(50 - 5);
    // a King does not burn (he took the landing hit only if in 0.9; he is 0.8 away -> 4)
    expect(w.heroes[1].hp).toBeGreaterThanOrEqual(kingHp - tuning.fire.landHeroDamage);
  });

  it('keeps at most 24 patches per team, replacing the oldest', () => {
    const w = mutWorld(['scorch']);
    for (let i = 0; i < 30; i++) drop(w, 0, 5 + (i % 10) * 0.9, 6 + Math.floor(i / 10) * 1.5);
    run(w, 1);
    const mine = w.zones.filter((z) => z.kind === 'scorch' && z.team === 0);
    expect(mine.length).toBe(X.scorch.maxPerTeam);
    // the first six landings (by pool order) were replaced
    expect(mine.some((z) => z.x === 5 && z.y === 6)).toBe(false);
  });

  it('no patch without Scorch', () => {
    const w = mutWorld([]);
    drop(w, 0, 11, 9);
    run(w, 1);
    expect(w.zones.length).toBe(0);
  });
});

describe('Chain Reaction (duo)', () => {
  it('a dying Runt explodes small (r 0.9, 2 damage)', () => {
    const w = mutWorld(['splitters', 'chainReaction']);
    const runt = put(w, 0, 10, 9, 'hold', 'runt');
    const near = put(w, 1, 10.7, 9); near.hp = 10;
    const far = put(w, 1, 11.2, 9); far.hp = 10;
    damageCritter(w, runt, 5, 1);
    const ev = run(w, 1);
    expect(near.hp).toBe(10 - X.chainReaction.damage);
    expect(far.hp).toBe(10);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'explode', team: 0, r: X.chainReaction.radius }));
    // a Runt never splits
    expect(aliveCritters(w, 0).length).toBe(0);
  });

  it('chains: an exploding Runt can kill a Runt that explodes in turn', () => {
    const w = mutWorld(['splitters', 'chainReaction'], ['splitters', 'chainReaction']);
    const a = put(w, 0, 10, 9, 'hold', 'runt');
    put(w, 1, 10.6, 9, 'hold', 'runt');
    const victim = put(w, 0, 11.2, 9); victim.hp = 10; // reached only by the second blast
    damageCritter(w, a, 5, 1);
    const ev = run(w, 1);
    expect(ev.filter((e) => e.type === 'explode').length).toBe(2);
    expect(victim.hp).toBe(10 - X.chainReaction.damage);
  });

  it('without Chain Reaction a Runt just dies', () => {
    const w = mutWorld(['splitters']);
    const runt = put(w, 0, 10, 9, 'hold', 'runt');
    const near = put(w, 1, 10.7, 9); near.hp = 10;
    damageCritter(w, runt, 5, 1);
    const ev = run(w, 1);
    expect(near.hp).toBe(10);
    expect(ev.some((e) => e.type === 'explode')).toBe(false);
  });
});

describe('Cryo Bombs (duo)', () => {
  it('Bomber explosions freeze everything they hit for 1 s', () => {
    const w = mutWorld(['bombers', 'cryoBombs']);
    placeHero(w, 1, 11, 10);
    const foes = ring(w, 11, 9, 1.2);
    drop(w, 0, 11, 9, 'bomber');
    const ev = run(w, 1);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'explode', frozen: true }));
    for (const f of foes) expect(f.stunT).toBeCloseTo(X.cryoBombs.freeze - DT, 6);
    expect(w.heroes[1].stunT).toBeCloseTo(X.cryoBombs.freeze, 6);
  });

  it('plain Bombers do not freeze', () => {
    const w = mutWorld(['bombers']);
    placeHero(w, 1, 11, 10);
    const foes = ring(w, 11, 9, 1.2);
    drop(w, 0, 11, 9, 'bomber');
    run(w, 1);
    for (const f of foes) expect(f.stunT).toBe(0);
    expect(w.heroes[1].stunT).toBe(0);
  });

  it('a Bomber thrown by the King explodes where it lands', () => {
    const w = mutWorld(['bombers']);
    placeHero(w, 0, 6, 9);
    put(w, 0, 6.5, 9, 'follow', 'bomber');
    const ev = run(w, 40, blueOnly(input({ fire: true, aimX: 10, aimY: 9 })));
    expect(ev.some((e) => e.type === 'explode')).toBe(true);
    expect(aliveCritters(w, 0).length).toBe(0);
  });
});
