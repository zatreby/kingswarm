// Ground critters: state behaviour (follow/home/hold/garrison), aggro and melee, separation,
// obstacle avoidance and sliding. Runs in index order; queries use the spatial hash.
import { damageHero, killCritter, leech } from '../combat';
import { buildGrid, nearest, nearestInCircle, push, separation } from '../grid';
import { KIND_BITE_INTERVAL, KIND_SPEED } from '../kinds';
import { exp, log } from '../math';
import { resolveSolids, steer, steerAround } from '../solids';
import { toFollow, toHold, toHome, toNearestBuilding } from '../spawn';
import { tuning } from '../tuning';
import type { Critter, World } from '../types';
import { DT } from '../types';

const C = tuning.critter;
const R = C.radius;
const SEP_R = R * 2;
const STEER_K = C.steer * DT < 1 ? C.steer * DT : 1;
/** Per-tick coast factor for stunned critters (speed falls to 1/stunDrag per second). */
const STUN_DECAY = exp(-log(C.stunDrag) * DT);
const HERO_REACH = tuning.hero.radius + R + C.biteReachPad;
const CRITTER_REACH = R + R + C.biteReachPad;

// nearest-enemy scratch: -1 none, -2 the enemy King, else critter id
let foeId = -1;
let foeD2 = 0;

export function crittersSystem(w: World): void {
  buildGrid(w);
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.alive && c.state !== 'fly') updateCritter(w, c);
  }
  // Bites land at once but deaths are reaped after everyone has acted, so a mutual exchange
  // is simultaneous and a lower pool index is never an advantage.
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.alive && c.hp <= 0) killCritter(w, c, (1 - c.team) as 0 | 1);
  }
}

function updateCritter(w: World, c: Critter): void {
  c.biteCd = c.biteCd > DT ? c.biteCd - DT : 0;
  if (c.slowT > 0) c.slowT = c.slowT > DT ? c.slowT - DT : 0;

  if (c.stunT > 0) {
    // stunned or flung: coast, no will of its own
    c.stunT = c.stunT > DT ? c.stunT - DT : 0;
    c.vx *= STUN_DECAY;
    c.vy *= STUN_DECAY;
    move(w, c, 0, 0);
    return;
  }

  const h = w.heroes[c.team];
  if (c.state === 'garrison' && c.building < 0) toHold(c, tuning.fire.holdTime);
  // transitions that do not depend on enemies
  if ((c.state === 'follow' || c.state === 'home') && !h.alive) toHold(c, tuning.fire.holdTime);
  if (c.state === 'home') {
    const dx = h.x - c.x, dy = h.y - c.y;
    if (dx * dx + dy * dy <= C.homeArrive * C.homeArrive) toFollow(w, c);
  }

  // where it wants to be
  let tx: number, ty: number;
  switch (c.state) {
    case 'follow': tx = h.x + c.ox; ty = h.y + c.oy; break;
    case 'home': tx = h.x; ty = h.y; break;
    case 'garrison': {
      const b = w.buildings[c.building];
      tx = b.x + c.ox; ty = b.y + c.oy;
      break;
    }
    default: tx = c.tx; ty = c.ty; // hold anchor
  }

  // aggro
  findFoe(w, c);
  if (foeId !== -1) {
    const fx = foeId === -2 ? w.heroes[1 - c.team].x : w.critters[foeId].x;
    const fy = foeId === -2 ? w.heroes[1 - c.team].y : w.critters[foeId].y;
    tx = fx; ty = fy;
    const reach = foeId === -2 ? HERO_REACH : CRITTER_REACH;
    if (c.biteCd <= 0 && foeD2 <= reach * reach) bite(w, c);
    if (c.state === 'hold' && c.holdT < tuning.fire.holdRefresh) c.holdT = tuning.fire.holdRefresh;
  }

  if (c.state === 'hold') {
    c.holdT -= DT;
    if (c.holdT <= 0) {
      if (h.alive) toHome(c);
      else if (c.kind === 'guard') c.holdT = tuning.fire.holdRefresh; // a Guard waits for his King
      else toNearestBuilding(w, c);
    }
  }

  // steer toward the target, around solids
  let dx = tx - c.x, dy = ty - c.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  let speed = 0;
  if (d > C.arriveEps) {
    dx /= d; dy /= d;
    steerAround(w, c.x, c.y, dx, dy, d, R);
    dx = steer.x; dy = steer.y;
    speed = stateSpeed(w, c);
    // ease in over the last stretch so it settles instead of orbiting
    if (d < 0.4) speed *= d / 0.4;
  } else {
    dx = dy = 0;
  }
  move(w, c, dx * speed, dy * speed);
}

