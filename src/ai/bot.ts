// A bot = perception (delayed) -> utility brain (every thinkMs) -> plays (tells) -> motor (inputs).
import { idleInput } from '../sim';
import type { PlayerInput, Team, World } from '../sim';
import { buildCtx, choose, describe, sameIntent, scoreIntents } from './brain';
import type { Intent } from './brain';
import { createGoldenBot } from './golden';
import { Motor } from './motor';
import type { Directive, Rolls } from './motor';
import { Perception } from './perception';
import { Plays } from './plays';
import { mixSeed, Rng } from './rng';
import type { BarkKey, Bot, BotDebug, BotProfile, BotSignal, TacticId } from './types';

/** Barks no more often than this, so bubbles stay readable. */
const BARK_GAP = 3;

export function createBot(team: Team, profile: BotProfile, seed: number): Bot {
  if (profile.script) return createGoldenBot(team, profile, seed);
  return new UtilityBot(team, profile, seed);
}

class UtilityBot implements Bot {
  intent = 'waiting';
  readonly debug: BotDebug = { goalX: null, goalY: null, unstucks: 0, intentKind: 'none' };
  private signals: BotSignal[] = [];
  private rng: Rng;
  private perception: Perception;
  private motor: Motor;
  private plays: Plays;
  private tactics: ReadonlySet<TacticId>;
  private current: Intent | null = null;
  private currentSince = 0;
  private nextThink = 0;
  private lastBark = -1e9;
  private wasAlive = true;
  private rolls: Rolls = { dash: false, dodge: false, ability: false, ult: false, recall: false, kingShot: false };

  constructor(private team: Team, private profile: BotProfile, seed: number) {
    this.rng = new Rng(mixSeed(seed, team, 1));
    const s = profile.skill;
    this.perception = new Perception(team, Math.round((s.reactionMs / 1000) * 60));
    this.motor = new Motor(new Rng(mixSeed(seed, team, 2)), s.buttonGapMs / 1000, (s.aimErrorDeg * Math.PI) / 180, s.leadAim);
    this.plays = new Plays(new Rng(mixSeed(seed, team, 3)), (sig) => this.signals.push(sig));
    this.tactics = new Set(profile.tactics);
  }

  drainSignals(): BotSignal[] {
    const out = this.signals;
    this.signals = [];
    return out;
  }

  think(w: World): PlayerInput {
    const view = this.perception.observe(w);
    const me = w.heroes[this.team];
    if (w.phase === 'over') return idleInput();
    if (!me.alive) {
      if (this.wasAlive) {
        this.plays.abort();
        this.bark(w, 'kingDown', true);
        this.setIntent(w, null, 'fallen');
      }
      this.wasAlive = false;
      this.debug.goalX = this.debug.goalY = null;
      return idleInput();
    }
    if (!this.wasAlive) { this.wasAlive = true; this.nextThink = w.time; this.bark(w, 'respawn', true); }

    const ctx = buildCtx(w, this.team, view, this.profile, this.tactics);
    if (w.time >= this.nextThink) {
      const s = this.profile.skill;
      this.nextThink = w.time + (s.thinkMs / 1000) * this.rng.range(0.8, 1.2);
      const r = this.rolls;
      r.dash = this.rng.chance(s.usesDash);
      r.dodge = this.rng.chance(s.dodges);
      r.ability = this.rng.chance(s.usesAbility);
      r.ult = this.rng.chance(s.usesUltimate);
      r.recall = this.rng.chance(s.recallEfficiency);
      r.kingShot = this.rng.chance(Math.min(1, 0.35 + 0.4 * this.profile.personality.kingFocus));
      if (!this.plays.busy) {
        const cands = scoreIntents(ctx, this.current, w.time - this.currentSince);
        const pick = choose(cands, this.rng, s.decisionNoise);
        if (!this.plays.tryStart(ctx, pick, this.current) && pick) this.setIntent(w, pick, pick.reason);
      }
    }

    let dir: Directive | null = null;
    if (this.plays.busy) {
      dir = this.plays.tick(ctx, this.motor);
      if (dir && !dir.windup) this.setIntent(w, dir.intent, 'committed');
      if (!dir) this.nextThink = w.time; // play over: decide again at once
    }
    if (!dir) {
      const it = this.current ?? { kind: 'regroup', target: ctx.ownThrone };
      dir = { intent: it, windup: false, press: null, fireAt: null, goal: null, allIn: false };
    }
    const inp = this.motor.drive(ctx, dir, this.rolls);
    this.debug.goalX = this.motor.goalX;
    this.debug.goalY = this.motor.goalY;
    this.debug.unstucks = this.motor.unstucks;
    return inp;
  }

  private setIntent(w: World, it: Intent | null, reason: string): void {
    if (sameIntent(it, this.current)) return;
    const kindChanged = !it || !this.current || it.kind !== this.current.kind;
    this.current = it ? { kind: it.kind, target: it.target } : null;
    this.currentSince = w.time;
    this.intent = it ? describe(it, w, reason) : reason;
    this.debug.intentKind = it ? it.kind : 'none';
    if (it && kindChanged) this.bark(w, it.kind, false);
  }

  private bark(w: World, key: BarkKey, force: boolean): void {
    const lines = this.profile.barks[key];
    if (!lines || lines.length === 0) return;
    if (!force && w.time - this.lastBark < BARK_GAP) return;
    this.lastBark = w.time;
    this.signals.push({ kind: 'bark', text: this.rng.pick(lines) });
  }
}
