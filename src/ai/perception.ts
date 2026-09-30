// What a bot knows about the rival side: the world as it was `reactionMs` ago (Valve's bots:
// "imperfect knowledge, simulated aiming, reaction times"). Its own King, cooldowns and follower
// count are read live, the way a player reads their own HUD.
// Snapshots are preallocated in a ring and overwritten in place: no allocation per tick.
import { tuning } from '../sim';
import type { Team, World } from '../sim';

/** Enemy ground critters within this of a building count as "near" it. */
export const NEAR_BUILDING = 2.5;
/** Enemy ground critters within this of our King count as pressing him. */
export const NEAR_KING = 3;
/** An enemy volley landing within this of our King is incoming. */
const INCOMING_R = 1.4;
const RING = 64;

export interface BuildingView {
  owner: number;
  control: number;
  claimant: number;
  presence: [number, number];
  garrison: [number, number];
  /** Ground critters per team within r + NEAR_BUILDING. */
  near: [number, number];
  /** Centroid of the enemy (relative to the perceiving bot) critters near it. */
  foeX: number; foeY: number;
}

export interface Snapshot {
  tick: number;
  time: number;
  foe: {
    x: number; y: number; vx: number; vy: number;
    alive: boolean; hp: number; maxHp: number; invuln: boolean;
    followers: number; dashing: boolean;
  };
  /** Rival critters by state. */
  foeSwarm: { total: number; follow: number; home: number; away: number; fly: number };
  buildings: BuildingView[];
  /** Rival flying critters landing near where our King stood; `t` = soonest landing, (fromX, fromY) = thrower. */
  incoming: { n: number; t: number; fromX: number; fromY: number };
  /** Rival ground critters within NEAR_KING of our King, and their centroid. */
  pressing: { n: number; x: number; y: number };
  crown: [number, number];
}

function blankSnapshot(nb: number): Snapshot {
  const buildings: BuildingView[] = [];
  for (let i = 0; i < nb; i++) {
    buildings.push({ owner: -1, control: 0, claimant: -1, presence: [0, 0], garrison: [0, 0], near: [0, 0], foeX: 0, foeY: 0 });
  }
  return {
    tick: -1, time: 0,
    foe: { x: 0, y: 0, vx: 0, vy: 0, alive: false, hp: 0, maxHp: 1, invuln: false, followers: 0, dashing: false },
    foeSwarm: { total: 0, follow: 0, home: 0, away: 0, fly: 0 },
    buildings,
    incoming: { n: 0, t: Infinity, fromX: 0, fromY: 0 },
    pressing: { n: 0, x: 0, y: 0 },
    crown: [0, 0],
  };
}

export class Perception {
  private ring: Snapshot[] = [];
  private head = -1;
  private count = 0;

  constructor(private team: Team, private delayTicks: number) {}

  /** Capture this tick's world, then return the snapshot `delayTicks` old (or the oldest there is). */
  observe(w: World): Snapshot {
    if (this.ring.length === 0) {
      for (let i = 0; i < RING; i++) this.ring.push(blankSnapshot(w.buildings.length));
    }
    if (this.head < 0 || this.ring[this.head].tick !== w.tick) {
      this.head = (this.head + 1) % RING;
      if (this.count < RING) this.count++;
      capture(w, this.team, this.ring[this.head]);
    }
    const back = this.delayTicks < this.count ? this.delayTicks : this.count - 1;
    return this.ring[(this.head - back + RING) % RING];
  }
}

function capture(w: World, team: Team, s: Snapshot): void {
  const foeTeam = 1 - team;
  const me = w.heroes[team];
  const f = w.heroes[foeTeam];
  s.tick = w.tick;
  s.time = w.time;
  s.foe.x = f.x; s.foe.y = f.y; s.foe.vx = f.vx; s.foe.vy = f.vy;
  s.foe.alive = f.alive; s.foe.hp = f.hp; s.foe.maxHp = f.maxHp;
  s.foe.invuln = f.invulnT > 0; s.foe.followers = f.followers; s.foe.dashing = f.dashT > 0;
  s.crown[0] = w.crown[0]; s.crown[1] = w.crown[1];

  const bs = w.buildings;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i], v = s.buildings[i];
    v.owner = b.owner; v.control = b.control; v.claimant = b.claimant;
    v.presence[0] = b.presence[0]; v.presence[1] = b.presence[1];
    v.garrison[0] = b.garrison[0]; v.garrison[1] = b.garrison[1];
    v.near[0] = v.near[1] = 0;
    v.foeX = v.foeY = 0;
  }

  const sw = s.foeSwarm;
  sw.total = sw.follow = sw.home = sw.away = sw.fly = 0;
  const inc = s.incoming;
  inc.n = 0; inc.t = Infinity; inc.fromX = f.x; inc.fromY = f.y;
  const pr = s.pressing;
  pr.n = 0; pr.x = 0; pr.y = 0;
  const ir2 = INCOMING_R * INCOMING_R;
  const kr2 = NEAR_KING * NEAR_KING;
  const margin = NEAR_BUILDING;

  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!c.alive) continue;
    const foe = c.team !== team;
    if (foe) {
      sw.total++;
      if (c.state === 'follow') sw.follow++;
      else if (c.state === 'home') sw.home++;
      else if (c.state === 'fly') sw.fly++;
      else sw.away++;
    }
    if (c.state === 'fly') {
      if (foe && me.alive) {
        const dx = c.tx - me.x, dy = c.ty - me.y;
        if (dx * dx + dy * dy <= ir2) {
          inc.n++;
          const left = c.flightDur - c.flightT;
          if (left < inc.t) { inc.t = left; inc.fromX = c.sx; inc.fromY = c.sy; }
        }
      }
      continue;
    }
    for (let j = 0; j < bs.length; j++) {
      const b = bs[j];
      const r = b.r + margin;
      const dx = c.x - b.x, dy = c.y - b.y;
      if (dx * dx + dy * dy > r * r) continue;
      const v = s.buildings[j];
      v.near[c.team]++;
      if (foe) { v.foeX += c.x; v.foeY += c.y; }
    }
    if (foe && me.alive) {
      const dx = c.x - me.x, dy = c.y - me.y;
      if (dx * dx + dy * dy <= kr2) { pr.n++; pr.x += c.x; pr.y += c.y; }
    }
  }
  for (let j = 0; j < bs.length; j++) {
    const v = s.buildings[j];
    const n = v.near[foeTeam];
    if (n > 0) { v.foeX /= n; v.foeY /= n; } else { v.foeX = bs[j].x; v.foeY = bs[j].y; }
  }
  if (pr.n > 0) { pr.x /= pr.n; pr.y /= pr.n; }
}

/** Time a thrown critter takes to cover distance d (same formula as the sim's volley). */
export function flightTime(d: number, flightSpeedMul = 1): number {
  return d / (tuning.fire.flightSpeed * flightSpeedMul) + tuning.fire.flightBase;
}
