// One pool worker: runs the matches it is sent and posts the records back.
import { parentPort } from 'node:worker_threads';
import { runMatch } from '../../src/ai/match';
import type { SideSpec } from '../../src/ai/match';
import type { SeatedRecord } from '../../src/ai/stats';
import type { Job, SideJob } from './pool';
import { applyTune } from './tune';

const side = (s: SideJob): SideSpec => ({ profile: s.profile, level: s.level, hero: s.hero, mutations: s.mutations });

let tuned = false;

parentPort!.on('message', (jobs: Job[]) => {
  // every job of a run carries the same overrides; apply them once per worker
  if (!tuned && jobs[0]?.tune?.length) { applyTune(jobs[0].tune); tuned = true; }
  const out: SeatedRecord[] = jobs.map((j) => {
    const sides: [SideSpec, SideSpec] = j.seatA === 0 ? [side(j.a), side(j.b)] : [side(j.b), side(j.a)];
    const r = runMatch({ seed: j.seed, map: j.map, duration: j.duration, crownOpensAt: j.crownOpensAt, sides });
    return { ...r, seatA: j.seatA };
  });
  parentPort!.postMessage(out);
});
