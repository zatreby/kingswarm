// The UI contract. The UI is driven only by these plain-data view models and callbacks;
// it never reads the World. The integrator maps game state onto them.
import type { HeroId, MutationId, Team } from '../sim/types';

export type { HeroId, MutationId, Team };

export type Device = 'kbm' | 'gamepad' | 'touch';
export type UiScale = 1 | 1.25 | 1.5;
export type NavAction = 'up' | 'down' | 'left' | 'right' | 'accept' | 'back';

/** Verbs that have a device glyph (see glyphs.ts). */
export type Verb =
  | 'move' | 'aim' | 'fire' | 'recall' | 'dash' | 'ability' | 'ultimate'
  | 'pause' | 'accept' | 'back' | 'reroll';

export type MutationTag = 'boom' | 'brood' | 'bite' | 'king';

/** A caller-supplied portrait: a live canvas (mounted as is), a bitmap (copied), or an image URL (blob:/data: only; no network). */
export type PortraitSource = HTMLCanvasElement | ImageBitmap | string;

export type TraitIcon =
  | 'hoard' | 'slow' | 'fortify' | 'patient' | 'flood' | 'spread'
  | 'allIn' | 'heavy' | 'feint' | 'ambush' | 'guard' | 'storm';

export interface TraitView { icon: TraitIcon; label: string }

export interface RivalView {
  id: string;
  name: string;
  /** Short epithet under the name, e.g. "The tutorial rival" is not a title; "Keeper of the Hoard" is. */
  title: string;
  hero: HeroId;
  portrait?: PortraitSource;
  traits: [TraitView, TraitView];
  mutations: MutationId[];
  /** The one-line question this battle asks, shown on the draft preview. */
  question: string;
  /** The flaw you exploit; the codex shows it only after the first win. */
  flaw?: string;
  boss?: boolean;
}

export interface BattleIndex { index: number; total: number; boss?: boolean }

export interface Settings {
  master: number; music: number; sfx: number; // 0..1
  muted: boolean;
  shake: number; // 0..1
  reduceFlashes: boolean;
  colorMode: 'default' | 'orange' | 'highContrast';
  fireMode: 'hold' | 'toggle';
  aimAssist: boolean;
  uiScale: UiScale;
  showHints: boolean;
  assist: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, music: 0.6, sfx: 0.8, muted: false, shake: 0.7, reduceFlashes: false,
  colorMode: 'default', fireMode: 'hold', aimAssist: false, uiScale: 1, showHints: true, assist: false,
};

export interface HeroCardView {
  id: HeroId;
  /** Omit to use the catalogue (GDD section 5). */
  name?: string;
  playstyle?: string;
  /** How to unlock, e.g. "Win a run with Brawler". Present = locked. */
  locked?: string;
}

export interface UnlockView {
  kind: 'mutation' | 'hero' | 'crownLevel' | 'rival';
  label: string;
  /** Short line under the label, e.g. "Rivals gain a Mutation". */
  detail?: string;
  mutation?: MutationId;
  hero?: HeroId;
}

export interface CodexMutationView { id: MutationId; discovered: boolean; picks: number }
export interface CodexRivalView {
  rival: RivalView;
  met: boolean;
  /** Reveals the flaw hint. */
  beaten: boolean;
  best: { hero: HeroId; crownLevel: number; result: string }[];
}
export interface CodexHeroView { id: HeroId; unlocked: boolean; unlockHint?: string; runsWon: number; bestCrownLevel: number }

// ---------------------------------------------------------------- screens

export interface BootModel {
  screen: 'boot';
  /** 0..1 while loading; omit or set onPlay once ready. */
  progress?: number;
  onPlay?: () => void;
}

export interface TitleModel {
  screen: 'title';
  /** Present only when a run is saved. */
  continueRun?: { hero: HeroId; battle: BattleIndex; lives: number; maxLives: number };
  version: string;
  onContinue?: () => void;
  onNewRun: () => void;
  onCodex: () => void;
  onSettings: () => void;
  /** Versus is shown disabled with "coming soon" while this is absent. */
  onVersus?: () => void;
}

