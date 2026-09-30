// Pure presentation helpers: sim space <-> scene space, flight arcs, ring state. No three.js here so it tests in Node.
import { ARENA_W, ARENA_H } from '../sim/types';
import type { Building, Owner } from '../sim/types';

/** Mirrors tuning.building.captureMargin (the renderer imports only types from the sim; see report). */
export const CAPTURE_MARGIN = 0.55;
/** Mirrors tuning.match.crownHold: seconds of Crown hold to win. */
export const CROWN_HOLD = 10;
/** Mirrors tuning.fire.range: base throw range, multiplied by TeamMods.throwRangeMul. */
export const THROW_RANGE = 8.25;

export const HALF_W = ARENA_W / 2;
export const HALF_H = ARENA_H / 2;

/** Sim (x, y) -> scene x. Scene is centred on the arena; sim y grows toward the camera = scene +z. */
export const sceneX = (x: number) => x - HALF_W;
export const sceneZ = (y: number) => y - HALF_H;
export const simX = (sx: number) => sx + HALF_W;
export const simY = (sz: number) => sz + HALF_H;

export const captureRadius = (b: Pick<Building, 'r'>) => b.r + CAPTURE_MARGIN;

// Flight arc feel: apex grows with throw distance so long lobs read as lobs; Piercers skim.
// Exaggerated for readability (art review): lobs clear the crowd so the volley reads as shots, not a line.
export const FLIGHT = { apexPerUnit: 0.36, apexMin: 1.1, apexMax: 3.1, flatApex: 0.3, lift: 0.1 } as const;

export function flightApex(dist: number, flat: boolean): number {
  if (flat) return FLIGHT.flatApex;
  return Math.min(FLIGHT.apexMax, Math.max(FLIGHT.apexMin, dist * FLIGHT.apexPerUnit));
}

/** Height above ground at flight fraction u (0..1): a parabola peaking at the apex, 0 at both ends. */
export function flightHeight(u: number, dist: number, flat: boolean): number {
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  return 4 * t * (1 - t) * flightApex(dist, flat) + FLIGHT.lift * Math.sin(Math.PI * t);
}

/** Rise per unit of horizontal travel at fraction u (d height / d distance), for pitching a thrown body along its arc. */
export function flightSlope(u: number, dist: number, flat: boolean): number {
  if (dist < 1e-4) return 0;
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  return (4 * (1 - 2 * t) * flightApex(dist, flat) + FLIGHT.lift * Math.PI * Math.cos(Math.PI * t)) / dist;
}

export interface RingState { team: Owner; fill: number; contested: boolean }

/** What a building's capture ring shows: whose colour, how full (0..1), and whether both sides stand on it. */
export function ringState(b: Pick<Building, 'owner' | 'claimant' | 'control' | 'presence'>, out: RingState): RingState {
  const fill = Math.min(1, Math.max(0, b.control / 100));
  if (b.owner !== -1) { out.team = b.owner; out.fill = fill; }
  else { out.team = b.claimant; out.fill = b.claimant === -1 ? 0 : fill; }
  out.contested = b.presence[0] > 0 && b.presence[1] > 0;
  return out;
}

/** Small seeded PRNG for cosmetic layout (decor placement must look the same every time). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shortest signed angle from a to b, radians. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Frame-rate independent exponential approach factor. */
export const approach = (k: number, dt: number) => 1 - Math.exp(-k * dt);

/** Distance from point (px, py) to segment (ax, ay)-(bx, by). */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + dx * t - px, ey = ay + dy * t - py;
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * Which building pairs get a dirt path: each building links to its nearest neighbours within reach,
 * deduplicated. Deterministic for a given layout.
 */
export function pathPairs(pts: readonly { x: number; y: number }[], reach = 7.5, perNode = 2): [number, number][] {
  const seen = new Set<string>(), out: [number, number][] = [];
  pts.forEach((a, i) => {
    const near = pts.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter(o => o.j !== i && o.d <= reach).sort((p, q) => p.d - q.d || p.j - q.j).slice(0, perNode);
    for (const { j } of near) {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(k)) { seen.add(k); out.push(i < j ? [i, j] : [j, i]); }
    }
  });
  return out;
}
