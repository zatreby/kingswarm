// Golden scripted bots (fun-ai.md §5): dumb, fixed behaviours used as regression anchors.
// Idle must lose to everyone, TurtleForever must not stall a match, ThroneRush must not win early,
// CrownCamp must be interruptible, SpamFire must not beat a real rival, Monkey must never break the sim.
import { ARENA_H, ARENA_W, idleInput, tuning } from '../sim';
import type { PlayerInput, Team, World } from '../sim';
import { NavGrid } from './nav';
import { mixSeed, Rng } from './rng';
import type { Bot, BotDebug, BotProfile, BotSignal } from './types';

export function createGoldenBot(team: Team, profile: BotProfile, seed: number): Bot {
  return new GoldenBot(team, profile, seed);
}

class GoldenBot implements Bot {
  readonly debug: BotDebug;
  private rng: Rng;
  private nav: NavGrid | null = null;
  private planAt = -1e9;
  private planX = NaN;
  private planY = NaN;
  private wp = 0;
  private monkey = idleInput();
  private monkeyAt = 0;
  private lastPress = -1e9;

  constructor(private team: Team, private profile: BotProfile, seed: number) {
    this.rng = new Rng(mixSeed(seed, team, 7));
    this.debug = { goalX: null, goalY: null, unstucks: 0, intentKind: profile.script ?? 'idle' };
  }

  get intent(): string {
    return this.profile.script ?? 'idle';
  }

  drainSignals(): BotSignal[] {
    return [];
  }

  think(w: World): PlayerInput {
    const me = w.heroes[this.team];
    const inp = idleInput();
    this.debug.goalX = this.debug.goalY = null;
    if (w.phase === 'over' || !me.alive) return inp;
    if (!this.nav) this.nav = new NavGrid(w);
    const foe = w.heroes[1 - this.team];
    const own = w.buildings[w.thrones[this.team]];
    const theirs = w.buildings[w.thrones[1 - this.team]];
    const crown = w.buildings.find((b) => b.kind === 'crown')!;
    const range = tuning.fire.range;
    const d = (x: number, y: number) => Math.hypot(x - me.x, y - me.y);

    switch (this.profile.script) {
      case 'idle':
        return inp;
      case 'turtleForever': {
        this.walk(w, own.x + (ARENA_W / 2 > own.x ? 1.3 : -1.3), own.y, inp);
        const t = this.nearestFoe(w, own.x, own.y, range);
        if (t) { inp.aimX = t[0]; inp.aimY = t[1]; inp.fire = true; }
        if (w.tick % 480 === 240 && this.press(w)) inp.recall = true;
        return inp;
      }
      case 'throneRush': {
        this.walk(w, theirs.x, theirs.y, inp, 1.3);
        inp.aimX = theirs.x; inp.aimY = theirs.y;
        inp.fire = d(theirs.x, theirs.y) <= range;
        return inp;
      }
      case 'crownCamp': {
        if (w.time < w.config.crownOpensAt) {
          // take the nearest Hut not ours, then wait at the Crown's edge
          let best = crown, bd = Infinity;
          for (const b of w.buildings) {
            if (b.kind !== 'hut' || b.owner === this.team) continue;
            const dd = d(b.x, b.y);
            if (dd < bd && dd < 9) { bd = dd; best = b; }
          }
          this.walk(w, best.x, best.y, inp, 1.2);
        } else this.walk(w, crown.x, crown.y, inp, 1.1);
        const t = this.nearestFoe(w, crown.x, crown.y, 4) ?? this.nearestFoe(w, me.x, me.y, 3);
        if (t) { inp.aimX = t[0]; inp.aimY = t[1]; inp.fire = true; }
        return inp;
      }
      case 'spamFire': {
        this.walk(w, theirs.x, theirs.y, inp, 6);
        const tx = foe.alive ? foe.x : theirs.x, ty = foe.alive ? foe.y : theirs.y;
        inp.aimX = tx; inp.aimY = ty;
        inp.fire = true;
        return inp;
      }
      case 'monkey': {
        if (w.time >= this.monkeyAt) {
          const r = this.rng;
          this.monkeyAt = w.time + r.range(0.05, 0.4);
          const m = this.monkey;
          m.moveX = r.range(-1.5, 1.5);
          m.moveY = r.range(-1.5, 1.5);
          // mostly in the arena, sometimes far outside it or garbage: the sim must shrug it off
          const wild = r.next();
          m.aimX = wild < 0.05 ? NaN : wild < 0.1 ? r.range(-200, 200) : r.range(0, ARENA_W);
          m.aimY = wild < 0.05 ? Infinity : wild < 0.1 ? r.range(-200, 200) : r.range(0, ARENA_H);
          m.fire = r.chance(0.6);
          m.dash = r.chance(0.3);
          m.ability = r.chance(0.3);
          m.ultimate = r.chance(0.2);
          m.recall = r.chance(0.2);
        }
        return { ...this.monkey };
      }
      default:
        return inp;
    }
  }

  private press(w: World): boolean {
    if (w.time - this.lastPress < 0.3) return false;
    this.lastPress = w.time;
    return true;
  }

  private nearestFoe(w: World, x: number, y: number, r: number): [number, number] | null {
    const foe = w.heroes[1 - this.team];
    let best: [number, number] | null = null, bd = r * r;
    if (foe.alive) {
      const dd = (foe.x - x) ** 2 + (foe.y - y) ** 2;
      if (dd <= bd) { bd = dd; best = [foe.x, foe.y]; }
    }
    for (const c of w.critters) {
      if (!c.alive || c.team === this.team || c.state === 'fly') continue;
      const dd = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (dd < bd) { bd = dd; best = [c.x, c.y]; }
    }
    return best;
  }

  /** Walk a planned path to within `stop` of (x, y). */
  private walk(w: World, x: number, y: number, inp: PlayerInput, stop = 0.3): void {
    const me = w.heroes[this.team];
    this.debug.goalX = x; this.debug.goalY = y;
    const toGo = Math.hypot(x - me.x, y - me.y);
    if (toGo <= stop) { this.debug.goalX = me.x; this.debug.goalY = me.y; return; }
    const nav = this.nav!;
    if (w.time - this.planAt > 0.5 || Math.hypot(x - this.planX, y - this.planY) > 1) {
      nav.plan(me.x, me.y, x, y);
      this.planAt = w.time; this.planX = x; this.planY = y; this.wp = 0;
    }
    const p = nav.path;
    while (this.wp * 2 + 2 < p.length && Math.hypot(p[this.wp * 2] - me.x, p[this.wp * 2 + 1] - me.y) < 0.35) this.wp++;
    const tx = this.wp * 2 < p.length ? p[this.wp * 2] : x, ty = this.wp * 2 < p.length ? p[this.wp * 2 + 1] : y;
    const l = Math.hypot(tx - me.x, ty - me.y) || 1;
    inp.moveX = (tx - me.x) / l;
    inp.moveY = (ty - me.y) / l;
  }
}
