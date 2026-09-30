export const meta = {
  name: 'kingswarm-ui-build',
  description: 'Build the DOM UI kit and all screens against fake data in a lab page, critique as UX/visual director, then fix',
  phases: [
    { title: 'Build', detail: 'UI kit, HUD, all screens, lab page with fake data', model: 'opus' },
    { title: 'Critique', detail: 'UX + visual review from screenshots at 3 viewports', model: 'opus' },
    { title: 'Fix', detail: 'apply critique', model: 'opus' },
  ],
}
const REPORT = {
  type: 'object',
  properties: {
    built: { type: 'array', items: { type: 'string' } },
    api_summary: { type: 'string' },
    verified: { type: 'string' },
    screenshots: { type: 'array', items: { type: 'string' } },
    looks_wrong_still: { type: 'array', items: { type: 'string' } },
    notes_for_integrator: { type: 'string' },
  },
  required: ['built', 'api_summary', 'verified', 'screenshots', 'looks_wrong_still'],
}
const CRIT = {
  type: 'object',
  properties: {
    verdict: { type: 'string' },
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['must-fix', 'should-fix', 'nice'] },
      screen: { type: 'string' }, problem: { type: 'string' }, direction: { type: 'string' } },
      required: ['severity', 'screen', 'problem', 'direction'] } },
    keep: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'issues'],
}
const COMMON = `
You are the studio's senior UI engineer and designer on Kingswarm, working in /home/turbo/creative-game (branch v1). CLAUDE.md (studio rules) is in your context. Read first: design/ART.md (section "UI: storybook cards on the battlefield" and the palette), design/GDD.md (all of it: you are building the screens for sections 4-7), design/research/onboarding-ux.md (HUD spec, flow map, control table, accessibility checklist: follow it), design/STUDIO.md (machine limits).

You own: src/ui/** , lab/ui.html, lab/ui-lab.ts, public/fonts/**, licenses/fonts.md. Other engineers are building src/sim, src/render and src/audio right now: do not import from them except TYPES from src/sim/types.ts (HeroId, MutationId, Team). The integrator will later map real game state onto your view models, so your UI must be driven purely by plain-data models and callbacks that you define in src/ui/types.ts.

Tech: vanilla TypeScript + DOM + CSS (no framework, no runtime dependency). One stylesheet or CSS modules imported by the UI entry (Vite handles CSS). CSS custom properties for the palette from ART.md. Fonts bundled locally as woff2 in public/fonts (OFL; sources in design/research/assets-audio.md section 3; record licence in licenses/fonts.md; subset to Latin to keep each file small). No external network requests of any kind. All icons are inline SVG you draw from simple shapes (22 Mutation icons, 4 tag icons, trait icons, key/button glyphs for keyboard, mouse and gamepad, building/critter/crown/heart pictograms).

Headless capture: npx vite --port 5240 --strictPort (background), then node tools/shot.mjs "http://localhost:5240/lab/ui.html?screen=draft" shots/ui-draft.png --wait 800 [--size 800x450] ; view PNGs with the Read tool; stop the server when done (pkill -f "[v]ite --port 5240").
`
phase('Build')
const build = await agent(COMMON + `
TASK: build the complete UI layer against fake data.

API shape (you finalise it in src/ui/types.ts and src/ui/index.ts):
  createUi(root: HTMLElement): Ui
  ui.show(model: ScreenModel): void          // ScreenModel is a discriminated union, one member per screen below; callbacks are fields on the model
  ui.hud: { mount(model: HudStatic): void; update(frame: HudFrame): void; unmount(): void; prompt(p: HintPrompt | null): void; message(text: string): void; bark(b: { text: string; x: number; y: number; team: 0 | 1 }): void }
  ui.toast(text: string, icon?: string): void
  ui.nav(action: 'up' | 'down' | 'left' | 'right' | 'accept' | 'back'): void   // so a gamepad poller can drive menus
  ui.setDevice(d: 'kbm' | 'gamepad' | 'touch'): void                          // swaps glyphs everywhere
  ui.setScale(s: 1 | 1.25 | 1.5): void
HudFrame is applied every animation frame: it must only touch the DOM when a value actually changed (cache last values; use transforms for anchored elements); no layout thrash, no allocations per frame beyond the unavoidable.

Screens (each reachable in the lab via ?screen=<id>, rendered over a static screenshot of the 3D diorama used as the lab background so you judge them in context: use shots/spike3.png if no newer render exists in shots/):
  boot        minimal loading state, then a single big Play button over the live arena (first launch has nothing else).
  title       returning player: logo, [Continue run] (only if a run is saved) / [New run] primary, secondary: Versus (shown disabled with "coming soon"), Codex, Settings. Small build/version text.
  heroPick    3 hero cards (name, one-line playstyle, the two abilities with glyphs; locked heroes show how to unlock), last hero preselected, Crown Level selector if unlocked (GDD section 7), Enter accepts.
  rivalCard   pre-battle card, ~3 s, skippable: portrait slot (accepts an HTMLCanvasElement/ImageBitmap/URL from the caller; draw a placeholder silhouette if absent), name and title, two trait icons with 1-2 word labels, their Mutations as small chips, battle number "Battle 2 of 5", your lives.
  hud         in-battle HUD per onboarding-ux.md section 2: top-centre timer pill + two-sided Crown progress bar (hidden until the Crown opens; timer pulses and changes icon under 0:30); top-left your building count, top-right rival name/portrait chip + building count; swarm badge anchored at a screen position supplied per frame (with-you / cap, plus "away" count), ability + ultimate + dash + recall buttons with radial cooldowns and device glyphs at bottom-left (they are also clickable/tappable); rival ability readiness chips near the rival chip; one-line message area; adaptive hint prompt (max 8 words + glyph, anchored at a supplied screen position); bark bubbles anchored at supplied screen positions, auto-expiring; lives; pause button top-right; owned Mutations as a compact row of icons (tooltip on hover/focus); rampage/frenzy/overtime state chips. Must stay legible at 800x450 (min 12 px rendered text) and scale with ui.setScale.
  pause       Resume / Restart battle / How to play (controls for the current device) / Settings / Abandon run (confirm).
  settings    master/music/SFX sliders, mute, screen shake slider, reduce flashes, colour-blind mode, fire mode hold/toggle, aim assist, UI scale, show hints, Assist mode (with the honest one-line explanation from the GDD), reset progress (confirm). Emits a full settings object on change.
  result      after a battle. Win: big "Victory", 2-3 near-miss/brag facts (e.g. "Throne taken at 1:12", "Swarm peak 46"), [Next] focused. Loss: "Defeated", near-miss facts ("Crown held 8.4 of 10 s"), lives left as crowns (one breaking), [Rematch] focused. One primary button only; small secondary "Menu" link.
  draft       the hook screen. Header "Choose a Mutation", 3 Mutation cards (tag colour band, large icon, name, one sentence, tag chip; Duo cards look special and show the two tags), reroll button with remaining count, skip link, a row of owned Mutations, and a "Next: <rival>" preview strip with portrait slot, traits and the one-line question that rival asks. Cards animate in with overshoot and a small stagger; hover/focus lifts the card; pick plays a satisfying select animation then calls back. Keyboard: left/right + Enter, 1/2/3 keys. Each card has a slot where the integrator can mount a small live preview canvas later (leave a hook, show the icon large meanwhile).
  runOver     run lost: "The run ends", your build (Mutations), how far you got on the ladder (5 rival pips + boss), near-miss of the final battle, unlocks earned this run (cards flip in), one focused button [New run], secondary [Title]. Optional one-time Assist offer line.
  runWon      run cleared: celebration, build recap, time, unlocks (new Crown Level / hero / Mutations), [New run] / [Title].
  codex       tabs: Mutations (grid; discovered show icon/name/text and pick count; undiscovered show "?" silhouettes; Duo recipes hidden until found, showing only their two tag icons), Rivals (each rival: portrait slot, traits, flaw hint revealed after first win, best result per hero / Crown Level), Heroes. Back returns.
  howto       controls reference for the current device (keyboard+mouse, gamepad, touch) as a clean glyph table, plus the three core verbs in 8 words each.
Include the full Mutation catalogue as fake data in the lab (names, tags and sentences exactly from GDD section 4) and the rivals from GDD section 6.

Quality bar: this must look like a shipped commercial game UI, cohesive with a toy-diorama battlefield: parchment cards with thick ink outlines and hard shadows, slight rotations, gold primary buttons that compress on press, confident typography, generous spacing, no default browser widgets showing (style sliders, checkboxes, focus rings), visible keyboard focus, motion under 250 ms that respects prefers-reduced-motion. Test every screen at 1280x720 and 800x450, and hud/draft/result also at 1920x1080. Look at every screenshot you take and iterate until you would be proud to ship it; then list what still looks wrong.
Accessibility: semantic buttons, aria-labels on icon buttons, focus order, colour contrast (text 4.5:1), nothing conveyed by colour alone.
A few Vitest specs for pure logic (e.g. time formatting, focus-grid navigation, HUD diffing) are welcome; visuals are verified by screenshots.
`, { label: 'ui:build', phase: 'Build', model: 'opus', effort: 'high', schema: REPORT })

