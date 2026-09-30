// The player's profile: settings, unlocks, codex, Crown Levels, assist, FTUE flags, the saved run
// and local telemetry. Plain versioned data. Persistence goes through an injected storage adapter
// and never throws: corrupt JSON, missing or wrong-typed keys, old versions and storage that
// throws (private windows, blocked site data) all come back as a valid Profile.
import { MUTATION_BY_ID } from '../sim';
import type { HeroId, MutationId } from '../sim';
import { HERO_IDS, RIVALS } from './content';
import type { RivalId } from './content';
import { MAX_CROWN_LEVEL, PHASE_EDGES } from './run';
import type { RunState } from './run';
import { ASSIST_MAX, STARTING_HEROES, STARTING_POOL, TELEMETRY_RUNS } from './unlocks';

export const PROFILE_VERSION = 1;
export const STORAGE_KEY = 'kingswarm.profile';

/** Field-compatible with the UI's Settings (src/ui/types.ts). */
export interface Settings {
  master: number; music: number; sfx: number; // 0..1
  muted: boolean;
  shake: number; // 0..1
  reduceFlashes: boolean;
  colorMode: 'default' | 'orange' | 'highContrast';
  fireMode: 'hold' | 'toggle';
  aimAssist: boolean;
  uiScale: 1 | 1.25 | 1.5;
  showHints: boolean;
  assist: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  master: 0.8, music: 0.6, sfx: 0.8, muted: false, shake: 0.7, reduceFlashes: false,
  colorMode: 'default', fireMode: 'hold', aimAssist: false, uiScale: 1, showHints: true, assist: false,
};

/** One-time prompts (design/research/onboarding-ux.md section 1). Each shows once per profile. */
export type HintId =
  | 'move' | 'fire' | 'ammo' | 'recall' | 'crown' | 'dash' | 'ability' | 'ultimate'
  | 'lossNote' | 'assistOffer';
export const HINT_IDS: readonly HintId[] = ['move', 'fire', 'ammo', 'recall', 'crown', 'dash', 'ability', 'ultimate', 'lossNote', 'assistOffer'];

export interface CodexMutation { discovered: boolean; picks: number }
export interface CodexRival {
  met: boolean;
  beaten: boolean;
  /** Highest Crown Level this rival was beaten at, per hero. */
  best: Partial<Record<HeroId, number>>;
}

export interface MutationStats {
  offered: number; picked: number;
  /** Battles fought owning it, and how many of those were won. */
  battles: number; battleWins: number;
  /** Runs that ended owning it, and how many of those were won. */
  runs: number; runWins: number;
}

export interface RunLog {
  hero: HeroId;
  crownLevel: number;
  won: boolean;
  /** Battles fought (rematches included) and battle seconds. */
  battles: number;
  seconds: number;
  /** Ladder positions beaten (5 = run won). */
  reached: number;
  mutations: MutationId[];
}

export interface Telemetry {
  mutations: Partial<Record<MutationId, MutationStats>>;
  battles: { played: number; won: number; byRival: Partial<Record<RivalId, { played: number; won: number }>> };
  runs: RunLog[];
}

export interface Profile {
  v: 1;
  settings: Settings;
  /** Unlocked heroes. */
  heroes: HeroId[];
  /** Unlocked Mutation pool (drafts draw from it). */
  mutations: MutationId[];
  codex: {
    mutations: Partial<Record<MutationId, CodexMutation>>;
    /** Duo recipes found (offered at least once). */
    recipes: MutationId[];
    rivals: Partial<Record<RivalId, CodexRival>>;
  };
  /** Highest Crown Level unlocked per hero (0 = only the base ladder). */
  crownLevel: Record<HeroId, number>;
  runs: { played: number; won: number; wonByHero: Record<HeroId, number> };
  /** Accrued Assist hatch bonus, 0..ASSIST_MAX. Applied only while settings.assist is on. */
  assistBonus: number;
  ftue: { hints: HintId[] };
  /** A run in progress, for Continue. */
  savedRun: RunState | null;
  telemetry: Telemetry;
}

const heroRecord = (v: number): Record<HeroId, number> => ({ brawler: v, blink: v, warden: v });

