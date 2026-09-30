# Kingswarm — Art and audio direction

One look for the diorama, the UI and the sound. When in doubt: **a toy battlefield on a table, lit by afternoon sun, that you want to poke.**

## Look: the toy diorama

- A rounded grass island with a dirt cliff edge, floating in calm deep-blue water. Fixed tilted camera (about 56° down, narrow 28° lens so it reads almost like a miniature), whole arena in frame at 16:9.
- Low-poly, flat-shaded props; smooth, round, squashy living things. Hard things are faceted, soft things are blobs: you can tell what is alive at a glance.
- One warm key light (sun from the upper left, soft shadows falling toward the lower right), cool sky fill. Shadows anchor every unit to the ground.
- Units are chunky: a critter is about 1/55 of screen width, a King about twice that, buildings are the biggest things. Nothing important is ever smaller than ~22 px at 1080p.
- Every living unit has big white eyes with dark pupils that look where it is going or aiming. Eyes are the personality budget.
- Dark team-tinted outline (inverted hull) on critters and Kings so crowds stay readable over any ground.

## Palette

| Role | Colour | Notes |
|---|---|---|
| Blue team | `#3FA7FF` body, `#0E2F57` outline/dark, `#BFE3FF` light | The player in solo modes. Cool. |
| Red team | `#FF5A4F` body, `#5E0F0A` outline/dark, `#FFD0CB` light | Rival. Warm. |
| Neutral | `#D9CFB4` | Unowned roofs and flags. |
| Gold | `#FFD166`, deep `#A8781A` | Crowns, the Crown objective, primary buttons, rewards. Reserved: nothing else is gold. |
| Grass | `#6FB04A` base, `#7CC054` / `#62A343` patches | |
| Earth | dirt `#C9B27A`, cliff `#8A6A45`, wood `#6B4526` | |
| Stone / walls | stone `#8D97A6`, wall cream `#F1E4C4` | |
| Water | `#2B6F9E`, deep `#1D3F5E` | Also the page background. |
| Danger / fire | `#FF8A3D` | Scorch, explosions, low HP. |
| Frost | `#9FE8FF` | Frostbite, Cryo. |
| Ink | `#1B2430` | UI outlines and text on light surfaces. |
| Parchment | `#F6EBD0`, shade `#E4D3A8` | UI cards. |

Team identity is never colour alone: Blue units are round-topped, Red units have a small pointed tuft; Blue flags are swallow-tailed, Red flags are triangular. Colour-blind mode swaps Red for orange `#FF9F1C` and adds a pattern to capture rings.

## Motion

Squash and stretch on every hop, throw and landing (volume preserved). Things pop in with a slight overshoot and leave quickly. Big events get a brief presentation-only hit-stop and a camera nudge; ordinary hits get a tiny flash and a puff. Numbers for all of this: `design/research/game-feel.md`. The simulation never pauses for an effect.

## UI: storybook cards on the battlefield

- DOM overlay above the canvas. In battle the HUD is small dark translucent pills with cream text at the screen edges; the diorama is the star.
- Menus, drafts and results are **parchment cards with a thick ink outline and a hard drop shadow**, slightly rotated (1–2°) so they feel placed on the table. Primary buttons are gold with a darker bottom edge that compresses on press.
- Type: one rounded, heavy display face for titles and numbers, the same family at lighter weights for body text. Bundled locally, no web requests. Sentence case; short words; no paragraphs in menus.
- Mutation cards: tag colour band (Boom orange, Brood green, Bite violet, King gold), a big icon drawn from simple shapes, the name, one sentence. Rival cards: portrait bust rendered from the 3D model, two trait icons, their Mutations.
- Everything animates in under 250 ms and responds on press, not release. Every screen has one obvious primary action reachable with Enter / gamepad A.

## Sound

Soft, woody, organic, a little comic: pops, plops, thumps, a toy-box orchestra. No synth beeps. Critter sounds are tiny and bright; building and King sounds sit lower and heavier; gold moments (capture, Crown, victory) get short musical stingers. Music is one light medieval-fantasy loop with an added percussion layer when the Crown opens. Rules and numbers: `design/research/game-feel.md` §4.
