import { describe, expect, it } from 'vitest';
import { MUTATIONS, MUTATION_BY_ID, canOffer, createWorld } from '../sim';
import type { MutationId } from '../sim';
import { COUNTERS, RIVALS } from './content';
import type { RivalId } from './content';
import { defaultProfile } from './profile';
import type { Profile } from './profile';
import { below, mix, next, rng } from './rng';
import {
  CROWN_LEVELS, DRAFT_SIZE, FIRST_RUN_HANDICAP, LADDER_LENGTH, MAX_MUTATIONS, PHASE_EDGES,
  abandon, advance, applyBattleResult, battleSetup, canReroll, crownEffects, draftOptions, isDuo,
  makeLadder, newRun, pick, reroll, skip, startBattle,
} from './run';
import type { BattleResult, RunState } from './run';

const WIN: BattleResult = { won: true, reason: 'throne', duration: 90, facts: ['Throne taken at 1:30'] };
const LOSS: BattleResult = { won: false, reason: 'crown', duration: 100, facts: ['Crown held 8.4 of 10 s'] };

function veteran(): Profile {
  const p = defaultProfile();
  return { ...p, runs: { ...p.runs, played: 12, won: 3 }, mutations: MUTATIONS.map((m) => m.id) };
}

/** Play the current battle and step to the next decision point. */
function battle(run: RunState, r: BattleResult): RunState {
  return advance(applyBattleResult(startBattle(run), r));
}

describe('ladder', () => {
  it('first ever run: Bumble, Pip, two of Brood/Gorm/Sable rising, Mora', () => {
    for (let s = 0; s < 200; s++) {
      const l = makeLadder(s, true);
      expect(l).toHaveLength(LADDER_LENGTH);
      expect(l.slice(0, 2)).toEqual(['bumble', 'pip']);
      expect(l[4]).toBe('mora');
      for (const id of l.slice(2, 4)) expect(['brood', 'gorm', 'sable']).toContain(id);
      expect(RIVALS[l[2]].rank).toBeLessThan(RIVALS[l[3]].rank);
    }
  });

  it('later runs: Bumble, three of the four rising, Mora, and the order varies', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 200; s++) {
      const l = makeLadder(s, false);
      expect(l[0]).toBe('bumble');
      expect(l[4]).toBe('mora');
      const mid = l.slice(1, 4);
      expect(new Set(mid).size).toBe(3);
      for (const id of mid) expect(['pip', 'brood', 'gorm', 'sable']).toContain(id);
      for (let i = 1; i < 3; i++) expect(RIVALS[mid[i - 1]].rank).toBeLessThan(RIVALS[mid[i]].rank);
      seen.add(mid.join());
    }
    expect(seen.size).toBe(4);
  });

  it('newRun picks the first-run ladder from the profile', () => {
    expect(newRun({ hero: 'brawler', seed: 5, profile: defaultProfile() }).firstRun).toBe(true);
    expect(newRun({ hero: 'brawler', seed: 5, profile: veteran() }).firstRun).toBe(false);
  });
});