export function defaultProfile(): Profile {
  return {
    v: PROFILE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    heroes: STARTING_HEROES.slice(),
    mutations: STARTING_POOL.slice(),
    codex: { mutations: {}, recipes: [], rivals: {} },
    crownLevel: heroRecord(0),
    runs: { played: 0, won: 0, wonByHero: heroRecord(0) },
    assistBonus: 0,
    ftue: { hints: [] },
    savedRun: null,
    telemetry: { mutations: {}, battles: { played: 0, won: 0, byRival: {} }, runs: [] },
  };
}

// ---------------------------------------------------------------- storage

/** The subset of Web Storage the profile needs. `localStorage` satisfies it. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}

/**
 * Wraps a storage that may be missing or throw (Poki/incognito): every write also lands in memory,
 * and reads fall back to memory when the real storage fails, so settings survive the session.
 * `persistent` turns false once the real storage has failed.
 */
export function safeStorage(primary?: StorageLike | null): StorageLike & { readonly persistent: boolean } {
  const mem = memoryStorage();
  let ok = !!primary;
  return {
    get persistent() { return ok; },
    getItem(k) {
      const local = mem.getItem(k);
      if (ok && primary) {
        try { return primary.getItem(k) ?? local; } catch { ok = false; }
      }
      return local;
    },
    setItem(k, v) {
      mem.setItem(k, v);
      if (ok && primary) {
        try { primary.setItem(k, v); } catch { ok = false; }
      }
    },
  };
}

/** Never throws; anything unreadable yields defaultProfile(). */
export function load(storage: StorageLike | null | undefined): Profile {
  let text: string | null = null;
  try { text = storage ? storage.getItem(STORAGE_KEY) : null; } catch { return defaultProfile(); }
  if (!text) return defaultProfile();
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return defaultProfile(); }
  return sanitize(migrate(raw));
}

/** Returns false if the storage refused the write (the profile still lives on in memory). */
export function save(storage: StorageLike | null | undefined, profile: Profile): boolean {
  if (!storage) return false;
  try { storage.setItem(STORAGE_KEY, JSON.stringify(profile)); return true; } catch { return false; }
}

// ---------------------------------------------------------------- migration and sanitising

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Step raw data up to PROFILE_VERSION. v0 (pre-release, no `v` field) used the names reduceFlash,
 * colorBlind (boolean) and hints in settings.
 */
export const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  0: (raw) => {
    const s = isObj(raw.settings) ? { ...raw.settings } : {};
    if ('reduceFlash' in s) { s.reduceFlashes = s.reduceFlash; delete s.reduceFlash; }
    if ('colorBlind' in s) { s.colorMode = s.colorBlind === true ? 'orange' : 'default'; delete s.colorBlind; }
    if ('hints' in s) { s.showHints = s.hints; delete s.hints; }
    return { ...raw, settings: s, v: 1 };
  },
};

export function migrate(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  let r = raw;
  let v = typeof r.v === 'number' ? r.v : 0;
  while (v < PROFILE_VERSION && MIGRATIONS[v]) {
    r = MIGRATIONS[v](r);
    v = typeof r.v === 'number' && r.v > v ? r.v : v + 1;
  }
  return r;
}

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
const int = (v: unknown, d: number, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Math.floor(num(v, d, lo, hi));
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const oneOf = <T,>(v: unknown, xs: readonly T[], d: T): T => (xs.includes(v as T) ? (v as T) : d);
const ids = <T extends string>(v: unknown, valid: (x: string) => boolean): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => typeof x === 'string' && valid(x)))] : [];
const isMutation = (x: string) => Object.prototype.hasOwnProperty.call(MUTATION_BY_ID, x);
const isHero = (x: string) => (HERO_IDS as readonly string[]).includes(x);
const isRival = (x: string) => Object.prototype.hasOwnProperty.call(RIVALS, x);

function sanitizeSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {};
  const D = DEFAULT_SETTINGS;
  return {
    master: num(s.master, D.master, 0, 1), music: num(s.music, D.music, 0, 1), sfx: num(s.sfx, D.sfx, 0, 1),
    muted: bool(s.muted, D.muted),
    shake: num(s.shake, D.shake, 0, 1),
    reduceFlashes: bool(s.reduceFlashes, D.reduceFlashes),
    colorMode: oneOf(s.colorMode, ['default', 'orange', 'highContrast'] as const, D.colorMode),
    fireMode: oneOf(s.fireMode, ['hold', 'toggle'] as const, D.fireMode),
    aimAssist: bool(s.aimAssist, D.aimAssist),
    uiScale: oneOf(s.uiScale, [1, 1.25, 1.5] as const, D.uiScale),
    showHints: bool(s.showHints, D.showHints),
    assist: bool(s.assist, D.assist),
  };
}

