// Change detection for per-frame HUD writes (pure; tested in diff.test.ts).
// Each slot remembers the last value it wrote, so update() touches the DOM only on change.

export class NumSlot {
  private last = NaN;
  private seen = false;
  /** True when v differs from the last accepted value (NaN counts as a value). */
  changed(v: number): boolean {
    if (this.seen && (v === this.last || (v !== v && this.last !== this.last))) return false;
    this.seen = true;
    this.last = v;
    return true;
  }
  reset(): void { this.seen = false; this.last = NaN; }
  get value(): number { return this.last; }
}

export class BoolSlot {
  private last = 0; // 0 unknown, 1 false, 2 true
  changed(v: boolean): boolean {
    const n = v ? 2 : 1;
    if (n === this.last) return false;
    this.last = n;
    return true;
  }
  reset(): void { this.last = 0; }
}

/** Minimal element surface the HUD writes to; real DOM nodes satisfy it and tests can fake it. */
export interface TextTarget { textContent: string | null }

export class TextSlot {
  private last: string | null = null;
  constructor(private readonly el: TextTarget) {}
  set(s: string): boolean {
    if (s === this.last) return false;
    this.last = s;
    this.el.textContent = s;
    return true;
  }
  reset(): void { this.last = null; }
}

/** Two-number slot for anchored elements, rounded to whole pixels. */
export class PosSlot {
  private x = NaN;
  private y = NaN;
  private seen = false;
  changed(x: number, y: number): boolean {
    const rx = x === x ? Math.round(x) : NaN, ry = y === y ? Math.round(y) : NaN;
    if (this.seen && (rx === this.x || (rx !== rx && this.x !== this.x)) && (ry === this.y || (ry !== ry && this.y !== this.y))) return false;
    this.seen = true;
    this.x = rx; this.y = ry;
    return true;
  }
  get px(): number { return this.x; }
  get py(): number { return this.y; }
  reset(): void { this.seen = false; this.x = NaN; this.y = NaN; }
}
