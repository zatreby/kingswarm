// Tiny --flag value parser for the sim tools (no dependency).
export interface Args {
  str(k: string, d: string): string;
  num(k: string, d: number): number;
  opt(k: string): string | undefined;
  list(k: string): string[] | undefined;
  has(k: string): boolean;
}

export function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) { m.set(a.slice(2, eq), a.slice(eq + 1)); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { m.set(a.slice(2), next); i++; } else m.set(a.slice(2), 'true');
  }
  return {
    str: (k, d) => m.get(k) ?? d,
    num: (k, d) => {
      const v = m.get(k);
      if (v === undefined) return d;
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error(`--${k} expects a number, got "${v}"`);
      return n;
    },
    opt: (k) => m.get(k),
    list: (k) => {
      const v = m.get(k);
      if (v === undefined) return undefined;
      return v === '' || v === 'none' ? [] : v.split(',').map((s) => s.trim()).filter(Boolean);
    },
    has: (k) => m.has(k),
  };
}
