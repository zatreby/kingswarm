import { describe, expect, it } from 'vitest';
import { BoolSlot, NumSlot, PosSlot, TextSlot } from './diff';

describe('NumSlot', () => {
  it('reports the first value and then only changes', () => {
    const s = new NumSlot();
    expect(s.changed(3)).toBe(true);
    expect(s.changed(3)).toBe(false);
    expect(s.changed(4)).toBe(true);
  });
  it('treats NaN as a stable value', () => {
    const s = new NumSlot();
    expect(s.changed(NaN)).toBe(true);
    expect(s.changed(NaN)).toBe(false);
    expect(s.changed(0)).toBe(true);
  });
  it('reset forces the next write', () => {
    const s = new NumSlot();
    s.changed(1); s.reset();
    expect(s.changed(1)).toBe(true);
  });
});

describe('BoolSlot', () => {
  it('writes once per flip', () => {
    const s = new BoolSlot();
    expect(s.changed(false)).toBe(true);
    expect(s.changed(false)).toBe(false);
    expect(s.changed(true)).toBe(true);
  });
});

describe('TextSlot', () => {
  it('writes textContent only when the string changes', () => {
    let writes = 0;
    const el = { _t: '' as string | null, get textContent() { return this._t; }, set textContent(v) { writes++; this._t = v; } };
    const s = new TextSlot(el);
    s.set('1:45'); s.set('1:45'); s.set('1:45');
    expect(writes).toBe(1);
    s.set('1:44');
    expect(writes).toBe(2);
    expect(el.textContent).toBe('1:44');
  });
});

describe('PosSlot', () => {
  it('ignores sub-pixel jitter', () => {
    const p = new PosSlot();
    expect(p.changed(100.2, 50.1)).toBe(true);
    expect(p.changed(100.4, 49.8)).toBe(false);
    expect(p.changed(101, 50)).toBe(true);
    expect(p.px).toBe(101);
  });
  it('treats hidden (NaN) as a position', () => {
    const p = new PosSlot();
    expect(p.changed(NaN, NaN)).toBe(true);
    expect(p.changed(NaN, NaN)).toBe(false);
    expect(p.changed(5, 5)).toBe(true);
  });
});
