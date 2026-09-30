// Unlocks are options, never power (GDD section 7, research/retention.md bottom line 4). A small
// starting pool, a table of rules so each of the first ten runs opens something, then Crown Levels
// per hero. finishRun() and recordBattle() are the only writers of progress.
import { MUTATION_BY_ID } from '../sim';
import type { HeroId, MutationId } from '../sim';
import { HEROES } from './content';
import type { Profile, MutationStats, RunLog } from './profile';
import { CROWN_LEVELS, MAX_CROWN_LEVEL, isDuo, isOver } from './run';
import type { RunState } from './run';

/** Assist (GDD section 7): +5% hatch per lost run, capped, reset by a won run. */
export const ASSIST_STEP = 0.05;
export const ASSIST_MAX = 0.3;
/** Telemetry keeps this many most recent runs. */
export const TELEMETRY_RUNS = 100;

export const STARTING_HEROES: readonly HeroId[] = ['brawler'];

/**
 * Nine easy-to-read Mutations, at least two per tag, and at least one counter for every rival
 * (Bumble: Bombers, Pip: Long Arm, Brood: Bombers/Shockwave, Gorm: Frostbite/Militia,
 * Sable: Trample, Mora: Shockwave).
 */
export const STARTING_POOL: readonly MutationId[] = [
  'bombers', 'shockwave',        // boom
  'bigLitter', 'militia',        // brood
  'frostbite', 'homing',         // bite
  'longArm', 'rapidFire', 'trample', // king
];

export type UnlockWhen =
  /** After this many completed runs (a run counts once it fought at least one battle). */
  | { runs: number }
  /** After the first run won (King Mora beaten). */
  | { runsWon: number };

export interface UnlockRule {
  when: UnlockWhen;
  heroes?: HeroId[];
  mutations?: MutationId[];
}

/**
 * Runs 1-10 each open something whether they were won or lost; a Duo enters the pool together with
 * or after the Mutations that make its recipe meaningful (Chain Reaction after Splitters, Cryo
 * Bombs after Bombers). Blink after the first completed run, Warden after the first Boss win.
 */
export const UNLOCK_RULES: readonly UnlockRule[] = [
  { when: { runs: 1 }, heroes: ['blink'] },
  { when: { runs: 2 }, mutations: ['scorch'] },
  { when: { runs: 3 }, mutations: ['splitters'] },
  { when: { runs: 4 }, mutations: ['leeches', 'cryoBombs'] },
  { when: { runs: 5 }, mutations: ['archerHuts'] },
  { when: { runs: 6 }, mutations: ['boomtown', 'chainReaction'] },
  { when: { runs: 7 }, mutations: ['royalGuard'] },
  { when: { runs: 8 }, mutations: ['piercers', 'bloodrage'] },
  { when: { runs: 9 }, mutations: ['secondWind', 'conscription'] },
  { when: { runs: 10 }, mutations: ['brutes'] },
  { when: { runsWon: 1 }, heroes: ['warden'] },
];

/** Field-compatible with the UI's UnlockView. */
export interface UnlockEvent {
  kind: 'mutation' | 'hero' | 'crownLevel';
  label: string;
  detail: string;
  mutation?: MutationId;
  hero?: HeroId;
  level?: number;
}

function ruleMet(w: UnlockWhen, p: Profile): boolean {
  return 'runs' in w ? p.runs.played >= w.runs : p.runs.won >= w.runsWon;
}

/** Grant everything whose rule now holds and is not yet owned. Never unlocks anything twice. */
export function applyUnlockRules(p: Profile): { profile: Profile; unlocked: UnlockEvent[] } {
  const heroes = p.heroes.slice();
  const pool = p.mutations.slice();
  const unlocked: UnlockEvent[] = [];
  for (const r of UNLOCK_RULES) {
    if (!ruleMet(r.when, p)) continue;
    for (const h of r.heroes ?? []) {
      if (heroes.includes(h)) continue;
      heroes.push(h);
      unlocked.push({ kind: 'hero', hero: h, label: HEROES[h].name, detail: HEROES[h].playstyle });
    }
    for (const id of r.mutations ?? []) {
      if (pool.includes(id)) continue;
      pool.push(id);
      const m = MUTATION_BY_ID[id];
      unlocked.push({
        kind: 'mutation', mutation: id,
        label: isDuo(id) ? `Duo recipe: ${m.name}` : m.name,
        detail: isDuo(id) ? `Own a ${m.requires.join(' and a ')} Mutation to find it.` : m.text,
      });
    }
  }
  return { profile: { ...p, heroes, mutations: pool }, unlocked };
}

const blankStats = (): MutationStats => ({ offered: 0, picked: 0, battles: 0, battleWins: 0, runs: 0, runWins: 0 });

