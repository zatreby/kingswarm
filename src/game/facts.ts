// Battle facts for the result screen: near-misses on a loss, brags on a win (GDD section 7.4,
// research/retention.md bottom line 8). observe() runs after every sim step and reads only a few
// World fields plus world.events, so it costs O(1) per call apart from the event loop. Near-misses
// are measured, never invented.
import { tuning } from '../sim';
import type { Team, WinReason, World } from '../sim';

type Pair = [number, number];

export interface BattleFacts {
  started: boolean;
  /** Live critters per team, kept from events after one initial count. */
  swarm: Pair;
  swarmPeak: Pair;
  /** world.born at the last observe (hatches, Kingscall, start swarm, Militia). */
  bornSeen: Pair;
  /** Highest Crown hold per team, seconds. */
  crownPeak: Pair;
  /** Lowest control each team's own Throne fell to while still theirs (100 = never touched). */
  throneLow: Pair;
  /** King takedowns scored by each team. */
  takedowns: Pair;
  captures: Pair;
  /** Buildings owned per team, kept from capture events. */
  owned: Pair;
  /** Largest building deficit each team climbed out of (rival owned minus own). */
  worstDeficit: Pair;
  leadChanges: number;
  /** Team currently ahead on buildings, or -1 when level. */
  leader: -1 | Team;
  /** Seconds when the Crown opened (-1 = never). */
  crownOpenedAt: number;
  endTime: number;
  winner: -1 | Team;
  reason: WinReason | null;
}

export function createFacts(): BattleFacts {
  return {
    started: false,
    swarm: [0, 0], swarmPeak: [0, 0], bornSeen: [0, 0],
    crownPeak: [0, 0], throneLow: [100, 100], takedowns: [0, 0], captures: [0, 0],
    owned: [0, 0], worstDeficit: [0, 0], leadChanges: 0, leader: -1,
    crownOpenedAt: -1, endTime: 0, winner: -1, reason: null,
  };
}

/** Call after every step(world, ...). Mutates `f` in place (it is presentation-side bookkeeping). */
export function observe(f: BattleFacts, w: World): void {
  const first = !f.started;
  if (first) {
    // one full count; from here on the counts move only with events
    f.started = true;
    for (const c of w.critters) if (c.alive) f.swarm[c.team]++;
    for (const b of w.buildings) if (b.owner !== -1) f.owned[b.owner]++;
    f.bornSeen = [w.born[0], w.born[1]];
    f.leader = lead(f);
  }

  for (const t of [0, 1] as const) {
    const born = w.born[t] - f.bornSeen[t];
    f.bornSeen[t] = w.born[t];
    if (!first) f.swarm[t] += born;
  }

  for (const e of w.events) {
    switch (e.type) {
      case 'critterDied': if (!first) f.swarm[e.team]--; break;
      case 'spawn': if (!first && e.cause !== 'militia') f.swarm[e.team]++; break; // Militia counts in born
      case 'conscript': if (!first) { f.swarm[e.team] += e.count; f.swarm[1 - e.team] -= e.count; } break;
      case 'heroDown': f.takedowns[e.by]++; break;
      case 'capture':
        f.captures[e.team]++;
        if (!first) {
          f.owned[e.team]++;
          if (e.prev !== -1) f.owned[e.prev]--;
        }
        break;
      case 'crownOpen': f.crownOpenedAt = w.time; break;
      case 'matchEnd': f.winner = e.winner; f.reason = e.reason; f.endTime = w.time; break;
    }
  }

  for (const t of [0, 1] as const) {
    if (f.swarm[t] > f.swarmPeak[t]) f.swarmPeak[t] = f.swarm[t];
    if (w.crown[t] > f.crownPeak[t]) f.crownPeak[t] = w.crown[t];
    const th = w.buildings[w.thrones[t]];
    if (th.owner === t && th.control < f.throneLow[t]) f.throneLow[t] = th.control;
    const deficit = f.owned[1 - t] - f.owned[t];
    if (deficit > f.worstDeficit[t]) f.worstDeficit[t] = deficit;
  }
  const now = lead(f);
  if (now !== -1 && f.leader !== -1 && now !== f.leader) f.leadChanges++;
  if (now !== -1) f.leader = now;
}

function lead(f: BattleFacts): -1 | Team {
  return f.owned[0] > f.owned[1] ? 0 : f.owned[1] > f.owned[0] ? 1 : -1;
}

