// The Conquest run (GDD section 7) as an immutable state machine. RunState is plain serialisable
// data; every transition is a pure function that returns a new state and throws on an illegal call
// (a wiring bug, never a player action). Randomness is derived from run.seed plus counters stored
// in the state, so a saved and reloaded run continues exactly as it would have.
import { MUTATION_BY_ID, canOffer } from '../sim';
import type { HeroId, MatchConfig, MutationId, WinReason } from '../sim';
import { ARENAS } from './arenas';
import { COUNTERS, HEROES, MIDDLE_RIVALS, RIVALS, battleTiming } from './content';
import type { BotProfileId, LookId, RivalDef, RivalId } from './content';
import type { Profile } from './profile';
import { below, mix, rng, shuffled, weighted } from './rng';

export const LADDER_LENGTH = 5;
export const START_LIVES = 2;
export const DRAFT_SIZE = 3;
/** Drafted Mutations cap (GDD section 4: max 5 + the hero's own). When full, drafts are skipped. */
export const MAX_MUTATIONS = 5;
export const START_REROLLS = 1;
export const MAX_CROWN_LEVEL = 8;
/** Rival hatch multiplier for the first two battles of a player's first run (GDD section 6). */
export const FIRST_RUN_HANDICAP: readonly number[] = [0.75, 0.85];

// ---------------------------------------------------------------- Crown Levels

export type CrownLevelId =
  | 'sharper' | 'armed' | 'earlyCrown' | 'elite' | 'noReroll' | 'armedTwice' | 'eliteBoss' | 'oneCrown';

export interface CrownLevelDef {
  level: number;
  id: CrownLevelId;
  name: string;
  /** Player-facing, one line. Levels are cumulative. */
  text: string;
}

/** Cumulative: Crown Level n applies every row with level <= n. Each adds one thing you feel. */
export const CROWN_LEVELS: readonly CrownLevelDef[] = [
  { level: 1, id: 'sharper', name: 'Sharper', text: 'Rivals react faster, aim truer and warn you later.' },
  { level: 2, id: 'armed', name: 'Armed', text: 'Every rival brings one extra Mutation.' },
  { level: 3, id: 'earlyCrown', name: 'Early Crown', text: 'The Crown opens 15 s earlier in every battle.' },
  { level: 4, id: 'elite', name: 'Elite', text: 'The rival before the Boss is Elite: another Mutation, top form.' },
  { level: 5, id: 'noReroll', name: 'No Second Look', text: 'No draft reroll.' },
  { level: 6, id: 'armedTwice', name: 'Well Armed', text: 'Every rival brings two extra Mutations.' },
  { level: 7, id: 'eliteBoss', name: 'Mora Ascendant', text: 'King Mora brings two more Mutations and plays his best.' },
  { level: 8, id: 'oneCrown', name: 'One Crown', text: 'You start the run with a single Crown.' },
];

export interface CrownEffects {
  /** Bot level (src/ai scale 0..8) for an ordinary rival. */
  botLevel: number;
  /** Extra Mutations every rival brings (from RivalDef.extraMutations, in order). */
  extraMutations: number;
  /** Seconds the Crown opens earlier. */
  crownEarlier: number;
  /** The battle before the Boss is Elite (+1 Mutation, bot level 8). */
  elite: boolean;
  /** Extra Mutations for the Boss on top of extraMutations. */
  bossExtra: number;
  bossTopForm: boolean;
  rerolls: number;
  lives: number;
}

export function crownEffects(crownLevel: number): CrownEffects {
  const cl = clampLevel(crownLevel);
  const on = (id: CrownLevelId) => CROWN_LEVELS.some((d) => d.id === id && d.level <= cl);
  return {
    // CL1 is the felt jump (0 -> 2); after that rivals sharpen one step per level, capped at 8
    botLevel: cl === 0 ? 0 : Math.min(8, cl + 1),
    extraMutations: on('armedTwice') ? 2 : on('armed') ? 1 : 0,
    crownEarlier: on('earlyCrown') ? 15 : 0,
    elite: on('elite'),
    bossExtra: on('eliteBoss') ? 2 : 0,
    bossTopForm: on('eliteBoss'),
    rerolls: on('noReroll') ? 0 : START_REROLLS,
    lives: on('oneCrown') ? 1 : START_LIVES,
  };
}

function clampLevel(cl: number): number {
  return Math.max(0, Math.min(MAX_CROWN_LEVEL, Math.floor(Number.isFinite(cl) ? cl : 0)));
}

// ---------------------------------------------------------------- state

export type RunPhase = 'rivalCard' | 'battle' | 'result' | 'draft' | 'runWon' | 'runLost';

