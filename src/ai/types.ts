// The bot contract. A bot is a player: it reads the World (never writes it) and returns the same
// PlayerInput a human produces. Everything a bot is (personality, skill, plays, voice) is plain data
// in a BotProfile, so a rival is a data row, not a code path (design/research/fun-ai.md §1-2).
import type { HeroId, MutationId, PlayerInput, World } from '../sim';

/** What a tell announces. Presentation turns each into a readable cue (meter, lantern, horn, mark). */
export type TellKind = 'push' | 'crownPush' | 'ambush' | 'hoard' | 'raid';

export type BotSignal =
  /** An announced action at (x, y) that the bot will commit to `lead` seconds from now. Tells never lie. */
  | { kind: 'tell'; tell: TellKind; x: number; y: number; lead: number }
  /** A short speech-bubble line, emitted on intent changes and plays. */
  | { kind: 'bark'; text: string };

export interface Bot {
  /** One tick of input for the given world. Call once per sim tick, before step(). Never mutates the world. */
  think(world: World): PlayerInput;
  /** Signals produced since the last drain, oldest first. */
  drainSignals(): BotSignal[];
  /** Current intent and the reason for it, e.g. "raid hut#8: weak garrison". For debug overlays, logs and barks. */
  readonly intent: string;
  /** Execution telemetry for specs and the harness. Optional so scripted bots can omit parts. */
  readonly debug: BotDebug;
}

export interface BotDebug {
  /** Where the execution layer is trying to stand (null = no movement goal). */
  goalX: number | null;
  goalY: number | null;
  /** Times the unstuck rule fired. */
  unstucks: number;
  /** Current intent kind, or the script name for golden bots. */
  intentKind: string;
}

export type IntentKind = 'expand' | 'defend' | 'raid' | 'huntKing' | 'takeCrown' | 'regroup';

/**
 * Tactics a bot is allowed to use (Halo 2 style whitelist). Difficulty unlocks more of these;
 * Expand, Defend, raiding Huts, taking the open Crown and Regroup are always available.
 */
export type TacticId =
  | 'raidThrone'    // may target the rival Throne
  | 'huntKing'      // may chase the rival King as an intent
  | 'kite'          // backs off while firing when out-numbered near the rival King
  | 'counterRaid'   // raids harder while the rival's swarm is away from home
  | 'crownContest'; // treats a rival Crown hold as an emergency

/** Signature plays (GDD §6). Each announces itself with a tell before committing. */
export type PlayId =
  | 'hoardPush'   // Bumble: hoard to a full swarm, then one slow blob push (tell: hoard)
  | 'crownPush'   // Pip, Mora: one committed Crown push at the opening (tell: crownPush)
  | 'flood'       // Brood: hose several huts at once (tell: push)
  | 'warParty'    // Gorm: all-in march on the rival Throne (tell: raid)
  | 'ambush'      // Sable: blink onto a marked spot next to the rival King (tell: ambush)
  | 'feint';      // Sable: send a decoy volley at one hut before the real move

export type GoldenScript = 'idle' | 'turtleForever' | 'throneRush' | 'crownCamp' | 'spamFire' | 'monkey';

export interface BotSkill {
  /** Perception staleness: the bot sees the rival side as it was this long ago. */
  reactionMs: number;
  /** Decision interval (utility re-scoring), jittered +-20%. */
  thinkMs: number;
  /** Aim error, degrees (1 sigma, resampled a few times per second; x1.5 while moving). */
  aimErrorDeg: number;
  /** 0..1: how much of a moving target's travel the bot leads its shots by. */
  leadAim: number;
  /** Seconds between a tell and the committed action. 0 = acts without announcing (player proxies). */
  tellLeadS: number;
  /** 0..1: chance per decision to use Recall when it would help (novices forget). */
  recallEfficiency: number;
  /** 0..1 chance per decision window to use each tool when the situation calls for it. */
  usesDash: number;
  usesAbility: number;
  usesUltimate: number;
  /** 0..1: chance to dash out of an incoming volley it perceived. */
  dodges: number;
  /** 0..1: share of the followers it will throw in one engagement; the rest is a reserve while the rival King is near. */
  maxCommit: number;
  /** Shortest time between two button presses (dash / ability / ultimate / recall). */
  buttonGapMs: number;
  /** 0..1: relative noise added to intent scores (decision quality). */
  decisionNoise: number;
}

/** Personality: multipliers on each intent and on the considerations inside the scores. */
export interface BotPersonality {
  weights: Record<IntentKind, number>;
  /** Value of the rival Throne as a raid target, relative to a Hut (1). */
  throneValue: number;
  /** Followers wanted before a raid feels safe. */
  armyNeed: number;
  /** 0..1: tolerance for fighting where the rival is strong. */
  risk: number;
  /** 0..1: preference for targets in the own half. */
  homeBias: number;
  /** Multiplier on opportunistic shots at the rival King. */
  kingFocus: number;
  /** Bonus to the current intent (decays over ~4 s). */
  inertia: number;
  /** Never targets anything in the rival half before the Crown opens (Pip, Mora phase 1). */
  holdHalfUntilCrown: boolean;
}

export type BarkKey = IntentKind | 'tell' | 'kingDown' | 'respawn';

export interface BotProfile {
  id: string;
  name: string;
  kind: 'rival' | 'proxy' | 'golden';
  hero: HeroId;
  mutations: MutationId[];
  personality: BotPersonality;
  skill: BotSkill;
  tactics: TacticId[];
  plays: PlayId[];
  /** Short in-character lines (2-4 words) per occasion. */
  barks: Partial<Record<BarkKey, string[]>>;
  /** The GDD flaw the player exploits (documentation for the rival card and specs). */
  flaw: string;
  /** Economy handicap (hatch multiplier) that only applies at Crown Level 0. Bumble and Pip only. */
  handicapHatchMul?: number;
  /** Mutations the rival gains as Crown Levels rise (first at level 3, second at level 6). */
  levelMutations?: MutationId[];
  /** Tactics unlocked at a Crown Level: [level, tactic]. */
  levelTactics?: [number, TacticId][];
  /** Golden bots: a scripted behaviour instead of the utility brain. */
  script?: GoldenScript;
}
