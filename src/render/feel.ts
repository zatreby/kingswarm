// Game-feel bookkeeping with no three.js, so it tests in Node: trauma shake, hit-stop, the flash
// limiter and the particle budget. Values: design/research/game-feel.md (sections 1-3, 5).

/** Shake sources, each with its own ceiling so a hundred small hits can never stack to a big shake. */
export const SHAKE_SOURCES = {
  land: 0.15, heroHit: 0.3, explode: 0.4, ability: 0.45, capture: 0.5, heroDown: 0.7, big: 1,
} as const;
export type ShakeSource = keyof typeof SHAKE_SOURCES;
const SOURCE_IDS = Object.keys(SHAKE_SOURCES) as ShakeSource[];

export const SHAKE = {
  /** Trauma lost per second (linear). */
  decay: 1.5,
  /** Rotation at trauma 1, degrees (3D camera: rotation only). */
  rollDeg: 1.5, pitchDeg: 0.6, yawDeg: 0.6,
  /** Noise frequency, Hz. */
  freq: 20,
} as const;

/** Eiserloh trauma: events add trauma, it decays linearly, the shake is trauma squared on smooth noise. */
export class Trauma {
  private readonly v = new Float32Array(SOURCE_IDS.length);
  private t = 0;

  add(source: ShakeSource, amount: number): void {
    const i = SOURCE_IDS.indexOf(source), cap = SHAKE_SOURCES[source];
    this.v[i] = Math.min(cap, this.v[i] + amount);
  }

  get value(): number {
    let s = 0;
    for (let i = 0; i < this.v.length; i++) s += this.v[i];
    return s > 1 ? 1 : s;
  }

  update(dt: number): void {
    this.t += dt;
    for (let i = 0; i < this.v.length; i++) this.v[i] = Math.max(0, this.v[i] - SHAKE.decay * dt);
  }

  /** Camera rotation offsets in radians for the current trauma, scaled by the player's shake setting. */
  angles(scale: number, out: { pitch: number; yaw: number; roll: number }): typeof out {
    const k = this.value * this.value * scale, t = this.t * SHAKE.freq, d = Math.PI / 180;
    out.pitch = k * SHAKE.pitchDeg * d * smoothNoise(t, 1.3);
    out.yaw = k * SHAKE.yawDeg * d * smoothNoise(t, 7.1);
    out.roll = k * SHAKE.rollDeg * d * smoothNoise(t, 13.7);
    return out;
  }

  reset(): void { this.v.fill(0); }
}

/** Smooth, deterministic noise in -1..1: incommensurate sines, so it never looks like white-noise jitter. */
export function smoothNoise(t: number, seed: number): number {
  return (Math.sin(t * 1.0 + seed) * 0.5 + Math.sin(t * 2.17 + seed * 2.3) * 0.3 + Math.sin(t * 3.91 + seed * 4.1) * 0.2);
}

export const HITSTOP = {
  /** Hard cap: longer reads as a dropped frame. */
  maxMs: 120,
  /** Requests closer together than this are halved, so bursts never become a slideshow. */
  stackWindowMs: 100,
} as const;

/** Presentation-only hit-stop: a timer the renderer reads to hold poses. The sim never waits for it. */
export class HitStop {
  private left = 0;
  private sinceLast = 1e9;

  request(ms: number): void {
    let d = Math.min(HITSTOP.maxMs, ms);
    if (this.sinceLast < HITSTOP.stackWindowMs) d *= 0.5;
    this.sinceLast = 0;
    this.left = Math.min(HITSTOP.maxMs, Math.max(this.left, d));
  }

  /** Advance by real milliseconds; true while the hold is active. */
  update(dtMs: number): boolean {
    this.sinceLast += dtMs;
    const active = this.left > 0;
    this.left = Math.max(0, this.left - dtMs);
    return active;
  }

  get active(): boolean { return this.left > 0; }
  reset(): void { this.left = 0; this.sinceLast = 1e9; }
}

/** WCAG 2.3.1: at most 3 flashes in any one second. Callers downgrade the effect when refused. */
export class FlashLimiter {
  private readonly times = [-1e9, -1e9, -1e9];
  private i = 0;
  constructor(private readonly perSecond = 3) {}

  /** now in seconds. Returns true if a flash may play now (and records it). */
  tryFlash(now: number): boolean {
    let recent = 0;
    for (const t of this.times) if (now - t < 1) recent++;
    if (recent >= this.perSecond) return false;
    this.times[this.i] = now;
    this.i = (this.i + 1) % this.times.length;
    return true;
  }
}

/** Effect priority ladder: under load, ambient goes first, critical always gets through. */
export const Prio = { Ambient: 0, Medium: 1, Critical: 2 } as const;
export type Prio = 0 | 1 | 2;
export const BUDGET = {
  /** Hard cap on live particles. */
  cap: 400,
  /** Fraction of the cap each priority may fill before it is refused. */
  share: [0.6, 0.88, 1] as readonly number[],
} as const;

export function budgetAllows(live: number, prio: Prio, cap: number = BUDGET.cap): boolean {
  return live < cap * BUDGET.share[prio];
}

// Easing (cosmetic motion).
export function easeOutBack(t: number, s = 1.70158): number {
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}
/** Damped oscillation for squash-and-stretch: starts at 1, rings down to 0. */
export function wobble(t: number, freq = 22, damp = 9): number {
  return t < 0 ? 0 : Math.exp(-damp * t) * Math.cos(freq * t);
}