describe('phase flow', () => {
  it('rivalCard -> battle -> result -> draft -> rivalCard', () => {
    let r = newRun({ hero: 'brawler', seed: 1, profile: defaultProfile() });
    expect(r.phase).toBe('rivalCard');
    expect(r.lives).toBe(2);
    r = startBattle(r);
    expect(r.phase).toBe('battle');
    r = applyBattleResult(r, WIN);
    expect(r.phase).toBe('result');
    r = advance(r);
    expect(r.phase).toBe('draft');
    expect(r.battle).toBe(1);
    expect(r.offers).toHaveLength(DRAFT_SIZE);
    r = pick(r, r.offers[0]);
    expect(r.phase).toBe('rivalCard');
    expect(r.mutations).toHaveLength(1);
  });

  it('a loss costs a life and rematches the same rival with no draft', () => {
    let r = newRun({ hero: 'brawler', seed: 2, profile: defaultProfile() });
    r = applyBattleResult(startBattle(r), LOSS);
    expect(r.lives).toBe(1);
    r = advance(r);
    expect(r.phase).toBe('rivalCard');
    expect(r.battle).toBe(0);
    expect(r.attempt).toBe(1);
    expect(r.drafts).toHaveLength(0);
    r = battle(r, LOSS);
    expect(r.lives).toBe(0);
    expect(r.phase).toBe('runLost');
  });

  it('beating the Boss wins the run', () => {
    let r = newRun({ hero: 'brawler', seed: 3, profile: defaultProfile() });
    for (let i = 0; i < 4; i++) {
      r = battle(r, WIN);
      r = r.phase === 'draft' ? skip(r) : r;
    }
    expect(r.battle).toBe(4);
    r = battle(r, WIN);
    expect(r.phase).toBe('runWon');
    expect(r.time).toBe(5 * 90);
  });

  it('illegal calls throw', () => {
    const r = newRun({ hero: 'brawler', seed: 4, profile: defaultProfile() });
    expect(() => applyBattleResult(r, WIN)).toThrow();
    expect(() => pick(r, 'bombers')).toThrow();
    expect(() => advance(r)).toThrow();
    expect(() => reroll(r)).toThrow();
    const lost = abandon(r);
    expect(lost.phase).toBe('runLost');
    expect(() => abandon(lost)).toThrow();
    expect(() => battleSetup(lost, defaultProfile())).toThrow();
  });

  it('picking something not on offer throws', () => {
    let r = battle(newRun({ hero: 'brawler', seed: 6, profile: defaultProfile() }), WIN);
    const off = MUTATIONS.map((m) => m.id).find((id) => !r.offers.includes(id))!;
    expect(() => pick(r, off)).toThrow();
    r = skip(r);
    expect(r.mutations).toEqual([]);
  });

  it('reroll: once per run, new cards, still reproducible', () => {
    let r = battle(newRun({ hero: 'brawler', seed: 7, profile: veteran() }), WIN);
    expect(canReroll(r)).toBe(true);
    const before = r.offers;
    const r2 = reroll(r);
    expect(r2.rerolls).toBe(0);
    expect(r2.offers.some((o) => !before.includes(o))).toBe(true);
    expect(reroll(r)).toEqual(r2);
    expect(canReroll(r2)).toBe(false);
    expect(() => reroll(r2)).toThrow();
    expect(r2.drafts[0].offered.length).toBeGreaterThan(DRAFT_SIZE);
    r = pick(r2, r2.offers[1]);
    expect(r.drafts[0].picked).toBe(r2.offers[1]);
  });

  it('the draft is skipped once five Mutations are drafted', () => {
    let r: RunState = { ...newRun({ hero: 'brawler', seed: 8, profile: veteran() }), mutations: ['bombers', 'scorch', 'militia', 'homing', 'longArm'] };
    r = battle(r, WIN);
    expect(r.phase).toBe('rivalCard');
    expect(r.battle).toBe(1);
    expect(r.mutations.length).toBe(MAX_MUTATIONS);
  });
});

describe('draft offers', () => {
  const pool = MUTATIONS.map((m) => m.id);

  it('are distinct, never owned, and Duos need both tags', () => {
    for (let s = 0; s < 300; s++) {
      const r = rng(s);
      const owned = pool.filter(() => next(r) < 0.15);
      const o = draftOptions({ owned, pool, next: 'gorm', seed: s });
      expect(new Set(o).size).toBe(o.length);
      for (const id of o) expect(canOffer(id, owned), `${id} vs ${owned}`).toBe(true);
    }
  });

  it('include a counter to the next rival whenever the pool has one', () => {
    for (const next of Object.keys(COUNTERS) as RivalId[]) {
      for (let s = 0; s < 50; s++) {
        const o = draftOptions({ owned: [], pool, next, seed: s });
        expect(o.some((id) => COUNTERS[next].some((c) => c.id === id)), `${next} seed ${s}: ${o}`).toBe(true);
      }
    }
  });

  it('favour a Duo once its recipe is possible', () => {
    const owned: MutationId[] = ['bombers', 'frostbite'];
    let duos = 0;
    for (let s = 0; s < 100; s++) if (draftOptions({ owned, pool, next: 'pip', seed: s }).includes('cryoBombs')) duos++;
    expect(duos).toBe(100);
    expect(draftOptions({ owned: ['bombers'], pool, next: 'pip', seed: 1 }).some(isDuo)).toBe(false);
  });

  it('draw only from the pool and shrink gracefully', () => {
    const small: MutationId[] = ['bombers', 'longArm'];
    expect(draftOptions({ owned: [], pool: small, next: 'pip', seed: 1 }).sort()).toEqual(['bombers', 'longArm']);
    expect(draftOptions({ owned: small, pool: small, next: 'pip', seed: 1 })).toEqual([]);
  });

  it('mix tags when the pool allows', () => {
    let mixed = 0;
    for (let s = 0; s < 200; s++) {
      const o = draftOptions({ owned: [], pool, next: null, seed: s });
      if (new Set(o.flatMap((id) => MUTATION_BY_ID[id].tags)).size === 3) mixed++;
    }
    expect(mixed).toBeGreaterThan(140);
  });
});

