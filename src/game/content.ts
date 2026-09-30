// Content as data: heroes (GDD section 5), rival Kings (section 6) and the battle-length ramp.
// Presentation reads the display strings; run.ts reads the rules fields.
import type { HeroId, MutationId } from '../sim';

export type RivalId = 'bumble' | 'pip' | 'brood' | 'gorm' | 'sable' | 'mora';
/** Bot profile ids in src/ai (a rival's profile id equals its rival id). */
export type BotProfileId = RivalId;
/** King look ids in src/render. */
export type LookId = HeroId | RivalId;
export type ArenaId = 'meadow' | 'tinkerworks' | 'warren' | 'gullet' | 'sablewood' | 'crownhall';
/** Trait icon ids, identical to the UI's TraitIcon. */
export type TraitIcon =
  | 'hoard' | 'slow' | 'fortify' | 'patient' | 'flood' | 'spread'
  | 'allIn' | 'heavy' | 'feint' | 'ambush' | 'guard' | 'storm';

export interface Trait { icon: TraitIcon; label: string }

export interface AbilityText { name: string; text: string }

/** How a hero becomes playable. */
export type HeroUnlock =
  | { kind: 'start' }
  | { kind: 'firstRun' }
  | { kind: 'bossWin' };

export interface HeroDef {
  id: HeroId;
  name: string;
  playstyle: string;
  ability: AbilityText;
  ultimate: AbilityText;
  look: LookId;
  unlock: HeroUnlock;
  /** Player-facing unlock condition, shown on a locked hero card. */
  unlockText: string;
}

export const HEROES: Record<HeroId, HeroDef> = {
  brawler: {
    id: 'brawler', name: 'Brawler',
    playstyle: 'Tough and direct: wade in and commit.',
    ability: { name: 'Stomp', text: 'Crush everything around you.' },
    ultimate: { name: 'Kingscall', text: 'Summon a wave of critters and heal.' },
    look: 'brawler', unlock: { kind: 'start' }, unlockText: 'Ready from the start',
  },
  blink: {
    id: 'blink', name: 'Blink',
    playstyle: 'Fragile and fast: strike, vanish, strike again.',
    ability: { name: 'Blink', text: 'Teleport with your followers toward your aim.' },
    ultimate: { name: 'Vortex', text: 'Drag enemies to a point and stun them.' },
    look: 'blink', unlock: { kind: 'firstRun' }, unlockText: 'Finish your first run',
  },
  warden: {
    id: 'warden', name: 'Warden',
    playstyle: 'Slow and sturdy: plant yourself and hold ground.',
    ability: { name: 'Turret', text: 'Plant a thorn turret that shoots for 12 s.' },
    ultimate: { name: 'Rampart', text: 'Raise a shield and heal.' },
    look: 'warden', unlock: { kind: 'bossWin' }, unlockText: 'Beat King Mora',
  },
};

export const HERO_IDS: readonly HeroId[] = ['brawler', 'blink', 'warden'];

/** Seconds: total battle length and the elapsed time at which the Crown opens. */
export interface BattleTiming { duration: number; crownOpensAt: number }

export type BarkSituation = 'start' | 'push' | 'hurt' | 'winning' | 'losing' | 'defeated';

export interface RivalDef {
  id: RivalId;
  name: string;
  title: string;
  hero: HeroId;
  /** Signature Mutations (GDD section 6). */
  mutations: MutationId[];
  /**
   * Extra Mutations this rival gains, in order, as Crown Levels rise (see CROWN_LEVELS in run.ts).
   * Chosen to sharpen the rival's identity, never duplicating `mutations`.
   */
  extraMutations: MutationId[];
  look: LookId;
  arena: ArenaId;
  bot: BotProfileId;
  traits: [Trait, Trait];
  /** The one-line question this battle asks. */
  question: string;
  /** The flaw you exploit; the Codex reveals it after the first win against this rival. */
  flaw: string;
  barks: Record<BarkSituation, string[]>;
  /** 0 = easiest. Ladders sort the middle rivals by this. */
  rank: number;
  /** Timing when this rival is fought outside a run (quick battle): the ramp at its rank. */
  timing: BattleTiming;
  boss?: boolean;
}

/** GDD section 6: Crown opens at 0:45 of 1:45 for the first battle, up to 1:30 of 2:30 for the Boss. */
export const TIMING_FIRST: BattleTiming = { duration: 105, crownOpensAt: 45 };
export const TIMING_BOSS: BattleTiming = { duration: 150, crownOpensAt: 90 };

