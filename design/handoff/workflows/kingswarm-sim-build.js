export const meta = {
  name: 'kingswarm-sim-build',
  description: 'Build the deterministic Kingswarm simulation test-first: core rules, then mutations, then adversarial review and fixes',
  phases: [
    { title: 'Core', detail: 'world, heroes, swarm gun, critters, buildings, match arc, abilities', model: 'opus' },
    { title: 'Mutations', detail: 'all 22 mutations as rule rewrites with tests', model: 'opus' },
    { title: 'Review', detail: 'determinism/perf, rules-vs-GDD, test quality', model: 'opus' },
    { title: 'Fix', detail: 'apply confirmed findings', model: 'opus' },
  ],
}

const REPORT = {
  type: 'object',
  properties: {
    built: { type: 'array', items: { type: 'string' } },
    verified: { type: 'string' },
    test_summary: { type: 'string' },
    fragile_or_unfinished: { type: 'array', items: { type: 'string' } },
    contract_changes: { type: 'array', items: { type: 'string' } },
    notes_for_lead: { type: 'string' },
  },
  required: ['built', 'verified', 'test_summary', 'fragile_or_unfinished', 'contract_changes'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          file: { type: 'string' },
          summary: { type: 'string' },
          evidence: { type: 'string' },
          suggested_fix: { type: 'string' },
        },
        required: ['severity', 'file', 'summary', 'evidence'],
      },
    },
    overall: { type: 'string' },
  },
  required: ['findings', 'overall'],
}

const COMMON = `
You are a senior gameplay engineer at the Kingswarm studio, working in /home/turbo/creative-game (branch v1). CLAUDE.md there holds the studio rules (already in your context). Read design/GDD.md sections 3-6 and src/sim/types.ts before writing anything. The old prototype /home/turbo/creative-game/kingswarm.html (one dense file, px units, 1 world unit = 40 px) is the behavioural reference for how the swarm gun, critter states, capture and abilities worked; the owner's verdict on it was "firing is great, balanced" so preserve that behaviour where the GDD does not say otherwise.

You own src/sim/** in this task, including types.ts. Keep the contract's shape and meaning; additive changes are fine; list every contract change in your report. Touch nothing outside src/sim/.
Run tests with: npx vitest run src/sim   and typecheck with: npx tsc --noEmit
`

