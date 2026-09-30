// Every bot is a data row (GDD §6, fun-ai.md §2 and §4). Rivals: personality + signature play +
// flaw + voice. Proxies: plausible humans of three skill levels, for balance sims. Golden: scripted
// regression anchors. scaleProfile sharpens execution and unlocks tactics with Crown Level; it never
// touches hidden stats (the only stat knob, the economy handicap, exists at level 0 for the first two rivals).
import type { BotPersonality, BotProfile, BotSkill, GoldenScript, IntentKind } from './types';

/** Rookie rival execution (fun-ai.md §4 "Rookie" column). */
const ROOKIE: BotSkill = {
  reactionMs: 700, thinkMs: 900, aimErrorDeg: 10, leadAim: 0.3, tellLeadS: 1.5,
  recallEfficiency: 0.5, usesDash: 0.3, usesAbility: 0.5, usesUltimate: 0.4, dodges: 0,
  maxCommit: 0.7, buttonGapMs: 350, decisionNoise: 0.3,
};

/** Level-8 execution every rival converges to (fun-ai.md §4 "Elite" column). */
const ELITE: BotSkill = {
  reactionMs: 200, thinkMs: 350, aimErrorDeg: 2, leadAim: 0.9, tellLeadS: 0.6,
  recallEfficiency: 0.95, usesDash: 0.8, usesAbility: 0.95, usesUltimate: 0.9, dodges: 0.8,
  maxCommit: 0.85, buttonGapMs: 150, decisionNoise: 0.08,
};

function weights(w: Partial<Record<IntentKind, number>>): Record<IntentKind, number> {
  return { expand: 1, defend: 1, raid: 1, huntKing: 1, takeCrown: 1, regroup: 1, ...w };
}

function personality(p: Partial<BotPersonality> & { weights: Record<IntentKind, number> }): BotPersonality {
  return {
    throneValue: 1.4, armyNeed: 10, risk: 0.5, homeBias: 0.3, kingFocus: 1, inertia: 0.4,
    holdHalfUntilCrown: false, ...p,
  };
}

