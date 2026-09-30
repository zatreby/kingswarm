// Display text for Mutations and heroes, from design/GDD.md sections 4 and 5, keyed by the sim's ids so
// view models can carry ids only.
// PROPOSED COPY (director review, round 2): lines marked [proposed] replace GDD text that read as "+x%",
// which GDD pillar 3 forbids. They describe behaviour instead. The design lead must confirm and update
// GDD section 4 to match; until then this file and the GDD differ on those lines only.
import type { HeroId, MutationId, MutationTag } from './types';

export interface MutationInfo { name: string; tags: MutationTag[]; text: string }

export const MUTATIONS: Record<MutationId, MutationInfo> = {
  bombers: { name: 'Bombers', tags: ['boom'], text: '1 in 4 of your critters hatches as a Bomber: explodes where it lands, big splash, then it is gone.' },
  shockwave: { name: 'Shockwave', tags: ['boom'], text: 'Every landing knocks enemies away hard and briefly stuns them.' },
  scorch: { name: 'Scorch', tags: ['boom'], text: 'Landings leave a burning patch for 3 s that hurts enemy critters standing in it.' },
  splitters: { name: 'Splitters', tags: ['brood'], text: 'When one of your critters dies it splits into two Runts (1 HP, half bite, cannot split).' },
  boomtown: { name: 'Boomtown', tags: ['brood'], text: 'While you hold fewer buildings than the rival, yours hatch much faster.' }, // [proposed]
  militia: { name: 'Militia', tags: ['brood'], text: 'A building you capture instantly gains 3 free guards; your garrisons bite twice as hard.' },
  bigLitter: { name: 'Big Litter', tags: ['brood'], text: 'Bigger swarm. Start every battle full.' }, // [proposed]
  brutes: { name: 'Brutes', tags: ['brood'], text: 'Your critters are Brutes: bigger, 3× HP, slower, heavy landings; your swarm cap is halved.' },
  leeches: { name: 'Leeches', tags: ['bite'], text: 'Every hit on the rival King heals you.' },
  frostbite: { name: 'Frostbite', tags: ['bite'], text: 'Landings chill: enemies are slowed for 2 s (Kings less so).' },
  piercers: { name: 'Piercers', tags: ['bite'], text: 'Thrown critters fly flat and fast in a line, hitting every enemy along the path instead of arcing.' },
  homing: { name: 'Homing', tags: ['bite'], text: 'Thrown critters curve toward the nearest enemy close to where you aimed.' },
  archerHuts: { name: 'Archer Huts', tags: ['king'], text: 'Your Huts and Throne shoot arrows at enemies near them.' },
  trample: { name: 'Trample', tags: ['king'], text: 'Your dash crushes enemy critters in its path and comes back sooner.' }, // [proposed]
  royalGuard: { name: 'Royal Guard', tags: ['king'], text: '5 Guards never leave your side and are never fired; they intercept attackers.' },
  rapidFire: { name: 'Rapid Fire', tags: ['king'], text: 'Fire in a wide, fast spray.' }, // [proposed]
  longArm: { name: 'Long Arm', tags: ['king'], text: 'Throw much farther, and faster.' }, // [proposed]
  secondWind: { name: 'Second Wind', tags: ['king'], text: 'Once per battle, instead of falling you burst in a shockwave and heal to half.' },
  chainReaction: { name: 'Chain Reaction', tags: ['boom', 'brood'], text: 'Runts explode when they die.' },
  cryoBombs: { name: 'Cryo Bombs', tags: ['boom', 'bite'], text: 'Bomber explosions freeze everything they hit for 1 s.' },
  conscription: { name: 'Conscription', tags: ['brood', 'king'], text: 'When the rival King falls, his nearby critters join you.' },
  bloodrage: { name: 'Bloodrage', tags: ['bite', 'king'], text: 'Rampage lasts until you are hit 3 times.' },
};

export const MUTATION_IDS = Object.keys(MUTATIONS) as MutationId[];

export const TAGS: Record<MutationTag, { name: string; hint: string }> = {
  boom: { name: 'Boom', hint: 'Explosions, area' },
  brood: { name: 'Brood', hint: 'Numbers, economy' },
  bite: { name: 'Bite', hint: 'What a hit does' },
  king: { name: 'King', hint: 'Your hero' },
};

export type AbilityIcon = 'stomp' | 'kingscall' | 'blink' | 'vortex' | 'turret' | 'rampart' | 'dash' | 'recall';

export interface HeroInfo {
  name: string;
  playstyle: string;
  abilities: [{ name: string; text: string; icon: AbilityIcon }, { name: string; text: string; icon: AbilityIcon }];
}

export const HEROES: Record<HeroId, HeroInfo> = {
  brawler: {
    name: 'Brawler', playstyle: 'Dive in and commit.',
    abilities: [
      { name: 'Stomp', text: 'Crush everything around you', icon: 'stomp' },
      { name: 'Kingscall', text: 'Summon a wave of critters, heal', icon: 'kingscall' },
    ],
  },
  blink: {
    name: 'Blink', playstyle: 'Fragile and slippery.',
    abilities: [
      { name: 'Blink', text: 'Teleport with your followers toward the aim', icon: 'blink' },
      { name: 'Vortex', text: 'Drag enemies to a point, stun', icon: 'vortex' },
    ],
  },
  warden: {
    name: 'Warden', playstyle: 'Slow. Holds ground.',
    abilities: [
      { name: 'Turret', text: 'Plant a thorn turret for 12 s', icon: 'turret' },
      { name: 'Rampart', text: 'Shield and heal', icon: 'rampart' },
    ],
  },
};

export const HERO_IDS: HeroId[] = ['brawler', 'blink', 'warden'];
