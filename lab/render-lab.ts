// Render lab: hand-built fixture Worlds (no sim dependency) driving the renderer, with a gentle fake
// animation so motion code runs. Scenes: ?scene=opening|midfight|crown|mutants|lineup|stress
// Extras: &focus=kings|critters|buildings (lineup), &cb=1 (colour-blind), &quality=low|medium|high, &info=1.
import * as THREE from 'three';
import { createRenderer } from '../src/render/index';
import type {
  World, Hero, Critter, Building, BuildingKind, CritterKind, CritterState, Team, Owner, Obstacle, TeamMods, HeroId, Phase,
} from '../src/sim/types';
import { MAX_CRITTERS, DT } from '../src/sim/types';

const q = new URLSearchParams(location.search);
const sceneName = q.get('scene') ?? 'midfight';
const focus = q.get('focus') ?? 'kings';

// ------------------------------------------------------------------ fixtures

let seed = 12345;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const RADIUS: Record<BuildingKind, number> = { throne: 1.15, hut: 0.85, tower: 0.85, crown: 1.0 };
const HALF: { kind: Exclude<BuildingKind, 'crown'>; x: number; y: number }[] = [
  { kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 8.5, y: 12 }, { kind: 'hut', x: 4.5, y: 8.5 },
  { kind: 'hut', x: 12, y: 15.5 }, { kind: 'hut', x: 12.5, y: 7 }, { kind: 'hut', x: 8.5, y: 3.8 },
];
const OBST: Obstacle[] = [
  { x: 2.0, y: 11.0, r: 0.9, look: 'trees' }, { x: 6.5, y: 16.5, r: 0.6, look: 'rock' },
  { x: 3.5, y: 3.5, r: 0.9, look: 'pond' }, { x: 13.5, y: 3.0, r: 0.7, look: 'rock' },
];
const mirror = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: 32 - o.x, y: 18 - o.y });

function mods(): TeamMods {
  return {
    hatchMul: 1, fireIntervalMul: 1, scatterMul: 1, throwRangeMul: 1, flightSpeedMul: 1, capAdd: 0, capMul: 1, startSwarmAdd: 0,
    critterHpMul: 1, critterSpeedMul: 1, biteMul: 1, garrisonBiteMul: 1, landDamageMul: 1, landKnockMul: 1, landRadiusMul: 1,
    landStun: 0, dashCdRate: 1, rampageTimeMul: 1,
    bomberEvery: 0, brutes: false, guardCount: 0, startFull: false, boomtownMul: 1, militiaGuards: 0,
    splitters: false, chainReaction: false, cryoBombs: false, scorch: false, frostbite: false, leeches: false, piercers: false,
    homing: false, archerHuts: false, trample: false, secondWind: false, conscription: false, bloodrage: false,
  };
}

function hero(team: Team, kind: HeroId, x: number, y: number, ax: number, ay: number): Hero {
  const l = Math.hypot(ax - x, ay - y) || 1;
  return {
    team, kind, x, y, px: x, py: y, vx: 0, vy: 0, aimX: (ax - x) / l, aimY: (ay - y) / l,
    hp: 130, maxHp: 130, alive: true, respawnT: 0, dashT: 0, dashCd: 0, invulnT: 0, cd: [0, 0], cdMax: [4, 18],
    stunT: 0, slowT: 0, shield: 0, shieldT: 0, rampageT: 0, sinceHurt: 10, followers: 0, fireCd: 0, swingCd: 0, noAmmoT: 0, rampageHits: 0, guardT: 0, sweepKey: -1, struckBy: -1,
    spent: [], prev: { dash: false, ability: false, ultimate: false, recall: false, fire: false }, kills: 0,
  };
}

function deadCritter(id: number): Critter {
  return {
    id, alive: false, team: 0, kind: 'critter', state: 'follow', x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, hp: 3,
    sx: 0, sy: 0, tx: 0, ty: 0, flightT: 0, flightDur: 0, flat: false, sweepKey: -1, struckBy: -1, building: -1, holdT: 0, stunT: 0, slowT: 0, biteCd: 0,
    ox: 0, oy: 0, tint: 0,
  };
}