const rivals: Record<string, BotProfile> = {
  bumble: {
    id: 'bumble', name: 'Bumble the Meek', kind: 'rival', hero: 'brawler', mutations: [],
    personality: personality({
      weights: weights({ expand: 1.3, defend: 0.8, raid: 0.25, huntKing: 0.2, takeCrown: 0.8, regroup: 1 }),
      armyNeed: 14, risk: 0.2, homeBias: 0.5, kingFocus: 0.4, inertia: 0.5, throneValue: 1,
    }),
    skill: { ...ROOKIE, reactionMs: 800, thinkMs: 1100, aimErrorDeg: 12, usesDash: 0.15, recallEfficiency: 0.4 },
    tactics: [],
    levelTactics: [[4, 'raidThrone'], [6, 'huntKing'], [7, 'crownContest']],
    plays: ['hoardPush'],
    levelMutations: ['bigLitter', 'militia'],
    handicapHatchMul: 0.8,
    flaw: 'Predictable and slow: kite, split-fire, take his huts while he hoards.',
    barks: {
      expand: ['Ooh, a hut!', 'Mine now, please?'], defend: ['Hey, stop that!', 'Leave it be!'],
      raid: ['Sorry, sorry!'], regroup: ['Back home, all!', 'Gather round, friends'],
      takeCrown: ['Is it my turn?'], huntKing: ['Tag, you’re it?'],
      tell: ['Almost enough...', 'Here we come!'], kingDown: ['Oof!'], respawn: ['I’m okay!'],
    },
  },
  pip: {
    id: 'pip', name: 'Pip the Tinkerer', kind: 'rival', hero: 'warden', mutations: ['archerHuts'],
    personality: personality({
      weights: weights({ expand: 1, defend: 1.6, raid: 0.5, huntKing: 0.3, takeCrown: 1.4, regroup: 0.8 }),
      armyNeed: 12, risk: 0.3, homeBias: 0.8, kingFocus: 0.6, inertia: 0.5, holdHalfUntilCrown: true,
    }),
    skill: { ...ROOKIE, reactionMs: 650, aimErrorDeg: 8, usesAbility: 0.7 },
    tactics: ['crownContest'],
    levelTactics: [[3, 'raidThrone'], [5, 'kite'], [7, 'huntKing']],
    plays: ['crownPush'],
    levelMutations: ['militia', 'rapidFire'],
    handicapHatchMul: 0.85,
    flaw: 'Never leaves his half early: win the economy, out-range his turret, bait it.',
    barks: {
      expand: ['Measure twice...', 'Claim and fortify'], defend: ['Not my huts!', 'Turret time!'],
      raid: ['Calculated risk.'], regroup: ['Recalibrating.', 'Fall back'],
      takeCrown: ['The Crown, precisely.'], huntKing: ['Target acquired.'],
      tell: ['Lantern’s lit!', 'Phase two!'], kingDown: ['Miscalculated!'], respawn: ['Rebuilding.'],
    },
  },
  brood: {
    id: 'brood', name: 'Mother Brood', kind: 'rival', hero: 'brawler', mutations: ['splitters', 'bigLitter'],
    personality: personality({
      weights: weights({ expand: 1.5, defend: 0.6, raid: 1, huntKing: 0.3, takeCrown: 1, regroup: 0.6 }),
      armyNeed: 10, risk: 0.6, homeBias: 0.2, kingFocus: 0.5, inertia: 0.35,
    }),
    skill: { ...ROOKIE, reactionMs: 600, thinkMs: 800, aimErrorDeg: 9 },
    tactics: ['raidThrone'],
    levelTactics: [[3, 'counterRaid'], [5, 'crownContest'], [7, 'huntKing']],
    plays: ['flood'],
    levelMutations: ['boomtown', 'chainReaction'],
    flaw: 'Spread thin: area damage and a held Well beat her; her King is lightly guarded.',
    barks: {
      expand: ['Go on, darlings!', 'Spread out, sweeties'], defend: ['Hands off my babies!'],
      raid: ['Eat up, little ones!'], regroup: ['Come to mother!', 'Home, children'],
      takeCrown: ['Mother wants it.'], huntKing: ['Smother him!'],
      tell: ['Feeding time!', 'Everywhere at once!'], kingDown: ['My babies!'], respawn: ['Mother’s back!'],
    },
  },
  gorm: {
    id: 'gorm', name: 'Gorm the Glutton', kind: 'rival', hero: 'brawler', mutations: ['brutes'],
    personality: personality({
      weights: weights({ expand: 0.7, defend: 0.1, raid: 1.4, huntKing: 0.9, takeCrown: 0.9, regroup: 0.5 }),
      armyNeed: 8, risk: 0.9, homeBias: 0, kingFocus: 1.2, inertia: 0.4, throneValue: 2.2,
    }),
    skill: { ...ROOKIE, reactionMs: 600, thinkMs: 800, aimErrorDeg: 9, maxCommit: 0.9 },
    tactics: ['raidThrone', 'huntKing'],
    levelTactics: [[3, 'crownContest'], [6, 'counterRaid']],
    plays: ['warParty'],
    levelMutations: ['trample', 'bloodrage'],
    flaw: 'After the wave his base is empty for several seconds: counter-raid.',
    barks: {
      expand: ['More for Gorm!', 'Gorm takes this'], defend: ['Bah. Mine.'],
      raid: ['SMASH IT!', 'Gorm hungry!'], regroup: ['Gorm... eats later.', 'Back, brutes!'],
      takeCrown: ['Shiny hat!'], huntKing: ['Tiny king. Squish!'],
      tell: ['WAAAR!', 'Horn! Horn! Horn!'], kingDown: ['GRAAH!'], respawn: ['Gorm is back!'],
    },
  },
  sable: {
    id: 'sable', name: 'Queen Sable', kind: 'rival', hero: 'blink', mutations: ['homing', 'frostbite'],
    personality: personality({
      weights: weights({ expand: 0.9, defend: 0.7, raid: 0.9, huntKing: 1.5, takeCrown: 1, regroup: 0.7 }),
      armyNeed: 9, risk: 0.6, homeBias: 0.2, kingFocus: 1.5, inertia: 0.3,
    }),
    skill: { ...ROOKIE, reactionMs: 500, thinkMs: 700, aimErrorDeg: 7, leadAim: 0.5, tellLeadS: 1.3, usesAbility: 0.8, dodges: 0.3 },
    tactics: ['huntKing', 'raidThrone'],
    levelTactics: [[3, 'kite'], [5, 'crownContest'], [6, 'counterRaid']],
    plays: ['feint', 'ambush'],
    levelMutations: ['piercers', 'conscription'],
    flaw: 'Splits her swarm, so each half is weak; dodge the ambush and she is exposed.',
    barks: {
      expand: ['How quaint.', 'I’ll have that.'], defend: ['Touch it. I dare.'],
      raid: ['Pardon me.'], regroup: ['A tactical exit.'],
      takeCrown: ['Mine by right.'], huntKing: ['There you are.', 'Hold still, darling'],
      tell: ['Look over there.', 'Peekaboo.'], kingDown: ['Rude!'], respawn: ['Again, then.'],
    },
  },
  mora: {
    id: 'mora', name: 'King Mora the Crowned', kind: 'rival', hero: 'warden', mutations: ['royalGuard', 'bombers', 'secondWind'],
    personality: personality({
      weights: weights({ expand: 1, defend: 1.5, raid: 0.7, huntKing: 0.6, takeCrown: 2, regroup: 0.7 }),
      armyNeed: 12, risk: 0.5, homeBias: 0.7, kingFocus: 1, inertia: 0.5, holdHalfUntilCrown: true,
    }),
    skill: {
      ...ROOKIE, reactionMs: 450, thinkMs: 600, aimErrorDeg: 6, leadAim: 0.6, tellLeadS: 1.1,
      recallEfficiency: 0.7, usesDash: 0.5, usesAbility: 0.8, usesUltimate: 0.7, dodges: 0.3, buttonGapMs: 250, decisionNoise: 0.2,
    },
    tactics: ['raidThrone', 'crownContest', 'kite'],
    levelTactics: [[2, 'huntKing'], [4, 'counterRaid']],
    plays: ['crownPush'],
    levelMutations: ['shockwave', 'longArm'],
    flaw: 'Second Wind is one-time; break the Guard first; two lives of pressure.',
    barks: {
      expand: ['All lands kneel.', 'Mine, of course.'], defend: ['You dare?'],
      raid: ['Take it.'], regroup: ['To me, Guard!'],
      takeCrown: ['The Crown is mine!'], huntKing: ['Kneel.'],
      tell: ['The sky darkens.', 'Sound the horn!'], kingDown: ['Impossible!'], respawn: ['I endure.'],
    },
  },
};

