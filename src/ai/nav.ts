// Coarse path planning for a King: A* on a half-unit grid over the static solids (obstacles and
// building cores, inflated by the King's radius). Reactive steering alone has local minima in
// concave pockets; a plan does not. Built once per match (solids never move) and rebuilt by the
// unstuck rule if the King stops making progress anyway.
import { ARENA_H, ARENA_W, tuning } from '../sim';
import type { World } from '../sim';

const CELL = 0.5;
const GW = Math.ceil(ARENA_W / CELL);
const GH = Math.ceil(ARENA_H / CELL);
const N = GW * GH;
const KING_R = tuning.hero.radius;
/** Clearance margin beyond touching, so plans do not graze solids. */
const PAD = 0.08;
const SQRT2 = Math.SQRT2;

interface Solid { x: number; y: number; r: number }

export class NavGrid {
  readonly solids: Solid[] = [];
  private blocked = new Uint8Array(N);
  // A* scratch
  private g = new Float64Array(N);
  private f = new Float64Array(N);
  private from = new Int32Array(N);
  private closed = new Uint8Array(N);
  private heap = new Int32Array(N * 8);
  private heapN = 0;
  /** Last path, as world points from start to goal. */
  readonly path: number[] = [];

  constructor(w: World) {
    this.rebuild(w);
  }

  rebuild(w: World): void {
    this.solids.length = 0;
    for (const o of w.obstacles) this.solids.push({ x: o.x, y: o.y, r: o.r });
    const frac = tuning.building.solidFrac;
    for (const b of w.buildings) this.solids.push({ x: b.x, y: b.y, r: b.r * frac });
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        this.blocked[j * GW + i] = this.isFree((i + 0.5) * CELL, (j + 0.5) * CELL) ? 0 : 1;
      }
    }
  }

  /** A King centred here overlaps no solid and stays inside the arena. */
  isFree(x: number, y: number, pad = PAD): boolean {
    const m = KING_R + pad * 0.5;
    if (x < m || y < m || x > ARENA_W - m || y > ARENA_H - m) return false;
    for (const s of this.solids) {
      const r = s.r + KING_R + pad;
      const dx = x - s.x, dy = y - s.y;
      if (dx * dx + dy * dy < r * r) return false;
    }
    return true;
  }

  /** The straight walk from a to b touches no (inflated) solid. */
  segmentClear(ax: number, ay: number, bx: number, by: number): boolean {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    for (const s of this.solids) {
      const r = s.r + KING_R + PAD * 0.5;
      let t = l2 > 0 ? ((s.x - ax) * dx + (s.y - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + dx * t - s.x, py = ay + dy * t - s.y;
      if (px * px + py * py < r * r) return false;
    }
    return true;
  }

  private cellOf(x: number, y: number): number {
    let i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    i = i < 0 ? 0 : i >= GW ? GW - 1 : i;
    j = j < 0 ? 0 : j >= GH ? GH - 1 : j;
    return j * GW + i;
  }

  /** Nearest unblocked cell to (x, y), by growing square rings. */
  private nearestFree(x: number, y: number): number {
    const c = this.cellOf(x, y);
    if (!this.blocked[c]) return c;
    const ci = c % GW, cj = (c - ci) / GW;
    for (let r = 1; r < GW; r++) {
      let best = -1, bd = Infinity;
      for (let j = cj - r; j <= cj + r; j++) {
        for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
          if (Math.abs(i - ci) !== r && Math.abs(j - cj) !== r) continue;
          const k = j * GW + i;
          if (this.blocked[k]) continue;
          const dx = (i + 0.5) * CELL - x, dy = (j + 0.5) * CELL - y;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = k; }
        }
      }
      if (best >= 0) return best;
    }
    return c;
  }

  /**
   * Plan from (sx, sy) to (gx, gy) into `path` (smoothed: only turning points kept).
   * A goal inside a solid is moved to the nearest free spot. Returns false if no route exists.
   */
  plan(sx: number, sy: number, gx: number, gy: number): boolean {
    const path = this.path;
    path.length = 0;
    const start = this.nearestFree(sx, sy);
    const goal = this.nearestFree(gx, gy);
    const goalFree = this.isFree(gx, gy);
    const ex = goalFree ? gx : (goal % GW + 0.5) * CELL;
    const ey = goalFree ? gy : (Math.floor(goal / GW) + 0.5) * CELL;
    if (this.segmentClear(sx, sy, ex, ey)) { path.push(ex, ey); return true; }

    const { g, f, from, closed } = this;
    g.fill(Infinity);
    closed.fill(0);
    this.heapN = 0;
    const gi = goal % GW, gj = (goal - gi) / GW;
    const h = (k: number) => {
      const i = k % GW, j = (k - i) / GW;
      const dx = Math.abs(i - gi), dy = Math.abs(j - gj);
      return (dx + dy + (SQRT2 - 2) * Math.min(dx, dy)) * CELL;
    };
    g[start] = 0;
    f[start] = h(start);
    from[start] = -1;
    this.push(start);
    let found = false;
    while (this.heapN > 0) {
      const cur = this.pop();
      if (closed[cur]) continue;
      if (cur === goal) { found = true; break; }
      closed[cur] = 1;
      const ci = cur % GW, cj = (cur - ci) / GW;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
          const nk = nj * GW + ni;
          if (this.blocked[nk] || closed[nk]) continue;
          // no corner cutting past a blocked cell
          if (di && dj && (this.blocked[cj * GW + ni] || this.blocked[nj * GW + ci])) continue;
          const ng = g[cur] + (di && dj ? SQRT2 : 1) * CELL;
          if (ng < g[nk]) {
            g[nk] = ng;
            f[nk] = ng + h(nk);
            from[nk] = cur;
            this.push(nk);
          }
        }
      }
    }
    if (!found) return false;

    // walk back, then keep only the points a straight walk cannot skip
    const cells: number[] = [];
    for (let k = goal; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    const last = cells.length - 1;
    const px = (j: number) => (j === last ? ex : (cells[j] % GW + 0.5) * CELL);
    const py = (j: number) => (j === last ? ey : (Math.floor(cells[j] / GW) + 0.5) * CELL);
    let ax = sx, ay = sy;
    let i = 0;
    for (;;) {
      let j = last;
      while (j > i && !this.segmentClear(ax, ay, px(j), py(j))) j--;
      path.push(px(j), py(j));
      ax = px(j); ay = py(j);
      if (j >= last) break;
      i = j + 1;
    }
    return true;
  }

  private push(k: number): void {
    const hp = this.heap, f = this.f;
    let i = this.heapN++;
    if (i >= hp.length) { this.heapN--; return; }
    hp[i] = k;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[hp[p]] <= f[hp[i]]) break;
      const t = hp[p]; hp[p] = hp[i]; hp[i] = t;
      i = p;
    }
  }

  private pop(): number {
    const hp = this.heap, f = this.f;
    const top = hp[0];
    hp[0] = hp[--this.heapN];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < this.heapN && f[hp[l]] < f[hp[m]]) m = l;
      if (r < this.heapN && f[hp[r]] < f[hp[m]]) m = r;
      if (m === i) break;
      const t = hp[m]; hp[m] = hp[i]; hp[i] = t;
      i = m;
    }
    return top;
  }
}
