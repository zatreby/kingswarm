// Signature plays (GDD §6) and the tell rule: a play decides, announces itself with a tell
// `lead` seconds ahead, winds up (stands, holds fire), and only then commits. A tell never lies:
// the announced action starts at commit time and cannot be pre-empted by the utility brain.
// Rivals also announce the two most consequential ordinary choices: a raid on the Throne and a
// move on the open Crown.
import { tuning } from '../sim';
import { dist, inRivalHalf } from './brain';
import type { Candidate, Ctx, Intent } from './brain';
import type { Directive, Motor } from './motor';
import type { Rng } from './rng';
import type { BotSignal, PlayId, TellKind } from './types';

type ActiveId = PlayId | 'throneRaid' | 'crownGo';

interface Active {
  id: ActiveId;
  tell: TellKind;
  x: number; y: number;
  lead: number;
  phase: 'feint' | 'announce' | 'commit' | 'after';
  /** Start of the current phase. */
  t0: number;
  intent: Intent;
  /** Commit: hard end. */
  endAt: number;
  allIn: boolean;
  /** Flood: the huts to hose, and which one is current. */
  targets: number[];
  k: number;
  kSince: number;
  decoyX: number; decoyY: number;
  blinked: boolean;
}

const ARMY_MIN = 12;
/** Bumble pushes once his blob is this big even if the cap has grown past it. */
const HOARD_BLOB = 22;
/** Gorm's first wave, seconds into the battle (GDD: ~0:35-0:50); earlier at high Crown Levels. */
const WAR_PARTY_FROM = 32;
/** Gorm's empty-base window after a wave (his flaw). */
const AFTER_WAVE = 6;
const AMBUSH_OFFSET = 2.2;
const FEINT_TIME = 1.0;
/** After committing, no escapes and no abandoning for this long (the tell's honesty window is lead + 1 s). */
const COMMIT_HOLD = 1.5;

export class Plays {
  active: Active | null = null;
  private readyAt = 0;
  private crownDone = false;

  constructor(private rng: Rng, private emit: (s: BotSignal) => void, private motor: Motor) {}

  get busy(): boolean {
    return this.active !== null;
  }

  /** The King fell: whatever was announced is off (the one exception to the tell rule). */
  abort(): void {
    this.active = null;
  }

  /**
   * At a decision: maybe start a play instead of adopting `chosen`. Returns true if one started.
   * Signature plays come first; then the generic announcements of Throne raids and Crown moves.
   */
  tryStart(ctx: Ctx, chosen: Candidate | null, current: Intent | null): boolean {
    const { w, me, profile } = ctx;
    const lead = profile.skill.tellLeadS;
    if (lead <= 0 || w.time < this.readyAt) return false;
    const plays = profile.plays;
    const t = w.time;

    if (plays.includes('crownPush') && !this.crownDone && ctx.crownIdx >= 0
      && (ctx.crownOpen || t >= w.config.crownOpensAt - lead - 0.2)) {
      const c = w.buildings[ctx.crownIdx];
      this.crownDone = true;
      return this.start(ctx, 'crownPush', 'crownPush', c.x, c.y, { kind: 'takeCrown', target: ctx.crownIdx }, 1e9, true);
    }

    // a small cap (Brutes halve it) must not lock a play out forever
    const army = Math.min(ARMY_MIN, 0.8 * ctx.cap);
    // sharper rivals (shorter tells) start the first wave earlier: 32 s at Rookie, 20 s at Elite
    const waveFrom = WAR_PARTY_FROM - 12 * Math.max(0, Math.min(1, (1.5 - lead) / 0.9));
    if (plays.includes('warParty') && t >= waveFrom && ctx.ammo >= Math.max(army, 0.6 * ctx.cap)) {
      const th = w.buildings[ctx.foeThrone];
      return this.start(ctx, 'warParty', 'raid', th.x, th.y, { kind: 'raid', target: ctx.foeThrone }, 25, true);
    }

    // "full" = near the cap, or a blob big enough to read as one (the cap keeps growing with huts)
    if (plays.includes('hoardPush') && ctx.ammo >= Math.max(army, Math.min(0.85 * ctx.cap, HOARD_BLOB))) {
      const target = this.pushTarget(ctx);
      if (target >= 0) {
        const b = w.buildings[target];
        const kind = ctx.view.buildings[target].owner === -1 ? 'expand' : 'raid';
        return this.start(ctx, 'hoardPush', 'hoard', b.x, b.y, { kind, target }, 25, true);
      }
    }

    if (plays.includes('flood') && ctx.ammo >= army) {
      const huts: number[] = [];
      for (let i = 0; i < w.buildings.length; i++) {
        const b = w.buildings[i];
        if (b.kind !== 'hut' || ctx.view.buildings[i].owner === ctx.team) continue;
        if (dist(me.x, me.y, b.x, b.y) > 11) continue;
        if (profile.personality.holdHalfUntilCrown && !ctx.crownOpen && inRivalHalf(ctx, b.x, b.y)) continue;
        huts.push(i);
      }
      if (huts.length >= 2) {
        huts.sort((a, b) => dist(me.x, me.y, w.buildings[a].x, w.buildings[a].y) - dist(me.x, me.y, w.buildings[b].x, w.buildings[b].y));
        huts.length = Math.min(3, huts.length);
        const b = w.buildings[huts[0]];
        const kind = ctx.view.buildings[huts[0]].owner === -1 ? 'expand' : 'raid';
        const ok = this.start(ctx, 'flood', 'push', b.x, b.y, { kind, target: huts[0] }, 15, true);
        if (ok && this.active) this.active.targets = huts;
        return ok;
      }
    }

    if (plays.includes('ambush') && me.kind === 'blink' && this.tryAmbush(ctx)) return true;

    // generic announcements of consequential choices
    if (chosen && !(current && current.kind === chosen.kind && current.target === chosen.target)) {
      const b = chosen.target >= 0 ? w.buildings[chosen.target] : null;
      if (chosen.kind === 'raid' && chosen.target === ctx.foeThrone && b) {
        return this.start(ctx, 'throneRaid', 'raid', b.x, b.y, chosen, 2.5, false);
      }
      if (chosen.kind === 'takeCrown' && b) {
        return this.start(ctx, 'crownGo', 'crownPush', b.x, b.y, chosen, 2.5, false);
      }
    }
    return false;
  }