const proxies: Record<string, BotProfile> = {
  novice: {
    id: 'novice', name: 'Novice', kind: 'proxy', hero: 'brawler', mutations: [],
    personality: personality({
      weights: weights({ expand: 1.2, defend: 0.8, raid: 0.8, huntKing: 0.6, takeCrown: 1, regroup: 0.4 }),
      armyNeed: 6, risk: 0.7, homeBias: 0.1, kingFocus: 1, inertia: 0.2, throneValue: 1,
    }),
    skill: {
      reactionMs: 650, thinkMs: 1000, aimErrorDeg: 14, leadAim: 0.1, tellLeadS: 0,
      recallEfficiency: 0.15, usesDash: 0.1, usesAbility: 0.25, usesUltimate: 0.1, dodges: 0,
      maxCommit: 1, buttonGapMs: 400, decisionNoise: 0.45,
    },
    tactics: ['huntKing', 'raidThrone'], plays: [], barks: {},
    flaw: 'Slow, sprays, forgets recall and abilities, chases the King.',
  },
  average: {
    id: 'average', name: 'Average', kind: 'proxy', hero: 'brawler', mutations: [],
    personality: personality({ weights: weights({}), armyNeed: 9, risk: 0.5, homeBias: 0.3 }),
    skill: {
      reactionMs: 400, thinkMs: 600, aimErrorDeg: 7, leadAim: 0.5, tellLeadS: 0,
      recallEfficiency: 0.5, usesDash: 0.4, usesAbility: 0.6, usesUltimate: 0.5, dodges: 0.2,
      maxCommit: 0.85, buttonGapMs: 250, decisionNoise: 0.25,
    },
    tactics: ['raidThrone', 'huntKing', 'crownContest'], plays: [], barks: {},
    flaw: 'Decent at everything, great at nothing.',
  },
  expert: {
    id: 'expert', name: 'Expert', kind: 'proxy', hero: 'brawler', mutations: [],
    personality: personality({ weights: weights({ raid: 1.15, takeCrown: 1.2 }), armyNeed: 9, risk: 0.55, homeBias: 0.25, inertia: 0.35 }),
    skill: {
      reactionMs: 220, thinkMs: 350, aimErrorDeg: 3, leadAim: 0.9, tellLeadS: 0,
      recallEfficiency: 0.9, usesDash: 0.8, usesAbility: 0.95, usesUltimate: 0.9, dodges: 0.7,
      maxCommit: 0.75, buttonGapMs: 140, decisionNoise: 0.1,
    },
    tactics: ['raidThrone', 'huntKing', 'kite', 'counterRaid', 'crownContest'], plays: [], barks: {},
    flaw: 'None worth naming.',
  },
};

