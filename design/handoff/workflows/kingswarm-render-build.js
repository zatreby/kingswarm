export const meta = {
  name: 'kingswarm-render-build',
  description: 'Build the Three.js diorama renderer: scene and characters, art critique, then VFX and feel, second critique and fixes',
  phases: [
    { title: 'Scene', detail: 'island, lighting, buildings, critters, Kings, camera, lab fixtures', model: 'opus' },
    { title: 'Critique 1', detail: 'art director reviews screenshots against ART.md', model: 'opus' },
    { title: 'Feel', detail: 'event-driven VFX, flight arcs, squash, trauma shake, fixes from critique', model: 'opus' },
    { title: 'Critique 2', detail: 'readability + feel review', model: 'opus' },
    { title: 'Polish', detail: 'apply second critique', model: 'opus' },
  ],
}

const REPORT = {
  type: 'object',
  properties: {
    built: { type: 'array', items: { type: 'string' } },
    verified: { type: 'string' },
    screenshots: { type: 'array', items: { type: 'string' } },
    looks_wrong_still: { type: 'array', items: { type: 'string' } },
    contract_requests: { type: 'array', items: { type: 'string' } },
    asset_notes: { type: 'string' },
    perf: { type: 'string' },
  },
  required: ['built', 'verified', 'screenshots', 'looks_wrong_still'],
}
const CRIT = {
  type: 'object',
  properties: {
    verdict: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['must-fix', 'should-fix', 'nice'] },
          where: { type: 'string' },
          problem: { type: 'string' },
          direction: { type: 'string' },
        },
        required: ['severity', 'where', 'problem', 'direction'],
      },
    },
    keep: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'issues'],
}

const COMMON = `
You are the studio's senior graphics engineer / technical artist on Kingswarm, working in /home/turbo/creative-game (branch v1). CLAUDE.md (studio rules) is in your context. Before writing code read: design/ART.md (the look), design/GDD.md sections 1-3 and 9, src/sim/types.ts (the World you draw), design/research/tech-rendering.md sections 4, 6 and 8 (measured Three.js recipe and gotchas for r186: MeshToonMaterial + 3-step gradient, inverted-hull outline InstancedMesh sharing instanceMatrix, PCFShadowMap (PCFSoftShadowMap was removed), no post-processing), design/research/game-feel.md (values for squash, shake, flashes, readability), design/research/assets-audio.md section 1 and 5 (CC0 KayKit asset sources with tested download commands). spike/spike.ts is an early look test by the lead showing scale and camera that read well; it is a reference, not code to keep.

You own: src/render/**, lab/render.html, lab/render-lab.ts, public/models/**, tools/assets/** (download/convert scripts), licenses/art.md, and devDependencies you need for the asset pipeline (e.g. @gltf-transform/cli). Raw downloads go in assets-src/ (gitignored). Another engineer is building src/sim right now: import only TYPES from src/sim/types.ts and never edit src/sim.

Headless capture (real GPU): start your dev server on a port in 5210-5219 (e.g. npx vite --port 5210 --strictPort), then node tools/shot.mjs "http://localhost:5210/lab/render.html?scene=midfight" shots/render-midfight.png --wait 2500 ; view PNGs with the Read tool. tools/shot.mjs also supports --size WxH and --steps. Always look at what you made, at 1280x720 and once at 800x450, and iterate until it matches ART.md. Stop your dev server when done (pkill -f "[v]ite --port 5210").

Renderer contract (src/render/index.ts):
  createRenderer(container: HTMLElement): Promise<Renderer>
  interface Renderer {
    readonly canvas: HTMLCanvasElement
    loadMatch(world: World, opts: { localTeam: Team; looks: [string, string] }): void   // build/replace the static scene for a match; looks = cosmetic King look ids per team
    onEvents(events: readonly SimEvent[], world: World): void                           // called after every sim step with that step's events
    render(world: World, alpha: number, dt: number): void                               // alpha: 0..1 interpolation between entity (px,py) and (x,y); dt: real seconds since last frame, for cosmetic animation
    screenToWorld(clientX: number, clientY: number): { x: number; y: number }           // ground-plane hit in sim units (ray vs y=0 plane)
    worldToScreen(x: number, y: number, height?: number): { x: number; y: number }      // CSS px, for DOM HUD anchors
    setAim(team: Team | null): void                                                     // which King shows the aim reticle + range ring (local human), null for none
    resize(): void
    setOptions(o: { quality?: 'low' | 'medium' | 'high'; shake?: number; reduceFlash?: boolean; colorBlind?: boolean }): void
    dispose(): void
  }
Sim space: x 0..32 right, y 0..18 toward the camera. Map sim (x, y) to three (x - 16, height, y - 9). The whole arena plus a margin must be in frame at 16:9 and letterbox sensibly at other aspects (fit by both width and height).
Presentation state (particles, shake, animation phases, cosmetic RNG) lives in the renderer; use Math.random/performance freely here, never write to the World.
Performance target: under 4 ms per frame at 1280x720 on this Intel Iris Xe with 200 critters; no per-frame allocations in the hot path; InstancedMesh for critters (one per critter kind or one shared with per-instance scale), eyes included.
`