function building(id: number, kind: BuildingKind, x: number, y: number, owner: Owner, control = owner === -1 ? 0 : 100, claimant: Owner = -1): Building {
  return { id, kind, x, y, r: RADIUS[kind], owner, control, claimant, hatchT: 1, presence: [0, 0], garrison: [0, 0], shotCd: 0 };
}

function world(buildings: Building[], obstacles: Obstacle[], heroes: [Hero, Hero], phase: Phase = 'open'): World {
  const thrones: [number, number] = [0, 0];
  buildings.forEach((b, i) => { if (b.kind === 'throne') thrones[b.x < 16 ? 0 : 1] = i; });
  return {
    tick: 0, time: 0,
    config: {
      seed: 1, map: { id: 'meadow', name: 'Meadow', half: HALF, obstacles: OBST }, duration: 120, crownOpensAt: 60,
      teams: [{ hero: heroes[0].kind, mutations: [] }, { hero: heroes[1].kind, mutations: [] }],
    },
    rng: 1, phase, crown: [0, 0], frenzy: false, winner: -1, winReason: null, heroes,
    critters: Array.from({ length: MAX_CRITTERS }, (_, i) => deadCritter(i)),
    buildings, turrets: [], zones: [], obstacles, thrones, born: [0, 0], events: [],
    stats: [0, 1].map(() => ({ thrown: 0, crittersKilled: 0, crittersLost: 0, captures: 0, heroKills: 0, damageToHero: 0 })) as World['stats'],
    mods: [mods(), mods()],
  };
}

function meadow(owners: Owner[], withTowers = false): Building[] {
  const bs: Building[] = [];
  HALF.forEach((h, i) => bs.push(building(bs.length, h.kind, h.x, h.y, owners[i] ?? -1)));
  HALF.forEach((h, i) => { const m = mirror(h); bs.push(building(bs.length, m.kind, m.x, m.y, owners[6 + i] ?? -1)); });
  bs.push(building(bs.length, 'crown', 16, 9, owners[12] ?? -1));
  if (withTowers) { bs.push(building(bs.length, 'tower', 16.5, 14, 0)); bs.push(building(bs.length, 'tower', 15.5, 4, 1)); }
  return bs;
}
const allObstacles = () => [...OBST, ...OBST.map(mirror)];

/** Fake-animation role for each spawned critter. */
interface Role { kind: 'follow' | 'garrison' | 'fly' | 'hold' | 'home' | 'still'; cx: number; cy: number; ox: number; oy: number; ph: number; speed: number }
const roles: (Role | null)[] = Array(MAX_CRITTERS).fill(null);
let nextSlot = 0;

function spawn(w: World, team: Team, kind: CritterKind, state: CritterState, x: number, y: number, role: Role, extra: Partial<Critter> = {}): Critter {
  const c = w.critters[nextSlot];
  Object.assign(c, { alive: true, team, kind, state, x, y, px: x, py: y, vx: 0, vy: 0, tint: rnd(), ox: role.ox, oy: role.oy }, extra);
  roles[nextSlot] = role;
  nextSlot++;
  return c;
}

function followers(w: World, team: Team, n: number, kinds: CritterKind[] = []) {
  const h = w.heroes[team];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = 0.7 + Math.sqrt(rnd()) * 0.9;
    const ox = Math.cos(a) * d, oy = Math.sin(a) * d;
    spawn(w, team, kinds[i] ?? 'critter', 'follow', h.x + ox, h.y + oy, { kind: 'follow', cx: 0, cy: 0, ox, oy, ph: rnd() * 6.28, speed: 6.2 });
  }
}

function garrison(w: World, bi: number, team: Team, n: number, kinds: CritterKind[] = []) {
  const b = w.buildings[bi];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4, d = b.r + 0.3;
    spawn(w, team, kinds[i] ?? 'critter', 'garrison', b.x + Math.cos(a) * d, b.y + Math.sin(a) * d,
      { kind: 'garrison', cx: b.x, cy: b.y, ox: a, oy: d, ph: rnd() * 6.28, speed: 0.25 }, { building: bi });
    b.garrison[team]++;
    b.presence[team]++;
  }
}

