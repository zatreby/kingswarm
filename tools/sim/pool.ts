// Worker pool for headless bot matches. At most 4 workers (design/STUDIO.md: the laptop has 4
// cores, 7 GB RAM and is shared), fewer when free memory is low. Jobs go out in small batches so
// the pool stays balanced; each worker is a node:worker_threads isolate (~50-80 MB).
import { freemem } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { HeroId, MutationId } from '../../src/sim';
import type { SeatedRecord } from '../../src/ai/stats';

export interface SideJob {
  profile: string;
  level: number;
  hero?: HeroId;
  mutations?: MutationId[];
}

export interface Job {
  seed: number;
  map: string;
  duration: number;
  crownOpensAt: number;
  /** Side A and side B; A plays seat `seatA`. */
  a: SideJob;
  b: SideJob;
  seatA: 0 | 1;
}

export const MAX_WORKERS = 4;
const BATCH = 4;
/** Keep this much memory free for the owner and other agents. */
const RESERVE_MB = 800;
const PER_WORKER_MB = 120;

export function poolSize(requested: number | undefined, jobs: number): number {
  const byMem = Math.max(1, Math.floor((freemem() / 2 ** 20 - RESERVE_MB) / PER_WORKER_MB));
  return Math.max(1, Math.min(MAX_WORKERS, requested ?? MAX_WORKERS, byMem, jobs));
}

export async function runJobs(jobs: Job[], workers: number, onProgress?: (done: number, total: number) => void): Promise<SeatedRecord[]> {
  const out: SeatedRecord[] = new Array(jobs.length);
  let next = 0, done = 0;
  const url = new URL('./worker.ts', import.meta.url);
  await Promise.all(Array.from({ length: workers }, () => new Promise<void>((resolve, reject) => {
    const w = new Worker(url);
    let batch: number[] = [];
    const feed = () => {
      if (next >= jobs.length) { void w.terminate().then(() => resolve()); return; }
      batch = [];
      for (let i = 0; i < BATCH && next < jobs.length; i++) batch.push(next++);
      w.postMessage(batch.map((i) => jobs[i]));
    };
    w.on('message', (recs: SeatedRecord[]) => {
      recs.forEach((r, k) => { out[batch[k]] = r; });
      done += recs.length;
      onProgress?.(done, jobs.length);
      feed();
    });
    w.on('error', reject);
    feed();
  })));
  return out;
}

/** n jobs for side A vs side B, seats alternating so neither side always plays Blue. */
export function makeJobs(n: number, seed: number, base: Omit<Job, 'seed' | 'seatA'>): Job[] {
  const jobs: Job[] = [];
  for (let i = 0; i < n; i++) jobs.push({ ...base, seed: seed + i, seatA: (i % 2) as 0 | 1 });
  return jobs;
}
