// Static collision: obstacles and building cores. Kings and walking critters slide around them;
// flying critters ignore them.
import { clamp } from './math';
import { tuning } from './tuning';
import type { World } from './types';
import { ARENA_H, ARENA_W } from './types';

interface Body { x: number; y: number }

/** Push a round body out of every solid it overlaps, then keep it inside the arena. */
export function resolveSolids(w: World, b: Body, r: number): void {
  const obs = w.obstacles;
  for (let i = 0; i < obs.length; i++) pushOut(b, obs[i].x, obs[i].y, obs[i].r + r);
  const bs = w.buildings;
  const frac = tuning.building.solidFrac;
  for (let i = 0; i < bs.length; i++) pushOut(b, bs[i].x, bs[i].y, bs[i].r * frac + r);
  clampToArena(b, r);
}

export function clampToArena(b: Body, r: number): void {
  b.x = clamp(b.x, r, ARENA_W - r);
  b.y = clamp(b.y, r, ARENA_H - r);
}

function pushOut(b: Body, ox: number, oy: number, min: number): void {
  const dx = b.x - ox, dy = b.y - oy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2);
  if (d < 1e-9) {
    b.x = ox + min; // dead centre: pick a fixed side so it stays deterministic
    return;
  }
  b.x = ox + (dx / d) * min;
  b.y = oy + (dy / d) * min;
}

/** Scratch output of steerAround (no allocation). */
export const steer = { x: 0, y: 0 };

/**
 * Bend a unit heading (dx, dy) so a walker heading for a target `toGo` away curves around any
 * solid ahead of it instead of pressing into it head-on. Writes the new unit heading to `steer`.
 */
export function steerAround(w: World, x: number, y: number, dx: number, dy: number, toGo: number, r: number): void {
  let sx = dx, sy = dy;
  const look = 0.9;
  const frac = tuning.building.solidFrac;
  const n = w.obstacles.length + w.buildings.length;
  for (let i = 0; i < n; i++) {
    let ox: number, oy: number, orad: number;
    if (i < w.obstacles.length) {
      const o = w.obstacles[i];
      ox = o.x; oy = o.y; orad = o.r;
    } else {
      const b = w.buildings[i - w.obstacles.length];
      ox = b.x; oy = b.y; orad = b.r * frac;
    }
    const rx = ox - x, ry = oy - y;
    const along = rx * dx + ry * dy;
    if (along <= 0 || along > toGo) continue; // behind us, or beyond the target
    const clear = orad + r;
    const lateral = rx * -dy + ry * dx; // signed distance of the centre from our heading line
    const absLat = lateral < 0 ? -lateral : lateral;
    if (absLat >= clear + 0.05) continue;
    const dist = Math.sqrt(rx * rx + ry * ry);
    if (dist - clear > look) continue;
    // steer to the side away from the centre; dead-on picks a fixed side
    const side = lateral > 0 ? -1 : 1;
    const urgency = 1 - (dist - clear) / look;
    const k = 1.5 * (urgency > 1 ? 1 : urgency);
    sx += -dy * side * k;
    sy += dx * side * k;
  }
  const l = Math.sqrt(sx * sx + sy * sy);
  if (l < 1e-9) { steer.x = dx; steer.y = dy; return; }
  steer.x = sx / l;
  steer.y = sy / l;
}
