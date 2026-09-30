export const meta = {
  name: 'kingswarm-audio-build',
  description: 'Acquire and curate CC0 sound and music, then build the Web Audio engine with event mapping and objective mix checks',
  phases: [
    { title: 'Assets', detail: 'download, curate, convert, measure loudness, manifest + licences', model: 'sonnet' },
    { title: 'Engine', detail: 'Web Audio engine, event mapping, voice caps, music states, tests, offline mix check', model: 'opus' },
  ],
}
const REPORT = {
  type: 'object',
  properties: {
    built: { type: 'array', items: { type: 'string' } },
    verified: { type: 'string' },
    sizes: { type: 'string' },
    fragile_or_unfinished: { type: 'array', items: { type: 'string' } },
    needs_owner: { type: 'array', items: { type: 'string' } },
    notes_for_lead: { type: 'string' },
  },
  required: ['built', 'verified', 'fragile_or_unfinished'],
}
const COMMON = `
You work at the Kingswarm studio in /home/turbo/creative-game (branch v1). CLAUDE.md (studio rules) is in your context. Read design/ART.md (section Sound), design/STUDIO.md (machine limits: /tmp is RAM, put downloads in assets-src/), design/research/assets-audio.md (verified CC0 sources with tested download commands, sections 2, 4, 5, 6) and design/research/game-feel.md (bottom line items 5-6, and section 4 on audio). If design/research/studio-ai-audio.md exists, read its bottom line too. The owner hated the old prototype's oscillator beeps: the palette must be soft, woody, organic, a little comic.
Nobody on the team can listen: every choice must be justified by file names/descriptions from the packs plus MEASUREMENTS (ffprobe duration, ffmpeg loudnorm/ebur128 LUFS and true peak, sox stat, spectral centroid if useful). Say clearly what could not be verified without ears.
`
phase('Assets')
const assets = await agent(COMMON + `
TASK: build the shipped sound set.
You own: assets-src/ (raw, gitignored), public/audio/** (shipped), tools/assets/audio-*.sh|mjs (repeatable pipeline scripts), src/audio/manifest.ts, licenses/audio.md.

1. Download the audio packs listed in assets-audio.md section 5 (audio only: Kenney impact/interface/rpg-audio/jingles, OpenGameArt creature-sfx, rpg-sfx, swishes, and the music files) into assets-src/ with a script tools/assets/audio-fetch.sh that is safe to re-run.
2. Curate a SMALL palette. For each sound id below choose 3-5 variants (1 for stingers) by name and measurement (short, clean attack, no long tails; reject anything that measures as tonal/beepy when a woody/soft noise is wanted):
   throw (light soft whoosh/pop, very short, will play up to ~8x per second), land_soft (critter lands, no hit), land_hit (lands on enemies: a punchier plop), critter_die (tiny pop/squeak), hatch (small cute pop), bite (tiny tick, may be skipped), explode (chunky low boom), king_hit (dull thud + small grunt), king_down (big comic defeat sound), king_respawn (soft rising chime), dash (quick swish), stomp (heavy ground thump), kingscall (horn/rally), blink (airy zip), vortex (swirl/whoosh), turret_place (wooden clunk), turret_shot / arrow_shot (light twang/thock), rampart (shield ring, soft), recall (short whistle-like or horn blip, friendly), no_ammo (dry soft click), capture (satisfying wooden clunk + short bright jingle), capture_lost (lower, duller version), throne_hit or crown_tick (tension tick for crown progress), crown_open (short fanfare/bell), overtime (alarm bell, not harsh), rampage (power-up rise), second_wind (dramatic whoosh up), freeze (icy crack, optional), ui_click, ui_hover, ui_confirm, ui_back, ui_pick (card pick), ui_error, victory_sting, defeat_sting.
   Music: menu loop, battle loop, crown loop (more intense, used as a replacement or added layer when the Crown opens), victory, defeat. Prefer one composer for cohesion (RandomMind set) as the research suggests.
3. Convert with a script tools/assets/audio-build.sh: SFX -> mono 44.1 kHz OGG Vorbis (q3), leading silence trimmed, tails trimmed with a short fade, each family normalised to a consistent integrated loudness (choose targets so small sounds sit about 6-10 dB under big ones; document the table); music -> stereo OGG q2-q3 loudness-normalised to about -18 LUFS with true peak under -1.5 dB, loops trimmed so the seam is sample-tight (check start/end RMS and note any risk). Budget: all SFX together under 600 KB, all music under 2.6 MB. Report actual totals.
4. Write src/audio/manifest.ts: a typed map from sound id to { files: string[] (paths under audio/ relative to the site base), gain: number, family: 'critter' | 'king' | 'building' | 'ability' | 'ui' | 'sting', priority: 1 | 2 | 3, maxVoices: number, minIntervalMs: number, pitchVar: number (semitones) } and a music map { menu, battle, crown, victory, defeat } with loop flags and gains. Keep it plain data.
5. Write licenses/audio.md: for every shipped file, its source pack, author, licence, source URL and download date (2026-09-30).
6. Do not write the playback engine (next stage). Do not install npm packages.
`, { label: 'audio:assets', phase: 'Assets', model: 'sonnet', effort: 'high', schema: REPORT })