phase('Core')
const core = await agent(COMMON + `
TASK: build the simulation core, test-first.

Files (suggested; keep modules small):
- src/sim/math.ts      seeded PRNG (mulberry32-style using Math.imul, state in world.rng), vector helpers, and wrappers for any trig (sin/cos/atan2) so the rest of the sim never calls Math trig, Math.random, Date or performance directly.
- src/sim/tuning.ts    every gameplay number, named and grouped (hero, fire, critter, building, match, abilities per hero). One exported const object, typed.
- src/sim/maps.ts      MapDef content. Create 'meadow': Blue throne at (3.5,14.5); Blue huts at (8.5,12), (4.5,8.5), (12,15.5), (12.5,7), (8.5,3.8); Crown at arena centre (16,9); 3-4 small obstacles per half that do not block the direct routes. Red is the point mirror through (16,9).
- src/sim/world.ts     createWorld(config): World. Each team starts with tuning.startSwarm followers around its King at its Throne.
- src/sim/step.ts      step(world, inputs): advances exactly one tick by running systems in a fixed documented order; clears world.events first.
- src/sim/systems/*.ts heroes (movement with acceleration, dash with i-frames, regen, auto-swing, death/respawn/rampage), fire (volleys, flight, landing), critters (follow/home/hold/garrison behaviour, separation, melee, obstacle sliding), buildings (presence, capture, hatch, cap, tower shots), abilities (the 3 heroes x 2 abilities from GDD section 5, plus turrets and zones), match (timer, crown opening + frenzy, crown hold win, throne win, time-out, overtime).
- src/sim/hash.ts      hashWorld(world): number - a stable hash over all gameplay state, for determinism tests and future desync checks.
- src/sim/input.ts     idleInput(): PlayerInput and small helpers for scripted inputs in tests.
- src/sim/index.ts     public API re-exports.

Starting tuning (world units, seconds; derived from the prototype, adjusted for chunkier, fewer critters):
- King: radius 0.55. Top speed brawler 5.25, blink 5.9, warden 4.75. Reaches top speed in ~0.1 s and stops in ~0.08 s. HP 130/100/160. Dash: 22 u/s for 0.16 s, cooldown 2.2 s, invulnerable during the dash. Regen 8 hp/s after 3 s unhurt. Auto-swing every 0.4 s: 1 damage + knockback to enemy critters within 0.9. Respawn 5 s at own Throne with 1 s invulnerability. Killer gains Rampage 8 s: speed x1.3, cooldowns tick x2. When a King falls his followers become 'hold' where they stand (then garrison/idle near the closest building is fine).
- Swarm gun: while fire is held and followers > 0, every 0.13 s throw up to 3 followers (prefer the ones closest to the aim point) to the aim point clamped to range 8.25 from the King, scatter +-0.35. Flight time = distance/15.5 + 0.12 s. Thrown critters cannot be hit and hit nothing until they land, and fly over obstacles. With 0 followers, emit 'noAmmo' (at most once per second) and wait 0.4 s.
- Landing: enemy critters within 0.7 take 2 damage and are knocked away; the enemy King within 0.9 takes 4. If it lands within a building's capture zone (building r + 0.55) it becomes 'garrison' there; otherwise 'hold' for 2.5 s (refreshing to at least 1 s while an enemy is near) then 'home'.
- Critter: radius 0.27, HP 3, bite 1 damage every 0.7 s at touching range (Kings take 2 per bite). Speeds: follow 6.2 (must keep up with a running King), home 6.5, hold/garrison 2.5. Aggro radius: follow 1.3, hold 2.4, garrison 1.75 beyond the building radius. Critters separate from each other (soft push) and slide around obstacles and buildings. Use a spatial hash; no per-tick allocation in hot loops; iterate in index order for determinism.
- 'home' state: newly hatched and recalled critters run to their King and become 'follow' on arrival (within ~1.6).
- Recall (rising edge): every own critter in hold or garrison goes 'home'. Emit 'recall' with the count.
- Buildings: radius throne 1.15, hut 0.85, tower 0.85, crown 1.0. Presence = own critters in the capture zone (each 1) + own King in zone (counts 4). Neutral: only one team present -> control rises 20/s x min(1 + 0.25 x presence, 3); if the claimant changes, progress resets. Owned: enemy present and no owner present -> drains at the same rate; at 0 it flips to the attacker with control 30. Owner present and no enemy -> regains 25/s. Contested -> frozen. Capturing the enemy Throne wins the match.
- Hatch: every owned building hatches one critter per interval (throne 1.4 s, hut 2.6 s, crown-as-Well 1.6 s, tower never) while the team is under its cap. Cap = 14 + 7 per owned building (Throne included). Start swarm 10. During Frenzy intervals are halved. TeamSetup.hatchMul scales hatch rate.
- Tower: every 0.6 s shoots the nearest enemy within 4.0 (critter: 2 damage, King: 5). Emits 'shot'. Towers are not in the meadow map but must work (unit-test them with a custom MapDef).
- Match: config.duration and config.crownOpensAt. When the Crown opens: phase 'crown', emit 'crownOpen', frenzy on. From then, a team with presence at the Crown building and no enemy presence accrues crown time; it decays 0.5/s when absent; reaching 10 s wins ('crown'). The Crown building itself stays capturable as a hatchery throughout. At time-out: more buildings wins ('time'); tie -> phase 'overtime', next capture wins ('overtime').
- Abilities (rising edge, fail silently on cooldown/stun/dead; emit 'ability' with hits):
  Brawler Stomp (cd 4): radius 2.1 around the King: enemy critters take 3 and are flung out; enemy King takes 30 and is pushed 1.25. Kingscall (cd 22): heal 40, spawn 8 followers around the King (may exceed cap).
  Blink Blink (cd 4): teleport up to 5.5 toward the aim point, followers teleport by the same offset. Vortex (cd 18): at the aim point up to 6 away, radius 3.75: enemy critters are pulled to the centre and stunned 1.6 s; enemy King pulled up to 2.25, stunned 1.2 s, 10 damage. Model the pull as a short-lived 'vortex' zone or an instant impulse, your choice.
  Warden Turret (cd 7): place a turret up to 4 away; lives 12 s; every 0.45 s shoots the nearest enemy within 3.75 (critter 1, King 4). Rampart (cd 20): shield 70 for 4 s and heal 45.
- Stats: fill TeamStats. Events: emit every SimEvent type where its trigger exists in the core.
- Mutations are NOT in this task, but leave clean seams: derive a per-team modifier record once in createWorld (from TeamSetup.mutations) that systems consult; with no mutations it is all defaults. The next engineer will fill it in.

Tests (Vitest, beside the code). Write each spec before the code that satisfies it. Cover at least: determinism (same seed + same scripted inputs for 3000 ticks -> identical hashWorld; different seed -> different); purity (a test that fails if any file under src/sim references Math.random, Date.now, performance.now, document or window); King movement/accel/stop/arena clamp/obstacle slide; dash distance, cooldown, i-frames; firing consumes followers, respects range/rate, emits throw/land; landing damage and knockback; garrison on building, hold then home in the open; recall; melee resolution; King damage, regen, death, respawn, rampage; capture of neutral, drain + flip of owned, contested freeze, reversible flip; hatch intervals, cap, frenzy; crown opening, crown-hold win with decay; throne-capture win; time-out win; overtime; towers; each of the 6 abilities; a full scripted match that reaches 'over' without NaNs (assert all positions finite every tick); a performance spec (average step under 1 ms with ~200 live critters on this machine, generous threshold so it is not flaky).

Finish only when npx vitest run src/sim and npx tsc --noEmit are both green. Report what is fragile.
`, { label: 'sim:core', phase: 'Core', model: 'opus', effort: 'high', schema: REPORT })

