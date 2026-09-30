// Uniform spatial hash over the arena for ground critters (flying critters are never in it),
// one per team so "nearest enemy" never walks through a clump of friends.
// Derived data, rebuilt from the World whenever a system needs it, so it lives in module scratch
// instead of the World. Linked lists in typed arrays: no allocation per tick.
import type { World } from './types';
import { ARENA_H, ARENA_W, MAX_CRITTERS } from './types';

const CELL = 1;
const GW = Math.ceil(ARENA_W / CELL);
const GH = Math.ceil(ARENA_H / CELL);
/** head[team * cells + cell] */
const head = new Int32Array(GW * GH * 2);
const next = new Int32Array(MAX_CRITTERS);
/**
 * Critters move a little after the grid is built (within the same system pass); widen the
 * cell scan by this much so they are still found. Max ground speed x one tick is ~0.15.
 */
const SLOP = 0.25;

/** Query results: critter ids, valid up to the count a query returns. Overwritten by the next query. */
export const found = new Int32Array(MAX_CRITTERS);

function cx(x: number): number {
  const i = Math.floor(x / CELL);
  return i < 0 ? 0 : i >= GW ? GW - 1 : i;
}
function cy(y: number): number {
  const i = Math.floor(y / CELL);
  return i < 0 ? 0 : i >= GH ? GH - 1 : i;
}

export function buildGrid(w: World): void {
  head.fill(-1);
  const cs = w.critters;
  const cells = GW * GH;
  // reverse so each cell's list comes out in ascending id order
  for (let i = cs.length - 1; i >= 0; i--) {
    const c = cs[i];
    if (!c.alive || c.state === 'fly') continue;
    const k = c.team * cells + cy(c.y) * GW + cx(c.x);
    next[i] = head[k];
    head[k] = i;
  }
}

/**
 * Alive ground critters of `team` (or both teams for -1) within r of (x, y), by current
 * position, into `found`. Returns the count. Order is deterministic: team, cell rows, then id.
 */
export function queryCircle(w: World, x: number, y: number, r: number, team: 0 | 1 | -1 = -1): number {
  const cs = w.critters;
  const r2 = r * r;
  const x0 = cx(x - r - SLOP), x1 = cx(x + r + SLOP);
  const y0 = cy(y - r - SLOP), y1 = cy(y + r + SLOP);
  const cells = GW * GH;
  const t0 = team === 1 ? 1 : 0, t1 = team === 0 ? 0 : 1;
  let n = 0;
  for (let t = t0; t <= t1; t++) {
    const base = t * cells;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        for (let i = head[base + gy * GW + gx]; i !== -1; i = next[i]) {
          const c = cs[i];
          // team re-checked: Conscription can switch a critter's side after the grid was built
          if (!c.alive || c.state === 'fly' || c.team !== t) continue;
          const dx = c.x - x, dy = c.y - y;
          if (dx * dx + dy * dy <= r2) found[n++] = i;
        }
      }
    }
  }
  return n;
}

/** Result of nearestInCircle: squared distance from (fromX, fromY) to the critter found. */
export const nearest = { d2: 0 };

/**
 * The ground critter of `team` within r of (x, y) that is closest to (fromX, fromY), or -1.
 * Single pass, no result buffer: this is the hot path of critter aggro. Ties go to the first
 * found (deterministic scan order).
 */
export function nearestInCircle(
  w: World, team: 0 | 1, x: number, y: number, r: number, fromX: number, fromY: number,
): number {
  const cs = w.critters;
  const r2 = r * r;
  const x0 = cx(x - r - SLOP), x1 = cx(x + r + SLOP);
  const y0 = cy(y - r - SLOP), y1 = cy(y + r + SLOP);
  const base = team * GW * GH;
  const sameCentre = x === fromX && y === fromY;
  let best = -1;
  let bd = Infinity;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      for (let i = head[base + gy * GW + gx]; i !== -1; i = next[i]) {
        const c = cs[i];
        if (!c.alive || c.state === 'fly' || c.team !== team) continue;
        const dx = c.x - x, dy = c.y - y;
        const q2 = dx * dx + dy * dy;
        if (q2 > r2) continue;
        let d2 = q2;
        if (!sameCentre) {
          const ex = c.x - fromX, ey = c.y - fromY;
          d2 = ex * ex + ey * ey;
        }
        if (d2 < bd) { bd = d2; best = i; }
      }
    }
  }
  nearest.d2 = bd;
  return best;
}

/** Result of separation(): summed push vector. */
export const push = { x: 0, y: 0 };

/**
 * Soft-body push on critter `id` at (x, y) from every ground critter (either team) closer than
 * `range`: sum of (overlap / distance) * offset. Exactly stacked pairs split along x by id.
 */
export function separation(w: World, id: number, x: number, y: number, range: number): void {
  const cs = w.critters;
  const r2 = range * range;
  const x0 = cx(x - range - SLOP), x1 = cx(x + range + SLOP);
  const y0 = cy(y - range - SLOP), y1 = cy(y + range + SLOP);
  const cells = GW * GH;
  let sx = 0, sy = 0;
  for (let t = 0; t < 2; t++) {
    const base = t * cells;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        for (let i = head[base + gy * GW + gx]; i !== -1; i = next[i]) {
          if (i === id) continue;
          const c = cs[i];
          if (!c.alive || c.state === 'fly') continue;
          const ox = x - c.x, oy = y - c.y;
          const d2 = ox * ox + oy * oy;
          if (d2 >= r2) continue;
          if (d2 < 1e-12) { sx += id < i ? -range : range; continue; }
          const d = Math.sqrt(d2);
          const k = (range - d) / d;
          sx += ox * k;
          sy += oy * k;
        }
      }
    }
  }
  push.x = sx;
  push.y = sy;
}