phase('Engine')
const engine = await agent(COMMON + `
TASK: build the audio engine on the curated assets. The asset engineer's report: ${JSON.stringify(assets)}.
You own: src/audio/** (engine.ts, mapping.ts, index.ts, tests; you may adjust manifest.ts values), lab/audio.html + lab/audio-lab.ts. Read src/sim/types.ts for SimEvent (re-read it, fields may have been added by the sim engineer; import types only).

Contract (src/audio/index.ts):
  createAudio(opts?: { basePath?: string }): AudioEngine
  interface AudioEngine {
    unlock(): Promise<void>                       // call from the first user gesture; creates/resumes the AudioContext
    preload(group: 'core' | 'music'): Promise<void> // core = all SFX (needed for battle 1), music = lazy
    onEvents(events: readonly SimEvent[], world: World, localTeam: Team): void
    ui(name: 'click' | 'hover' | 'confirm' | 'back' | 'pick' | 'error'): void
    setMusic(state: 'none' | 'menu' | 'battle' | 'crown' | 'victory' | 'defeat'): void  // crossfades; battle->crown should feel like an escalation
    setVolumes(v: { master?: number; music?: number; sfx?: number }): void
    setMuted(m: boolean): void
    update(dt: number): void                      // envelopes, ducking, scheduled aggregation
    readonly state: { unlocked: boolean; loaded: { core: boolean; music: boolean } }
  }
Design rules (from game-feel.md): plain Web Audio, no library. Buses: master -> (music, sfx) with a soft limiter/compressor on master. Per-play variance: random variant without immediate repeat, pitch +/- pitchVar semitones, gain +/-10%. Voice management: per-id maxVoices and minIntervalMs, global cap ~24, steal the quietest/lowest priority. The swarm gun must sound like one satisfying stream, not 8 separate voices a second fighting each other: aggregate 'throw' and 'land' events per ~50 ms window, play at most one voice per window per family, and scale pitch/gain slightly with the count in the window. Sounds for the local player's own actions are a bit louder than the rival's. Stereo pan by event x position (subtle, +/-0.4). Ducking: on king_down / capture / crown_open duck music ~5 dB (30 ms attack, 400 ms release). Everything must fail silent: if decoding fails or the context is unavailable, the game continues without errors.
Mapping (src/audio/mapping.ts): one table from every SimEvent type to sound ids and rules (e.g. capture by local team -> capture; by rival -> capture_lost; capture of a throne -> bigger). Cover every event type; a TypeScript exhaustiveness check should fail compilation if a new SimEvent is added without a mapping decision.

Tests (Vitest, node): inject a minimal fake AudioContext so you can assert behaviour without sound: voice caps, min intervals, aggregation of 30 throws in one second into a bounded number of voices, no immediate variant repeats, ducking envelope, fail-silent paths, mapping exhaustiveness.

Objective mix check (no ears): build lab/audio.html with (a) buttons to audition every sound id and music state (the owner will use it later), and (b) a function window.__audioLab.renderMix(scenarioName) that uses OfflineAudioContext to render 10 s of a synthetic but realistic event stream (heavy firing from both sides, landings, deaths, a capture, an explosion, a king down, music playing) through the same bus/limiter graph and returns peak, RMS and the fraction of clipped samples. Run it in headless Chromium (start npx vite --port 5230 --strictPort; node tools/shot.mjs "http://localhost:5230/lab/audio.html" shots/audio-lab.png --wait 1500 --eval "window.__audioLab.renderMix('heavy')"; stop the server after with pkill -f "[v]ite --port 5230") and tune gains until the heavy scenario has no clipping, peaks under about -1 dBFS and music stays audible under the SFX (report the numbers). 

Finish when npx vitest run src/audio and npx tsc --noEmit are green for your files. List in needs_owner what only a human listener can confirm.
`, { label: 'audio:engine', phase: 'Engine', model: 'opus', effort: 'high', schema: REPORT })
return { assets, engine }