export interface HeroPickModel {
  screen: 'heroPick';
  heroes: HeroCardView[];
  selected: HeroId;
  /** Present once any Crown Level is unlocked for a hero (GDD section 7). max = highest unlocked for that hero. */
  crownLevel?: { value: number; maxByHero: Partial<Record<HeroId, number>>; cap: number; perks?: string[] };
  onPick: (hero: HeroId, crownLevel: number) => void;
  onBack: () => void;
}

export interface RivalCardModel {
  screen: 'rivalCard';
  rival: RivalView;
  battle: BattleIndex;
  lives: number;
  maxLives: number;
  /** Auto-advance after this many ms (default 3000). Any key/click skips. */
  durationMs?: number;
  onDone: () => void;
}

export interface PauseModel {
  screen: 'pause';
  battle?: BattleIndex;
  rivalName?: string;
  onResume: () => void;
  onRestart: () => void;
  onHowTo: () => void;
  onSettings: () => void;
  onAbandon: () => void;
}

export interface SettingsModel {
  screen: 'settings';
  settings: Settings;
  onChange: (s: Settings) => void;
  onResetProgress: () => void;
  onBack: () => void;
}

export interface ResultModel {
  screen: 'result';
  outcome: 'win' | 'loss';
  /** 2-3 short near-miss or brag facts, e.g. "Throne taken at 1:12". The first is shown largest. */
  facts: string[];
  rivalName: string;
  battle: BattleIndex;
  livesBefore: number;
  livesAfter: number;
  maxLives: number;
  /** One-time explanation after the first ever loss, <= 8 words. */
  lossNote?: string;
  /** Next (win) or Rematch (loss). */
  onPrimary: () => void;
  onMenu: () => void;
}

export interface DraftModel {
  screen: 'draft';
  options: MutationId[];
  rerolls: number;
  owned: MutationId[];
  next: RivalView;
  /** 1-based index of the battle the next rival is. */
  nextBattle?: BattleIndex;
  onPick: (id: MutationId) => void;
  onReroll: () => void;
  onSkip: () => void;
  /** Hook: mount a live preview (canvas) into each card's slot. Return a cleanup. */
  mountPreview?: (id: MutationId, slot: HTMLElement) => (() => void) | void;
}

export interface RunOverModel {
  screen: 'runOver';
  hero: HeroId;
  build: MutationId[];
  /** Ladder: names in order (5 rivals incl. boss last), and how many were beaten. */
  ladder: string[];
  beaten: number;
  nearMiss: string;
  unlocks: UnlockView[];
  /** One-time Assist offer after a lost run. */
  assistOffer?: { onAccept: () => void };
  onNewRun: () => void;
  onTitle: () => void;
}

export interface RunWonModel {
  screen: 'runWon';
  hero: HeroId;
  build: MutationId[];
  /** Run time in seconds. */
  time: number;
  crownLevel: number;
  unlocks: UnlockView[];
  onNewRun: () => void;
  onTitle: () => void;
}

export interface CodexModel {
  screen: 'codex';
  tab?: 'mutations' | 'rivals' | 'heroes';
  mutations: CodexMutationView[];
  rivals: CodexRivalView[];
  heroes: CodexHeroView[];
  onBack: () => void;
}

export interface HowToModel {
  screen: 'howto';
  /** Defaults to the current device. */
  device?: Device;
  onBack: () => void;
}

export interface NoneModel { screen: 'none' }

export type ScreenModel =
  | BootModel | TitleModel | HeroPickModel | RivalCardModel | PauseModel | SettingsModel
  | ResultModel | DraftModel | RunOverModel | RunWonModel | CodexModel | HowToModel | NoneModel;

export type ScreenId = ScreenModel['screen'];

