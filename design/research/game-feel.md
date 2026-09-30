# Game feel / juice canon for a swarm-as-gun game (Kingswarm)

Researched 2026-09-30. Tags: [SRC] = number/claim read in a primary source (code, transcript, official doc);
[SEC] = secondary write-up, treat with care; [TUNE] = our recommended starting value, NOT from a source (tune by playtest);
UNVERIFIED = could not confirm.

## Bottom line for Kingswarm

1. Feedback per critter hit must be tiny and additive; feedback per EVENT (hut captured, hero killed, throne hit) is where the big juice goes.
   A 12-per-second stream that shakes and freezes on every hit reads as noise. Vlambeer's 20 ms sleep and Sakurai's "projectiles get minimal hitstop" both point this way.
2. Do NOT freeze the simulation for hitstop. Freeze presentation only (target sprite hold, visual vibration, particle hold). Sakurai keeps hurtboxes still while the sprite shakes,
   and reduced hitstop in free-for-all because a frozen pair is exposed to a third player. Kingswarm is host-authoritative online; a global `freeze` (the prototype has one) would desync or stall the peer.
3. Replace `shake=rand(-s,s)` with a trauma model (Eiserloh, GDC 2016): trauma in [0,1], shake = trauma^2, linear decay, smoothed noise not white noise. Cap per-source contribution so 100 impacts cannot stack to max.
4. Screen shake is the best effort-to-payoff effect and the easiest to overdo: Vlambeer had to ship a shake-off option in Nuclear Throne, and admits designers stop noticing their own over-shake.
   Ship a shake slider and a flash-reduction toggle on day one.
5. Sound is the most cost-effective juice (Jonasson & Purho said so on stage). Replace beeps with layered samples: transient "pop" + body + low thump, per-play pitch/volume variance,
   and a voice cap. Sound must scale with COUNT (Pikmin 4 scales carry sounds by number of Pikmin) instead of one sound per critter.
6. Make the fire loop feel like a machine gun: bigger-than-realistic projectiles, muzzle flash on the first frame, camera kick opposite to aim, hero recoil/strafe-lock while firing,
   bass in the shot sound. Give the button a cost (Nijman: "give the player a reason not to press it"): swarm ammo already is that cost, so make the cost visible (swarm shrinks on the hero).
7. Impact grammar on the TARGET, not the screen: white flash 2-3 frames, squash-pop on the hut, knockback of a few px, debris that stays. Persistent debris/decals (Nijman "permanence") tells the story of the fight for free.
8. Readability first with 100+ units: silhouette + value contrast + team temperature, aggregated numbers (never per-critter damage popups), capped particles, soft ground decals, and an effect-priority tier system (below).
9. Dash: keep the ~0.15 s fixed-distance dash (Celeste is 0.15 s at 240 px/s, cooldown 0.2 s). Add a 100-150 ms input buffer and a 1-frame-ish visual freeze at start (visual only online).
10. Audit for photosensitivity: the prototype toggles hut colour white at ~10 Hz and does full-screen white flashes; WCAG 2.3.1 limit is 3 flashes/s over a 341x256 px area. Bake this into the effect system.

---

## 1. Prioritized checklist (impact per hour of work, highest first)

Numbers marked [TUNE] are starting points for a 60 Hz sim, 1080p-equivalent viewport.

### P0 - do first (a day or two, transforms the feel)
| Item | Value | Basis |
|---|---|---|
| Real sound: transient + body + low thump layers per event | 3 layers on shots/hits; +6 to +12 dB low-shelf on the shot body | Nijman bass anecdote (+12 dB boost "fixed the gameplay") [SRC talk]; layering [TUNE] |
| Pitch/volume variance per play | pitch +/-1 to 2 semitones (x0.94-1.12); volume +/-10%; 4-6 round-robin variants, no immediate repeat | 0-2 semitones "depending on content", larger sounds jarring [SEC: gamedevbeginner/Mushel]; exact range [TUNE] |
| Voice budget | max ~8 concurrent per sound family, 24-32 global, drop lowest priority; coalesce fire sound (see 3) | Wwise playback limit + priority + volume threshold model [SEC: Audiokinetic docs]; numbers [TUNE] |
| Target hit flash | white/colour overlay 2-3 frames (~35-50 ms) | Nijman "just a white flash and a slightly different pose" [SRC]; frames [TUNE] |
| Trauma shake replaces random shake | see section 2 | Eiserloh [SRC] |
| Bigger projectiles + muzzle flash | critter bullet >= 1.5x its resting sprite; flash = one frame of a round sprite at spawn | Nijman "bullets should be at least the size of a rib cage", flash = first frame round [SRC] |
| Camera kick opposite to aim | 1-3 px per shot at 1080p, recovers via 10-15%/frame lerp; do not stack beyond ~8 px | Nijman "camera moves in the opposite direction of where I'm shooting" [SRC]; px [TUNE] |

