import { describe, expect, it } from 'vitest';
import { countLeadChanges } from './match';
import type { MatchRecord } from './match';
import { pearson, quantile, summarize, wilson } from './stats';
import type { SeatedRecord } from './stats';

function rec(over: Partial<SeatedRecord>): SeatedRecord {
  const base: MatchRecord = {
    seed: 1, profiles: ['a', 'b'], winner: 0, reason: 'throne', length: 120, firstCapture: 10,
    leadChanges: 1, leadAt60: 0, kingDeaths: [0, 0], volleys: [60, 60], thrown: [100, 100], captures: [1, 1],
    avgSwarm: [20, 20], avgFollowers: [5, 5], longestDrought: 10, kingIdleMax: [1, 1], nan: false,
    tells: [], barks: 0, unstucks: [0, 0], finalHash: 0,
  };
  return { ...base, seatA: 0, ...over };
}

describe('balance stats', () => {
  it('counts lead changes with a hysteresis band, not the first lead', () => {
    expect(countLeadChanges([0, 0.02, -0.03, 0.04])).toBe(0); // never leaves the band
    expect(countLeadChanges([0.1, 0.2, -0.1])).toBe(1);
    expect(countLeadChanges([0.1, -0.04, 0.1, -0.06, 0.2])).toBe(2); // -0.04 is inside the band
  });

  it('Wilson interval brackets the rate and narrows with n', () => {
    const [lo, hi] = wilson(50, 100);
    expect(lo).toBeLessThan(0.5);
    expect(hi).toBeGreaterThan(0.5);
    expect(hi - lo).toBeCloseTo(0.192, 2);
    const [lo2, hi2] = wilson(500, 1000);
    expect(hi2 - lo2).toBeLessThan(hi - lo);
    expect(wilson(0, 10)[0]).toBe(0);
  });

  it('quantiles and correlation', () => {
    expect(quantile([3, 1, 2], 0.5)).toBe(2);
    expect(quantile([0, 10], 0.9)).toBeCloseTo(9);
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it('reads results from side A whichever seat it played', () => {
    const s = summarize([
      rec({ seatA: 0, winner: 0 }),
      rec({ seatA: 1, winner: 1, profiles: ['b', 'a'] }),
      rec({ seatA: 1, winner: 0, profiles: ['b', 'a'], reason: 'crown' }),
      rec({ seatA: 0, winner: -1, reason: 'draw' }),
    ]);
    expect(s.winsA).toBe(2);
    expect(s.winsB).toBe(1);
    expect(s.draws).toBe(1);
    expect(s.winRateA).toBeCloseTo(2.5 / 4);
    expect(s.seat0WinRate).toBeCloseTo(2.5 / 4);
    expect(s.endings.throne).toBeCloseTo(0.5);
    expect(s.endings.crown).toBeCloseTo(0.25);
    expect(s.a).toBe('a');
  });

  it('comeback rate counts wins by the side that trailed at 60 s', () => {
    const s = summarize([
      rec({ seatA: 0, leadAt60: -0.2, winner: 0 }), // A behind, A won: comeback
      rec({ seatA: 0, leadAt60: -0.2, winner: 1 }), // A behind, lost
      rec({ seatA: 1, leadAt60: -0.3, winner: 0, profiles: ['b', 'a'] }), // A (seat 1) ahead by 0.3, B won: comeback
      rec({ seatA: 0, leadAt60: 0.05, winner: 1 }), // not behind enough
    ]);
    expect(s.comebackN).toBe(3);
    expect(s.comebackRate).toBeCloseTo(2 / 3);
  });
});
