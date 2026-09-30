// Execution: turn an intent into one tick of PlayerInput, with human limits. Walks a planned path
// to a sensible stand point, aims with lead and error, keeps fire discipline, dashes and uses the
// hero's Ability/Ultimate when the moment calls for it, and never presses buttons faster than a
// person can. The unstuck rule re-reads the map and re-picks the stand point if the King stops
// making progress anyway.
import { ARENA_H, ARENA_W, tuning } from '../sim';
import type { PlayerInput, World } from '../sim';
import { dist } from './brain';
import type { Ctx, Intent } from './brain';
import { NavGrid } from './nav';
import { flightTime } from './perception';
import type { Rng } from './rng';

export type Button = 'dash' | 'ability' | 'ultimate' | 'recall';

export interface Directive {
  intent: Intent;
  /** Tell wind-up: stand, hold offensive fire, press nothing but what the play asks. */
  windup: boolean;
  /** Press this button aimed at (x, y) as soon as the button gap allows. */
  press: { button: Button; x: number; y: number } | null;
  /** Fire at this point instead of the intent's target (a feint's decoy volley). */
  fireAt: { x: number; y: number } | null;
  /** Stand here instead of the intent's stand point. */
  goal: { x: number; y: number } | null;
  /** Never hold a reserve (all-in plays). */
  allIn: boolean;
  /** Just committed to an announced action: no escape dashes or blinks away from it. */
  steady?: boolean;
  /** A play has promised the Ability (Sable's ambush Blink): the motor must not spend it. */
  keepAbility?: boolean;
}

/** Chances resampled at every decision: a person does not use every tool every time. */
export interface Rolls {
  dash: boolean;
  dodge: boolean;
  ability: boolean;
  ult: boolean;
  recall: boolean;
  kingShot: boolean;
}

const R = tuning.fire.range;
const RIM_PAD = 0.15;
const ARRIVE = 0.3;
/** Unstuck: check progress this often; this little movement counts as none. */
const STUCK_EVERY = 0.6;
const STUCK_MOVE = 0.3;
const STUCK_CHECKS = 2;
const REPLAN_EVERY = 0.75;
const RECALL_GAP = 2.5;
/** Critters thrown ahead onto a building we are walking to capture. */
const SEED_GARRISON = 2;
const A = tuning.abilities;

export class Motor {
  nav: NavGrid | null = null;
  unstucks = 0;
  goalX: number | null = null;
  goalY: number | null = null;
  /** Last press time and whether a button was down last tick (edges need a release). */
  lastPress = -1e9;
  lastRecall = -1e9;
  private downLastTick = false;
  // aim error, resampled a few times a second
  private errA = 0;
  private errD = 0;
  private errAt = -1;
  // path following
  private wp = 0;
  private planX = NaN;
  private planY = NaN;
  private planAt = -1e9;
  // unstuck
  private sampleX = 0;
  private sampleY = 0;
  private sampleT = 0;
  private stuckN = 0;
  private detourUntil = -1;
  private detourX = 0;
  private detourY = 0;
  /** Stand points rotate around their building by this after an unstuck. */
  private standTurn = 0;

  constructor(private rng: Rng, private gapS: number, private aimErrRad: number, private leadAim: number) {}