function heroNums(v: unknown, d: number, hi: number): Record<HeroId, number> {
  const o = isObj(v) ? v : {};
  return { brawler: int(o.brawler, d, 0, hi), blink: int(o.blink, d, 0, hi), warden: int(o.warden, d, 0, hi) };
}

function record<K extends string, V>(v: unknown, validKey: (k: string) => boolean, f: (x: unknown) => V | null): Partial<Record<K, V>> {
  const out: Partial<Record<K, V>> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    if (!validKey(k)) continue;
    const y = f(x);
    if (y !== null) out[k as K] = y;
  }
  return out;
}

function mutationStats(x: unknown): MutationStats | null {
  if (!isObj(x)) return null;
  return {
    offered: int(x.offered, 0), picked: int(x.picked, 0),
    battles: int(x.battles, 0), battleWins: int(x.battleWins, 0),
    runs: int(x.runs, 0), runWins: int(x.runWins, 0),
  };
}

function runLog(x: unknown): RunLog | null {
  if (!isObj(x) || !isHero(String(x.hero))) return null;
  return {
    hero: x.hero as HeroId,
    crownLevel: int(x.crownLevel, 0, 0, MAX_CROWN_LEVEL),
    won: bool(x.won, false),
    battles: int(x.battles, 0),
    seconds: num(x.seconds, 0, 0),
    reached: int(x.reached, 0, 0, 5),
    mutations: ids<MutationId>(x.mutations, isMutation),
  };
}

/** A saved run is kept only if it is structurally sound; otherwise Continue quietly disappears. */
export function sanitizeRun(v: unknown): RunState | null {
  if (!isObj(v) || v.v !== 1) return null;
  const r = v as unknown as RunState;
  const okIds = (xs: unknown, valid: (x: string) => boolean) => Array.isArray(xs) && xs.every((x) => typeof x === 'string' && valid(x));
  const n = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  if (!isHero(String(r.hero)) || !n(r.seed) || !n(r.crownLevel) || typeof r.firstRun !== 'boolean') return null;
  if (!okIds(r.ladder, isRival) || r.ladder.length === 0) return null;
  if (!n(r.battle) || r.battle < 0 || r.battle >= r.ladder.length || !n(r.attempt)) return null;
  if (!n(r.lives) || !n(r.maxLives) || r.lives < 0 || !n(r.rerolls) || !n(r.rolls) || !n(r.time)) return null;
  if (!Object.prototype.hasOwnProperty.call(PHASE_EDGES, String(r.phase))) return null;
  if (!okIds(r.mutations, isMutation) || !okIds(r.pool, isMutation) || !okIds(r.offers, isMutation)) return null;
  if (!Array.isArray(r.history) || !Array.isArray(r.drafts)) return null;
  return JSON.parse(JSON.stringify(r)) as RunState;
}

