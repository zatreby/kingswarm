// Scenario helpers for specs and bot harnesses: build small worlds and drive them by script.
// Not used by the sim itself.
import { idleInputs } from './input';
import { meadow } from './maps';
import { spawnCritter } from './spawn';
import { step } from './step';
import type { Critter, CritterState, MapDef, MatchConfig, PlayerInput, Team, World } from './types';
import { createWorld } from './world';

export function testConfig(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    seed: 1,
    map: meadow,
    teams: [{ hero: 'brawler', mutations: [] }, { hero: 'brawler', mutations: [] }],
    duration: 150,
    crownOpensAt: 90,
    ...over,
  };
}

/** A map with only the two Thrones (plus the Crown the sim always adds). */
export function bareMap(over: Partial<MapDef> = {}): MapDef {
  return {
    id: 'bare', name: 'Bare',
    half: [{ kind: 'throne', x: 3.5, y: 14.5 }],
    obstacles: [],
    ...over,
  };
}

/** A world on a bare map with no critters, for isolated rule specs. */
export function bareWorld(over: Partial<MatchConfig> = {}, map: Partial<MapDef> = {}): World {
  const w = createWorld(testConfig({ map: bareMap(map), ...over }));
  clearCritters(w);
  return w;
}

export function clearCritters(w: World): void {
  for (const c of w.critters) c.alive = false;
}

export function put(w: World, team: Team, x: number, y: number, state: CritterState = 'hold'): Critter {
  const c = spawnCritter(w, team, x, y, state);
  if (!c) throw new Error('critter pool full');
  c.holdT = 1e9; // specs opt in to hold expiry explicitly
  c.tx = x; c.ty = y;
  c.biteCd = 0;
  return c;
}

export function placeHero(w: World, team: Team, x: number, y: number): void {
  const h = w.heroes[team];
  h.x = h.px = x;
  h.y = h.py = y;
  h.vx = h.vy = 0;
}

export type InputScript = (w: World, tick: number) => [PlayerInput, PlayerInput];

/** Step n ticks; returns every event emitted along the way. */
export function run(w: World, n: number, script?: InputScript | [PlayerInput, PlayerInput]) {
  const events: World['events'] = [];
  for (let i = 0; i < n; i++) {
    const inp = typeof script === 'function' ? script(w, i) : (script ?? idleInputs());
    step(w, inp);
    for (const e of w.events) events.push(e);
  }
  return events;
}

export function aliveCritters(w: World, team?: Team): Critter[] {
  return w.critters.filter((c) => c.alive && (team === undefined || c.team === team));
}
