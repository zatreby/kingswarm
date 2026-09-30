// Hero abilities (slot 0 = Ability, 1 = Ultimate), Warden turrets, and lingering zones.
import { damageCritter, damageHero, knockCritter } from '../combat';
import { atan2, clamp, cos, finite, log, rand, randRange, sin, TAU } from '../math';
import { clampToArena, resolveSolids } from '../solids';
import { birth, burnScorch } from '../mutated';
import { tuning } from '../tuning';
import type { Hero, PlayerInput, Team, World } from '../types';
import { ARENA_H, ARENA_W, DT } from '../types';
import { nearestEnemy, NONE, HERO, shoot, targetX, targetY } from './targeting';

const A = tuning.abilities;
/**
 * Coasting critters lose speed at rate ln(stunDrag) per second, so an impulse of d x COAST_K
 * carries them about d before they stop.
 */
const COAST_K = log(tuning.critter.stunDrag);

export function abilitiesSystem(w: World, inputs: readonly [PlayerInput, PlayerInput]): void {
  for (let t = 0; t < 2; t++) {
    const h = w.heroes[t];
    const inp = inputs[t];
    if (!h.alive || h.stunT > 0) continue;
    const ax = finite(inp.aimX), ay = finite(inp.aimY);
    if (inp.ability && !h.prev.ability && h.cd[0] <= 0) cast(w, h, 0, ax, ay);
    // re-check: the Ability may have changed things (never today, but cheap to keep honest)
    if (inp.ultimate && !h.prev.ultimate && h.cd[1] <= 0 && h.alive && h.stunT <= 0) cast(w, h, 1, ax, ay);
  }
  turrets(w);
  zones(w);
}

// scratch for pointToward
let px = 0, py = 0;
/** Point up to `range` from the King toward the aim, into px/py. */
function pointToward(h: Hero, ax: number, ay: number, range: number): void {
  const dx = ax - h.x, dy = ay - h.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= range) { px = ax; py = ay; return; }
  px = h.x + (dx / d) * range;
  py = h.y + (dy / d) * range;
}

function cast(w: World, h: Hero, slot: 0 | 1, ax: number, ay: number): void {
  h.cd[slot] = h.cdMax[slot];
  const x = h.x, y = h.y;
  let tx = h.x, ty = h.y, hits = 0;
  switch (h.kind) {
    case 'brawler':
      if (slot === 0) hits = stomp(w, h);
      else hits = kingscall(w, h);
      break;
    case 'blink':
      if (slot === 0) { blink(w, h, ax, ay); tx = h.x; ty = h.y; }
      else { pointToward(h, ax, ay, A.blink.vortex.range); tx = px; ty = py; hits = vortex(w, h, px, py); }
      break;
    case 'warden':
      if (slot === 0) { pointToward(h, ax, ay, A.warden.turret.range); placeTurret(w, h.team); tx = px; ty = py; }
      else rampart(h);
      break;
  }
  w.events.push({ type: 'ability', team: h.team, hero: h.kind, slot, x, y, tx, ty, hits });
}

function enemyHero(w: World, team: Team): Hero {
  return w.heroes[1 - team];
}

function stomp(w: World, h: Hero): number {
  const s = A.brawler.stomp;
  const r2 = s.radius * s.radius;
  let hits = 0;
  for (const c of w.critters) {
    if (!c.alive || c.team === h.team || c.state === 'fly') continue;
    const dx = c.x - h.x, dy = c.y - h.y;
    if (dx * dx + dy * dy > r2) continue;
    knockCritter(c, h.x, h.y, s.fling);
    c.stunT = c.stunT > 0.25 ? c.stunT : 0.25; // flung: coasts instead of steering straight back
    damageCritter(w, c, s.critterDamage, h.team);
    hits++;
  }
  const e = enemyHero(w, h.team);
  if (e.alive && e.invulnT <= 0) {
    const dx = e.x - h.x, dy = e.y - h.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2) {
      const d = Math.sqrt(d2);
      if (d > 1e-9) { e.x += (dx / d) * s.heroPush; e.y += (dy / d) * s.heroPush; }
      else e.x += s.heroPush;
      resolveSolids(w, e, tuning.hero.radius);
      damageHero(w, e, s.heroDamage, h.team);
      hits++;
    }
  }
  return hits;
}