function volley(w: World, team: Team, n: number, fx: number, fy: number, tx: number, ty: number, flat = false) {
  for (let i = 0; i < n; i++) {
    const ex = tx + (rnd() - 0.5) * 1.2, ey = ty + (rnd() - 0.5) * 1.2;
    const dist = Math.hypot(ex - fx, ey - fy), dur = 0.12 + dist / 15.5;
    const u = (i + 0.5) / n;
    spawn(w, team, 'critter', 'fly', fx + (ex - fx) * u, fy + (ey - fy) * u, { kind: 'fly', cx: 0, cy: 0, ox: 0, oy: 0, ph: 0, speed: 0 },
      { sx: fx, sy: fy, tx: ex, ty: ey, flightDur: dur, flightT: u * dur, flat });
  }
}

function brawl(w: World, team: Team, n: number, cx: number, cy: number, kinds: CritterKind[] = []) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 1.3;
    spawn(w, team, kinds[i] ?? 'critter', 'hold', cx + Math.cos(a) * d + (team ? 0.25 : -0.25), cy + Math.sin(a) * d,
      { kind: 'hold', cx: cx + Math.cos(a) * d + (team ? 0.25 : -0.25), cy: cy + Math.sin(a) * d, ox: 0, oy: 0, ph: rnd() * 6.28, speed: 0 }, { holdT: 2 });
  }
}

function runners(w: World, team: Team, n: number, fx: number, fy: number) {
  for (let i = 0; i < n; i++) {
    spawn(w, team, 'critter', 'home', fx + (rnd() - 0.5), fy + (rnd() - 0.5), { kind: 'home', cx: fx, cy: fy, ox: 0, oy: 0, ph: rnd(), speed: 6.5 });
  }
}

// ------------------------------------------------------------------ scenes

interface Scene { w: World; looks: [string, string]; labels?: { x: number; y: number; text: string; h?: number }[]; view?: { x: number; y: number; width: number }; showcase?: { hero: Hero; look: string }[]; heroMotion?: boolean }

function sceneOpening(): Scene {
  const bs = meadow([0, -1, -1, -1, -1, -1, 1]);
  const w = world(bs, allObstacles(), [hero(0, 'brawler', 5.6, 13.1, 16, 9), hero(1, 'warden', 26.4, 4.9, 16, 9)]);
  followers(w, 0, 10); followers(w, 1, 10);
  return { w, looks: ['brawler', 'gorm'] };
}

function sceneMidfight(): Scene {
  // Blue: throne 0, huts 1,2,3 (4). Red: throne 6, huts 7, 10 (3). Hut 4 neutral being claimed by Blue. Crown contested.
  const bs = meadow([0, 0, 0, 0, -1, -1, 1, 1, -1, -1, 1, -1, -1]);
  bs[4].claimant = 0; bs[4].control = 45;
  bs[10].control = 72;
  bs[12].claimant = 1; bs[12].control = 30;
  const w = world(bs, allObstacles(), [hero(0, 'brawler', 14.3, 11.3, 19.5, 11), hero(1, 'blink', 22.2, 7.2, 14.3, 11.3)]);
  w.heroes[0].hp = 86;
  w.heroes[1].hp = 100; w.heroes[1].maxHp = 100;
  followers(w, 0, 16, ['critter', 'runt', 'critter', 'brute', 'critter', 'runt', 'guard', 'critter', 'critter', 'bomber']);
  garrison(w, 0, 0, 4); garrison(w, 1, 0, 4, ['guard']); garrison(w, 2, 0, 3); garrison(w, 3, 0, 3); garrison(w, 4, 0, 5);
  volley(w, 0, 12, 14.3, 11.3, 19.5, 11);
  brawl(w, 0, 9, 16.8, 14.9, ['brute']);
  runners(w, 0, 3, 15.6, 13.4);
  garrison(w, 12, 0, 2);
  followers(w, 1, 15, ['critter', 'bomber', 'critter', 'critter', 'runt', 'brute', 'critter', 'bomber']);
  garrison(w, 6, 1, 4); garrison(w, 7, 1, 4); garrison(w, 10, 1, 5, ['guard', 'guard']);
  brawl(w, 1, 9, 17.4, 14.7, ['runt', 'critter', 'brute']);
  garrison(w, 12, 1, 3);
  runners(w, 1, 3, 18.6, 12.8);
  // a stunned and a frosted one in the brawl so those tints are exercised
  w.critters[nextSlot - 5].stunT = 0.6; w.critters[nextSlot - 6].slowT = 1;
  return { w, looks: ['brawler', 'sable'], heroMotion: true };
}

