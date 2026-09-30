import { describe, expect, it } from 'vitest';
import { pickInDirection, stepIndex, type Rect } from './focus';

const r = (x: number, y: number, w = 100, h = 40): Rect => ({ x, y, w, h });

describe('pickInDirection', () => {
  // Three cards in a row, a button row under them.
  const cards = [r(0, 0, 200, 300), r(240, 0, 200, 300), r(480, 0, 200, 300)];
  const below = [r(180, 360, 120, 40), r(340, 360, 120, 40)];
  const all = [...cards, ...below];

  it('moves along a row', () => {
    expect(pickInDirection(cards[0], all, 'right', 0)).toBe(1);
    expect(pickInDirection(cards[1], all, 'right', 1)).toBe(2);
    expect(pickInDirection(cards[1], all, 'left', 1)).toBe(0);
  });
  it('returns -1 at an edge', () => {
    expect(pickInDirection(cards[2], all, 'right', 2)).toBe(-1);
    expect(pickInDirection(cards[0], all, 'up', 0)).toBe(-1);
  });
  it('prefers the candidate that overlaps on the cross axis', () => {
    // From the middle card, down goes to whichever button sits under it (both overlap; nearer centre wins).
    expect(pickInDirection(cards[1], all, 'down', 1)).toBe(4);
    expect(pickInDirection(cards[0], all, 'down', 0)).toBe(3);
  });
  it('returns up to the card above a button', () => {
    expect(pickInDirection(below[1], all, 'up', 4)).toBe(1);
  });
  it('handles a vertical menu', () => {
    const menu = [r(0, 0), r(0, 60), r(0, 120), r(0, 180)];
    expect(pickInDirection(menu[1], menu, 'down', 1)).toBe(2);
    expect(pickInDirection(menu[1], menu, 'up', 1)).toBe(0);
    expect(pickInDirection(menu[3], menu, 'down', 3)).toBe(-1);
  });
});

describe('stepIndex', () => {
  it('wraps both ways and starts from nothing', () => {
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(-1, 3, 1)).toBe(0);
    expect(stepIndex(-1, 3, -1)).toBe(2);
    expect(stepIndex(0, 0, 1)).toBe(-1);
  });
});
