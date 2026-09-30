// The swarm gun: recall, volleys, flight and landing.
import { impactCritter, impactHero, killCritter } from '../combat';
import { buildGrid, found, queryCircle } from '../grid';
import { KIND_LAND_DAMAGE, KIND_LAND_HERO_DAMAGE, KIND_LAND_RADIUS } from '../kinds';
import { finite, randRange } from '../math';
import { clampToArena } from '../solids';
import { blastHitHero, bomberBlast, dropScorch, homed, homeIn, pierce, sweepKeyFor } from '../mutated';
import { toGarrison, toHold, toHome } from '../spawn';
import { tuning } from '../tuning';
import type { Critter, Hero, PlayerInput, World } from '../types';
import { DT } from '../types';

const F = tuning.fire;

// volley selection scratch (no allocation)
const MAX_VOLLEY = 16;
const pickId = new Int32Array(MAX_VOLLEY);
const pickD = new Float64Array(MAX_VOLLEY);

export function fireSystem(w: World, inputs: readonly [PlayerInput, PlayerInput]): void {
  buildGrid(w);
  for (let t = 0; t < 2; t++) {
    const h = w.heroes[t];
    const inp = inputs[t];
    h.fireCd = h.fireCd - DT > -DT ? h.fireCd - DT : -DT; // keep at most one tick of carry
    if (h.noAmmoT > 0) h.noAmmoT = h.noAmmoT - DT > 0 ? h.noAmmoT - DT : 0;
    if (!h.alive) continue;
    if (inp.recall && !h.prev.recall) recall(w, h);
    if (inp.fire && h.stunT <= 0 && h.fireCd <= 0) volley(w, h, finite(inp.aimX), finite(inp.aimY));
  }
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.alive && c.state === 'fly') fly(w, c);
  }
}

function recall(w: World, h: Hero): void {
  let n = 0;
  for (const c of w.critters) {
    if (!c.alive || c.team !== h.team) continue;
    if (c.state === 'hold' || c.state === 'garrison') { toHome(c); n++; }
  }
  w.events.push({ type: 'recall', team: h.team, count: n, x: h.x, y: h.y });
}

function volley(w: World, h: Hero, aimX: number, aimY: number): void {
  const m = w.mods[h.team];
  // clamp the target to throw range
  let dx = aimX - h.x, dy = aimY - h.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const range = F.range * m.throwRangeMul;
  if (d > range) { dx = (dx / d) * range; dy = (dy / d) * range; }
  let tx = h.x + dx, ty = h.y + dy;
  if (m.homing) { homeIn(w, h.team, tx, ty); tx = homed.x; ty = homed.y; }

  // up to perVolley followers, closest to the target first
  const want = F.perVolley < MAX_VOLLEY ? F.perVolley : MAX_VOLLEY;
  let n = 0;
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    // Royal Guards are never fired
    if (!c.alive || c.team !== h.team || c.state !== 'follow' || c.stunT > 0 || c.kind === 'guard') continue;
    const cd = (c.x - tx) * (c.x - tx) + (c.y - ty) * (c.y - ty);
    if (n === want && cd >= pickD[n - 1]) continue;
    let j = n < want ? n++ : n - 1;
    while (j > 0 && pickD[j - 1] > cd) { pickD[j] = pickD[j - 1]; pickId[j] = pickId[j - 1]; j--; }
    pickD[j] = cd; pickId[j] = i;
  }

  if (n === 0) {
    h.fireCd = F.emptyWait;
    if (h.noAmmoT <= 0) {
      h.noAmmoT = F.noAmmoEvery;
      w.events.push({ type: 'noAmmo', team: h.team });
    }
    return;
  }

  const scatter = F.scatter * m.scatterMul;
  const speed = F.flightSpeed * m.flightSpeedMul;
  // sort picks by id so rng draws do not depend on the distance ranking's tie order
  for (let a = 1; a < n; a++) {
    const id = pickId[a];
    let b = a;
    while (b > 0 && pickId[b - 1] > id) { pickId[b] = pickId[b - 1]; b--; }
    pickId[b] = id;
  }
  for (let k = 0; k < n; k++) {
    const c = cs[pickId[k]];
    c.state = 'fly';
    c.building = -1;
    c.sx = c.x; c.sy = c.y;
    c.tx = tx + randRange(w, -scatter, scatter);
    c.ty = ty + randRange(w, -scatter, scatter);
    const fl = Math.sqrt((c.tx - c.sx) * (c.tx - c.sx) + (c.ty - c.sy) * (c.ty - c.sy));
    if (m.piercers) {
      // Piercers: flat and fast, straight at the point
      c.flat = true;
      c.sweepKey = sweepKeyFor(w, c.id);
      const dur = fl / (tuning.mutations.piercers.speed * m.flightSpeedMul);
      c.flightDur = dur > DT ? dur : DT;
    } else {
      c.flightDur = fl / speed + F.flightBase;
    }
    c.flightT = 0;
    c.vx = (c.tx - c.sx) / c.flightDur;
    c.vy = (c.ty - c.sy) / c.flightDur;
  }
  h.fireCd += F.interval * m.fireIntervalMul;
  w.stats[h.team].thrown += n;
  w.events.push({ type: 'throw', team: h.team, critter: pickId[0], x: h.x, y: h.y, tx, ty, count: n });
}