/**
 * Timing for battle `index` (0-based) of a ladder of `total`. Linear from first to Boss, rounded to
 * 5 s so the timer reads cleanly; the Crown phase stays 60 s (GDD 3.4 default) and only the open
 * phase grows, so later battles have more room to build an economy before the climax.
 */
export function battleTiming(index: number, total: number): BattleTiming {
  const t = total <= 1 ? 1 : Math.min(1, Math.max(0, index / (total - 1)));
  const r5 = (v: number) => Math.round(v / 5) * 5;
  return {
    duration: r5(TIMING_FIRST.duration + (TIMING_BOSS.duration - TIMING_FIRST.duration) * t),
    crownOpensAt: r5(TIMING_FIRST.crownOpensAt + (TIMING_BOSS.crownOpensAt - TIMING_FIRST.crownOpensAt) * t),
  };
}

const rankTiming = (rank: number) => battleTiming(Math.min(rank, 4), 5);

export const RIVALS: Record<RivalId, RivalDef> = {
  bumble: {
    id: 'bumble', name: 'Bumble the Meek', title: 'Keeper of the Hoard', hero: 'brawler',
    mutations: [], extraMutations: ['bigLitter', 'militia', 'boomtown'],
    look: 'bumble', arena: 'meadow', bot: 'bumble',
    traits: [{ icon: 'hoard', label: 'Hoarder' }, { icon: 'slow', label: 'Slow push' }],
    question: 'Can you strike before his blob is full?',
    flaw: 'Predictable and slow: kite his blob, split your fire, take his huts while he hoards.',
    barks: {
      start: ['Oh! Hello.', 'Mine, all mine.'],
      push: ['Here we go...', 'All together now!'],
      hurt: ['Ow, ow, ow!'],
      winning: ['Is this good?'],
      losing: ['Not my huts!'],
      defeated: ['Oh bother.'],
    },
    rank: 0, timing: rankTiming(0),
  },
  pip: {
    id: 'pip', name: 'Pip the Tinkerer', title: 'Lord of Cogs', hero: 'warden',
    mutations: ['archerHuts'], extraMutations: ['longArm', 'shockwave', 'militia'],
    look: 'pip', arena: 'tinkerworks', bot: 'pip',
    traits: [{ icon: 'fortify', label: 'Fortifies' }, { icon: 'patient', label: 'Patient' }],
    question: 'Can you siege: out-range, flank, or bait?',
    flaw: 'Never leaves his half early: win the economy, out-range his turret, bait it out.',
    barks: {
      start: ['Calibrating.', 'Towers up.'],
      push: ['Lantern lit!', 'Now, the Crown.'],
      hurt: ['Gears grinding!'],
      winning: ['As designed.'],
      losing: ['Recalculating...'],
      defeated: ['Back to the bench.'],
    },
    rank: 1, timing: rankTiming(1),
  },
  brood: {
    id: 'brood', name: 'Mother Brood', title: 'Mother of Thousands', hero: 'brawler',
    mutations: ['splitters', 'bigLitter'], extraMutations: ['chainReaction', 'boomtown', 'scorch'],
    look: 'brood', arena: 'warren', bot: 'brood',
    traits: [{ icon: 'flood', label: 'Floods' }, { icon: 'spread', label: 'Spread thin' }],
    question: 'Can you thin a flood?',
    flaw: 'Spread thin: area damage and a held Well beat her, and her King is lightly guarded.',
    barks: {
      start: ['Go, my darlings!', 'So many mouths.'],
      push: ['Everywhere at once!'],
      hurt: ['Protect Mother!'],
      winning: ['There are always more.'],
      losing: ['My babies!'],
      defeated: ['Hush now...'],
    },
    rank: 2, timing: rankTiming(2),
  },
  gorm: {
    id: 'gorm', name: 'Gorm the Glutton', title: 'The Bottomless', hero: 'brawler',
    mutations: ['brutes'], extraMutations: ['trample', 'frostbite', 'militia'],
    look: 'gorm', arena: 'gullet', bot: 'gorm',
    traits: [{ icon: 'allIn', label: 'All-in' }, { icon: 'heavy', label: 'Heavy' }],
    question: 'Defend the wave, or raid while he marches?',
    flaw: 'After his wave his base stands empty for several seconds: counter-raid it.',
    barks: {
      start: ['Hungry.', 'Smells like dinner.'],
      push: ['SOUND THE HORN!', 'Eat the Throne!'],
      hurt: ['Grr! Rude!'],
      winning: ['More! MORE!'],
      losing: ['Still hungry...'],
      defeated: ['Too full to fight.'],
    },
    rank: 3, timing: rankTiming(3),
  },
  sable: {
    id: 'sable', name: 'Queen Sable', title: 'The Shadow Queen', hero: 'blink',
    mutations: ['homing', 'frostbite'], extraMutations: ['rapidFire', 'leeches', 'piercers'],
    look: 'sable', arena: 'sablewood', bot: 'sable',
    traits: [{ icon: 'feint', label: 'Feints' }, { icon: 'ambush', label: 'Ambush' }],
    question: 'Can you read a feint?',
    flaw: 'She splits her swarm, so each half is weak: dodge the ambush and she is exposed.',
    barks: {
      start: ['Look over there.', 'Shall we dance?'],
      push: ['Now you see me.'],
      hurt: ['A lucky cut.'],
      winning: ['Too slow, little King.'],
      losing: ['Clever... for now.'],
      defeated: ['Into the shadows.'],
    },
    rank: 4, timing: rankTiming(4),
  },
  mora: {
    id: 'mora', name: 'King Mora the Crowned', title: 'Wearer of the Crown', hero: 'warden',
    mutations: ['royalGuard', 'bombers', 'secondWind'], extraMutations: ['shockwave', 'archerHuts', 'scorch', 'longArm'],
    look: 'mora', arena: 'crownhall', bot: 'mora', boss: true,
    traits: [{ icon: 'guard', label: 'Guarded' }, { icon: 'storm', label: 'Storms Crown' }],
    question: 'Can you break the Guard before he storms the Crown?',
    flaw: 'Second Wind is one-time and his Guard can be broken: pressure him twice.',
    barks: {
      start: ['Kneel.', 'The Crown is mine.'],
      push: ['DARKNESS FALLS!', 'To the Crown!'],
      hurt: ['Guards!'],
      winning: ['As it was written.'],
      losing: ['Impossible!'],
      defeated: ['Long live... the King.'],
    },
    rank: 5, timing: TIMING_BOSS,
  },
};

