import { cos, rand, randRange, sin, TAU } from './math';
import { deriveMods } from './mods';
import { blankCritter, spawnCritter } from './spawn';
import { tuning } from './tuning';
import type {
  Building, BuildingKind, Hero, HeroId, MatchConfig, Obstacle, Owner, Team, TeamStats, World,
} from './types';
import { ARENA_H, ARENA_W, MAX_CRITTERS } from './types';

export function createWorld(config: MatchConfig): World {
  const buildings: Building[] = [];
  const thrones: [number, number] = [-1, -1];
  for (const team of [0, 1] as const) {
    for (const def of config.map.half) {
      const x = team === 0 ? def.x : ARENA_W - def.x;
      const y = team === 0 ? def.y : ARENA_H - def.y;
      const owned = def.kind === 'throne' || (def.kind === 'tower' && tuning.building.towersStartOwned);
      if (def.kind === 'throne') thrones[team] = buildings.length;
      buildings.push(makeBuilding(buildings.length, def.kind, x, y, owned ? team : -1));
    }
  }
  buildings.push(makeBuilding(buildings.length, 'crown', ARENA_W / 2, ARENA_H / 2, -1));
  if (thrones[0] < 0 || thrones[1] < 0) throw new Error(`map ${config.map.id} has no throne`);

  const obstacles: Obstacle[] = [
    ...config.map.obstacles.map((o) => ({ ...o })),
    ...config.map.obstacles.map((o) => ({ ...o, x: ARENA_W - o.x, y: ARENA_H - o.y })),
    ...(config.map.centre ?? []).map((o) => ({ ...o })),
  ];

  const critters = [];
  for (let i = 0; i < MAX_CRITTERS; i++) critters.push(blankCritter(i));

  const w: World = {
    tick: 0,
    time: 0,
    config,
    rng: config.seed | 0,
    phase: 'open',
    crown: [0, 0],
    frenzy: false,
    winner: -1,
    winReason: null,
    heroes: [
      makeHero(0, config.teams[0].hero),
      makeHero(1, config.teams[1].hero),
    ],
    critters,
    buildings,
    turrets: [],
    zones: [],
    obstacles,
    stats: [emptyStats(), emptyStats()],
    mods: [deriveMods(config.teams[0]), deriveMods(config.teams[1])],
    thrones,
    events: [],
  };

  for (const team of [0, 1] as const) {
    const h = w.heroes[team];
    const [sx, sy] = heroSpawnPoint(w, team);
    h.x = h.px = sx;
    h.y = h.py = sy;
    const n = tuning.match.startSwarm + w.mods[team].startSwarmAdd;
    for (let i = 0; i < n; i++) {
      const a = rand(w) * TAU;
      const d = randRange(w, 0.4, 1.3);
      spawnCritter(w, team, h.x + cos(a) * d, h.y + sin(a) * d, 'follow');
    }
  }
  for (const b of buildings) b.hatchT = hatchInterval(b.kind) * randRange(w, 0.5, 1);
  return w;
}

function makeBuilding(id: number, kind: BuildingKind, x: number, y: number, owner: Owner): Building {
  return {
    id, kind, x, y,
    r: tuning.building.radius[kind],
    owner,
    control: owner === -1 ? 0 : 100,
    claimant: owner,
    hatchT: 0,
    presence: [0, 0],
    garrison: [0, 0],
    shotCd: 0,
  };
}

function makeHero(team: Team, kind: HeroId): Hero {
  const hp = tuning.hero.hp[kind];
  const cdMax = abilityCooldowns(kind);
  return {
    team, kind,
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
    aimX: team === 0 ? 1 : -1, aimY: 0,
    hp, maxHp: hp,
    alive: true,
    respawnT: 0,
    dashT: 0, dashCd: 0,
    invulnT: 0,
    cd: [0, 0],
    cdMax,
    stunT: 0, slowT: 0,
    shield: 0, shieldT: 0,
    rampageT: 0,
    sinceHurt: 0,
    followers: 0,
    fireCd: 0,
    swingCd: 0,
    noAmmoT: 0,
    spent: [],
    prev: { dash: false, ability: false, ultimate: false, recall: false, fire: false },
    kills: 0,
  };
}

function emptyStats(): TeamStats {
  return { thrown: 0, crittersKilled: 0, crittersLost: 0, captures: 0, heroKills: 0, damageToHero: 0 };
}

export function abilityCooldowns(kind: HeroId): [number, number] {
  const a = tuning.abilities;
  switch (kind) {
    case 'brawler': return [a.brawler.stomp.cd, a.brawler.kingscall.cd];
    case 'blink': return [a.blink.blink.cd, a.blink.vortex.cd];
    case 'warden': return [a.warden.turret.cd, a.warden.rampart.cd];
  }
}

export function hatchInterval(kind: BuildingKind): number {
  return tuning.building.hatchInterval[kind];
}

/** On the Throne's rim, on the side facing the arena centre (inside the capture zone, outside the solid core). */
export function heroSpawnPoint(w: World, team: Team): [number, number] {
  const b = w.buildings[w.thrones[team]];
  const dx = ARENA_W / 2 - b.x, dy = ARENA_H / 2 - b.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return [b.x + (dx / d) * b.r, b.y + (dy / d) * b.r];
}

/** Swarm cap: base + per owned building, then team modifiers. */
export function swarmCap(w: World, team: Team): number {
  let owned = 0;
  for (const b of w.buildings) if (b.owner === team) owned++;
  const m = w.mods[team];
  return Math.floor((tuning.building.capBase + tuning.building.capPerBuilding * owned + m.capAdd) * m.capMul);
}

export function buildingsOwned(w: World, team: Team): number {
  let n = 0;
  for (const b of w.buildings) if (b.owner === team) n++;
  return n;
}
