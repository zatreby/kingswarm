// Bot-vs-bot balance runs, headless, as fast as the worker pool allows.
//   npx tsx tools/sim/run.ts --a average --b gorm --n 200 [--levelA 0 --levelB 4] [--heroA brawler --heroB brawler]
//     [--mutA a,b --mutB c] [--map meadow] [--duration 150 --crown 90] [--seed 1] [--workers 4]
//     [--tune building.captureRate=10,...] [--json out.json] [--records]
// Side A and side B alternate seats (Blue/Red) match by match. Hero and Mutations default to the
// profile's own (a rival's identity); pass --heroX / --mutX to override ("--mutB none" for none).
// Mutations the sim has not implemented yet are simply inert.
import { writeFileSync } from 'node:fs';
import { profileFor } from '../../src/ai';
import { summarize } from '../../src/ai/stats';
import type { HeroId, MutationId } from '../../src/sim';
import { parseArgs } from './args';
import { parseTune } from './tune';
import { makeJobs, poolSize, runJobs } from './pool';
import { formatSummary } from './report';

async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2));
  const A = a.str('a', 'average'), B = a.str('b', 'bumble');
  const levelA = a.num('levelA', 0), levelB = a.num('levelB', a.num('level', 0));
  profileFor(A); profileFor(B); // fail fast on typos
  const n = a.num('n', 200);
  const base = {
    map: a.str('map', 'meadow'),
    duration: a.num('duration', 150),
    crownOpensAt: a.num('crown', 90),
    tune: parseTune(a.list('tune')),
    a: { profile: A, level: levelA, hero: a.opt('heroA') as HeroId | undefined, mutations: a.list('mutA') as MutationId[] | undefined },
    b: { profile: B, level: levelB, hero: a.opt('heroB') as HeroId | undefined, mutations: a.list('mutB') as MutationId[] | undefined },
  };
  const jobs = makeJobs(n, a.num('seed', 1), base);
  const workers = poolSize(a.has('workers') ? a.num('workers', 4) : undefined, jobs.length);
  const t0 = process.hrtime.bigint();
  let lastPct = -1;
  const recs = await runJobs(jobs, workers, (done, total) => {
    const p = Math.floor((done / total) * 10);
    if (p !== lastPct) { lastPct = p; process.stderr.write(`\r  ${done}/${total} matches`); }
  });
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  process.stderr.write(`\r  ${recs.length} matches in ${secs.toFixed(1)} s on ${workers} workers\n`);

  const s = summarize(recs);
  const label = `${A}${levelA ? `@L${levelA}` : ''} vs ${B}${levelB ? `@L${levelB}` : ''}${base.tune.length ? ` [${a.str('tune', '')}]` : ''}`;
  console.log(formatSummary(s, label));
  const out = a.opt('json');
  if (out) {
    writeFileSync(out, JSON.stringify({ label, config: { ...base, n, seed: a.num('seed', 1) }, summary: s, records: a.has('records') ? recs : undefined }, null, 2));
    process.stderr.write(`  wrote ${out}\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
