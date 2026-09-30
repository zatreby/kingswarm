# Interrupted stage: ai:build (kingswarm-ai-build)

Stopped by the lead on 2026-09-30 when the owner asked to save and close. Its edits are on disk and committed as-is.

## Files it wrote or edited

- `src/ai/types.ts`
- `src/ai/rng.ts`
- `src/ai/bot.test.ts`
- `src/ai/tells.test.ts`
- `src/ai/stuck.test.ts`
- `src/ai/golden.test.ts`
- `src/ai/perception.ts`
- `src/ai/brain.ts`
- `src/ai/nav.ts`
- `src/ai/motor.ts`
- `src/ai/plays.ts`
- `src/ai/bot.ts`
- `src/ai/golden.ts`
- `src/ai/profiles.ts`
- `src/ai/match.ts`
- `src/ai/index.ts`
- `tools/sim/trace.ts`
- `tools/sim/args.ts`
- `src/ai/brain.test.ts`
- `src/ai/profiles.test.ts`
- `src/ai/stats.ts`
- `src/ai/stats.test.ts`
- `tools/sim/pool.ts`
- `tools/sim/worker.ts`
- `tools/sim/report.ts`
- `tools/sim/run.ts`
- `tools/sim/matrix.ts`
- `tools/sim/tune.ts`
- `tools/sim/baseline.ts`

## Its own progress notes, oldest first (last 25)

- Now the implementation. Perception first: a ring of compact snapshots so the rival side is seen `reactionMs` late.
- Now the utility brain.
- Before the execution layer, a small grid planner so a King can never be trapped by static geometry (reactive steering alone has local minima in concave pockets).
- Now the execution layer.
- Now the signature plays with tells.
- Now the profile rows.
- The loop runs. Matches end by Throne capture very early (16-45 s), so I'll write a tracing tool to see what is going on.
- Matches now run through proper arcs. Losing sides get stuck defending with zero ammo, so I'm making regroup fire when badly out-gunned, then running the specs.
- Now specs for the brain rules, profiles and the stats the harness will use.
- Specs are green. Now the headless harness: a worker pool (at most 4 threads per STUDIO.md), `run.ts` and `matrix.ts`.
- Harness works: 40 matches in 11.5 s on 4 workers. But average loses 40/40 to Gorm with a third of his swarm, which smells like a bot weakness rather than balance. Tracing.
- Two execution weaknesses show up: the average King wanders alone while his parked garrisons get eaten, and he rarely recalls. Before tuning, let me see the whole landscape with a quick round-robin.
- Mutations have landed in the sim since I started (tsc is fully green now), so Brood and Gorm now play with Splitters/Big Litter and Brutes. Let me see how an expert loses to Brood.
- Every match still ends at a Throne. Before deciding whether that is bot behaviour or sim tuning, let me separate personality from Mutation power (rivals with `--mutB none`).
- Tells hold across 280 extra matches. Now a baseline driver so the report is reproducible with one command.
- The machine is busy (load ~9), so the baseline runs on 3 workers in the background.
- While that runs, a review pass over the execution layer and plays.
- I'll make sure the ambush mark is always free ground (a mark inside a rock would put the landing up to 1.45 units off the mark).
- The baseline is slower than planned (about 4 min per config under the current load), so I'll profile where a bot tick's time goes.
- While the baseline runs (no more edits to src/ai until it finishes), I'll add the npm script entries.
- The baseline is running. I'll wait for the configs to come in.
- I'll wait for the monitor events.
- Sable produced 13 dishonest tells in 200 matches. I'll reproduce a few in one process to see which tell and why.
- All four lies are ambush tells with Sable in the Blue seat. Tracing seed 32 around the tell.
- No lies in 60 Sable matches after the fix (4 in the first 34 before it). Waiting for the rest of the baseline.
