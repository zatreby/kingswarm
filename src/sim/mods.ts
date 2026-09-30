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
  };
}

/**
 * The seam for Mutations: turn a TeamSetup into the numbers systems consult.
 * Mutations are not implemented yet; each one becomes a case here (and, for behaviour
 * that is not a number, a flag on TeamMods read by the owning system).
 */
export function deriveMods(setup: TeamSetup): TeamMods {
  const m = defaultMods();
  m.hatchMul = setup.hatchMul ?? 1;
  return m;
}
