// Mutations under load: determinism with mixed loadouts, and a soak over random loadout pairs.
import { describe, expect, it } from 'vitest';
import { hashWorld } from './hash';
import { idleInput } from './input';
import { rand } from './math';
import { MUTATIONS } from './mutations';
import { step } from './step';
import { botInputs, testConfig } from './testing';
import { tuning } from './tuning';
import type { HeroId, MutationId, PlayerInput, Team, TeamSetup, World } from './types';
import { MAX_CRITTERS } from './types';
import { createWorld } from './world';

function world(seed: number, blue: TeamSetup, red: TeamSetup): World {
  return createWorld(testConfig({ seed, teams: [blue, red], duration: 90, crownOpensAt: 40 }));
}

/** Everything aggressive, all the time: charge, hose the nearest target, mash every button. */
function aggressive(w: World, team: Team): PlayerInput {
  const h = w.heroes[team];
  const inp = idleInput();
  if (!h.alive) return inp;
  const foe = w.heroes[1 - team];
  const throne = w.buildings[w.thrones[1 - team]];
  const tx = foe.alive ? foe.x : throne.x, ty = foe.alive ? foe.y : throne.y;
  const dx = tx - h.x, dy = ty - h.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  inp.moveX = dx / d; inp.moveY = dy / d;
  inp.aimX = tx; inp.aimY = ty;
  inp.fire = true;
  const t = w.tick + team * 7;
  inp.dash = t % 50 === 0;
  inp.ability = t % 40 === 3;
  inp.ultimate = t % 150 === 5;
  inp.recall = t % 400 === 9;
  return inp;
}

function check(w: World): void {
  const bad = (what: string) => { throw new Error(`${what} at tick ${w.tick}`); };
  for (const h of w.heroes) {
    for (const v of [h.x, h.y, h.vx, h.vy, h.hp, h.rampageT, h.guardT, h.dashCd, h.fireCd])
      if (!Number.isFinite(v)) bad(`hero ${h.team} non-finite`);
    if (h.hp > h.maxHp + 1e-9) bad(`hero ${h.team} over max hp`);
  }
  let alive = 0;
  const guards = [0, 0];
  for (const c of w.critters) {
    if (!c.alive) continue;
    alive++;
    if (c.kind === 'guard') guards[c.team]++;
    for (const v of [c.x, c.y, c.vx, c.vy, c.hp, c.stunT, c.slowT, c.holdT])
      if (!Number.isFinite(v)) bad(`critter ${c.id} non-finite`);
    if (c.hp <= 0) bad(`critter ${c.id} alive at ${c.hp} hp`);
    if (c.state === 'garrison' && (c.building < 0 || c.building >= w.buildings.length)) bad(`critter ${c.id} bad garrison`);
    if (c.kind === 'guard' && c.state === 'fly') bad(`guard ${c.id} thrown`);
  }
  if (alive > MAX_CRITTERS) bad('pool overflow');
  for (const t of [0, 1] as const) if (guards[t] > w.mods[t].guardCount) bad(`team ${t} has ${guards[t]} guards`);
  for (const b of w.buildings) if (!Number.isFinite(b.control) || !Number.isFinite(b.hatchT)) bad(`building ${b.id}`);
  for (const t of [0, 1] as const) {
    const n = w.zones.filter((z) => z.kind === 'scorch' && z.team === t).length;
    if (n > tuning.mutations.scorch.maxPerTeam) bad(`team ${t} has ${n} scorch zones`);
  }
  for (const z of w.zones) if (!Number.isFinite(z.life) || !Number.isFinite(z.pulseT)) bad('zone non-finite');
}

const HEROES: HeroId[] = ['brawler', 'blink', 'warden'];
const IDS = MUTATIONS.map((m) => m.id);