  drive(ctx: Ctx, d: Directive, rolls: Rolls): PlayerInput {
    const { w, me } = ctx;
    if (!this.nav) this.nav = new NavGrid(w);
    const inp: PlayerInput = {
      moveX: 0, moveY: 0, aimX: me.x + me.aimX, aimY: me.y + me.aimY,
      fire: false, dash: false, ability: false, ultimate: false, recall: false,
    };

    // ---- where to stand ----
    let gx: number | null = null, gy = 0;
    if (d.goal) { gx = d.goal.x; gy = d.goal.y; }
    else if (!d.windup) {
      const g = this.standFor(ctx, d.intent);
      if (g) { gx = g[0]; gy = g[1]; }
    }
    this.goalX = gx; this.goalY = gx === null ? null : gy;
    const moving = gx !== null ? this.walk(ctx, gx, gy, inp) : (this.resetStuck(w, me.x, me.y), false);

    // ---- aim and fire ----
    this.aimAndFire(ctx, d, rolls, inp, moving);

    // ---- one button per tick, at human speed ----
    const canPress = !this.downLastTick && w.time - this.lastPress >= this.gapS - 1e-9;
    let pressed = false;
    if (canPress) {
      const p = d.press ?? (d.windup ? null : this.choosePress(ctx, d, rolls, inp));
      if (p) {
        inp[p.button] = true;
        if (p.button === 'dash') {
          inp.moveX = p.x; inp.moveY = p.y; // dash direction is the move vector
        } else if (p.button !== 'recall') {
          inp.aimX = p.x; inp.aimY = p.y;
          inp.fire = false; // the aim is spent on the ability this tick
        }
        if (p.button === 'recall') this.lastRecall = w.time;
        this.lastPress = w.time;
        pressed = true;
      }
    }
    this.downLastTick = pressed;
    return inp;
  }

  // ---------------------------------------------------------------- movement

  private rim(ctx: Ctx, bi: number): number {
    const b = ctx.w.buildings[bi];
    return b.r * tuning.building.solidFrac + tuning.hero.radius + RIM_PAD;
  }