function sceneCrown(): Scene {
  const bs = meadow([0, 0, 0, -1, 0, -1, 1, 1, 1, 1, -1, -1, 0]);
  bs[12].control = 64;
  const w = world(bs, allObstacles(), [hero(0, 'warden', 14.6, 10.3, 17.5, 8), hero(1, 'brawler', 17.6, 7.6, 14.6, 10.3)], 'crown');
  w.crown = [6.2, 3.1];
  w.frenzy = true;
  w.heroes[1].hp = 60; w.heroes[1].rampageT = 4;
  followers(w, 0, 18, ['critter', 'brute', 'critter', 'runt', 'critter', 'guard']);
  followers(w, 1, 18, ['critter', 'bomber', 'critter', 'critter', 'runt', 'bomber']);
  garrison(w, 12, 0, 7); garrison(w, 12, 1, 6);
  brawl(w, 0, 6, 16.6, 10.9); brawl(w, 1, 6, 15.4, 7.2);
  volley(w, 1, 6, 17.6, 7.6, 15.2, 10.8);
  return { w, looks: ['warden', 'mora'], heroMotion: true };
}

function sceneMutants(): Scene {
  const bs: Building[] = [building(0, 'throne', 3.5, 14.5, 0), building(1, 'throne', 28.5, 3.5, 1), building(2, 'tower', 23, 14.8, 1), building(3, 'tower', 28.2, 14.8, -1)];
  const w = world(bs, [], [hero(0, 'warden', 6.5, 14.7, 10, 10), hero(1, 'blink', 25.5, 3.6, 20, 8)]);
  const kinds: CritterKind[] = ['critter', 'runt', 'brute', 'bomber', 'guard'];
  const labels: Scene['labels'] = [];
  kinds.forEach((k, i) => {
    for (const t of [0, 1] as Team[]) {
      const x = 5 + i * 2.6, y = t === 0 ? 5.2 : 8.6;
      spawn(w, t, k, 'follow', x, y, { kind: 'still', cx: x, cy: y, ox: 0, oy: 0, ph: 0, speed: 0 });
    }
    labels.push({ x: 5 + i * 2.6, y: 10.1, text: k });
  });
  // state variants: stunned, slowed, garrison bob, hold, flying flat (Piercer) and lobbed
  const st: [string, Partial<Critter>, CritterState][] = [['stunned', { stunT: 1 }, 'follow'], ['slowed', { slowT: 1 }, 'follow'], ['hold', {}, 'hold'], ['home', {}, 'home']];
  st.forEach(([name, extra, state], i) => {
    const x = 5 + i * 2.6, y = 12.6;
    spawn(w, 0, 'critter', state, x, y, { kind: state === 'hold' ? 'hold' : 'still', cx: x, cy: y, ox: 0, oy: 0, ph: 0, speed: 0 }, extra);
    spawn(w, 1, 'critter', state, x + 0.8, y, { kind: state === 'hold' ? 'hold' : 'still', cx: x + 0.8, cy: y, ox: 0, oy: 0, ph: 0, speed: 0 }, extra);
    labels.push({ x: x + 0.4, y: 13.6, text: name });
  });
  volley(w, 0, 4, 16, 16.8, 22, 16.8, true); labels.push({ x: 19, y: 17.4, text: 'flat (piercer)' });
  volley(w, 1, 5, 16, 13.2, 21, 12.2); labels.push({ x: 18.5, y: 11.1, text: 'lobbed volley' });
  labels.push({ x: 2.5, y: 5.2, text: 'Blue' }, { x: 2.5, y: 8.6, text: 'Red' });
  w.turrets.push({ team: 0, x: 20, y: 4.5, life: 10, shotCd: 0, aim: 0.3 }, { team: 1, x: 22.6, y: 4.5, life: 10, shotCd: 0, aim: Math.PI - 0.3 });
  labels.push({ x: 21.3, y: 5.6, text: 'turrets' });
  w.zones.push({ kind: 'scorch', team: 0, x: 21.5, y: 8.8, r: 1.5, life: 3, maxLife: 4, pulseT: 0 }, { kind: 'vortex', team: 1, x: 26.3, y: 8.8, r: 1.8, life: 0.5, maxLife: 0.6, pulseT: 0 });
  labels.push({ x: 21.5, y: 10.5, text: 'scorch' }, { x: 26.3, y: 10.8, text: 'vortex' }, { x: 23, y: 16.6, text: 'tower (red)' }, { x: 28.2, y: 16.6, text: 'tower (neutral)' });
  return { w, looks: ['warden', 'pip'], labels };
}

