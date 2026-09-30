export const meta = {
  name: 'kingswarm-ai-build',
  description: 'Build rival bots (utility AI through PlayerInput), player-proxy and golden bots, and the headless bot-sim metrics harness; verify independently; fix',
  phases: [
    { title: 'Build', detail: 'bots, profiles, harness, baseline metrics', model: 'opus' },
    { title: 'Verify', detail: 'independent run of harness, cheat/determinism/stuck checks', model: 'opus' },
    { title: 'Fix', detail: 'apply verified findings', model: 'opus' },
  ],
}
const REPORT = {
  type: 'object',
  properties: {
    built: { type: 'array', items: { type: 'string' } },
    api_summary: { type: 'string' },
    verified: { type: 'string' },
    baseline_metrics: { type: 'string' },
    tuning_recommendations: { type: 'array', items: { type: 'string' } },
    fragile_or_unfinished: { type: 'array', items: { type: 'string' } },
    contract_requests: { type: 'array', items: { type: 'string' } },
  },
  required: ['built', 'api_summary', 'verified', 'baseline_metrics', 'fragile_or_unfinished'],
}
const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
      summary: { type: 'string' }, evidence: { type: 'string' }, suggested_fix: { type: 'string' } },
      required: ['severity', 'summary', 'evidence'] } },
    metrics_observed: { type: 'string' },
    overall: { type: 'string' },
  },
  required: ['findings', 'overall'],
}
const COMMON = `
You are the studio's AI/gameplay engineer on Kingswarm, working in /home/turbo/creative-game (branch v1). CLAUDE.md (studio rules) is in your context. Read first: design/GDD.md (sections 3, 5, 6, 7), design/research/fun-ai.md (architecture recommendation, personalities, difficulty knobs, metrics plan: this is your blueprint), design/STUDIO.md (machine limits: at most 4 CPU-heavy processes), then the simulation's public API in src/sim/index.ts, src/sim/types.ts, src/sim/tuning.ts and src/sim/maps.ts.

The simulation core is finished and tested; a colleague is adding Mutations inside src/sim right now, so src/sim files may change under you and a test run may transiently fail inside src/sim: if that happens for reasons unrelated to your code, wait a minute and retry. Import the sim only through src/sim/index.ts. Never edit src/sim; put requests in contract_requests.

You own: src/ai/**, tools/sim/** (headless harness, run with npx tsx), and the npm script entries "sim" you need (tell the lead the exact lines instead of editing package.json if another agent has it open; a one-line addition is fine).
Architecture law: a bot is a player. It reads the World (read-only) and returns a PlayerInput each tick. It must not write to the World, must use its own seeded PRNG (not world.rng, not Math.random) so a match is reproducible from (seed, config, bot profiles), and must have human-like limits: perception delayed by reaction time, aim error, a decision interval, finite button rate.
`
phase('Build')
const build = await agent(COMMON + `
TASK: build the bots and the bot-sim harness, test-first where behaviour can be stated as a rule.

1. src/ai/types.ts:
   interface Bot { think(world: World): PlayerInput; drainSignals(): BotSignal[]; readonly intent: string }   // intent = current intent + reason string, for debugging and barks
   type BotSignal = { kind: 'tell'; tell: 'push' | 'crownPush' | 'ambush' | 'hoard' | 'raid'; x: number; y: number; lead: number } | { kind: 'bark'; text: string }
   interface BotProfile { id; personality weights per intent/consideration; skill: { reactionMs, thinkMs, aimErrorDeg, tellLeadS, recallEfficiency, usesDash, usesAbility, usesUltimate, dodges, maxCommit }; signature play ids; bark lines } (plain data)
   createBot(team: Team, profile: BotProfile, seed: number): Bot
2. Decision model per fun-ai.md: utility scoring over intents Expand(building), Defend(building), Raid(building or Throne), HuntKing, TakeCrown, Regroup (recall + retreat toward own buildings when weak or hurt), with response curves, an inertia bonus for the current intent, weighted-random choice among the top 2 (bot PRNG), and a veto mechanism. Execution layer turns the intent into inputs: path toward the goal sliding around obstacles and buildings (World has obstacles; use simple steering, make sure a bot can never get permanently stuck: add an unstuck rule and test it), stand at a sensible throwing distance, aim with lead on moving targets plus aim error, fire discipline (keep a reserve when the rival King is near, stop firing when out of followers, recall when most of the swarm is away and idle), use dash to dodge incoming volleys or close/escape, use each hero's Ability and Ultimate sensibly (GDD section 5; read tuning for ranges and cooldowns).
3. Signature plays with tells (fun-ai.md section 2 and GDD section 6 table): the bot decides, emits a 'tell' signal with its lead time, and only then commits; a tell must never lie (test: every tell is followed by the announced action within lead + 1 s unless the bot's King dies). Emit short 'bark' signals on intent changes (2-4 words, in character).
4. Profiles (src/ai/profiles.ts), each a data row: the six rivals bumble, pip, brood, gorm, sable, mora with the personalities, signature plays and flaws from the GDD table; a function scaleProfile(profile, level 0..8) that sharpens skill and unlocks tactics with Crown Level (GDD section 7; difficulty = execution + tactics, never hidden stat boosts); three player-proxy profiles novice / average / expert that play like plausible humans of that skill (novice: slow reactions, poor aim, rarely recalls or dashes, forgets abilities; expert: near what a good human does) for balance sims; golden scripted bots for regression (idle, turtleForever, throneRush, crownCamp, spamFire, monkey random inputs) as in fun-ai.md section 5.
5. Harness tools/sim/run.ts (npx tsx tools/sim/run.ts --a average --b gorm --n 200 --heroA brawler --heroB brawler --mutA a,b --mutB c --map meadow --duration 150 --crown 90 --seed 1 [--json out.json]): runs matches headless as fast as possible across a worker pool of at most 4 (node:worker_threads or child processes; keep RAM small), and prints a table + JSON with the metrics from fun-ai.md section 5: win rate with 95% CI, ending mix (throne / crown / time / overtime), match length median/p10/p90, time to first capture, lead changes (define the lead score as in the research), comeback rate, snowball index, King deaths per match, throws per minute, average swarm sizes, stuck/degeneracy flags (no capture in 30 s, a King idle > 10 s, NaN). Also tools/sim/matrix.ts: round-robin of chosen profiles, printing a win-rate matrix.
   Write these so they also work when Mutations are passed (TeamSetup.mutations); if a Mutation is not implemented yet in the sim it is simply inert.
6. Tests (Vitest, src/ai): determinism (same seed and profiles -> identical hashWorld at the end); bots never mutate the world (deep-freeze or hash the world around think()); tells never lie; no bot is stuck (position variance over a window) across 20 seeds; golden bands as coarse sanity (idle loses to every rival; each rival beats novice more often than expert; expert beats bumble > 85% at level 0). Keep test runtime reasonable (under ~60 s total): use fewer/shorter matches in tests and the harness for the big numbers.
7. Baseline report: run the harness for average-vs-each-rival (n >= 200 each, level 0 and level 4) and novice/expert vs bumble and gorm, plus the mirror average-vs-average for side fairness. Compare against the GDD section 3.4 targets (ending mix, lead changes, time-outs) and the first-run promise that a novice beats Bumble most of the time. Put the numbers in baseline_metrics and concrete, evidence-based tuning recommendations (sim tuning or profile changes) in tuning_recommendations. Do not change src/sim/tuning.ts yourself.

Finish when npx vitest run src/ai and npx tsc --noEmit are green for your files.
`, { label: 'ai:build', phase: 'Build', model: 'opus', effort: 'high', schema: REPORT })