/** Raw numbers for local telemetry, from `team`'s point of view. */
export interface FactNumbers {
  won: boolean;
  reason: WinReason | null;
  duration: number;
  swarmPeak: number;
  crownPeak: number;
  rivalCrownPeak: number;
  /** Lowest control of your Throne and of theirs (100 = untouched). */
  throneLow: number;
  rivalThroneLow: number;
  takedowns: number;
  falls: number;
  captures: number;
  buildings: number;
  rivalBuildings: number;
  worstDeficit: number;
  leadChanges: number;
  thrown: number;
  crittersKilled: number;
  crittersLost: number;
}

export interface FactSummary {
  /** 2-3 one-line facts, most interesting first. */
  lines: string[];
  numbers: FactNumbers;
}

/** m:ss of elapsed battle time. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const one = (x: number) => (Math.floor(x * 10) / 10).toFixed(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The most interesting facts for `team`. On a loss: near-misses (how close you came). On a win:
 * brags (how you did it) and close calls survived. Always 2-3 lines.
 */
export function summarise(f: BattleFacts, w: World, team: Team): FactSummary {
  const foe = (1 - team) as Team;
  const winner = f.winner !== -1 ? f.winner : w.winner;
  const reason = f.reason ?? w.winReason;
  const won = winner === team;
  const hold = tuning.match.crownHold;
  const n: FactNumbers = {
    won, reason, duration: f.endTime || w.time,
    swarmPeak: f.swarmPeak[team], crownPeak: f.crownPeak[team], rivalCrownPeak: f.crownPeak[foe],
    throneLow: f.throneLow[team], rivalThroneLow: f.throneLow[foe],
    takedowns: f.takedowns[team], falls: f.takedowns[foe], captures: f.captures[team],
    buildings: f.owned[team], rivalBuildings: f.owned[foe],
    worstDeficit: f.worstDeficit[team], leadChanges: f.leadChanges,
    thrown: w.stats[team].thrown, crittersKilled: w.stats[team].crittersKilled, crittersLost: w.stats[team].crittersLost,
  };

  const c: { score: number; text: string }[] = [];
  const add = (score: number, text: string) => c.push({ score, text });

  if (won) {
    if (reason === 'throne') add(90, `Throne taken at ${clock(n.duration)}`);
    else if (reason === 'crown') add(90, `Crown held at ${clock(n.duration)}`);
    else if (reason === 'time') add(85, `Won on buildings, ${n.buildings} to ${n.rivalBuildings}`);
    else if (reason === 'overtime') add(88, `Won in overtime at ${clock(n.duration)}`);
    else if (reason === 'forfeit') add(20, 'Rival forfeited');
    if (n.worstDeficit >= 2) add(86, `Came back from ${plural(n.worstDeficit, 'building')} down`);
    if (n.rivalCrownPeak >= hold * 0.5) add(60 + 30 * (n.rivalCrownPeak / hold), `Stopped their Crown at ${one(n.rivalCrownPeak)} of ${hold} s`);
    if (n.throneLow <= 50) add(60 + 0.28 * (100 - n.throneLow), `Your Throne survived at ${Math.round(n.throneLow)}%`);
    if (n.takedowns > 0) add(40 + 10 * Math.min(n.takedowns, 4), plural(n.takedowns, 'King takedown'));
    if (n.falls === 0) add(45, 'Your King never fell');
    add(30 + Math.min(20, n.swarmPeak / 4), `Swarm peak ${n.swarmPeak}`);
  } else {
    if (n.crownPeak >= hold * 0.3) add(50 + 45 * (n.crownPeak / hold), `Crown held ${one(n.crownPeak)} of ${hold} s`);
    if (n.rivalThroneLow <= 60) add(45 + 0.4 * (100 - n.rivalThroneLow), `Their Throne was down to ${Math.max(1, Math.round(n.rivalThroneLow))}%`);
    if (reason === 'time' && n.rivalBuildings - n.buildings === 1) add(92, 'Lost on buildings by just 1');
    if ((reason === 'throne' || reason === 'crown') && n.duration >= w.config.duration * 0.8) add(50, `Held out until ${clock(n.duration)}`);
    if (n.leadChanges > 0) add(35 + 5 * n.leadChanges, `The lead changed ${plural(n.leadChanges, 'time')}`);
    if (n.takedowns > 0) add(40 + 8 * Math.min(n.takedowns, 4), plural(n.takedowns, 'King takedown'));
    add(25 + Math.min(15, n.swarmPeak / 4), `Swarm peak ${n.swarmPeak}`);
    if (n.crittersKilled > 0) add(15, `${n.crittersKilled} rival critters squashed`);
  }
  // stable: equal scores keep insertion order
  const lines = c.map((x, i) => ({ ...x, i })).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 3).map((x) => x.text);
  if (lines.length < 2) lines.push(`${n.thrown} critters thrown`);
  return { lines, numbers: n };
}
