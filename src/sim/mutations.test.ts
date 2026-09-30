// The Mutation catalogue (read by the UI) and its wiring into the per-team modifier seam.
import { describe, expect, it } from 'vitest';
import { defaultMods, deriveMods } from './mods';
import { canOffer, MUTATION_BY_ID, MUTATIONS } from './mutations';
import type { MutationId } from './types';

const ALL: MutationId[] = [
  'bombers', 'shockwave', 'scorch',
  'splitters', 'boomtown', 'militia', 'bigLitter', 'brutes',
  'leeches', 'frostbite', 'piercers', 'homing',
  'archerHuts', 'trample', 'royalGuard', 'rapidFire', 'longArm', 'secondWind',
  'chainReaction', 'cryoBombs', 'conscription', 'bloodrage',
];

describe('Mutation catalogue', () => {
  it('lists all 22 Mutations once, in GDD order', () => {
    expect(MUTATIONS.map((m) => m.id)).toEqual(ALL);
    for (const id of ALL) expect(MUTATION_BY_ID[id].id).toBe(id);
  });

  it('gives each a display name, tags and the GDD line', () => {
    for (const m of MUTATIONS) {
      expect(m.name.length).toBeGreaterThan(2);
      expect(m.text.length).toBeGreaterThan(10);
      expect(m.tags.length).toBeGreaterThanOrEqual(1);
      for (const t of m.tags) expect(['boom', 'brood', 'bite', 'king']).toContain(t);
    }
    expect(MUTATION_BY_ID.bombers).toMatchObject({
      name: 'Bombers', tags: ['boom'],
      text: '1 in 4 of your critters hatches as a Bomber: explodes where it lands, big splash, then it is gone.',
    });
    expect(MUTATION_BY_ID.bloodrage).toMatchObject({ name: 'Bloodrage', tags: ['bite', 'king'], text: 'Rampage lasts until you are hit 3 times.' });
  });

  it('marks the four Duos with the two tags they require', () => {
    const duos = MUTATIONS.filter((m) => m.requires.length > 0).map((m) => [m.id, m.requires]);
    expect(duos).toEqual([
      ['chainReaction', ['boom', 'brood']],
      ['cryoBombs', ['boom', 'bite']],
      ['conscription', ['brood', 'king']],
      ['bloodrage', ['bite', 'king']],
    ]);
  });

  it('canOffer: no duplicates; a Duo only once both tags are owned', () => {
    expect(canOffer('bombers', [])).toBe(true);
    expect(canOffer('bombers', ['bombers'])).toBe(false);
    expect(canOffer('chainReaction', [])).toBe(false);
    expect(canOffer('chainReaction', ['bombers'])).toBe(false);
    expect(canOffer('chainReaction', ['bombers', 'splitters'])).toBe(true);
    expect(canOffer('cryoBombs', ['scorch', 'homing'])).toBe(true);
    // a Duo's own tags count toward other Duos
    expect(canOffer('bloodrage', ['cryoBombs', 'trample'])).toBe(true);
  });
});

describe('deriveMods', () => {
  it('is neutral without Mutations', () => {
    expect(deriveMods({ hero: 'brawler', mutations: [] })).toEqual(defaultMods());
  });

  it('every Mutation rewrites something, and only its own team', () => {
    for (const id of ALL) {
      const m = deriveMods({ hero: 'brawler', mutations: [id] });
      expect(m, id).not.toEqual(defaultMods());
    }
  });

  it('ignores a duplicate', () => {
    expect(deriveMods({ hero: 'brawler', mutations: ['rapidFire', 'rapidFire'] }))
      .toEqual(deriveMods({ hero: 'brawler', mutations: ['rapidFire'] }));
  });

  it('keeps hatchMul from the setup', () => {
    expect(deriveMods({ hero: 'brawler', mutations: ['boomtown'], hatchMul: 1.3 }).hatchMul).toBe(1.3);
  });

  it('is plain data', () => {
    const m = deriveMods({ hero: 'brawler', mutations: ALL });
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });
});
