// Shared by towers and turrets: pick the nearest enemy in range and shoot it.
import { damageCritter, damageHero } from '../combat';
import type { Team, World } from '../types';

export const NONE = -1;
export const HERO = -2;

/** Nearest enemy ground critter id, HERO for the enemy King (if he can be hurt), or NONE. Ties go to the lower id. */
export function nearestEnemy(w: World, team: Team, x: number, y: number, range: number): number {
  let best = NONE;
  let bd = range * range;
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!c.alive || c.team === team || c.state === 'fly') continue;
    const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
    if (d <= bd && (best === NONE || d < bd)) { bd = d; best = i; }
  }
  const e = w.heroes[1 - team];
  if (e.alive && e.invulnT <= 0) {
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d <= bd && (best === NONE || d < bd)) best = HERO;
  }
  return best;
}

export function targetX(w: World, team: Team, target: number): number {
  return target === HERO ? w.heroes[1 - team].x : w.critters[target].x;
}
export function targetY(w: World, team: Team, target: number): number {
  return target === HERO ? w.heroes[1 - team].y : w.critters[target].y;
}

export function shoot(
  w: World, team: Team, from: 'tower' | 'turret' | 'hut', x: number, y: number, target: number, dmg: number,
): void {
  const tx = targetX(w, team, target), ty = targetY(w, team, target);
  w.events.push({ type: 'shot', team, from, x, y, tx, ty });
  if (target === HERO) damageHero(w, w.heroes[1 - team], dmg, team);
  else damageCritter(w, w.critters[target], dmg, team);
}
