# Higgsfield and peer tools for Kingswarm (as of 2026-09-30)

Method: WebFetch of Higgsfield's changelog RSS, help center, docs (docs.higgsfield.ai), CLI repo/README/MODELS.md, npm/PyPI/GitHub metadata, and a real `npm i @higgsfield/cli` in the scratchpad (not in the repo). WebSearch quota was exhausted, so peer-tool coverage is thinner than Higgsfield's. Tags: CONFIRMED (primary source fetched), OUTDATED, UNVERIFIED.

## Bottom line for the studio

1. **ADOPT NOW: keep every gameplay-facing visual procedural or CC0 in-engine.** Critters, Kings, buildings, textures, HUD icons, particles, rival portrait busts (ART.md already says "rendered from the 3D model"). AI media enters only at the edges the engine cannot draw: key art, store capsule, trailer sting. Reason: six rivals x six moods from an image model will drift; a 3D bust render cannot.
2. **ADOPT NOW: AI key art by image-to-image from an in-engine render, not from text.** Capture a hero frame with `node tools/shot.mjs`, feed it as the reference to a reference-following image model (GPT Image 2.5 or Nano Banana Pro), prompt for "same toy diorama, same palette hexes, poster composition, empty area for logo". The logo/title type is set in-engine or in SVG afterwards. Reason: a text-only prompt will give generic fantasy art that fights the flat-shaded look; a reference locks the style.
3. **ADOPT NOW: one funded API balance, not a subscription.** Higgsfield API = separate USD balance, $5 minimum, pay per generation, no plan needed, failed and NSFW generations refunded. Reason: our need is ~10-30 stills and 1-3 short clips, not monthly volume. A web plan's credits (and its "Unlimited" models) do not apply to CLI or MCP at all (CONFIRMED, help center).
4. **ADOPT NOW: spend cap and provenance in the wrapper script.** Per-job cost estimate before submit, hard cap (default $5), and a sidecar record (model, prompt, refs, date, cost) per output. Reason: Steam requires disclosing AI content in the game AND marketing materials (CONFIRMED); outputs are only retained 7 days on Higgsfield, so we download at once.
5. **TRY LATER: video sting (3-5 s) from the key art via Seedance 2.5 image-to-video.** Use Draft Mode (480p preview) to pick a take, then re-run at 1080p. Gameplay trailer body stays real in-engine capture (ffmpeg is installed). Reason: image-to-video models tend to melt hard-edged low-poly geometry; unproven for our style, so gate it on a 3-take spike costing a few dollars.
6. **TRY LATER: palette-locked spot illustrations (title-card flourishes, mutation-card backdrops) with Recraft V4.1.** Its API documents RGB palette and background controls (CONFIRMED, docs), which maps onto ART.md's hex table. Reason: only image model found with explicit palette input; still a spike, and icons themselves stay drawn from shapes.
7. **SKIP: Higgsfield Soul / Soul ID / Soul Cinema.** Documented as portraits, fashion and editorial photo styles (CONFIRMED, docs). Wrong look for a toy diorama.
8. **SKIP: Higgsfield 3D (image_to_3d, tripo_3d, 3D Jutsu, Blender plugin, Production Skills Bundle), Higgsfield Gaming, Supercomputer.** Reason: the CLI's 3D models exist (`image_to_3d`, `3d_rigging`, polycount/topology flags) but AI meshes need cleanup and will not match KayKit/Kenney CC0 atlases; 3D Jutsu's changelog names no GLB/FBX export (UNVERIFIED); Gaming generates whole games, which we are building ourselves.
9. **SKIP for now: Higgsfield MCP.** Free of setup effort (OAuth, `https://mcp.higgsfield.ai/mcp`, Claude Code is a listed OAuth client) but it needs a paid plan, burns plan credits, adds tool schemas to every session, and stores the OAuth token in Claude Code's own config, outside the repo. A ~60-line script does the same for our 3 jobs.
10. **SKIP: local image generation.** Intel Iris Xe + ~7 GB RAM cannot run FLUX.2-class models at usable speed (my judgement, not benchmarked). FLUX.2 [klein]/[dev] commercial terms are tiered and unclear (UNVERIFIED).
11. **Do not buy the tool for the sake of it.** Higgsfield is an aggregator: Nano Banana, GPT Image, Seedance, Kling, Veo, Wan are the same models available direct (Gemini API lists them with public prices). Its own IP (Soul, camera presets, Cinema Studio) is aimed at photoreal/film work. Its value here is one key for stills and video. If the owner would rather hold a Google AI Studio key, that path is equally valid for stills (see Peers).

