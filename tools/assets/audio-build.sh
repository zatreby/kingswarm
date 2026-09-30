#!/usr/bin/env bash
# Rebuild public/audio/** (SFX mono 44.1 kHz OGG q3, music stereo OGG q2 at -18 LUFS), src/audio/manifest.ts
# and licenses/audio.md from assets-src/audio (run audio-fetch.sh first). Extra args go to audio-build.mjs
# (e.g. --only throw,capture  |  --sfx  |  --music). Needs ffmpeg with libvorbis and node >= 20. Writes only on disk.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v ffmpeg >/dev/null || { echo "ffmpeg missing" >&2; exit 1; }
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libvorbis || { echo "ffmpeg lacks libvorbis" >&2; exit 1; }
[[ -d assets-src/audio/kenney/impact ]] || { echo "sources missing: run tools/assets/audio-fetch.sh" >&2; exit 1; }
exec node tools/assets/audio-build.mjs "$@"
