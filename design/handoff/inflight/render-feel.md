# Interrupted stage: render:feel (kingswarm-render-build)

Stopped by the lead on 2026-09-30 when the owner asked to save and close. Its edits are on disk and committed as-is.

## Files it wrote or edited

- `src/render/feel.ts`
- `src/render/fx.ts`
- `src/render/critters.ts`

## Its own progress notes, oldest first (last 25)

- I'll start by getting oriented in the codebase and the current render state.
- The island now reads as a diorama. Now I'll build the feel layer: pure logic first (trauma shake, flash limiter, particle budget, hit-stop) so it can be unit-tested in Node.
- Tests pass. Now the effects module: particles, ground rings/decals, glows/beams, tracers.
- Now the critters rewrite: bigger units, per-kind silhouettes, gaze clamp, flight trail/squint, status overlays, mutation accessories, landing squash and recall marks.
- Now the Kings: spec size, full saturation, thicker outline, bold rings for both, bigger markers, flash/recoil hooks, and a land-clipped aim arc.
