// The contract between the simulation and everything else (AI, render, audio, UI, net, tests).
// World is plain serialisable data: no classes, no closures, no DOM. Behaviour lives in systems.
// Units: world units and seconds. x grows right, y grows toward the camera. Arena is ARENA_W x ARENA_H.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const ARENA_W = 32;
export const ARENA_H = 18;
export const MAX_CRITTERS = 256;

/** 0 = Blue (home bottom-left), 1 = Red (home top-right). */
export type Team = 0 | 1;
/** Building owner: a team, or -1 for neutral. */
export type Owner = Team | -1;

export type HeroId = 'brawler' | 'blink' | 'warden';

export type MutationId =
  | 'bombers' | 'shockwave' | 'scorch'
  | 'splitters' | 'boomtown' | 'militia' | 'bigLitter' | 'brutes'
  | 'leeches' | 'frostbite' | 'piercers' | 'homing'
  | 'archerHuts' | 'trample' | 'royalGuard' | 'rapidFire' | 'longArm' | 'secondWind'
  | 'chainReaction' | 'cryoBombs' | 'conscription' | 'bloodrage';

export type BuildingKind = 'throne' | 'hut' | 'tower' | 'crown';
export type CritterKind = 'critter' | 'bomber' | 'runt' | 'brute' | 'guard';

/**
 * follow: crowding around its King (ammo).  fly: thrown, in the air.
 * hold: landed in the open, fights nearby for a moment then returns to follow.
 * garrison: stationed at a building (guards / captures) until recalled.
 * home: hatched or recalled, running back to its King; becomes follow on arrival.
 */
export type CritterState = 'follow' | 'fly' | 'hold' | 'garrison' | 'home';

/** One tick of one player's controls. Humans, bots and remote players all produce this and nothing else. */
export interface PlayerInput {
  /** Desired move direction, each axis -1..1. The sim clamps the length to 1. */
  moveX: number;
  moveY: number;
  /** Aim point in world units. */
  aimX: number;
  aimY: number;
  /** Held: stream followers at the aim point. */
  fire: boolean;
  /** The sim acts on the rising edge of these four. */
  dash: boolean;
  ability: boolean;
  ultimate: boolean;
  recall: boolean;
}

export interface Hero {
  team: Team;
  kind: HeroId;
  x: number; y: number;
  /** Position at the previous tick, for render interpolation. */
  px: number; py: number;
  vx: number; vy: number;
  /** Unit vector from the King toward his aim point. */
  aimX: number; aimY: number;
  hp: number; maxHp: number;
  alive: boolean;
  /** Seconds until respawn while dead. */
  respawnT: number;
  /** Remaining dash burst time (> 0 while dashing) and cooldown. */
  dashT: number; dashCd: number;
  /** Invulnerable while > 0 (dash i-frames, respawn grace). */
  invulnT: number;
  /** Cooldowns remaining, seconds: [ability, ultimate]. cdMax is the full length for HUD fill. */
  cd: [number, number];
  cdMax: [number, number];
  stunT: number;
  slowT: number;
  shield: number; shieldT: number;
  rampageT: number;
  /** Seconds since last damage (drives regen). */
  sinceHurt: number;
  /** Followers currently with the King (ammo), recomputed each tick. */
  followers: number;
  /** Seconds until the next volley may leave. */
  fireCd: number;
  /** Seconds until the next auto-swing check. */
  swingCd: number;
  /** Seconds until another 'noAmmo' event may be emitted (throttle). */
  noAmmoT: number;
  /** Once-per-battle effects already spent (e.g. Second Wind). */
  spent: MutationId[];
  /** Buttons held last tick, for edge detection. */
  prev: { dash: boolean; ability: boolean; ultimate: boolean; recall: boolean; fire: boolean };
  kills: number;
}

export interface Critter {
  /** Stable slot index into world.critters. */
  id: number;
  alive: boolean;
  team: Team;
  kind: CritterKind;
  state: CritterState;
  x: number; y: number;
  px: number; py: number;
  vx: number; vy: number;
  hp: number;
  /** Flight: start, target, elapsed and total time. Height is presentation, derived from flightT / flightDur. */
  sx: number; sy: number; tx: number; ty: number;
  flightT: number; flightDur: number;
  /** Piercers fly flat in a line instead of an arc. */
  flat: boolean;
  /** Building this critter garrisons, or -1. */
  building: number;
  /** Seconds left in hold before returning. */
  holdT: number;
  stunT: number;
  slowT: number;
  /** Seconds until it may bite again. */
  biteCd: number;
  /** Personal offset inside the follow crowd or garrison ring. */
  ox: number; oy: number;
  /** Stable 0..1 value for cosmetic variation (hop phase, size jitter). Never affects simulation. */
  tint: number;
}

export interface Building {
  id: number;
  kind: BuildingKind;
  x: number; y: number;
  /** Footprint radius: capture zone is r plus a margin defined in tuning. */
  r: number;
  owner: Owner;
  /** 0..100. For a neutral building this is the claimant's progress toward capture. */
  control: number;
  claimant: Owner;
  /** Seconds until the next hatch. */
  hatchT: number;
  /** Units standing on it per team this tick (critters count 1, a King counts more). */
  presence: [number, number];
  /** Garrisoned critters per team. */
  garrison: [number, number];
  /** Seconds until a Tower (or an Archer Hut) may shoot again. */
  shotCd: number;
}

/** A Warden turret. */
export interface Turret {
  team: Team;
  x: number; y: number;
  life: number;
  shotCd: number;
  /** Last target direction, radians, for presentation. */
  aim: number;
}