## What Higgsfield is now (all dated Aug-Sep 2026, so fresh)

- Multi-model generation platform plus apps: 94 public apps, image (Nano Banana Pro, Soul, FLUX.2, GPT Image 2.5, Seedream 5.0, Recraft V4.1), video (Seedance 2.5, Kling 3.0, Veo 3.1, Wan 3.0, Genjutsu motion transfer), audio, Cinema Studio 4.0 (camera bodies, lenses, motion presets), Layers (split an image into elements, 2026-08-11), 3D Jutsu (prompt to editable 3D scene to video, 2026-09-04). CONFIRMED: https://higgsfield.ai/llms.txt , https://higgsfield.ai/creator-hub/changelog (RSS: .../changelog/rss.xml).
- "Soul" = its own image model line (Soul 2.0, Soul ID trains a character from photos, Soul Cinema). "Character consistency" in Higgsfield = Soul ID (photo-of-a-person oriented) or reference images on other models.
- Camera-motion presets live in Cinema Studio and the web apps; the CLI documents no camera-preset flag for `seedance_2_5`/`kling3_0` beyond prompt text (UNVERIFIED for API).
- Seedance 2.5 Draft Mode (480p preview then 1080p final) shipped 2026-09-22. CONFIRMED changelog.
- Homepage marketing (staleness/consistency flag): homepage says API cashback "up to $100,000", changelog says $1,000 per account or $200,000 per verified business, ends 2026-09-30 23:59 UTC (today). Treat as noise; the pool ($20M) can also end early.

## Plans, credits, free tier, commercial terms

- Free web account: small model set, no credits, visible watermark on every generation; paid plans remove the watermark for new generations only. CONFIRMED: help-center `plans/how-do-higgsfield-plans-work`, `credits/watermark-and-how-to-remove`. No free trial.
- Plan names/prices: individual plans plus Team, Scale (5-15 seats, unlimited models on annual), Enterprise. Dollar prices are rendered client-side, not in any fetched page: **UNVERIFIED**. Credit packs: 100 to 4,000 (fixed) and 5,000-25,000 (adjustable), valid 90 days, need an active subscription. Plan credits expire monthly; API-style purchased credits expire after 1 year per API docs.
- The "Credit reset" (up to 2,000 bonus credits, 2026-09-29) is subscribers-only and ends today. Irrelevant to us.
- Ownership/commercial use: "You own all outputs"; commercial use unrestricted on all plans, survives cancellation. Bans: using outputs to train or fine-tune any AI model; infringing third-party rights. Higgsfield trains on your content unless you are on Enterprise. CONFIRMED, help-center page dated 2026-09-12. Does the same apply to API traffic (Developer Terms)? **UNVERIFIED**; ask owner to read the API terms at signup.
- Consequence: uploading in-engine screenshots as references is low sensitivity (public game), but reference uploads go to a temporary public HTTPS URL (docs: file-uploads, `retention=temporary`).
- Copyright of AI stills is weaker than of human-authored work in several jurisdictions (general knowledge, not fetched, UNVERIFIED for 2026). So keep the logo, type, character designs and 3D models human/agent-authored in-repo; use AI for backdrop and polish only.
- Steam: must disclose pre-generated AI content that ships or appears in marketing; reviewed like other content; live-generated AI needs guardrail description. CONFIRMED https://partner.steamgames.com/doc/gettingstarted/contentsurvey (no date shown).

## Programmatic access matrix

