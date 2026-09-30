// Round-robin win-rate matrix of chosen profiles.
//   npx tsx tools/sim/matrix.ts --profiles novice,average,expert,bumble,gorm --n 60 [--level 0]
//     [--duration 150 --crown 90] [--map meadow] [--seed 1] [--workers 4] [--json out.json]
// Cell (row, col) = row's win rate against col (draws count half). Each pair plays n matches with
// seats alternating; the diagonal is a mirror match (row vs itself) only with --mirror.
import { writeFileSync } from 'node:fs';
import { profileFor } from '../../src/ai';
import { summarize } from '../../src/ai/stats';
import type { Summary } from '../../src/ai/stats';
import { parseArgs } from './args';
import { makeJobs, poolSize, runJobs } from './pool';
import type { Job } from './pool';

async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2));
  const ids = a.list('profiles') ?? ['novice', 'average', 'expert', 'bumble', 'pip', 'brood', 'gorm', 'sable', 'mora'];
  for (const id of ids) profileFor(id);
  const n = a.num('n', 60), level = a.num('level', 0), seed = a.num('seed', 1);
  const base = { map: a.str('map', 'meadow'), duration: a.num('duration', 150), crownOpensAt: a.num('crown', 90) };
  const pairs: [number, number][] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + (a.has('mirror') ? 0 : 1); j < ids.length; j++) pairs.push([i, j]);
  const jobs: Job[] = [];
  const owner: number[] = [];
  pairs.forEach(([i, j], k) => {
    for (const job of makeJobs(n, seed, { ...base, a: { profile: ids[i], level }, b: { profile: ids[j], level } })) {
      jobs.push(job);
      owner.push(k);
    }
  });
  const workers = poolSize(a.has('workers') ? a.num('workers', 4) : undefined, jobs.length);
  const t0 = process.hrtime.bigint();
  const recs = await runJobs(jobs, workers, (done, total) => { if (done % 20 === 0 || done === total) process.stderr.write(`\r  ${done}/${total} matches`); });
  process.stderr.write(`\r  ${recs.length} matches in ${(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1)} s on ${workers} workers\n`);

  const cell: (number | null)[][] = ids.map(() => ids.map(() => null));
  const summaries: Record<string, Summary> = {};
  pairs.forEach(([i, j], k) => {
    const s = summarize(recs.filter((_, q) => owner[q] === k));
    summaries[`${ids[i]}-${ids[j]}`] = s;
    cell[i][j] = s.winRateA;
    if (i !== j) cell[j][i] = 1 - s.winRateA;
  });
  const w = Math.max(8, ...ids.map((s) => s.length + 1));
  console.log(`win rate of row vs column, n=${n} per pair, level ${level}, ${base.duration}s / Crown at ${base.crownOpensAt}s`);
  console.log(''.padEnd(w) + ids.map((s) => s.padStart(w)).join(''));
  ids.forEach((r, i) => {
    const mean = cell[i].filter((x): x is number => x !== null);
    console.log(r.padEnd(w) + cell[i].map((x) => (x === null ? '-' : `${(x * 100).toFixed(0)}%`).padStart(w)).join('')
      + `   avg ${(mean.reduce((p, q) => p + q, 0) / Math.max(1, mean.length) * 100).toFixed(0)}%`);
  });
  const out = a.opt('json');
  if (out) writeFileSync(out, JSON.stringify({ ids, n, level, config: base, matrix: cell, summaries }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
