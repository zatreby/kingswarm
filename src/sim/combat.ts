// Damage, knockback and death: the only places HP changes, so events and stats stay consistent.
// Also the Mutations that rewrite what a hit or a fall does (Shockwave, Frostbite, Leeches,
// Second Wind, Conscription), so every hit path gets them by construction.
import { toHold, toHome } from './spawn';
import { tuning } from './tuning';
import type { Critter, Hero, Team, World } from './types';

const X = tuning.mutations;

/**
 * Deaths waiting for their after-effects (Splitters' Runts, Chain Reaction blasts). They are queued
 * rather than resolved inside killCritter so a death never spawns or explodes in the middle of a
 * system's loop over the pool; settleDeaths (mutated.ts) drains the queue between systems.
 */
const DQ = 1024;
export const dying = {
  /** The World these deaths belong to: a queue never settles into a different World. */
  world: null as World | null,
  n: 0,
  x: new Float64Array(DQ),
  y: new Float64Array(DQ),
  team: new Uint8Array(DQ),
  runt: new Uint8Array(DQ),
};

/** Returns true if the hit killed it. Flying critters cannot be hit. */
export function damageCritter(w: World, c: Critter, dmg: number, by: Team): boolean {
  if (!c.alive || c.state === 'fly') return false;
  c.hp -= dmg;
  if (c.hp > 0) return false;
  killCritter(w, c, by);
  return true;
}

/** `blast`: a Bomber spending itself (not a loss, and it does not split). */
export function killCritter(w: World, c: Critter, by: Team | -1, blast = false): void {
  c.alive = false;
  c.hp = 0;
  if (!blast) w.stats[c.team].crittersLost++;
  if (by !== -1 && by !== c.team) w.stats[by].crittersKilled++;
  w.events.push({ type: 'critterDied', team: c.team, kind: c.kind, x: c.x, y: c.y });
  const m = w.mods[c.team];
  const runt = c.kind === 'runt';
  if (runt ? m.chainReaction : m.splitters && !blast) {
    if (dying.world !== w) { dying.world = w; dying.n = 0; }
    if (dying.n >= DQ) return;
    const i = dying.n++;
    dying.x[i] = c.x; dying.y[i] = c.y; dying.team[i] = c.team; dying.runt[i] = runt ? 1 : 0;
  }
}

/** Add a velocity impulse pointing from (fx, fy) through the critter. */
export function knockCritter(c: Critter, fx: number, fy: number, speed: number): void {
  const dx = c.x - fx, dy = c.y - fy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-9) { c.vx += speed; return; }
  c.vx += (dx / d) * speed;
  c.vy += (dy / d) * speed;
}

/**
 * A thrown critter's impact on an enemy critter (landing splash, Bomber blast, Piercer path):
 * knockback from (fx, fy), then the thrower's landing rewrites. Shockwave: harder knock + stun.
 * Frostbite: chill.
 */
export function impactCritter(w: World, team: Team, o: Critter, fx: number, fy: number, dmg: number, knock: number): void {
  const m = w.mods[team];
  knockCritter(o, fx, fy, knock * m.landKnockMul);
  if (m.landStun > 0 && o.stunT < m.landStun) o.stunT = m.landStun;
  if (m.frostbite && o.slowT < X.frostbite.slowTime) o.slowT = X.frostbite.slowTime;
  damageCritter(w, o, dmg, team);
}

/** A thrown critter's impact on the rival King. Frostbite: chill (Kings slow less). Leeches: heal. */
export function impactHero(w: World, team: Team, dmg: number): number {
  const e = w.heroes[1 - team];
  const dealt = damageHero(w, e, dmg, team);
  if (dealt > 0) {
    if (w.mods[team].frostbite && e.alive && e.slowT < X.frostbite.slowTime) e.slowT = X.frostbite.slowTime;
    leech(w, team);
  }
  return dealt;
}

