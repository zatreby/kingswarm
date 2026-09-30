// Buildings: presence, capture, hatching under the swarm cap, tower shots.
import { cos, rand, sin, TAU } from '../math';
import { archerShot, birth, militia, royalGuard } from '../mutated';
import { tuning } from '../tuning';
import type { Building, Team, World } from '../types';
import { DT } from '../types';
import { hatchInterval, swarmCap } from '../world';
import { endMatch } from './match';
import { nearestEnemy, NONE, HERO, shoot } from './targeting';

const B = tuning.building;

// per-team scratch
const count: [number, number] = [0, 0];
const cap: [number, number] = [0, 0];
const owned: [number, number] = [0, 0];

export function buildingsSystem(w: World): void {
  computePresence(w);
  const bs = w.buildings;
  for (let i = 0; i < bs.length; i++) capture(w, bs[i]);

  count[0] = count[1] = 0;
  for (const c of w.critters) if (c.alive && c.kind !== 'guard') count[c.team]++; // Guards are extra
  cap[0] = swarmCap(w, 0);
  cap[1] = swarmCap(w, 1);
  owned[0] = owned[1] = 0;
  for (let i = 0; i < bs.length; i++) if (bs[i].owner !== -1) owned[bs[i].owner as Team]++;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (b.owner === -1) continue;
    if (b.kind === 'tower') tower(w, b, b.owner);
    else {
      hatch(w, b, b.owner);
      if ((b.kind === 'hut' || b.kind === 'throne') && w.mods[b.owner].archerHuts) archerShot(w, b, b.owner);
    }
  }
  if (w.mods[0].guardCount > 0) royalGuard(w, 0);
  if (w.mods[1].guardCount > 0) royalGuard(w, 1);
}

/** Presence: own ground critters in the capture zone count 1, a King counts kingPresence. */
export function computePresence(w: World): void {
  const bs = w.buildings;
  for (const b of bs) {
    b.presence[0] = b.presence[1] = 0;
    b.garrison[0] = b.garrison[1] = 0;
  }
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!c.alive || c.state === 'fly') continue;
    if (c.state === 'garrison' && c.building >= 0) bs[c.building].garrison[c.team]++;
    for (let j = 0; j < bs.length; j++) {
      const b = bs[j];
      const zr = b.r + B.captureMargin;
      const dx = c.x - b.x, dy = c.y - b.y;
      if (dx * dx + dy * dy < zr * zr) b.presence[c.team]++;
    }
  }
  for (const h of w.heroes) {
    if (!h.alive) continue;
    for (const b of bs) {
      const zr = b.r + B.captureMargin;
      const dx = h.x - b.x, dy = h.y - b.y;
      if (dx * dx + dy * dy < zr * zr) b.presence[h.team] += B.kingPresence;
    }
  }
}

function rateFor(presence: number): number {
  const mul = 1 + B.presenceBonus * presence;
  return B.captureRate * (mul < B.presenceMaxMul ? mul : B.presenceMaxMul);
}

function capture(w: World, b: Building): void {
  const p0 = b.presence[0], p1 = b.presence[1];
  if (b.owner === -1) {
    // neutral: fills for the only team present; a new claimant starts from zero
    if ((p0 > 0) === (p1 > 0)) return;
    const t: Team = p0 > 0 ? 0 : 1;
    if (b.claimant !== t) { b.claimant = t; b.control = 0; }
    b.control += rateFor(t === 0 ? p0 : p1) * DT;
    if (b.control >= 100) flip(w, b, t);
    return;
  }
  const own = b.presence[b.owner], foe = b.presence[1 - b.owner];
  if (foe > 0 && own === 0) {
    b.control -= rateFor(foe) * DT;
    if (b.control <= 0) flip(w, b, (1 - b.owner) as Team);
  } else if (own > 0 && foe === 0 && b.control < 100) {
    b.control += B.regainRate * DT;
    if (b.control > 100) b.control = 100;
  }
}

function flip(w: World, b: Building, t: Team): void {
  const prev = b.owner;
  b.owner = t;
  b.claimant = t;
  b.control = prev === -1 ? 100 : B.flipControl;
  b.hatchT = hatchInterval(b.kind);
  b.shotCd = 0;
  w.stats[t].captures++;
  w.events.push({ type: 'capture', team: t, prev, building: b.id, kind: b.kind, x: b.x, y: b.y });
  if (b.kind === 'throne' && prev !== -1 && prev !== t) endMatch(w, t, 'throne');
  else if (w.phase === 'overtime') endMatch(w, t, 'overtime');
  if (w.phase !== 'over' && w.mods[t].militiaGuards > 0) militia(w, b, t);
}

function hatch(w: World, b: Building, t: Team): void {
  const interval = hatchInterval(b.kind);
  if (interval <= 0) return;
  const m = w.mods[t];
  // Boomtown: faster while behind on buildings
  const rate = m.hatchMul * (w.frenzy ? B.frenzyHatchMul : 1) * (owned[t] < owned[1 - t] ? m.boomtownMul : 1);
  b.hatchT -= DT * rate;
  if (b.hatchT > 0) return;
  b.hatchT += interval;
  if (b.hatchT < 0) b.hatchT = 0;
  if (count[t] >= cap[t]) return;
  const a = rand(w) * TAU;
  const d = b.r * B.solidFrac + tuning.critter.radius + 0.05;
  const c = birth(w, t, b.x + cos(a) * d, b.y + sin(a) * d, 'home');
  if (!c) return;
  count[t]++;
  w.events.push({ type: 'hatch', team: t, building: b.id, critter: c.id });
}

function tower(w: World, b: Building, t: Team): void {
  b.shotCd -= DT;
  if (b.shotCd > 0) return;
  b.shotCd = 0;
  const target = nearestEnemy(w, t, b.x, b.y, B.towerRange);
  if (target === NONE) return;
  b.shotCd = B.towerInterval;
  shoot(w, t, 'tower', b.x, b.y, target, target === HERO ? B.towerHeroDamage : B.towerCritterDamage);
}