### P1 - event juice (hut capture, hero death, throne)
| Item | Value | Basis |
|---|---|---|
| Per-hit micro-sleep on a single sprite | 20 ms (1 frame at 60 Hz) on hit; 20-50 ms on kill | Nijman: sleep "20 milliseconds or something" on hit and on death [SRC talk]; Celeste dash freeze 0.05 s, red-dash 0.05 s, explosion launch 0.1 s [SRC code] |
| Big-event freeze (presentation only) | hut capture 50-70 ms; hero death 90-100 ms; throne/crown hit 100-120 ms; hard cap 120 ms | Prototype already uses 0.05/0.09 s; cap 120 ms from [SEC swordarcade: beyond 120 ms "reads as a dropped frame"]; rest [TUNE] |
| Hit-stack decay | if hitstop requests arrive < 100 ms apart, each next one is x0.5 (min 0) | Reported for Nuclear Throne ("freeze frames now have a decaying effect when stacking", search snippet, page not fetchable: UNVERIFIED); rule [TUNE] |
| Squash on impact | hut: scale (1.12, 0.88) then ease back over 150-200 ms (out-back or out-elastic); critter landing: (1.25, 0.8) over 100 ms; keep sx*sy ~ 1 (volume) | Juice talk: "scale up when it hits, ease back", stretch by velocity, wobble [SRC talk]; ratios [TUNE] |
| Knockback/debris | enemy critters pushed 2-6 px on hit; corpses/shell debris persists, capped at ~300 baked decals | Nijman "just moved them a few pixels", permanence [SRC talk]; cap [TUNE] |
| Explosion/capture ring | circle flashing black to white, then smoke that dissipates | Nijman: "explosions are just a circle that flashes black to white" + smoke [SRC talk] |
| Slow-mo on decisive moment | 0.25-0.4x time for 0.4-0.8 s on throne kill / crown win only | Nijman drops framerate for the last kill [SRC talk]; values [TUNE] |

### P2 - motion polish
| Item | Value | Basis |
|---|---|---|
| Easing | exponential smoothing `x += (target-x)*(1-exp(-k*dt))`, k ~ 8-12/s for camera/UI; out-back for pops; out-quad for slides; add random 0-150 ms start delay when many things appear | Juice talk: "move x 10% of the way each frame", linear vs slowdown vs overshoot vs bounce, random delay to everything [SRC talk]; k [TUNE] |
| Stretch by velocity | critter mid-flight: length x (1 + speed/900*0.4) max 1.4, width inverse | Juice talk stretch from velocity [SRC]; coefficients [TUNE] |
| Trail / dust | 2-4 px dust puff behind dash every 40-60 ms; critter trail 3-5 samples | Juice talk ball trail [SRC]; counts [TUNE] |
| Eyes/face | eyes on critters and huts that blink and look at the target; hut smiles on capture | Juice talk (Kyle Gabler trick): eyes on everything, "the effort... how much personality it adds is insane" [SRC] |
| Camera look-ahead | fixed diorama camera: none. If any: shift < 3% of arena width toward aim/centroid of your swarm | Nijman camera shifts toward aim / centroid of enemies [SRC talk]; owner disliked follow camera |

### P3 - input forgiveness (hold-to-fire changes what matters)
| Item | Value | Basis |
|---|---|---|
| Dash input buffer | accept press up to 100-150 ms before dash becomes available | Celeste jump grace 0.1 s [SRC code: `JumpGraceTime=0.1f`]; Mario caches button 1-2 frames, Braid 0.23 s [SRC: Pichlmair & Johansen survey]; Celeste's buffer constant is not in the released source: UNVERIFIED |
| Coyote-style forgiveness for capture | let a critter that arrives within ~80-100 ms after a hut flips to your side still count; extend hut hit radius ~15% | analogous to Celeste's forgiveness philosophy "widen windows in the player's favour" [SRC: Thorson thread]; values [TUNE] |
| Corner/edge correction | slide hero around obstacles within 4 px of a corner | Celeste `DashCornerCorrection=4`, `UpwardCornerCorrection=4` [SRC code] |
| Dash | 0.15 s duration, fixed distance, cooldown 0.2 s + refill 0.1 s, 3 frames visual freeze at start, dash speed ~ 4-5x run speed, i-frames on the whole dash | Celeste: DashTime .15, DashSpeed 240 vs run ~90, DashCooldown .2, DashRefillCooldown .1, Freeze(.05) [SRC code]; prototype's .16 s @ 900 px/s is already in range |
| Response latency | input-to-first-feedback < 100 ms; aim for 1 frame for the shot sound/flash | Swink: real-time response = correction cycle under 100 ms [SEC: summary of Game Feel]; 1-frame [TUNE] |
| Disc Room-style hazard grace | deadly hitboxes armed after up to 50 ms | [SRC: survey citing Disc Room] |

