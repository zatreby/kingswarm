// What-if tuning for balance sweeps: `--tune building.captureRate=10,hero.respawnTime=4` overrides
// numbers in the in-memory tuning object of each worker, for that run only. src/sim/tuning.ts is
// never touched; a result worth keeping becomes a recommendation to the lead.
// Caveat: a few values are folded into module constants when the sim loads (critter radius, steer,
// stunDrag, bite reach) and do not respond to overrides; those paths are refused.
import { tuning } from '../../src/sim';

const FROZEN = ['critter.radius', 'critter.steer', 'critter.stunDrag', 'critter.biteReachPad', 'hero.radius'];

export function parseTune(list: string[] | undefined): [string, number][] {
  return (list ?? []).map((kv) => {
    const eq = kv.indexOf('=');
    if (eq < 0) throw new Error(`--tune expects path=value, got "${kv}"`);
    const v = Number(kv.slice(eq + 1));
    if (!Number.isFinite(v)) throw new Error(`--tune ${kv}: not a number`);
    return [kv.slice(0, eq), v];
  });
}

export function applyTune(pairs: [string, number][]): void {
  for (const [path, v] of pairs) {
    if (FROZEN.includes(path)) throw new Error(`--tune ${path}: folded into a constant at load, cannot override`);
    const keys = path.split('.');
    let o = tuning as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) {
      const next = o[k];
      if (typeof next !== 'object' || next === null) throw new Error(`--tune ${path}: no such group "${k}"`);
      o = next as Record<string, unknown>;
    }
    const last = keys[keys.length - 1];
    if (typeof o[last] !== 'number') throw new Error(`--tune ${path}: not a number field`);
    o[last] = v;
  }
}
