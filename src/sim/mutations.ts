// The Mutation catalogue: one entry per Mutation, in GDD section 4 order. The UI reads the display
// fields; `apply` is the Mutation's whole numeric/flag effect on its team's TeamMods (derived once
// in createWorld). Behaviour that is not a number lives in a function named after the Mutation:
//   mutated.ts  birth (Bombers, Brutes), bomberBlast (+ Cryo Bombs), dropScorch/burnScorch (Scorch),
//               settleDeaths (Splitters, Chain Reaction), pierce (Piercers), homeIn (Homing),
//               archerShot (Archer Huts), trample (Trample), royalGuard (Royal Guard),
//               militia (Militia), bloodrage (Bloodrage)
//   combat.ts   impactCritter/impactHero (Shockwave, Frostbite, Leeches), leech (Leeches),
//               secondWind (Second Wind), conscription (Conscription)
//   buildings.ts  hatch rate (Boomtown); world.ts start swarm (Big Litter)
import { tuning } from './tuning';
import type { MutationId, MutationTag, TeamMods } from './types';

export interface MutationDef {
  id: MutationId;
  /** Display name. */
  name: string;
  tags: readonly MutationTag[];
  /** Player-facing one-liner, verbatim from the GDD. */
  text: string;
  /** Tags the player must own (one Mutation of each) before this is offered. Empty unless a Duo. */
  requires: readonly MutationTag[];
  /** Rewrite this team's modifiers. */
  apply(m: TeamMods): void;
}

const X = tuning.mutations;

