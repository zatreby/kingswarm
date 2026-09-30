# Art provenance

Everything shipped under `public/models/` and every procedural shape in `src/render/` is listed here.

## KayKit Medieval Hexagon Pack 1.0 (CC0)

- Author: Kay Lousberg (www.kaylousberg.com). Credit optional; we credit anyway.
- Licence: Creative Commons Zero (CC0 1.0), per `LICENSE.txt` in the source repository.
- Source: https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0
  (commit `84fa4e91af6a88989be7c99e0891cede11f2ca38`, 2024-04-26), sparse checkout of
  `addons/kaykit_medieval_hexagon_pack/Assets/gltf`.
- Downloaded: 2026-09-30 by `tools/assets/fetch-kaykit.sh` into `assets-src/` (gitignored).
- Converted: 2026-09-30 by `tools/assets/build-models.mjs` into `public/models/kit.glb` (257 KB):
  one GLB, shared atlas `hexagons_medieval.png` resized 1024 -> 256 px (PNG), quantized + meshopt.

| Shipped node | Source file | Use |
|---|---|---|
| castle | buildings/blue/building_castle_blue.gltf | Throne |
| home_A, home_B | buildings/blue/building_home_{A,B}_blue.gltf | Hut |
| tower_A | buildings/blue/building_tower_A_blue.gltf | Tower |
| well | buildings/blue/building_well_blue.gltf | Crown (the Well) |
| tree_A, tree_B | decoration/nature/tree_single_{A,B}.gltf | trees obstacle, rim |
| trees_A, trees_B | decoration/nature/trees_{A,B}_small.gltf | rim clumps |
| rock_A..rock_E | decoration/nature/rock_single_{A..E}.gltf | rock obstacle, decor |
| lily, reeds | decoration/nature/waterlily_A.gltf, waterplant_A.gltf | ponds |

The team buildings also read the matching `buildings/red/*_red.gltf` at build time, only to
compute a per-vertex `_TEAM` mask (vertices whose atlas UVs differ between the blue and red
variants). No red geometry is shipped; the renderer tints the masked vertices per owner.

## Procedural (original, this repository)

Island, cliff, water, ground texture, bushes, grass tufts, flowers, flags, capture rings, the
floating crown, turrets, zones, all critters and all Kings are generated in code in `src/render/`.
