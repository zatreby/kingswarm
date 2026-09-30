import { abilitiesSystem } from './systems/abilities';
import { buildingsSystem } from './systems/buildings';
import { crittersSystem } from './systems/critters';
import { fireSystem } from './systems/fire';
import { heroesSystem } from './systems/heroes';
import { matchSystem } from './systems/match';
import { settleDeaths } from './mutated';
import type { PlayerInput, World } from './types';
import { TICK_RATE } from './types';

/**
 * Advance the world by exactly one tick (1/60 s). Deterministic: same world + same inputs gives
 * the same result. The system order is part of the rules; replays and specs depend on it.
 *
 *   0. clear events; a finished match does not advance
 *   1. clock, and previous positions for render interpolation
 *   2. heroes     timers, respawn, aim, move/dash, regen, auto-swing
 *   3. abilities  Ability/Ultimate rising edges, turrets, zones
 *   4. fire       recall edge, volleys, flight and landing
 *   5. critters   behaviour, aggro and melee, separation, collisions
 *   6. buildings  presence, capture, hatching, tower shots
 *   7. match      Crown hold, Crown opening + Frenzy, time-out / overtime
 *   8. bookkeeping  follower counts, button state for next tick's edge detection
 *
 * After each system, queued deaths are settled (Splitters' Runts, Chain Reaction blasts), so a
 * death's after-effects never land in the middle of a system's pass over the pool. Mutation
 * rules run inside the system that owns the behaviour (see mutations.ts for the map).
 */
export function step(w: World, inputs: readonly [PlayerInput, PlayerInput]): void {
  w.events.length = 0;
  if (w.phase === 'over') return;

  w.tick++;
  w.time = w.tick / TICK_RATE; // derived from the tick so it never drifts
  for (const h of w.heroes) { h.px = h.x; h.py = h.y; }
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.alive) { c.px = c.x; c.py = c.y; }
  }

  heroesSystem(w, inputs);
  settleDeaths(w);
  abilitiesSystem(w, inputs);
  settleDeaths(w);
  fireSystem(w, inputs);
  settleDeaths(w);
  crittersSystem(w);
  settleDeaths(w);
  buildingsSystem(w);
  settleDeaths(w);
  matchSystem(w);

  const f0 = countFollowers(w, 0), f1 = countFollowers(w, 1);
  w.heroes[0].followers = f0;
  w.heroes[1].followers = f1;
  for (let t = 0; t < 2; t++) {
    const p = w.heroes[t].prev, i = inputs[t];
    p.dash = !!i.dash;
    p.ability = !!i.ability;
    p.ultimate = !!i.ultimate;
    p.recall = !!i.recall;
    p.fire = !!i.fire;
  }
}

function countFollowers(w: World, team: 0 | 1): number {
  let n = 0;
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.alive && c.team === team && c.state === 'follow' && c.kind !== 'guard') n++; // Guards are not ammo
  }
  return n;
}
