# Interrupted stage: audio:engine (kingswarm-audio-build)

Stopped by the lead on 2026-09-30 when the owner asked to save and close. Its edits are on disk and committed as-is.

## Files it wrote or edited

- `src/audio/mapping.ts`
- `src/audio/mixer.ts`
- `src/audio/engine.ts`
- `src/audio/index.ts`
- `src/audio/testing.ts`
- `src/audio/mixer.test.ts`
- `src/audio/mapping.test.ts`
- `src/audio/engine.test.ts`
- `lab/audio.html`
- `src/audio/scenarios.ts`
- `lab/audio-lab.ts`

## Its own progress notes, oldest first (last 25)

- Let me quickly probe what a real sim fight emits, to make the lab's event stream realistic.
- Now writing the mapping table.
- Now the mixer: graph, voices, aggregation, ducking, music, all on explicit time so it works identically on an OfflineAudioContext.
- Now the engine (context lifecycle, loading, fail-silent wrapper).
- Audio compiles clean (render errors belong to another owner). Now the fake AudioContext for tests.
- Tests are green (44). Now the lab page: audition buttons plus the offline `renderMix`.
- Load average is above 10, so I'll hold off on Chromium and add a cheap Node test of the heavy scenario's voice budget first.
- Meanwhile, a small driver (in gitignored `.cache/`) that renders every scenario in one browser launch and saves the WAVs for ffmpeg loudness measurement.
- Load has stayed above 10 for 4+ minutes because of other agents' jobs; RAM is fine (2.3 GB free), so I'll proceed with one niced, short-lived Chromium.
- The page renders (buttons for all 37 ids, music states, volumes). To tune with evidence I'll extend `renderMix` to optionally return stem WAVs and per-family levels.
