// Utility scoring over intents (Mark/Dill, design/research/fun-ai.md §1): each candidate's score
// is a product of considerations shaped by response curves and scaled by the personality row.
// A consideration of 0 is a veto. The current intent gets an inertia bonus; the pick is
// weighted-random between the top two when they are close, so the same board does not always
// give the same move.
import { swarmCap, tuning } from '../sim';
import type { Building, Hero, Team, World } from '../sim';
import type { Snapshot } from './perception';
import type { Rng } from './rng';
import type { BotProfile, IntentKind, TacticId } from './types';

export interface Intent {
  kind: IntentKind;
  /** Building index, or -1 (huntKing). */
  target: number;
}

export interface Candidate extends Intent {
  score: number;
  reason: string;
}

/** Everything the brain and the execution layer read for one decision. Rebuilt each tick (cheap). */
export interface Ctx {
  w: World;
  team: Team;
  foeTeam: Team;
  me: Hero;
  view: Snapshot;
  profile: BotProfile;
  tactics: ReadonlySet<TacticId>;
  /** Followers now plus a share of the ones running home: shots available soon. */
  ammo: number;
  followers: number;
  myTotal: number;
  /** Own critters holding in the open or garrisoned (not with the King, not flying). */
  myAway: number;
  cap: number;
  foeAmmo: number;
  /** (ammo + 3) / (foeAmmo + 3): >1 means we out-gun the rival right now. */
  power: number;
  hpFrac: number;
  crownIdx: number;
  ownThrone: number;
  foeThrone: number;
  crownOpen: boolean;
  timeLeft: number;
  ownedMe: number;
  ownedFoe: number;
  /** Distance from our King to the rival King as perceived. */
  foeDist: number;
  /** Own garrison per building (live: our own critters are ours to count). */
  myGarrison: Int32Array;
}

const garrisonScratch = new Int32Array(64);

export function buildCtx(w: World, team: Team, view: Snapshot, profile: BotProfile, tactics: ReadonlySet<TacticId>): Ctx {
  const foeTeam = (1 - team) as Team;
  const me = w.heroes[team];
  let myTotal = 0, myAway = 0, home = 0;
  garrisonScratch.fill(0);
  const cs = w.critters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!c.alive || c.team !== team) continue;
    myTotal++;
    if (c.state === 'home') home++;
    else if (c.state === 'hold') myAway++;
    else if (c.state === 'garrison') {
      myAway++;
      if (c.building >= 0 && c.building < 64) garrisonScratch[c.building]++;
    }
  }
  const followers = me.followers;
  const ammo = followers + 0.6 * home;
  const foeAmmo = view.foe.followers + 0.6 * view.foeSwarm.home;
  let crownIdx = -1, ownedMe = 0, ownedFoe = 0;
  for (let i = 0; i < w.buildings.length; i++) {
    const b = w.buildings[i];
    if (b.kind === 'crown') crownIdx = i;
    const o = view.buildings[i].owner;
    if (o === team) ownedMe++;
    else if (o === foeTeam) ownedFoe++;
  }
  const phase = w.phase;
  return {
    w, team, foeTeam, me, view, profile, tactics,
    ammo, followers, myTotal, myAway,
    cap: swarmCap(w, team),
    foeAmmo,
    power: (ammo + 3) / (foeAmmo + 3),
    hpFrac: me.maxHp > 0 ? me.hp / me.maxHp : 0,
    crownIdx,
    ownThrone: w.thrones[team],
    foeThrone: w.thrones[foeTeam],
    crownOpen: phase === 'crown' || (phase === 'overtime' && w.time >= w.config.crownOpensAt),
    timeLeft: w.config.duration - w.time,
    ownedMe, ownedFoe,
    foeDist: view.foe.alive ? Math.hypot(view.foe.x - me.x, view.foe.y - me.y) : Infinity,
    myGarrison: garrisonScratch,
  };
}

// ---- response curves ----
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 1 at the King's feet, 0.5 at 8 units, 0.25 at 24. */
const nearness = (d: number) => 1 / (1 + d / 8);
/** A rival King this close to one of our buildings threatens it. */
const THREAT_R = 9;

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Closer to the rival Throne than to our own. */
export function inRivalHalf(ctx: Ctx, x: number, y: number): boolean {
  const o = ctx.w.buildings[ctx.ownThrone], f = ctx.w.buildings[ctx.foeThrone];
  return dist(x, y, f.x, f.y) < dist(x, y, o.x, o.y);
}

