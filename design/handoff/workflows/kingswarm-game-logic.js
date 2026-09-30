export const meta = {
  name: 'kingswarm-game-logic',
  description: 'Build the pure game layer: rivals/heroes content, arenas, Conquest run state machine, draft, profile/unlocks, battle facts; verify; fix',
  phases: [
    { title: 'Build', detail: 'content, arenas, run, draft, profile, unlocks, facts (pure TS + tests)', model: 'opus' },
    { title: 'Verify', detail: 'rules vs GDD, edge cases, test quality', model: 'sonnet' },
    { title: 'Fix', detail: 'apply verified findings', model: 'opus' },
  ],
}
const REPORT = {
  type: 'object',
  properties: {
    built: { type: 'array', items: { type: 'string' } },
    api_summary: { type: 'string' },
    verified: { type: 'string' },
    design_decisions: { type: 'array', items: { type: 'string' } },
    fragile_or_unfinished: { type: 'array', items: { type: 'string' } },
    contract_requests: { type: 'array', items: { type: 'string' } },
  },
  required: ['built', 'api_summary', 'verified', 'fragile_or_unfinished'],
}
const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
      file: { type: 'string' }, summary: { type: 'string' }, evidence: { type: 'string' }, suggested_fix: { type: 'string' } },
      required: ['severity', 'summary', 'evidence'] } },
    overall: { type: 'string' },
  },
  required: ['findings', 'overall'],
}
const COMMON = `
You are a senior gameplay engineer on Kingswarm, working in /home/turbo/creative-game (branch v1). CLAUDE.md (studio rules) is in your context. Read first: design/GDD.md (all; sections 4-7 are your spec), design/research/retention.md (bottom line + section 4A), design/research/onboarding-ux.md (FTUE script and flow map), then src/sim/index.ts, src/sim/types.ts, src/sim/mutations.ts (the Mutation catalogue: ids, names, tags, requires) and src/sim/maps.ts (MapDef format and the 'meadow' map).
You own src/game/** only. Everything here is PURE logic: no DOM, no Three.js, no audio, no timers; randomness from an explicit seeded PRNG passed in or stored in the state (src/sim/math.ts exports PRNG helpers; import via src/sim/index.ts if exported, otherwise copy the 6-line mulberry32 locally and say so). Persistence goes through an injected storage adapter so it runs under Vitest in Node. Other engineers own src/sim (being extended with Mutations right now; if a sim test fails for reasons unrelated to you, ignore it), src/ai (bots; you only reference bot profile ids as strings: 'bumble' | 'pip' | 'brood' | 'gorm' | 'sable' | 'mora' plus a level number), src/render (King look ids as strings: 'brawler' | 'blink' | 'warden' | 'bumble' | 'pip' | 'brood' | 'gorm' | 'sable' | 'mora'), and src/ui. An integrator will wire your layer to them later, so keep your API small, typed and documented in src/game/index.ts.
Run tests with npx vitest run src/game and typecheck with npx tsc --noEmit.
`
phase('Build')
const build = await agent(COMMON + `
TASK: build the game layer test-first.

1. src/game/content.ts
   - HEROES: per HeroId: display name, one-line playstyle, ability + ultimate names and one-line descriptions (GDD section 5), look id, unlock condition.
   - RIVALS: the six rivals from the GDD section 6 table as data rows: id, name, title, hero, mutations, look, arena id, bot profile id, two traits (icon id + 1-2 word label), the one-line "question it asks", the flaw hint (revealed in the Codex after the first win), 6-10 short in-character bark lines by situation (start, push, hurt, winning, losing, defeated), and base battle timing.
   - Battle timing ramp by ladder position (GDD section 6: Crown opens at 0:45 of 1:45 for the first battle, up to 1:30 of 2:30 for the Boss; interpolate sensibly).
2. src/game/arenas.ts: one MapDef per rival arena (the sim accepts any MapDef): reuse 'meadow' for Bumble; design 'tinkerworks' for Pip (each side has 1-2 Towers guarding the approach to its Throne and the Crown, per the GDD question "can you siege: out-range, flank, bait"), and distinct but fair layouts for Brood (more huts, open centre), Gorm (a short direct lane between Thrones plus side huts: defend or counter-raid), Sable (scattered obstacles/tree clumps that break line of approach), and the Boss 'crownhall' (Towers near the Crown, more buildings). Rules every arena must satisfy, enforced by a test over all arenas: all coordinates inside the 32 x 18 arena with at least 1.2 margin; Blue half only (the sim mirrors through the centre), so nothing within 1.5 of the centre line except via 'centre'; no building overlaps another building or an obstacle (capture zones must not overlap: distance >= sum of radii + 1.6); 4-7 buildings per side; obstacles never block the straight path between a Throne and its nearest hut; total buildings <= 17. Use createWorld to prove each arena builds.
3. src/game/run.ts: the Conquest run as an immutable state machine (plain serialisable RunState + pure transition functions returning new states):
   - newRun({ hero, seed, crownLevel, profile }) -> RunState with the ladder: first-ever run = Bumble, Pip, then two of {Brood, Gorm, Sable} in rising difficulty, then Mora; later runs = Bumble first, three of the four others in rising order (seeded), then Mora. 2 lives. Phase flow: 'rivalCard' -> 'battle' -> 'result' -> ('draft' -> 'rivalCard' ...) | 'runWon' | 'runLost'. A lost battle costs a life and rematches the same rival (no draft); zero lives = 'runLost'. After the Boss win = 'runWon'.
   - battleSetup(run, profile) -> { config: MatchConfig (seeded per battle; player is team 0 with the run's hero and Mutations; rival is team 1 with its hero/Mutations, plus extra Mutations at higher Crown Levels), rival: RivalDef, botProfileId, botLevel, looks: [string, string], battleIndex, battlesTotal }. Apply: Assist hatchMul to the player when enabled; a gentle economy handicap (rival hatchMul < 1) only for the first two rivals of a player's first run (GDD section 6 rival rules); Crown Level effects per GDD section 7, each level adding something FELT, defined as a data table CROWN_LEVELS[1..8] (e.g. 1: rivals play sharper (bot level +2); 2: every rival has one extra Mutation; 3: Crown needs 8 s... choose a coherent set, keep them few and distinct, and explain each in one player-facing line).
   - Draft: offers(run, profile) -> 3 distinct Mutation ids from the player's unlocked pool, never owned ones, Duo Mutations only when their required tags are owned (and then favoured so recipes get discovered), at least one offer that counters the NEXT rival's gimmick when the pool allows (define a small counters table rival -> helpful Mutation ids with a one-line reason each), max 5 drafted Mutations (when full, the draft is skipped). pick(run, id), reroll(run) (1 per run), skip(run). All seeded and reproducible.
   - applyBattleResult(run, result) where result = { won, reason, duration, facts }.
4. src/game/facts.ts: a BattleFacts tracker: createFacts(), observe(facts, world) called after every sim step (reads world + world.events, O(1) per call apart from event loop), and summarise(facts, world, team) -> the 2-3 most interesting one-line facts for the result screen, prioritising near-misses on a loss ("Crown held 8.4 of 10 s", "Their Throne was down to 9%") and brags on a win ("Throne taken at 1:12", "Swarm peak 46", "3 King takedowns"), plus raw numbers for local telemetry.
5. src/game/profile.ts: Profile (versioned, plain data): settings (volumes, mute, shake, reduceFlash, colorBlind, fireMode hold|toggle, aimAssist, uiScale, hints, assist), unlocked heroes and Mutations, codex (per Mutation: discovered, times picked; Duo recipes found; per rival: met, beaten, best per hero and Crown Level), crownLevel reached per hero, runs played/won, assist bonus (GDD section 7: +5% hatch per lost run up to +30%, reset on a win), FTUE flags (which hint prompts were already shown), saved run in progress (for Continue), local telemetry counters (pick counts, win rate per Mutation, run lengths: the retention research asks for this). load(storage)/save(storage, profile) with a storage adapter interface { getItem, setItem }, surviving corrupt JSON, missing keys, version migration, and storage that throws (in-memory fallback). A defaultProfile() for first launch.
6. src/game/unlocks.ts: unlocks are options, never power. Starting pool: a curated ~9 Mutations that are easy to understand (at least 2 per tag) and the Brawler. A data table of unlock rules so that each of the first ten runs unlocks something (a Mutation or two entering the pool, Blink after the first completed run win or lose, Warden after the first Boss win, Duo recipes become findable once both tags are in the pool), then Crown Levels per hero. finishRun(profile, run) -> { profile, unlocked: UnlockEvent[] } and also per-battle updates (rival met/beaten). Test the cadence: simulate a player who loses early every run, and one who wins every run; both must unlock something on each of runs 1-10 and nothing may be unlocked twice.
7. src/game/index.ts: the public API with doc comments, and a short example in a comment of one full run loop.

Tests beside the code; include a property-style test that plays 500 seeded runs with random win/loss and random picks and asserts invariants (lives never negative, no duplicate Mutations, phases only advance legally, ladder length 5, draft never offers owned or locked or requirement-unmet Mutations, serialising and reloading a RunState mid-run continues identically).
Finish when npx vitest run src/game and npx tsc --noEmit are green for your files. List the design decisions you had to make where the GDD was silent.
`, { label: 'game:build', phase: 'Build', model: 'opus', effort: 'high', schema: REPORT })

