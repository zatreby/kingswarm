import { describe, expect, it } from 'vitest';
import { ARENA_W, type SimEvent, type SimEventType } from '../sim/types';
import { tuning } from '../sim/tuning';
import { SOUNDS, type SoundId } from './manifest';
import { cuesFor, RULES, type RuleTable } from './mapping';
import { ARENA_WIDTH, CROWN_HOLD } from './mixer';

/** One sample of every event type. Typed so that a new SimEvent type fails compilation here too. */
const SAMPLES: { [K in SimEventType]: Extract<SimEvent, { type: K }> } = {
  throw: { type: 'throw', team: 0, critter: 1, x: 5, y: 5, tx: 9, ty: 5, count: 3 },
  land: { type: 'land', team: 0, critter: 1, kind: 'critter', x: 9, y: 5, hits: 1, hitHero: false },
  explode: { type: 'explode', team: 0, x: 9, y: 5, r: 1.5, frozen: false },
  critterDied: { type: 'critterDied', team: 1, kind: 'critter', x: 9, y: 5 },
  hatch: { type: 'hatch', team: 0, building: 2, critter: 3 },
  heroHit: { type: 'heroHit', team: 0, by: 1, dmg: 4, x: 5, y: 5, shielded: false },
  heroDown: { type: 'heroDown', team: 1, by: 0, x: 20, y: 9 },
  heroRespawn: { type: 'heroRespawn', team: 1, x: 28, y: 15 },
  rampage: { type: 'rampage', team: 0 },
  dash: { type: 'dash', team: 0, x: 5, y: 5, dx: 1, dy: 0 },
  ability: { type: 'ability', team: 0, hero: 'brawler', slot: 0, x: 5, y: 5, tx: 5, ty: 5, hits: 2 },
  recall: { type: 'recall', team: 0, count: 5, x: 5, y: 5 },
  noAmmo: { type: 'noAmmo', team: 0 },
  capture: { type: 'capture', team: 0, prev: -1, building: 2, kind: 'hut', x: 8, y: 4 },
  shot: { type: 'shot', team: 1, from: 'tower', x: 24, y: 12, tx: 20, ty: 9 },
  turretPlaced: { type: 'turretPlaced', team: 0, x: 7, y: 7 },
  turretExpired: { type: 'turretExpired', team: 0, x: 7, y: 7 },
  secondWind: { type: 'secondWind', team: 1, x: 20, y: 9 },
  spawn: { type: 'spawn', team: 0, critter: 4, kind: 'runt', cause: 'split', x: 9, y: 5 },
  conscript: { type: 'conscript', team: 0, count: 4, x: 20, y: 9 },
  crownOpen: { type: 'crownOpen' },
  overtime: { type: 'overtime' },
  matchEnd: { type: 'matchEnd', winner: 0, reason: 'crown' },
};

const ids = (e: SimEvent, local: 0 | 1 = 0) => cuesFor(e, local).map(c => c.id);