  private pushTarget(ctx: Ctx): number {
    const { w, me, team } = ctx;
    let best = -1, bd = Infinity;
    // nearest rival Hut, else nearest neutral Hut, else the Throne if allowed
    for (const pass of [0, 1]) {
      for (let i = 0; i < w.buildings.length; i++) {
        const b = w.buildings[i];
        const o = ctx.view.buildings[i].owner;
        if (b.kind !== 'hut' || o === team || (pass === 0 ? o === -1 : o !== -1)) continue;
        const d = dist(me.x, me.y, b.x, b.y);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) return best;
    }
    return ctx.tactics.has('raidThrone') ? ctx.foeThrone : -1;
  }

  private tryAmbush(ctx: Ctx): boolean {
    const { me, view, w, profile } = ctx;
    const lead = profile.skill.tellLeadS;
    if (!view.foe.alive || view.foe.invuln || ctx.ammo < 5 || me.cd[0] > lead) return false;
    if (ctx.foeDist > 9.5 || ctx.foeDist < 3.5) return false;
    const k = AMBUSH_OFFSET / ctx.foeDist;
    const px = view.foe.x + (me.x - view.foe.x) * k, py = view.foe.y + (me.y - view.foe.y) * k;
    const feint = profile.plays.includes('feint');
    // the mark must be where she will really land: free ground within Blink range of where she stands
    if (!feint && dist(me.x, me.y, px, py) > tuning.abilities.blink.blink.range - 0.5) return false;
    const ok = this.start(ctx, 'ambush', 'ambush', px, py, { kind: 'huntKing', target: -1 }, 3, true, feint);
    if (ok && this.active && feint) {
      // decoy: the Hut farthest from the rival King among those in throwing range
      let bi = -1, bd = -1;
      for (let i = 0; i < w.buildings.length; i++) {
        const b = w.buildings[i];
        if (b.kind !== 'hut' || dist(me.x, me.y, b.x, b.y) > tuning.fire.range) continue;
        const d = dist(view.foe.x, view.foe.y, b.x, b.y);
        if (d > bd) { bd = d; bi = i; }
      }
      if (bi < 0) { this.active.phase = 'announce'; this.announce(ctx); }
      else { this.active.decoyX = w.buildings[bi].x; this.active.decoyY = w.buildings[bi].y; }
    }
    return ok;
  }

  private start(ctx: Ctx, id: ActiveId, tell: TellKind, x: number, y: number, intent: Intent, len: number, allIn: boolean, feint = false): boolean {
    this.active = {
      id, tell, x, y, lead: ctx.profile.skill.tellLeadS,
      phase: feint ? 'feint' : 'announce', t0: ctx.w.time, intent, endAt: len, allIn,
      targets: [], k: 0, kSince: 0, decoyX: 0, decoyY: 0, blinked: false,
    };
    if (!feint) this.announce(ctx);
    return this.active !== null;
  }

  private announce(ctx: Ctx): void {
    const a = this.active!;
    a.phase = 'announce';
    a.t0 = ctx.w.time;
    // a tell never lies: if the Blink cannot be ready when the tell says, do not announce at all
    if (a.id === 'ambush' && ctx.me.cd[0] > a.lead - 0.05) { this.finish(ctx.w.time, 1); return; }
    if (a.id === 'ambush') {
      // fix the mark now, from where she stands (the feint may have moved things)
      const { view, me } = ctx;
      const d = Math.max(0.01, dist(me.x, me.y, view.foe.x, view.foe.y));
      const k = Math.min(1, AMBUSH_OFFSET / d);
      let px = view.foe.x + (me.x - view.foe.x) * k, py = view.foe.y + (me.y - view.foe.y) * k;
      const r = tuning.abilities.blink.blink.range - 0.5;
      const dm = dist(me.x, me.y, px, py);
      if (dm > r) { px = me.x + (px - me.x) * (r / dm); py = me.y + (py - me.y) * (r / dm); }
      // mark only ground she can stand on, or the landing would be pushed off the mark
      [a.x, a.y] = this.motor.freeNear(ctx.w, px, py);
    }
    this.emit({ kind: 'tell', tell: a.tell, x: a.x, y: a.y, lead: a.lead });
    const lines = ctx.profile.barks.tell;
    if (lines && lines.length) this.emit({ kind: 'bark', text: this.rng.pick(lines) });
  }