describe('battleSetup', () => {
  it('builds a valid seeded MatchConfig with the run hero and Mutations', () => {
    let r = newRun({ hero: 'blink', seed: 11, profile: veteran() });
    r = battle(r, WIN);
    r = pick(r, r.offers[0]);
    const s = battleSetup(r, defaultProfile());
    expect(s.config.teams[0].hero).toBe('blink');
    expect(s.config.teams[0].mutations).toEqual(r.mutations);
    expect(s.config.teams[1].hero).toBe(s.rival.hero);
    expect(s.config.teams[1].mutations).toEqual(s.rival.mutations);
    expect(s.config.map.id).toBe(s.rival.arena);
    expect(s.looks).toEqual(['blink', s.rival.look]);
    expect(s.battleIndex).toBe(1);
    expect(s.battlesTotal).toBe(5);
    expect(s.botProfileId).toBe(s.rival.id);
    expect(s.botLevel).toBe(0);
    expect(() => createWorld(s.config)).not.toThrow();
  });

  it('seeds differ per battle and per rematch but repeat for the same state', () => {
    const r = newRun({ hero: 'brawler', seed: 12, profile: veteran() });
    const a = battleSetup(r, defaultProfile()).config.seed;
    expect(battleSetup(r, defaultProfile()).config.seed).toBe(a);
    const rematch = battle(r, LOSS);
    expect(battleSetup(rematch, defaultProfile()).config.seed).not.toBe(a);
  });

  it('ramps battle length along the ladder', () => {
    let r = newRun({ hero: 'brawler', seed: 13, profile: veteran() });
    const times: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const c = battleSetup(r, defaultProfile()).config;
      times.push([c.crownOpensAt, c.duration]);
      r = battle(r, WIN);
      if (r.phase === 'draft') r = skip(r);
    }
    expect(times[0]).toEqual([45, 105]);
    expect(times[4]).toEqual([90, 150]);
  });

  it('softens only the first two rivals of the first run', () => {
    let r = newRun({ hero: 'brawler', seed: 14, profile: defaultProfile() });
    const muls: number[] = [];
    for (let i = 0; i < 5; i++) {
      muls.push(battleSetup(r, defaultProfile()).config.teams[1].hatchMul ?? 1);
      r = battle(r, WIN);
      if (r.phase === 'draft') r = skip(r);
    }
    expect(muls).toEqual([...FIRST_RUN_HANDICAP, 1, 1, 1]);
    const later = newRun({ hero: 'brawler', seed: 14, profile: veteran() });
    expect(battleSetup(later, defaultProfile()).config.teams[1].hatchMul).toBe(1);
  });

  it('applies the Assist bonus only when Assist is on', () => {
    const r = newRun({ hero: 'brawler', seed: 15, profile: veteran() });
    const p = { ...defaultProfile(), assistBonus: 0.15 };
    expect(battleSetup(r, p).config.teams[0].hatchMul).toBe(1);
    expect(battleSetup(r, { ...p, settings: { ...p.settings, assist: true } }).config.teams[0].hatchMul).toBeCloseTo(1.15);
  });
});

describe('Crown Levels', () => {
  it('eight distinct levels, each one player-facing line', () => {
    expect(CROWN_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(CROWN_LEVELS.map((l) => l.id)).size).toBe(8);
    for (const l of CROWN_LEVELS) expect(l.text.split(/\s+/).length).toBeLessThanOrEqual(12);
  });

  it('every level changes something a battle or run can observe', () => {
    const sig = (cl: number) => {
      let r = newRun({ hero: 'brawler', seed: 21, crownLevel: cl, profile: veteran() });
      const out: unknown[] = [r.lives, r.rerolls];
      for (let i = 0; i < 5; i++) {
        const s = battleSetup(r, defaultProfile());
        out.push(s.botLevel, s.config.crownOpensAt, s.config.teams[1].mutations, s.elite);
        r = battle(r, WIN);
        if (r.phase === 'draft') r = skip(r);
      }
      return JSON.stringify(out);
    };
    for (let cl = 1; cl <= 8; cl++) expect(sig(cl), `level ${cl}`).not.toBe(sig(cl - 1));
  });

  it('level effects', () => {
    expect(crownEffects(0)).toMatchObject({ botLevel: 0, extraMutations: 0, crownEarlier: 0, elite: false, rerolls: 1, lives: 2 });
    expect(crownEffects(1).botLevel).toBe(2);
    expect(crownEffects(2).extraMutations).toBe(1);
    expect(crownEffects(3).crownEarlier).toBe(15);
    expect(crownEffects(5).rerolls).toBe(0);
    expect(crownEffects(6).extraMutations).toBe(2);
    expect(crownEffects(8)).toMatchObject({ botLevel: 8, lives: 1, bossExtra: 2 });
    expect(crownEffects(99)).toEqual(crownEffects(8));
  });

  it('rival Mutation sets stay valid and duplicate-free at every level', () => {
    for (let cl = 0; cl <= 8; cl++) {
      for (let s = 0; s < 10; s++) {
        let r = newRun({ hero: 'warden', seed: s, crownLevel: cl, profile: veteran() });
        while (r.phase !== 'runWon') {
          const m = battleSetup(r, defaultProfile()).config.teams[1].mutations;
          expect(new Set(m).size).toBe(m.length);
          r = battle(r, WIN);
          if (r.phase === 'draft') r = skip(r);
        }
      }
    }
  });
});

