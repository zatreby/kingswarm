// Which sound each SimEvent makes, and how. One rule per event type; the mapped type below makes
// `tsc` fail when the sim adds an event nobody has decided a sound for (return null to stay silent).
import type { SimEvent, SimEventType, Team } from '../sim/types';
import type { SoundId } from './manifest';

/** Critter-family spam merged into one voice per window (see mixer.ts AGG_WINDOW). */
export type AggGroup = 'throw' | 'land' | 'die' | 'hatch';

/** One request to play a sound. Plain data so the mixer, tests and the lab can share it. */
export interface Cue {
  id: SoundId;
  /** Trim in dB on top of the level baked into the file. */
  db?: number;
  /** Pitch offset in semitones, before the per-play random spread. */
  st?: number;
  /** World x for the stereo pan; omitted = centre. */
  x?: number;
  /**
   * Whose moment this is (the side that acted, or whose King it happened to). The local side plays at
   * full level, the rival's a little quieter. Omitted = neutral, full level (match-wide moments, UI).
   */
  team?: Team;
  /** Merge with other cues of this group arriving within the window. */
  agg?: AggGroup;
  /** How many things this cue stands for (a volley of 3 = 3); feeds count scaling. Default 1. */
  count?: number;
  /** A big moment: duck the music and critter spam under it. */
  duck?: boolean;
}

export type CueResult = Cue | readonly Cue[] | null;
type Rule<K extends SimEventType> = (e: Extract<SimEvent, { type: K }>, local: Team) => CueResult;
/** Exhaustive by construction: a missing SimEvent type is a compile error. */
export type RuleTable = { readonly [K in SimEventType]: Rule<K> };

/** Heavy critters (Brutes, Guards) sound lower than the base critter; Runts higher. */
const KIND_ST = { critter: 0, bomber: 0, runt: 4, brute: -3, guard: -2 } as const;

export const RULES: RuleTable = {
  throw: e => ({ id: 'throw', team: e.team, x: e.x, agg: 'throw', count: e.count }),
  // A landing that hurt something is a thump; one in the grass is a soft plop.
  land: e => ({ id: e.hits > 0 || e.hitHero ? 'land_hit' : 'land_soft', team: e.team, x: e.x, agg: 'land', st: KIND_ST[e.kind] }),
  // Cryo Bombs: the freeze crack carries the moment, the blast sits under it.
  explode: e => {
    const size = e.r > 2 ? 2 : 0;
    return e.frozen
      ? [{ id: 'explode', team: e.team, x: e.x, db: size - 4 }, { id: 'freeze', team: e.team, x: e.x, db: size }]
      : { id: 'explode', team: e.team, x: e.x, db: size };
  },
  critterDied: e => ({ id: 'critter_die', team: e.team, x: e.x, agg: 'die', st: KIND_ST[e.kind] }),
  hatch: e => ({ id: 'hatch', team: e.team, agg: 'hatch', db: -2 }),
  // team = the King who was hit: your own King getting hurt is the louder one.
  heroHit: e => (e.shielded
    ? { id: 'rampart', team: e.team, x: e.x, db: -8, st: 3 }
    : { id: 'king_hit', team: e.team, x: e.x }),
  heroDown: e => ({ id: 'king_down', team: e.team, x: e.x, duck: true }),
  heroRespawn: e => ({ id: 'king_respawn', team: e.team, x: e.x }),
  rampage: e => ({ id: 'rampage', team: e.team }),
  dash: e => ({ id: 'dash', team: e.team, x: e.x }),
  ability: e => {
    switch (e.hero) {
      case 'brawler': return e.slot === 0 ? { id: 'stomp', team: e.team, x: e.x } : { id: 'kingscall', team: e.team, x: e.x };
      case 'blink': return e.slot === 0 ? { id: 'blink', team: e.team, x: e.x } : { id: 'vortex', team: e.team, x: e.tx };
      // Turret: the sim also emits turretPlaced, which carries the sound; one sound per cast.
      case 'warden': return e.slot === 0 ? null : { id: 'rampart', team: e.team, x: e.x };
    }
  },
  recall: e => ({ id: 'recall', team: e.team, x: e.x }),
  // Feedback for the player's own trigger finger only; the rival running dry is not your business.
  noAmmo: (e, local) => (e.team === local ? { id: 'no_ammo' } : null),
  capture: (e, local) => {
    const big = e.kind === 'throne' || e.kind === 'crown';
    const mine = e.team === local;
    // A rival taking a neutral hut hurts less than losing one of yours.
    const db = (big ? 3 : 0) + (!mine && e.prev === -1 ? -3 : 0);
    return { id: mine ? 'capture' : 'capture_lost', x: e.x, db, st: big ? -2 : 0, duck: true };
  },
  shot: e => ({ id: e.from === 'turret' ? 'turret_shot' : 'arrow_shot', team: e.team, x: e.x }),
  turretPlaced: e => ({ id: 'turret_place', team: e.team, x: e.x }),
  // Silent on purpose: expiry is not a decision point, and the render shows the turret crumbling.
  turretExpired: () => null,
  secondWind: e => ({ id: 'second_wind', team: e.team, x: e.x, duck: true }),
  spawn: e => ({ id: 'hatch', team: e.team, agg: 'hatch', st: e.cause === 'split' ? 4 : KIND_ST[e.kind], db: -2 }),
  // The fallen King's critters change sides: a bright "rally" blip on the gaining side.
  conscript: e => ({ id: 'recall', team: e.team, x: e.x, st: 3, db: -3 }),
  crownOpen: () => ({ id: 'crown_open', duck: true }),
  overtime: () => ({ id: 'overtime' }),
  matchEnd: (e, local) => ({ id: e.winner === local ? 'victory_sting' : 'defeat_sting', duck: true }),
};

/** Cues for one event, always as a list (empty = silent). */
export function cuesFor(e: SimEvent, local: Team): readonly Cue[] {
  const rule = RULES[e.type] as (e: SimEvent, local: Team) => CueResult;
  const r = rule(e, local);
  if (r === null) return NONE;
  return Array.isArray(r) ? (r as readonly Cue[]) : [r as Cue];
}

const NONE: readonly Cue[] = [];
