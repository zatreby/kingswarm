// Per-kind critter stats, resolved once from tuning (base critter + tuning.kinds overrides) so hot
// loops do a single property lookup instead of optional chains.
import { tuning } from './tuning';
import type { KindTuning } from './tuning';
import type { CritterKind } from './types';

const KINDS: CritterKind[] = ['critter', 'bomber', 'runt', 'brute', 'guard'];

function table(field: keyof KindTuning, base: number): Record<CritterKind, number> {
  const out = {} as Record<CritterKind, number>;
  for (const k of KINDS) out[k] = (k === 'critter' ? undefined : tuning.kinds[k][field]) ?? base;
  return out;
}

export const KIND_HP = table('hp', tuning.critter.hp);
export const KIND_SPEED = table('speedMul', 1);
export const KIND_BITE_INTERVAL = table('biteInterval', tuning.critter.biteInterval);
export const KIND_LAND_RADIUS = table('landRadius', tuning.fire.landRadius);
export const KIND_LAND_DAMAGE = table('landDamage', tuning.fire.landDamage);
export const KIND_LAND_HERO_DAMAGE = table('landHeroDamage', tuning.fire.landHeroDamage);