/** Leeches: a landing or bite that hurt the rival King heals your King. */
export function leech(w: World, team: Team): void {
  if (!w.mods[team].leeches) return;
  const h = w.heroes[team];
  if (!h.alive) return;
  h.hp = h.hp + X.leeches.heal > h.maxHp ? h.maxHp : h.hp + X.leeches.heal;
}

/**
 * Damage a King. Returns the damage taken (shield included), 0 if immune (dead or invulnerable).
 * `by` is the team whose unit dealt it.
 */
export function damageHero(w: World, h: Hero, dmg: number, by: Team): number {
  if (!h.alive || h.invulnT > 0 || dmg <= 0) return 0;
  let rest = dmg;
  let shielded = false;
  if (h.shield > 0) {
    const a = h.shield < rest ? h.shield : rest;
    h.shield -= a;
    rest -= a;
    shielded = true;
  }
  h.hp -= rest;
  h.sinceHurt = 0;
  if (h.rampageT > 0) h.rampageHits++; // Bloodrage counts these
  w.stats[by].damageToHero += dmg;
  w.events.push({ type: 'heroHit', team: h.team, by, dmg, x: h.x, y: h.y, shielded });
  if (h.hp <= 0 && !secondWind(w, h)) heroFall(w, h, by);
  return dmg;
}

/**
 * Second Wind: once per battle a lethal hit instead leaves the King at half HP, knocking back and
 * stunning enemy critters around him. Returns true if it saved him.
 */
function secondWind(w: World, h: Hero): boolean {
  if (!w.mods[h.team].secondWind || h.spent.includes('secondWind')) return false;
  const s = X.secondWind;
  h.spent.push('secondWind');
  h.hp = h.maxHp * s.hpFrac;
  w.events.push({ type: 'secondWind', team: h.team, x: h.x, y: h.y });
  const r2 = s.radius * s.radius;
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!c.alive || c.team === h.team || c.state === 'fly') continue;
    const dx = c.x - h.x, dy = c.y - h.y;
    if (dx * dx + dy * dy > r2) continue;
    knockCritter(c, h.x, h.y, s.knock);
    if (c.stunT < s.stun) c.stunT = s.stun;
  }
  return true;
}

function heroFall(w: World, h: Hero, by: Team): void {
  h.hp = 0;
  h.alive = false;
  h.respawnT = tuning.hero.respawnTime;
  h.vx = h.vy = 0;
  h.dashT = 0;
  h.stunT = 0;
  h.shield = 0;
  h.shieldT = 0;
  h.rampageT = 0;
  w.events.push({ type: 'heroDown', team: h.team, by, x: h.x, y: h.y });
  // his swing arm is gone: the swarm stands where it is
  for (const c of w.critters)
    if (c.alive && c.team === h.team && (c.state === 'follow' || c.state === 'home')) toHold(c, tuning.fire.holdTime);
  const killer = w.heroes[by];
  if (by === h.team) return;
  if (w.mods[by].conscription) conscription(w, h, by);
  killer.kills++;
  w.stats[by].heroKills++;
  if (killer.alive) {
    killer.rampageT = tuning.hero.rampageTime * w.mods[by].rampageTimeMul;
    killer.rampageHits = 0;
    w.events.push({ type: 'rampage', team: by });
  }
}

/** Conscription: the fallen King's ground critters near where he fell switch sides and run to their new King. */
function conscription(w: World, fallen: Hero, to: Team): void {
  const r2 = X.conscription.radius * X.conscription.radius;
  let n = 0;
  for (const c of w.critters) {
    if (!c.alive || c.team !== fallen.team || c.state === 'fly' || c.kind === 'guard') continue;
    const dx = c.x - fallen.x, dy = c.y - fallen.y;
    if (dx * dx + dy * dy > r2) continue;
    c.team = to;
    toHome(c);
    n++;
  }
  if (n > 0) w.events.push({ type: 'conscript', team: to, count: n, x: fallen.x, y: fallen.y });
}
