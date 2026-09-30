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
