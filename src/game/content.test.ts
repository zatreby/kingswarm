import { describe, expect, it } from 'vitest';
import { MUTATION_BY_ID } from '../sim';
import { COUNTERS, HEROES, HERO_IDS, RIVALS, RIVAL_IDS, TIMING_BOSS, TIMING_FIRST, battleTiming } from './content';
import { STARTING_POOL } from './unlocks';

const words = (s: string) => s.trim().split(/\s+/).length;

describe('heroes', () => {
  it('cover every HeroId with GDD section 5 abilities', () => {
    expect(Object.keys(HEROES).sort()).toEqual([...HERO_IDS].sort());
    expect(HEROES.brawler.ability.name).toBe('Stomp');
    expect(HEROES.brawler.ultimate.name).toBe('Kingscall');
    expect(HEROES.blink.ability.name).toBe('Blink');
    expect(HEROES.blink.ultimate.name).toBe('Vortex');
    expect(HEROES.warden.ability.name).toBe('Turret');
    expect(HEROES.warden.ultimate.name).toBe('Rampart');
  });

  it('only the Brawler is available from the start', () => {
    expect(HERO_IDS.filter((h) => HEROES[h].unlock.kind === 'start')).toEqual(['brawler']);
    for (const h of HERO_IDS) expect(HEROES[h].unlockText.length).toBeGreaterThan(0);
  });
});

describe('rivals', () => {
  it('match the GDD section 6 table', () => {
    const table: [string, string, string[]][] = [
      ['bumble', 'brawler', []],
      ['pip', 'warden', ['archerHuts']],
      ['brood', 'brawler', ['splitters', 'bigLitter']],
      ['gorm', 'brawler', ['brutes']],
      ['sable', 'blink', ['homing', 'frostbite']],
      ['mora', 'warden', ['royalGuard', 'bombers', 'secondWind']],
    ];
    for (const [id, hero, muts] of table) {
      const r = RIVALS[id as keyof typeof RIVALS];
      expect(r.hero, id).toBe(hero);
      expect(r.mutations, id).toEqual(muts);
      expect(r.bot).toBe(id);
      expect(r.look).toBe(id);
    }
    expect(RIVAL_IDS.filter((id) => RIVALS[id].boss)).toEqual(['mora']);
  });

  it('rank rises along the table', () => {
    expect(RIVAL_IDS.map((id) => RIVALS[id].rank)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  for (const id of RIVAL_IDS) {
    const r = RIVALS[id];
    it(`${id} has a complete, well-formed card`, () => {
      expect(r.traits).toHaveLength(2);
      for (const t of r.traits) expect(words(t.label)).toBeLessThanOrEqual(2);
      expect(r.question.endsWith('?')).toBe(true);
      expect(r.flaw.length).toBeGreaterThan(10);
      const lines = Object.values(r.barks).flat();
      expect(lines.length).toBeGreaterThanOrEqual(6);
      expect(lines.length).toBeLessThanOrEqual(10);
      for (const l of lines) expect(words(l), l).toBeLessThanOrEqual(5);
      for (const s of ['start', 'push', 'hurt', 'winning', 'losing', 'defeated'] as const) expect(r.barks[s].length, s).toBeGreaterThan(0);
    });

    it(`${id} extra Mutations are valid, new and enough for Crown Level 8`, () => {
      for (const m of r.extraMutations) {
        expect(MUTATION_BY_ID[m], m).toBeDefined();
        expect(r.mutations).not.toContain(m);
      }
      expect(new Set(r.extraMutations).size).toBe(r.extraMutations.length);
      expect(r.extraMutations.length).toBeGreaterThanOrEqual(r.boss ? 4 : 3);
    });

    it(`${id} counters are real Mutations with a one-line reason, one in the starting pool`, () => {
      for (const c of COUNTERS[id]) {
        expect(MUTATION_BY_ID[c.id]).toBeDefined();
        expect(c.why).toMatch(/\.$/);
        expect(words(c.why)).toBeLessThanOrEqual(10);
      }
      expect(COUNTERS[id].some((c) => STARTING_POOL.includes(c.id))).toBe(true);
    });
  }
});

describe('battle timing ramp', () => {
  it('runs from 0:45 of 1:45 to 1:30 of 2:30', () => {
    expect(battleTiming(0, 5)).toEqual(TIMING_FIRST);
    expect(battleTiming(4, 5)).toEqual(TIMING_BOSS);
    expect(TIMING_FIRST).toEqual({ duration: 105, crownOpensAt: 45 });
    expect(TIMING_BOSS).toEqual({ duration: 150, crownOpensAt: 90 });
  });

  it('never shrinks and keeps a 60 s Crown phase', () => {
    let prev = battleTiming(0, 5);
    for (let i = 1; i < 5; i++) {
      const t = battleTiming(i, 5);
      expect(t.duration).toBeGreaterThanOrEqual(prev.duration);
      expect(t.crownOpensAt).toBeGreaterThanOrEqual(prev.crownOpensAt);
      expect(t.duration - t.crownOpensAt).toBe(60);
      expect(t.duration % 5).toBe(0);
      prev = t;
    }
  });

  it('gives each rival its rank timing for quick battles', () => {
    expect(RIVALS.bumble.timing).toEqual(TIMING_FIRST);
    expect(RIVALS.mora.timing).toEqual(TIMING_BOSS);
  });
});
