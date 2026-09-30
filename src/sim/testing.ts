// Scenario helpers for specs and bot harnesses: build small worlds and drive them by script.
// Not used by the sim itself.
import { idleInput, idleInputs } from './input';
import { meadow } from './maps';
import { dist2 } from './math';
import { spawnCritter } from './spawn';
import { step } from './step';
import type {
  Critter, CritterKind, CritterState, MapDef, MatchConfig, MutationId, PlayerInput, SimEventType, Team, World,
} from './types';
import { DT } from './types';
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

/** Stop both teams hatching (cap 0), so pool slots are not reused mid-spec. */
export function noHatch(w: World): World {
  w.mods[0].capMul = 0;
  w.mods[1].capMul = 0;
  return w;
}

export function clearCritters(w: World): void {
  for (const c of w.critters) c.alive = false;
  w.born[0] = w.born[1] = 0;
}

export function put(
  w: World, team: Team, x: number, y: number, state: CritterState = 'hold', kind: CritterKind = 'critter',
): Critter {
  const c = spawnCritter(w, team, x, y, state, kind);
  if (!c) throw new Error('critter pool full');
  c.holdT = 1e9; // specs opt in to hold expiry explicitly
  c.tx = x; c.ty = y;
  c.biteCd = 0;
  return c;
}

/** A bare world (no critters, no hatching) whose teams carry these Mutations. */
export function mutWorld(blue: MutationId[], red: MutationId[] = [], map: Partial<MapDef> = {}): World {
  const w = bareWorld({ teams: [{ hero: 'brawler', mutations: blue }, { hero: 'brawler', mutations: red }] }, map);
  return noHatch(w);
}

/** A thrown critter that lands exactly at (x, y) on the next tick (no scatter, no travel). */
export function drop(w: World, team: Team, x: number, y: number, kind: CritterKind = 'critter'): Critter {
  const c = put(w, team, x, y, 'fly', kind);
  c.flightT = 0;
  c.flightDur = DT;
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

/** Step until an event of `type` appears (or max ticks); returns the events of that final tick. */
export function runUntil(w: World, type: SimEventType, max: number, script?: InputScript | [PlayerInput, PlayerInput]) {
  for (let i = 0; i < max; i++) {
    const inp = typeof script === 'function' ? script(w, i) : (script ?? idleInputs());
    step(w, inp);
    if (w.events.some((e) => e.type === type)) return w.events.slice();
  }
  throw new Error(`no ${type} event within ${max} ticks`);
}

/**
 * A crude deterministic bot for harness runs: walk to a building, hose it, poke buttons on a
 * schedule. Blue goes for the Crown once it opens; Red keeps expanding, so matches do not
 * stalemate on symmetry.
 */
export function botInput(w: World, team: Team): PlayerInput {
  const h = w.heroes[team];
  const inp = idleInput();
  if (!h.alive) return inp;
  const crown = w.buildings[w.buildings.length - 1];
  let target = w.buildings[w.thrones[1 - team]];
  if (team === 0 && (w.phase === 'crown' || w.phase === 'overtime') && crown.owner !== -1) target = crown;
  else {
    let best = Infinity;
    for (const b of w.buildings) {
      if (b.owner === team) continue;
      const d = dist2(b.x, b.y, h.x, h.y);
      if (d < best) { best = d; target = b; }
    }
  }
  const dx = target.x - h.x, dy = target.y - h.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  if (d > target.r + 0.9) { inp.moveX = dx / d; inp.moveY = dy / d; }
  const foe = w.heroes[1 - team];
  const foeD = Math.sqrt(dist2(foe.x, foe.y, h.x, h.y));
  if (foe.alive && foeD < 6) { inp.aimX = foe.x; inp.aimY = foe.y; }
  else { inp.aimX = target.x; inp.aimY = target.y; }
  inp.fire = d < 9 || foeD < 6;
  inp.recall = w.tick % 480 === 0;
  inp.dash = w.tick % 150 === 10 + team * 20;
  inp.ability = w.tick % 90 === 5 + team;
  inp.ultimate = w.tick % 400 === 7 + team;
  return inp;
}

export function botInputs(w: World): [PlayerInput, PlayerInput] {
  return [botInput(w, 0), botInput(w, 1)];
}

export function aliveCritters(w: World, team?: Team): Critter[] {
  return w.critters.filter((c) => c.alive && (team === undefined || c.team === team));
}
