import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The sim must be a pure, deterministic function of (world, inputs). This spec scans the
// shipped sim sources (not the specs, which may time themselves) for anything that would break that.
const ROOT = join(__dirname);

function simSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...simSources(p));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

// Built by concatenation so this file does not match itself if the scan is ever widened.
const M = 'Math.';
const BANNED: [RegExp, string][] = [
  [new RegExp(`${M.replace('.', '\\.')}random`), 'Math.random'],
  [/\bDate\b/, 'Date'],
  [/\bperformance\b/, 'performance'],
  [/\bdocument\b/, 'document'],
  [/\bwindow\b/, 'window'],
  [/\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/, 'timers'],
];
// Implementation-approximated maths (ECMAScript lets engines differ): only math.ts may touch them.
const APPROX = /Math\.(sin|cos|tan|asin|acos|atan|atan2|exp|expm1|log|log2|log10|pow|hypot|sinh|cosh|tanh|cbrt)\b|\*\*/;

describe('sim purity', () => {
  const files = simSources(ROOT);

  it('finds the sim sources', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const f of files) {
    const rel = relative(ROOT, f);
    const src = readFileSync(f, 'utf8')
      // strip comments so prose may mention the forbidden names
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    it(`${rel} has no clocks, randomness or DOM`, () => {
      for (const [re, name] of BANNED) expect(re.test(src), `${rel} uses ${name}`).toBe(false);
    });

    if (rel !== 'math.ts') {
      it(`${rel} routes approximated maths through math.ts`, () => {
        expect(APPROX.test(src), `${rel} calls approximated maths directly`).toBe(false);
      });
    }

    it(`${rel} imports nothing outside src/sim`, () => {
      const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec.startsWith('.'), `${rel} imports package ${spec}`).toBe(true);
        const resolved = relative(ROOT, join(f, '..', spec));
        expect(resolved.startsWith('..'), `${rel} escapes src/sim via ${spec}`).toBe(false);
      }
    });
  }
});
