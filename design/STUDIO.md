# Studio operations: the machine, its limits, and the free paths

How this studio gets things done on the hardware and budget it actually has. Read this before doing anything heavy (browsers, downloads, local models, parallel jobs) or before concluding that something "needs money".

## The machine (surveyed 2026-09-30)

| | |
|---|---|
| CPU | Intel i5-1135G7, 4 cores / 8 threads, laptop |
| RAM | 7.4 GB total, usually ~2 GB available; zram swap + 16 GB disk swap |
| GPU | Intel Iris Xe (integrated). Works in headless Chromium at 60 fps. No discrete GPU, no CUDA. |
| Disk | ~230 GB free on `/`. **`/tmp` is tmpfs (RAM-backed, 3.7 GB)** |
| OS | Arch Linux, Wayland. The owner uses this laptop at the same time (browser open). |
| Present | node 22, npm/pnpm/bun/deno, python 3.14 + uv/uvx/pipx, cargo, go, java, docker, podman, ffmpeg, sox, ImageMagick, yt-dlp, gh, jq, rg, fd, cmake, gcc/clang, wasm-pack, ollama, obs, adb, system Chromium 153 |
| Absent | Blender, Godot, any GPU ML stack |

This laptop is also our **minimum-spec test device**: integrated graphics, 8 GB. If the game is smooth here, it is smooth for the audience.

## Resource rules

- **RAM is the scarce resource.** Anything written under `/tmp` (including the session scratchpad) lives in RAM. Put downloads, virtualenvs, caches and build output on disk: `assets-src/` for raw assets, `.cache/` for everything else (both gitignored). Keep the scratchpad for small text files.
- **Browsers:** at most two headless Chromium instances across the whole studio at once; launch, capture, close. Prefer a Node-level test of the sim or logic over a browser test whenever both can answer the question.
- **Parallel jobs:** at most ~4 CPU-heavy local processes at once (test runs, bot sims, encoders). Bot-sim sweeps use a worker pool of 4 or fewer. One `vite build` at a time.
- **Dev servers:** one per agent on its own port, stopped when done (see CLAUDE.md).
- **Local ML is off the table** for images, 3D, audio or video generation (no GPU, 7 GB RAM). `ollama` can run only small text models and is not worth the RAM while agents are working.
- Check before heavy work: `free -m` (keep ≥ 800 MB available) and `uptime`.

## Free paths (try these before anything paid)

| Need | Free path we use | Paid/owner path only if the free one fails |
|---|---|---|
| 3D art | CC0 kits (KayKit, Kenney) + procedural geometry in code, optimised with gltf-transform | AI text-to-3D services (account needed) |
| Sound and music | CC0 packs (Kenney, OpenGameArt authors listed in `research/assets-audio.md`), processed with ffmpeg/sox | AI audio services (account needed) |
| Fonts | OFL fonts bundled locally | — |
| Seeing our own work | headless system Chromium on the real GPU via `tools/shot.mjs`; frames read as PNGs | — |
| "Watching" videos | transcripts/captions via `yt-dlp --skip-download --write-auto-subs`, talk slides, companion posts | — |
| Hosting | GitHub Pages from this repo (already live for v0.5) | custom domain |
| Online play | WebRTC peer-to-peer; public signaling (PeerJS cloud or Trystero); STUN only | TURN relay: Cloudflare free tier needs the owner's account |
| Balance testing | thousands of headless bot-vs-bot matches on the deterministic sim | human playtests (the owner, then friends) |
| Image/key art | in-engine renders of the diorama (posed scenes, high-res screenshots) | AI image tools (account needed) |
| CI | local scripts (`npm run check`, Playwright on system Chromium) | GitHub Actions minutes |

Pattern for any new obstacle: (1) can we make it procedurally or from CC0? (2) is there a free tier usable without an account? (3) can a smaller/cheaper variant answer the same question (lower resolution, fewer samples, Node instead of browser)? (4) only then: ask the owner, with the exact thing needed.

## When a human is truly needed

Accounts, logins, payments, API keys, physical devices (phone test, gamepad, listening to audio, a second player). Ask the owner through the question tool with the exact action needed and why, and keep every other track moving meanwhile. Never block the whole studio on one ask.

## How the studio works

- The lead (Fable) owns vision, architecture contracts, arbitration and integration; builders (Opus) implement against written briefs and contracts; analysts and mechanical work go to Sonnet/Haiku. Every builder stage is followed by an independent critic that gathers its own evidence.
- Evidence over claims: tests, measured numbers, screenshots that someone actually looked at.
- Research is multi-perspective (official docs, practitioners, communities, popular creators), dated, and validated before we act on it. Findings live in `design/research/`.
- One source of truth per thing: design intent in `GDD.md`, look in `ART.md`, numbers in `src/sim/tuning.ts`, shared types in `src/sim/types.ts`, operations here.
