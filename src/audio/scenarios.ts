// Synthetic but realistic event streams for mix checks (lab/audio.html renderMix) and the voice-budget
// test. Rates come from src/sim/tuning.ts: a volley every 0.13 s of 3 critters, ~0.45 s flights.
// 'heavy' is the worst case: both Kings firing non-stop for the whole 10 s (the real sim is ammo-limited
// to roughly a third of that), plus every big moment the brief lists.
import type { SimEvent, Team } from '../sim/types';
import type { AudioWorldView, MusicState } from './mixer';

export type ScenarioName = 'heavy' | 'crown' | 'calm' | 'victory';
export const SCENARIOS: readonly ScenarioName[] = ['heavy', 'crown', 'calm', 'victory'];

export interface ScenarioStep {
  t: number;
  events: SimEvent[];
  world: AudioWorldView;
  /** Music state change at this step, if any. */
  music?: MusicState;
}

export interface Scenario {
  local: Team;
  duration: number;
  steps: ScenarioStep[];
}

const STEP = 1 / 60;
const VOLLEY = 0.13;
const PER_VOLLEY = 3;
const KING: [number, number][] = [[12, 9], [20, 9]];

/** mulberry32: deterministic, so every render of a scenario is the same stream. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scenario(name: ScenarioName, duration = 10): Scenario {
  const rnd = seeded(name.length * 7919 + 17);
  const n = Math.round(duration / STEP);
  const steps: ScenarioStep[] = [];
  const world: AudioWorldView = { phase: 'open', crown: [0, 0] };
  for (let i = 0; i < n; i++) steps.push({ t: i * STEP, events: [], world: { phase: 'open', crown: [0, 0] } });
  const at = (t: number, e: SimEvent) => { const i = Math.round(t / STEP); if (i >= 0 && i < n) steps[i].events.push(e); };

  const fireRate = name === 'calm' ? 0.35 : 1; // calm: one side, sparse
  const firing: Team[] = name === 'calm' ? [0] : [0, 1];
  const fireEnd = name === 'victory' ? 4 : duration; // the battle stops at the match end
  for (const team of firing) {
    const [kx, ky] = KING[team];
    const [ex, ey] = KING[1 - team];
    for (let t = rnd() * VOLLEY; t < fireEnd; t += VOLLEY / fireRate) {
      at(t, { type: 'throw', team, critter: 0, x: kx, y: ky, tx: ex, ty: ey, count: PER_VOLLEY });
      for (let k = 0; k < PER_VOLLEY; k++) {
        const lt = t + 0.35 + rnd() * 0.2;
        const lx = ex + (rnd() * 2 - 1) * 3, ly = ey + (rnd() * 2 - 1) * 2;
        const hits = rnd() < 0.55 ? 1 + Math.floor(rnd() * 2) : 0;
        const hitHero = rnd() < 0.12;
        at(lt, { type: 'land', team, critter: 0, kind: 'critter', x: lx, y: ly, hits, hitHero });
        if (hitHero) at(lt, { type: 'heroHit', team: (1 - team) as Team, by: team, dmg: 4, x: ex, y: ey, shielded: false });
        if (hits > 0 && rnd() < 0.6) at(lt + 0.02, { type: 'critterDied', team: (1 - team) as Team, kind: 'critter', x: lx, y: ly });
      }
    }
    for (let t = 0.3 + rnd(); t < fireEnd; t += 0.7) at(t, { type: 'hatch', team, building: 0, critter: 0 });
    for (let t = 0.5 + rnd(); t < fireEnd; t += 1.1) at(t, { type: 'shot', team, from: 'tower', x: kx - 4 * (team ? -1 : 1), y: ky, tx: ex, ty: ey });
  }

  if (name === 'heavy' || name === 'crown') {
    at(1.9, { type: 'turretPlaced', team: 1, x: 18, y: 8 });
    for (let t = 2.2; t < 8; t += 0.6) at(t, { type: 'shot', team: 1, from: 'turret', x: 18, y: 8, tx: 12, ty: 9 });
    at(2.5, { type: 'ability', team: 0, hero: 'brawler', slot: 0, x: 12, y: 9, tx: 12, ty: 9, hits: 4 });
    at(3.0, { type: 'capture', team: 0, prev: -1, building: 3, kind: 'hut', x: 14, y: 4 });
    at(4.0, { type: 'dash', team: 1, x: 20, y: 9, dx: -1, dy: 0 });
    at(5.0, { type: 'explode', team: 1, x: 12.5, y: 9.5, r: 2.2, frozen: false });
    at(6.0, { type: 'dash', team: 0, x: 12, y: 9, dx: 1, dy: 0 });
    at(6.2, { type: 'capture', team: 1, prev: 0, building: 3, kind: 'hut', x: 14, y: 4 });
    at(7.0, { type: 'heroDown', team: 1, by: 0, x: 20, y: 9 });
    at(7.0, { type: 'rampage', team: 0 });
    at(8.3, { type: 'explode', team: 0, x: 19, y: 9, r: 1.6, frozen: true });
    at(8.8, { type: 'ability', team: 0, hero: 'brawler', slot: 1, x: 12, y: 9, tx: 12, ty: 9, hits: 0 });
  }

  steps[0].music = 'battle';
  if (name === 'crown') {
    at(1.0, { type: 'crownOpen' });
    steps[Math.round(1.0 / STEP)].music = 'crown';
  }
  if (name === 'victory') {
    at(4.0, { type: 'matchEnd', winner: 0, reason: 'crown' });
    steps[Math.round(4.0 / STEP)].music = 'victory';
  }

  // World view per step: the Crown phase and Blue's hold growing from 2 s (drives the tension tick).
  for (const s of steps) {
    if (name === 'crown' && s.t >= 1.0) {
      world.phase = 'crown';
      if (s.t >= 2.0) world.crown[0] = Math.min(10, world.crown[0] + STEP * 1.2);
    }
    s.world = { phase: world.phase, crown: [world.crown[0], world.crown[1]] };
  }
  return { local: 0, duration, steps };
}
