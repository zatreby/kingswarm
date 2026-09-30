// Aggregate match records into the balance metrics of fun-ai.md §5 (win rate with a 95% CI,
// ending mix, length, first capture, lead changes, comeback rate, snowball index, degeneracy flags).
// Pure functions so the harness and specs share one definition.
import type { MatchRecord } from './match';

/** A match record plus which seat side A played (sides alternate seats to cancel side bias). */
export interface SeatedRecord extends MatchRecord {
  seatA: 0 | 1;
}

export interface Dist { median: number; p10: number; p90: number; mean: number }

export interface Summary {
  n: number;
  a: string;
  b: string;
  winsA: number;
  winsB: number;
  draws: number;
  /** Side A's win rate (draws count half) and its Wilson 95% interval. */
  winRateA: number;
  ciA: [number, number];
  /** Team 0 (Blue seat) win rate, for side fairness in mirror matches. */
  seat0WinRate: number;
  endings: Record<'throne' | 'crown' | 'time' | 'overtime' | 'draw', number>;
  length: Dist;
  firstCapture: Dist & { over30: number };
  leadChanges: Dist & { atLeast1: number; atLeast2: number };
  /** P(win | behind by >= 0.15 lead score at 60 s); null when no match qualified. */
  comebackRate: number | null;
  comebackN: number;
  /** Pearson correlation of A's lead score at 60 s with A's result; null if undefined. */
  snowball: number | null;
  kingDeathsA: number;
  kingDeathsB: number;
  volleysPerMinA: number;
  volleysPerMinB: number;
  thrownPerMinA: number;
  thrownPerMinB: number;
  swarmA: number;
  swarmB: number;
  followersA: number;
  followersB: number;
  flags: {
    /** Share of matches with a stretch of 30 s or more without any capture. */
    drought30: number;
    /** Share of matches where a King stood idle (alive, still, not firing) for more than 10 s. */
    kingIdle10A: number;
    kingIdle10B: number;
    nan: number;
    tells: number;
    tellLies: number;
    unstucksPerMatch: number;
  };
}

export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function dist(xs: readonly number[]): Dist {
  const mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  return { median: quantile(xs, 0.5), p10: quantile(xs, 0.1), p90: quantile(xs, 0.9), mean };
}

/** Wilson score interval for k successes in n trials (z = 1.96 for 95%). */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function summarize(rs: readonly SeatedRecord[]): Summary {
  const n = rs.length;
  const result = (r: SeatedRecord) => (r.winner === -1 ? 0.5 : r.winner === r.seatA ? 1 : 0);
  const winsA = rs.filter((r) => r.winner !== -1 && r.winner === r.seatA).length;
  const draws = rs.filter((r) => r.winner === -1).length;
  const winsB = n - winsA - draws;
  const score = winsA + draws / 2;
  const endings = { throne: 0, crown: 0, time: 0, overtime: 0, draw: 0 };
  for (const r of rs) {
    const k = r.reason === 'forfeit' ? 'draw' : r.reason;
    endings[k] += 1 / n;
  }
  const fc = rs.map((r) => r.firstCapture ?? r.length);
  const lc = rs.map((r) => r.leadChanges);

  const at60 = rs.filter((r) => r.leadAt60 !== null);
  const la = at60.map((r) => (r.seatA === 0 ? r.leadAt60! : -r.leadAt60!));
  const behind = at60.filter((_, i) => Math.abs(la[i]) >= 0.15);
  let comebacks = 0;
  for (const r of behind) {
    const l = r.seatA === 0 ? r.leadAt60! : -r.leadAt60!;
    const aBehind = l < 0;
    const res = result(r);
    if ((aBehind && res === 1) || (!aBehind && res === 0)) comebacks++;
  }

  const per = <T>(f: (r: SeatedRecord, side: 0 | 1) => T) => rs.map((r) => [f(r, r.seatA), f(r, (1 - r.seatA) as 0 | 1)] as [T, T]);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const minutes = (r: SeatedRecord) => Math.max(r.length, 1) / 60;
  const vol = per((r, t) => r.volleys[t] / minutes(r));
  const thr = per((r, t) => r.thrown[t] / minutes(r));
  const kd = per((r, t) => r.kingDeaths[t]);
  const sw = per((r, t) => r.avgSwarm[t]);
  const fo = per((r, t) => r.avgFollowers[t]);
  const idle = per((r, t) => (r.kingIdleMax[t] > 10 ? 1 : 0));
  const tells = rs.reduce((a, r) => a + r.tells.length, 0);
  const lies = rs.reduce((a, r) => a + r.tells.filter((t) => !t.honest).length, 0);

  return {
    n,
    a: rs[0]?.profiles[rs[0].seatA] ?? '?',
    b: rs[0]?.profiles[1 - rs[0].seatA] ?? '?',
    winsA, winsB, draws,
    winRateA: n ? score / n : NaN,
    ciA: wilson(score, n),
    seat0WinRate: n ? rs.reduce((a, r) => a + (r.winner === -1 ? 0.5 : r.winner === 0 ? 1 : 0), 0) / n : NaN,
    endings,
    length: dist(rs.map((r) => r.length)),
    firstCapture: { ...dist(fc), over30: n ? fc.filter((t) => t > 30).length / n : 0 },
    leadChanges: { ...dist(lc), atLeast1: n ? lc.filter((x) => x >= 1).length / n : 0, atLeast2: n ? lc.filter((x) => x >= 2).length / n : 0 },
    comebackRate: behind.length ? comebacks / behind.length : null,
    comebackN: behind.length,
    snowball: pearson(la, at60.map(result)),
    kingDeathsA: mean(kd.map((x) => x[0])), kingDeathsB: mean(kd.map((x) => x[1])),
    volleysPerMinA: mean(vol.map((x) => x[0])), volleysPerMinB: mean(vol.map((x) => x[1])),
    thrownPerMinA: mean(thr.map((x) => x[0])), thrownPerMinB: mean(thr.map((x) => x[1])),
    swarmA: mean(sw.map((x) => x[0])), swarmB: mean(sw.map((x) => x[1])),
    followersA: mean(fo.map((x) => x[0])), followersB: mean(fo.map((x) => x[1])),
    flags: {
      drought30: n ? rs.filter((r) => r.longestDrought >= 30).length / n : 0,
      kingIdle10A: mean(idle.map((x) => x[0])),
      kingIdle10B: mean(idle.map((x) => x[1])),
      nan: rs.filter((r) => r.nan).length,
      tells, tellLies: lies,
      unstucksPerMatch: mean(rs.map((r) => r.unstucks[0] + r.unstucks[1])),
    },
  };
}
