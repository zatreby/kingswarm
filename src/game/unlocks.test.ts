import { describe, expect, it } from 'vitest';
import { MUTATIONS, MUTATION_BY_ID } from '../sim';
import type { MutationId, MutationTag } from '../sim';
import { defaultProfile, telemetryReport } from './profile';
import type { Profile } from './profile';
import { abandon, advance, applyBattleResult, newRun, pick, skip, startBattle } from './run';
import type { RunState } from './run';
import {
  ASSIST_MAX, STARTING_POOL, UNLOCK_RULES, finishRun, recordBattle,
} from './unlocks';
import type { UnlockEvent } from './unlocks';

/** Play one run to the end, winning battles while `win(i)` says so; records every battle. */
function playRun(p: Profile, seed: number, win: (battle: number) => boolean, hero = p.heroes[0], crownLevel = 0) {
  let run: RunState = newRun({ hero, seed, crownLevel, profile: p });
  let prof = p;
  while (run.phase !== 'runWon' && run.phase !== 'runLost') {
    if (run.phase === 'rivalCard') run = startBattle(run);
    else if (run.phase === 'battle') {
      const won = win(run.battle);
      run = applyBattleResult(run, { won, reason: won ? 'throne' : 'crown', duration: 100, facts: [] });
      prof = recordBattle(prof, run);
    } else if (run.phase === 'result') run = advance(run);
    else if (run.phase === 'draft') run = run.offers.length ? pick(run, run.offers[0]) : skip(run);
  }
  return { run, ...finishRun(prof, run) };
}

describe('starting pool', () => {
  it('has about nine Mutations, at least two per tag, no Duos', () => {
    expect(STARTING_POOL.length).toBeGreaterThanOrEqual(8);
    expect(STARTING_POOL.length).toBeLessThanOrEqual(10);
    for (const tag of ['boom', 'brood', 'bite', 'king'] as MutationTag[])
      expect(STARTING_POOL.filter((id) => MUTATION_BY_ID[id].tags.includes(tag)).length, tag).toBeGreaterThanOrEqual(2);
    expect(STARTING_POOL.some((id) => MUTATION_BY_ID[id].requires.length > 0)).toBe(false);
  });

  it('with the rules, every Mutation becomes unlockable and nothing is listed twice', () => {
    const all = [...STARTING_POOL, ...UNLOCK_RULES.flatMap((r) => r.mutations ?? [])];
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(MUTATIONS.map((m) => m.id)));
  });

  it('a Duo recipe enters the pool only when both its tags are already in it', () => {
    const pool = new Set<MutationId>(STARTING_POOL);
    for (const r of UNLOCK_RULES) {
      for (const id of r.mutations ?? []) {
        const need = MUTATION_BY_ID[id].requires;
        for (const t of need)
          expect([...pool].some((o) => MUTATION_BY_ID[o].requires.length === 0 && MUTATION_BY_ID[o].tags.includes(t)), `${id} needs ${t}`).toBe(true);
      }
      for (const id of r.mutations ?? []) pool.add(id);
    }
  });
});

