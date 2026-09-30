# Kingswarm: onboarding, HUD, flow, controls, accessibility

Research date 2026-09-30. Tags: [P] primary (dev talk, official docs), [S] secondary (press, blog), [I] my inference or proposal, UNVERIFIED = not confirmed this session.
Scope: FTUE script, HUD spec, menu/flow map, control schemes per device, accessibility checklist. Aligned with `design/GDD.md` (2-min battles, 5 rivals, Mutation draft, "Instant" pillar).

## Bottom line for Kingswarm

1. **The FTUE is battle 1, not a tutorial.** First launch = one click ("Play") into a live arena. The click doubles as the browser audio unlock. No hero pick, no charms, no menu. CrazyGames allows at most 1 click before gameplay [P]; Poki says "ideally placing players directly into gameplay" [P]. The GDD already says this; keep it.
2. **Teach three verbs in 90 s, each with one demonstration, max 8 words on screen:** move, hold-to-fire (capture a hut), recall. Dash and abilities are taught later, by context. This is Fan's rules 2, 4, 5, 7 [P] and the Mario 1-1 pattern [S].
3. **Make battle 1 a designed four-beat arc (kishotenketsu):** intro (safe capture), develop (second hut under a little pressure), twist (Crown opens), conclude (win). Rival 1 "Bumble" needs a scripted handicap so a first win is close to guaranteed. Do NOT copy the "new players lose the first real match" Clash Royale claim (it is a secondary blog claim, UNVERIFIED): Kingswarm's audience arrives from a portal with zero commitment.
4. **Reward the win with the hook, not a screen of stats:** win, 2 s of celebration, then the 3-card Mutation draft with animated previews. This is where "play for days" starts, so it must arrive inside minute 3.
5. **HUD = 5 things, and only the King-centric ones are diegetic.** Timer plus Crown bar, building counts, swarm count (anchored to your King, not a corner), ability cooldowns, rival tells (in-world). Capture rings, HP and status live in the world. Every HUD text must survive the 800x450 viewport that CrazyGames tests: the prototype's 13 px labels draw at about 8 px there [I, from `kingswarm.html` drawHUD and CrazyGames viewport list].
6. **Team identity = hue + luminance + shape.** Use Okabe-Ito blue #0072B2 vs vermilion #D55E00 (or orange #E69F00), plus different silhouettes (round crowned critters vs horned), plus a rim-light/outline rule like VALORANT's (enemy red fresnel, ally neutral blue) [P]. Never colour alone (GAG basic) [P].
7. **Settings and pause are launch features, not polish:** separate music/SFX volume, remap, screen-shake and flash toggles, hold-vs-toggle fire, UI scale, Assist. All persisted, all wrapped in try/catch (Poki: incognito breaks localStorage) [P].
8. **Touch is a first-class layout, not a port:** floating left stick to move, right thumb to aim and hold-fire with aim assist, three 56 px action buttons. Design it in M1 even if it ships in M3, because the fixed whole-arena camera makes critters about 14 px on a phone.
9. **The end-of-match screen is one screen, one focused button** ("Next rival" / "Rematch"), near-miss facts as the persuader, skippable instantly. Never a menu.
10. **Performance budget is part of the FTUE:** Poki asks for under 8 MB initial and warns players leave after 10 s of loading; CrazyGames wants 50 MB or less and 20 s or less to `gameplayStart` [P]. Three.js plus assets must be tutorial-first: load battle 1's arena first, stream the rest during it (CrazyGames' own advice) [P].

## 1. FTUE script: first 5 minutes, beat by beat

Design rules the script obeys: Fan's 10 (blend in, doing over reading, spread out, one demonstration, <=8 words, unobtrusive, adaptive, no noise, visuals teach, leverage known) [P]; Hayashida's introduction/development/twist/conclusion per level [P]. Prompts are adaptive: a prompt only appears if the player has not already done the thing; it vanishes the instant they do.