function holdHalfVeto(ctx: Ctx, x: number, y: number): boolean {
  return ctx.profile.personality.holdHalfUntilCrown && !ctx.crownOpen && inRivalHalf(ctx, x, y);
}

function buildingValue(b: Building, crownOpen: boolean): number {
  switch (b.kind) {
    case 'throne': return 3;
    case 'crown': return crownOpen ? 2 : 1.2;
    case 'tower': return 0.6;
    default: return 1;
  }
}

/** Score every candidate intent. Vetoed candidates are left out. */
export function scoreIntents(ctx: Ctx, current: Intent | null, currentAge: number): Candidate[] {
  const out: Candidate[] = [];
  const { w, team, foeTeam, me, view, profile } = ctx;
  const P = profile.personality;
  const W = P.weights;
  const overtime = w.phase === 'overtime';
  // late in the battle, the building count decides a time-out
  const late = !overtime && ctx.timeLeft < 25;
  const behind = ctx.ownedMe <= ctx.ownedFoe;
  const grabMul = overtime ? 2 : late && behind ? 1.5 : 1;
  const holdMul = late && !behind ? 1.5 : 1;

  for (let i = 0; i < w.buildings.length; i++) {
    const b = w.buildings[i];
    const v = view.buildings[i];
    const d = dist(me.x, me.y, b.x, b.y);
    const foeNear = v.near[foeTeam];
    const foeKingNear = view.foe.alive && dist(view.foe.x, view.foe.y, b.x, b.y) < 6;

    if (v.owner === -1) {
      // the open Crown is TakeCrown's business
      if (b.kind === 'crown' && ctx.crownOpen) continue;
      if (holdHalfVeto(ctx, b.x, b.y)) continue;
      const progress = v.claimant === team ? 1 + v.control / 100 : 1;
      let safety = 1 / (1 + (foeNear / (ctx.ammo * 0.5 + 1)) * (1.5 - P.risk));
      if (foeKingNear && ctx.power < 1) safety *= 0.4 + 0.6 * P.risk;
      const s = W.expand * buildingValue(b, false) * progress * nearness(d) * safety * (ctx.ammo < 2 ? 0.5 : 1) * grabMul;
      out.push({ kind: 'expand', target: i, score: s, reason: foeNear > 0 ? `contested (${foeNear} foes)` : 'unclaimed' });
    } else if (v.owner === team) {
      let threat = foeNear + v.presence[foeTeam] * 0.5;
      // a rival King walking at it with his swarm is a threat before the first bite
      if (view.foe.alive) {
        const dk = dist(view.foe.x, view.foe.y, b.x, b.y);
        if (dk < THREAT_R) threat += (4 + ctx.foeAmmo * 0.5) * (1 - dk / THREAT_R);
      }
      if (threat <= 0) continue;
      const isThrone = b.kind === 'throne';
      const urgency = (1 + (100 - v.control) / 100) * (isThrone && threat >= 3 ? 2 : 1);
      const canWin = clamp01((ctx.ammo + 2) / (foeNear + 2));
      const floor = isThrone ? 0.6 : 0.3; // the Throne is defended even against the odds
      const s = W.defend * buildingValue(b, ctx.crownOpen) * Math.pow(clamp01(threat / 5), 0.6) * urgency
        * nearness(d) * (floor + (1 - floor) * canWin) * holdMul;
      out.push({ kind: 'defend', target: i, score: s, reason: `under attack (${Math.round(threat)})` });
    } else {
      if (b.kind === 'crown' && ctx.crownOpen) continue;
      const isThrone = b.kind === 'throne';
      if (isThrone && !ctx.tactics.has('raidThrone')) continue;
      // a rival whose signature play is the Throne wave only goes there through the play
      if (isThrone && profile.plays.includes('warParty') && !overtime) continue;
      if (holdHalfVeto(ctx, b.x, b.y)) continue;
      if (!overtime && ctx.ammo < P.armyNeed * 0.25) continue; // veto: nothing to raid with
      const guard = foeNear + (foeKingNear ? ctx.foeAmmo * 0.7 + 3 : 0);
      const weakness = 1 / (1 + guard / (ctx.ammo * 0.6 + 1));
      const army = Math.pow(clamp01(ctx.ammo / P.armyNeed), 1.3);
      let s = W.raid * (isThrone ? P.throneValue : buildingValue(b, false)) * weakness * army * nearness(d) * grabMul;
      if (inRivalHalf(ctx, b.x, b.y)) s *= 1 - P.homeBias * 0.7;
      const foeKingFar = !view.foe.alive || dist(view.foe.x, view.foe.y, b.x, b.y) > 12;
      if (ctx.tactics.has('counterRaid') && foeKingFar) s *= 1.6;
      if (isThrone && v.control < 60) s *= 1.5; // already draining: finish it
      out.push({ kind: 'raid', target: i, score: s, reason: guard < 2 ? 'barely guarded' : `guard ${Math.round(guard)}` });
    }
  }

  // HuntKing
  if (ctx.tactics.has('huntKing') && view.foe.alive && !view.foe.invuln && ctx.ammo >= 5 && ctx.foeDist < 16
    && !holdHalfVeto(ctx, view.foe.x, view.foe.y)) {
    const edge = clamp01((ctx.power - 0.7) / 1.3);
    const hurt = 1.5 - view.foe.hp / view.foe.maxHp;
    const s = W.huntKing * P.kingFocus * edge * hurt * nearness(ctx.foeDist) * (0.4 + 0.6 * ctx.hpFrac);
    if (s > 0) out.push({ kind: 'huntKing', target: -1, score: s, reason: hurt > 1 ? 'rival King is hurt' : 'rival King exposed' });
  }

  // TakeCrown
  if (ctx.crownOpen && ctx.crownIdx >= 0) {
    const b = w.buildings[ctx.crownIdx];
    const tOpen = w.time - w.config.crownOpensAt;
    const foeHold = view.crown[foeTeam], myHold = view.crown[team];
    const contest = ctx.tactics.has('crownContest') ? 1.5 : 0.4;
    const urgency = 0.7 + 0.5 * clamp01(tOpen / 15) + contest * clamp01(foeHold / 6) + clamp01(myHold / tuning.match.crownHold);
    const army = Math.max(0.35, clamp01(ctx.ammo / (P.armyNeed * 0.6)));
    const s = W.takeCrown * urgency * army * (0.5 + 0.5 * nearness(dist(me.x, me.y, b.x, b.y))) * (overtime ? 1.5 : 1);
    out.push({ kind: 'takeCrown', target: ctx.crownIdx, score: s, reason: foeHold > 2 ? 'rival is holding it' : 'Crown is open' });
  }

  // Regroup
  {
    const foeClose = view.foe.alive && ctx.foeDist < 7;
    let hurt = ctx.hpFrac < 0.6 ? Math.pow((0.6 - ctx.hpFrac) / 0.6, 1.2) * 1.5 : 0;
    if (foeClose) hurt *= 1.5;
    const dry = ctx.ammo < 3 && ctx.myAway >= 5 ? 0.7 : 0;
    // badly out-gunned: fall back to the Throne (it hatches fastest) instead of feeding the rival
    const weak = ctx.power < 0.5 ? (foeClose ? 0.9 : ctx.power < 0.35 ? 0.5 : 0) : 0;
    const need = Math.max(0.08, hurt, dry, weak);
    const reason = need === hurt ? 'hurt' : need === dry ? 'out of critters' : need === weak ? 'out-gunned' : 'catching breath';
    out.push({ kind: 'regroup', target: ctx.ownThrone, score: W.regroup * need, reason });
  }

  if (current) {
    const k = Math.max(0, 1 - currentAge / 4);
    for (const c of out) if (c.kind === current.kind && c.target === current.target) c.score *= 1 + P.inertia * k;
  }
  return out.filter((c) => c.score > 0 && Number.isFinite(c.score));
}

/** Apply decision noise, then pick: the best, or weighted-random between the top two when the runner-up is within 30%. */
export function choose(cands: Candidate[], rng: Rng, noise: number): Candidate | null {
  if (cands.length === 0) return null;
  if (noise > 0) for (const c of cands) c.score *= Math.max(0.05, 1 + noise * 0.5 * rng.gauss());
  cands.sort((a, b) => b.score - a.score);
  return pickTopTwo(cands, rng);
}

/** Expects candidates sorted by score, best first. */
export function pickTopTwo(sorted: Candidate[], rng: Rng): Candidate {
  const a = sorted[0], b = sorted[1];
  if (!b || b.score < a.score * 0.7) return a;
  return rng.next() * (a.score + b.score) < a.score ? a : b;
}

export function describe(c: Intent, w: World, reason: string): string {
  const t = c.target >= 0 ? ` ${w.buildings[c.target].kind}#${c.target}` : '';
  return `${c.kind}${t}: ${reason}`;
}

export function sameIntent(a: Intent | null, b: Intent | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.target === b.target;
}