phase('Mutations')
const muts = await agent(COMMON + `
The simulation core already exists in src/sim (built by a colleague just now; read index.ts, step.ts, tuning.ts and the systems before changing anything). Their report: ${JSON.stringify(core)}

TASK: implement all 22 Mutations from GDD section 4 as rule rewrites, test-first, through the per-team modifier seam (extend it as needed; keep it plain data derived once in createWorld and consulted by systems, so the World stays serialisable and the hot loops stay branch-cheap).

Rules of thumb:
- A Mutation changes behaviour; keep each one legible in code (one place that defines what it does, named after the Mutation).
- Special critters (bomber, runt, brute, guard) use Critter.kind so the renderer can draw them differently. Bombers: 1 in 4 hatch as bombers (deterministic via world PRNG or a per-team counter). Brutes: all of that team's critters hatch as brutes (3x HP, ~25% slower, landing splash 1.0 radius and 3 damage, cap halved). Royal Guard: 5 'guard' critters spawn at start, stay in follow around the King, are never thrown, are replaced one at a time every 6 s if they die.
- Bombers explode on landing (radius 1.5, 3 damage to critters, 8 to a King) and die; emit 'explode'. Cryo Bombs adds a 1 s stun to everything hit (frozen: true). Chain Reaction: a runt's death explodes small (radius 0.9, 2 damage).
- Shockwave: landings knock back 2.5x harder and stun 0.4 s. Scorch: every landing leaves a 'scorch' zone (radius 0.9, 3 s, 1 damage per 0.5 s to enemy critters; Kings unaffected); cap concurrent zones per team (e.g. 24, oldest replaced).
- Splitters: a dying critter (not a runt, not a bomber explosion) becomes two runts (1 HP, bite half as often) in 'hold' state where it died. Boomtown: hatch 60% faster while holding fewer buildings than the rival. Militia: on capture, 3 free critters appear as garrison at that building; garrisoned critters bite for 2. Big Litter: cap +10, start with a full swarm (at cap).
- Leeches: each landing or bite that damages the rival King heals own King 2. Frostbite: landings apply slowT 2 s (critters 40% slower, Kings 25%). Piercers: thrown critters fly flat (Critter.flat) at 26 u/s straight to the target point, dealing 2 damage once to each enemy critter within 0.5 of the path and 4 to the King if crossed, then land as usual without the landing splash. Homing: the landing point is pulled to the nearest enemy (critter or King) within 2.0 of the aim point, evaluated at throw time.
- Archer Huts: own huts and Throne shoot like weak towers (range 3.2, every 0.9 s, critter 1 / King 3). Trample: dashing damages enemy critters touched (3) and dash cooldown x0.6. Rapid Fire: fire interval /1.6, scatter x1.8. Long Arm: range x1.4, flight speed x1.25. Second Wind: once per battle a lethal hit instead leaves the King at 50% HP, emits 'secondWind', and knocks back + stuns enemy critters within 3 (0.8 s).
- Conscription: when the rival King falls, his critters within 4 of where he fell switch team (become 'home' to the new owner). Bloodrage: Rampage has no timer; it ends after its owner takes 3 hits (count hits, min 8 s max 25 s).
- Add a small src/sim/mutations.ts catalogue: id, display name, tag(s), one-line description (player-facing text taken from the GDD), duo prerequisites. The UI will read it.

Tests: one focused spec per Mutation proving the rewrite (and that it is absent without the Mutation), plus a determinism spec with a mixed loadout on both sides, plus a soak spec: 6 random loadout pairs (seeded) x 3000 ticks with scripted aggressive inputs, asserting finite state and no thrown errors.

Finish only when npx vitest run src/sim and npx tsc --noEmit are green. Report what is fragile.
`, { label: 'sim:mutations', phase: 'Mutations', model: 'opus', effort: 'high', schema: REPORT })

