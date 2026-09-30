# Kingswarm studio: AI-run audio pipeline (a pipeline that cannot listen)

Researched 2026-09-30 on the studio laptop (i5-1135G7, ~2 GB free RAM, no GPU). Builds on `assets-audio.md` (CC0 shortlist, download commands, OGG basics); nothing from it is repeated except where a claim changed.
Status tags: CONFIRMED (primary source or a run here), OUTDATED, UNVERIFIED. "RAN" = executed today in the scratchpad, nothing installed in the repo.

## Bottom line for the studio
1. **ADOPT NOW: keep CC0 human-made audio as the shipping base; AI only fills gaps.** Reason: the lead cannot hear, so every generated sound costs a verification loop, and the AI-music legal picture (below) is unsettled. Gaps today: critter squeaks, toy-box wood pops, one Crown percussion layer.
2. **ADOPT NOW: an objective audio gate (ffmpeg + numpy/scipy/soundfile/pyloudnorm), run on every asset and again on the shipped file.** RAN on 8 library and 7 generated sounds; it caught real defects (Kenney `pluck_001` is +0.01 dBTP; SA3 outputs vary 15 dB in level and two had no decay tail). Thresholds in section 3.
3. **ADOPT NOW: ship SFX as Opus 64 kbps mono, music as Opus 48 to 64 kbps stereo, AAC .m4a only as a fallback picked by `canPlayType`.** RAN: 42 Kenney SFX (19.4 s) = 171 KB Opus64 vs 273 KB Vorbis q3 vs 165 KB AAC48; Opus64 kept spectral centroid at 0.998 of source, Opus 24 to 48k dulled the worst file by 20%. Individual files, no audio sprites.
4. **ADOPT NOW: local CLAP (int8 ONNX, no torch) as a reject/rank filter, never an accept test.** RAN: 8.6 s for 15 clips on CPU, ~160 MB of weights kept outside the repo. It separates beeps and garbage from foley reliably, but confuses "wooden pop" with "cartoon boing" and "hand clap".
5. **ADOPT NOW: a Chromium decode test in the existing Playwright setup** (`/usr/bin/chromium` works with `playwright-core` from the repo). RAN: Vorbis, Opus (ogg and webm), AAC and MP3 all decode to exactly the source sample count (96000), with encoder delay and padding stripped. Loop points can therefore be set from the manifest.
6. **TRY LATER: Stable Audio 3 `small-sfx` for gap sounds, local, free, CPU.** RAN (int8 DiT): 5 to 20 s per 1 s clip. 4 of 7 prompts gave a valid one-shot; the two 1.5 s prompts failed (no decay). Needs owner license registration first (section 1) and fp32 DiT (1.8 GB, needs free RAM) for quality.
7. **TRY LATER: ElevenLabs SFX API (`loop` flag, 0.5 to 30 s) if SA3 hit rate is poor.** Paid plan and key needed. Cost is trivial ($0.12/min list price); quality UNVERIFIED (not run).
8. **TRY LATER: Gemini 3.8 Flash as a second-opinion listener** (accepts audio, 32 tokens/s). Needs a key; accuracy on "soft wooden pop" UNVERIFIED. Claude models cannot take audio input (none listed in the API features overview).
9. **SKIP: Suno, Udio, MusicGen/AudioGen, sfxr-style beeps, aubio, essentia, librosa as a hard dependency.** Reasons in sections 1 and 3.
10. **ADOPT NOW: one human listening pass by the owner** on a single concatenated "contact reel" WAV before the M1 gate. No metric measures charm; this costs ~5 minutes.