function kingscall(w: World, h: Hero): number {
  const k = A.brawler.kingscall;
  h.hp = h.hp + k.heal > h.maxHp ? h.maxHp : h.hp + k.heal;
  let n = 0;
  for (let i = 0; i < k.spawn; i++) {
    const a = rand(w) * TAU;
    const d = randRange(w, 0.3, k.spread);
    const c = birth(w, h.team, h.x + cos(a) * d, h.y + sin(a) * d, 'follow');
    if (!c) break;
    clampToArena(c, tuning.critter.radius);
    n++;
  }
  return n;
}

function blink(w: World, h: Hero, ax: number, ay: number): void {
  pointToward(h, ax, ay, A.blink.blink.range);
  const ox = h.x, oy = h.y;
  h.x = px; h.y = py;
  resolveSolids(w, h, tuning.hero.radius);
  const mx = h.x - ox, my = h.y - oy;
  h.px = h.x; h.py = h.y; // a teleport: nothing to interpolate
  for (const c of w.critters) {
    if (!c.alive || c.team !== h.team || c.state !== 'follow') continue;
    c.x += mx; c.y += my;
    resolveSolids(w, c, tuning.critter.radius);
    c.px = c.x; c.py = c.y;
  }
}

function vortex(w: World, h: Hero, cx: number, cy: number): number {
  const v = A.blink.vortex;
  const r2 = v.radius * v.radius;
  let hits = 0;
  for (const c of w.critters) {
    if (!c.alive || c.team === h.team || c.state === 'fly') continue;
    const dx = cx - c.x, dy = cy - c.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    // an impulse sized so the coast ends pullFrac of the way to the centre
    c.vx = dx * v.pullFrac * COAST_K;
    c.vy = dy * v.pullFrac * COAST_K;
    c.stunT = v.critterStun;
    hits++;
  }
  const e = enemyHero(w, h.team);
  if (e.alive && e.invulnT <= 0) {
    const dx = cx - e.x, dy = cy - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2) {
      const d = Math.sqrt(d2);
      const pull = d < v.heroPull ? d : v.heroPull;
      if (d > 1e-9) { e.x += (dx / d) * pull; e.y += (dy / d) * pull; }
      e.vx = e.vy = 0;
      e.dashT = 0;
      resolveSolids(w, e, tuning.hero.radius);
      e.stunT = e.stunT > v.heroStun ? e.stunT : v.heroStun;
      damageHero(w, e, v.heroDamage, h.team);
      hits++;
    }
  }
  w.zones.push({ kind: 'vortex', team: h.team, x: cx, y: cy, r: v.radius, life: v.zoneLife, maxLife: v.zoneLife, pulseT: 0 });
  return hits;
}

function placeTurret(w: World, team: Team): void {
  const t = A.warden.turret;
  px = clamp(px, 0.3, ARENA_W - 0.3);
  py = clamp(py, 0.3, ARENA_H - 0.3);
  w.turrets.push({ team, x: px, y: py, life: t.life, shotCd: 0, aim: team === 0 ? 0 : TAU / 2 });
  w.events.push({ type: 'turretPlaced', team, x: px, y: py });
}

function rampart(h: Hero): void {
  const r = A.warden.rampart;
  h.shield = r.shield;
  h.shieldT = r.shieldTime;
  h.hp = h.hp + r.heal > h.maxHp ? h.maxHp : h.hp + r.heal;
}

function turrets(w: World): void {
  const t = A.warden.turret;
  const ts = w.turrets;
  for (let i = 0; i < ts.length; i++) {
    const tr = ts[i];
    tr.life -= DT;
    if (tr.life <= 0) {
      w.events.push({ type: 'turretExpired', team: tr.team, x: tr.x, y: tr.y });
      ts.splice(i, 1);
      i--;
      continue;
    }
    tr.shotCd -= DT;
    if (tr.shotCd > 0) continue;
    tr.shotCd = 0;
    const target = nearestEnemy(w, tr.team, tr.x, tr.y, t.reach);
    if (target === NONE) continue;
    tr.shotCd = t.interval;
    tr.aim = atan2(targetY(w, tr.team, target) - tr.y, targetX(w, tr.team, target) - tr.x);
    shoot(w, tr.team, 'turret', tr.x, tr.y, target, target === HERO ? t.heroDamage : t.critterDamage);
  }
}

function zones(w: World): void {
  const zs = w.zones;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    z.life -= DT;
    if (z.life <= 0) { zs.splice(i, 1); i--; continue; }
    if (z.kind === 'scorch') burnScorch(w, z);
  }
}