---

## 2. Screen shake, concretely

- Model (Eiserloh, GDC 2016) [SRC slides]: trauma in [0,1]; events add trauma (+0.2 or +0.5 in his examples); trauma decays linearly; shake = trauma^2 or trauma^3
  (trauma .30/.60/.90 gives 3%/22%/73% shake with cube); 2D = translation + rotation, 3D = rotation only; use smoothed Perlin noise, not random per frame
  (works under pause and slow-mo, adjustable frequency, reproducible in replays).
- Our fixed tilted 3D camera should use rotation-only shake (small pitch/yaw/roll) per that rule, plus at most a 1-2 px equivalent translation for UI-locked layers. [TUNE]
- Starting values [TUNE]: max translation 1.0% of viewport height (~10 px at 1080p) at trauma 1; max roll 1.5 degrees; noise frequency 18-25 Hz; decay 1.2 to 1.8 trauma/s.
- Trauma budget [TUNE]: critter hit +0.003 (cap: per-source ceiling 0.15); hut hit +0.02; hut captured +0.25; hero hit +0.1; hero killed +0.5; throne captured/crown won +0.8. Big events are 10-100x a critter hit, so they read.
- Comparison values seen in the wild [SEC swordarcade, single author, no sources cited]: 4/8/12 px for light/heavy/taking damage, decay 0.2-0.3 s, apply inside the play-area clip so edges stay pinned.
- Vlambeer: shake "one of the best" for effort (Jonasson), "we actually had to add an option in Nuclear Throne to turn off the screen judder because people were getting really sick" (Nijman) [SRC transcripts]. Nuclear Throne's slider ranges/defaults: UNVERIFIED (search snippet said 0-200% shake, 0-100% freeze, freeze default 80%).
- Shake the CAMERA, never the HUD. Do not shake on every critter landing; shake on events the player caused and cares about.

## 3. Hitstop, concretely (and why the fighting-game numbers do not transfer)

- Sakurai (Famitsu vol. 490-1 column) [SRC via Source Gaming]: both parties freeze on strike; duration mostly from damage, modified per attack (Marth sword tip stronger than base);
  projectiles get comparatively minimal hitstop; hard cap regardless of damage; sprites vibrate but hurtboxes stay put; grounded vibrates sideways, airborne vertically;
  vibration scaled by camera distance; hitstop deliberately limited in free-for-all.
- Smash Ultimate formula [SRC SmashWiki]: frames = floor(floor(floor(d*0.65+6)*h*e*s)*p)*c; electric x1.5, shield/crouch-cancel x0.67; cap 30 frames (500 ms) Ultimate, 20 frames Melee; 0 if no damage/knockback.
  A 1-damage jab is already 6 frames = 100 ms. Vlambeer's ~20 ms is 5x shorter. Reason: 1v1 melee has a few hits per second; a swarm has dozens.
- Sakurai's 8 techniques (video "Eight Hit Stop Techniques") [SEC list from GoNintendo/Nintendo Wire search summary, video not transcribed]: shake the victim more; do not move the hitbox; horizontal shake on ground, vertical in air;
  gradually lessen shake; control the amount of hitstop; interpolate into the damage pose; keep the attacker moving a little; scale shake with camera distance.
  Directly usable: victim vibrates, attacker keeps drifting a little (so the swarm never looks paused), amplitude scaled to our zoomed-out camera.
- Research signal: an NLP study of Steam reviews of top vs bottom action games [SRC arXiv 2208.06155 abstract] found hit stop, sound coherence and camera control were the three features whose absence "may ruin" impact feel. Sound and hit stop deserve budget before particles.
- Kingswarm rule set [TUNE]: (a) per-critter hit = 0 ms global, 33-50 ms local flash on target; (b) heavy events use the P1 table; (c) hitstop never blocks input or the sim clock; (d) the "freeze" is a render-side timer that holds the affected entities' pose;
  (e) online: broadcast event type, each client plays its own local hold. Prototype `freeze` at 0.05/0.09 s currently pauses global state and should be moved to render-only.
