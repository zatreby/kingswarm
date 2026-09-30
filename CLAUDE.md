# Kingswarm studio rules

Kingswarm is a browser game: a King hoses a swarm of critters at rivals on a low-poly diorama. TypeScript + Vite + Three.js. You are a member of the studio; the lead integrates your work.

## Read before deciding

- `design/GDD.md` — what the game is, the pillars, the bloat guard. Any gameplay, UX or content decision must trace to it. When your brief and the GDD disagree, follow the brief and flag the conflict in your report.
- `design/research/<topic>.md` — evidence (game feel numbers, netcode, assets, onboarding, AI, tech). Open the one your task touches.
- `src/sim/types.ts` — the contract every layer shares.
- `design/ART.md` — the look and sound; read before making anything visible or audible.
- `design/STUDIO.md` — this machine's limits (7 GB RAM, `/tmp` is RAM) and the free paths; read before heavy jobs, downloads, browsers, or deciding something needs money.

## Architecture law

```
input (human | bot | remote) -> PlayerInput -> sim.step(world, inputs) -> World + SimEvent[]
                                                   |                          |
                                   render reads World (interpolated)   render / audio / ui react to events
```

- **`src/sim` is pure.** Deterministic fixed step (60 Hz), seeded PRNG from `world.rng`, plain-data `World`. It imports nothing outside `src/sim`. It runs in Node under Vitest with no DOM.
- **Randomness and clocks:** sim code takes randomness from the world PRNG and time from `world.time`. `Math.random`, `Date`, `performance.now` belong to presentation only.
- **Trig in the sim** goes through `src/sim/math.ts` wrappers, so they can be swapped for cross-browser-exact versions when online play needs it.
- **Bots are players.** A bot reads the World and returns a `PlayerInput`, with human-like reaction delay and aim error. A bot never writes to the World.
- **Presentation never mutates the World.** Render, audio and UI read state and consume `world.events`. Cosmetic state (particles, shake, animation phases) lives in the presentation layer.
- **Import direction:** `sim` ← `ai` ← `game` (loop, modes, run state) ← `render`, `audio`, `ui`, `net`. Lower layers never import higher ones.
- **Numbers live in `src/sim/tuning.ts`** (gameplay) or a `const` block at the top of the presentation file (feel). Name them; keep magic numbers out of logic.

## Working agreement

- **Own your files.** Edit only the paths your brief assigns. A needed change to a shared contract (`types.ts`, `tuning.ts` shape, `package.json`) goes in your report as a request unless your brief says you own it.
- **Test first in the sim and AI.** Write the Vitest spec that states the rule, watch it go red, make it green. Tests sit beside the code as `*.test.ts`.
- **Done means observed.** Before reporting: `npm run check` is green for your files, and you ran the thing you built. For anything visible, capture it with `node tools/shot.mjs` (headless Chromium on the real GPU) and look at the PNG with the Read tool; describe what you saw, including what still looks wrong.
- **Report honestly and briefly:** what you built, what you verified and how, what is unfinished or fragile, contract change requests. Raw facts over prose.
- **Stay inside this repo.** Install dependencies with `npm install` here only. Leave `~/.claude`, global packages and anything outside this directory untouched. Leave `git push`, `kingswarm.html`, `build.sh` and `docs/` to the lead (they are the live public build).
- **Dev server ports:** use your own port (`npx vite --port <5200-5299> --strictPort`) and stop it when done; kill by port-specific pattern such as `pkill -f "[v]ite --port 5207"`.
- **Budget:** the shipped game must stay under 5 MB initial download with no external network requests. Ask before adding a runtime dependency.

## Style

TypeScript strict. Small modules with one job. Plain objects and functions in the sim; pooled entities with an `alive` flag, reused in place (no per-tick allocation in hot loops). Comments explain why, not what. Match the surrounding code.