phase('Scene')
const scene = await agent(COMMON + `
TASK (stage 1 of 2): the static and living scene, no event VFX yet.

1. Lab harness: lab/render.html + lab/render-lab.ts builds fixture Worlds BY HAND from the types (the sim may not be finished; do not depend on it) and drives createRenderer. Scenes via ?scene=: 'opening' (match start: two Kings at their Thrones with 10 followers each, all other buildings neutral), 'midfight' (Blue owns 4 buildings, Red 3, a partial capture ring in progress, ~60 Blue and ~50 Red critters: followers around each King, garrisons on buildings, a volley of 12 Blue critters mid-flight at different flight fractions toward a Red hut, a brawl in the open), 'crown' (phase 'crown', both Kings and swarms contesting the centre, crown progress partially filled), 'mutants' (every CritterKind for both teams lined up and labelled by position, plus a turret, a scorch zone, a vortex zone, a tower), 'lineup' (close camera on: each King look, each critter kind, each building kind in neutral/blue/red, for asset QA). Give the lab a gentle fake animation (followers bobbing, flight fractions advancing and looping) so motion code is exercised. Expose window.__lab = { renderer, world } for debugging.

2. Island and light per ART.md: rounded grass island with cliff edge in deep water, subtle grass patches, dirt paths between nearby buildings, sun + sky fill, soft PCF shadows fitted to the arena, toon shading. Obstacles from world.obstacles: 'rock' clusters, 'trees' clumps, 'pond' discs. Decorative trees/rocks/flowers around the rim and in empty areas, never inside a building's capture zone or on paths, seeded so the map looks the same every time.

3. Buildings: evaluate the CC0 KayKit Medieval Hexagon pack (download with the tested sparse-checkout commands in assets-audio.md into assets-src/, convert only the few models you use into public/models with gltf-transform, shrink the shared atlas to 256 px; record source URL, licence and date in licenses/art.md). Map: Throne = castle, Hut = home, Tower = tower, Crown = a well/shrine with a golden crown floating above it when the Crown phase is open (build the crown and any missing piece procedurally). Neutral buildings must read as unowned at a glance (ART.md idea: an unbuilt/stage/scaffold version, or a parchment-coloured roof); Blue and Red by roof/flag colour AND shape cue. If the KayKit pieces do not look right in our scene after a fair try, fall back to procedural low-poly buildings in the same style as spike/spike.ts and say why. Keep total shipped model bytes small (report sizes; target under 400 KB for all buildings and nature).
   Each building shows a capture ring on the ground under it: the arc fills with the owner's/claimant's colour by control/100; contested (both presence > 0) shows a striped or pulsing ring; rings stay visible under crowds.

4. Critters: procedural squashy blobs with big eyes, instanced, team body colour, dark team-tinted outline hull, blob shadow or real shadow. Blue = round-topped, Red = small pointed tuft (shape cue). Kinds: critter, runt (smaller, lighter), brute (bigger, heavier brow or shell), bomber (carries/wears an obvious lit bomb, danger colour), guard (tiny helmet or spear). Animate from state: follow/home = hop while moving (hop phase from critter.tint and distance moved), idle wobble when still; garrison = slow patrol bob; hold = agitated; fly = height from flight fraction u = flightT/flightDur as a parabola with apex scaled by distance (flat Piercers stay low), stretched along velocity, tumbling slightly; stunned = squashed with a tint; slowed = frost tint. Eyes look along velocity or toward the nearest enemy.

5. Kings: procedural blob characters about twice a critter's size with crown, cape and a ground ring in team colour; the local player's King gets an extra clear marker (arrow or brighter ring) so he is found instantly. Looks (opts.looks ids) with distinct silhouettes built from simple shapes: heroes 'brawler' (stocky, big fists or club), 'blink' (slim, hooded, scarf), 'warden' (broad, shield, helmet); rivals 'bumble' (round, sleepy eyes, tiny crown askew), 'pip' (goggles, wrench, backpack), 'brood' (large, many small eyes or egg sacs), 'gorm' (fat, horned helmet), 'sable' (slim, mask, twin daggers), 'mora' (tall ornate crown, long cape, sceptre). Animate: idle breathing, lean and hop when moving, face the aim direction, cape follows velocity. Show state: dashing (stretched), stunned, shield bubble, rampage aura, dead (hidden; a small ghost/timer marker at his Throne is fine). HP bar above the King only when below full.

6. Camera: fixed tilt about 56 degrees, narrow FOV, fit to aspect. Implement screenToWorld / worldToScreen and verify them in the lab (draw a test marker under the mouse position).

7. A tiny Vitest for pure helpers you write (e.g. sim-to-scene mapping, flight height curve) is welcome; rendering itself is verified by screenshots.

Deliver screenshots of every scene at 1280x720 (and 'midfight' at 800x450) in shots/ named render-<scene>.png. Look at each one. Be your own harshest critic: list everything that still looks wrong.
`, { label: 'render:scene', phase: 'Scene', model: 'opus', effort: 'high', schema: REPORT })

