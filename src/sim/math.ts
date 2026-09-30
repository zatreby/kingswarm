// The only door between the sim and implementation-approximated maths.
// ECMAScript lets engines round sin/cos/atan2/exp/pow differently; keeping every call here means
// they can be swapped for cross-browser-exact versions (for lockstep/replays) in one file.
// + - * / and Math.sqrt are correctly rounded everywhere and may be used freely.

export const TAU = 6.283185307179586;

export interface RngState {
  rng: number;
}

/** mulberry32: one 32-bit integer of state, advanced in place. Returns [0, 1). */
export function rand(s: RngState): number {
  const a = (s.rng + 0x6d2b79f5) | 0;
  s.rng = a;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(s: RngState, a: number, b: number): number {
  return a + (b - a) * rand(s);
}

export function sin(a: number): number {
  return Math.sin(a);
}
export function cos(a: number): number {
  return Math.cos(a);
}
export function atan2(y: number, x: number): number {
  return Math.atan2(y, x);
}
export function exp(x: number): number {
  return Math.exp(x);
}

export function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 0 for NaN/Infinity: inputs arrive from outside the sim and must never poison it. */
export function finite(v: number): number {
  return Number.isFinite(v) ? v : 0;
}