describe('event -> sound mapping', () => {
  it('has a rule for every SimEvent type, and every cue names a real sound', () => {
    expect(Object.keys(RULES).sort()).toEqual(Object.keys(SAMPLES).sort());
    for (const e of Object.values(SAMPLES) as SimEvent[]) {
      for (const local of [0, 1] as const) for (const c of cuesFor(e, local)) expect(SOUNDS, `${e.type} -> ${c.id}`).toHaveProperty(c.id);
    }
  });

  it('fails compilation when an event type has no mapping decision', () => {
    // @ts-expect-error matchEnd (and the rest) missing: RuleTable is exhaustive over SimEventType
    const partial: RuleTable = { throw: RULES.throw };
    expect(partial).toBeDefined();
  });

  it('capture: yours -> capture, theirs -> capture_lost, a throne or the Crown -> bigger', () => {
    const hut = SAMPLES.capture;
    expect(ids(hut, 0)).toEqual(['capture']);
    expect(ids(hut, 1)).toEqual(['capture_lost']);
    const [small] = cuesFor(hut, 0);
    const [big] = cuesFor({ ...hut, kind: 'throne' }, 0);
    expect(big.db!).toBeGreaterThan(small.db ?? 0);
    expect(big.duck).toBe(true);
    // losing your own hut is louder than the rival taking a neutral one
    const [neutral] = cuesFor({ ...hut, team: 1, prev: -1 }, 0);
    const [lost] = cuesFor({ ...hut, team: 1, prev: 0 }, 0);
    expect(lost.db ?? 0).toBeGreaterThan(neutral.db ?? 0);
  });

  it('matchEnd plays the sting for the local outcome', () => {
    expect(ids(SAMPLES.matchEnd, 0)).toEqual(['victory_sting']);
    expect(ids(SAMPLES.matchEnd, 1)).toEqual(['defeat_sting']);
  });

  it('abilities map per hero and slot; the Warden turret sounds once (turretPlaced)', () => {
    const a = SAMPLES.ability;
    const table: [typeof a.hero, 0 | 1, SoundId | null][] = [
      ['brawler', 0, 'stomp'], ['brawler', 1, 'kingscall'], ['blink', 0, 'blink'], ['blink', 1, 'vortex'], ['warden', 0, null], ['warden', 1, 'rampart'],
    ];
    for (const [hero, slot, id] of table) expect(ids({ ...a, hero, slot })).toEqual(id ? [id] : []);
    expect(ids(SAMPLES.turretPlaced)).toEqual(['turret_place']);
  });

  it('small details: no-ammo only for the local player, frozen blast adds the freeze, hits thump', () => {
    expect(ids(SAMPLES.noAmmo, 0)).toEqual(['no_ammo']);
    expect(ids(SAMPLES.noAmmo, 1)).toEqual([]);
    expect(ids({ ...SAMPLES.explode, frozen: true })).toEqual(['explode', 'freeze']);
    expect(ids(SAMPLES.land)).toEqual(['land_hit']);
    expect(ids({ ...SAMPLES.land, hits: 0 })).toEqual(['land_soft']);
    expect(ids({ ...SAMPLES.shot, from: 'turret' })).toEqual(['turret_shot']);
    expect(ids({ ...SAMPLES.heroHit, shielded: true })).toEqual(['rampart']);
  });

  it('critter spam is aggregated; big moments duck', () => {
    for (const t of ['throw', 'land', 'critterDied', 'hatch', 'spawn'] as const) expect(cuesFor(SAMPLES[t], 0)[0].agg).toBeDefined();
    for (const t of ['heroDown', 'capture', 'crownOpen', 'matchEnd'] as const) expect(cuesFor(SAMPLES[t], 0)[0].duck).toBe(true);
  });

  it('every sound id is reachable from some event, the UI or the crown tick (except the ones listed)', () => {
    const used = new Set<string>(['crown_tick', 'ui_click', 'ui_hover', 'ui_confirm', 'ui_back', 'ui_pick', 'ui_error']);
    const variants: SimEvent[] = [
      ...Object.values(SAMPLES) as SimEvent[],
      { ...SAMPLES.land, hits: 0 }, { ...SAMPLES.explode, frozen: true }, { ...SAMPLES.shot, from: 'turret' },
      ...(['brawler', 'blink', 'warden'] as const).flatMap(hero => ([0, 1] as const).map(slot => ({ ...SAMPLES.ability, hero, slot }))),
    ];
    for (const e of variants) for (const local of [0, 1] as const) for (const c of cuesFor(e, local)) used.add(c.id);
    const unused = Object.keys(SOUNDS).filter(id => !used.has(id));
    // bite: the sim has no bite event yet (bites surface only as heroHit / critterDied). Contract request.
    expect(unused).toEqual(['bite']);
  });

  it('mixer constants match the sim contract', () => {
    expect(ARENA_WIDTH).toBe(ARENA_W);
    expect(CROWN_HOLD).toBe(tuning.match.crownHold);
  });
});