function sceneLineup(): Scene {
  const bs: Building[] = [];
  const owners: Owner[] = [-1, 0, 1];
  (['throne', 'hut'] as const).forEach((k, ki) => owners.forEach((o, oi) => bs.push(building(bs.length, k, 3.2 + ki * 13.5 + oi * 4.4, 3.2, o))));
  (['tower', 'crown'] as const).forEach((k, ki) => owners.forEach((o, oi) => bs.push(building(bs.length, k, 3.2 + ki * 13.5 + oi * 4.4, 7.6, o))));
  bs[4].claimant = 0; bs[4].control = 100; // blue hut
  bs[9].claimant = 0; bs[9].control = 40; bs[9].owner = -1; // neutral crown being claimed
  const looks = ['brawler', 'blink', 'warden', 'bumble', 'pip', 'brood', 'gorm', 'sable', 'mora'];
  const heroes: [Hero, Hero] = [hero(0, 'brawler', 2.6, 11.2, 2.6, 20), hero(1, 'brawler', 2.6, 13.8, 2.6, 20)];
  const w = world(bs, [], heroes, 'crown');
  w.crown = [4, 2.5];
  const showcase: Scene['showcase'] = [];
  const labels: Scene['labels'] = [];
  looks.forEach((l, i) => {
    const x = 2.6 + i * 3.35;
    if (i > 0) { showcase.push({ hero: hero(0, 'brawler', x, 11.2, x, 20), look: l }, { hero: hero(1, 'brawler', x, 13.8, x, 20), look: l }); }
    labels.push({ x, y: 14.9, text: l });
  });
  const kinds: CritterKind[] = ['critter', 'runt', 'brute', 'bomber', 'guard'];
  kinds.forEach((k, i) => {
    for (const t of [0, 1] as Team[]) {
      const x = 3 + i * 2.2 + t * 0.9, y = 16.6;
      spawn(w, t, k, 'follow', x, y, { kind: 'still', cx: x, cy: y, ox: 0, oy: 0, ph: 0, speed: 0 });
    }
    labels.push({ x: 3.45 + i * 2.2, y: 17.3, text: k });
  });
  ['throne', 'hut'].forEach((k, ki) => ['neutral', 'blue', 'red'].forEach((o, oi) => labels.push({ x: 3.2 + ki * 13.5 + oi * 4.4, y: 5.1, text: `${k} ${o}` })));
  ['tower', 'crown'].forEach((k, ki) => ['neutral', 'blue', 'red'].forEach((o, oi) => labels.push({ x: 3.2 + ki * 13.5 + oi * 4.4, y: 9.5, text: `${k} ${o}` })));
  const views: Record<string, Scene['view']> = {
    kings: { x: 16, y: 13.2, width: 32 },
    critters: { x: 7.9, y: 16.6, width: 12 },
    buildings: { x: 16, y: 5.6, width: 32 },
    kingsA: { x: 7.6, y: 12.6, width: 13 },
    kingsB: { x: 21, y: 12.6, width: 16 },
  };
  return { w, looks: ['brawler', 'brawler'], labels, view: views[focus], showcase };
}

