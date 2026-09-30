// One arena per rival. Each MapDef lists the Blue half only; the sim mirrors it through the arena
// centre for Red, so every layout is fair by construction. validateArena() states the layout rules
// every arena must pass (arenas.test.ts runs it over all of them).
import { ARENA_H, ARENA_W, meadow, tuning } from '../sim';
import type { BuildingKind, MapDef, Obstacle } from '../sim';
import type { ArenaId } from './content';

/** Pip: each side has two Towers, one on the Throne approach and one on the Crown approach.
 *  Question: can you siege? The top route (huts at 3.8,8.8 and 8.6,4.4) is unguarded (flank);
 *  Long Arm out-ranges a Tower (bait / out-range). */
export const tinkerworks: MapDef = {
  id: 'tinkerworks',
  name: 'Tinkerworks',
  half: [
    { kind: 'throne', x: 3.5, y: 14.5 },
    { kind: 'hut', x: 8.2, y: 15.6 },
    { kind: 'hut', x: 3.8, y: 8.8 },
    { kind: 'hut', x: 8.6, y: 4.4 },
    { kind: 'tower', x: 8.0, y: 11.4 },
    { kind: 'tower', x: 12.4, y: 13.2 },
  ],
  obstacles: [
    { x: 10.6, y: 9.6, r: 0.7, look: 'rock' },
    { x: 13.4, y: 5.2, r: 0.8, look: 'rock' },
    { x: 1.8, y: 11.6, r: 0.6, look: 'rock' },
  ],
};

/** Mother Brood: six huts per side and an open centre. Question: can you thin a flood? */
export const warren: MapDef = {
  id: 'warren',
  name: 'The Warren',
  half: [
    { kind: 'throne', x: 3.2, y: 14.8 },
    { kind: 'hut', x: 8.0, y: 15.8 },
    { kind: 'hut', x: 3.0, y: 9.8 },
    { kind: 'hut', x: 8.2, y: 11.2 },
    { kind: 'hut', x: 12.9, y: 15.0 },
    { kind: 'hut', x: 6.8, y: 5.6 },
    { kind: 'hut', x: 12.0, y: 2.8 },
  ],
  obstacles: [
    { x: 1.6, y: 5.0, r: 0.8, look: 'pond' },
    { x: 3.2, y: 2.4, r: 0.7, look: 'trees' },
  ],
};

/** Gorm: the Thrones sit close on a short direct lane; the huts are out on the flanks.
 *  Question: defend the wave, or raid while he marches? */
export const gullet: MapDef = {
  id: 'gullet',
  name: "Glutton's Gullet",
  half: [
    { kind: 'throne', x: 8.0, y: 12.5 },
    { kind: 'hut', x: 3.2, y: 15.2 },
    { kind: 'hut', x: 3.4, y: 6.4 },
    { kind: 'hut', x: 12.8, y: 16.0 },
    { kind: 'hut', x: 8.8, y: 2.6 },
  ],
  obstacles: [
    { x: 6.2, y: 9.0, r: 0.9, look: 'rock' },
    { x: 13.6, y: 13.0, r: 0.8, look: 'rock' },
    { x: 4.8, y: 10.6, r: 0.6, look: 'trees' },
  ],
};

/** Queen Sable: tree clumps break every straight approach, so ambushes come from cover.
 *  Question: can you read a feint? */
export const sablewood: MapDef = {
  id: 'sablewood',
  name: 'Sablewood',
  half: [
    { kind: 'throne', x: 3.5, y: 14.5 },
    { kind: 'hut', x: 8.6, y: 13.0 },
    { kind: 'hut', x: 3.8, y: 8.4 },
    { kind: 'hut', x: 12.4, y: 16.0 },
    { kind: 'hut', x: 12.6, y: 6.6 },
    { kind: 'hut', x: 7.6, y: 3.4 },
  ],
  obstacles: [
    { x: 10.6, y: 9.8, r: 0.9, look: 'trees' },
    { x: 6.8, y: 6.4, r: 0.8, look: 'trees' },
    { x: 11.2, y: 11.8, r: 0.7, look: 'trees' },
    { x: 1.8, y: 11.4, r: 0.7, look: 'trees' },
    { x: 13.6, y: 3.4, r: 0.8, look: 'trees' },
    { x: 7.0, y: 10.2, r: 0.6, look: 'rock' },
  ],
  centre: [
    { x: 16, y: 4.2, r: 0.8, look: 'trees' },
    { x: 16, y: 13.8, r: 0.8, look: 'trees' },
  ],
};

/** King Mora: a Tower on each side stands next to the Crown, and more huts to fight over.
 *  Question: can you break the Guard before he storms the Crown? */
export const crownhall: MapDef = {
  id: 'crownhall',
  name: 'Crown Hall',
  half: [
    { kind: 'throne', x: 3.0, y: 14.8 },
    { kind: 'hut', x: 7.8, y: 15.8 },
    { kind: 'hut', x: 3.2, y: 9.6 },
    { kind: 'hut', x: 7.8, y: 11.4 },
    { kind: 'hut', x: 12.4, y: 16.0 },
    { kind: 'hut', x: 7.4, y: 4.6 },
    { kind: 'tower', x: 12.4, y: 10.8 },
  ],
  obstacles: [
    { x: 11.0, y: 6.2, r: 0.7, look: 'rock' },
    { x: 1.8, y: 4.4, r: 0.8, look: 'pond' },
    { x: 12.6, y: 2.4, r: 0.6, look: 'rock' },
  ],
};

