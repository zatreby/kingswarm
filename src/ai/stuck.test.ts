import { describe, expect, it } from 'vitest';
import { createWorld, step } from '../sim';
import type { MapDef, World } from '../sim';
import { createBot } from './bot';
import { runMatch } from './match';
import { PROFILES, RIVALS } from './profiles';
import type { Bot } from './types';

// A pocket open to the west, its closed side facing the only targets (a Hut and the Crown to the east).
// Plain steering presses into the back wall forever; the unstuck rule has to back out and go round.
const pocket: MapDef = {
  id: 'pocket', name: 'Pocket',
  half: [{ kind: 'throne', x: 3.5, y: 14.5 }, { kind: 'hut', x: 14.6, y: 9 }],
  obstacles: [
    { x: 12.3, y: 8.1, r: 0.6, look: 'rock' },
    { x: 12.4, y: 9.0, r: 0.6, look: 'rock' },
    { x: 12.3, y: 9.9, r: 0.6, look: 'rock' },
    { x: 11.3, y: 7.3, r: 0.6, look: 'rock' },
    { x: 11.3, y: 10.7, r: 0.6, look: 'rock' },
  ],
};

describe('never permanently stuck', () => {
  it('backs out of a dead-end pocket and reaches the target on the far side', () => {
    const w = createWorld({
      seed: 1, map: pocket, duration: 150, crownOpensAt: 90,
      teams: [{ hero: 'warden', mutations: [] }, { hero: 'brawler', mutations: [] }],
    });
    const h = w.heroes[0];
    h.x = h.px = 11.2; h.y = h.py = 9;
    const bot = createBot(0, PROFILES.average, 5);
    const idle = createBot(1, PROFILES.idle, 6);
    let reached = -1;
    for (let t = 0; t < 60 * 15; t++) {
      step(w, [bot.think(w), idle.think(w)]);
      if (Math.hypot(h.x - 14.6, h.y - 9) < 2.2) { reached = w.time; break; }
    }
    expect(bot.debug.unstucks, 'the unstuck rule should have fired').toBeGreaterThan(0);
    expect(reached, 'never reached the hut behind the pocket').toBeGreaterThan(0);
  });

  it('no King stays pinned in place while trying to go somewhere, across 20 seeds', () => {
    const WINDOW = 5; // seconds
    for (let seed = 1; seed <= 20; seed++) {
      const rival = RIVALS[seed % RIVALS.length];
      const samples: { x: number; y: number; wants: boolean }[][] = [[], []];
      runMatch({
        seed, duration: 45, crownOpensAt: 25,
        sides: [{ profile: seed % 2 ? 'average' : 'novice' }, { profile: rival, level: seed % 9 }],
        onTick: (w: World, bots: [Bot, Bot]) => {
          if (w.tick % 60 !== 0) return;
          for (let t = 0; t < 2; t++) {
            const h = w.heroes[t], d = bots[t].debug;
            const wants = h.alive && h.stunT <= 0 && d.goalX !== null && Math.hypot(d.goalX - h.x, d.goalY! - h.y) > 2.5;
            samples[t].push({ x: h.x, y: h.y, wants });
          }
        },
      });
      for (let t = 0; t < 2; t++) {
        const s = samples[t];
        for (let i = 0; i + WINDOW <= s.length; i++) {
          const win = s.slice(i, i + WINDOW);
          if (!win.every((p) => p.wants)) continue;
          const mx = win.reduce((a, p) => a + p.x, 0) / WINDOW, my = win.reduce((a, p) => a + p.y, 0) / WINDOW;
          const spread = Math.max(...win.map((p) => Math.hypot(p.x - mx, p.y - my)));
          expect(spread, `seed ${seed} team ${t} (${t ? rival : 'proxy'}) pinned near (${mx.toFixed(1)},${my.toFixed(1)}) at ${i}s`).toBeGreaterThan(0.6);
        }
      }
    }
  });
});