function sceneStates(): Scene {
  // Every King state side by side (showcase Kings driven by fixture Heroes), for QA of state visuals.
  const bs: Building[] = [building(0, 'throne', 4, 14.2, 0), building(1, 'throne', 28, 3.8, 1)];
  const w = world(bs, [], [hero(0, 'brawler', 6.2, 9, 6.2, 20), hero(1, 'brawler', 9.6, 9, 9.6, 20)]);
  const labels: Scene['labels'] = [];
  const states: [string, string, Partial<Hero>][] = [
    ['idle', 'brawler', {}], ['moving', 'blink', { vx: 5, vy: 0 }], ['dashing', 'warden', { dashT: 0.1, vx: 22, vy: 0 }],
    ['stunned', 'bumble', { stunT: 1 }], ['shield', 'warden', { shield: 30, shieldT: 3 }], ['rampage', 'gorm', { rampageT: 5 }],
    ['hurt', 'sable', { hp: 32 }], ['dead (ghost at throne)', 'mora', { alive: false, respawnT: 2 }],
  ];
  const showcase: Scene['showcase'] = [];
  states.forEach(([name, look, extra], i) => {
    const x = 3.2 + i * 3.6, y = 9;
    const h = Object.assign(hero(i % 2 ? 1 : 0, 'brawler', x, y, x + 0.5, 20), extra);
    if (i === 7) h.team = 0;
    showcase.push({ hero: h, look });
    labels.push({ x, y: y + 1.3, text: name });
  });
  w.heroes[0].alive = false; w.heroes[1].alive = false; w.heroes[0].respawnT = 99; w.heroes[1].respawnT = 99;
  movers.push(showcase[1].hero, showcase[2].hero);
  return { w, looks: ['brawler', 'brawler'], labels, showcase };
}
const movers: Hero[] = [];

function sceneStress(): Scene {
  const s = sceneMidfight();
  const w = s.w;
  // top up to 200 critters with more followers, garrisons and volleys
  while (nextSlot < 200) {
    const t = (nextSlot % 2) as Team;
    if (nextSlot % 5 === 0) volley(w, t, 1, w.heroes[t].x, w.heroes[t].y, 16 + (rnd() - 0.5) * 8, 9 + (rnd() - 0.5) * 6);
    else followers(w, t, 1);
  }
  return s;
}

const SCENES: Record<string, () => Scene> = { states: sceneStates, opening: sceneOpening, midfight: sceneMidfight, crown: sceneCrown, mutants: sceneMutants, lineup: sceneLineup, stress: sceneStress };

// ------------------------------------------------------------------ fake animation