// ---------------------------------------------------------------- HUD

export interface HudStatic {
  hero: HeroId;
  rival: { name: string; hero: HeroId; portrait?: PortraitSource };
  maxLives: number;
  lives: number;
  mutations: MutationId[];
  /** Seconds of hold needed to win at the Crown (for the bar label). */
  crownHold: number;
  onAbility?: () => void;
  onUltimate?: () => void;
  onDash?: () => void;
  onRecall?: () => void;
  onPause?: () => void;
}

/**
 * Applied every animation frame. Reuse one object and mutate it in place; the HUD caches
 * the last value of every field and touches the DOM only on change.
 * Screen positions are CSS pixels relative to the UI root. Use NaN to hide an anchored element.
 */
export interface HudFrame {
  /** Seconds remaining. */
  time: number;
  overtime: boolean;
  frenzy: boolean;
  /** Team on Rampage, or -1. */
  rampage: Team | -1;
  crownOpen: boolean;
  /** Crown hold progress 0..1 per team. */
  crownBlue: number;
  crownRed: number;
  buildingsBlue: number;
  buildingsRed: number;
  /** Swarm badge. */
  swarmX: number; swarmY: number;
  swarmWith: number; swarmCap: number; swarmAway: number;
  /** Anchors for barks and hints that follow a King (NaN = keep the position they were given). */
  youX: number; youY: number;
  rivalX: number; rivalY: number;
  /** Cooldown remaining and full length, seconds. */
  abilityCd: number; abilityCdMax: number;
  ultimateCd: number; ultimateCdMax: number;
  dashCd: number; dashCdMax: number;
  recallCd: number; recallCdMax: number;
  /** Rival readiness 0..1 (1 = ready) for their ability and ultimate. */
  rivalAbility: number; rivalUltimate: number;
  /** Seconds until your King respawns, 0 while alive. */
  respawn: number;
  /** Screen position of your Throne (where the King respawns); the "back in N" chip sits over it. NaN = top-centre fallback. */
  throneX: number; throneY: number;
}

export interface HintPrompt {
  /** <= 8 words. */
  text: string;
  verb: Verb;
  /** Follow your King (uses frame.youX/youY) or sit at x,y. */
  anchor: 'you' | 'point';
  x?: number; y?: number;
}

export interface Bark { text: string; x: number; y: number; team: Team }

export interface Hud {
  mount(model: HudStatic): void;
  update(frame: HudFrame): void;
  unmount(): void;
  prompt(p: HintPrompt | null): void;
  message(text: string): void;
  bark(b: Bark): void;
  /** Lives changed mid-battle (e.g. never in 1.0, but cheap to support). */
  setLives(lives: number): void;
}

export interface Ui {
  readonly root: HTMLElement;
  show(model: ScreenModel): void;
  readonly hud: Hud;
  toast(text: string, icon?: string): void;
  nav(action: NavAction): void;
  setDevice(d: Device): void;
  setScale(s: UiScale): void;
  /** Applies the presentation-relevant settings (scale, colour mode, reduce flashes). */
  applySettings(s: Settings): void;
  readonly device: Device;
  destroy(): void;
}

export function newHudFrame(): HudFrame {
  return {
    time: 0, overtime: false, frenzy: false, rampage: -1, crownOpen: false, crownBlue: 0, crownRed: 0,
    buildingsBlue: 0, buildingsRed: 0,
    swarmX: NaN, swarmY: NaN, swarmWith: 0, swarmCap: 0, swarmAway: 0,
    youX: NaN, youY: NaN, rivalX: NaN, rivalY: NaN,
    abilityCd: 0, abilityCdMax: 1, ultimateCd: 0, ultimateCdMax: 1, dashCd: 0, dashCdMax: 1, recallCd: 0, recallCdMax: 1,
    rivalAbility: 1, rivalUltimate: 1, respawn: 0, throneX: NaN, throneY: NaN,
  };
}