/** A lingering area effect. */
export interface Zone {
  kind: 'scorch' | 'vortex';
  team: Team;
  x: number; y: number; r: number;
  life: number; maxLife: number;
}

/** Static round obstacle (rocks, tree clumps, ponds). Kings and walking critters slide around it; thrown critters fly over. */
export interface Obstacle {
  x: number; y: number; r: number;
  look: 'rock' | 'trees' | 'pond';
}

export interface MapDef {
  id: string;
  name: string;
  /** Buildings for the Blue half only; the sim mirrors them through the arena centre for Red. */
  half: { kind: Exclude<BuildingKind, 'crown'>; x: number; y: number }[];
  /** Obstacles for the Blue half, mirrored likewise. Centre-line obstacles may be listed in `centre`. */
  obstacles: Obstacle[];
  centre?: Obstacle[];
}

export interface TeamSetup {
  hero: HeroId;
  mutations: MutationId[];
  /** Hatch-rate multiplier: difficulty and assist knob (1 = normal). */
  hatchMul?: number;
  /** Display name for HUD and barks. */
  name?: string;
}

export interface MatchConfig {
  seed: number;
  map: MapDef;
  teams: [TeamSetup, TeamSetup];
  /** Total battle length in seconds. */
  duration: number;
  /** Elapsed seconds at which the Crown opens and Frenzy starts. */
  crownOpensAt: number;
}

export type Phase = 'open' | 'crown' | 'overtime' | 'over';
export type WinReason = 'throne' | 'crown' | 'time' | 'overtime' | 'forfeit';

/**
 * Per-team rule modifiers, derived once in createWorld from TeamSetup (hatchMul, mutations).
 * Systems read these instead of checking mutation ids, so a Mutation is a change to one derivation.
 * With no mutations every field is its neutral value (1 for multipliers, 0 for additions).
 */
export interface TeamMods {
  /** Hatch speed multiplier (TeamSetup.hatchMul x effects). */
  hatchMul: number;
  /** Multiplies the time between volleys (lower = faster). */
  fireIntervalMul: number;
  scatterMul: number;
  throwRangeMul: number;
  flightSpeedMul: number;
  capAdd: number;
  capMul: number;
  startSwarmAdd: number;
  critterHpMul: number;
  critterSpeedMul: number;
  biteMul: number;
  garrisonBiteMul: number;
  landDamageMul: number;
  landKnockMul: number;
  landRadiusMul: number;
  /** Stun applied by a landing to enemy critters, seconds (0 = none). */
  landStun: number;
  /** Rate at which the dash cooldown recovers (1 = normal). */
  dashCdRate: number;
  rampageTimeMul: number;
}

export interface TeamStats {
  thrown: number;
  crittersKilled: number;
  crittersLost: number;
  captures: number;
  heroKills: number;
  damageToHero: number;
}

export interface World {
  tick: number;
  /** Elapsed seconds. */
  time: number;
  config: MatchConfig;
  /** Seeded PRNG state. All simulation randomness comes from here. */
  rng: number;
  phase: Phase;
  /** Seconds each team has held the Crown (with decay). Win at tuning.crownHold. */
  crown: [number, number];
  frenzy: boolean;
  winner: Owner;
  winReason: WinReason | null;
  heroes: [Hero, Hero];
  /** Fixed-capacity pool of MAX_CRITTERS; check `alive`. */
  critters: Critter[];
  buildings: Building[];
  turrets: Turret[];
  zones: Zone[];
  obstacles: Obstacle[];
  stats: [TeamStats, TeamStats];
  /** Rule modifiers per team, fixed for the match (see TeamMods). */
  mods: [TeamMods, TeamMods];
  /** Building index of each team's Throne. */
  thrones: [number, number];
  /** Events produced by the most recent step. Cleared at the start of every step. */
  events: SimEvent[];
}

/** Everything presentation needs to react to. The sim never calls render, audio or UI: it only emits these. */
export type SimEvent =
  | { type: 'throw'; team: Team; critter: number; x: number; y: number; tx: number; ty: number; count: number }
  | { type: 'land'; team: Team; critter: number; kind: CritterKind; x: number; y: number; hits: number; hitHero: boolean }
  | { type: 'explode'; team: Team; x: number; y: number; r: number; frozen: boolean }
  | { type: 'critterDied'; team: Team; kind: CritterKind; x: number; y: number }
  | { type: 'hatch'; team: Team; building: number; critter: number }
  | { type: 'heroHit'; team: Team; by: Team; dmg: number; x: number; y: number; shielded: boolean }
  | { type: 'heroDown'; team: Team; by: Team; x: number; y: number }
  | { type: 'heroRespawn'; team: Team; x: number; y: number }
  | { type: 'rampage'; team: Team }
  | { type: 'dash'; team: Team; x: number; y: number; dx: number; dy: number }
  | { type: 'ability'; team: Team; hero: HeroId; slot: 0 | 1; x: number; y: number; tx: number; ty: number; hits: number }
  | { type: 'recall'; team: Team; count: number; x: number; y: number }
  | { type: 'noAmmo'; team: Team }
  | { type: 'capture'; team: Team; prev: Owner; building: number; kind: BuildingKind; x: number; y: number }
  | { type: 'shot'; team: Team; from: 'tower' | 'turret' | 'hut'; x: number; y: number; tx: number; ty: number }
  | { type: 'turretPlaced'; team: Team; x: number; y: number }
  | { type: 'turretExpired'; team: Team; x: number; y: number }
  | { type: 'secondWind'; team: Team; x: number; y: number }
  | { type: 'crownOpen' }
  | { type: 'overtime' }
  | { type: 'matchEnd'; winner: Team; reason: WinReason };

export type SimEventType = SimEvent['type'];