function step(w: World, t: number, heroMotion: boolean) {
  w.tick++; w.time += DT;
  const hs = w.heroes;
  for (const h of hs) { h.px = h.x; h.py = h.y; }
  if (heroMotion) {
    // Blue King strolls a small loop and sweeps his aim; Red King sidesteps.
    const b = hs[0], r = hs[1];
    const bx = b.x, by = b.y;
    b.x = b.x + Math.cos(t * 0.9) * 2.2 * DT; b.y = b.y + Math.sin(t * 1.3) * 1.2 * DT;
    b.vx = (b.x - bx) / DT; b.vy = (b.y - by) / DT;
    const rx = r.x;
    r.x = r.x + Math.sin(t * 0.7) * 1.4 * DT; r.vx = (r.x - rx) / DT; r.vy = 0;
  }
  for (let i = 0; i < w.critters.length; i++) {
    const c = w.critters[i], role = roles[i];
    if (!c.alive || !role) continue;
    c.px = c.x; c.py = c.y;
    let tx = c.x, ty = c.y, sp = 0;
    switch (role.kind) {
      case 'follow': {
        const h = hs[c.team];
        tx = h.x + role.ox + Math.cos(t * 0.8 + role.ph) * 0.25; ty = h.y + role.oy + Math.sin(t * 0.6 + role.ph) * 0.2; sp = role.speed;
        // occasional shuffle so some followers hop while others idle
        if (Math.sin(t * 0.5 + role.ph * 3) > 0.7) { tx += 0.6 * Math.cos(role.ph); ty += 0.6 * Math.sin(role.ph); }
        break;
      }
      case 'garrison': {
        const a = role.ox + Math.sin(t * role.speed + role.ph) * 0.5;
        tx = role.cx + Math.cos(a) * role.oy; ty = role.cy + Math.sin(a) * role.oy; sp = 1.5;
        break;
      }
      case 'hold': tx = role.cx + Math.sin(t * 3 + role.ph) * 0.15; ty = role.cy + Math.cos(t * 2.3 + role.ph) * 0.12; sp = 2.5; break;
      case 'home': {
        const h = hs[c.team];
        const d = Math.hypot(h.x - c.x, h.y - c.y);
        if (d < 1.3) { c.x = role.cx + (rnd() - 0.5); c.y = role.cy + (rnd() - 0.5); c.px = c.x; c.py = c.y; }
        tx = h.x; ty = h.y; sp = role.speed;
        break;
      }
      case 'fly': {
        c.flightT += DT;
        if (c.flightT > c.flightDur) { c.flightT -= c.flightDur; c.px = c.sx; c.py = c.sy; }
        const u = c.flightT / c.flightDur;
        c.x = c.sx + (c.tx - c.sx) * u; c.y = c.sy + (c.ty - c.sy) * u;
        c.vx = (c.tx - c.sx) / c.flightDur; c.vy = (c.ty - c.sy) / c.flightDur;
        continue;
      }
      case 'still': c.vx = c.vy = 0; continue;
    }
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    const mv = Math.min(d, sp * DT);
    if (d > 0.05) { c.x += (dx / d) * mv; c.y += (dy / d) * mv; }
    c.vx = (c.x - c.px) / DT; c.vy = (c.y - c.py) / DT;
    if (c.stunT > 0) { c.x = c.px; c.y = c.py; c.vx = c.vy = 0; }
  }
}

// ------------------------------------------------------------------ main

const stage = document.getElementById('stage')!;
const hud = document.getElementById('hud')!;
const probe = document.getElementById('probe')!;
const info = document.getElementById('info')!;

const scene = (SCENES[sceneName] ?? sceneMidfight)();
const renderer = await createRenderer(stage);
if (q.get('cb') === '1') renderer.setOptions({ colorBlind: true });
if (q.get('quality')) renderer.setOptions({ quality: q.get('quality') as 'low' | 'medium' | 'high' });
renderer.loadMatch(scene.w, { localTeam: 0, looks: scene.looks });
if (scene.showcase) renderer.showcase(scene.showcase);
const viewQ = q.get('view')?.split(',').map(Number);
if (viewQ && viewQ.length === 3) scene.view = { x: viewQ[0], y: viewQ[1], width: viewQ[2] };
if (scene.view) renderer.debugView(scene.view);
renderer.setAim(sceneName === 'lineup' || sceneName === 'mutants' ? null : 0);

// Labels are DOM anchored through worldToScreen: they double as a check of that mapping.
const labelEls = (scene.labels ?? []).map((l) => { const el = document.createElement('div'); el.className = 'lbl'; el.textContent = l.text; hud.appendChild(el); return { el, l }; });
function placeLabels() {
  for (const { el, l } of labelEls) { const p = renderer.worldToScreen(l.x, l.y, l.h ?? 0); el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; }
}

// Mouse probe: a 3D marker at screenToWorld(mouse) and a DOM ring at worldToScreen(that point). All three coincide when both mappings are right.
const marker = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 24), new THREE.MeshBasicMaterial({ color: '#FFD166', depthTest: false }));
marker.rotation.x = -Math.PI / 2; marker.renderOrder = 99; marker.visible = false;
renderer.scene.add(marker);
let mouse: { x: number; y: number } | null = null;
addEventListener('pointermove', (e) => { mouse = { x: e.clientX, y: e.clientY }; });

