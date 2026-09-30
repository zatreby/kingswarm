import { describe, expect, it } from 'vitest';
import { createWorld, idleInput, meadow, step } from '../sim';
import type { MatchConfig, World } from '../sim';
import { pickTopTwo } from './brain';
import type { Candidate } from './brain';
import { createBot } from './bot';
import { runMatch } from './match';
import { PROFILES } from './profiles';
import { Rng } from './rng';
import type { Bot } from './types';

function world(over: Partial<MatchConfig> = {}): World {
  return createWorld({
    seed: 4, map: meadow, duration: 150, crownOpensAt: 90,
    teams: [{ hero: 'brawler', mutations: [] }, { hero: 'brawler', mutations: [] }], ...over,
  });
}

/** Let a bot perceive and decide for `s` seconds while the rival stands idle. */
function settle(w: World, bot: Bot, s: number, each?: (w: World) => void): void {
  for (let i = 0; i < s * 60; i++) {
    each?.(w);
    step(w, [bot.think(w), idleInput()]);
  }
}

describe('utility brain', () => {
  it('a badly hurt King with the rival King next to him regroups', () => {
    const w = world();
    const me = w.heroes[0], foe = w.heroes[1];
    me.x = me.px = 12; me.y = me.py = 10;
    foe.x = foe.px = 15; foe.y = foe.py = 10;
    const bot = createBot(0, PROFILES.average, 1);
    settle(w, bot, 1.2, () => { me.hp = 15; me.sinceHurt = 0; foe.x = 15; foe.y = 10; });
    expect(bot.debug.intentKind).toBe('regroup');
  });

  it('when the rival is holding the open Crown, a crown-contesting bot goes for it', () => {
    const w = world({ crownOpensAt: 1 });
    const crown = w.buildings.find((b) => b.kind === 'crown')!;
    const foe = w.heroes[1];
    const bot = createBot(0, PROFILES.expert, 2);
    settle(w, bot, 2, () => { foe.x = crown.x + 1.2; foe.y = crown.y; w.crown[1] = 6; });
    expect(bot.debug.intentKind).toBe('takeCrown');
  });

  it('Pip never heads into the rival half before the Crown opens', () => {
    const own = { x: 32 - 3.5, y: 18 - 14.5 }, theirs = { x: 3.5, y: 14.5 };
    for (const seed of [1, 2, 3]) {
      runMatch({
        seed, duration: 60, crownOpensAt: 40,
        sides: [{ profile: 'average' }, { profile: 'pip' }],
        onTick: (w, bots) => {
          if (w.time >= 39 || w.tick % 30 !== 0) return;
          const d = bots[1].debug;
          if (d.goalX === null || d.goalY === null) return;
          const toTheirs = Math.hypot(d.goalX - theirs.x, d.goalY - theirs.y);
          const toOwn = Math.hypot(d.goalX - own.x, d.goalY - own.y);
          expect(toTheirs, `Pip heading to (${d.goalX.toFixed(1)},${d.goalY.toFixed(1)}) at ${w.time.toFixed(1)}s: ${bots[1].intent}`).toBeGreaterThan(toOwn - 2.5); // slack: a stand point on the rim of the centre Crown
        },
      });
    }
  });

  it('a tactic that is not unlocked is vetoed: Bumble at level 0 never raids the Throne', () => {
    for (const seed of [1, 2]) {
      runMatch({
        seed, duration: 80, crownOpensAt: 45,
        sides: [{ profile: 'novice' }, { profile: 'bumble', level: 0 }],
        onTick: (w, bots) => { expect(bots[1].intent.startsWith('raid throne')).toBe(false); },
      });
    }
  });

  it('picks the best candidate, or one of the top two when they are within 30%', () => {
    const c = (score: number, target: number): Candidate => ({ kind: 'expand', target, score, reason: '' });
    const rng = new Rng(9);
    const far = [c(1, 0), c(0.5, 1), c(0.4, 2)];
    for (let i = 0; i < 200; i++) expect(pickTopTwo(far, rng).target).toBe(0);
    const close = [c(1, 0), c(0.8, 1), c(0.79, 2)];
    const n = [0, 0, 0];
    for (let i = 0; i < 2000; i++) n[pickTopTwo(close, rng).target]++;
    expect(n[2]).toBe(0);
    expect(n[1] / 2000).toBeGreaterThan(0.35);
    expect(n[1] / 2000).toBeLessThan(0.5);
  });

  it('changes intent with a short in-character bark', () => {
    const w = world();
    const bot = createBot(1, PROFILES.gorm, 3);
    const lines: string[] = [];
    for (let i = 0; i < 60 * 40; i++) {
      step(w, [idleInput(), bot.think(w)]);
      for (const s of bot.drainSignals()) if (s.kind === 'bark') lines.push(s.text);
    }
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      const words = l.split(/\s+/).length;
      expect(words, l).toBeGreaterThanOrEqual(1);
      expect(words, l).toBeLessThanOrEqual(4);
    }
  });
});
