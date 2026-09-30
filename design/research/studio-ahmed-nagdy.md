# Studio research: Ahmed Nagdy (أحمد نجدي) YouTube channel (checked 2026-09-30)

Scope: what the AI studio lead can act on this week. Transcripts were Arabic (Egyptian) auto-captions pulled with yt-dlp
(no video downloaded) and translated by me. Every actionable claim was checked against a primary source the same day.
Tags: CONFIRMED (URL), OUTDATED (what changed), UNVERIFIED (no primary source reachable).
Limits of this pass: the WebSearch budget ran out early, so identity and video data come from yt-dlp metadata plus one search;
OpenAI's marketing pages returned 403 (its API pricing page was readable); Higgsfield pricing is behind signup.

## Bottom line for the studio

1. **ADOPT NOW: pin routing to the confirmed lineup and set effort explicitly on every agent.** Opus 5.5 at `medium` is the
   default heavy worker (Anthropic: matches Opus 5 at `high` for ~40% less cost). Sonnet 5.5 at `high` for routine work,
   `xhigh` only for hard tasks, never `max` (Anthropic's own chart shows Sonnet 5.5 scores lower at max than at xhigh, and
   Nagdy measured max at ~2.8x the cost of xhigh). Fable 5.1 at `medium` for planning and arbitration. Haiku stays 4.5:
   Haiku 5.5 is announced but not shipped. Claude Code defaults Opus/Sonnet 5.5 to `medium`, the API to `high`, so never rely on defaults.
2. **ADOPT NOW: exploit the prompt cache in fan-outs.** Workflow agents that share model, effort, tools, schema and cwd share
   a cache prefix (docs, confirmed). Give sibling agents identical settings, keep one long session per task instead of many
   fresh chats. Cache reads are cheap: Fable 5.1 $0.25/MTok (was $1), Opus 5.5 $0.20, Sonnet 5.5 $0.20.
3. **ADOPT NOW: author is never the reviewer.** Nagdy's best transferable idea: a plan or diff reviewed by a different
   model/context finds gaps the author missed, every time (his experience, not a benchmark). Inside our means: reviewer =
   different tier and fresh context, run as a dynamic-workflow stage or `code-review` skill. Cross-vendor reviewer: item 8.
4. **ADOPT NOW: keep the grill -> spec -> tickets -> implement -> review pipeline from mattpocock/skills.** It is his core
   loop (100+ GitHub issues closed in 2 days, self-reported anecdote). The repo is real (272.6k stars, MIT) and now ships
   `to-spec`, `to-tickets`, `implement`, `teach`. The plugin visible to this session lists none of those four: it is stale.
   Refresh it at project scope (`npx skills@latest add mattpocock/skills`), not by editing `~/.claude`.
5. **TRY LATER: Higgsfield MCP, for marketing assets only** (trailer, key art, logo sting, store screenshots-as-video).
   Never for shipped assets: the game has a 5 MB budget, no external requests, and CC0 kits already cover 3D (assets-audio.md).
   Needs an owner account and plan (see NEEDS OWNER). His demo is real but cost and quality data are his alone.
6. **TRY LATER: a Routine as a staleness watcher.** Weekly `/schedule` job that re-reads pricing/models pages, diffs
   `design/research/*.md` claims, opens a `claude/` branch PR. Routines are research preview (confirmed). No auto-merge into
   the live build: CLAUDE.md gives push and `docs/` to the lead, and Nagdy's "I never look at it" model is exactly the risk.
7. **TRY LATER: `guard-skills` (clean-code-guard, test-guard).** MIT, 1.3k stars, language-agnostic, works with Vitest. Overlaps
   our tests-first law and mattpocock `tdd`. Read both SKILL.md files before installing; project scope only.
8. **SKIP (for now): Delegate Skills cross-CLI fleet.** Real (2.3k stars, MIT, 20+ CLIs, review-first, relays never commit) but
   it only pays off with several paid CLIs (Codex, Grok, GLM). We have Claude only; tiered subagents give the same
   cheap-implementer/strong-planner split. Revisit if the owner adds a second vendor. Note: several supported CLIs have no read-only mode.