/** Legal phase changes. `runLost` is also reachable from any live phase via abandon(). */
export const PHASE_EDGES: Readonly<Record<RunPhase, readonly RunPhase[]>> = {
  rivalCard: ['battle', 'runLost'],
  battle: ['result', 'runLost'],
  result: ['draft', 'rivalCard', 'runWon', 'runLost'],
  draft: ['draft', 'rivalCard', 'runLost'],
  runWon: [],
  runLost: [],
};

/** What the integrator reports when a battle ends (facts from facts.ts summarise().lines). */
export interface BattleResult {
  won: boolean;
  reason: WinReason;
  /** Battle seconds. */
  duration: number;
  facts: string[];
}

export interface BattleRecord extends BattleResult {
  rival: RivalId;
  /** Ladder position (0-based). */
  battle: number;
  /** 0 = first try, 1 = first rematch, ... */
  attempt: number;
}

export interface DraftRecord {
  /** Ladder position of the battle this draft precedes. */
  battle: number;
  /** Everything shown across the draft (rerolls included), in order of appearance. */
  offered: MutationId[];
  picked: MutationId | null;
}

export interface RunState {
  v: 1;
  hero: HeroId;
  seed: number;
  crownLevel: number;
  /** The player's first ever run: fixed ladder opening and the early economy handicap. */
  firstRun: boolean;
  ladder: RivalId[];
  /** Ladder position of the current (or, during a draft, the upcoming) battle. */
  battle: number;
  attempt: number;
  lives: number;
  maxLives: number;
  phase: RunPhase;
  /** Drafted Mutations, in pick order. */
  mutations: MutationId[];
  /** The player's unlocked Mutation pool when the run started (unlocks land between runs). */
  pool: MutationId[];
  /** Current draft options; empty outside 'draft'. */
  offers: MutationId[];
  rerolls: number;
  /** Draft rolls so far (a seed salt, so every roll differs and reloads repeat). */
  rolls: number;
  history: BattleRecord[];
  drafts: DraftRecord[];
  /** Sum of battle seconds. */
  time: number;
}

export interface NewRunOptions {
  hero: HeroId;
  seed: number;
  crownLevel?: number;
  profile: Pick<Profile, 'runs' | 'mutations'>;
}

export function newRun(o: NewRunOptions): RunState {
  const seed = o.seed | 0;
  const firstRun = o.profile.runs.played === 0;
  const eff = crownEffects(o.crownLevel ?? 0);
  return {
    v: 1,
    hero: o.hero,
    seed,
    crownLevel: clampLevel(o.crownLevel ?? 0),
    firstRun,
    ladder: makeLadder(seed, firstRun),
    battle: 0,
    attempt: 0,
    lives: eff.lives,
    maxLives: eff.lives,
    phase: 'rivalCard',
    mutations: [],
    pool: o.profile.mutations.filter((id) => id in MUTATION_BY_ID),
    offers: [],
    rerolls: eff.rerolls,
    rolls: 0,
    history: [],
    drafts: [],
    time: 0,
  };
}

/**
 * First run: Bumble, Pip, two of {Brood, Gorm, Sable}, Mora. Later runs: Bumble, three of
 * {Pip, Brood, Gorm, Sable}, Mora. The middle is always in rising difficulty (rank).
 */
export function makeLadder(seed: number, firstRun: boolean): RivalId[] {
  const r = rng(mix(seed, 0x1add3));
  const byRank = (a: RivalId, b: RivalId) => RIVALS[a].rank - RIVALS[b].rank;
  const middle = firstRun
    ? ['pip' as RivalId, ...shuffled(r, MIDDLE_RIVALS.filter((id) => id !== 'pip')).slice(0, 2)]
    : shuffled(r, MIDDLE_RIVALS).slice(0, 3);
  return ['bumble', ...middle.sort(byRank), 'mora'];
}

export function currentRival(run: RunState): RivalDef {
  return RIVALS[run.ladder[Math.min(run.battle, run.ladder.length - 1)]];
}

export function isOver(run: RunState): boolean {
  return run.phase === 'runWon' || run.phase === 'runLost';
}

// ---------------------------------------------------------------- battle setup

export interface BattleSetup {
  config: MatchConfig;
  rival: RivalDef;
  botProfileId: BotProfileId;
  /** src/ai skill level, 0..8. */
  botLevel: number;
  /** King looks: [player, rival]. */
  looks: [LookId, LookId];
  battleIndex: number;
  battlesTotal: number;
  /** Elite battle (Crown Level 4+): show it on the rival card. */
  elite: boolean;
  /** Mutations the rival gained from the Crown Level (a subset of config.teams[1].mutations). */
  rivalExtras: MutationId[];
}