| Time | Beat | What the player sees and does | Prompt (<=8 words) | Design note |
|---|---|---|---|---|
| 0:00 | Boot | Diorama arena renders behind a single big **Play** button. King idles, critters wobble. Music silent. | none | Bundle target <8 MB. Button click creates/resumes AudioContext (Chrome autoplay policy since v71) [P]. |
| 0:03 | B1 intro: move | Battle 1 starts. King spawns with 6 followers. A floating WASD (or stick) glyph over the King. | "Move: WASD" | Show only if no movement in 3 s; fades on first move. Glyph matches last-used device. |
| 0:10 | B1 intro: fire | Nearest neutral hut pulses a ground ring. Mouse-hold glyph beside cursor. Player holds fire; critters arc out, land, garrison; ring fills; hut flips blue; a new critter hatches; swarm cap ticks up. | "Hold click. Throw your swarm." | One demonstration (Fan #4). The capture itself is the reward; sound and squash carry it. |
| 0:30 | B1 develop | Second hut, farther, plus 2 rival critters wandering near it. Player must move then fire. Ammo can run dry. | adaptive: "They come back to you." only if ammo=0 for >2 s | Teaches the ammo loop (open-ground critters return after ~2.5 s per GDD) without text if possible. |
| 0:50 | Recall | Once >=8 critters are garrisoned far away and player has <3 followers, recall button pulses. | "Recall: F" | Adaptive (Fan #7): skipped if they already used it. |
| 0:45 of 1:45 | B1 twist | **The Crown opens**: beam of light at centre, music layer enters, Bumble finally walks toward it. | "Hold the Crown 10 s." | Twist = the objective changes (Nintendo step 3). Diegetic: beam + ring, no modal. |
| ~1:30 | B1 conclude | Player captures Throne or holds Crown. Rival handicap (slower hatch, forgets recall) makes this reliable. | none | Target: >=90% of first-timers win B1 [I, UNVERIFIED target; instrument it]. |
| 1:35 | Win moment | 2 s slow-mo pull-in on the throne flip, stinger, confetti. Skippable with any key. | "Victory" | Peak-end: the last beat is the memory. Keep <=3 s. |
| 1:45 | Draft 1 | 3 Mutation cards, each with a 2 s looping animation of what it does (Bombers explode, etc.). Pick one. | "Pick one." | Visuals teach (Fan #9). This is the first appearance of "a different swarm every run". |
| 2:00 | B2 intro | Rival 2 card ("Pip the Tinkerer"), 3 s. Arena has a Tower, but far from the first objective. Tower range ring is drawn on the ground. | none | New mechanic in a safe place first (Nintendo). |
| 2:30 | Dash | Contextual: when an enemy critter chases the King for >1.5 s and dash is ready, dash button pulses. | "Dash: Shift" | Adaptive. Never taught in B1. |
| 3:00 | Ability | First time an ability is ready and >=4 enemies are clustered: key glyph pulses. | "Q: Stomp" | One ability at a time; the second (Ultimate) is introduced in B3. |
| 3:30 | B2 twist | Crown opens; Pip's Tower covers the approach. Player must flank or out-range it. | none | The question this battle asks (GDD rival table). |
| ~4:00 | End B2 | One-screen result: near-miss facts ("Crown held 8.4 of 10 s"), then Draft 2. | "Next rival" | If lost: show "1 Crown left", one button "Rematch". First loss is explained once, in 8 words: "Lose 2 Crowns and the run ends." |
| 4:30 | Draft 2 / B3 | Duo Mutation possibility appears if tags match. Battle 3 starts. Hints are now off by default (setting "Show hints" stays on in Pause). | none | By minute 5 the player has: 2 captures, 1 Crown fight, 2 drafts, 0 text walls. |

Rules for prompts: at most one on screen; never pause the sim (Fan #6); each prompt shown once per profile unless the player asks in Pause > How to play (Apple: allow replay via "How to Play") [P]; every prompt auto-hides after success.
Measure (instrument from day 1): time to first input, time to first capture, B1 win rate, B2 start rate, quit-at-Draft rate, run 2 start within the same session.

## 2. HUD spec

Principle: the HUD carries only what a player must read while their eyes are on the King; everything about the world lives in the world. Frameworks: diegetic / spatial / meta / non-diegetic (Fagerholt and Lorentzon, Chalmers thesis 2008) [P]; VALORANT tunes silhouettes and a red-enemy / blue-ally rim light for clarity at distance [P].

| Element | Where | Form | Size / rule |
|---|---|---|---|
| Timer + Crown progress | top centre | pill; Crown bar shows both teams' progress (10 s hold) | 26 px at 1280x720 reference; timer turns warm colour and pulses under 0:30 (not red only: also icon change) |
| Building counts | top left (you) / top right (rival) | small building icon + number; rival card shows portrait + name | numbers >=20 px reference |
| Swarm count | **under/around your King** | number badge "with you / cap" plus tiny ring | world-anchored; 13 px labels in the prototype are too small |
| Ability + dash + recall | bottom, near the active hand | radial cooldown, key/button glyph from the last-used device | >=56 px touch, >=48 px pointer; glyph swaps on last input device |
| Rival tells | in the world | telegraph decals on ground (radius, arc), rival ability icon over rival King | 0.6 s minimum telegraph before damage [I, to be tuned in game-feel doc] |
| Capture state | diegetic ring on each building | ring fills in team colour, icon shape differs per team, "contested" = frozen with a striped ring | rings must be visible under 100 critters: draw beneath units, outline 3 px |
| King identity | in the world | halo/arrow under your King only; rival King has crown + cape colour | player King must be findable in <0.3 s [I] |
| HP | over Kings only when damaged | bar appears on hit, fades after 2 s | avoids permanent bar clutter |
| Messages | top centre under timer | one line, 2 s | 8-word limit |

Do not show: minimap (whole arena is visible), kill feed, score ticker, XP bar in battle, quests (GDD bloat guard).
Reference resolutions to test: 800x450, 1280x720, 1920x1080 (CrazyGames lists ten viewports from 800x450 to 1920x1080 and requires legibility at devicePixelRatio 1) [P]. Minimum rendered text 12 px at 800x450, so 20 px at the 1280 reference. UI scale option 100/125/150% (GAG intermediate: allow interfaces to be resized) [P].
Contrast: UI components and graphical objects 3:1 against adjacent colours (WCAG 1.4.11) [P]; HUD text 4.5:1 (WCAG 1.4.3, not re-fetched this session).

## 3. Menu and flow map

Rule: first launch never sees a menu; returning player reaches battle in <=2 inputs, <10 s. (Poki: minimise menus; CrazyGames: <=1 click on first load) [P].

```
FIRST LAUNCH   Load -> [Play] -> Battle 1 (guided) -> Result -> Draft -> Battle 2 -> ...
RETURNING      Load -> Title
                       |- [Continue run]  (primary, focused; shown only if a run is saved) -> Battle
                       |- [New run] -> Hero pick (3 cards, last hero preselected, Enter to accept) -> Battle
                       |- Versus (couch / vs AI / online link)   [secondary]
                       |- Codex   [secondary]
                       |- Settings  [secondary]
IN BATTLE      Pause (Esc, P or Start; auto-pause on tab blur in single-player)
                       |- Resume | Restart battle | How to play (current device) | Settings | Abandon run
RESULT         Win : facts -> [Next rival] -> Draft -> Battle
               Lose: facts + "N Crowns left" -> [Rematch]      (Menu is a small secondary link)
               Run over: build summary + near-miss -> [New run]  (one button, focused)
```

Notes:
- **Result screen:** one button focused, Enter/Space/gamepad-A accepts, any key skips the celebration. Rocket League runs a 1-minute rematch window that ends early when all ready [S], i.e. the industry norm is "rematch is one press and the game waits for you". Near-miss facts in the GDD ("Throne at 9%") are the persuader; do not add trophies or XP bars (owner playtest: meta was ignored).
- **Pause keys conflict:** Poki wants Esc or Space to pause/resume [P]; CrazyGames says avoid Esc because it exits fullscreen [P]. Bind Pause to P, Esc and gamepad Start; treat all three as equal.
- **Online:** cannot pause; show "Rival paused"/disconnect toast instead. Online/link flow lives under Versus, not the title screen's primary path.
- **Hero pick** is skipped on the first run (default Brawler) and unlocks as a choice from run 2 (GDD: unlocks are options).
- **Optional Assist prompt:** after a lost run, offer "Turn on Assist?" once (Hades' God Mode starts at 20% damage resistance, +2% per death, cap 80%, toggleable from Settings any time) [P]. GDD's variant is +5% hatch rate per loss up to +30%.
- Do not put ratings, notification prompts, daily-quest banners on the first 3 screens (Apple: show non-essential asks after onboarding) [P].

## 4. Control schemes per device

Constraint: one control layer (GDD pillar 1). Verbs: move, aim, hold-to-fire, recall, dash, Ability, Ultimate. Bind by `event.code` (layout-independent) so AZERTY works; CrazyGames explicitly cites AZERTY WASD becoming ZQSD [P].

| Verb | Keyboard + mouse | Gamepad (standard mapping) | Touch (landscape) |
|---|---|---|---|
| Move | WASD / arrows | Left stick (radial deadzone ~0.2 [I]) | Floating left stick, appears where thumb lands, bottom-left half |
| Aim | Mouse cursor | Right stick; if idle, aim at nearest enemy building/King (aim assist) | Right thumb drag direction; magnitude maps to throw range (Brawl Stars maps drag to aim [S]) |
| Hold to fire | Hold LMB | Hold RT (or R1) | Hold the right thumb; tap-hold with no drag = auto-aim at nearest objective |
| Recall | F or RMB | LB or B | 56 px button |
| Dash | Shift (alt: Space) | A | 56 px button |
| Ability / Ultimate | Q / E (prototype used Q / R; pick one and lock it) | X / Y | 2 buttons in a thumb arc |
| Pause | P / Esc | Start | top-right, 48 px |
| Menus | mouse, plus Tab/arrows/Enter | D-pad/stick + A/B | tap |

Details that matter:
- **Aim assist (GAG intermediate: "include assist modes such as auto-aim") [P]:** magnetise fire toward the nearest hostile building/King within a 20-25 degree cone [I, tune]; on for touch and gamepad by default, off for mouse; user toggle.
- **Hold-to-fire alternatives (GAG intermediate: avoid/provide alternatives to hold-down buttons) [P]:** setting "Fire mode: hold / toggle".
- **Touch targets:** Apple 44x44 pt, Material 48x48 dp, WCAG 2.5.8 floor 24x24 CSS px [P]. Use 56 px with 8 px gaps for action buttons. Keep `touch-action:none` on the canvas (already in prototype). Support multitouch (move + aim at once). Fingers occlude 15-20 mm [S]: put controls in letterbox margins where possible.
- **Gamepad in browser:** Firefox exposes a pad only after the user presses something with the page visible, so show "Press any button on your controller" and swap glyphs on last-used device [P, MDN]. Standard-mapping indices (buttons 0=A, 1=B, 2=X, 3=Y, 4=LB, 5=RB, 6=LT, 7=RT, 9=Start) come from the W3C spec, not re-verified this session [I].
- **Couch 2P:** keep one keyboard as two zones plus optional pad. Prototype keys (arrows + H J K L I) are a workable start; auto-aim is default for P2 (prototype already does this).
- **Ping (Apex):** Respawn tested "smart comms" for a month with mics muted and random names [P]. Kingswarm's 1v1 has no teammates; a ping is only relevant for future co-op. Do not build it now. In online 1v1 a fixed "emote" wheel (4 icons) is enough for rematch banter [I].
- **Remap:** GAG basic guideline, and one of the four most-complained-about issues (remapping, text size, colourblindness, subtitles) per the search summary of GAG [S]. Ship a remap screen for keyboard and pad at M2.

## 5. Accessibility checklist

Sourced from Game Accessibility Guidelines (gameaccessibilityguidelines.com) basic tier list, fetched this session [P]; intermediate items from the same site. Milestones from GDD section 10. `[ ]` = to do.

**Motor**
- [ ] Remappable controls, keyboard and gamepad (basic) - M2
- [ ] Sensitivity option for aim/stick (basic) - M2
- [ ] Game speed option 0.75x/1x for offline battles (basic; not possible in online) - M2
- [ ] Simplified alternative: aim assist + auto-aim; hold/toggle fire (intermediate) - M1
- [ ] All menus usable with the gameplay input device (basic) - M2
- [ ] Touch targets >=48 px; controls repositionable (basic) - M3
- [ ] No precise-timing dependency: dash has a generous window; telegraphs >=0.6 s [I] - M1
- [ ] Haptics slider if vibration is used (basic) - M3

**Cognitive**
- [ ] Interactive tutorial (basic): battle 1 - M2
- [ ] Start game without navigating multiple menus (basic): 1 click - M1
- [ ] Simple clear language, <=8 words per prompt (basic) - M2
- [ ] Reminder of controls in play (intermediate): persistent hint chip in B1 and Pause > How to play - M2
- [ ] Option to hide background motion/animation (intermediate): "Calm arena" toggle for water, foliage, ambient particles - M2
- [ ] Assist mode that never locks content (GDD section 7) - M2
- [ ] Settings all saved, incl. when localStorage fails (basic): in-memory fallback - M2

**Vision**
- [ ] No essential info by colour alone (basic): shapes, icons, patterns per team - M1
- [ ] High contrast text/UI (basic); components 3:1 - M1
- [ ] Colour options for teams: Default (blue/vermilion), Blue/Yellow, High-contrast; similar to VALORANT's enemy-highlight choices (red default, purple for tritanopia, yellow for deuteranopia/protanopia) [S] - M2
- [ ] Easily readable default font size, 12 px minimum at 800x450 (basic) - M1
- [ ] Resizable interface, 100/125/150% (intermediate) - M2
- [ ] Screen shake toggle and "reduce motion" (also cuts hit-stop, zoom punches); flash toggle - M1
- [ ] Photosensitivity: no more than 3 flashes/s over >=25% of screen; avoid flashes "to/from red"; do not label a toggle "epilepsy safe", name the effect (GAG flicker guideline) [P] - M1 (audit the Crown-open and Frenzy effects)
- [ ] Fixed camera means no motion-sickness FOV issue; keep camera drift off by default

**Hearing**
- [ ] Separate volume for music, SFX (and master) (basic) - M1
- [ ] Nothing essential by sound alone (basic): every stinger (capture, King down, Crown open) has a visual banner or ring - M1
- [ ] Rival barks shown as text bubbles (subtitles), readable size, high contrast (basic) - M2
- [ ] Mute on tab blur/ads (Poki requires muting during ads) [P] - M3

**General**
- [ ] Difficulty options and Assist changeable mid-run (basic/intermediate; Hades God Mode precedent) [P] - M2
- [ ] Describe accessibility features in-game and on the store page (basic) - M3
- [ ] Solicit accessibility feedback link in Settings (basic) - M3
- [ ] Test with a colour-vision simulator on screenshots of a 100-critter fight, not just the HUD - M1

## 6. Evidence

**George Fan, GDC 2012, "How I Got My Mom to Play Through Plants vs. Zombies"** (10 techniques as summarised by Game Developer) [P/S]:
https://www.gamedeveloper.com/design/gdc-2012-10-tutorial-tips-from-i-plants-vs-zombies-i-creator-george-fan
1 blend the tutorial into the game (players unaware they are taught); 2 doing over reading; 3 spread instruction out (money only from level 10; Zen Garden near the end); 4 one demonstration often suffices (a coin with an arrow); 5 <=8 words on screen ("Click on a seed packet to pick it up"); 6 unobtrusive messaging, do not pause; 7 adaptive messaging (tips only to players doing it wrong); 8 avoid noise ("boy who cried wolf"); 9 visuals teach (Peashooter has a big mouth); 10 leverage existing knowledge (coins, slow zombies). Talk: https://www.gdcvault.com/play/1015541/How-I-Got-My-Mom . Slides PDF was 403 for me; the list above is from the Game Developer write-up only.

**Kishotenketsu / Nintendo:** Koichi Hayashida (director, Super Mario 3D Land / 3D World) describes four steps: introduction ("learn how to use that gameplay mechanic"), development ("slightly more complicated scenario"), twist ("something crazy happens that makes you think about it in a way you weren't expecting"), and mastery/conclusion; credited to Miyamoto's comic background [P, interview].
https://www.gamedeveloper.com/design/the-structure-of-fun-learning-from-i-super-mario-3d-land-i-s-director and https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design . World 1-1 as text-free tutorial: https://en.wikipedia.org/wiki/World_1-1 [S]. Extra Credits ("Tutorials That Don't Talk Down To You", https://www.youtube.com/watch?v=hFdEEzgc7pg) and GMTK: I could not retrieve transcripts; their content is UNVERIFIED here and I relied on Fan and Nintendo instead.

**Web-portal FTUE requirements (the closest thing to "time to first input" data):**
- Poki: initial download under 8 MB; "players tend to move to another game if loading takes more than 10 seconds"; minimise menus; visual tutorials; skippable intros; `gameplayStart()` fires on the first input; Esc or Space to pause. https://developers.poki.com/guide/requirements-quality [P]
- CrazyGames: new users land in gameplay immediately, max 1 click; show controls with an overlay; tutorials inside real play and skippable; <=50 MB (20 MB for mobile homepage); externally hosted <=20 s to gameplay; avoid Esc; legible at ten viewports 800x450 to 1920x1080; load tutorial-critical assets first and stream the rest during the tutorial; latency perception 100 ms / 1 s / 10 s. https://docs.crazygames.com/requirements/gameplay/ , https://docs.crazygames.com/requirements/quality/ , https://docs.crazygames.com/requirements/technical/ , https://docs.crazygames.com/resources/getting-to-the-first-frame/ [P]
- Public first-session drop-off numbers (time to first input, first-win rate): none found from primary sources. Claims that Poki wants players to "understand and enjoy the game within three minutes without dying or failing" are from secondary blogs (abratabia.com, indiegamebusiness.com): UNVERIFIED. Instrument your own.
- Apple's onboarding guidance (mobile, but sound): teach the core loop first, short tutorials at relevant moments, avoid splash/agreements, allow skip, offer replay under "How to Play", defer non-essential asks; cites Clash Royale's five short tutorials. https://developer.apple.com/app-store/onboarding-for-games/ [P]

**Clash Royale:** Apple confirms "five short tutorials, earlier ones with more guidance" [P]. A Medium/LinkedIn analysis (Matt Le) says 7 training matches then a first real opponent the player "likely" loses, followed by a crown chest showing 1/10 crowns, ~15 minutes total: secondary and could not be corroborated, UNVERIFIED (Apple's "five" disagrees). https://www.linkedin.com/pulse/clash-royale-creating-sticky-first-time-user-experience-matthew-le

**Hades:** no traditional tutorial, mechanics learned by playing [S]; God Mode is the safety net: 20% damage resistance, +2% per death, cap 80%, toggle in Settings any time; Kasavin: roguelikes' brutal difficulty is "directly at odds" with their replayability [P, Inverse interview]. https://www.inverse.com/gaming/hades-god-mode-interview . Lesson: failure can be the loop only if help scales quietly.

**HUD and readability:** VALORANT clarity via rim light, enemies red fresnel / allies neutral blue, depth-based brightening of distant characters, hard geometric edges on vision-blocking VFX. https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity [P]. Interface taxonomy: Fagerholt and Lorentzon "Beyond the HUD" (Chalmers, 2008) https://www.semanticscholar.org/paper/Beyond-the-HUD-User-Interfaces-for-Increased-Player-Fagerholt-Lorentzon/16ee02a8839923752c6bc93f294bec67d73a586e [P]; note it targets FPS, applied here by analogy [I].

**Accessibility:** https://gameaccessibilityguidelines.com/basic/ and /full-list/ [P]; flicker thresholds https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/ (>3 flashes/s over 25% screen, red flashes count) [P]; colour palette Okabe-Ito https://jfly.uni-koeln.de/color/ (#E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7 plus black; redundant coding by shape, line style, direct labels) [P]; WCAG 1.4.11 3:1 https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html [P]; touch target sizes Apple 44 pt / Material 48 dp / WCAG 2.5.8 24 px, from search summaries (not fetched directly) [S].

**Controls references:** Brawl Stars: left joystick move, right joystick drag-aim and release-to-fire, tap for auto-aim quick-fire, movable controls [S] https://brawlstars.fandom.com/wiki/Beginner's_Guide . Apex smart comms, month-long muted-mic playtest https://www.gamedeveloper.com/design/respawn-played-with-muted-mics-to-get-i-apex-legends-i-smart-comms-system-just-right [P]. Chrome Web Audio autoplay policy (v71; create/resume AudioContext after a gesture) https://developer.chrome.com/blog/autoplay [P]. Gamepad API and Firefox interaction requirement https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API [P].

## 7. Open risks

- Tilted 3D camera can hide critters behind buildings/King: cap tilt, test 100-critter screenshots for occlusion before adding pretty props.
- Guaranteed first win vs. authenticity: a handicap the player notices feels patronising. Use rival slowness the player can read (Bumble dawdles), not hidden stat buffs.
- Touch fire-with-aim on a small arena is unproven for this game; prototype it (throwaway) before committing the M3 layout.
- "Auto-pause on blur" conflicts with online play and with the worker-timer fix (commit 02d18d8); restrict to single-player.
- No primary data exists on portal first-session drop-off; the only hard numbers are portal rules (10 s load, 1 click, 8/50 MB). Use your own funnel events.