phase('Critique 1')
const crit1 = await agent(`You are the art director reviewing the first pass of a game renderer. Project: /home/turbo/creative-game. Read design/ART.md (the intended look) and design/GDD.md sections 1, 2 and 9. Then LOOK at the screenshots the engineer produced (use the Read tool on each PNG): ${JSON.stringify(scene && scene.screenshots)} . If any are missing, regenerate them: start npx vite --port 5220 --strictPort in the background from the repo root, run node tools/shot.mjs "http://localhost:5220/lab/render.html?scene=<opening|midfight|crown|mutants|lineup>" shots/crit-<scene>.png --wait 2500, and stop the server after (pkill -f "[v]ite --port 5220"). Also capture midfight at --size 800x450.

Judge as a demanding art director of a commercial stylized game (think Clash Royale, Thronefall, Pikmin readability standards), not as an engineer. Questions: Does it look like a toy diorama you want to poke, or like programmer art? At a glance can you find the player's King, tell Blue from Red (also if colour-blind: shape cues), tell owned/neutral/contested buildings, tell critter kinds apart, see thrown critters in the air? Is the palette cohesive and appealing, is contrast between units and ground sufficient, are proportions chunky enough (nothing important under ~22 px at 1080p), is the composition balanced in frame, do shadows anchor things, is there visual noise? What single changes would raise perceived quality the most? Do not edit any files. Be specific and visual: say where in which screenshot, what is wrong, and what direction to take. Also list what is already good and must be kept.`,
  { label: 'render:critique-1', phase: 'Critique 1', model: 'opus', effort: 'high', schema: CRIT })

phase('Feel')
const feel = await agent(COMMON + `
TASK (stage 2 of 2). A colleague built the scene (their report: ${JSON.stringify(scene)}). The art director reviewed it: ${JSON.stringify(crit1)}.

A. First fix every 'must-fix' and the 'should-fix' items you agree with from the critique (keep what the director said to keep). Re-shoot and look.

B. Then make it FEEL alive: event-driven VFX and motion through onEvents(), following design/research/game-feel.md (tiny additive feedback per critter hit, big juice per EVENT; presentation-only hit-stop that never pauses the sim; trauma-based camera shake with rotation only, per-source caps, scaled by options.shake; at most 3 flashes per second, honour reduceFlash; particle budget ~400 live with a priority ladder).
   Cover every SimEvent in src/sim/types.ts (re-read it: the sim engineer may have added fields): throw (muzzle puff at the King, tiny recoil lean, camera kick away from aim, max a few px), land (squash of the landing critter, dust ring; bigger if hits > 0), explode (flash sphere, shock ring, smoke, debris; frost-coloured if frozen), critterDied (pop into a few team-coloured bits), hatch (building squashes and the critter pops out), heroHit (white flash on the King, number of hits aggregated, no damage numbers), heroDown (big poof, crown spins off, shake, brief presentation hit-stop), heroRespawn (light column at the Throne), rampage (aura ignites), dash (stretch + dust trail), ability per hero/slot (Stomp shock ring + dust + ground crack decal, Kingscall burst with critters popping in, Blink streak + afterimage at both ends, Vortex swirling zone, Turret pop-up build, Rampart shield bubble), recall (expanding whistle ring from the King and a little '!' hop on recalled critters), noAmmo (empty puff at the King), capture (building squash-and-stretch, roof/flag recolour with a wipe, confetti in team colour, ring pulse; extra for throne), shot (arrow/bolt tracer from tower, turret or hut), turretPlaced/turretExpired, secondWind (shockwave), crownOpen (light beam on the Crown, golden ring, the crown rises and spins, brief screen-wide warm tint), overtime, matchEnd (slow camera push toward the decisive building, confetti for the winner).
   Also: aim reticle on the ground at the local King's aim point clamped to throw range, with a faint range ring; persistent cosmetic ground decals (scorch marks, landing scuffs) baked or capped; Zone rendering (scorch patch, vortex); Turret model; persistent mutation visuals per critter kind.

C. Drive it for real. If the simulation exists by now (check for src/sim/index.ts exporting createWorld and step; run npx tsc --noEmit to see it compiles), add ?scene=sim to the lab: create a real match on the 'meadow' map and drive both Kings with simple scripted inputs defined in the lab file (walk to the nearest non-owned building, hold fire at it when in range, fire at the enemy King when close, use abilities when off cooldown, go to the Crown when it opens), fixed-step loop with interpolation, feeding world.events to onEvents after every step; support ?seed=, ?speed= and ?heroes=brawler,blink and ?mutations=a,b|c,d so different content can be looked at. If the sim is not ready, extend the fixture lab with an 'events' scene that replays a scripted event timeline instead, and say so.
   Capture sequences (tools/shot.mjs --steps with several {"wait":..},{"shot":..} entries) so you can judge motion: a volley leaving and landing, a capture, a King falling, each ability, the Crown opening. Look at the frames.

D. Measure: report average frame time in the sim scene with a full fight (expose window.__lab.stats = { frameMs, drawCalls, particles }).

Finish when npx tsc --noEmit is clean for your files and the screenshots show it. List honestly what still looks or feels wrong.
`, { label: 'render:feel', phase: 'Feel', model: 'opus', effort: 'high', schema: REPORT })