phase('Verify')
const verify = await agent(`You are an independent verifier for the Kingswarm bot AI in /home/turbo/creative-game (see CLAUDE.md for the architecture law: bots are players, read-only on the World, own seeded PRNG; and design/research/fun-ai.md for intent; design/GDD.md section 6 for the rival table). The engineer's report: ${JSON.stringify(build)}.

Do not trust the report: gather your own evidence, and do not edit repo files (scratch scripts go in /home/turbo/creative-game/.cache/verify-ai/ and may import from the repo). Check:
1. Cheating and purity: does any file in src/ai write to World fields, call Math.random/Date/performance, or read world.rng? Prove determinism by running the same match twice and comparing hashWorld, and with two different seeds.
2. Human-likeness limits are real: measure from recorded inputs that aim changes lag target movement by about the profile's reaction time, that button presses are not superhuman (no ability use on the very tick a condition becomes true), and that aim error exists.
3. Tells never lie: record BotSignals over 30 matches per rival and check each tell is followed by the announced behaviour.
4. Stuck/degenerate behaviour: run the harness (npx tsx tools/sim/run.ts ...) for every rival vs the three player proxies at n=100 and look at the degeneracy flags, time-outs, ending mix, match lengths; sample 3 matches per rival and print a compact timeline (every 5 s: positions, followers, buildings, intent string) to READ whether the rival behaves like its GDD personality (Gorm really marches on the Throne after a horn tell and is then exposed; Pip turtles then pushes the Crown; Sable ambushes; Bumble hoards then pushes; Brood floods; Mora two phases). Say where behaviour does not match the character.
5. Difficulty ladder is monotonic: expert > average > novice against each rival, and scaleProfile level 8 > level 4 > level 0 against the average proxy.
6. Re-run a sample of the engineer's baseline numbers and say whether they reproduce.
Report only verified findings with evidence (commands and numbers). Severity: critical = cheating, nondeterminism, crash, permanently stuck bot; major = personality not expressed, ladder not monotonic, lying tell, harness metric wrong; minor = the rest.`,
  { label: 'ai:verify', phase: 'Verify', model: 'opus', effort: 'high', schema: FINDINGS })

phase('Fix')
let fix = null
if (verify && verify.findings && verify.findings.length) {
  fix = await agent(COMMON + `
TASK: the bots and harness exist (engineer report: ${JSON.stringify(build)}). An independent verifier found: ${JSON.stringify(verify)}.
For each finding: reproduce (a failing test first where it is a rule), fix at the root, confirm. Reject a finding only with evidence. Critical and major first. Then re-run the baseline (average vs each rival at level 0 and 4, n >= 200; novice/expert vs bumble and gorm; mirror) and report fresh numbers and tuning recommendations. Finish when npx vitest run src/ai and npx tsc --noEmit are green for your files.
`, { label: 'ai:fix', phase: 'Fix', model: 'opus', effort: 'high', schema: REPORT })
}
return { build, verify, fix }