/** 5 distinct Mutations (Duos included regardless of tags: the sim must cope with any loadout). */
function loadout(s: { rng: number }): TeamSetup {
  const pool = IDS.slice();
  const mutations: MutationId[] = [];
  for (let i = 0; i < 5; i++) mutations.push(pool.splice(Math.floor(rand(s) * pool.length), 1)[0]);
  return { hero: HEROES[Math.floor(rand(s) * HEROES.length)], mutations };
}

const MIX_A: [TeamSetup, TeamSetup] = [
  { hero: 'brawler', mutations: ['bombers', 'splitters', 'chainReaction', 'piercers', 'royalGuard'] },
  { hero: 'warden', mutations: ['scorch', 'homing', 'secondWind', 'archerHuts', 'militia'] },
];
const MIX_B: [TeamSetup, TeamSetup] = [
  { hero: 'blink', mutations: ['brutes', 'cryoBombs', 'bloodrage', 'trample', 'rapidFire', 'bombers'] },
  { hero: 'brawler', mutations: ['bigLitter', 'boomtown', 'longArm', 'shockwave', 'conscription', 'leeches', 'frostbite'] },
];

describe('determinism with Mutations', () => {
  for (const [name, mix] of [['A', MIX_A], ['B', MIX_B]] as const) {
    it(`mixed loadout ${name}: identical hashes tick by tick`, () => {
      const run = () => {
        const w = world(4242, mix[0], mix[1]);
        const hs: number[] = [];
        for (let i = 0; i < 1800 && w.phase !== 'over'; i++) {
          step(w, [aggressive(w, 0), aggressive(w, 1)]);
          hs.push(hashWorld(w));
        }
        return hs;
      };
      const a = run();
      expect(a.length).toBeGreaterThan(300);
      expect(run()).toEqual(a);
    });
  }

  it('Mutations change the outcome (the hash sees them)', () => {
    const play = (teams: [TeamSetup, TeamSetup]) => {
      const w = world(9, teams[0], teams[1]);
      for (let i = 0; i < 600 && w.phase !== 'over'; i++) step(w, botInputs(w));
      return hashWorld(w);
    };
    expect(play(MIX_A)).not.toBe(play([{ hero: 'brawler', mutations: [] }, { hero: 'warden', mutations: [] }]));
  });
});

describe('soak: random loadouts', () => {
  const s = { rng: 20260930 };
  const pairs = Array.from({ length: 6 }, () => [loadout(s), loadout(s)] as const);
  const seen = new Set<string>();

  for (const [i, [blue, red]] of pairs.entries()) {
    it(`pair ${i}: ${blue.hero}[${blue.mutations.join(',')}] vs ${red.hero}[${red.mutations.join(',')}]`, () => {
      const w = world(100 + i, blue, red);
      let ticks = 0;
      // restart finished matches so every pair gets its full 3000 ticks of play
      let cur = w;
      for (let t = 0; t < 3000; t++) {
        if (cur.phase === 'over') cur = world(200 + i * 10 + t, blue, red);
        step(cur, [aggressive(cur, 0), aggressive(cur, 1)]);
        check(cur);
        for (const e of cur.events) seen.add(e.type);
        ticks++;
      }
      expect(ticks).toBe(3000);
    });
  }

  it('exercised the Mutation events', () => {
    for (const t of ['explode', 'spawn', 'throw', 'land']) expect(seen, [...seen].join(',')).toContain(t);
  });
});

describe('death after-effects stay in their own World', () => {
  it('a death queued in one World never settles into another', async () => {
    const { damageCritter } = await import('./combat');
    const { mutWorld, put, run, aliveCritters } = await import('./testing');
    const a = mutWorld(['splitters']);
    damageCritter(a, put(a, 0, 10, 9), 5, 1); // queued in a, never stepped
    const b = mutWorld(['splitters']);
    run(b, 1);
    expect(aliveCritters(b, 0).length).toBe(0);
    expect(createWorld(testConfig({ teams: [{ hero: 'brawler', mutations: ['royalGuard'] }, { hero: 'brawler', mutations: [] }] })).events).toEqual([]);
  });
});
