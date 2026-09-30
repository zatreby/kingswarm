// Stable 32-bit hash over all gameplay state, for determinism specs and desync checks.
// Floats are hashed by their exact bits. Dead pool slots are skipped (their stale fields are
// overwritten on reuse and never affect play). Cosmetic-only fields (critter tint, turret aim)
// are left out so presentation tweaks cannot fake a desync. Config is static and not hashed.
import type { World } from './types';

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

let h = 0;

function mixU32(v: number): void {
  // FNV-1a over the 4 bytes, folded into murmur-style mixing for spread
  h ^= v;
  h = Math.imul(h, 0x01000193);
  h ^= h >>> 15;
}
function num(v: number): void {
  f64[0] = v === 0 ? 0 : v; // -0 and +0 are the same state
  mixU32(u32[0]);
  mixU32(u32[1]);
}
function bool(v: boolean): void {
  mixU32(v ? 1 : 0);
}
function str(s: string): void {
  mixU32(s.length);
  for (let i = 0; i < s.length; i++) mixU32(s.charCodeAt(i));
}

export function hashWorld(w: World): number {
  h = 0x811c9dc5;
  num(w.tick); num(w.time); mixU32(w.rng >>> 0);
  str(w.phase); num(w.crown[0]); num(w.crown[1]); bool(w.frenzy);
  num(w.winner); str(w.winReason ?? '');

  for (const x of w.heroes) {
    str(x.kind); num(x.team);
    num(x.x); num(x.y); num(x.px); num(x.py); num(x.vx); num(x.vy); num(x.aimX); num(x.aimY);
    num(x.hp); num(x.maxHp); bool(x.alive); num(x.respawnT);
    num(x.dashT); num(x.dashCd); num(x.invulnT); num(x.cd[0]); num(x.cd[1]); num(x.cdMax[0]); num(x.cdMax[1]);
    num(x.stunT); num(x.slowT); num(x.shield); num(x.shieldT); num(x.rampageT); num(x.sinceHurt);
    num(x.followers); num(x.fireCd); num(x.swingCd); num(x.noAmmoT); num(x.kills);
    num(x.rampageHits); num(x.guardT); num(x.sweepKey); num(x.struckBy);
    mixU32(x.spent.length);
    for (const s of x.spent) str(s);
    const p = x.prev;
    bool(p.dash); bool(p.ability); bool(p.ultimate); bool(p.recall); bool(p.fire);
  }

  for (const c of w.critters) {
    if (!c.alive) continue;
    num(c.id); num(c.team); str(c.kind); str(c.state);
    num(c.x); num(c.y); num(c.px); num(c.py); num(c.vx); num(c.vy); num(c.hp);
    num(c.sx); num(c.sy); num(c.tx); num(c.ty); num(c.flightT); num(c.flightDur); bool(c.flat);
    num(c.building); num(c.holdT); num(c.stunT); num(c.slowT); num(c.biteCd); num(c.ox); num(c.oy);
    num(c.sweepKey); num(c.struckBy);
  }

  for (const b of w.buildings) {
    num(b.id); str(b.kind); num(b.x); num(b.y); num(b.r); num(b.owner); num(b.control); num(b.claimant);
    num(b.hatchT); num(b.presence[0]); num(b.presence[1]); num(b.garrison[0]); num(b.garrison[1]); num(b.shotCd);
  }
  mixU32(w.turrets.length);
  for (const t of w.turrets) { num(t.team); num(t.x); num(t.y); num(t.life); num(t.shotCd); }
  mixU32(w.zones.length);
  for (const z of w.zones) { str(z.kind); num(z.team); num(z.x); num(z.y); num(z.r); num(z.life); num(z.maxLife); num(z.pulseT); }
  num(w.born[0]); num(w.born[1]);
  for (const o of w.obstacles) { num(o.x); num(o.y); num(o.r); }
  for (const s of w.stats) {
    num(s.thrown); num(s.crittersKilled); num(s.crittersLost); num(s.captures); num(s.heroKills); num(s.damageToHero);
  }
  // booleans hash as 0/1
  for (const m of w.mods) for (const k of Object.keys(m).sort()) num(+(m as unknown as Record<string, number | boolean>)[k]);
  return h >>> 0;
}