function golden(script: GoldenScript): BotProfile {
  return {
    id: script, name: script, kind: 'golden', hero: 'brawler', mutations: [],
    personality: personality({ weights: weights({}) }),
    skill: { ...ROOKIE, tellLeadS: 0 },
    tactics: [], plays: [], barks: {}, flaw: 'scripted', script,
  };
}

const goldens: Record<string, BotProfile> = Object.fromEntries(
  (['idle', 'turtleForever', 'throneRush', 'crownCamp', 'spamFire', 'monkey'] as GoldenScript[]).map((s) => [s, golden(s)]),
);

export const RIVALS = ['bumble', 'pip', 'brood', 'gorm', 'sable', 'mora'] as const;
export const PROXIES = ['novice', 'average', 'expert'] as const;
export const GOLDEN = Object.keys(goldens) as GoldenScript[];
export const PROFILES: Record<string, BotProfile> = { ...rivals, ...proxies, ...goldens };

export const MAX_LEVEL = 8;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Move toward the elite value but never away from it (a rival already sharper than elite stays sharp). */
function sharpen(base: number, elite: number, t: number): number {
  const v = lerp(base, elite, t);
  return elite < base ? Math.max(elite, Math.min(base, v)) : Math.min(elite, Math.max(base, v));
}

/**
 * A rival at Crown Level `level` (0..8): execution errors shrink toward ELITE, tell lead shortens,
 * tactics unlock (levelTactics), and it gains its level Mutations (at 3 and 6; shown on the rival card).
 * Proxies and golden bots are returned unchanged.
 */
export function scaleProfile(p: BotProfile, level: number): BotProfile {
  if (p.kind !== 'rival') return p;
  const lv = Math.max(0, Math.min(MAX_LEVEL, Math.round(level)));
  const t = lv / MAX_LEVEL;
  const s = p.skill;
  const skill: BotSkill = {} as BotSkill;
  for (const k of Object.keys(s) as (keyof BotSkill)[]) skill[k] = sharpen(s[k], ELITE[k], t);
  const tactics = [...p.tactics];
  for (const [at, tac] of p.levelTactics ?? []) if (lv >= at && !tactics.includes(tac)) tactics.push(tac);
  const mutations = [...p.mutations];
  const extra = p.levelMutations ?? [];
  if (lv >= 3 && extra[0]) mutations.push(extra[0]);
  if (lv >= 6 && extra[1]) mutations.push(extra[1]);
  return {
    ...p,
    skill,
    tactics,
    mutations,
    handicapHatchMul: lv === 0 ? p.handicapHatchMul : undefined,
  };
}

/** Look up a profile by id and scale it. Throws on an unknown id (typo guard for the harness). */
export function profileFor(id: string, level = 0): BotProfile {
  const p = PROFILES[id];
  if (!p) throw new Error(`unknown bot profile "${id}" (know: ${Object.keys(PROFILES).join(', ')})`);
  return scaleProfile(p, level);
}
