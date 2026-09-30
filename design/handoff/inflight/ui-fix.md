# Interrupted stage: ui:fix (kingswarm-ui-build)

Stopped by the lead on 2026-09-30 when the owner asked to save and close. Its edits are on disk and committed as-is.

## Files it wrote or edited

- `src/ui/ui.css`
- `src/ui/icons.ts`
- `src/ui/types.ts`
- `src/ui/hud.ts`
- `src/ui/hud.css`
- `src/ui/glyphs.ts`
- `lab/ui-lab.ts`
- `src/ui/screens/draft.ts`

## Its own progress notes, oldest first (last 25)

- Now the draft CSS.
- Now the lab: counters and a stub preview loop, so the draft's excitement can be judged.
- Now the rival card: a gold Fight! button with the keycap on the right, the rival's question, and an ink VS medallion.
- Now settings.
- Now the title screen.
- Now the run-end screens and their shared parts.
- Now the CSS for run-end, codex, hero pick, how-to, confirm, toast and gutters.
- Now the codex, hero pick and how-to code.
- Typecheck is clean and 21 tests pass. Next I'll capture every screen at 1280x720 and 800x450 in one browser.
- The counter ribbon covers the Mutation name, and in compact mode the preview icon badge loses its corner size. The Cryo shards also read as horns. I'll fix all three.
- Now the catalog copy: I'll rewrite the "+x%" lines as behaviour and flag them for the design lead.
- Pause at 800x450 is fixed. In settings the title margin loses a specificity fight; I'll fix that, then check the title screen.
- The crown now sits on the K and the tagline has room. Next, hero pick and the rival card.
- Box heights are close; I'll raise the minimum so all four match. Next, the result screens.
- The broken crown now reads as one object. Next, the run-end screens.
- The run-won unlock cards wrap and overflow at 1280. I'll size the build column to its content and keep unlock labels on one line.
- At 800x450 the ribbon still spans the whole art and hides the icon badge. I'll make it a caption bar along the bottom of the art, and move the Duo seal to the top-right.
- The caption bar works, and each Mutation now has its own silhouette. Next I'll re-shoot the codex, how-to, hero pick, settings, HUD, confirm, toast and scale stress cases.
- The codex shows all 22 cells at 800x450, and the how-to tiles line up. Now the HUD stress cases.
- At 150% on 800x450 the Crown sides still collide with the corner pills. I'll check the 150% shot at 1280 before choosing the breakpoint.
- At 1280 and 150% it fits. I'll add a narrower rule for the 800x450 at 150% case.
- Everything fits now, and the cooldown reads "11", not "-11". Next, the confirm dialog, the pick flight and the toast.
- The confirm scrim and the top-edge toast look right. The pick flight hasn't left the lift pose at 330 ms, because the whole-iteration easing stalls it. I'll give each segment its own easing.
- The mid-flight capture is ambiguous: all the cards look translucent but haven't moved. I'll sample the animation state directly with JS rather than trust screenshot timing.
- Headless frames are slow (about 20 fps), so wall-clock sampling lags. I'll pause the animation at fixed times for deterministic frames.