phase('Critique 2')
const crit2 = await agent(`You are the art director and game-feel lead reviewing the second pass of a game renderer. Project: /home/turbo/creative-game. Read design/ART.md, design/GDD.md sections 1-3 and 9, and design/research/game-feel.md (bottom line + sections 5 and 6). The engineer's report: ${JSON.stringify(feel)}.

Capture your own evidence rather than trusting theirs: start npx vite --port 5221 --strictPort in the background from the repo root; write step files in /tmp/claude-1000/-home-turbo-creative-game/42a0f085-49e4-4b98-b212-79e3f92ccf72/scratchpad/ for tools/shot.mjs (--steps takes a JSON array of {"wait":ms}, {"shot":"path.png"}, {"eval":"js"}) and shoot the live scene "http://localhost:5221/lab/render.html?scene=sim" (or the scene the engineer names) as a sequence of ~12 frames spread over 40 s of play, plus a burst of 6 frames 120 ms apart during a fight to judge motion, plus the fixture scenes midfight/crown/mutants/lineup, plus one frame at --size 800x450. Save under shots/crit2-*.png and LOOK at all of them with the Read tool. Stop the server afterwards (pkill -f "[v]ite --port 5221").

Judge: (1) readability in chaos: in every frame can you instantly find the player's King, tell teams, ownership and thrown critters; do effects ever hide state; (2) feel: do impacts, captures, deaths and abilities look punchy but restrained; is anything over-shaken, over-flashed, or noisy; are big events clearly bigger than small ones; (3) beauty and cohesion against ART.md; (4) anything broken: z-fighting, clipping, missing shadows, things floating, effects at wrong positions or never disappearing, critters sliding without hopping, flight arcs that look wrong, HP bars or rings misplaced; (5) what is still 'programmer art'. Do not edit files. Be specific: which frame, where, what, and the direction to take. List what must be kept.`,
  { label: 'render:critique-2', phase: 'Critique 2', model: 'opus', effort: 'high', schema: CRIT })

phase('Polish')
const polish = await agent(COMMON + `
TASK (polish pass). The renderer exists (latest engineer report: ${JSON.stringify(feel)}). The art director's second review: ${JSON.stringify(crit2)}.
Fix every 'must-fix', then the 'should-fix' items, then cheap 'nice' ones; keep what the director said to keep. For each fix, re-shoot the relevant scene or sequence and look at it to confirm. Do not add new features. Then re-measure frame time and make sure npx tsc --noEmit is clean for your files. In looks_wrong_still, list each critique item as fixed / partly / not fixed (why).
`, { label: 'render:polish', phase: 'Polish', model: 'opus', effort: 'high', schema: REPORT })

return { scene, crit1, feel, crit2, polish }
