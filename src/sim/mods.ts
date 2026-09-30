import { MUTATION_BY_ID } from './mutations';
import type { TeamMods, TeamSetup } from './types';

export function defaultMods(): TeamMods {
  return {
    hatchMul: 1,
    fireIntervalMul: 1,
    scatterMul: 1,
    throwRangeMul: 1,
    flightSpeedMul: 1,
    capAdd: 0,
    capMul: 1,
    startSwarmAdd: 0,
    critterHpMul: 1,
    critterSpeedMul: 1,
    biteMul: 1,
    garrisonBiteMul: 1,
    landDamageMul: 1,
    landKnockMul: 1,
    landRadiusMul: 1,
    landStun: 0,
    dashCdRate: 1,
    rampageTimeMul: 1,
    bomberEvery: 0,
    brutes: false,
    guardCount: 0,
    startFull: false,
    boomtownMul: 1,
    militiaGuards: 0,
    splitters: false,
    chainReaction: false,
    cryoBombs: false,
    scorch: false,
    frostbite: false,
    leeches: false,
    piercers: false,
    homing: false,
    archerHuts: false,
    trample: false,
    secondWind: false,
    conscription: false,
    bloodrage: false,
  };
}

/**
 * The seam for Mutations: turn a TeamSetup into the plain numbers and flags systems consult.
 * Each Mutation's rewrite is its catalogue entry's `apply` (mutations.ts); duplicates count once.
 */
export function deriveMods(setup: TeamSetup): TeamMods {
  const m = defaultMods();
  m.hatchMul = setup.hatchMul ?? 1;
  const seen = new Set<string>();
  for (const id of setup.mutations) {
    if (seen.has(id)) continue;
    seen.add(id);
    MUTATION_BY_ID[id]?.apply(m);
  }
  return m;
}
