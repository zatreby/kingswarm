// Headless bot-vs-bot match runner with per-match metrics (fun-ai.md §5). Pure and synchronous:
// the harness in tools/sim fans it out across workers; specs call it directly.
import { buildingsOwned, createWorld, hashWorld, MAPS, step } from '../sim';
import type { HeroId, MapDef, MatchConfig, MutationId, PlayerInput, Team, WinReason, World } from '../sim';
import { createBot } from './bot';
import { profileFor } from './profiles';
import type { Bot, BotProfile, TellKind } from './types';

export interface SideSpec {
  /** Profile id (see profiles.ts) or a profile row. */
  profile: string | BotProfile;
  /** Crown Level for rivals, 0..8. */
  level?: number;
  /** Overrides of the profile's own hero and Mutations. */
  hero?: HeroId;
  mutations?: MutationId[];
}

export interface MatchSpec {
  seed: number;
  map?: string | MapDef;
  duration?: number;
  crownOpensAt?: number;
  sides: [SideSpec, SideSpec];
  /** Seconds of overtime before the match is called a draw. */
  overtimeCap?: number;
  onTick?: (w: World, bots: [Bot, Bot], inputs: [PlayerInput, PlayerInput]) => void;
}

export interface TellRecord {
  team: Team;
  tell: TellKind;
  x: number; y: number;
  lead: number;
  time: number;
  /** The announced action happened within lead + 1 s (or the King fell / was stunned / the match ended). */
  honest: boolean;
  excused: boolean;
}

export interface MatchRecord {
  seed: number;
  profiles: [string, string];
  /** -1 = draw (overtime cap reached). */
  winner: -1 | 0 | 1;
  reason: WinReason | 'draw';
  /** Seconds. */
  length: number;
  firstCapture: number | null;
  /** Sign flips of the lead score (hysteresis +-0.05). */
  leadChanges: number;
  /** Team 0's lead score at 60 s, in [-0.5, 0.5]; null if the match ended before. */
  leadAt60: number | null;
  kingDeaths: [number, number];
  /** Volleys (throw events) and critters thrown. */
  volleys: [number, number];
  thrown: [number, number];
  captures: [number, number];
  avgSwarm: [number, number];
  avgFollowers: [number, number];
  /** Longest stretch without any capture, seconds. */
  longestDrought: number;
  /** Longest stretch a living King stood still without firing, seconds. */
  kingIdleMax: [number, number];
  nan: boolean;
  tells: TellRecord[];
  barks: number;
  unstucks: [number, number];
  finalHash: number;
}

const HYST = 0.05;

/**
 * Lead score from team 0's side, in [-0.5, 0.5] (fun-ai.md §5):
 * 0.5 x building share + 0.3 x swarm share + 0.2 x King HP share, minus 0.5.
 */
export function leadScore(w: World): number {
  const b0 = buildingsOwned(w, 0), b1 = buildingsOwned(w, 1);
  let s0 = 0, s1 = 0;
  for (const c of w.critters) if (c.alive) { if (c.team === 0) s0++; else s1++; }
  const h0 = w.heroes[0].alive ? w.heroes[0].hp / w.heroes[0].maxHp : 0;
  const h1 = w.heroes[1].alive ? w.heroes[1].hp / w.heroes[1].maxHp : 0;
  const share = (a: number, b: number) => (a + b > 0 ? a / (a + b) : 0.5);
  return 0.5 * share(b0, b1) + 0.3 * share(s0, s1) + 0.2 * share(h0, h1) - 0.5;
}

/** Leader flips of a lead-score series with a hysteresis band; the first leader is not a change. */
export function countLeadChanges(series: readonly number[], band = HYST): number {
  let leader = -1, changes = 0;
  for (const l of series) {
    const now = l > band ? 0 : l < -band ? 1 : leader;
    if (now !== leader && now !== -1) {
      if (leader !== -1) changes++;
      leader = now;
    }
  }
  return changes;
}

function resolveSide(s: SideSpec): BotProfile {
  return typeof s.profile === 'string' ? profileFor(s.profile, s.level ?? 0) : s.profile;
}

export function matchConfig(spec: MatchSpec, profiles: [BotProfile, BotProfile]): MatchConfig {
  const map = typeof spec.map === 'object' ? spec.map : MAPS[spec.map ?? 'meadow'];
  if (!map) throw new Error(`unknown map "${String(spec.map)}"`);
  const team = (i: 0 | 1) => {
    const p = profiles[i], s = spec.sides[i];
    return {
      hero: s.hero ?? p.hero,
      mutations: s.mutations ?? p.mutations,
      hatchMul: p.handicapHatchMul ?? 1,
      name: p.name,
    };
  };
  return {
    seed: spec.seed, map,
    teams: [team(0), team(1)],
    duration: spec.duration ?? 150,
    crownOpensAt: spec.crownOpensAt ?? 90,
  };
}

interface PendingTell { rec: TellRecord; d0: number; until: number }