- Anti-pattern: Dark Souls 2 as a "no hitstop weakens impact" example [SEC Critpoints]. Too long is equally bad: > 120 ms reads as lag.

## 4. Audio for a machine-gun of critters

- Per-play variance: pitch +/-1-2 semitones, volume +/-10%, 4-6 variants, no immediate repeats [SEC + TUNE].
- Do not spawn one voice per critter. Options: (a) fire sound = one looping "gun" layer whose pitch/volume rises with fire rate + a 60-80 ms-spaced accent pop; (b) impact = at most 1 voice per 40 ms per family, choose by nearest-to-hero, pitch scaled by number of hits in the window (count scaling, see Pikmin 4 quote [SRC nintendo.com Ask the Developer Vol. 10 Part 3]).
- Layers per event [TUNE]: click/transient (2-8 ms), body (60-150 ms), low thump (100-250 ms) for big events only; keep critters' own voice tiny and bright so the eventual hut/hero sounds sit lower.
- Ducking [TUNE, no primary source found]: on hero death / hut capture / crown open, duck music -4 to -6 dB with ~30 ms attack and ~400 ms release, and duck critter spam -3 dB. Duck by mix bus, not per sound.
- Voice limit and stealing: Wwise playback limit + priority + volume threshold is the standard model [SEC Audiokinetic]. In Web Audio, implement a small pool with priority and "kill quietest".
- Music: reactive layers (calm base + drums at contested huts + full at crown phase). Owner disliked beeps: the prototype's `beep()` is an oscillator with a hard exponential envelope, which is exactly that sound.
- Bass note: boosting low frequencies on shots/explosions is cheap and works (Nijman's Raven anecdote) but check tiny laptop speakers/phone; add a mid-band "click" so it survives.

## 5. Readability with 100+ units on screen

Primary evidence is thin here; the TF2 paper is solid, the rest is [SEC]/[TUNE].
- Silhouette test: TF2's nine classes were validated by viewing them "only in silhouette with no internal shading" [SRC Valve NPAR 2007 paper]. Do the same for hero vs critter vs hut vs turret at the smallest on-screen size.
- Valve's rules [SRC]: distinct silhouettes, high-frequency detail omitted, interior detail echoes the silhouette, rim highlights instead of dark outlines, hue AND value variation, increased saturation and value contrast; team bases contrast in temperature (warm red vs cool blue).
- Overwatch/Clash Royale echo: silhouette first, team colours always contrast, remove small details or bring values together, enlarged cartoony proportions for small screens [SEC: 80.lv comparison, Rookies breakdown; Supercell iteration claims UNVERIFIED].
- Kingswarm rules [TUNE]:
  1. Three visual tiers: hero (largest, rim light, ground ring), structures (huge, saturated roof in owner colour), critters (small, low detail, owner colour body, white eyes). Critters never use the hero's or huts' accent colour.
  2. Owner = hue temperature + value, and one non-colour cue (shape notch/hat/marker) for colour-blind players. Friendly projectiles: thinner, desaturated; enemy ones: outlined and brighter.
  3. Effect priority ladder: critical (hero death, capture, crown) > medium (hut hit, hero hit) > ambient (critter hits, dust). Under load, drop ambient first. Particle budgets [TUNE]: ambient <= 3 per critter hit, hard cap ~400 live particles; big events 30-60, drawn last on top.
  4. Aggregate numbers: no per-critter damage numbers. Show one hut capture ring / progress arc. Player debate on damage numbers in crowded survivor-likes is that they add clutter [SEC Steam thread].
  5. Persistent debris is drawn into a single baked ground texture (no per-object cost) and darkened, so bodies "blend with the ground" instead of competing with live units (Juice talk: "make it darker" so falling blocks stop blending with live ones [SRC]).
  6. Ground blob shadows under every unit anchor units to the tilted diorama and keep height ambiguity out of aiming.
  7. Whole-arena camera helps: no follow camera means no off-screen threats. Keep min critter on-screen size ~ 20-28 px at 1080p [TUNE].
  8. Screen space cleanup: stop flashing huts white at 10 Hz (prototype `Math.floor(n.flash*20)%2`); use a 1-2 frame flash, then colour tween.
- Accessibility: WCAG 2.3.1 = no more than 3 general or red flashes in any 1 s; area threshold 341x256 CSS px; general flash = pair of opposing luminance changes >= 10% [SRC w3.org]. Provide reduce-flash and shake slider.

## 6. What to avoid

- Global freeze per hit; multi-hundred-ms hitstop; stacked freezes that turn a 1 s burst into a slideshow.
- Shake on every critter impact, constant background shake, or roll > ~2 degrees (nausea; Nijman had to add an off switch).
- White-noise camera jitter (use smoothed noise); shaking the HUD.
- Every effect at full strength (light and heavy hits indistinguishable [SEC swordarcade]).
- Beeps and pure oscillator sounds; one sound per critter; identical samples with no variance.
- Numbers, text popups and particles per critter; unbounded persistent debris.
- Juice that hides state: if you cannot tell who owns a hut, or where the hero is, at a glance, the effect budget is too high.
- Trusting your own eyes: Nijman/Vlambeer and Blue Tengu both report effects become invisible to the author; playtest with outsiders and offer a per-effect slider.
- Effects that fight precision aiming: Blue Tengu found gun kickback on the player conflicted with precision and even 1 frame of sleep felt wrong in their game [SEC bluetengu.com]. Test hero recoil against hold-to-fire feel; camera kick is safer than hero recoil.
- Copying Hades/Supergiant feel numbers: I could not find a published Supergiant combat-feel talk or numbers (their GDC 2021 talks are on dialogue). Any Hades hitstop/shake figure is UNVERIFIED.

## 7. Suggested implementation order for the TS/Three.js rebuild

1. Effect bus: gameplay emits typed events (`shotFired`, `critterHit`, `hutHit`, `hutCaptured`, `heroKilled`); a presentation layer maps each to sound + flash + trauma + hitstop with per-type caps. Sim never reads these values.
2. Trauma camera, presentation-only hitstop, target flash, hut squash (day 1).
3. Audio: pooled voices with priority, variance, layered events, count scaling (day 2-3).
4. Readability pass with a silhouette/colour-blind screenshot test at 100+ units (day 3-4).
5. Playtest with option sliders exposed; record which the owner turns down.

## Sources
- Nijman, "The Art of Screenshake" (INDIGO Classes 2013), transcript pulled from auto-captions: https://www.youtube.com/watch?v=AJdEqssNZ-U (all Nijman quotes above; captions are machine-translated, so "20 ms" is his phrase "20 milliseconds or something")
- Jonasson & Purho, "Juice it or lose it" (2012), transcript: https://www.youtube.com/watch?v=Fy0aCDmgnxg ; GDC Vault: https://www.gdcvault.com/play/1016487/juice-it-or-lose
- Eiserloh, "Juicing Your Cameras With Math" (GDC 2016), slides text: https://archive.org/stream/GDC2016Eiserloh/GDC2016-Eiserloh_djvu.txt
- Celeste player source (Thorson): https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs (constants read directly); Thorson thread: https://threadreaderapp.com/thread/1238338574220546049.html
- Sakurai Famitsu column: https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/ ; videos: https://www.youtube.com/watch?v=OdVkEOzdCPw (Stop for Big Moments), https://www.youtube.com/watch?v=tycbMSjDDLg (Eight Hit Stop Techniques; not transcribed, list from https://www.gonintendo.com/contents/13581-sakurai-s-latest-game-dev-video-features-8-hit-stop-techniques search summary)
- Smash hitlag formula: https://www.ssbwiki.com/Hitlag
- Pichlmair & Johansen, "Designing Game Feel. A Survey": https://arxiv.org/pdf/2011.09201 ; impact-feel Steam study: https://arxiv.org/abs/2208.06155
- Swink, Game Feel summary (100 ms): https://lizengland.com/blog/2015/08/review-game-feel-by-steve-swink/ [SEC, book not read]
- Pikmin 4 Ask the Developer Part 3: https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-10-pikmin-4-part-3/
- Valve TF2 illustrative rendering: https://steamcdn-a.akamaihd.net/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf ; https://80.lv/articles/comparing-team-fortress-2-and-overwatch-art-direction ; https://www.therookies.co/blog/education/game-design-ux-best-practices-detailed-breakdown-of-clash-royale
- WCAG 2.3.1: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- Audio: https://gamedevbeginner.com/how-to-use-the-random-audio-container-in-unity/ ; https://www.audiokinetic.com/en/blog/how-to-get-a-hold-on-your-voices-optimizing-for-cpu-part-1/ [SEC]
- Other [SEC]: https://swordarcade.xyz/guides/game-feel-hitstop-and-screen-shake/ ; https://www.bluetengu.com/2014/12/12/art-of-screenshake-experiments/ ; https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/ ; https://steamcommunity.com/app/242680/discussions/0/1485487749770073586/
- Not verified: Sakurai video contents (captions rate-limited), Nuclear Throne option ranges, Vampire Survivors internal caps/pooling (only third-party analyses found), Hades combat-feel numbers, Apex/Titanfall movement buffering values, Swink's book text.
