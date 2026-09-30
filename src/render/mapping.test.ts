import { describe, it, expect } from 'vitest';
import { sceneX, sceneZ, simX, simY, flightHeight, flightApex, flightSlope, ringState, pathPairs, angleDelta, mulberry32, FLIGHT, segDist } from './mapping';
import type { RingState } from './mapping';

describe('sim <-> scene mapping', () => {
  it('centres the arena on the scene origin with sim y toward the camera (+z)', () => {
    expect([sceneX(0), sceneZ(0)]).toEqual([-16, -9]);
    expect([sceneX(32), sceneZ(18)]).toEqual([16, 9]);
    expect([simX(sceneX(7.25)), simY(sceneZ(3.5))]).toEqual([7.25, 3.5]);
  });
});

describe('flight arc', () => {
  it('starts and ends on the ground and peaks at the apex mid-flight', () => {
    expect(flightHeight(0, 6, false)).toBeCloseTo(0);
    expect(flightHeight(1, 6, false)).toBeCloseTo(0);
    expect(flightHeight(0.5, 6, false)).toBeCloseTo(flightApex(6, false) + FLIGHT.lift);
  });
  it('lobs higher over longer throws, within limits', () => {
    expect(flightApex(8, false)).toBeGreaterThan(flightApex(3, false));
    expect(flightApex(100, false)).toBe(FLIGHT.apexMax);
    expect(flightApex(0.1, false)).toBe(FLIGHT.apexMin);
  });
  it('keeps flat (Piercer) throws low regardless of distance', () => {
    expect(flightHeight(0.5, 8, true)).toBeLessThan(0.5);
  });
  it('clamps u outside 0..1', () => {
    expect(flightHeight(-0.2, 5, false)).toBe(0);
    expect(flightHeight(1.3, 5, false)).toBeCloseTo(0);
  });
  it('slopes up before the apex and down after it', () => {
    expect(flightSlope(0.2, 6, false)).toBeGreaterThan(0);
    expect(flightSlope(0.8, 6, false)).toBeLessThan(0);
    expect(flightSlope(0.5, 6, false)).toBeCloseTo(0);
  });
});

describe('capture ring state', () => {
  const out: RingState = { team: -1, fill: 0, contested: false };
  it('shows the owner colour filled by control', () => {
    expect(ringState({ owner: 1, claimant: -1, control: 60, presence: [0, 3] }, out)).toEqual({ team: 1, fill: 0.6, contested: false });
  });
  it('shows a neutral building filling toward its claimant', () => {
    expect(ringState({ owner: -1, claimant: 0, control: 25, presence: [2, 0] }, out)).toEqual({ team: 0, fill: 0.25, contested: false });
  });
  it('shows nothing on an unclaimed neutral building', () => {
    expect(ringState({ owner: -1, claimant: -1, control: 40, presence: [0, 0] }, out).fill).toBe(0);
  });
  it('flags contested when both teams stand on it', () => {
    expect(ringState({ owner: 0, claimant: -1, control: 100, presence: [1, 4] }, out).contested).toBe(true);
  });
});

describe('helpers', () => {
  it('links each building to its near neighbours once', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 }, { x: 30, y: 0 }];
    expect(pathPairs(pts, 7.5, 2)).toEqual([[0, 1], [0, 2], [1, 2]]);
  });
  it('wraps angle deltas to the short way round', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });
  it('seeded rng is reproducible', () => {
    const a = mulberry32(7), b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('measures distance to a segment', () => {
    expect(segDist(1, 1, 0, 0, 2, 0)).toBeCloseTo(1);
    expect(segDist(-3, 4, 0, 0, 2, 0)).toBeCloseTo(5);
  });
});
