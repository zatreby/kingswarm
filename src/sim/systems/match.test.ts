import { describe, expect, it } from 'vitest';
import { hashWorld } from '../hash';
import { bareWorld, placeHero, put, run } from '../testing';
import { tuning } from '../tuning';
import type { World } from '../types';

const M = tuning.match;

function crownWorld(opensAt: number, duration = 300): World {
  const w = bareWorld({ crownOpensAt: opensAt, duration });
  placeHero(w, 0, 8, 12);
  placeHero(w, 1, 24, 6);
  // no hatching: stray hatchlings would contest the Crown
  w.mods[0].capMul = 0;
  w.mods[1].capMul = 0;
  return w;
}
const crownIdx = (w: World) => w.buildings.findIndex((b) => b.kind === 'crown');
function onCrown(w: World, team: 0 | 1) {
  const b = w.buildings[crownIdx(w)];
  const c = put(w, team, b.x + (team === 0 ? -1 : 1) * (b.r + 0.2), b.y);
  c.stunT = 1e6;
  return c;
}

describe('clock', () => {
  it('advances one tick of 1/60 s per step', () => {
    const w = crownWorld(100);
    run(w, 60);
    expect(w.tick).toBe(60);
    expect(w.time).toBeCloseTo(1, 12);
  });
});

describe('the Crown', () => {
  it('opens at crownOpensAt: phase crown, crownOpen event, Frenzy on', () => {
    const w = crownWorld(1);
    run(w, 59);
    expect(w.phase).toBe('open');
    expect(w.frenzy).toBe(false);
    const ev = run(w, 1);
    expect(w.phase).toBe('crown');
    expect(w.frenzy).toBe(true);
    expect(ev).toContainEqual({ type: 'crownOpen' });
  });

  it('accrues hold time only after opening, for the only team present', () => {
    const w = crownWorld(1);
    onCrown(w, 0);
    run(w, 60);
    expect(w.crown[0]).toBe(0);
    run(w, 60);
    expect(w.crown[0]).toBeCloseTo(1, 6);
    expect(w.crown[1]).toBe(0);
  });

  it('wins after 10 s of holding', () => {
    const w = crownWorld(0.5);
    onCrown(w, 1);
    const ev = run(w, 30 + M.crownHold * 60 + 2);
    expect(w.phase).toBe('over');
    expect(w.winner).toBe(1);
    expect(w.winReason).toBe('crown');
    expect(ev).toContainEqual({ type: 'matchEnd', winner: 1, reason: 'crown' });
  });

  it('decays 0.5/s while absent and freezes while contested', () => {
    const w = crownWorld(0.5);
    const blue = onCrown(w, 0);
    run(w, 30 + 4 * 60);
    expect(w.crown[0]).toBeCloseTo(4, 6);
    const red = onCrown(w, 1);
    run(w, 120);
    expect(w.crown[0]).toBeCloseTo(4, 6);
    expect(w.crown[1]).toBe(0);
    blue.alive = false;
    red.alive = false;
    run(w, 120);
    expect(w.crown[0]).toBeCloseTo(3, 6);
  });

  it('stays capturable as a hatchery', () => {
    const w = crownWorld(0.5);
    w.mods[0].capMul = 1;
    onCrown(w, 0);
    const ev = run(w, 6 * 60);
    expect(w.buildings[crownIdx(w)].owner).toBe(0);
    expect(ev.some((e) => e.type === 'capture' && e.kind === 'crown')).toBe(true);
    expect(ev.some((e) => e.type === 'hatch' && e.building === crownIdx(w))).toBe(true);
  });
});

describe('time-out', () => {
  it('more buildings wins', () => {
    const w = crownWorld(100, 2);
    w.buildings[crownIdx(w)].owner = 0;
    const ev = run(w, 2 * 60);
    expect(w.phase).toBe('over');
    expect(w.winner).toBe(0);
    expect(w.winReason).toBe('time');
    expect(ev).toContainEqual({ type: 'matchEnd', winner: 0, reason: 'time' });
  });

  it('a tie goes to overtime, where the next capture wins', () => {
    const w = crownWorld(100, 2);
    const ev = run(w, 2 * 60);
    expect(w.phase).toBe('overtime');
    expect(ev).toContainEqual({ type: 'overtime' });
    run(w, 60);
    expect(w.phase).toBe('overtime');
    onCrown(w, 1);
    const ev2 = run(w, 5 * 60);
    expect(w.phase).toBe('over');
    expect(w.winner).toBe(1);
    expect(w.winReason).toBe('overtime');
    expect(ev2).toContainEqual({ type: 'matchEnd', winner: 1, reason: 'overtime' });
  });
});

describe('after the match', () => {
  it('step is a no-op once over', () => {
    const w = crownWorld(100, 2);
    w.buildings[crownIdx(w)].owner = 0;
    run(w, 2 * 60);
    expect(w.phase).toBe('over');
    const h = hashWorld(w);
    const ev = run(w, 30);
    expect(ev).toEqual([]);
    expect(hashWorld(w)).toBe(h);
  });
});