## 1. Sources compared
| Option | Access | Commercial / legal (date checked) | Loop / stems | Verdict |
|---|---|---|---|---|
| CC0 libraries (Kenney, RandomMind, rubberduck) | curl | CC0, no risk | loops exist; no stems | base (see assets-audio.md) |
| **Stable Audio 3 small-sfx / small-music** (Stability, HF created 2026-05-16, repo pushed 2026-09-29) | local CPU: `ai-edge-litert` TFLite runtime, 433M params, up to 120 s | Stability Community License: free commercial use under US$1M annual revenue **but registration required**, "Powered by Stability AI" notice, no training foundation models on outputs, you own outputs "to the extent permitted by law". Trained on 806k licensed AudioSparx + 472k Freesound (CC0/CC-BY/CC-Sampling+) recordings per the model card (CONFIRMED: HF README + LICENSE.md) | inpainting/audio-to-audio in the CLI; no true stems (only "TrackType: Instrument" prompts) | best AI option; TRY LATER |
| Stable Audio Open 1.0 / small (2024-25) | gated HF | same family, older | | OUTDATED, superseded by SA3 |
| ElevenLabs SFX (`POST /v1/sound-generation`, model `eleven_text_to_sound_v2`) | API key | free plan non-commercial only; paid plans commercial; you keep output rights but grant EL a broad license (terms of use, CONFIRMED) | `loop` bool (v2 only), 0.5 to 30 s, 40 credits/s, MP3/Opus/PCM | TRY LATER |
| ElevenLabs Music | paid API, $0.15/min, 3 s to 5 min | "cleared for nearly all commercial uses ... gaming" (docs); per-plan terms not retrievable (music-terms page gave no tiers) | no stems/loop documented | UNVERIFIED, skip |
| Google Lyria 3 Clip / Lyria 3.5 (Gemini API) | key | SynthID watermark on all output; license and price not retrievable | 30 s "clips, loops" fixed; single-turn | UNVERIFIED, skip |
| Suno v6 (2026-09-09) | app only; the "Suno API" sites are third-party (sunoapi.org) | commercial rights only on Pro ($8) / Premier ($24); free plan has no downloads and no commercial use; downloads capped 20 / 60 songs per month; UMG + Sony still suing (amended Aug 2026 with DMCA anti-circumvention claims), WMG settled 2025-11, BMG 2026-08 (Wikipedia, secondary; pricing page primary) | stems on paid tiers (2 / 3 types), Studio 2.0 | SKIP |
| Udio | app | UMG settlement Oct 2025 moved it to a licensed walled-garden model; current download rights UNVERIFIED (site unreadable) | | SKIP |
| MusicGen / AudioGen (Meta) | HF | weights CC-BY-NC 4.0 (HF API, CONFIRMED); cards last touched 2023-24 | | SKIP (non-commercial) |
| ACE-Step 1.5 | HF | MIT (HF API, updated 2026-02-03); CPU speed and output rights UNVERIFIED | | watch |
Legal caveats that apply to any AI music: (a) 100% AI output is not copyrightable in the US, per Suno's own help page, so you cannot stop others copying it; (b) Steam requires disclosure of AI-generated sound shipped in the game and judges it like other content (Steamworks content survey, CONFIRMED); (c) scraped-data litigation can hit distributors.

## 2. What running SA3 here showed (RAN, `sa3_tflite.py`, `--dit sm-sfx --dit-precision w8a8-dyn --no-cfg-batched`)
- The Hugging Face repo `stabilityai/stable-audio-3-optimized` is **ungated** (anonymous download worked); the standard `small-sfx` repo is gated. The optimized repo carries the license and NOTICE, so the registration duty still applies.
- Cold run 7 min (1.1 GB downloaded); warm runs 6 to 20 s wall per 1 to 1.5 s clip including model load. A 60-sound library with 4 candidates each is ~1 hour unattended.
- int8 DiT is what fits 2 GB free RAM; the SA3 README says int8 "fails" on the DiT in the sense of giving a different plausible sample, and fp32 is the pick. Output is stereo 44.1 kHz; L/R correlation 1.00 on most clips, so mono downmix is safe.
- Same prompt "soft wooden pop ... dry, short, fast decay", seeds 1/2/3/7(+cfg 3 with negative prompt): seed 1 (1.5 s) was a 1.5 s noise bed with a burst at 1.25 s (attack 220 ms, ends at -15 dBFS); seeds 2, 3, 7 were valid pops (attack 3 to 9.5 ms, decay 14 to 27 ms, silent tails 680 to 940 ms). Peak levels ranged -15.5 to -0.2 dBFS for the same prompt.
- "heavy wooden door thud" at 1.5 s failed (251 ms attack, no tail). "tiny rubber squeak toy" passed numerically (centroid 7.3 kHz). "8-bit beep" produced a real beep, so the model follows style words; put "no synth" in the negative prompt and gate on CLAP.
- Lesson: request ~1.0 s for one-shots and trim, and record `{prompt, seed, model revision, precision, date}` in a manifest. Use `--no-cfg-batched` for run-to-run reproducibility with int8.
- SA3 `small-music` and music loops: NOT run (scratchpad quota exceeded on the second weights download). UNVERIFIED.

