// Kings: timers, respawn, aim, movement with acceleration, dash, regen, auto-swing.
import { damageCritter, knockCritter } from '../combat';
import { finite } from '../math';
import { bloodrage, sweepKeyFor, trample } from '../mutated';
import { resolveSolids } from '../solids';
import { tuning } from '../tuning';
import type { Hero, PlayerInput, World } from '../types';
import { DT } from '../types';
import { heroSpawnPoint } from '../world';

const H = tuning.hero;

export function heroesSystem(w: World, inputs: readonly [PlayerInput, PlayerInput]): void {
  updateHero(w, w.heroes[0], inputs[0]);
  updateHero(w, w.heroes[1], inputs[1]);
}

/** Rate multiplier for cooldown recovery (Rampage). */
export function cdRate(h: Hero): number {
  return h.rampageT > 0 ? H.rampageCdMul : 1;
}

export function topSpeed(h: Hero): number {
  let s = H.speed[h.kind];
  if (h.rampageT > 0) s *= H.rampageSpeedMul;
  if (h.slowT > 0) s *= H.slowSpeedMul;
  return s;
}

function tick(v: number, amount: number): number {
  const r = v - amount;
  return r > 0 ? r : 0;
}

function updateHero(w: World, h: Hero, inp: PlayerInput): void {
  const rate = cdRate(h);
  h.dashCd = tick(h.dashCd, DT * rate * w.mods[h.team].dashCdRate);
  h.cd[0] = tick(h.cd[0], DT * rate);
  h.cd[1] = tick(h.cd[1], DT * rate);
  h.invulnT = tick(h.invulnT, DT);
  h.stunT = tick(h.stunT, DT);
  h.slowT = tick(h.slowT, DT);
  h.rampageT = tick(h.rampageT, DT);
  if (h.rampageT > 0 && w.mods[h.team].bloodrage) bloodrage(w, h);
  if (h.shieldT > 0) {
    h.shieldT = tick(h.shieldT, DT);
    if (h.shieldT === 0) h.shield = 0;
  }

  if (!h.alive) {
    h.respawnT -= DT;
    if (h.respawnT <= 0) respawn(w, h);
    return;
  }

  // aim
  const ax = finite(inp.aimX) - h.x, ay = finite(inp.aimY) - h.y;
  const al = Math.sqrt(ax * ax + ay * ay);
  if (al > 1e-6) { h.aimX = ax / al; h.aimY = ay / al; }

  // regen
  h.sinceHurt += DT;
  if (h.sinceHurt >= H.regenDelay && h.hp < h.maxHp) {
    h.hp += H.regenPerSec * DT;
    if (h.hp > h.maxHp) h.hp = h.maxHp;
  }

  let mx = finite(inp.moveX), my = finite(inp.moveY);
  const ml = Math.sqrt(mx * mx + my * my);
  if (ml > 1) { mx /= ml; my /= ml; }
  const stunned = h.stunT > 0;

  if (inp.dash && !h.prev.dash && !stunned && h.dashCd <= 0 && h.dashT <= 0) {
    let dx = mx, dy = my;
    if (ml < 0.1) { dx = h.aimX; dy = h.aimY; }
    const dl = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= dl; dy /= dl;
    h.dashT = H.dashTime;
    h.dashCd = H.dashCooldown;
    h.sweepKey = sweepKeyFor(w, 256 + h.team);
    if (h.invulnT < H.dashTime) h.invulnT = H.dashTime;
    h.vx = dx * H.dashSpeed;
    h.vy = dy * H.dashSpeed;
    w.events.push({ type: 'dash', team: h.team, x: h.x, y: h.y, dx, dy });
  }

  const top = topSpeed(h);
  const x0 = h.x, y0 = h.y;
  const dashing = h.dashT > 0;
  if (dashing) {
    // a dash is a fixed burst at launch velocity; it ends mid-tick, so split the tick exactly
    const burst = h.dashT < DT ? h.dashT : DT;
    h.dashT -= burst;
    h.x += h.vx * burst;
    h.y += h.vy * burst;
    if (h.dashT <= 1e-12) {
      h.dashT = 0;
      const vl = Math.sqrt(h.vx * h.vx + h.vy * h.vy) || 1;
      h.vx = (h.vx / vl) * top;
      h.vy = (h.vy / vl) * top;
      h.x += h.vx * (DT - burst);
      h.y += h.vy * (DT - burst);
    }
  } else {
    const moving = !stunned && ml > 1e-6;
    const tx = moving ? mx * top : 0, ty = moving ? my * top : 0;
    const dvx = tx - h.vx, dvy = ty - h.vy;
    const dl = Math.sqrt(dvx * dvx + dvy * dvy);
    const maxDv = (moving ? top / H.accelTime : H.speed[h.kind] / H.stopTime) * DT;
    if (dl <= maxDv) { h.vx = tx; h.vy = ty; }
    else { h.vx += (dvx / dl) * maxDv; h.vy += (dvy / dl) * maxDv; }
    h.x += h.vx * DT;
    h.y += h.vy * DT;
  }
  resolveSolids(w, h, H.radius);
  if (dashing && w.mods[h.team].trample) trample(w, h, x0, y0);

  swing(w, h);
}

function respawn(w: World, h: Hero): void {
  const [x, y] = heroSpawnPoint(w, h.team);
  h.alive = true;
  h.respawnT = 0;
  h.hp = h.maxHp;
  h.x = h.px = x;
  h.y = h.py = y;
  h.vx = h.vy = 0;
  h.invulnT = H.respawnInvuln;
  h.sinceHurt = 0;
  h.stunT = h.slowT = 0;
  w.events.push({ type: 'heroRespawn', team: h.team, x, y });
}

/** Weak auto-attack on enemy critters touching the King; the swarm is the real weapon. */
function swing(w: World, h: Hero): void {
  h.swingCd -= DT;
  if (h.swingCd > 0) return;
  h.swingCd = H.swingInterval;
  const r2 = H.swingRange * H.swingRange;
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!c.alive || c.team === h.team || c.state === 'fly') continue;
    const dx = c.x - h.x, dy = c.y - h.y;
    if (dx * dx + dy * dy > r2) continue;
    knockCritter(c, h.x, h.y, H.swingKnock);
    damageCritter(w, c, H.swingDamage, h.team);
  }
}