export function runMatch(spec: MatchSpec): MatchRecord {
  const profiles: [BotProfile, BotProfile] = [resolveSide(spec.sides[0]), resolveSide(spec.sides[1])];
  const cfg = matchConfig(spec, profiles);
  const w = createWorld(cfg);
  const bots: [Bot, Bot] = [createBot(0, profiles[0], spec.seed), createBot(1, profiles[1], spec.seed)];
  const cap = cfg.duration + (spec.overtimeCap ?? 60);

  const rec: MatchRecord = {
    seed: spec.seed, profiles: [profiles[0].id, profiles[1].id],
    winner: -1, reason: 'draw', length: 0, firstCapture: null, leadChanges: 0, leadAt60: null,
    kingDeaths: [0, 0], volleys: [0, 0], thrown: [0, 0], captures: [0, 0],
    avgSwarm: [0, 0], avgFollowers: [0, 0], longestDrought: 0, kingIdleMax: [0, 0],
    nan: false, tells: [], barks: 0, unstucks: [0, 0], finalHash: 0,
  };
  const leads: number[] = [];
  let samples = 0;
  let lastCapture = 0;
  const idleSince = [0, 0];
  const pending: PendingTell[] = [];

  while (w.phase !== 'over' && w.time < cap) {
    const inputs: [PlayerInput, PlayerInput] = [bots[0].think(w), bots[1].think(w)];
    for (let t = 0; t < 2; t++) {
      for (const s of bots[t].drainSignals()) {
        if (s.kind === 'bark') { rec.barks++; continue; }
        const h = w.heroes[t];
        const r: TellRecord = { team: t as Team, tell: s.tell, x: s.x, y: s.y, lead: s.lead, time: w.time, honest: false, excused: false };
        rec.tells.push(r);
        pending.push({ rec: r, d0: Math.hypot(h.x - s.x, h.y - s.y), until: w.time + s.lead + 1 });
      }
    }
    spec.onTick?.(w, bots, inputs);
    step(w, inputs);

    for (const e of w.events) {
      switch (e.type) {
        case 'throw': rec.volleys[e.team]++; break;
        case 'heroDown': rec.kingDeaths[e.team]++; break;
        case 'capture':
          rec.captures[e.team]++;
          if (rec.firstCapture === null) rec.firstCapture = w.time;
          rec.longestDrought = Math.max(rec.longestDrought, w.time - lastCapture);
          lastCapture = w.time;
          break;
        default: break;
      }
    }
    checkTells(w, pending);

    for (let t = 0; t < 2; t++) {
      const h = w.heroes[t];
      const still = h.alive && Math.hypot(h.vx, h.vy) < 0.1 && !inputs[t].fire;
      if (!still) idleSince[t] = w.time;
      else rec.kingIdleMax[t] = Math.max(rec.kingIdleMax[t], w.time - idleSince[t]);
    }

    if (w.tick % 60 === 0) {
      samples++;
      const l = leadScore(w);
      leads.push(l);
      if (w.tick === 3600) rec.leadAt60 = l;
      for (let t = 0; t < 2; t++) rec.avgFollowers[t] += w.heroes[t].followers;
      for (const c of w.critters) {
        if (!c.alive) continue;
        rec.avgSwarm[c.team]++;
        if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) rec.nan = true;
      }
      for (const h of w.heroes) if (!Number.isFinite(h.x) || !Number.isFinite(h.y) || !Number.isFinite(h.hp)) rec.nan = true;
    }
  }
  // tells still open when the match ended are excused
  for (const p of pending) { p.rec.honest = true; p.rec.excused = true; }

  rec.length = w.time;
  rec.longestDrought = Math.max(rec.longestDrought, w.time - lastCapture);
  if (w.phase === 'over' && w.winner !== -1) { rec.winner = w.winner as 0 | 1; rec.reason = w.winReason ?? 'draw'; }
  rec.leadChanges = countLeadChanges(leads);
  for (let t = 0; t < 2; t++) {
    rec.avgSwarm[t] = samples ? rec.avgSwarm[t] / samples : 0;
    rec.avgFollowers[t] = samples ? rec.avgFollowers[t] / samples : 0;
    rec.thrown[t] = w.stats[t].thrown;
    rec.unstucks[t] = bots[t].debug.unstucks;
  }
  rec.finalHash = hashWorld(w);
  return rec;
}

/** Resolve pending tells against this tick: the announced action happened, or an excuse, or time ran out. */
function checkTells(w: World, pending: PendingTell[]): void {
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i], r = p.rec;
    const h = w.heroes[r.team];
    let done = false;
    if (!h.alive || h.stunT > 0) { r.excused = true; done = true; }
    else if (r.tell === 'ambush') {
      for (const e of w.events) {
        if (e.type === 'ability' && e.team === r.team && e.slot === 0 && Math.hypot(e.tx - r.x, e.ty - r.y) <= 1.5) done = true;
      }
    } else {
      const d = Math.hypot(h.x - r.x, h.y - r.y);
      if (d <= 6.5 || d <= p.d0 - 2) done = true;
      for (const e of w.events) {
        if (e.type === 'throw' && e.team === r.team && Math.hypot(e.tx - r.x, e.ty - r.y) <= 3) done = true;
      }
    }
    if (done) { r.honest = true; pending.splice(i, 1); }
    else if (w.time > p.until) { r.honest = false; pending.splice(i, 1); }
  }
}
