// The balance baseline: average vs every rival (level 0 and 4, with and without their Mutations),
// novice/expert vs Bumble and Gorm, and the average mirror for side fairness. One line per config
// plus the full summaries as JSON.
//   npx tsx tools/sim/baseline.ts [--n 200] [--workers 4] [--only gorm,mirror] [--json .cache/sim/baseline.json] [--tune path=v,...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { RIVALS } from '../../src/ai';
import { summarize } from '../../src/ai/stats';
import type { Summary } from '../../src/ai/stats';
import type { MutationId } from '../../src/sim';
import { parseArgs } from './args';
import { makeJobs, poolSize, runJobs } from './pool';
import { formatLine } from './report';
import { parseTune } from './tune';

interface Config { label: string; a: string; b: string; levelB: number; mutB?: MutationId[]; n: number }

async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2));
  const n = a.num('n', 200);
  const only = a.list('only');
  const configs: Config[] = [];
  for (const lv of [0, 4]) for (const r of RIVALS) configs.push({ label: `average vs ${r}@L${lv}`, a: 'average', b: r, levelB: lv, n });
  // personality alone (the rival's Mutations removed): separates AI strength from Mutation strength
  for (const r of RIVALS) configs.push({ label: `average vs ${r}@L0 no-mut`, a: 'average', b: r, levelB: 0, mutB: [], n: Math.ceil(n / 2) });
  for (const p of ['novice', 'expert']) for (const r of ['bumble', 'gorm']) configs.push({ label: `${p} vs ${r}@L0`, a: p, b: r, levelB: 0, n });
  configs.push({ label: 'average mirror', a: 'average', b: 'average', levelB: 0, n: n * 2 });

  const base = { map: a.str('map', 'meadow'), duration: a.num('duration', 150), crownOpensAt: a.num('crown', 90), tune: parseTune(a.list('tune')) };
  const out: Record<string, Summary> = {};
  const file = a.opt('json');
  if (file) mkdirSync(dirname(file), { recursive: true });
  const t0 = process.hrtime.bigint();
  for (const c of configs) {
    if (only && !only.some((o) => c.label.includes(o))) continue;
    const jobs = makeJobs(c.n, a.num('seed', 1), { ...base, a: { profile: c.a, level: 0 }, b: { profile: c.b, level: c.levelB, mutations: c.mutB } });
    const workers = poolSize(a.has('workers') ? a.num('workers', 4) : undefined, jobs.length);
    const recs = await runJobs(jobs, workers);
    const s = summarize(recs);
    out[c.label] = s;
    console.log(formatLine(s, c.label));
    // written after every config so a long run that is stopped still leaves its numbers
    if (file) writeFileSync(file, JSON.stringify({ config: { ...base, n }, summaries: out }, null, 2));
  }
  process.stderr.write(`baseline done in ${(Number(process.hrtime.bigint() - t0) / 1e9 / 60).toFixed(1)} min\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
