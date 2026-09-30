// Critter pool and state transitions shared by several systems.
import { cos, rand, randRange, sin, TAU } from './math';
import { tuning } from './tuning';
import type { Critter, CritterState, Team, World } from './types';

/** Fills the first free pool slot (index order, so deterministic). Null when the pool is full. */
export function spawnCritter(w: World, team: Team, x: number, y: number, state: CritterState): Critter | null {
  const pool = w.critters;
  for (let i = 0; i < pool.length; i++) {
    const c = pool[i];
    if (c.alive) continue;
    c.alive = true;
    c.team = team;
    c.kind = 'critter';
    c.state = state;
    c.x = c.px = c.sx = c.tx = x;
    c.y = c.py = c.sy = c.ty = y;
    c.vx = c.vy = 0;
    c.hp = tuning.critter.hp * w.mods[team].critterHpMul;
    c.flightT = c.flightDur = 0;
    c.flat = false;
    c.building = -1;
    c.holdT = state === 'hold' ? tuning.fire.holdTime : 0;
    c.stunT = c.slowT = 0;
    c.biteCd = rand(w) * tuning.critter.biteInterval;
    c.tint = rand(w);
    c.ox = c.oy = 0;
    if (state === 'follow') setFollowOffset(w, c);
    return c;
  }
  return null;
}

export function blankCritter(id: number): Critter {
  return {
    id, alive: false, team: 0, kind: 'critter', state: 'follow',
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, hp: 0,
    sx: 0, sy: 0, tx: 0, ty: 0, flightT: 0, flightDur: 0, flat: false,
    building: -1, holdT: 0, stunT: 0, slowT: 0, biteCd: 0, ox: 0, oy: 0, tint: 0,
  };
}

export function setFollowOffset(w: World, c: Critter): void {
  const a = rand(w) * TAU;
  const d = randRange(w, tuning.critter.followOffsetMin, tuning.critter.followOffsetMax);
  c.ox = cos(a) * d;
  c.oy = sin(a) * d;
}

export function toFollow(w: World, c: Critter): void {
  c.state = 'follow';
  c.building = -1;
  setFollowOffset(w, c);
}

export function toHome(c: Critter): void {
  c.state = 'home';
  c.building = -1;
}

/** Hold at the current spot: fights nearby, then returns home when holdT runs out. */
export function toHold(c: Critter, t: number): void {
  c.state = 'hold';
  c.building = -1;
  c.holdT = t;
  c.tx = c.x;
  c.ty = c.y;
}

/**
 * Station at building b. The critter keeps its position relative to the building (so a landing
 * stays where it landed), pushed out of the solid core; with keepSpot false it picks a ring spot.
 */
export function toGarrison(w: World, c: Critter, b: number, keepSpot: boolean): void {
  const bd = w.buildings[b];
  c.state = 'garrison';
  c.building = b;
  const inner = bd.r * tuning.building.solidFrac + tuning.critter.radius + 0.05;
  if (keepSpot) {
    let ox = c.x - bd.x;
    let oy = c.y - bd.y;
    const d = Math.sqrt(ox * ox + oy * oy);
    if (d < inner) {
      if (d < 1e-6) {
        const a = rand(w) * TAU;
        ox = cos(a); oy = sin(a);
      } else {
        ox /= d; oy /= d;
      }
      ox *= inner; oy *= inner;
    }
    c.ox = ox; c.oy = oy;
  } else {
    const a = rand(w) * TAU;
    const d = randRange(w, inner, bd.r + tuning.building.captureMargin * 0.6);
    c.ox = cos(a) * d;
    c.oy = sin(a) * d;
  }
}

/** Garrison at the nearest building of any owner (idle spot for a swarm without a King). */
export function toNearestBuilding(w: World, c: Critter): void {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < w.buildings.length; i++) {
    const b = w.buildings[i];
    const dx = b.x - c.x, dy = b.y - c.y;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  toGarrison(w, c, best, false);
}
