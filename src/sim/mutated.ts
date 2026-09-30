// Mutation rules that are behaviour rather than numbers. Each function is named after the Mutation
// it implements and is called by the owning system only when that team's TeamMods flag is set,
// so an unmutated battle pays one branch per call site. Numbers are in tuning.mutations.
import { damageCritter, damageHero, dying, impactCritter, impactHero, knockCritter } from './combat';
import { found, nearest, nearestInCircle, queryCircle } from './grid';
import { cos, rand, sin, TAU } from './math';
import { clampToArena, resolveSolids } from './solids';
import { spawnCritter, toGarrison } from './spawn';
import { tuning } from './tuning';
import type { Building, Critter, CritterKind, CritterState, Hero, Team, World } from './types';
import { DT } from './types';
import { HERO, nearestEnemy, NONE, shoot } from './systems/targeting';

const X = tuning.mutations;
const F = tuning.fire;
const R = tuning.critter.radius;
/** Sweep keys: start tick x SWEEP_SLOTS + source (a critter id, or 256 + team for a King's dash). */
const SWEEP_SLOTS = 512;

// ---------------------------------------------------------------- Bombers, Brutes (birth)

/**
 * A critter born to `team` (hatch, Kingscall, start swarm, Militia). Bombers: every Nth born is a
 * Bomber. Brutes: the rest are Brutes. Mutation-made extras (Runts, Guards) do not count.
 */
export function birth(w: World, team: Team, x: number, y: number, state: CritterState): Critter | null {
  const m = w.mods[team];
  const n = w.born[team] + 1;
  let kind: CritterKind = m.brutes ? 'brute' : 'critter';
  if (m.bomberEvery > 0 && n % m.bomberEvery === 0) kind = 'bomber';
  const c = spawnCritter(w, team, x, y, state, kind);
  if (c) w.born[team] = n;
  return c;
}

// ---------------------------------------------------------------- explosions (Bombers, Cryo Bombs, Chain Reaction)

/** Set by blast(): whether the last blast hurt the rival King. */
export let blastHitHero = false;

/**
 * Hurt every enemy within r of (x, y). A `landing` blast is a thrown critter's impact, so the
 * thrower's landing rewrites (Shockwave, Frostbite, Leeches) apply. `freeze` stuns everything hit.
 * Returns the number of units hit.
 */
function blast(
  w: World, team: Team, x: number, y: number, r: number,
  critterDmg: number, heroDmg: number, landing: boolean, freeze: number,
): number {
  const r2 = r * r;
  let hits = 0;
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const o = cs[i];
    if (!o.alive || o.team === team || o.state === 'fly') continue;
    const dx = o.x - x, dy = o.y - y;
    if (dx * dx + dy * dy > r2) continue;
    if (freeze > 0 && o.stunT < freeze) o.stunT = freeze;
    if (landing) impactCritter(w, team, o, x, y, critterDmg, F.landKnock);
    else { knockCritter(o, x, y, F.landKnock); damageCritter(w, o, critterDmg, team); }
    hits++;
  }
  blastHitHero = false;
  const e = w.heroes[1 - team];
  if (e.alive && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) <= r2) {
    const dealt = landing ? impactHero(w, team, heroDmg) : damageHero(w, e, heroDmg, team);
    if (dealt > 0) {
      hits++;
      blastHitHero = true;
      if (freeze > 0 && e.alive && e.stunT < freeze) e.stunT = freeze;
    }
  }
  w.events.push({ type: 'explode', team, x, y, r, frozen: freeze > 0 });
  return hits;
}

/** Bombers: a landing Bomber explodes (Cryo Bombs: and freezes what it hits). The caller removes it. */
export function bomberBlast(w: World, c: Critter): number {
  const b = X.bombers;
  const freeze = w.mods[c.team].cryoBombs ? X.cryoBombs.freeze : 0;
  return blast(w, c.team, c.x, c.y, b.radius, b.critterDamage * w.mods[c.team].landDamageMul,
    b.heroDamage * w.mods[c.team].landDamageMul, true, freeze);
}

// ---------------------------------------------------------------- Splitters, Chain Reaction

/**
 * Resolve queued deaths: Splitters split a dead critter into Runts; Chain Reaction blows up a dead
 * Runt (which can kill more Runts, appended to the same queue). Called by step between systems.
 */