export function battleSetup(run: RunState, profile: Pick<Profile, 'settings' | 'assistBonus'>): BattleSetup {
  if (isOver(run)) throw new Error(`battleSetup: run is over (${run.phase})`);
  const rival = currentRival(run);
  const eff = crownEffects(run.crownLevel);
  const index = run.battle;
  const total = run.ladder.length;
  const elite = eff.elite && index === total - 2 && !rival.boss;
  const extraN = eff.extraMutations + (elite ? 1 : 0) + (rival.boss ? eff.bossExtra : 0);
  const rivalExtras = rival.extraMutations.filter((id) => !rival.mutations.includes(id)).slice(0, extraN);
  const botLevel = elite || (rival.boss && eff.bossTopForm) ? 8 : eff.botLevel;

  const timing = battleTiming(index, total);
  const crownOpensAt = Math.max(15, timing.crownOpensAt - eff.crownEarlier);
  const playerHatch = profile.settings.assist ? 1 + Math.max(0, Math.min(0.3, profile.assistBonus)) : 1;
  const rivalHatch = run.firstRun && index < FIRST_RUN_HANDICAP.length ? FIRST_RUN_HANDICAP[index] : 1;

  const config: MatchConfig = {
    seed: battleSeed(run),
    map: ARENAS[rival.arena],
    teams: [
      { hero: run.hero, mutations: run.mutations.slice(), hatchMul: playerHatch, name: 'You' },
      { hero: rival.hero, mutations: [...rival.mutations, ...rivalExtras], hatchMul: rivalHatch, name: rival.name },
    ],
    duration: timing.duration,
    crownOpensAt,
  };
  return {
    config, rival, botProfileId: rival.bot, botLevel,
    looks: [HEROES[run.hero].look, rival.look],
    battleIndex: index, battlesTotal: total, elite, rivalExtras,
  };
}

/** Seed of the current battle: differs per ladder position and per rematch. */
export function battleSeed(run: RunState): number {
  return mix(run.seed, 0xba771e, run.battle, run.attempt);
}

// ---------------------------------------------------------------- transitions

function need(run: RunState, phase: RunPhase, what: string): void {
  if (run.phase !== phase) throw new Error(`${what}: expected phase '${phase}', run is in '${run.phase}'`);
}

/** rivalCard -> battle. */
export function startBattle(run: RunState): RunState {
  need(run, 'rivalCard', 'startBattle');
  return { ...run, phase: 'battle' };
}

/** battle -> result. A loss costs a life. */
export function applyBattleResult(run: RunState, result: BattleResult): RunState {
  need(run, 'battle', 'applyBattleResult');
  const duration = Number.isFinite(result.duration) ? Math.max(0, result.duration) : 0;
  const record: BattleRecord = {
    won: !!result.won, reason: result.reason, duration, facts: result.facts.slice(0, 3),
    rival: run.ladder[run.battle], battle: run.battle, attempt: run.attempt,
  };
  return {
    ...run,
    phase: 'result',
    lives: result.won ? run.lives : Math.max(0, run.lives - 1),
    history: [...run.history, record],
    time: run.time + duration,
  };
}

/**
 * result -> next. Lost with lives left: rematch the same rival (rivalCard, no draft). Lost with no
 * lives: runLost. Won the Boss: runWon. Won otherwise: draft (or straight to the next rivalCard
 * when 5 Mutations are drafted or nothing is left to offer).
 */
export function advance(run: RunState): RunState {
  need(run, 'result', 'advance');
  const last = run.history[run.history.length - 1];
  if (!last.won) {
    if (run.lives <= 0) return { ...run, phase: 'runLost' };
    return { ...run, phase: 'rivalCard', attempt: run.attempt + 1 };
  }
  if (run.battle >= run.ladder.length - 1) return { ...run, phase: 'runWon' };
  const next: RunState = { ...run, battle: run.battle + 1, attempt: 0, phase: 'rivalCard' };
  if (run.mutations.length >= MAX_MUTATIONS) return next;
  const offers = rollOffers(next, []);
  if (offers.length === 0) return next;
  return {
    ...next,
    phase: 'draft',
    offers,
    rolls: run.rolls + 1,
    drafts: [...run.drafts, { battle: next.battle, offered: offers.slice(), picked: null }],
  };
}

/** draft -> rivalCard, taking one of the offers. */
export function pick(run: RunState, id: MutationId): RunState {
  need(run, 'draft', 'pick');
  if (!run.offers.includes(id)) throw new Error(`pick: ${id} is not on offer`);
  return {
    ...run,
    phase: 'rivalCard',
    mutations: [...run.mutations, id],
    offers: [],
    drafts: withLastDraft(run, (d) => ({ ...d, picked: id })),
  };
}