phase('Review')
const lenses = [
  { key: 'determinism-perf', effort: 'xhigh', prompt: `LENS: determinism, purity and performance. Hunt for: iteration-order dependence (Map/Set/object key order, sort without tie-breaks), hidden nondeterminism (Math.random, Date, trig outside math.ts, float-keyed grid hashing collisions), state that is not covered by hashWorld, state outside World (module-level mutable variables that would break two worlds in one process or snapshot/restore via structuredClone), per-tick allocations in hot loops, O(n^2) scans. PROVE claims by writing and running throwaway scripts with npx tsx in /tmp/claude-1000/-home-turbo-creative-game/42a0f085-49e4-4b98-b212-79e3f92ccf72/scratchpad/ (e.g. run two worlds interleaved and compare hashes with a solo run; structuredClone a mid-match world and continue both; time 10,000 ticks with full swarms).` },
  { key: 'rules-vs-gdd', effort: 'high', prompt: `LENS: does the simulation implement the GDD (design/GDD.md sections 3-6) and behave sensibly as a GAME? Check each rule in GDD 3.1-3.4 and each Mutation row against the code and tests. Then play it by script: write throwaway npx tsx scripts in /tmp/claude-1000/-home-turbo-creative-game/42a0f085-49e4-4b98-b212-79e3f92ccf72/scratchpad/ that drive both Kings with simple scripted inputs (walk to nearest neutral hut, fire at it, fire at enemy King when close, go to the Crown when it opens) and look for degenerate behaviour: critters stuck on obstacles/buildings, followers unable to keep up, captures that never complete, a King able to be permanently stun-locked, matches that cannot end, abilities or Mutations that are no-ops or wildly dominant (e.g. one side wins 100% solely due to one Mutation). Report concrete repro scripts and numbers.` },
  { key: 'test-quality', effort: 'high', prompt: `LENS: test quality. For each spec file under src/sim: does it test behaviour through the public API (createWorld/step/events) rather than internals? Would it fail if the rule were broken (try mutating a tuning value or deleting a line for 5-6 key rules and see whether any test goes red; restore the code afterwards and confirm with git diff that src/ is unchanged)? Are there rules in the GDD with no spec? Are any specs flaky (timing-based thresholds) or tautological? Do not modify committed code; report only.` },
]
const reviews = await parallel(lenses.map(l => () =>
  agent(`You are reviewing the freshly built Kingswarm simulation in /home/turbo/creative-game/src/sim (TypeScript, deterministic fixed-step, see CLAUDE.md for the architecture law and design/GDD.md for the rules). Two engineers built it; their reports: CORE ${JSON.stringify(core)} MUTATIONS ${JSON.stringify(muts)}

${l.prompt}

You are a reviewer: do NOT edit files under /home/turbo/creative-game (scratch scripts go in the scratchpad path and may import from the repo by absolute path). Only report findings you verified by reading the code or running something; include the evidence. Severity: critical = breaks determinism/crashes/makes the game unwinnable or unlosable; major = a GDD rule is wrong or missing, a serious perf issue; minor = everything else. Keep it to real defects; style nits are noise.`,
    { label: `review:${l.key}`, phase: 'Review', model: 'opus', effort: l.effort, schema: FINDINGS })
    .then(r => r ? { lens: l.key, ...r } : null)
))
const allFindings = reviews.filter(Boolean).flatMap(r => r.findings.map(f => ({ lens: r.lens, ...f })))
log(`${allFindings.length} review findings (${allFindings.filter(f => f.severity !== 'minor').length} critical/major)`)

phase('Fix')
let fix = null
if (allFindings.length) {
  fix = await agent(COMMON + `
TASK: three reviewers examined the simulation. Their findings are below as JSON. For each finding: reproduce it (write the failing test first when it is a behaviour defect), fix it at the root, and confirm the test goes green. If a finding is wrong, say why with evidence instead of changing code. Handle critical and major findings first; do the minor ones that are cheap and clearly right. Keep all existing tests green; do not weaken a test to pass it.

FINDINGS: ${JSON.stringify(allFindings)}

Finish only when npx vitest run src/sim and npx tsc --noEmit are green. In notes_for_lead list each finding as fixed / rejected (why) / deferred (why).
`, { label: 'sim:fix', phase: 'Fix', model: 'opus', effort: 'high', schema: REPORT })
}
return { core, muts, reviews: reviews.filter(Boolean).map(r => ({ lens: r.lens, overall: r.overall, findings: r.findings })), fix }