phase('Verify')
const verify = await agent(`You are an independent reviewer of the pure game layer of Kingswarm in /home/turbo/creative-game/src/game (TypeScript). Spec: design/GDD.md sections 4-7 and design/research/onboarding-ux.md flow map; studio rules in CLAUDE.md. Engineer's report: ${JSON.stringify(build)}.
Do not edit repo files; scratch scripts go in /home/turbo/creative-game/.cache/verify-game/ (create it) and may import from the repo; run them with npx tsx. Check, with evidence:
1. Rules vs GDD: ladder composition, lives and rematch, draft rules (3 offers, no owned, Duo gating, counter bias, cap 5, reroll once), unlock philosophy (options not power; first ten runs each unlock something for both a losing and a winning player), assist, Crown Levels each adding something felt, arenas satisfying their constraints and actually building with createWorld, every rival row matching the GDD table.
2. Edge cases by script: corrupt/missing/throwing storage; resuming a saved run in every phase; rerolling with a tiny pool; draft when fewer than 3 Mutations are available; picking an id not on offer (must be rejected); applying a result in the wrong phase; Crown Level above the table; profile from an older version.
3. Purity: no DOM/three/audio imports, no Math.random/Date.now in src/game (a run must be reproducible from its seed), no mutation of input states by transition functions (freeze inputs and run).
4. Test quality: break 5 important rules by editing the code temporarily (then restore with git checkout -- src/game and confirm git status is clean for src/game) and see whether a test fails; list rules with no test.
5. Player-facing text quality: names, traits, questions, barks, fact lines and Crown Level lines: short, clear, in the playful tone of the GDD, no jargon, no more than 8 words for anything shown mid-battle.
Report only verified findings. Severity: critical = crash, corrupt save, soft-lock (a state with no legal transition); major = GDD rule wrong/missing; minor = the rest.`,
  { label: 'game:verify', phase: 'Verify', model: 'sonnet', effort: 'high', schema: FINDINGS })

phase('Fix')
let fix = null
if (verify && verify.findings && verify.findings.length) {
  fix = await agent(COMMON + `
TASK: the game layer exists (engineer report: ${JSON.stringify(build)}). A reviewer found: ${JSON.stringify(verify)}.
For each finding: write the failing test first, fix at the root, confirm green. Reject only with evidence. Critical and major first, then cheap minors. Keep the public API stable or describe changes in api_summary. Finish when npx vitest run src/game and npx tsc --noEmit are green for your files; give the final api_summary the integrator will code against.
`, { label: 'game:fix', phase: 'Fix', model: 'opus', effort: 'medium', schema: REPORT })
}
return { build, verify, fix }
