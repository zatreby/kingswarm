import { describe, expect, it } from 'vitest';
import { runMatch } from './match';
import type { MatchRecord, SideSpec } from './match';
import { RIVALS } from './profiles';

// Coarse sanity bands. The harness (tools/sim) measures the real numbers with hundreds of matches;
// these only catch a brain that has fallen over. Shorter battles keep the suite fast.
const SHORT = { duration: 75, crownOpensAt: 40 };

function play(a: SideSpec, b: SideSpec, seeds: number[]): MatchRecord[] {
  // alternate seats so a side advantage cannot fake a result; A's win is winner === seat of A
  return seeds.map((seed, i) => {
    const flip = i % 2 === 1;
    const r = runMatch({ seed, ...SHORT, sides: flip ? [b, a] : [a, b] });
    return { ...r, winner: r.winner === -1 ? -1 : (flip ? (1 - r.winner) as 0 | 1 : r.winner) };
  });
}
const wins = (rs: MatchRecord[]) => rs.filter((r) => r.winner === 0).length;

describe('golden bands', { timeout: 60_000 }, () => {
  it('Idle loses to every rival', () => {
    for (const rival of RIVALS) {
      const rs = play({ profile: rival }, { profile: 'idle' }, [1, 2]);
      expect(wins(rs), `${rival} failed to beat an idle King`).toBe(2);
    }
  });

  it('the rivals, taken together, beat a novice more often than an expert', () => {
    let vsNovice = 0, vsExpert = 0;
    for (const rival of RIVALS) {
      vsNovice += wins(play({ profile: rival }, { profile: 'novice' }, [11, 12, 13, 14]));
      vsExpert += wins(play({ profile: rival }, { profile: 'expert' }, [11, 12, 13, 14]));
    }
    expect(vsNovice).toBeGreaterThan(vsExpert);
  });

  it('an expert beats Bumble at level 0 more than 85% of the time', () => {
    const rs = play({ profile: 'expert' }, { profile: 'bumble', level: 0 }, [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    expect(wins(rs)).toBeGreaterThanOrEqual(9);
  });

  it('the random-input monkey never breaks the sim', () => {
    for (const seed of [1, 2]) {
      const r = runMatch({ seed, ...SHORT, sides: [{ profile: 'monkey' }, { profile: 'spamFire' }] });
      expect(r.nan).toBe(false);
      expect(r.length).toBeGreaterThan(0);
    }
  });
});
