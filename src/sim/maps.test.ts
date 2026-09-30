import { describe, expect, it } from 'vitest';
import { MAPS, meadow } from './maps';
import { tuning } from './tuning';
import { ARENA_H, ARENA_W } from './types';

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

describe('meadow', () => {
  const blue = [...meadow.half.map((b) => ({ x: b.x, y: b.y, r: tuning.building.radius[b.kind] }))];
  const all = [
    ...blue,
    ...blue.map((b) => ({ x: ARENA_W - b.x, y: ARENA_H - b.y, r: b.r })),
    { x: ARENA_W / 2, y: ARENA_H / 2, r: tuning.building.radius.crown },
  ];
  const obstacles = [
    ...meadow.obstacles,
    ...meadow.obstacles.map((o) => ({ ...o, x: ARENA_W - o.x, y: ARENA_H - o.y })),
    ...(meadow.centre ?? []),
  ];

  it('is registered', () => {
    expect(MAPS.meadow).toBe(meadow);
  });

  it('has the brief layout for Blue', () => {
    expect(meadow.half[0]).toEqual({ kind: 'throne', x: 3.5, y: 14.5 });
    expect(meadow.half.slice(1).map((b) => [b.x, b.y])).toEqual([[8.5, 12], [4.5, 8.5], [12, 15.5], [12.5, 7], [8.5, 3.8]]);
  });

  it('has 3-4 small obstacles per half inside the arena', () => {
    expect(meadow.obstacles.length).toBeGreaterThanOrEqual(3);
    expect(meadow.obstacles.length).toBeLessThanOrEqual(4);
    for (const o of obstacles) {
      expect(o.r).toBeLessThanOrEqual(1);
      expect(o.x - o.r).toBeGreaterThan(0);
      expect(o.x + o.r).toBeLessThan(ARENA_W);
      expect(o.y - o.r).toBeGreaterThan(0);
      expect(o.y + o.r).toBeLessThan(ARENA_H);
    }
  });

  it('keeps obstacles clear of capture zones', () => {
    for (const o of obstacles)
      for (const b of all)
        expect(Math.hypot(o.x - b.x, o.y - b.y)).toBeGreaterThan(o.r + b.r + tuning.building.captureMargin + tuning.hero.radius);
  });

  it('does not block the direct route between any two nearby buildings', () => {
    const clearance = tuning.hero.radius;
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) > 10) continue;
        for (const o of obstacles)
          expect(segDist(o.x, o.y, a.x, a.y, b.x, b.y), `obstacle at ${o.x},${o.y} blocks ${a.x},${a.y} -> ${b.x},${b.y}`)
            .toBeGreaterThan(o.r + clearance);
      }
  });
});