9. **SKIP: ZadLoop, JEV classifier model, GPT-6.1/Codex ecosystem, subscription-budget guide.** ZadLoop is his own alpha (macOS/Windows first,
   Linux not out per his Sept 13/18 videos); JEV is a yes/no classifier with no job in a game loop today; we are not on OpenAI;
   plan advice is personal and reprices monthly.
10. **RULE: treat the channel as a release radar, not a source.** He posts reaction videos hours after launch ("model dropped minutes ago"),
    tests with one sandbox prompt, and has referral or own-product links on most videos. Use it to learn what shipped,
    then read the vendor page. Two of his model takes were already superseded (Gemini 3.7 -> 3.8 Flash; Opus 4.8 as workflow default).

## Coverage gaps (be honest about what is not here)
He covers no game design and no 3D-model generation. His creative-tool content is one Higgsfield demo. For 3D, the assets-audio.md
CC0 route stands. For game design, use genre-teardown.md and fun-ai.md. Nothing found about image-to-3D pipelines from him.

## Identity
Channel: **Ahmed Nagdy - أحمد نجدي**, handle **@NagdyWP**, channel id UCV5-PB2LLRn0v3LZ5Rqu2Xw, 44.3K subscribers on 2026-09-30
(yt-dlp), also reachable as /c/MrNagdy. Arabic (Egyptian), WordPress and AI: latest 40 uploads run 2026-05-23 to 2026-09-29, twice weekly.
Topics match the brief: Claude/Opus/Fable/Sonnet launch reactions, Claude Code workflows, delegation, GLM/Kimi/MiniMax/Gemini/GPT model
tests, Higgsfield. Other same-name channels exist (@ahmeds_shots, an Ahmed Ai channel, an "Ahmed Nagyاحمد ناجي" channel): not this one.
He is also the author of `amElnagdy/delegate-skills`, `guard-skills`, `review-skills`, claude.nagdy.me and ZadLoop (github.com/amElnagdy, nagdy.me/links).
Conflicts of interest seen in descriptions: Higgsfield referral link, Wispr Flow referral, MiniMax coding-plan code, ZadLoop launch links.

## Evidence: videos surveyed (12 of 40 read in full or in part)

| # | Date | Video (translated) | URL |
|---|---|---|---|
| 1 | 2026-09-29 | Sonnet 5.5 is out: run it on High or xHigh? | https://www.youtube.com/watch?v=j0Qfu1F7ozM |
| 2 | 2026-09-28 | I turned Claude into a video director: Opus 5.5 + Higgsfield | https://www.youtube.com/watch?v=MmoaYrj2peY |
| 3 | 2026-09-22 | Opus 5.5 is out: cheaper, faster, stops rambling | https://www.youtube.com/watch?v=H1zhKk0S9_4 |
| 4 | 2026-09-29 | A $500 plan and a new model? The truth behind OpenAI DevDay 2026 | https://www.youtube.com/watch?v=ccjFxFNl7H8 |
| 5 | 2026-09-02 | Fable 5.1 Medium beats Fable 5 High and is cheaper: how? | https://www.youtube.com/watch?v=9dcdFSFGXSo |
| 6 | 2026-08-10 | More than one AI subscription? This saves money (Delegate Skills) | https://www.youtube.com/watch?v=YZbu0fndK40 |
| 7 | 2026-08-29 | The AI workflow I use now: 100 tasks in 2 days | https://www.youtube.com/watch?v=_defPaP5bFc |
| 8 | 2026-06-11 | Your money is gone (Claude Dynamic Workflows) | https://www.youtube.com/watch?v=Ej8sEhXaybo |
| 9 | 2026-06-13 | Make Claude learn instead of explaining every time (teach + guard skills) | https://www.youtube.com/watch?v=Q22UVsbU9GA |
| 10 | 2026-08-21 | I let AI run the website alone for 5 months | https://www.youtube.com/watch?v=cAauCAZkXTU |
| 11 | 2026-09-18 | New model whose output tokens are free (JEV classifier) | https://www.youtube.com/watch?v=S4w9ivqgG8U |
| 12 | 2026-08-15 | Gemini 3.7 Flash is fast, but GLM 5.3 is another story | https://www.youtube.com/watch?v=3PhIt2rk0Cc |
Also skimmed, not used: 2026-09-13 ZadLoop launch (Vc1HvrN7kDA), 2026-09-08 subscription budgets (cfkrrydlalg), 2026-09-24 "Is this really GPT-6?" (J6zk3ZVrPeA).