export function settleDeaths(w: World): void {
  if (dying.n === 0) return;
  if (dying.world !== w) { dying.n = 0; return; }
  for (let i = 0; i < dying.n; i++) {
    const team = dying.team[i] as Team, x = dying.x[i], y = dying.y[i];
    if (dying.runt[i]) {
      const cr = X.chainReaction;
      blast(w, team, x, y, cr.radius, cr.damage, cr.damage, false, 0);
    } else {
      splitIntoRunts(w, team, x, y);
    }
  }
  dying.n = 0;
}

function splitIntoRunts(w: World, team: Team, x: number, y: number): void {
  const s = X.splitters;
  for (let k = 0; k < s.runts; k++) {
    const a = rand(w) * TAU;
    const d = s.spread * (0.5 + 0.5 * rand(w));
    const c = spawnCritter(w, team, x + cos(a) * d, y + sin(a) * d, 'hold', 'runt');
    if (!c) return;
    resolveSolids(w, c, R);
    c.tx = c.x; c.ty = c.y;
    w.events.push({ type: 'spawn', team, critter: c.id, kind: 'runt', cause: 'split', x: c.x, y: c.y });
  }
}

// ---------------------------------------------------------------- Scorch

/** Scorch: a landing leaves a burning patch; past the per-team cap the oldest patch goes out. */
export function dropScorch(w: World, team: Team, x: number, y: number): void {
  const s = X.scorch;
  const zs = w.zones;
  let n = 0, oldest = -1;
  for (let i = 0; i < zs.length; i++) {
    if (zs[i].kind !== 'scorch' || zs[i].team !== team) continue;
    if (oldest < 0) oldest = i;
    n++;
  }
  if (n >= s.maxPerTeam) zs.splice(oldest, 1);
  zs.push({ kind: 'scorch', team, x, y, r: s.radius, life: s.life, maxLife: s.life, pulseT: s.interval });
}

/** One tick of a Scorch patch: every interval, burn enemy ground critters inside it (never Kings). */
export function burnScorch(w: World, z: World['zones'][number]): void {
  z.pulseT -= DT;
  if (z.pulseT > 0) return;
  z.pulseT += X.scorch.interval;
  const r2 = z.r * z.r;
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!c.alive || c.team === z.team || c.state === 'fly') continue;
    const dx = c.x - z.x, dy = c.y - z.y;
    if (dx * dx + dy * dy <= r2) damageCritter(w, c, X.scorch.damage, z.team);
  }
}

// ---------------------------------------------------------------- Piercers

export function sweepKeyFor(w: World, source: number): number {
  return w.tick * SWEEP_SLOTS + source;
}

/**
 * Piercers: a flat flight hurts each enemy it passes once. Called every flight tick with the
 * segment just flown, (ax, ay) -> the critter's position. Uses the grid built by the fire system.
 */
export function pierce(w: World, c: Critter, ax: number, ay: number): void {
  const p = X.piercers;
  const bx = c.x, by = c.y;
  const sx = bx - ax, sy = by - ay;
  const l2 = sx * sx + sy * sy;
  const l = Math.sqrt(l2);
  const ux = l > 1e-9 ? sx / l : 0, uy = l > 1e-9 ? sy / l : 0;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const n = queryCircle(w, mx, my, l / 2 + p.pathRadius, (1 - c.team) as Team);
  const pr2 = p.pathRadius * p.pathRadius;
  for (let k = 0; k < n; k++) {
    const o = w.critters[found[k]];
    if (!o.alive || o.struckBy === c.sweepKey) continue;
    closest(ax, ay, sx, sy, l2, o.x, o.y);
    const dx = o.x - cx, dy = o.y - cy;
    if (dx * dx + dy * dy > pr2) continue;
    o.struckBy = c.sweepKey;
    // knocked from a point just behind it on the line: swept forward and aside
    impactCritter(w, c.team, o, cx - ux * 0.3, cy - uy * 0.3, p.critterDamage, F.landKnock);
  }
  const e = w.heroes[1 - c.team];
  if (e.alive && e.struckBy !== c.sweepKey) {
    closest(ax, ay, sx, sy, l2, e.x, e.y);
    const dx = e.x - cx, dy = e.y - cy;
    if (dx * dx + dy * dy <= p.heroReach * p.heroReach && impactHero(w, c.team, p.heroDamage) > 0) e.struckBy = c.sweepKey;
  }
}