let last = performance.now(), acc = 0, t = 0, frames = 0, fpsT = 0, fps = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= DT) { step(scene.w, t, !!scene.heroMotion); t += DT; acc -= DT; }
  if (scene.showcase && sceneName === 'lineup') for (const s of scene.showcase) { const a = t * 0.6 + s.hero.x; s.hero.aimX = Math.sin(a) * 0.6; s.hero.aimY = 0.8 + Math.cos(a) * 0.2; }
  // States scene: movers pace left/right around their spot so movement visuals (hop, lean, cape, stretch) run.
  for (const h of movers) { h.px = h.x; h.py = h.y; const base = Math.round((h.x - 3.2) / 3.6) * 3.6 + 3.2; h.vx = Math.cos(t * 2) * (h.dashT > 0 ? 22 : 5); h.x = base + Math.sin(t * 2) * (h.dashT > 0 ? 0.9 : 0.6); }
  if (mouse) {
    const p = renderer.screenToWorld(mouse.x, mouse.y);
    marker.visible = true; marker.position.set(p.x - 16, 0.06, p.y - 9);
    const s = renderer.worldToScreen(p.x, p.y);
    const r = renderer.canvas.getBoundingClientRect();
    probe.style.display = 'block'; probe.style.left = `${s.x + r.left}px`; probe.style.top = `${s.y + r.top}px`;
    if (q.get('info') === '1') info.textContent = `sim ${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
  }
  renderer.render(scene.w, acc / DT, dt);
  placeLabels();
  frames++; fpsT += dt;
  if (fpsT > 1) { fps = frames / fpsT; frames = 0; fpsT = 0; if (q.get('info') === '1' && !mouse) info.textContent = `${fps.toFixed(0)} fps, ${renderer.gl.info.render.calls} calls, ${renderer.gl.info.render.triangles} tris`; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/** Round-trip check of screenToWorld/worldToScreen over a grid of canvas pixels; returns the worst error in px. */
function checkMapping() {
  const r = renderer.canvas.getBoundingClientRect();
  let worst = 0;
  for (let gx = 0.1; gx < 0.95; gx += 0.1) for (let gy = 0.1; gy < 0.95; gy += 0.1) {
    const cx = r.left + r.width * gx, cy = r.top + r.height * gy;
    const p = renderer.screenToWorld(cx, cy), s = renderer.worldToScreen(p.x, p.y);
    worst = Math.max(worst, Math.hypot(s.x + r.left - cx, s.y + r.top - cy));
  }
  const corners = [[0, 0], [32, 0], [0, 18], [32, 18]].map(([x, y]) => renderer.worldToScreen(x, y));
  return { worstPx: worst, corners, canvas: [r.width, r.height] };
}

/** Frame cost: render() wall time with a GPU sync (gl.finish) per frame, excluding the lab's own step. */
function bench(n = 240) {
  const gl = renderer.gl.getContext();
  const times: number[] = [], cpu: number[] = [];
  for (let i = 0; i < 20; i++) { renderer.render(scene.w, 0.5, 1 / 60); gl.finish(); }
  for (let i = 0; i < n; i++) {
    step(scene.w, t, !!scene.heroMotion); t += DT;
    const t0 = performance.now();
    renderer.render(scene.w, 0.5, 1 / 60);
    const t1 = performance.now();
    gl.finish();
    const t2 = performance.now();
    cpu.push(t1 - t0); times.push(t2 - t0);
  }
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const p95 = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
  const alive = scene.w.critters.filter((c) => c.alive).length;
  return { critters: alive, medianMs: +med(times).toFixed(2), p95Ms: +p95(times).toFixed(2), cpuMedianMs: +med(cpu).toFixed(2), calls: renderer.gl.info.render.calls, tris: renderer.gl.info.render.triangles, dpr: renderer.gl.getPixelRatio(), size: [renderer.canvas.width, renderer.canvas.height] };
}

(window as unknown as { __lab: unknown }).__lab = { renderer, world: scene.w, checkMapping, bench };