## 3. How an agent that cannot hear verifies audio (all RAN unless marked)
Measured references: 8 real/synthetic files (Kenney impacts and UI, sox beep, synthetic pop), 7 SA3 clips, synthetic 4-bar loops with ground truth (120 BPM, A minor).
**Hard gates (fail the build). Thresholds are studio-chosen starting points, calibrated on the numbers observed.**
| Check | Tool | Gate | Observed |
|---|---|---|---|
| Loudness (music, stingers) | `ffmpeg -af loudnorm=I=-18:TP=-1.5:print_format=json` (2 pass, then `linear=true`) | -18 LUFS integrated +/-1 | one-pass "dynamic" mode missed -18 by 0.8 LU; use measured 2-pass |
| Loudness (one-shots) | `apad=whole_dur=1,ebur128=peak=true` (BS.1770 needs 400 ms; padding is removed by the absolute gate) | class target on loudest 400 ms; pop/critter -24..-20, ability/hero -20..-16, building/King -18..-16 LUFS | matches pyloudnorm (-24.8 vs -24.86); Kenney library spans -32..-22 LUFS, SA3 pop -37..-14: normalization is mandatory |
| True peak | ebur128 `peak=true` or 4x oversample | <= -1.0 dBTP on the **shipped** file (pre-encode target -1.5) | lossy encode added up to +0.91 dB (Opus 24k), +0.49 (Opus 48k); Kenney `pluck_001` = +0.01 dBTP |
| Clipping | count samples >= 0.999 | 0 | |
| DC offset | mean per channel | < 0.002, else 20 Hz high-pass | Kenney <= 0.0006; SA3 noise bed 0.007; synth pop 0.0028 |
| Lead / tail | -50 dBFS threshold | lead <= 5 ms (input latency), last 5 ms below -60 dBFS after a 10 to 20 ms fade | SA3 pop had 47 ms lead, 684 ms tail |
| Attack / decay (per class) | envelope: -30 dB to peak, peak to -30 dB | pop/thump: attack <= 15 ms, decay <= 150 ms | valid SA3 pops 3 to 9.5 ms and 14 to 27 ms; failures 220 to 251 ms |
| Mono compatibility | L/R correlation, mono-vs-stereo peak | ship SFX mono; corr > 0.8 first | |
| Loop seam | last-to-first sample vs linear prediction, divided by the file's own 99th percentile step | ratio < 0.5 | perfect loop 0.04; 37 ms mistrim 0.98; 30 ms equal-power crossfade fix 0.00 |
| Loop length | duration x BPM / 240 | integer bars, error < 1 ms | BPM must be an input contract, not a detection result |
| Decode | headless Chromium `decodeAudioData` | sample count == manifest; first/last sample within 0.05 | all 5 codecs exact 96000 |
Gotchas found: `afade=t=out` without `st=` fades the **start** (killed a pop's onset); trim tails with `areverse,afade=t=in,areverse`. `silenceremove` recipe that worked: `silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.003,areverse,silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.02,afade=t=in:d=0.02,areverse`.
**Shape / brightness (advisory, per class, calibrate on the CC0 reference set):** centroid (Welch) and 85% rolloff catch dull or hissy output; gate candidates to the p5..p95 band of real references, not to guessed absolute Hz. `tonal_ratio` (energy within +/-3 bins of the strongest bin) is **unreliable under ~150 ms**: real thumps and clicks scored 0.79 to 0.99. Do not use it as a beep detector.
**Tempo / key (advisory only):** librosa 1.0.0 (ISC, needs Python >=3.12, pulls numba and llvmlite, ~250 MB) reported 117.5 BPM for a true 120 (2% off) and 80.7 with `start_bpm=100`; autocorrelation of the onset envelope at 0.5 BPM steps returned 120.0. A Krumhansl key profile said "A major" for an A minor loop (tonic right, mode wrong). Enforce BPM and key by prompt plus loop length, not by detection. aubio 0.4.9 last released 2019 (GPL), essentia is AGPL and heavy: skip both.
**Semantic check with CLAP** (`Xenova/clap-htsat-unfused` int8 ONNX, 34 MB audio + 127 MB text tower, Apache-2.0; transformers 5.17 needs torch for its feature extractor, so compute the 64-bin slaney log-mel yourself with `transformers.audio_utils`, 10 lines):
- Text zero-shot vs 16 distractors: Kenney wood impact ranked 1 of 17 for "a soft wooden pop" (softmax 0.999) with `repeatpad`, but rank 2 with plain `pad`; the SA3 pop that passed numerically ranked 2 or 1 depending on padding and label; sox beeps ranked "chiptune video game blip / synthesizer beep" first (correct); the failed thud ranked "music" first with negative cosine.
- Audio-to-audio cosine to the centroid of 10 real Kenney wood impacts (leave-one-out cos 0.92): real foley 0.54 to 0.66; SA3 pops 0.22 to 0.36; beeps and garbage -0.10 to 0.13; but a sox-synth pop scored 0.47 and UI clicks 0.46 to 0.49, so this measures "foley-likeness", not "woodenness".
- Use: reject when top-1 is beep/blip/noise/music; rank the N candidates of one prompt by reference cosine plus text cosine; never accept on CLAP alone. Fix label wording per class and keep the distractor list versioned.
**Vision check (RAN):** `ffmpeg -lavfi showspectrumpic=s=800x300:legend=1:scale=log:fscale=log` plus `showwavespic`, read as an image by the lead. It correctly showed the failed pop as a continuous noise bed with one burst at 1.25 s, agreeing with the numbers. Use on the final contact sheet only.
**Audio LLMs:** Gemini 3.8 Flash reads 13 audio MIME types at 32 tokens/s and can name non-speech sounds (docs, CONFIRMED); paid input $0.75/1M tokens through 2026-12-31, free tier exists but data may be used to improve products. Untested here. Local audio LLMs (Qwen3-Omni-30B-A3B) do not fit 7 GB RAM.

## 4. Recommended pipeline (concrete, for `tools/audio/`, raw sources in gitignored `assets-src/`)
1. **Source** per sound slot: CC0 file from assets-audio.md; else SA3 (`--dit sm-sfx --seconds 1.0`, 4 seeds, fp32 DiT if RAM allows) or ElevenLabs. Write `manifest.json`: id, slot, source URL or prompt+seed+model revision, license, download date, sha256.
2. **Condition** (ffmpeg): mono downmix, 20 Hz high-pass, trim lead (keep 3 ms) and tail (keep 20 ms, fade), gain to the class loudness target, limit to -1.5 dBTP.
3. **Gate + rank:** run the hard gates, then CLAP reject/rank, keep the best candidate per prompt, write `audio-report.json`. CI fails on any gate; the report lists rejects with reasons.
4. **Loops:** cut to N whole bars (BPM from the contract), 20 to 30 ms equal-power tail-into-head crossfade only if the seam ratio > 0.5, re-measure. Crown percussion layer = scheduled one-shots (woodblock/tom from step 1) on the loop's beat grid via the Web Audio clock: sample-locked, 0 KB extra, no stem generation needed.
5. **Encode:** SFX `libopus -b:a 64k -ac 1 -ar 48000` to `.opus`; music `libopus -b:a 48k..64k`; fallback `.m4a` (AAC 96k music, 48k SFX), only one set downloaded per client. Re-run the gates on the encoded files (peak grows).
6. **Test in browser:** Playwright + `/usr/bin/chromium`: decode every file, assert sample counts, first/last samples, and play each loop through two wraps into an `OfflineAudioContext`, re-running the seam ratio on the rendered buffer. Load short SFX as AudioBuffers, loop music with `loopStart/loopEnd` (not `<audio>`).
7. **Contact reel + sheet:** one concatenated WAV and one spectrogram sheet for the owner's 5-minute pass.
Size budget per client (derived from the measurements above): ~60 SFX x ~4.1 KB = ~250 KB; music 40 s menu + 48 s battle + 2 stingers ~110 s x ~6 KB/s = ~660 KB; total ~0.9 MB, ~0.6 MB headroom. Opus support: Chrome, Firefox and iOS Safari 27 "y"; desktop Safari only from macOS 15.4 (caniuse: partial), hence the m4a fallback. Vorbis has the same Safari 18.4 floor.

## 5. Staleness log
Suno pricing page and v6 (2026-09-09) read today; Suno litigation from Wikipedia (secondary), so labelled, and only the download caps were cross-checked on the primary pricing page. Udio: Wikipedia only (Oct 2025 event), UNVERIFIED. Stability licence text last updated 2024-07-05 (still current per stability.ai/license today); SA3 released 2026-05-16/17. ElevenLabs docs fetched today, undated. AES TD1004 and Audiokinetic loudness pages returned 403, so external game-loudness standards (often cited: -16 LUFS mobile, -23/-24 console) are UNVERIFIED and the targets above are studio-chosen. MusicGen/AudioGen last modified 2023-24, CLAP weights 2023 (I did not survey newer CLAP-class models; UNVERIFIED that none is better). librosa 1.0.0 dated 2024-08-11, pyloudnorm 0.2.0 2026-01-04, ai-edge-litert 2.2.0 2026-08-12.

## NEEDS OWNER
1. **Stability AI Community License registration** at https://stability.ai/community-license (company name, confirm revenue < US$1M) before any SA3 output ships; add "Powered by Stability AI" on the game's about/credits page and keep the license NOTICE in tooling. Do not use gated HF repos without an HF account; the ungated `stable-audio-3-optimized` repo needs none.
2. **ElevenLabs** (only if TRY LATER 7 is triggered): paid Starter+ plan (free is non-commercial) and an API key in `ELEVENLABS_API_KEY` outside the repo.
3. **Google AI Studio API key** (only for the optional Gemini audio second opinion); accept that free-tier prompts may be used to improve Google products.
4. **Safari and Firefox decode check** on real browsers: WebKit/Firefox builds for Playwright install to a global cache (against the repo-only rule), so the owner should open the test page once on an iPhone and a Mac (Safari) and report the loop seam and Opus support. Chromium alone is verified.
5. **One listening pass** of the contact reel (5 minutes) at the M1 gate, plus a decision on the AI-audio disclosure line for Steam.
6. Optional: free RAM (>= 3 GB) or approve running SA3 with the fp32 DiT overnight; on this laptop only the int8 DiT fit.
