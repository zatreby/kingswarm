#!/usr/bin/env bash
# Fetch the CC0 audio packs listed in design/research/assets-audio.md (section 5) into
# assets-src/audio/ (gitignored, on disk not /tmp). Safe to re-run: existing non-empty
# files are kept, downloads land as .part and are renamed only when complete.
# Sources verified 2026-09-30; Kenney URLs carry a version hash and OGA files can vanish,
# so licenses/audio.md records the source URL of every shipped file.
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC=assets-src/audio
OGA=https://opengameart.org/sites/default/files
KENNEY=https://kenney.nl/media/pages/assets
mkdir -p "$SRC"/{kenney,oga,music}

get() { # get <dest> <url>
  local dest=$1 url=$2
  if [[ -s $dest ]]; then echo "have  $dest"; return; fi
  echo "fetch $url"
  curl -fsSL --retry 3 --retry-delay 2 -o "$dest.part" "$url"
  mv "$dest.part" "$dest"
}
unpack() { # unpack <zip> <dir>
  if [[ -d $2 && -n $(ls -A "$2") ]]; then return; fi
  mkdir -p "$2"; unzip -qo "$1" -d "$2"
}

k() { get "$SRC/kenney/$1.zip" "$KENNEY/$2"; unpack "$SRC/kenney/$1.zip" "$SRC/kenney/$1"; }
k impact    impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
k interface interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip
k rpg-audio rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip
k jingles   music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip

o() { get "$SRC/oga/$1" "$OGA/$2"; }
o creature-sfx.zip 80-CC0-creature-SFX_0.zip
o rpg-sfx.zip      80-CC0-RPG-SFX_0.zip
o swishes.zip      swishes.zip
for z in creature-sfx rpg-sfx swishes; do unpack "$SRC/oga/$z.zip" "$SRC/oga/$z"; done

# Music. WAV sources are large (tens of MB) but live on disk only; they never ship.
m() { get "$SRC/music/$1" "$OGA/$1"; }
for f in Loop_The_Old_Tower_Inn.wav Loop_The_Bards_Tale.wav Loop_Minstrel_Dance_0.wav \
         battle_7.mp3 victory.mp3 defeat.mp3 determined_pursuit_loop.wav; do m "$f"; done

echo "done: $(du -sh "$SRC" | cut -f1) in $SRC"
