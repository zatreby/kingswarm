import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The game layer is pure logic: no DOM, timers, clocks, ambient randomness, rendering or audio.
// Comments are stripped first (index.ts documents an integration example that uses them).
const ROOT = join(__dirname);
const M = 'Math.';
const BANNED: [RegExp, string][] = [
  [new RegExp(`${M.replace('.', '\\.')}random`), 'Math.random'],
  [/\bDate\b/, 'Date'],
  [/\bperformance\b/, 'performance'],
  [/\bdocument\b|\bwindow\b|\blocalStorage\b|\bsessionStorage\b/, 'DOM'],
  [/\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/, 'timers'],
  [/from '(three|\.\.\/(render|audio|ui|net)[^']*)'/, 'presentation import'],
  [/from '\.\.\/sim\/(?!index)[^']*'/, 'sim internals (use ../sim)'],
];
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('game purity', () => {
  const files = readdirSync(ROOT).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  it('finds the sources', () => expect(files.length).toBeGreaterThanOrEqual(7));
  for (const f of files) {
    it(`${f} is pure`, () => {
      const src = strip(readFileSync(join(ROOT, f), 'utf8'));
      for (const [re, what] of BANNED) expect(re.test(src), `${f} uses ${what}`).toBe(false);
    });
  }
});