/** Rebuild a valid Profile from anything, keeping every field that is valid. */
export function sanitize(raw: unknown): Profile {
  const d = defaultProfile();
  if (!isObj(raw)) return d;
  const codex = isObj(raw.codex) ? raw.codex : {};
  const runs = isObj(raw.runs) ? raw.runs : {};
  const ftue = isObj(raw.ftue) ? raw.ftue : {};
  const tel = isObj(raw.telemetry) ? raw.telemetry : {};
  const tb = isObj(tel.battles) ? tel.battles : {};
  const heroes = ids<HeroId>(raw.heroes, isHero);
  const mutations = ids<MutationId>(raw.mutations, isMutation);
  return {
    v: PROFILE_VERSION,
    settings: sanitizeSettings(raw.settings),
    // the starting unlocks can never be lost, whatever the stored data says
    heroes: [...new Set([...STARTING_HEROES, ...heroes])],
    mutations: [...new Set([...STARTING_POOL, ...mutations])],
    codex: {
      mutations: record<MutationId, CodexMutation>(codex.mutations, isMutation, (x) =>
        isObj(x) ? { discovered: bool(x.discovered, false), picks: int(x.picks, 0) } : null),
      recipes: ids<MutationId>(codex.recipes, (x) => isMutation(x) && MUTATION_BY_ID[x as MutationId].requires.length > 0),
      rivals: record<RivalId, CodexRival>(codex.rivals, isRival, (x) =>
        isObj(x)
          ? { met: bool(x.met, false), beaten: bool(x.beaten, false), best: record<HeroId, number>(x.best, isHero, (b) => (typeof b === 'number' ? int(b, 0, 0, MAX_CROWN_LEVEL) : null)) }
          : null),
    },
    crownLevel: heroNums(raw.crownLevel, 0, MAX_CROWN_LEVEL),
    runs: { played: int(runs.played, 0), won: int(runs.won, 0), wonByHero: heroNums(runs.wonByHero, 0, Number.MAX_SAFE_INTEGER) },
    assistBonus: num(raw.assistBonus, 0, 0, ASSIST_MAX),
    ftue: { hints: ids<HintId>(ftue.hints, (x) => (HINT_IDS as readonly string[]).includes(x)) },
    savedRun: sanitizeRun(raw.savedRun),
    telemetry: {
      mutations: record<MutationId, MutationStats>(tel.mutations, isMutation, mutationStats),
      battles: {
        played: int(tb.played, 0), won: int(tb.won, 0),
        byRival: record<RivalId, { played: number; won: number }>(tb.byRival, isRival, (x) =>
          isObj(x) ? { played: int(x.played, 0), won: int(x.won, 0) } : null),
      },
      runs: Array.isArray(tel.runs) ? tel.runs.map(runLog).filter((x): x is RunLog => x !== null).slice(-TELEMETRY_RUNS) : [],
    },
  };
}

// ---------------------------------------------------------------- small pure updates

export function withSettings(p: Profile, patch: Partial<Settings>): Profile {
  return { ...p, settings: sanitizeSettings({ ...p.settings, ...patch }) };
}

/** Should the one-time prompt `id` show? Respects the Show hints setting. */
export function shouldShowHint(p: Profile, id: HintId): boolean {
  return p.settings.showHints && !p.ftue.hints.includes(id);
}

export function markHint(p: Profile, id: HintId): Profile {
  return p.ftue.hints.includes(id) ? p : { ...p, ftue: { hints: [...p.ftue.hints, id] } };
}

/** Pause > How to play: show every prompt again. */
export function resetHints(p: Profile): Profile {
  return { ...p, ftue: { hints: [] } };
}

/** First launch drops straight into battle 1 (no menu, no hero pick). */
export function isFirstLaunch(p: Profile): boolean {
  return p.runs.played === 0 && p.savedRun === null;
}

/** Keep the run for Continue (null clears it). */
export function withSavedRun(p: Profile, run: RunState | null): Profile {
  return { ...p, savedRun: run };
}

/** Settings > Reset progress: everything but the settings. */
export function resetProgress(p: Profile): Profile {
  return { ...defaultProfile(), settings: { ...p.settings } };
}

/** Local telemetry as plain JSON for export from owner playtests (win rates computed). */
export function telemetryReport(p: Profile): {
  runs: number; runWinRate: number; avgRunSeconds: number; battleWinRate: number;
  mutations: { id: MutationId; picked: number; pickRate: number; battleWinRate: number; runWinRate: number }[];
} {
  const t = p.telemetry;
  const rate = (a: number, b: number) => (b > 0 ? a / b : 0);
  const secs = t.runs.reduce((s, r) => s + r.seconds, 0);
  return {
    runs: p.runs.played,
    runWinRate: rate(p.runs.won, p.runs.played),
    avgRunSeconds: rate(secs, t.runs.length),
    battleWinRate: rate(t.battles.won, t.battles.played),
    mutations: (Object.entries(t.mutations) as [MutationId, MutationStats][])
      .map(([id, s]) => ({
        id, picked: s.picked, pickRate: rate(s.picked, s.offered),
        battleWinRate: rate(s.battleWins, s.battles), runWinRate: rate(s.runWins, s.runs),
      }))
      .sort((a, b) => b.picked - a.picked || a.id.localeCompare(b.id)),
  };
}