// ---------------------------------------------------------------- property test

type Action = 'start' | 'win' | 'lose' | 'advance' | 'pick' | 'reroll' | 'skip' | 'abandon';

/** One seeded random legal action (with the random choice folded into the returned function). */
function chooseAction(run: RunState, dice: { s: number }): (r: RunState) => RunState {
  const roll = () => next(dice);
  switch (run.phase) {
    case 'rivalCard': return roll() < 0.01 ? abandon : startBattle;
    case 'battle': {
      const won = roll() < 0.6;
      const d = Math.round(40 + roll() * 110);
      return (r) => applyBattleResult(r, { won, reason: won ? 'throne' : 'crown', duration: d, facts: [] });
    }
    case 'result': return advance;
    case 'draft': {
      const x = roll();
      if (x < 0.15 && run.rerolls > 0) return reroll;
      if (x < 0.25) return skip;
      const i = Math.floor(roll() * 3);
      return (r) => pick(r, r.offers[i % r.offers.length]);
    }
    default: throw new Error('over');
  }
}

describe('property: 500 seeded runs', () => {
  it('hold every invariant and survive a mid-run save/reload identically', () => {
    for (let n = 0; n < 500; n++) {
      const dice = rng(mix(n, 99));
      const profile = n % 3 === 0 ? defaultProfile() : veteran();
      const cl = n % 9;
      let run = newRun({ hero: (['brawler', 'blink', 'warden'] as const)[n % 3], seed: mix(n, 7), crownLevel: cl, profile });
      const saveAt = 1 + below(dice, 12);
      let steps = 0;
      let twin: RunState | null = null;
      while (run.phase !== 'runWon' && run.phase !== 'runLost') {
        if (steps === saveAt) twin = JSON.parse(JSON.stringify(run)) as RunState;
        const act = chooseAction(run, dice);
        const before = run;
        run = act(run);
        if (twin) twin = act(twin);
        steps++;

        // phases only move along legal edges
        expect(PHASE_EDGES[before.phase], `${before.phase} -> ${run.phase}`).toContain(run.phase);
        expect(run.lives).toBeGreaterThanOrEqual(0);
        expect(run.lives).toBeLessThanOrEqual(run.maxLives);
        expect(run.ladder).toHaveLength(LADDER_LENGTH);
        expect(new Set(run.mutations).size).toBe(run.mutations.length);
        expect(run.mutations.length).toBeLessThanOrEqual(MAX_MUTATIONS);
        if (run.phase === 'draft') {
          const owned = run.mutations;
          expect(run.offers.length).toBeGreaterThan(0);
          expect(run.offers.length).toBeLessThanOrEqual(DRAFT_SIZE);
          expect(new Set(run.offers).size).toBe(run.offers.length);
          for (const id of run.offers) {
            expect(owned).not.toContain(id);
            expect(profile.mutations).toContain(id);
            expect(canOffer(id, owned)).toBe(true);
          }
        } else {
          expect(run.offers).toEqual([]);
        }
        if (run.phase !== 'runLost' && run.phase !== 'runWon') {
          const setup = battleSetup(run, profile);
          expect(setup.config.teams[0].mutations).toEqual(run.mutations);
        }
        if (twin) expect(twin).toEqual(run);
        expect(steps).toBeLessThan(200);
      }
      if (run.phase === 'runWon') expect(run.history.filter((h) => h.won)).toHaveLength(LADDER_LENGTH);
      if (run.phase === 'runLost' && run.lives === 0) expect(run.history.filter((h) => !h.won)).toHaveLength(run.maxLives);
      expect(run.history.every((h, i) => i === 0 || h.battle >= run.history[i - 1].battle)).toBe(true);
    }
  }, 60_000);
});