/**
 * After applyBattleResult: the rival is met (and beaten, with the best Crown Level per hero), and
 * local telemetry counts the battle for every Mutation the player owned. Call once per result.
 */
export function recordBattle(p: Profile, run: RunState): Profile {
  const rec = run.history[run.history.length - 1];
  if (!rec || run.phase !== 'result') throw new Error('recordBattle: call right after applyBattleResult');
  const prev = p.codex.rivals[rec.rival] ?? { met: false, beaten: false, best: {} };
  const best = { ...prev.best };
  if (rec.won) best[run.hero] = Math.max(best[run.hero] ?? 0, run.crownLevel);
  const muts = { ...p.telemetry.mutations };
  for (const id of run.mutations) {
    const s = { ...(muts[id] ?? blankStats()) };
    s.battles++;
    if (rec.won) s.battleWins++;
    muts[id] = s;
  }
  const br = p.telemetry.battles.byRival[rec.rival] ?? { played: 0, won: 0 };
  return {
    ...p,
    codex: {
      ...p.codex,
      rivals: { ...p.codex.rivals, [rec.rival]: { met: true, beaten: prev.beaten || rec.won, best } },
    },
    telemetry: {
      ...p.telemetry,
      mutations: muts,
      battles: {
        played: p.telemetry.battles.played + 1,
        won: p.telemetry.battles.won + (rec.won ? 1 : 0),
        byRival: { ...p.telemetry.battles.byRival, [rec.rival]: { played: br.played + 1, won: br.won + (rec.won ? 1 : 0) } },
      },
    },
  };
}

/**
 * A finished run (runWon or runLost) updates the counters, Assist, Codex, telemetry and unlocks,
 * and clears the saved run. A run abandoned before its first battle changes nothing else.
 */
export function finishRun(p: Profile, run: RunState): { profile: Profile; unlocked: UnlockEvent[] } {
  if (!isOver(run)) throw new Error(`finishRun: run is still live (${run.phase})`);
  if (run.history.length === 0) return { profile: { ...p, savedRun: null }, unlocked: [] };
  const won = run.phase === 'runWon';

  // codex + telemetry from the drafts
  const codexM = { ...p.codex.mutations };
  const recipes = p.codex.recipes.slice();
  const muts = { ...p.telemetry.mutations };
  const stat = (id: MutationId) => (muts[id] = { ...(muts[id] ?? blankStats()) });
  for (const d of run.drafts) {
    for (const id of d.offered) {
      codexM[id] = { discovered: true, picks: codexM[id]?.picks ?? 0 };
      if (isDuo(id) && !recipes.includes(id)) recipes.push(id);
      stat(id).offered++;
    }
    if (d.picked) {
      codexM[d.picked] = { discovered: true, picks: (codexM[d.picked]?.picks ?? 0) + 1 };
      stat(d.picked).picked++;
    }
  }
  for (const id of run.mutations) {
    const s = stat(id);
    s.runs++;
    if (won) s.runWins++;
  }
  const log: RunLog = {
    hero: run.hero, crownLevel: run.crownLevel, won, battles: run.history.length, seconds: run.time,
    reached: won ? run.ladder.length : run.history.filter((h) => h.won).length, mutations: run.mutations.slice(),
  };

  let next: Profile = {
    ...p,
    runs: {
      played: p.runs.played + 1,
      won: p.runs.won + (won ? 1 : 0),
      wonByHero: { ...p.runs.wonByHero, [run.hero]: p.runs.wonByHero[run.hero] + (won ? 1 : 0) },
    },
    assistBonus: won ? 0 : Math.min(ASSIST_MAX, round2(p.assistBonus + ASSIST_STEP)),
    codex: { ...p.codex, mutations: codexM, recipes },
    telemetry: { ...p.telemetry, mutations: muts, runs: [...p.telemetry.runs, log].slice(-TELEMETRY_RUNS) },
    savedRun: null,
  };

  const res = applyUnlockRules(next);
  next = res.profile;
  const unlocked = res.unlocked;

  // Crown Levels: winning at level n with a hero opens level n + 1 for that hero
  const have = next.crownLevel[run.hero];
  if (won && run.crownLevel >= have && run.crownLevel < MAX_CROWN_LEVEL) {
    const level = run.crownLevel + 1;
    next = { ...next, crownLevel: { ...next.crownLevel, [run.hero]: level } };
    unlocked.push({
      kind: 'crownLevel', hero: run.hero, level,
      label: `Crown Level ${level}: ${CROWN_LEVELS[level - 1].name}`,
      detail: CROWN_LEVELS[level - 1].text,
    });
  }
  return { profile: next, unlocked };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