function stateSpeed(w: World, c: Critter): number {
  let s: number;
  switch (c.state) {
    case 'follow': s = C.speed.follow; break;
    case 'home': s = C.speed.home; break;
    case 'garrison': s = C.speed.garrison; break;
    default: s = C.speed.hold;
  }
  s *= w.mods[c.team].critterSpeedMul * KIND_SPEED[c.kind];
  if (c.slowT > 0) s *= C.slowSpeedMul;
  return s;
}

/** Steer velocity toward (dvx, dvy) unless coasting, add separation, integrate, collide. */
function move(w: World, c: Critter, dvx: number, dvy: number): void {
  if (c.stunT <= 0) {
    c.vx += (dvx - c.vx) * STEER_K;
    c.vy += (dvy - c.vy) * STEER_K;
  }
  separation(w, c.id, c.x, c.y, SEP_R);
  const sx = push.x, sy = push.y;
  c.x += (c.vx + sx * C.separation) * DT;
  c.y += (c.vy + sy * C.separation) * DT;
  resolveSolids(w, c, R);
}

/**
 * Nearest enemy this critter should engage, into foeId/foeD2.
 * Garrisons defend the building's surroundings; everyone else looks around themselves.
 */
function findFoe(w: World, c: Critter): void {
  foeId = -1;
  foeD2 = Infinity;
  let qx = c.x, qy = c.y, qr: number;
  switch (c.state) {
    case 'follow':
      if (c.kind === 'guard') {
        // Royal Guard: intercept whatever comes near the King
        const h = w.heroes[c.team];
        qx = h.x; qy = h.y; qr = tuning.mutations.royalGuard.aggro;
      } else qr = C.aggro.follow;
      break;
    case 'home': qr = C.aggro.home; break;
    case 'hold': qr = C.aggro.hold; break;
    default: {
      const b = w.buildings[c.building];
      qx = b.x; qy = b.y; qr = b.r + C.aggro.garrison;
    }
  }
  const id = nearestInCircle(w, (1 - c.team) as 0 | 1, qx, qy, qr, c.x, c.y);
  if (id !== -1) { foeId = id; foeD2 = nearest.d2; }
  const e = w.heroes[1 - c.team];
  if (e.alive) {
    const dq = (e.x - qx) * (e.x - qx) + (e.y - qy) * (e.y - qy);
    const d2 = (e.x - c.x) * (e.x - c.x) + (e.y - c.y) * (e.y - c.y);
    if (dq <= qr * qr && d2 < foeD2) { foeD2 = d2; foeId = -2; }
  }
}

function bite(w: World, c: Critter): void {
  const m = w.mods[c.team];
  const mul = m.biteMul * (c.state === 'garrison' ? m.garrisonBiteMul : 1);
  c.biteCd = KIND_BITE_INTERVAL[c.kind];
  if (foeId === -2) {
    if (damageHero(w, w.heroes[1 - c.team], C.biteHeroDamage * mul, c.team) > 0) leech(w, c.team);
  }
  else w.critters[foeId].hp -= C.biteDamage * mul; // reaped at the end of the pass
}