function fly(w: World, c: Critter): void {
  const ax = c.x, ay = c.y;
  c.flightT += DT;
  const u = c.flightT >= c.flightDur ? 1 : c.flightT / c.flightDur;
  c.x = c.sx + (c.tx - c.sx) * u;
  c.y = c.sy + (c.ty - c.sy) * u;
  if (c.flat) pierce(w, c, ax, ay);
  if (u >= 1) land(w, c);
}

function land(w: World, c: Critter): void {
  const m = w.mods[c.team];
  c.x = c.tx; c.y = c.ty;
  clampToArena(c, tuning.critter.radius);
  c.vx = c.vy = 0;
  c.state = 'hold'; // grounded before resolving hits so it is a valid ground critter afterwards

  if (m.scorch) dropScorch(w, c.team, c.x, c.y);

  if (c.kind === 'bomber') {
    // Bombers: the landing is an explosion, and the Bomber is spent
    const hits = bomberBlast(w, c);
    w.events.push({ type: 'land', team: c.team, critter: c.id, kind: c.kind, x: c.x, y: c.y, hits, hitHero: blastHitHero });
    killCritter(w, c, -1, true);
    return;
  }

  let hits = 0;
  let hitHero = false;
  if (!c.flat) {
    // the splash (a Piercer already hit everything on its way instead)
    const lr = KIND_LAND_RADIUS[c.kind] * m.landRadiusMul;
    const dmg = KIND_LAND_DAMAGE[c.kind] * m.landDamageMul;
    const n = queryCircle(w, c.x, c.y, lr, (1 - c.team) as 0 | 1);
    for (let k = 0; k < n; k++) {
      const o = w.critters[found[k]];
      if (!o.alive || o.state === 'fly') continue; // killed earlier in this same splash
      impactCritter(w, c.team, o, c.x, c.y, dmg, F.landKnock);
      hits++;
    }
    const e = w.heroes[1 - c.team];
    const hr = F.landHeroRadius * m.landRadiusMul;
    if (e.alive && (e.x - c.x) * (e.x - c.x) + (e.y - c.y) * (e.y - c.y) <= hr * hr) {
      if (impactHero(w, c.team, KIND_LAND_HERO_DAMAGE[c.kind] * m.landDamageMul) > 0) { hitHero = true; hits++; }
    }
  }
  c.flat = false;
  w.events.push({ type: 'land', team: c.team, critter: c.id, kind: c.kind, x: c.x, y: c.y, hits, hitHero });

  // stay where it landed: garrison if on a building, otherwise hold in the open
  const bs = w.buildings;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    const zr = b.r + tuning.building.captureMargin;
    const d2 = (b.x - c.x) * (b.x - c.x) + (b.y - c.y) * (b.y - c.y);
    if (d2 < zr * zr && d2 < bestD) { bestD = d2; best = i; }
  }
  if (best >= 0) toGarrison(w, c, best, true);
  else toHold(c, F.holdTime);
}
