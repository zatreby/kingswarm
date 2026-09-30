# Work log (append-only; newest at the bottom)

A record, not a plan. A fresh lead session resumes from here plus `git log`. Keep entries short: what was decided or finished, what is in flight, what is next.

## 2026-09-30

**Decided**
- Rebuild v0.5 prototype as v1 on branch `v1`: TypeScript + Vite + Three.js (WebGLRenderer), deterministic 60 Hz sim in `src/sim`, presentation reacts to `SimEvent`s. `main`, `kingswarm.html`, `docs/` stay untouched as the live v0.5 build until v1 is release-ready.
- Design locked in `design/GDD.md`: swarm-as-gun core kept; Conquest run (5 rival Kings, draft 1-of-3 Mutations after each win, 2 lives); Mutations are the single content system (player build, rival identity, difficulty, Versus); buildings have roles (Throne, Hut, Tower, Crown); no currencies/quests/stat meta.
- Look locked in `design/ART.md`: toy diorama; procedural blob Kings and critters (own identity), CC0 KayKit buildings/nature if they pass the look test; CC0 sampled audio, no beeps.
- Bots play through `PlayerInput` like humans; rivals are personality data rows with tells and flaws.
- Headless Chromium uses the real GPU (`--use-gl=angle --use-angle=gl-egl`); `tools/shot.mjs` is how anyone looks at the game.
- Routing (validated 2026-09-30): Fable = direction/arbitration; Opus 5.5 builders at `medium` for routine work and `high` for hard or foundational work; Sonnet 5.5 `high` for research/analysis; never `max`. Every builder stage is followed by an independent critic with its own evidence.
- Higgsfield / AI media: only for marketing edges (key art, trailer sting), via image-to-image from in-engine renders; needs an owner-funded API key, so deferred until the game is worth marketing. Gameplay visuals stay procedural/CC0.

**Research done** (`design/research/`): retention, game-feel, genre-teardown, tech-rendering, netcode, distribution, assets-audio, onboarding-ux, fun-ai, studio-ai-engineer, studio-ahmed-nagdy, studio-higgsfield. Pending: studio-ai-3d, studio-ai-audio.

**In flight (background workflows)**
- sim build (core → mutations → 3 reviewers → fix), owns `src/sim/**`
- render build (scene → critique → feel/VFX → critique → polish), owns `src/render/**`, `lab/render*`, `public/models`
- audio build (assets → engine), owns `public/audio`, `src/audio/**`, `lab/audio*`
- UI build (kit + all screens on fake data → critique → fix), owns `src/ui/**`, `lab/ui*`, `public/fonts`

**Next**
1. When the sim lands: bots + bot-sim metrics harness (`src/ai`, `tools/sim`), and run/meta/content logic (`src/game`).
2. Integration: input, loop, main app, debug hook `window.__ks`, Playwright e2e. First playable battle = milestone M1.
3. M1 gate: lead reviews screenshots/sequences, bot metrics vs GDD §3.4 targets, fresh-eyes critics.
4. Then M2 (run, rivals, onboarding), M3 (versus, touch, budget, deploy), M4 (playtest loops).

## 2026-09-30 16:20 — SAVE POINT (owner asked to save and close; resume from here, do not rerun finished stages)

All background workflows were stopped by the lead. Everything they wrote is on disk and committed in this save commit. At save time: **all test suites green** (sim 271, ai 38, game 117, audio 45, render 22, ui 21 tests) and `tsc --noEmit` has exactly 2 errors, both in `src/render` from the interrupted render stage (listed below).

**Where everything is saved**
- `design/handoff/workflows/<name>.js` — the full brief (prompt) of every workflow stage. Reuse these prompts; do not rewrite them.
- `design/handoff/<name>.results.json` — the structured result of every *finished* stage (engineer reports, critiques, review findings). These are the inputs the unfinished stages need.
- `design/handoff/inflight/<stage>.md` — for each *interrupted* stage: the files it touched and its own progress notes.
- Research: `design/research/*.md` (15 files). Design: `GDD.md`, `ART.md`, `STUDIO.md`.

**State per track (DONE = never rerun; RESUME = run only that stage)**

