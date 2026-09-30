import { describe, expect, it } from 'vitest';
import { runMatch } from './match';
import { RIVALS } from './profiles';

// A tell must never lie: every announced action happens within lead + 1 s, unless the King dies
// (or is stunned, which physically prevents it) in that window. The check itself lives in the
// match runner (it is also a harness metric); this spec makes sure it runs and passes for every rival.
const SIGNATURE: Record<string, string> = {
  bumble: 'hoard', pip: 'crownPush', brood: 'push', gorm: 'raid', sable: 'ambush', mora: 'crownPush',
};

describe('tells', { timeout: 60_000 }, () => {
  for (const rival of RIVALS) {
    it(`${rival} announces its plays and every tell comes true`, () => {
      let tells = 0;
      const kinds = new Set<string>();
      for (const [seed, level] of [[1, 0], [2, 4], [3, 8], [4, 2]] as const) {
        const r = runMatch({
          seed, duration: 100, crownOpensAt: 55,
          sides: [{ profile: 'average' }, { profile: rival, level }],
        });
        for (const t of r.tells) {
          kinds.add(t.tell);
          expect(t.honest, `${rival} L${level} seed ${seed}: ${t.tell} at ${t.time.toFixed(2)}s (${t.x.toFixed(1)},${t.y.toFixed(1)}) never happened`).toBe(true);
        }
        tells += r.tells.length;
        expect(r.tells.every((t) => t.lead > 0)).toBe(true);
      }
      expect(tells, `${rival} never used a tell`).toBeGreaterThan(0);
      expect([...kinds], `${rival} never showed its signature tell`).toContain(SIGNATURE[rival]);
    });
  }

  it('Sable ambush tells mark where she lands', () => {
    let ambushes = 0;
    for (const seed of [5, 6, 7, 8]) {
      const r = runMatch({ seed, duration: 90, crownOpensAt: 50, sides: [{ profile: 'expert' }, { profile: 'sable', level: 4 }] });
      for (const t of r.tells) if (t.tell === 'ambush') { ambushes++; expect(t.honest).toBe(true); }
    }
    expect(ambushes).toBeGreaterThan(0);
  });

  it('player proxies never announce anything', () => {
    const r = runMatch({ seed: 3, duration: 60, crownOpensAt: 30, sides: [{ profile: 'expert' }, { profile: 'novice' }] });
    expect(r.tells.length).toBe(0);
  });
});