| Route | What it is | Needs | Works without paid plan? | Notes |
|---|---|---|---|---|
| REST + SDK (`@higgsfield/client` 0.2.6, npm, 2026-09-17; `higgsfield-client` 0.2.0, PyPI) | `https://api.higgsfield.ai`, header `Authorization: Key ID:SECRET`, submit -> poll or webhook -> fetch | API key from open.higgsfield.ai / console.higgsfield.ai, **$5 minimum top-up** | **Yes**, separate USD balance | CONFIRMED (docs + help center). Failed/NSFW not charged. Outputs kept >= 7 days. Launch offer 15% off (changelog 2026-09-16). |
| CLI (`@higgsfield/cli` 1.1.26, npm 2026-09-18, MIT, Go binary) | `higgsfield generate create <model> --prompt ... --wait --json`, 40+ models incl. 5 3D models, `generate cost`, `soul-id`, `upload` | Browser OAuth login (`higgsfield auth login`), then plan credits | **No** for unlimited/free; uses plan credits at web rates (help center). Free-account use: UNVERIFIED | Verified locally: install script blocked by npm's allowScripts, works after `npm install-scripts approve`; binary reads `HIGGSFIELD_CREDENTIALS_PATH`, `HIGGSFIELD_WORKSPACE_ID`, has a telemetry opt-out env (`HIGGSFIELD_DISABLE_TELEMETRY`/`HIGGSFIELD_TELEMETRY`, semantics UNVERIFIED) and a bundled Sentry DSN. No API-key/CI login documented (help center: headless "not addressed"). |
| MCP | `https://mcp.higgsfield.ai/mcp`, OAuth (PKCE, Clerk); Claude Code named as client | Any active paid plan | **No** | Verified: endpoint returns 401 with OAuth metadata. Tools: image/video, Soul, audio, balance. Deducts credits at standard rates. |
| Official skills | `higgsfield-ai/skills` (MIT, 1,192 stars, pushed 2026-09-26): generate, soul-id, brandkit, product-photoshoot, explainer, websites, youtube-thumbnail | CLI + login | No | Skills are marketing-flavoured; we need none. |

- Rate limits: concurrency-based, per account and model, funds unlock more concurrency, exceeding returns HTTP 400 "Maximum number of concurrent requests"; no rate-limit headers (CONFIRMED docs `concepts/rate-limits`). Numbers are only visible in the console: UNVERIFIED.
- REST catalog (docs, "82 entries as of 2026-09-22": 16 image, 66 video): image = Soul/Soul V2/Soul Cinema/Soul ID, Marketing Studio, Grok Image 2.0, Recraft V4.1 (+Pro, Utility), Qwen Image, Ideogram 4.0, Z-Image; video = Seedance 2.0/2.5, Kling 2.5-3.0/O3/Omni, Wan 2.6/2.7/3, MiniMax, LTX, PixVerse, Grok, Genjutsu. **GPT Image 2.5 and Nano Banana Pro were not seen in the REST image list I read** (partial read, UNVERIFIED); they are in the CLI/MCP catalog. No 3D in REST.
- Per-model API prices: not in any fetched page (table is client-rendered): **UNVERIFIED**. The docs recommend the estimate endpoint before submitting.

## Peers for the same jobs (primary sources, thin)