describe('unlock cadence', () => {
  function tenRuns(win: (run: number, battle: number) => boolean) {
    let p = defaultProfile();
    const perRun: UnlockEvent[][] = [];
    for (let n = 0; n < 10; n++) {
      const hero = p.heroes[n % p.heroes.length];
      const res = playRun(p, 1000 + n, (b) => win(n, b), hero, p.crownLevel[hero]);
      p = res.profile;
      perRun.push(res.unlocked);
    }
    return { p, perRun };
  }

  const key = (u: UnlockEvent) => `${u.kind}:${u.mutation ?? ''}:${u.hero ?? ''}:${u.level ?? ''}`;

  it('a player who loses early every run unlocks something on each of runs 1-10, never twice', () => {
    const { p, perRun } = tenRuns(() => false);
    perRun.forEach((u, i) => expect(u.length, `run ${i + 1}`).toBeGreaterThan(0));
    const all = perRun.flat().map(key);
    expect(new Set(all).size).toBe(all.length);
    expect(p.heroes).toContain('blink');
    expect(p.heroes).not.toContain('warden');
    expect(p.runs).toMatchObject({ played: 10, won: 0 });
    expect(p.assistBonus).toBe(ASSIST_MAX);
    expect(p.mutations.length).toBe(MUTATIONS.length);
  });

  it('a player who wins every run unlocks something on each of runs 1-10, never twice', () => {
    const { p, perRun } = tenRuns(() => true);
    perRun.forEach((u, i) => expect(u.length, `run ${i + 1}`).toBeGreaterThan(0));
    const all = perRun.flat().map(key);
    expect(new Set(all).size).toBe(all.length);
    expect(p.heroes).toEqual(expect.arrayContaining(['brawler', 'blink', 'warden']));
    expect(p.assistBonus).toBe(0);
    expect(perRun[0].map((u) => u.kind)).toEqual(expect.arrayContaining(['hero', 'crownLevel']));
    expect(p.crownLevel.brawler + p.crownLevel.blink + p.crownLevel.warden).toBe(10);
  });

  it('Blink after the first completed run, Warden after the first Boss win', () => {
    const lost = playRun(defaultProfile(), 1, () => false);
    expect(lost.unlocked.map((u) => u.hero)).toContain('blink');
    expect(lost.profile.heroes).not.toContain('warden');
    const won = playRun(lost.profile, 2, () => true);
    expect(won.unlocked.map((u) => u.hero)).toContain('warden');
  });

  it('Crown Levels open one at a time per hero, by winning at the highest level', () => {
    let p = defaultProfile();
    for (let i = 0; i < 9; i++) p = playRun(p, 50 + i, () => true, 'brawler', p.crownLevel.brawler).profile;
    expect(p.crownLevel.brawler).toBe(8);
    expect(p.crownLevel.blink).toBe(0);
    const again = playRun(p, 99, () => true, 'brawler', 8);
    expect(again.unlocked.filter((u) => u.kind === 'crownLevel')).toEqual([]);
    const low = playRun(p, 98, () => true, 'brawler', 2);
    expect(low.profile.crownLevel.brawler).toBe(8);
  });

  it('a run abandoned before any battle unlocks and counts nothing', () => {
    const p = defaultProfile();
    const run = abandon(newRun({ hero: 'brawler', seed: 1, profile: p }));
    const res = finishRun({ ...p, savedRun: run }, run);
    expect(res.unlocked).toEqual([]);
    expect(res.profile.runs.played).toBe(0);
    expect(res.profile.savedRun).toBeNull();
  });

  it('finishRun refuses a live run', () => {
    const p = defaultProfile();
    expect(() => finishRun(p, newRun({ hero: 'brawler', seed: 1, profile: p }))).toThrow();
  });
});

describe('codex and telemetry', () => {
  it('records rivals met and beaten with the best Crown Level per hero', () => {
    const { profile } = playRun(defaultProfile(), 3, (b) => b < 2);
    const r = profile.codex.rivals;
    expect(r.bumble).toEqual({ met: true, beaten: true, best: { brawler: 0 } });
    expect(r.pip?.beaten).toBe(true);
    const third = Object.entries(r).find(([id]) => id !== 'bumble' && id !== 'pip')!;
    expect(third[1]).toMatchObject({ met: true, beaten: false });
    expect(r.mora).toBeUndefined();
  });

  it('marks offered Mutations discovered, counts picks, and finds Duo recipes', () => {
    const { run, profile } = playRun({ ...defaultProfile(), mutations: MUTATIONS.map((m) => m.id) }, 4, () => true);
    for (const d of run.drafts) for (const id of d.offered) expect(profile.codex.mutations[id]?.discovered).toBe(true);
    for (const id of run.mutations) expect(profile.codex.mutations[id]?.picks).toBeGreaterThanOrEqual(1);
    const duosSeen = run.drafts.flatMap((d) => d.offered).filter((id) => MUTATION_BY_ID[id].requires.length);
    expect(profile.codex.recipes.sort()).toEqual([...new Set(duosSeen)].sort());
  });

  it('keeps pick counts, per-Mutation win rates and run lengths', () => {
    let p = defaultProfile();
    for (let i = 0; i < 4; i++) p = playRun(p, 10 + i, (b) => i % 2 === 0 || b < 3).profile;
    const t = telemetryReport(p);
    expect(t.runs).toBe(4);
    expect(p.telemetry.runs).toHaveLength(4);
    expect(p.telemetry.runs.every((r) => r.seconds > 0 && r.battles >= 5)).toBe(true);
    expect(t.mutations.length).toBeGreaterThan(0);
    expect(t.mutations.some((m) => m.picked > 0 && m.pickRate > 0)).toBe(true);
    for (const m of t.mutations) {
      expect(m.pickRate).toBeGreaterThanOrEqual(0);
      expect(m.pickRate).toBeLessThanOrEqual(1);
      expect(m.battleWinRate).toBeGreaterThanOrEqual(0);
      expect(m.battleWinRate).toBeLessThanOrEqual(1);
    }
    expect(p.telemetry.battles.played).toBe(p.telemetry.runs.reduce((s, r) => s + r.battles, 0));
  });

  it('assist bonus grows 5% per lost run to 30% and resets on a win', () => {
    let p = defaultProfile();
    const bonuses: number[] = [];
    for (let i = 0; i < 8; i++) { p = playRun(p, 20 + i, () => false).profile; bonuses.push(p.assistBonus); }
    expect(bonuses).toEqual([0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.3, 0.3]);
    p = playRun(p, 40, () => true).profile;
    expect(p.assistBonus).toBe(0);
  });
});
