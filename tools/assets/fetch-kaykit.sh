#!/usr/bin/env bash
# Download the raw KayKit Medieval Hexagon pack (CC0) into assets-src/ (gitignored).
# Tested command from design/research/assets-audio.md §5. Run from the repo root.
set -euo pipefail
SRC=assets-src/kaykit
mkdir -p "$SRC"
if [ ! -d "$SRC/hex" ]; then
  git clone -q --depth 1 --filter=blob:none --sparse \
    https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0.git "$SRC/hex"
fi
(cd "$SRC/hex" && git sparse-checkout set addons/kaykit_medieval_hexagon_pack/Assets/gltf && git log -1 --format='KayKit hex commit %H (%cd)')
