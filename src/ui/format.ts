// Pure formatting helpers (tested in format.test.ts).

/** Battle clock for seconds remaining: ceil so "0:01" shows until the clock truly hits zero. */
export function formatClock(seconds: number): string {
  const s = seconds > 0 ? Math.ceil(seconds - 1e-6) : 0;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

/** Elapsed time for facts and run totals: "1:12", "14:05", "1:02:09". */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 && m < 10 ? '0' + m : String(m);
  return (h > 0 ? h + ':' : '') + mm + ':' + (r < 10 ? '0' : '') + r;
}

/** Whole seconds left on a cooldown, or '' when ready. */
export function cooldownLabel(cd: number): string {
  return cd > 0.05 ? String(Math.ceil(cd - 1e-6)) : '';
}

/** Quantise 0..1 to n steps so per-frame writes only happen when the visible value moves. */
export function quantize(v: number, steps: number): number {
  if (!(v > 0)) return 0;
  if (v >= 1) return steps;
  return Math.round(v * steps);
}

export function ordinalBattle(index: number, total: number, boss?: boolean): string {
  return boss ? 'Final battle' : `Battle ${index} of ${total}`;
}

export function plural(n: number, one: string, many: string): string {
  return n + ' ' + (n === 1 ? one : many);
}