| Track | Done | Resume from |
|---|---|---|
| Research sweep (9 topics) | all DONE | — |
| Studio capabilities (5 topics) | all DONE | — |
| Community voices | `community-players.md` DONE | RESUME `community:devs` and `community:webtech` (no file written yet; Reddit JSON was blocked, agents were switching to RSS/other mirrors; raw pulls in `.cache/community/`) |
| Sim (`src/sim`) | core DONE, all 22 Mutations DONE, 3 reviews DONE | RESUME `sim:fix` from the start (it had only read files, 0 edits). Findings are in `kingswarm-sim-build.results.json` (3 `review:*` stages). See design ruling below. |
| Renderer (`src/render`, `lab/render*`, `public/models`) | scene DONE, art critique 1 DONE | RESUME `render:feel` mid-way: critique fixes were applied (diorama cliff, etc.), pure feel logic + tests written, effects module written, critters and Kings rewrite in progress. 2 type errors to clear: `critters.ts:48` wants a `shockwave` key on `TeamMods` (use the real field names in `src/sim/types.ts`, e.g. `landStun`/`landKnockMul`), `index.ts:171` call arity. Then stages critique-2 and polish. |
| Audio (`public/audio`, `src/audio`, `lab/audio*`) | assets DONE (curated CC0 set, manifest, licences) | RESUME `audio:engine` near the end: engine + mapping + 45 tests exist and pass; remaining = the OfflineAudioContext mix check in headless Chromium and gain tuning, then report. |
| UI (`src/ui`, `lab/ui*`, `public/fonts`) | build DONE, design critique DONE | RESUME `ui:fix` mid-way: several critique items fixed (HUD fit, cooldown text, confirm dialog, toast); was working on the draft card pick-flight animation. Check remaining critique items against `kingswarm-ui-build.results.json`. |
| Bots (`src/ai`, `tools/sim`) | — | RESUME `ai:build` late: bots, profiles, harness and 38 tests exist and pass; it had just fixed dishonest Sable ambush tells and was re-running the baseline metrics. Remaining = finish baseline numbers + report, then stages verify and fix. |
| Game layer (`src/game`) | build DONE (117 tests) | RESUME `game:verify` (had just started its scripts in `.cache/verify-game/`), then fix. |

**How to resume a stage:** launch one agent (or a one-stage workflow) with the saved prompt for that stage from `design/handoff/workflows/<name>.js`, prefixed with: "A previous engineer was interrupted mid-task. Read `design/handoff/inflight/<stage>.md` and `git show --stat HEAD` first; keep what exists, finish what is missing, do not redo finished work." Pass prior-stage results from the `.results.json` file where the prompt interpolates them.

**Design rulings pending for the sim fix (lead's decisions, apply them in `sim:fix`)**
1. Throne rush (critical finding: a lone King drains a Throne in 2.5 s): make the Throne a real siege. Throne drains far slower than a Hut (target: at least ~12 s for a lone King), and critters hatched at a building whose zone has enemies in it stay and garrison it instead of running to their King. Re-check with bots that Throne endings stay in the GDD §3.4 band.
2. Swarm cap counts Huts and Throne, not Towers or the Crown (GDD wording wins).
3. Overtime must end: after 30 s of overtime with no capture, the side with more total critters wins.
4. Duo Mutations are offered only when their actual prerequisite Mutations are owned (Chain Reaction needs Splitters; Cryo Bombs needs Bombers), not merely the tags. Update GDD wording when done.
5. Bloodrage: count only hits on the King from thrown landings and abilities (not bites/arrows), so it is a real rewrite.
6. Dominant single Mutations (Splitters, Piercers, Scorch, Militia win mirrors alone): retune with the bot harness after `ai:build` lands; target no single Mutation above ~60% in a mirror.
7. Perf spec: make it robust on a loaded machine (relative budget or skip under load), so `npm run check` is not flaky.
8. Same-tick fairness (Blue-first ability resolution, building index order): alternate priority by tick parity.

**After the resumes finish, next is unchanged:** integration (input, loop, app state machine, FTUE hints, `window.__ks` debug hook, Playwright e2e, build + bundle budget) → M1 gate. Integration brief outline is in the lead's head only as the list in "Next" above plus: portrait phones get a "rotate your device" card; rival portraits are rendered from the 3D King looks; keys are LMB fire, RMB/F recall, Shift/Space dash, Q ability, E ultimate, P/Esc pause.

**Operational lessons from today**
- Six build workflows at once overloaded this laptop (load average 17). Run at most 3 build tracks in parallel; research agents are cheap locally but exhausted the WebSearch quota, so give them direct data sources (APIs via curl).
- Review stages that do mutation testing must work on a copy, never `git checkout` the working tree; commit a checkpoint before any review stage.
- `/tmp` is RAM: research agents filled 2 GB of it with virtualenvs; STUDIO.md now says to use `.cache/`.