| Job | Option | Evidence | Verdict |
|---|---|---|---|
| Stills with reference images | Gemini API: Nano Banana Pro `gemini-3-pro-image` (4K, 6 object + 5 character refs), Nano Banana 2 `gemini-3.1-flash-image` (4K, 10 object + 4 character + 3 style refs), Lite (1K) | ai.google.dev image-generation doc (fetched today); pricing page: images $0.0168-$0.151 each; all outputs carry SynthID | Strong, verified price; free-tier image generation not stated (UNVERIFIED) |
| Stills with text on image | GPT Image 2.5 (`gpt-image-2.5-sunburst`, `-flare` listed on OpenAI's pricing page) | Per-image prices not on the page I fetched (token-priced): UNVERIFIED | Higgsfield CLI README calls it the default for design and on-image text |
| Palette-controlled art | Recraft V4.1 | Palette + background controls, REST docs | Best fit for the ART.md hex table |
| Video sting | Seedance 2.5, Kling 3.0, Veo 3.1 ($0.05-0.60/s per Google pricing page), Wan | fal.ai pricing page shows Wan 2.5 $0.05/s, Veo 3 $0.40/s: **that page looks stale** (older model names), do not rely | Spike only |
| Aggregators | fal.ai, Replicate | fal per-image ~$0.02-0.04, GPU $1.10-1.89/h (stale-looking page) | Equivalent to Higgsfield API; no reason to add a third |
| Free/open | FLUX.2 [klein]/[dev] open weights | BFL pricing page: tiered commercial memberships | Hardware cannot run them; SKIP |

## Where AI raises perceived quality most vs style risk

| Asset | Lift | Risk to diorama cohesion | Decision |
|---|---|---|---|
| Title key art / store hero | High (first impression, thumbnail) | Medium; controlled by reference-image method | Do it, human review, 4 candidates |
| Steam/portal capsule (16:9, 9:16 for CrazyGames) | High | Low if derived from the key art plus in-engine logo | Do it |
| Trailer intro/outro sting | Medium | High (geometry melt) | Spike, then decide |
| Rival portraits | Medium | High (consistency across six) | Keep bust renders; optional AI expression sheet TRY LATER |
| UI illustration | Low-medium | Medium | Keep SVG/shapes; Recraft only for backdrops |
| Textures / 3D | Low | High | Procedural / CC0 |
| Real gameplay screenshots for store | n/a | AI here would mislead buyers | Never AI: real captures only |

## Wiring steps

Agent alone (no owner needed), in this order:
1. Add `.env.local` and `assets-src/gen/` to `.gitignore` (today `.gitignore` has no `.env*` rule: fix before any secret exists).
2. `npm i -D @higgsfield/client` (pure JS SDK, no install script; do NOT add `@higgsfield/cli` unless the owner has a paid plan).
3. Write `tools/art-gen.mjs`: read `HF_CREDENTIALS` (`KEY_ID:KEY_SECRET`, as the SDK example expects) via `node --env-file=.env.local`; take a job JSON (model, prompt, reference PNG path, n); upload the reference by presigned URL (`POST /files/generate-upload-url`); call estimate, refuse over the cap; `higgsfield.subscribe` with polling; download outputs at once to `assets-src/gen/<date>-<slug>/`; append a provenance line to `design/art/PROVENANCE.md`.
4. Reference frames from `node tools/shot.mjs`; post-process with `magick` (installed) to WebP, target <= 250 KB for the title backdrop, lazy-loaded so the 5 MB initial budget holds; trailers cut with `ffmpeg` (installed).
5. Run the spike jobs and judge results with the Read tool on the PNGs; reject anything off-palette.

Needs the owner (agent cannot do these):
- Create the Higgsfield API account at https://open.higgsfield.ai, register a payment method, fund **$5** (the minimum), create an API key (ID + secret). Paste into `/home/turbo/creative-game/.env.local` as `HF_CREDENTIALS=<id>:<secret>` (format from the SDK example: UNVERIFIED for the delimiter, the agent will test on the first call).
- Read and accept the API/Developer Terms and confirm they match the web terms (own outputs, commercial use, training-on-your-content).
- Optional: a Google AI Studio key as `GEMINI_API_KEY` if stills should go direct (agent then adds a second provider to the script).

## NEEDS OWNER

1. Higgsfield API: account, payment method, $5 balance, API key ID + secret in `.env.local`. Any funding today (before 23:59 UTC 2026-09-30) may earn $1-for-$1 cashback (changelog); not worth rushing for.
2. Confirm API terms (see above); UNVERIFIED that web commercial-use terms cover API output.
3. Read the plan prices in the pricing UI only if a CLI/MCP subscription is ever wanted; not needed for the recommended path.
4. Optional Google AI Studio key.
5. Decision: accept AI-generated marketing art (requires the Steam AI-disclosure box at release).

## Sources

- https://higgsfield.ai/creator-hub/changelog (and RSS), https://higgsfield.ai/llms.txt, https://higgsfield.ai/mcp
- https://docs.higgsfield.ai/docs/llms.txt, `/docs/authentication.md`, `/docs/concepts/rate-limits.md`, `/docs/concepts/billing-and-retention.md`, `/docs/how-to/sdk.md`, `/docs/models.md`, `/docs/concepts/file-uploads.md`
- https://higgsfield.ai/creator-hub/help-center (plans, credits, watermark, ownership, API, MCP, CLI articles)
- https://github.com/higgsfield-ai/cli (README, MODELS.md), https://github.com/higgsfield-ai/skills, npm `@higgsfield/cli` 1.1.26, `@higgsfield/client` 0.2.6, PyPI `higgsfield-client` 0.2.0
- https://ai.google.dev/gemini-api/docs/pricing, https://ai.google.dev/gemini-api/docs/image-generation
- https://developers.openai.com/api/docs/pricing, https://fal.ai/pricing, https://bfl.ai/pricing
- https://partner.steamgames.com/doc/gettingstarted/contentsurvey