export const RIVAL_IDS: readonly RivalId[] = ['bumble', 'pip', 'brood', 'gorm', 'sable', 'mora'];
/** The rivals that can fill the middle of a ladder. */
export const MIDDLE_RIVALS: readonly RivalId[] = ['pip', 'brood', 'gorm', 'sable'];

/** A Mutation that helps against a rival, with the player-facing reason (draft card hint). */
export interface Counter { id: MutationId; why: string }

/** Draft bias: at least one offer counters the next rival's gimmick when the pool allows. */
export const COUNTERS: Record<RivalId, Counter[]> = {
  bumble: [
    { id: 'bombers', why: 'Bombers crater his slow blob.' },
    { id: 'scorch', why: 'Burning ground punishes a slow blob.' },
    { id: 'longArm', why: 'Hit his huts from safety while he hoards.' },
    { id: 'rapidFire', why: 'Strip his huts before the blob is full.' },
  ],
  pip: [
    { id: 'longArm', why: 'Out-range his Towers and turret.' },
    { id: 'piercers', why: 'Punch through his defences in a line.' },
    { id: 'brutes', why: 'Brutes shrug off tower fire.' },
    { id: 'shockwave', why: 'Knock his turret guards away.' },
  ],
  brood: [
    { id: 'bombers', why: 'Blasts clear her thin streams.' },
    { id: 'scorch', why: 'Her Runts die in burning ground.' },
    { id: 'shockwave', why: 'Area knockback scatters the flood.' },
    { id: 'militia', why: 'Held huts bite back at her streams.' },
  ],
  gorm: [
    { id: 'frostbite', why: 'Chilled Brutes crawl.' },
    { id: 'militia', why: 'Your garrisons bite twice as hard when he arrives.' },
    { id: 'archerHuts', why: 'Your buildings shoot at his march.' },
    { id: 'boomtown', why: 'Rebuild fast and counter-raid.' },
  ],
  sable: [
    { id: 'royalGuard', why: 'Guards intercept her ambush.' },
    { id: 'secondWind', why: 'Survive her ambush once.' },
    { id: 'trample', why: 'Dash out through the ambush.' },
    { id: 'archerHuts', why: 'Your buildings punish her split swarm.' },
  ],
  mora: [
    { id: 'piercers', why: 'Pierce through his Royal Guard.' },
    { id: 'shockwave', why: 'Knock his storm off the Crown.' },
    { id: 'scorch', why: 'Burn the Crown as he storms it.' },
    { id: 'leeches', why: 'Outlast his second life.' },
  ],
};