export const MUTATIONS: readonly MutationDef[] = [
  {
    id: 'bombers', name: 'Bombers', tags: ['boom'], requires: [],
    text: '1 in 4 of your critters hatches as a Bomber: explodes where it lands, big splash, then it is gone.',
    apply: (m) => { m.bomberEvery = X.bombers.every; },
  },
  {
    id: 'shockwave', name: 'Shockwave', tags: ['boom'], requires: [],
    text: 'Every landing knocks enemies away hard and briefly stuns them.',
    apply: (m) => { m.landKnockMul *= X.shockwave.knockMul; m.landStun = Math.max(m.landStun, X.shockwave.stun); },
  },
  {
    id: 'scorch', name: 'Scorch', tags: ['boom'], requires: [],
    text: 'Landings leave a burning patch for 3 s that hurts enemy critters standing in it.',
    apply: (m) => { m.scorch = true; },
  },
  {
    id: 'splitters', name: 'Splitters', tags: ['brood'], requires: [],
    text: 'When one of your critters dies it splits into two Runts (1 HP, half bite, cannot split).',
    apply: (m) => { m.splitters = true; },
  },
  {
    id: 'boomtown', name: 'Boomtown', tags: ['brood'], requires: [],
    text: 'Your buildings hatch 60% faster while you hold fewer buildings than the rival.',
    apply: (m) => { m.boomtownMul = X.boomtown.hatchMul; },
  },
  {
    id: 'militia', name: 'Militia', tags: ['brood'], requires: [],
    text: 'A building you capture instantly gains 3 free guards; your garrisons bite twice as hard.',
    apply: (m) => { m.militiaGuards = X.militia.guards; m.garrisonBiteMul *= X.militia.garrisonBiteMul; },
  },
  {
    id: 'bigLitter', name: 'Big Litter', tags: ['brood'], requires: [],
    text: '+10 swarm cap and you start each battle with a full swarm.',
    apply: (m) => { m.capAdd += X.bigLitter.capAdd; m.startFull = true; },
  },
  {
    id: 'brutes', name: 'Brutes', tags: ['brood'], requires: [],
    text: 'Your critters are Brutes: bigger, 3× HP, slower, heavy landings; your swarm cap is halved.',
    // HP, speed and landing live on the 'brute' kind (tuning.kinds.brute)
    apply: (m) => { m.brutes = true; m.capMul *= X.brutes.capMul; },
  },
  {
    id: 'leeches', name: 'Leeches', tags: ['bite'], requires: [],
    text: 'Every hit on the rival King heals you.',
    apply: (m) => { m.leeches = true; },
  },
  {
    id: 'frostbite', name: 'Frostbite', tags: ['bite'], requires: [],
    text: 'Landings chill: enemies are slowed for 2 s (Kings less so).',
    apply: (m) => { m.frostbite = true; },
  },
  {
    id: 'piercers', name: 'Piercers', tags: ['bite'], requires: [],
    text: 'Thrown critters fly flat and fast in a line, hitting every enemy along the path instead of arcing.',
    apply: (m) => { m.piercers = true; },
  },
  {
    id: 'homing', name: 'Homing', tags: ['bite'], requires: [],
    text: 'Thrown critters curve toward the nearest enemy close to where you aimed.',
    apply: (m) => { m.homing = true; },
  },
  {
    id: 'archerHuts', name: 'Archer Huts', tags: ['king'], requires: [],
    text: 'Your Huts and Throne shoot arrows at enemies near them.',
    apply: (m) => { m.archerHuts = true; },
  },
  {
    id: 'trample', name: 'Trample', tags: ['king'], requires: [],
    text: 'Your dash crushes enemy critters in its path and recharges 40% faster.',
    apply: (m) => { m.trample = true; m.dashCdRate /= X.trample.dashCdMul; },
  },
  {
    id: 'royalGuard', name: 'Royal Guard', tags: ['king'], requires: [],
    text: '5 Guards never leave your side and are never fired; they intercept attackers.',
    apply: (m) => { m.guardCount = X.royalGuard.count; },
  },
  {
    id: 'rapidFire', name: 'Rapid Fire', tags: ['king'], requires: [],
    text: 'You fire 60% faster with a wider spread.',
    apply: (m) => { m.fireIntervalMul /= X.rapidFire.fireRateMul; m.scatterMul *= X.rapidFire.scatterMul; },
  },
  {
    id: 'longArm', name: 'Long Arm', tags: ['king'], requires: [],
    text: '+40% throw range and faster flight.',
    apply: (m) => { m.throwRangeMul *= X.longArm.rangeMul; m.flightSpeedMul *= X.longArm.flightSpeedMul; },
  },
  {
    id: 'secondWind', name: 'Second Wind', tags: ['king'], requires: [],
    text: 'Once per battle, instead of falling you burst in a shockwave and heal to half.',
    apply: (m) => { m.secondWind = true; },
  },
  {
    id: 'chainReaction', name: 'Chain Reaction', tags: ['boom', 'brood'], requires: ['boom', 'brood'],
    text: 'Runts explode when they die.',
    apply: (m) => { m.chainReaction = true; },
  },
  {
    id: 'cryoBombs', name: 'Cryo Bombs', tags: ['boom', 'bite'], requires: ['boom', 'bite'],
    text: 'Bomber explosions freeze everything they hit for 1 s.',
    apply: (m) => { m.cryoBombs = true; },
  },
  {
    id: 'conscription', name: 'Conscription', tags: ['brood', 'king'], requires: ['brood', 'king'],
    text: 'When the rival King falls, his nearby critters join you.',
    apply: (m) => { m.conscription = true; },
  },
  {
    id: 'bloodrage', name: 'Bloodrage', tags: ['bite', 'king'], requires: ['bite', 'king'],
    text: 'Rampage lasts until you are hit 3 times.',
    // the timer becomes the cap; bloodrage() in mutated.ts ends it on the third hit
    apply: (m) => { m.bloodrage = true; m.rampageTimeMul *= X.bloodrage.maxTime / tuning.hero.rampageTime; },
  },
];

export const MUTATION_BY_ID = Object.fromEntries(MUTATIONS.map((m) => [m.id, m])) as Record<MutationId, MutationDef>;

/** May `id` be offered to a player who owns `owned`? Never a duplicate; a Duo needs both its tags owned. */
export function canOffer(id: MutationId, owned: readonly MutationId[]): boolean {
  if (owned.includes(id)) return false;
  const need = MUTATION_BY_ID[id].requires;
  return need.every((t) => owned.some((o) => MUTATION_BY_ID[o].tags.includes(t)));
}