// closest point on segment scratch
let cx = 0, cy = 0;
function closest(ax: number, ay: number, sx: number, sy: number, l2: number, px: number, py: number): void {
  let t = l2 > 1e-12 ? ((px - ax) * sx + (py - ay) * sy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  cx = ax + sx * t;
  cy = ay + sy * t;
}

// ---------------------------------------------------------------- Homing

/** Result of homeIn. */
export const homed = { x: 0, y: 0 };

/**
 * Homing: the volley's target moves onto the nearest enemy (critter or King) within reach of the
 * aim point, judged at throw time. Needs the fire system's grid.
 */
export function homeIn(w: World, team: Team, x: number, y: number): void {
  const r = X.homing.radius;
  homed.x = x; homed.y = y;
  let bd = r * r;
  const id = nearestInCircle(w, (1 - team) as Team, x, y, r, x, y);
  if (id !== -1) { bd = nearest.d2; homed.x = w.critters[id].x; homed.y = w.critters[id].y; }
  const e = w.heroes[1 - team];
  if (e.alive) {
    const d2 = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d2 <= r * r && (id === -1 || d2 < bd)) { homed.x = e.x; homed.y = e.y; }
  }
}

// ---------------------------------------------------------------- Archer Huts

/** Archer Huts: an owned Hut or Throne shoots like a weak Tower. */
export function archerShot(w: World, b: Building, team: Team): void {
  const a = X.archerHuts;
  b.shotCd -= DT;
  if (b.shotCd > 0) return;
  b.shotCd = 0;
  const target = nearestEnemy(w, team, b.x, b.y, a.range);
  if (target === NONE) return;
  b.shotCd = a.interval;
  shoot(w, team, 'hut', b.x, b.y, target, target === HERO ? a.heroDamage : a.critterDamage);
}

// ---------------------------------------------------------------- Trample

/** Trample: the dash segment just covered, (ax, ay) -> the King, crushes each enemy critter once. */
export function trample(w: World, h: Hero, ax: number, ay: number): void {
  const t = X.trample;
  const sx = h.x - ax, sy = h.y - ay;
  const l2 = sx * sx + sy * sy;
  const r2 = t.reach * t.reach;
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!c.alive || c.team === h.team || c.state === 'fly' || c.struckBy === h.sweepKey) continue;
    closest(ax, ay, sx, sy, l2, c.x, c.y);
    const dx = c.x - cx, dy = c.y - cy;
    if (dx * dx + dy * dy > r2) continue;
    c.struckBy = h.sweepKey;
    knockCritter(c, cx, cy, t.knock);
    damageCritter(w, c, t.damage, h.team);
  }
}

// ---------------------------------------------------------------- Royal Guard

/** Royal Guard: while a Guard is missing and the King stands, replace one every replaceEvery seconds. */
export function royalGuard(w: World, team: Team): void {
  const h = w.heroes[team];
  const want = w.mods[team].guardCount;
  let have = 0;
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) if (cs[i].alive && cs[i].team === team && cs[i].kind === 'guard') have++;
  if (have >= want) { h.guardT = X.royalGuard.replaceEvery; return; }
  if (!h.alive) return;
  h.guardT -= DT;
  if (h.guardT > 0) return;
  h.guardT = X.royalGuard.replaceEvery;
  spawnGuard(w, h);
}

export function spawnGuard(w: World, h: Hero): Critter | null {
  const c = spawnCritter(w, h.team, h.x, h.y, 'follow', 'guard');
  if (!c) return null;
  c.x += c.ox * 0.5; c.y += c.oy * 0.5;
  resolveSolids(w, c, R);
  c.px = c.x; c.py = c.y;
  w.events.push({ type: 'spawn', team: h.team, critter: c.id, kind: 'guard', cause: 'guard', x: c.x, y: c.y });
  return c;
}

// ---------------------------------------------------------------- Militia

/** Militia: a building just captured gains free garrisoned critters (the swarm cap does not apply). */
export function militia(w: World, b: Building, team: Team): void {
  const inner = b.r * tuning.building.solidFrac + R + 0.05;
  for (let k = 0; k < w.mods[team].militiaGuards; k++) {
    const a = rand(w) * TAU;
    const c = birth(w, team, b.x + cos(a) * inner, b.y + sin(a) * inner, 'garrison');
    if (!c) return;
    clampToArena(c, R);
    toGarrison(w, c, b.id, false);
    w.events.push({ type: 'spawn', team, critter: c.id, kind: c.kind, cause: 'militia', x: c.x, y: c.y });
  }
}

// ---------------------------------------------------------------- Bloodrage

/** Bloodrage: Rampage has no timer; it ends on the owner's third hit, but not before minTime. */
export function bloodrage(w: World, h: Hero): void {
  const b = X.bloodrage;
  const full = tuning.hero.rampageTime * w.mods[h.team].rampageTimeMul;
  if (h.rampageHits >= b.hits && full - h.rampageT >= b.minTime) h.rampageT = 0;
}
