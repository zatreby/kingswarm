// Spatial focus navigation for keyboard arrows and gamepad d-pad (pure; tested in focus.test.ts).

export interface Rect { x: number; y: number; w: number; h: number }
export type Dir = 'up' | 'down' | 'left' | 'right';

/**
 * Index of the best candidate in `dir` from `from`, or -1.
 * A candidate must lie beyond `from` along the axis (by its centre); among those, the one with the
 * smallest along-axis gap plus a heavier penalty for sideways offset wins, so rows and columns feel natural.
 * Candidates overlapping `from` on the cross axis get a bonus (same row / same column).
 */
export function pickInDirection(from: Rect, candidates: readonly Rect[], dir: Dir, skip = -1): number {
  const fx = from.x + from.w / 2, fy = from.y + from.h / 2;
  const horiz = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  let best = -1, bestScore = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    if (i === skip) continue;
    const c = candidates[i];
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    const along = (horiz ? cx - fx : cy - fy) * sign;
    if (along <= 1) continue;
    // Gap between facing edges (0 when they touch or overlap).
    const gap = Math.max(0, horiz
      ? (sign > 0 ? c.x - (from.x + from.w) : from.x - (c.x + c.w))
      : (sign > 0 ? c.y - (from.y + from.h) : from.y - (c.y + c.h)));
    const cross = horiz ? Math.abs(cy - fy) : Math.abs(cx - fx);
    const overlap = horiz
      ? Math.min(from.y + from.h, c.y + c.h) - Math.max(from.y, c.y)
      : Math.min(from.x + from.w, c.x + c.w) - Math.max(from.x, c.x);
    const score = gap + along * 0.25 + cross * 2 - (overlap > 0 ? 1e4 : 0);
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}

/** Linear fallback for lists: next/previous index with wrap. */
export function stepIndex(i: number, n: number, delta: number): number {
  if (n <= 0) return -1;
  if (i < 0) return delta > 0 ? 0 : n - 1;
  return ((i + delta) % n + n) % n;
}
