import { describe, expect, it } from 'vitest';
import { cooldownLabel, formatClock, formatElapsed, quantize, ordinalBattle } from './format';

describe('formatClock', () => {
  it('ceils remaining seconds so the last second still reads 0:01', () => {
    expect(formatClock(105)).toBe('1:45');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(9.01)).toBe('0:10');
    expect(formatClock(0.4)).toBe('0:01');
  });
  it('never goes negative', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('formatElapsed', () => {
  it('floors elapsed time and pads', () => {
    expect(formatElapsed(72.9)).toBe('1:12');
    expect(formatElapsed(845)).toBe('14:05');
    expect(formatElapsed(3729)).toBe('1:02:09');
  });
});

describe('cooldownLabel', () => {
  it('is empty when ready and whole seconds otherwise', () => {
    expect(cooldownLabel(0)).toBe('');
    expect(cooldownLabel(0.01)).toBe('');
    expect(cooldownLabel(0.3)).toBe('1');
    expect(cooldownLabel(2.0)).toBe('2');
    expect(cooldownLabel(2.01)).toBe('3');
  });
});

describe('quantize', () => {
  it('clamps and rounds to steps', () => {
    expect(quantize(-1, 100)).toBe(0);
    expect(quantize(NaN, 100)).toBe(0);
    expect(quantize(0.505, 100)).toBe(51);
    expect(quantize(2, 100)).toBe(100);
  });
});

describe('ordinalBattle', () => {
  it('names the boss battle', () => {
    expect(ordinalBattle(2, 5)).toBe('Battle 2 of 5');
    expect(ordinalBattle(6, 6, true)).toBe('Final battle');
  });
});