export const ARENAS: Record<ArenaId, MapDef> = {
  meadow, tinkerworks, warren, gullet, sablewood, crownhall,
};

/** Layout rules (numbers in world units). */
export const ARENA_RULES = {
  /** Every listed centre point stays this far inside the arena edge. */
  edgeMargin: 1.2,
  /** Blue-half items stay this far left of the vertical centre line (x = ARENA_W / 2). */
  centreLineGap: 1.5,
  /** Building to building: centre distance >= r1 + r2 + this (their capture zones never touch). */
  buildingGap: 1.6,
  minPerSide: 4,
  maxPerSide: 7,
  maxBuildings: 17,
} as const;

interface Placed { kind: BuildingKind; x: number; y: number; r: number }

/** Every building of both teams plus the Crown, as the sim places them. */
export function placedBuildings(map: MapDef): Placed[] {
  const R = tuning.building.radius;
  const blue = map.half.map((b) => ({ kind: b.kind, x: b.x, y: b.y, r: R[b.kind] }));
  return [
    ...blue,
    ...blue.map((b) => ({ ...b, x: ARENA_W - b.x, y: ARENA_H - b.y })),
    { kind: 'crown', x: ARENA_W / 2, y: ARENA_H / 2, r: R.crown },
  ];
}

export function placedObstacles(map: MapDef): Obstacle[] {
  return [
    ...map.obstacles,
    ...map.obstacles.map((o) => ({ ...o, x: ARENA_W - o.x, y: ARENA_H - o.y })),
    ...(map.centre ?? []),
  ];
}

/** Distance from point p to segment a-b. */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Every rule this arena breaks, as readable strings. Empty = valid. */
export function validateArena(map: MapDef): string[] {
  const bad: string[] = [];
  const A = ARENA_RULES;
  const m = A.edgeMargin;
  const cx = ARENA_W / 2;
  const inside = (x: number, y: number) => x >= m && x <= ARENA_W - m && y >= m && y <= ARENA_H - m;
  const hut = tuning.building.captureMargin + tuning.hero.radius;

  const n = map.half.length;
  if (n < A.minPerSide || n > A.maxPerSide) bad.push(`${n} buildings per side (want ${A.minPerSide}-${A.maxPerSide})`);
  if (n * 2 + 1 > A.maxBuildings) bad.push(`${n * 2 + 1} buildings in total (max ${A.maxBuildings})`);
  if (map.half.filter((b) => b.kind === 'throne').length !== 1) bad.push('needs exactly one Throne per side');

  for (const b of map.half) {
    if (!inside(b.x, b.y)) bad.push(`${b.kind} at ${b.x},${b.y} is within ${m} of the edge`);
    if (b.x > cx - A.centreLineGap) bad.push(`${b.kind} at ${b.x},${b.y} is not in the Blue half`);
  }
  for (const o of map.obstacles) {
    if (!inside(o.x, o.y) || o.x - o.r <= 0 || o.y - o.r <= 0 || o.y + o.r >= ARENA_H) bad.push(`obstacle at ${o.x},${o.y} is outside`);
    if (o.x > cx - A.centreLineGap) bad.push(`obstacle at ${o.x},${o.y} is not in the Blue half`);
    if (o.r > 1) bad.push(`obstacle at ${o.x},${o.y} is too big (r ${o.r})`);
  }
  for (const o of map.centre ?? []) {
    if (!inside(o.x, o.y)) bad.push(`centre obstacle at ${o.x},${o.y} is outside`);
    // centre obstacles are not mirrored, so the list itself must be point-symmetric to stay fair
    const twin = (map.centre ?? []).some((p) => Math.abs(p.x - (ARENA_W - o.x)) < 1e-6 && Math.abs(p.y - (ARENA_H - o.y)) < 1e-6 && p.r === o.r);
    if (!twin) bad.push(`centre obstacle at ${o.x},${o.y} has no mirror twin`);
  }

  const bs = placedBuildings(map);
  const os = placedObstacles(map);
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < a.r + b.r + A.buildingGap) bad.push(`${a.kind} ${a.x},${a.y} overlaps ${b.kind} ${b.x},${b.y} (${d.toFixed(2)})`);
    }
    for (const o of os) {
      const a = bs[i];
      const d = Math.hypot(a.x - o.x, a.y - o.y);
      if (d <= a.r + o.r + hut) bad.push(`obstacle ${o.x},${o.y} crowds ${a.kind} ${a.x.toFixed(1)},${a.y.toFixed(1)}`);
    }
  }

  // a Throne's nearest hut is always reachable in a straight line (the first capture never detours)
  for (const t of bs.filter((b) => b.kind === 'throne')) {
    let near: Placed | null = null;
    for (const b of bs) if (b.kind === 'hut' && (!near || Math.hypot(b.x - t.x, b.y - t.y) < Math.hypot(near.x - t.x, near.y - t.y))) near = b;
    if (!near) { bad.push('no hut'); continue; }
    for (const o of os)
      if (segDist(o.x, o.y, t.x, t.y, near.x, near.y) <= o.r + tuning.hero.radius)
        bad.push(`obstacle ${o.x},${o.y} blocks Throne ${t.x},${t.y} -> hut ${near.x},${near.y}`);
  }
  return bad;
}