  /**
   * Every tick while a play runs: advance its phases and return the directive for the motor,
   * or null when the play just ended (the brain decides again).
   */
  tick(ctx: Ctx, motor: Motor): Directive | null {
    const a = this.active;
    if (!a) return null;
    const { w, me } = ctx;
    const t = w.time;
    const base: Directive = {
      intent: a.intent, windup: false, press: null, fireAt: null, goal: null, allIn: a.allIn,
      keepAbility: a.id === 'ambush' && !a.blinked,
    };

    if (a.phase === 'feint') {
      if (t - a.t0 >= FEINT_TIME || ctx.followers < 3) {
        this.announce(ctx);
        if (!this.active) return null; // withdrawn: it could not have come true
        return { ...base, windup: true };
      }
      return { ...base, fireAt: { x: a.decoyX, y: a.decoyY }, goal: { x: me.x, y: me.y } };
    }

    if (a.phase === 'announce') {
      if (t - a.t0 < a.lead) return { ...base, windup: true };
      a.phase = 'commit';
      a.t0 = t;
      a.endAt = t + a.endAt;
    }

    if (a.phase === 'after') {
      if (t >= a.endAt) return this.finish(t, 1);
      return base;
    }

    // ---- commit ----
    const since = t - a.t0;
    // the announced action must visibly start: hold steady (and keep it) through the tell window
    if (since < COMMIT_HOLD) base.steady = true;
    switch (a.id) {
      case 'ambush': {
        if (!a.blinked) {
          if (me.cd[0] > me.cdMax[0] - 0.5) { a.blinked = true; a.endAt = t + 3; break; }
          const d = dist(me.x, me.y, a.x, a.y);
          if (d > tuning.abilities.blink.blink.range - 0.2) return { ...base, goal: { x: a.x, y: a.y } };
          if (since > a.lead + 1.5) return this.finish(t, 2); // could not (stunned the whole time)
          return { ...base, press: { button: 'ability', x: a.x, y: a.y } };
        }
        break;
      }
      case 'flood': {
        const cur = a.targets[a.k];
        if (cur === undefined) return this.finish(t, 4);
        const b = w.buildings[cur];
        if (since > 0.3 && (t - a.kSince > 1.4 || ctx.myGarrison[cur] >= 5)) {
          a.k++;
          a.kSince = t;
          const nxt = a.targets[a.k];
          if (nxt === undefined) return this.finish(t, 4);
          a.intent = { kind: ctx.view.buildings[nxt].owner === -1 ? 'expand' : 'raid', target: nxt };
          return { ...base, intent: a.intent };
        }
        if (a.kSince === 0) a.kSince = t;
        let goal: { x: number; y: number } | null = null;
        if (dist(me.x, me.y, b.x, b.y) > tuning.fire.range - 1) {
          const [gx, gy] = motor.standNear(ctx, cur, me.x, me.y, 4.5);
          goal = { x: gx, y: gy };
        }
        return { ...base, fireAt: { x: b.x, y: b.y }, goal };
      }
      default:
        break;
    }

    // generic end conditions
    const spent = ctx.followers < 2 && ctx.ammo < 3 && since > 4;
    const won = since > COMMIT_HOLD && a.intent.target >= 0 && ctx.view.buildings[a.intent.target].owner === ctx.team && a.intent.kind !== 'takeCrown';
    const beaten = a.intent.kind === 'takeCrown' && since > COMMIT_HOLD && ctx.hpFrac < 0.25 && ctx.view.foe.alive && ctx.foeDist < 6;
    if (t >= a.endAt || spent || won || beaten) {
      if (a.id === 'warParty') {
        // the wave is over: fall back (and leave the base empty for a moment, his flaw)
        a.phase = 'after';
        a.intent = { kind: 'regroup', target: ctx.ownThrone };
        a.endAt = t + AFTER_WAVE;
        return { ...base, intent: a.intent, allIn: false };
      }
      if (a.id === 'crownPush') this.crownDone = !beaten; // a beaten push may come again, with a new tell
      return this.finish(t, a.id === 'throneRaid' || a.id === 'crownGo' ? 0 : 6);
    }
    return base;
  }

  private finish(t: number, cooldown: number): null {
    this.active = null;
    this.readyAt = t + cooldown;
    return null;
  }
}