phase('Critique')
const crit = await agent(`You are a UX and visual design director for commercial games (Supercell/Nintendo-level polish expectations) reviewing a new game UI. Project: /home/turbo/creative-game. Read design/ART.md, design/GDD.md, and design/research/onboarding-ux.md (HUD spec, flow, accessibility). The engineer's report: ${JSON.stringify(build)}.

Capture your own evidence: start npx vite --port 5241 --strictPort in the background from the repo root; for each screen id (boot, title, heroPick, rivalCard, hud, pause, settings, result, draft, runOver, runWon, codex, howto; check the lab source lab/ui-lab.ts for exact ids and variants such as result win/loss) run node tools/shot.mjs "http://localhost:5241/lab/ui.html?screen=<id>" shots/uicrit-<id>.png --wait 900 ; also hud, draft and result at --size 800x450 and --size 1920x1080. LOOK at every PNG with the Read tool. Stop the server after (pkill -f "[v]ite --port 5241").

Judge each screen: (1) first-glance clarity: is the one primary action obvious; could a 10-year-old and a distracted adult both use it; (2) visual quality and cohesion with ART.md: does it look like a shipped game or a web form; typography hierarchy, spacing, alignment, contrast, icon quality and consistency; (3) the draft screen specifically: does picking a Mutation feel exciting and are the three options easy to compare; (4) HUD: is anything covering the battlefield unnecessarily, is text legible at 800x450, is the most important information (timer/crown, swarm count, cooldowns) where eyes go; (5) overflow, clipping, overlap, broken layout at any viewport; (6) anything that violates the GDD bloat guard or the onboarding rules (text walls, more than one primary button, more than 8 words in a prompt). Do not edit files. Be concrete: screen, problem, direction. List what is good and must be kept.`,
  { label: 'ui:critique', phase: 'Critique', model: 'opus', effort: 'high', schema: CRIT })

phase('Fix')
const fix = await agent(COMMON + `
TASK: the UI layer exists (engineer report: ${JSON.stringify(build)}). The design director reviewed it: ${JSON.stringify(crit)}.
Fix every 'must-fix', then 'should-fix', then cheap 'nice' items; keep what the director said to keep. Re-shoot each changed screen at 1280x720 and 800x450 and look at it to confirm. Keep the public API stable (or describe exactly what changed in notes_for_integrator). Finish when npx tsc --noEmit is clean for your files and any specs pass. In looks_wrong_still list each critique item as fixed / partly / not fixed (why). In api_summary give the final API the integrator will code against (types and one usage example per screen family).
`, { label: 'ui:fix', phase: 'Fix', model: 'opus', effort: 'high', schema: REPORT })
return { build, crit, fix }