  /** The nearest spot to (x, y) where a King can stand, searching outward in rings. */
  freeNear(w: World, x: number, y: number): [number, number] {
    if (!this.nav) this.nav = new NavGrid(w);
    if (this.nav.isFree(x, y)) return [x, y];
    for (let r = 0.25; r <= 3; r += 0.25) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (this.nav.isFree(px, py)) return [px, py];
      }
    }
    return [x, y];
  }

  /** A free point `r` from building bi, as close as possible to the direction of (fx, fy). */
  standNear(ctx: Ctx, bi: number, fx: number, fy: number, r: number): [number, number] {
    const b = ctx.w.buildings[bi];
    const base = Math.atan2(fy - b.y, fx - b.x) + this.standTurn;
    if (!this.nav) this.nav = new NavGrid(ctx.w);
    const nav = this.nav;
    for (let k = 0; k < 12; k++) {
      const off = ((k + 1) >> 1) * (Math.PI / 6) * (k % 2 ? 1 : -1);
      const x = b.x + Math.cos(base + off) * r, y = b.y + Math.sin(base + off) * r;
      if (nav.isFree(x, y)) return [x, y];
    }
    return [b.x + Math.cos(base) * r, b.y + Math.sin(base) * r];
  }

  private standFor(ctx: Ctx, it: Intent): [number, number] | null {
    const { me, view, foeTeam, w } = ctx;
    const P = ctx.profile.personality;
    if (it.kind === 'huntKing') {
      if (!view.foe.alive) return null;
      const d = Math.max(0.01, dist(me.x, me.y, view.foe.x, view.foe.y));
      const keep = ctx.tactics.has('kite') && ctx.power < 1.2 ? 6 : 4.5;
      return [view.foe.x + ((me.x - view.foe.x) / d) * keep, view.foe.y + ((me.y - view.foe.y) / d) * keep];
    }
    if (it.target < 0) return null;
    // kite: out-numbered at close range, back off while firing. Never off a building we must
    // stand on: a King on his Throne (or the Crown) contests it just by being there.
    const holdGround = it.kind === 'defend' || it.kind === 'takeCrown' || it.kind === 'regroup';
    if (ctx.tactics.has('kite') && !holdGround && view.pressing.n > ctx.followers + 3) {
      const d = Math.max(0.01, dist(me.x, me.y, view.pressing.x, view.pressing.y));
      return [me.x + ((me.x - view.pressing.x) / d) * 3, me.y + ((me.y - view.pressing.y) / d) * 3];
    }
    const b = w.buildings[it.target];
    const v = view.buildings[it.target];
    const rim = this.rim(ctx, it.target);
    const foeNear = v.near[foeTeam];
    switch (it.kind) {
      case 'regroup':
        return this.standNear(ctx, it.target, ARENA_W / 2, ARENA_H / 2, rim);
      case 'defend':
        return foeNear > 0 ? this.standNear(ctx, it.target, v.foeX, v.foeY, rim) : this.standNear(ctx, it.target, me.x, me.y, rim);
      case 'expand':
      case 'takeCrown': {
        // hose a crowd off it from throwing distance first, unless we are the crowd
        const standOff = foeNear > 2 && foeNear > ctx.ammo * 0.5 && P.risk < 0.8;
        return this.standNear(ctx, it.target, me.x, me.y, standOff ? 4.5 : rim);
      }
      case 'raid': {
        const foeKingThere = view.foe.alive && dist(view.foe.x, view.foe.y, b.x, b.y) < 4;
        const guarded = foeNear > 1 || foeKingThere;
        return this.standNear(ctx, it.target, me.x, me.y, guarded ? 5.5 : rim);
      }
    }
    return null;
  }

  private resetStuck(w: World, x: number, y: number): void {
    this.sampleX = x; this.sampleY = y; this.sampleT = w.time; this.stuckN = 0;
  }

  /** Follow a planned path to (gx, gy); returns true while actually walking. */
  private walk(ctx: Ctx, gx: number, gy: number, inp: PlayerInput): boolean {
    const { w, me } = ctx;
    const nav = this.nav!;
    const toGoal = dist(me.x, me.y, gx, gy);
    if (toGoal < ARRIVE) { this.resetStuck(w, me.x, me.y); return false; }

    const wants = toGoal > 1 && me.stunT <= 0 && me.dashT <= 0;
    if (!wants) this.resetStuck(w, me.x, me.y);
    else if (w.time - this.sampleT >= STUCK_EVERY) {
      const moved = dist(me.x, me.y, this.sampleX, this.sampleY);
      this.stuckN = moved < STUCK_MOVE ? this.stuckN + 1 : 0;
      this.sampleX = me.x; this.sampleY = me.y; this.sampleT = w.time;
      if (this.stuckN >= STUCK_CHECKS) this.unstick(ctx, gx, gy);
    }

    let tx: number, ty: number;
    if (w.time < this.detourUntil) {
      tx = me.x + this.detourX; ty = me.y + this.detourY;
    } else {
      if (dist(gx, gy, this.planX, this.planY) > 1 || w.time - this.planAt > REPLAN_EVERY) {
        nav.plan(me.x, me.y, gx, gy);
        this.planX = gx; this.planY = gy; this.planAt = w.time; this.wp = 0;
      }
      const p = nav.path;
      while (this.wp * 2 + 2 < p.length && dist(me.x, me.y, p[this.wp * 2], p[this.wp * 2 + 1]) < 0.35) this.wp++;
      if (this.wp * 2 < p.length) { tx = p[this.wp * 2]; ty = p[this.wp * 2 + 1]; }
      else { tx = gx; ty = gy; }
    }
    const dx = tx - me.x, dy = ty - me.y;
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) return false;
    // ease into the final stand point so the King settles instead of orbiting it
    const s = toGoal < 0.6 ? Math.max(0.35, toGoal / 0.6) : 1;
    inp.moveX = (dx / l) * s;
    inp.moveY = (dy / l) * s;
    return true;
  }

  /** No progress while trying to move: re-read the map, turn the stand point, back off a moment. */
  private unstick(ctx: Ctx, gx: number, gy: number): void {
    const { w, me } = ctx;
    this.unstucks++;
    this.stuckN = 0;
    this.nav!.rebuild(w);
    this.standTurn += (this.rng.chance(0.5) ? 1 : -1) * (Math.PI / 3);
    const a = Math.atan2(gy - me.y, gx - me.x) + Math.PI + this.rng.range(-1.2, 1.2);
    this.detourX = Math.cos(a) * 2;
    this.detourY = Math.sin(a) * 2;
    this.detourUntil = w.time + this.rng.range(0.35, 0.7);
    this.planAt = -1e9; // replan after the detour
  }

  // ---------------------------------------------------------------- aim & fire

  /** Where a volley thrown now should go to meet the rival King, as this bot judges it. */
  predictFoe(ctx: Ctx): [number, number] {
    const { view, me, w } = ctx;
    const d = dist(me.x, me.y, view.foe.x, view.foe.y);
    const stale = w.time - view.time;
    const t = (flightTime(Math.min(d, R), w.mods[ctx.team].flightSpeedMul) + stale * 0.5) * this.leadAim;
    return [view.foe.x + view.foe.vx * t, view.foe.y + view.foe.vy * t];
  }

  private aim(ctx: Ctx, tx: number, ty: number, moving: boolean, inp: PlayerInput): void {
    const { w, me } = ctx;
    if (w.time >= this.errAt) {
      this.errA = this.rng.gauss() * this.aimErrRad;
      this.errD = this.rng.gauss() * this.aimErrRad * 0.5;
      this.errAt = w.time + this.rng.range(0.25, 0.45);
    }
    const k = moving ? 1.5 : 1;
    const a = this.errA * k;
    const dx = tx - me.x, dy = ty - me.y;
    const c = Math.cos(a), s = Math.sin(a);
    const sc = 1 + this.errD * k;
    inp.aimX = me.x + (dx * c - dy * s) * sc;
    inp.aimY = me.y + (dx * s + dy * c) * sc;
  }

  private aimAndFire(ctx: Ctx, d: Directive, rolls: Rolls, inp: PlayerInput, moving: boolean): void {
    const { me, view, foeTeam, w } = ctx;
    const it = d.intent;
    const P = ctx.profile.personality;
    const foeOk = view.foe.alive && !view.foe.invuln;
    const reserve = d.allIn || it.kind === 'huntKing' || !(view.foe.alive && ctx.foeDist < 9)
      ? 0 : Math.round((1 - ctx.profile.skill.maxCommit) * 8);
    const canFire = ctx.followers > reserve;

    let tx = NaN, ty = NaN, fire = false;
    const inRange = (x: number, y: number) => dist(me.x, me.y, x, y) <= R + 0.3;

    if (d.fireAt) {
      tx = d.fireAt.x; ty = d.fireAt.y; fire = inRange(tx, ty);
    } else if (d.windup) {
      // hold fire for the announced action; only swat what is biting the King
      if (view.pressing.n >= 3) { tx = view.pressing.x; ty = view.pressing.y; fire = true; }
    } else {
      // 1. the rival King in reach is the best target there is
      if (foeOk && (it.kind === 'huntKing' || rolls.kingShot)) {
        const [px, py] = this.predictFoe(ctx);
        if (inRange(px, py) && (it.kind === 'huntKing' || ctx.followers > 4 + (P.kingFocus < 1 ? 2 : 0))) {
          tx = px; ty = py; fire = true;
        }
      }
      // 2. critters biting the King
      if (!fire && view.pressing.n >= 3) { tx = view.pressing.x; ty = view.pressing.y; fire = true; }
      // 3. the intent's own target
      if (!fire && it.target >= 0) {
        const b = w.buildings[it.target];
        const v = view.buildings[it.target];
        const foeNear = v.near[foeTeam];
        const mine = ctx.myGarrison[it.target];
        switch (it.kind) {
          case 'defend':
          case 'takeCrown':
          case 'expand':
            if (foeNear > 0) { tx = v.foeX; ty = v.foeY; fire = inRange(tx, ty); }
            else if (v.owner !== ctx.team && mine < SEED_GARRISON && dist(me.x, me.y, b.x, b.y) > 3) {
              // seed the capture ring from range (a few only: garrisons stay parked until recalled)
              tx = b.x; ty = b.y; fire = inRange(tx, ty) && ctx.followers > 4;
            }
            break;
          case 'raid':
            if (foeNear > 0 || mine < 6) { tx = b.x; ty = b.y; fire = inRange(tx, ty); }
            break;
          default:
            break;
        }
      }
    }
    if (Number.isNaN(tx)) {
      // nothing to shoot: look where we are going
      if (this.goalX !== null) { tx = this.goalX; ty = this.goalY!; } else { tx = me.x + me.aimX; ty = me.y + me.aimY; }
      fire = false;
    }
    this.aim(ctx, tx, ty, moving, inp);
    inp.fire = fire && canFire;
  }

  // ---------------------------------------------------------------- buttons

  private choosePress(ctx: Ctx, d: Directive, rolls: Rolls, inp: PlayerInput): { button: Button; x: number; y: number } | null {
    const { me, view, w } = ctx;
    const it = d.intent;
    const hpLow = ctx.hpFrac < 0.35;
    const foeNear = view.foe.alive && ctx.foeDist < 6;

    // dodge an incoming volley: sideways, out of the splash
    if (rolls.dodge && me.dashCd <= 0 && view.incoming.n >= 2) {
      const left = view.incoming.t - (w.time - view.time);
      if (left > 0.03 && left < 0.5) {
        const ax = me.x - view.incoming.fromX, ay = me.y - view.incoming.fromY;
        const l = Math.hypot(ax, ay) || 1;
        let px = -ay / l, py = ax / l;
        if (this.goalX !== null && px * (this.goalX - me.x) + py * (this.goalY! - me.y) < 0) { px = -px; py = -py; }
        if (!this.nav!.segmentClear(me.x, me.y, me.x + px * 3, me.y + py * 3)) { px = -px; py = -py; }
        return { button: 'dash', x: px, y: py };
      }
    }

    const hero = this.heroPress(ctx, d, rolls);
    if (hero) return hero;

    // escape / close the gap
    if (rolls.dash && me.dashCd <= 0) {
      if (hpLow && foeNear && !d.steady) {
        const t = w.buildings[ctx.ownThrone];
        const l = Math.hypot(t.x - me.x, t.y - me.y) || 1;
        return { button: 'dash', x: (t.x - me.x) / l, y: (t.y - me.y) / l };
      }
      if (it.kind === 'huntKing' && view.foe.alive && view.foe.hp / view.foe.maxHp < 0.4 && ctx.foeDist > 6.5 && ctx.foeDist < 10) {
        return { button: 'dash', x: (view.foe.x - me.x) / ctx.foeDist, y: (view.foe.y - me.y) / ctx.foeDist };
      }
    }

    // recall a swarm that is scattered and idle
    if (rolls.recall && w.time - this.lastRecall > RECALL_GAP) {
      const capturing = it.target >= 0 && view.buildings[it.target].owner !== ctx.team ? ctx.myGarrison[it.target] : 0;
      const idleAway = ctx.myAway - capturing;
      const want = (it.kind === 'regroup' && ctx.myAway >= 4)
        || (ctx.followers < 3 && idleAway >= Math.max(4, 0.3 * ctx.myTotal));
      if (want) return { button: 'recall', x: me.x, y: me.y };
    }

    // travel dash on a long clear walk
    if (rolls.dash && me.dashCd <= 0 && this.goalX !== null && !foeNear && Math.abs(inp.moveX) + Math.abs(inp.moveY) > 0.5) {
      const toGoal = dist(me.x, me.y, this.goalX, this.goalY!);
      const l = Math.hypot(inp.moveX, inp.moveY);
      const mx = inp.moveX / l, my = inp.moveY / l;
      if (toGoal > 9 && this.nav!.segmentClear(me.x, me.y, me.x + mx * 3.8, me.y + my * 3.8)) {
        return { button: 'dash', x: mx, y: my };
      }
    }
    return null;
  }

  private heroPress(ctx: Ctx, d: Directive, rolls: Rolls): { button: Button; x: number; y: number } | null {
    const { me, view, w } = ctx;
    const it = d.intent;
    const foeOk = view.foe.alive && !view.foe.invuln;
    const ready0 = me.cd[0] <= 0 && rolls.ability && !d.keepAbility;
    const ready1 = me.cd[1] <= 0 && rolls.ult;
    const pressing = view.pressing.n;
    const fighting = pressing > 2 || (view.foe.alive && ctx.foeDist < 8)
      || (it.target >= 0 && view.buildings[it.target].near[ctx.foeTeam] > 2 && dist(me.x, me.y, w.buildings[it.target].x, w.buildings[it.target].y) < 8);

    switch (me.kind) {
      case 'brawler': {
        const s = A.brawler.stomp;
        if (ready0 && (pressing >= 4 || (foeOk && ctx.foeDist < s.radius - 0.2))) return { button: 'ability', x: me.x, y: me.y };
        if (ready1 && ((ctx.hpFrac < 0.5 && fighting) || (ctx.ammo < 3 && fighting))) return { button: 'ultimate', x: me.x, y: me.y };
        return null;
      }
      case 'blink': {
        const b = A.blink;
        if (ready1 && foeOk && ctx.followers >= 4) {
          const [px, py] = this.predictFoe(ctx);
          if (dist(me.x, me.y, px, py) < b.vortex.range - 0.2) return { button: 'ultimate', x: px, y: py };
        }
        if (ready0) {
          if (ctx.hpFrac < 0.35 && view.foe.alive && ctx.foeDist < 6 && !d.steady) {
            const t = w.buildings[ctx.ownThrone];
            const pt = this.blinkPoint(ctx, t.x, t.y);
            if (pt) return { button: 'ability', x: pt[0], y: pt[1] };
          }
          if (it.kind === 'huntKing' && foeOk && ctx.foeDist > 6 && ctx.foeDist < 10 && view.foe.hp / view.foe.maxHp < 0.6) {
            const k = (ctx.foeDist - 4.5) / ctx.foeDist;
            const pt = this.blinkPoint(ctx, me.x + (view.foe.x - me.x) * k, me.y + (view.foe.y - me.y) * k);
            if (pt) return { button: 'ability', x: pt[0], y: pt[1] };
          }
          if (this.goalX !== null && !(view.foe.alive && ctx.foeDist < 7) && dist(me.x, me.y, this.goalX, this.goalY!) > 7) {
            const p = this.nav!.path;
            const wx = this.wp * 2 < p.length ? p[this.wp * 2] : this.goalX, wy = this.wp * 2 < p.length ? p[this.wp * 2 + 1] : this.goalY!;
            const pt = this.blinkPoint(ctx, wx, wy);
            if (pt && dist(pt[0], pt[1], this.goalX, this.goalY!) < dist(me.x, me.y, this.goalX, this.goalY!) - 3) {
              return { button: 'ability', x: pt[0], y: pt[1] };
            }
          }
        }
        return null;
      }
      case 'warden': {
        const t = A.warden.turret;
        if (ready0) {
          let px = NaN, py = NaN;
          if (pressing >= 3) { px = view.pressing.x; py = view.pressing.y; }
          else if (it.target >= 0 && view.buildings[it.target].near[ctx.foeTeam] >= 2) {
            const v = view.buildings[it.target];
            px = v.foeX; py = v.foeY;
          } else if (foeOk && ctx.foeDist < 6) { px = view.foe.x; py = view.foe.y; }
          if (!Number.isNaN(px)) {
            const dd = dist(me.x, me.y, px, py);
            if (dd < t.range + t.reach - 0.5) {
              const k = dd > t.range - 0.3 ? (t.range - 0.3) / dd : 1;
              return { button: 'ability', x: me.x + (px - me.x) * k, y: me.y + (py - me.y) * k };
            }
          }
        }
        if (ready1 && ctx.hpFrac < 0.5 && (fighting || view.incoming.n > 0)) return { button: 'ultimate', x: me.x, y: me.y };
        return null;
      }
    }
    return null;
  }

  /** A free landing spot up to Blink range toward (x, y) with a clear line, or null. */
  blinkPoint(ctx: Ctx, x: number, y: number): [number, number] | null {
    const { me } = ctx;
    const range = A.blink.blink.range - 0.3;
    const d = dist(me.x, me.y, x, y);
    if (d < 1) return null;
    const k = d > range ? range / d : 1;
    const px = me.x + (x - me.x) * k, py = me.y + (y - me.y) * k;
    return this.nav!.isFree(px, py) ? [px, py] : null;
  }
}
