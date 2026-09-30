// Every gameplay number. World units and seconds. Derived from the prototype (40 px = 1 unit),
// adjusted for chunkier, fewer critters. Bot sims and playtests tune these; GDD holds intent.
import type { CritterKind } from './types';

/** Per-kind overrides of the base critter (tuning.critter / tuning.fire); unset = base value. */
export interface KindTuning {
  hp?: number;
  speedMul?: number;
  biteInterval?: number;
  landRadius?: number;
  landDamage?: number;
  landHeroDamage?: number;
}

const TUNING = {
  hero: {
    radius: 0.55,
    speed: { brawler: 5.25, blink: 5.9, warden: 4.75 },
    hp: { brawler: 130, blink: 100, warden: 160 },
    /** Seconds from standstill to top speed, and from top speed to standstill. */
    accelTime: 0.1,
    stopTime: 0.08,
    dashSpeed: 22,
    dashTime: 0.16,
    dashCooldown: 2.2,
    regenDelay: 3,
    regenPerSec: 8,
    swingInterval: 0.4,
    swingDamage: 1,
    swingRange: 0.9,
    swingKnock: 4,
    respawnTime: 5,
    respawnInvuln: 1,
    rampageTime: 8,
    rampageSpeedMul: 1.3,
    /** Cooldowns (dash, abilities) recover this many times faster during Rampage. */
    rampageCdMul: 2,
    /** Chilled (Frostbite): Kings slow less than critters. */
    slowSpeedMul: 0.75,
  },
  fire: {
    interval: 0.13,
    perVolley: 3,
    range: 8.25,
    scatter: 0.35,
    flightSpeed: 15.5,
    flightBase: 0.12,
    /** Wait before retrying when a volley finds no followers. */
    emptyWait: 0.4,
    noAmmoEvery: 1,
    landRadius: 0.7,
    landDamage: 2,
    landKnock: 7,
    landHeroRadius: 0.9,
    landHeroDamage: 4,
    holdTime: 2.5,
    /** While an enemy is near, hold time is topped up to at least this. */
    holdRefresh: 1,
  },
  critter: {
    radius: 0.27,
    hp: 3,
    biteDamage: 1,
    biteHeroDamage: 2,
    biteInterval: 0.7,
    /** Extra reach beyond touching (sum of radii). */
    biteReachPad: 0.08,
    speed: { follow: 6.2, home: 6.5, hold: 2.5, garrison: 2.5 },
    /** Aggro radius from the critter; garrison is measured beyond the building radius. */
    aggro: { follow: 1.3, home: 0.9, hold: 2.4, garrison: 1.75 },
    homeArrive: 1.6,
    /** Velocity steering rate, 1/s (prototype: 7). */
    steer: 7,
    /** Soft separation push, 1/s of overlap. */
    separation: 16,
    followOffsetMin: 0.5,
    followOffsetMax: 1.4,
    /** Stunned/flung critters coast; speed falls to 1/stunDrag per second. */
    stunDrag: 100,
    /** Chilled (Frostbite): 40% slower. */
    slowSpeedMul: 0.6,
    /** Stop steering when this close to the target point. */
    arriveEps: 0.08,
  },
  building: {
    radius: { throne: 1.15, hut: 0.85, tower: 0.85, crown: 1.0 },
    /** Capture zone = r + captureMargin. */
    captureMargin: 0.55,
    /** Solid core that Kings and walking critters slide around, as a fraction of r. */
    solidFrac: 0.55,
    kingPresence: 4,
    captureRate: 20,
    presenceBonus: 0.25,
    presenceMaxMul: 3,
    regainRate: 25,
    flipControl: 30,
    hatchInterval: { throne: 1.4, hut: 2.6, crown: 1.6, tower: 0 },
    capBase: 14,
    capPerBuilding: 7,
    frenzyHatchMul: 2,
    towerInterval: 0.6,
    towerRange: 4.0,
    towerCritterDamage: 2,
    towerHeroDamage: 5,
    /** Towers in a map half start owned by that half's team (a defended zone). */
    towersStartOwned: true,
  },
  /** Special critters (Mutations). Brutes: 3x HP, ~25% slower, heavy landings. */
  kinds: {
    bomber: {},
    runt: { hp: 1, biteInterval: 1.4 },
    brute: { hp: 9, speedMul: 0.75, landRadius: 1.0, landDamage: 3, landHeroDamage: 6 },
    guard: { hp: 5 },
  } as Record<Exclude<CritterKind, 'critter'>, KindTuning>,
  /** Mutation numbers; the rules are in mutations.ts (numbers and flags) and mutated.ts (behaviour). */
  mutations: {
    bombers: { every: 4, radius: 1.5, critterDamage: 3, heroDamage: 8 },
    shockwave: { knockMul: 2.5, stun: 0.4 },
    scorch: { radius: 0.9, life: 3, interval: 0.5, damage: 1, maxPerTeam: 24 },
    splitters: { runts: 2, spread: 0.2 },
    boomtown: { hatchMul: 1.6 },
    militia: { guards: 3, garrisonBiteMul: 2 },
    bigLitter: { capAdd: 10 },
    brutes: { capMul: 0.5 },
    leeches: { heal: 2 },
    frostbite: { slowTime: 2 },
    /** Flat flight at `speed`; path hits within pathRadius (critters) or heroReach (King) of the line. */
    piercers: { speed: 26, pathRadius: 0.5, critterDamage: 2, heroDamage: 4, heroReach: 0.9 },
    homing: { radius: 2 },
    archerHuts: { range: 3.2, interval: 0.9, critterDamage: 1, heroDamage: 3 },
    /** reach = King radius + critter radius + bite pad. */
    trample: { damage: 3, reach: 0.9, knock: 4, dashCdMul: 0.6 },
    royalGuard: { count: 5, replaceEvery: 6, aggro: 2.2, offsetMin: 0.55, offsetMax: 0.95 },
    rapidFire: { fireRateMul: 1.6, scatterMul: 1.8 },
    longArm: { rangeMul: 1.4, flightSpeedMul: 1.25 },
    secondWind: { hpFrac: 0.5, radius: 3, stun: 0.8, knock: 10 },
    chainReaction: { radius: 0.9, damage: 2 },
    cryoBombs: { freeze: 1 },
    conscription: { radius: 4 },
    /** Rampage ends after `hits` hits taken, but never before minTime nor after maxTime. */
    bloodrage: { hits: 3, minTime: 8, maxTime: 25 },
  },
  match: {
    startSwarm: 10,
    crownHold: 10,
    crownDecay: 0.5,
  },
  abilities: {
    brawler: {
      stomp: { cd: 4, radius: 2.1, critterDamage: 3, fling: 10, heroDamage: 30, heroPush: 1.25 },
      kingscall: { cd: 22, heal: 40, spawn: 8, spread: 0.8 },
    },
    blink: {
      blink: { cd: 4, range: 5.5 },
      vortex: {
        cd: 18, range: 6, radius: 3.75, critterStun: 1.6, pullFrac: 0.9,
        heroPull: 2.25, heroStun: 1.2, heroDamage: 10, zoneLife: 0.6,
      },
    },
    warden: {
      turret: { cd: 7, range: 4, life: 12, interval: 0.45, reach: 3.75, critterDamage: 1, heroDamage: 4 },
      rampart: { cd: 20, shield: 70, shieldTime: 4, heal: 45 },
    },
  },
};

export type Tuning = typeof TUNING;
export const tuning: Readonly<Tuning> = TUNING;