### 1. Sonnet 5.5 effort (age 1 day)
Claims: same $2/$10 price as Sonnet 5; his sandbox task on High took ~8 min and $2.18-equivalent, on xHigh ~15 min and $3.54; xHigh no clearly better;
Max ~$7.6 per task, "forget Max"; Anthropic charts show Low ~ Medium, gains start at High/xHigh; use Sonnet as the implementer under Opus/Fable.
- CONFIRMED: $2/$10, id `claude-sonnet-5-5`, released 2026-09-28, 1M context: https://platform.claude.com/docs/en/models/sonnet-5-5/overview
- CONFIRMED: 30% faster and up to 30% cheaper than Sonnet 5; "scores lower at Max than at Xhigh" on FrontierCode; Terminal-Bench 4.0 70.6 (Opus 5.5 66.4),
  FrontierCode 46.2 vs Opus 54.4, CursorBench 4.0 55.5 vs Opus 57.8; Max sometimes spawns review subagents that time out or edit out of scope: https://www.anthropic.com/claude-sonnet-5-5
  (Sonnet 5's 10.3% Terminal-Bench looks anomalous; do not build on the "10% to 70%" jump.)
- His per-task dollar figures: UNVERIFIED (one task, one run). Direction (High cheaper, Max wasteful) matches Anthropic.

### 2. Higgsfield + Opus 5.5 (age 2 days)
Workflow shown: connect Higgsfield MCP to Claude; Claude writes prompts, calls GPT Image 2 / Nano Banana for start and end frames,
sends them to Seedance 2.5 for animation, watches the result, and re-edits itself; logo animation, then per-feature scenes (paper-to-theme-swap opening, a
delegation UI shot, 8 s notification scene, Windows and Mac variants shown side by side). Rule he stresses: give references and two frames (start/end), never one prompt.
Cost: the Claude session was ~$27 of API-equivalent usage on his plan; Higgsfield video used ~a quarter of his limit for ~12 s of scenes.
- CONFIRMED: MCP server URL `https://mcp.higgsfield.ai/mcp`, connects as a Claude custom connector or `claude mcp add`; 40+ workflows incl. Motion Design (After Effects, editable),
  Blender workflows (Scene-Builder, Cartoon-shaders, Destruction Studio, Exploded-view: editable .blend scenes), a "paper diorama" faceless-video workflow; 30+ models incl. Seedance, Kling 3,
  Nano Banana Pro, GPT Image 2, Soul 2.0: https://higgsfield.ai/mcp . Homepage lists Seedance 2.5, Cinema Studio 4.0, "3D Jutsu" (described only as camera control): https://higgsfield.ai/
- UNVERIFIED: plans ($9 / $23 / Max from $59, "7 videos on the $9 plan", 3 free Seedance runs): pricing page renders behind signup. The MCP page says "no API key"; login and credit use surely still apply: check on connect.
- His claim that Seedance beats Kling/MiniMax is one person's sample. His Opus 5.5 "video director" framing is really: Claude orchestrates, Higgsfield models generate.
- Relevance: the Blender outputs are editable scenes, not runtime GLBs; they could feed a trailer render but nothing in the shipped game.

### 3. Opus 5.5 (age 8 days)
Claims: five version numbers skipped; $4/$20 (20% under Opus 5); less rambling; default effort medium; Medium beats Fable 5.1 and Astra on Terminal-Bench; higher 5-hour limits; first "banked reset"; Sonnet 5.5 and Haiku 5.5 follow.
- CONFIRMED (all): https://www.anthropic.com/claude-opus-5-5 : 2026-09-22, $4/$20, cache read $0.20, medium default, Terminal-Bench 4.0 66.4 vs Opus 5 52.3, FrontierCode 54.4 vs 48.0,
  saveable rate-limit reset, "Sonnet 5.5 and Haiku 5.5 will follow in the coming weeks". Docs: "Opus 5.5 at medium matches or exceeds Opus 5 at high" (https://code.claude.com/docs/en/model-config).
- His "medium beats Astra/Fable in charts" repeats Anthropic's own chart: vendor benchmark, not independent. His verdict "use Fable for lead, Opus to implement" = our own routing.
- OUTDATED (partly): Haiku 5.5 "announced": still not released; models overview lists Haiku 4.5.

### 4. OpenAI DevDay 2026 (age 1 day; not our vendor)
Claims: GPT-6.1 Sol at $2/$10, cache $0.10; Astra $10/$50; $500 Pro plan with "Ultrafast" mode (about 8x speed) ; $200 plan usage halved on Oct 30 with $2,500 API credit; Decision API ~150 ms.
- CONFIRMED: API prices only: gpt-6.1-sol $2.00 in / $0.10 cached / $10.00 out; gpt-6-astra $10/$50; gpt-6-luna $0.10/$0.50; "Priority processing was renamed Fast mode on July 30, 2026": https://developers.openai.com/api/docs/pricing
- UNVERIFIED: $500 plan, Ultrafast, plan-limit cut, credit dates, banked resets on OpenAI's side (openai.com returns 403).

### 5. Fable 5.1 (age 28 days)
Claims: price unchanged $10/$50; real saving is cache reads $1 -> $0.25 (75%); about 25% cheaper typical, up to 45% agentic; Medium beats Fable 5 High and GPT-5.6 Max on CursorBench at lower cost; fewer false-positive fallbacks to Opus (60%); tip: set up a statusline and `/compact` near 40% context, one chat per task.
- CONFIRMED: https://www.anthropic.com/claude-fable-and-mythos-5-1 (2026-09-01): $0.25 cache read, 25%/45% savings, 60% fewer cyber false positives, price unchanged. Pricing table: https://platform.claude.com/docs/en/about-claude/pricing
- UNVERIFIED: his per-task numbers ($8.77 at 66.5% vs $3.5 at 68%): the announcement quotes CursorBench 3.2.0 73.4 vs 70.5 at max effort, a different cut. The "compact at 40%" number is his heuristic, no source.

### 6. Delegate Skills (age 51 days, mid-age: revalidated)
Claims: orchestrator (Claude/Codex) writes a brief, code (not the model) dispatches to another CLI, reviews the diff; `delegate-setup` builds named lanes ("crews": tests, review, implement) with model and effort per lane; debate mode reviews plans across two models.
- CONFIRMED and updated: 2.3k stars (he said 1,400 on Aug 29), 185 forks, MIT, `npx skills add amElnagdy/delegate-skills`, 20+ implementer CLIs, no network calls or telemetry in relay code, relays never commit, setup writes only after approval, global and project config. Risk noted in README: some CLIs (e.g. `--yolo`) have full tool access and no enforceable read-only mode: https://github.com/amElnagdy/delegate-skills

### 7. The 100-task workflow (age 32 days)
Stack: mattpocock grill-with-docs -> to-spec -> to-tickets (GitHub issues, labels ready-for-agent) -> implement, plus delegate-skills; planner Fable 5.1 medium or Opus high, implementer Codex/Grok/GLM Flash; optional two-model debate review; context kept under ~40%.
- CONFIRMED: repo mattpocock/skills: 272.6k stars (he quoted 239k), MIT, skills as above: https://github.com/mattpocock/skills . Stars are a popularity number, not a quality proof.
- The "100 issues in 2 days" is a self-report on his own repos, not a benchmark.

### 8. Dynamic Workflows (age 111 days: borderline stale, revalidated)
Claims: script-writing runs of up to ~1000 subagents; `/effort ultracode`; pick a smaller model for subagents to save limit; a single run can exceed 1M tokens; his defaults ran Opus 4.8.
- CONFIRMED: https://code.claude.com/docs/en/workflows : JS script, up to 16 concurrent (configurable to 256), 1,000 agents per run, `ultracode` keyword or `/effort ultracode`, save with `s` to `.claude/workflows/`, agents' model chosen like subagents.
- OUTDATED: workflows now default to a `medium` size guideline (<10 agents; `small` on Pro) since v2.1.219, so his 100+ agent runs need an explicit size override; Opus 4.8 is a legacy model.
- Studio note: our Workflow tool already implements this. Use `/workflows` progress view and a small slice first.

### 9. Teach + guard skills (age 109 days)
`teach` turns an article into a stateful lesson with quizzes; guard skills make generated code follow clean-code and test rules.
- CONFIRMED: `teach` exists in mattpocock/skills; `guard-skills` 1.3k stars, MIT, five skills (clean-code, test, docs, WordPress, WooCommerce guards): https://github.com/amElnagdy/guard-skills . Not verified by running them.

### 10. AI runs the website (age 40 days)
Three daily scheduled jobs (detect Claude Code changelog changes from Anthropic's GitHub, decide docs updates, open PR + bot review + auto-merge -> Cloudflare deploy), built first on a $9 VPS with MiniMax, moved to MiniMax Code in a day; logic packaged as a skill so it runs on any agent. Site: static Astro on Cloudflare Pages.
- CONFIRMED (as a pattern): Claude Code routines: cloud, schedule/API/GitHub triggers, minimum 1 h interval, work in `claude/` branches, research preview, requires claude.ai login: https://code.claude.com/docs/en/routines
- Caveats: static site, low blast radius; sponsored by a MiniMax code. Package the logic as a skill, keep a human gate on anything public.

### 11. JEV classifier (age 12 days)
Claims: classifier model from "TypeSafe" returns a label with a confidence score, input priced ~$0.04/M and output free; beat Gemini Flash on his tweet-classification test (185 vs 183 correct of 216) at 10 s vs 67 s and about a third of the cost; candidate for auto-mode permission checks.
- UNVERIFIED: no vendor page checked; the accuracy edge is within noise on his own test. Use case for Kingswarm: none now (maybe playtest-feedback triage later).

### 12. Gemini 3.7 Flash vs GLM 5.3 (age 46 days)
- OUTDATED: Gemini 3.8 Flash is out (`gemini-3.8-flash`, $0.75 in / $3.75 out through 2026-12-31, then $1.50/$7.50): https://ai.google.dev/gemini-api/docs/pricing
- CONFIRMED: GLM-5.3 $1.4 in / $4.4 out; GLM-5.3-Flash $0.15/$0.50: https://docs.z.ai/guides/overview/pricing . Whether GLM 5.3 is "frontier for coding" is his single-task opinion: UNVERIFIED.

## Other current facts checked
- Lineup and effort levels (low/medium/high/xhigh/max for Fable 5.1, Opus 5.5, Sonnet 5.5): https://platform.claude.com/docs/en/models/overview , https://code.claude.com/docs/en/model-config
- Sonnet 5.5 has no temperature/top_p/top_k (400 error) and forced tool use fails: irrelevant to Claude Code, relevant only to raw API scripts.

## NEEDS OWNER
1. **Higgsfield account and plan** (only if we make trailer/key-art): sign up at higgsfield.ai, pick a paid plan (Nagdy quotes $9 to $59/month: UNVERIFIED), then complete the connector login in a browser. After that the lead adds it in-repo:
   `claude mcp add --scope project --transport http higgsfield https://mcp.higgsfield.ai/mcp` (writes tracked `.mcp.json`). Also confirm commercial-use terms for generated media before any public use.
2. **GitHub connection for Routines** (only for item 6): a claude.ai subscription login in the CLI (not an API key), the Claude GitHub App installed on the repo, and a decision on whether the repo may hold `claude/` branches. Owner confirms the cost is acceptable: routines draw on plan limits.
3. **Second-vendor CLI subscription** (only if Delegate Skills or cross-vendor review is wanted): a Codex/ChatGPT, Grok or GLM plan plus that CLI's login. Not needed now.
4. **Decision: plugin scope for mattpocock-skills.** The installed copy lacks `to-spec`, `to-tickets`, `implement`, `teach`. Updating it means touching `~/.claude` (user scope), which the brief forbids. Either the owner approves that update or the lead vendors the skills into the repo.