/** draft -> rivalCard, taking nothing. */
export function skip(run: RunState): RunState {
  need(run, 'draft', 'skip');
  return { ...run, phase: 'rivalCard', offers: [] };
}

export function canReroll(run: RunState): boolean {
  return run.phase === 'draft' && run.rerolls > 0;
}

/** draft -> draft with fresh offers (1 per run; avoids repeating the current cards when it can). */
export function reroll(run: RunState): RunState {
  need(run, 'draft', 'reroll');
  if (run.rerolls <= 0) throw new Error('reroll: none left');
  const offers = rollOffers(run, run.offers);
  return {
    ...run,
    offers,
    rerolls: run.rerolls - 1,
    rolls: run.rolls + 1,
    drafts: withLastDraft(run, (d) => ({ ...d, offered: [...d.offered, ...offers.filter((o) => !d.offered.includes(o))] })),
  };
}

/** Any live phase -> runLost (Abandon run). */
export function abandon(run: RunState): RunState {
  if (isOver(run)) throw new Error(`abandon: run is already over (${run.phase})`);
  return { ...run, phase: 'runLost', offers: [] };
}

/** The current draft options (empty outside a draft). */
export function offers(run: RunState): MutationId[] {
  return run.phase === 'draft' ? run.offers.slice() : [];
}

function withLastDraft(run: RunState, f: (d: DraftRecord) => DraftRecord): DraftRecord[] {
  const ds = run.drafts.slice();
  if (ds.length) ds[ds.length - 1] = f(ds[ds.length - 1]);
  return ds;
}

// ---------------------------------------------------------------- draft offers

export function isDuo(id: MutationId): boolean {
  return MUTATION_BY_ID[id].requires.length > 0;
}

/** Offers for the run's next draft roll: seeded by (run.seed, run.rolls); the next rival is ladder[run.battle]. */
function rollOffers(run: RunState, avoid: readonly MutationId[]): MutationId[] {
  return draftOptions({
    owned: run.mutations, pool: run.pool, next: run.ladder[run.battle] ?? null,
    seed: mix(run.seed, 0xd4af7, run.rolls), avoid,
  });
}

export interface DraftInput {
  owned: readonly MutationId[];
  pool: readonly MutationId[];
  /** The rival the player will face next (counters are biased toward it). */
  next: RivalId | null;
  seed: number;
  /** Prefer not to repeat these (the cards a reroll replaces), when enough else is left. */
  avoid?: readonly MutationId[];
}

/**
 * Up to DRAFT_SIZE distinct offers: only offerable Mutations from the pool (never owned; a Duo
 * only when both its tags are owned). Slot 1 counters the next rival when the pool has a counter;
 * slot 2 is a Duo whenever one is offerable (so recipes get found); the rest prefer tags not yet
 * shown (mixed-tag drafts). Order is shuffled so the counter is not always first.
 */
export function draftOptions(d: DraftInput): MutationId[] {
  const r = rng(d.seed);
  const all = d.pool.filter((id, i) => d.pool.indexOf(id) === i && id in MUTATION_BY_ID && canOffer(id, d.owned));
  const fresh = all.filter((id) => !(d.avoid ?? []).includes(id));
  const cands = fresh.length >= DRAFT_SIZE ? fresh : all;
  const out: MutationId[] = [];
  const from = (xs: MutationId[]) => xs.filter((id) => !out.includes(id));

  if (d.next) {
    const counters = COUNTERS[d.next].map((c) => c.id);
    let cs = from(cands.filter((id) => counters.includes(id)));
    if (!cs.length) cs = from(all.filter((id) => counters.includes(id)));
    if (cs.length) out.push(cs[below(r, cs.length)]);
  }
  const duos = from(cands.filter(isDuo));
  if (duos.length && out.length < DRAFT_SIZE) out.push(duos[below(r, duos.length)]);
  while (out.length < DRAFT_SIZE) {
    const rest = from(cands);
    if (!rest.length) break;
    const shown = new Set(out.flatMap((id) => MUTATION_BY_ID[id].tags));
    const w = rest.map((id) => (MUTATION_BY_ID[id].tags.some((t) => shown.has(t)) ? 0.35 : 1));
    out.push(rest[weighted(r, w)]);
  }
  return shuffled(r, out);
}

/** The counter reason for `id` against `rival`, if it is one (draft card hint). */
export function counterReason(rival: RivalId, id: MutationId): string | null {
  return COUNTERS[rival].find((c) => c.id === id)?.why ?? null;
}
