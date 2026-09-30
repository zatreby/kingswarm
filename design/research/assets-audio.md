# Kingswarm: free art + audio shortlist (verified 2026-09-30)

All URLs below were HEAD-tested or downloaded with curl on 2026-09-30. Everything in the shortlist is CC0 except where marked.
UNVERIFIED = could not confirm; treat as a risk, not a fact.

## Bottom line for Kingswarm
- **Art style = KayKit (Kay Lousberg), CC0.** Heroes: Adventurers pack (Knight, Mage, Barbarian, Rogue, Rogue_Hooded: 3.6 MB GLB each, 76 embedded clips incl. Idle, Running_A, Throw, Hit_A, Death_A, Cheer, Spellcast_*). Arena: Medieval Hexagon pack: buildings in 4 team colors (blue/red/green/yellow), plus scaffolding/destroyed/stage states, flags, trees, rocks, hills, mountains, clouds. One 1024x1024 gradient atlas shared by everything, so the whole scene is 1 to 2 draw-call materials.
- **Huts, throne, tower map 1:1 to existing files:** hut = `building_home_A/B_<team>` (1011 tris) with `building_stage_A/B/C` + `building_scaffolding` as capture progress; throne = `building_castle_<team>` (5659 tris); tower = `building_tower_A_<team>` (2138 tris); Crown point = `building_church`/`well` or a custom prop; `flag_<team>` = capture marker.
- **Critters must NOT be 100+ SkinnedMeshes.** three.js has no native instanced skinning (forum threads confirm). Use static-pose InstancedMesh + procedural hop/squash, or bake clips to vertex-animation textures (`three-vat`, MIT, v4.2.0, but 0 stars and created weeks ago: prototype-grade). Critter model candidate: Kenney `character-orc` (374 tris, 200 KB) vs `character-human` (465 tris) as the two teams; fallback = procedural blob mesh. Both CC0.
- **Do a 1-hour "look test" before committing:** render KayKit hero + hex tile + Kenney orc side by side. Style compatibility of Kenney chibis with KayKit was NOT visually verified.
- **Sound palette = ONE composer for music + Kenney/rubberduck/artisticdude foley for SFX.** Music: RandomMind's CC0 "Medieval:" set (menu, lobby, battle, victory, defeat all one voice) + Emma_MA "Determined Pursuit" for the Crown climax. SFX: Kenney Impact + RPG Audio + Interface (chunky real foley), rubberduck 80 CC0 creature SFX (10x `cute_*`, 5x `hurt_*`) for critter squeaks and hero hurt, artisticdude swishes for the throw.
- **Do not lean on ZzFX/jsfxr:** the owner explicitly disliked "beep" SFX, and sfxr-style output is exactly that. Use procedural audio only for pitch-varied layers, noise whooshes and UI sweeteners.
- **License trap: Quaternius changed terms.** quaternius.com/license.html (updated 2026-08-28) now shows a custom "Quaternius Asset License v1.0" (free commercial use, no credit, but no redistribution of the assets themselves, incl. bundled in a repo/pack). Pack pages still say "CC0" and the OGA/poly.pizza copies are labeled CC0. Prefer KayKit + Kenney for anything committed to a public repo; if Quaternius is used, snapshot the source page + date in the repo.
- **Ship audio as OGG Vorbis in Web Audio buffers** (Safari supports it since 18.4 per caniuse data; iOS same). Decode short SFX to AudioBuffers, loop music by AudioBufferSourceNode loop points (not `<audio>`, which gaps). Do not bother with audiosprite (last release 2022, no npm license field).
- **Optimize with gltf-transform (MIT, v4.5.1) + ffmpeg (already installed).** Strip unused clips (needs a 10-line script; no CLI command), downsample atlas to 256 or 128 px (KayKit README says 128 is supported), meshopt-compress. Expected hero size well under 1 MB (UNVERIFIED, not run because installs were forbidden).
- **Scale note:** measured bounding boxes: hex tile 2.0 x 2.31 wide, home 0.79 x 0.93 tall, castle 1.98 x 3.98 tall, Knight body ~1.3 (+head) tall, Kenney orc 0.78 tall. Scale heroes to ~0.35 and critters to ~0.2 to sit on hex tiles.

## 1. 3D art shortlist
| Pack | License (verified where) | Format / size | Use |
|---|---|---|---|
| KayKit Adventurers 1.0 | CC0, `LICENSE.txt` in repo, credit optional | GLB + FBX; 5 characters x 3.6 MB; weapons/shields as GLTF+bin (25+ props, 3-47 KB each) | 3 heroes (Knight/Mage/Barbarian) + Rogue; sword, staff, wand, shield_*, spellbook, smokebomb (ability VFX props) |
| KayKit Medieval Hexagon 1.0 | CC0, `LICENSE.txt`, "credit not mandatory" | glTF (.gltf + .bin + shared `hexagons_medieval.png` 1024^2); repo total 29 MB; buildings 2.4 MB per color | tiles, 18 buildings x 4 colors, walls/fences, 27 props, 43 nature pieces |
| KayKit Skeletons 1.0 | CC0 | 4 GLB (Minion, Warrior, Rogue, Mage) 4.8 MB each, 90+ clips, same style | optional neutral "creeps" / alt critter; same atlas style as Adventurers |
| Kenney Mini Dungeon 2.0 | CC0 (`License.txt` in zip, kenney.nl/support) | GLB/FBX/OBJ, zip 1.7 MB; `character-orc` 200 KB / 374 tris, `character-human` 218 KB / 465 tris, 32 clips (idle, walk, sprint, die, attack-melee, emote) | swarm critters (two teams), also chest, coin, banner, potion, trophy in Mini Arena (zip 0.7 MB) |
| Kenney Particle Pack | CC0 | 80 PNG 512x512, zip 15 MB | VFX textures (smoke, spark, star, magic) for capture pops and impacts |
| Kenney Fantasy UI Borders | CC0 | 140 PNG, zip 0.36 MB | HUD panels/buttons |
| Kenney Castle Kit 2.0 | CC0 | 76 GLB, zip 2.2 MB: siege engines, flags, walls, towers | optional: catapult/trebuchet as Crown-point set dressing, different look than KayKit |

**Skip / caveats**
- KayKit itch.io pages list a newer Adventurers tier (Ranger free; Engineer/Druid/Barbarian_Large in the paid EXTRA) but the GitHub repo is v1.0 (Knight, Barbarian, Mage, Rogue, Rogue_Hooded). itch downloads need a browser session (UNVERIFIED whether scriptable); use GitHub. Hexagon "units" are EXTRA (paid) only.
- KayKit "Character Animations" pack (161 clips, free tier 150+, rigs Rig_Medium/Rig_Large) is itch-only, not needed: each GLB already embeds 76 clips.
- Quaternius Cute Animated Monsters (21 creatures, 10 MB) on OGA is CC0 but **FBX only** (`opengameart.org/sites/default/files/cute_animated_monsters_-_aug_2020.zip`) and each has its own texture; quaternius.com hosts glTF only via a Google Drive folder (not curl-friendly). poly.pizza serves single GLBs at `https://static.poly.pizza/<uuid>.glb` (tested: Mushnub 149 KB, 3072 tris, 9 clips incl. Walk/Death/Dance) but the uuid must be scraped from `poly.pizza/m/<id>`, no public API (api.poly.pizza returns 401). 3k tris per critter is too heavy for a swarm.
- Quaternius Medieval Village MegaKit standard (OGA `medieval_village_megakitstandard.zip`, 100 MB, CC0 per OGA) and Fantasy Props (74 MB): huge, modular-wall oriented, wrong genre for a diorama; skip.

## 2. Audio shortlist
### Music (all CC0, OpenGameArt, HEAD-tested 200; author RandomMind unless noted)
| Slot | Track | Source file (base https://opengameart.org/sites/default/files/) | Length / size | Notes |
|---|---|---|---|---|
| Menu | Medieval: The Old Tower Inn | `Loop_The_Old_Tower_Inn.wav` (8.8 MB) | 50 s loop; OGG q3 = 680 KB | -17.4 LUFS, playful tavern feel |
| Lobby / vs-screen | Medieval: The Bard's Tale | `Loop_The_Bards_Tale.wav` (10.2 MB) | 58 s loop; OGG 756 KB | -12 LUFS (needs level match) |
| Early match | Medieval: Minstrel Dance | `Loop_Minstrel_Dance_0.wav` (19.9 MB) | loop | lively; not duration-tested |
| Battle | Medieval: Battle | `battle_7.mp3` (3.2 MB) | 79 s, not a loop; -13.5 LUFS | crossfade-loop it; a match is ~150 s |
| Crown climax (1:30+) | Determined Pursuit, Emma_MA | `determined_pursuit_loop.wav` (19 MB) | 108 s loop; OGG q3 = 1.49 MB, Opus 96k = 1.19 MB | frantic strings/horns; authors describe it as "hectic race against the clock" |
| Win / lose | Medieval: Victory / Defeat Theme | `victory.mp3` (0.5 MB, 32 s), `defeat.mp3` (0.7 MB, 45 s) (WAVs also exist) | | result screen music |
Total music payload after OGG: ~5 MB. Page URLs: opengameart.org/content/medieval-the-old-tower-inn, ...-the-bards-tale, ...medieval-minstrel-dance, ...medieval-battle, ...determined-pursuit-epic-orchestra-loop, ...medieval-victory-theme, ...medieval-defeat-theme.
Other CC0 options seen: Juhani Junkala "Epic Boss Battle" (OGA `boss-battle-music`, 21.8 MB WAV; NOTE his paid 400-loop pack is CC-BY 4.0), Joth "Fantasy Orchestral Theme" (3.8 MB MP3, not a loop), StarNinjas "Abandoned Castle" (0.4 MB, spooky). CC-BY (attribution needed, avoid unless needed): peastman "Battle Music" (CC-BY 3.0), spuispuin "Won!" jingle (CC-BY 4.0), Gregor crowd cheering pack (CC-BY 4.0, 19.6 MB), NorthFantasyMusic ambience (CC-BY 4.0).

### SFX (all CC0)
| Need | Source | What to use |
|---|---|---|
| Throw whoosh (hold-to-fire spam) | OGA artisticdude Swishes (`swishes.zip` 385 KB, 13 WAV of 0.07-0.20 s) | swish-1..13, random pick + +/-8% pitch |
| Splat / impact | Kenney Impact Sounds (784 KB, 130 OGG, 5 variants each): `impactSoft_*`, `impactPunch_*`, `impactPlank_*`, `impactWood_*`, `impactBell_heavy_*` | critter lands, hut hit, throne hit |
| Critter squeak / chatter | rubberduck 80 CC0 creature SFX (`80-CC0-creature-SFX_0.zip`, 1.9 MB): `cute_01..10` (0.4-0.6 s), `eat_*`, `burble_*`, `ooh` | swarm chatter (rate-limited, pitch-varied) |
| Hero hurt/death | same pack `hurt_01..05`, `scream_*`; rubberduck RPG SFX `creature_die_01`, `creature_hurt_*` | cartoon-safe, not gory |
| Ability casts | rubberduck 80 CC0 RPG SFX (1.8 MB): `spell_01/02`, `spell_fire_01..07`, `blade_*`, `chain_*` | Mage/Barbarian/Rogue abilities |
| Capture / coins / fanfare | Kenney RPG Audio (945 KB, 52 OGG): `handleCoins*`, `doorOpen_*`, `metalClick`; rubberduck `item_coins_*`, `item_gem_*`; Kenney Music Jingles (1.2 MB, 85 OGG: 8-Bit, Hit, Pizzicato, Sax, Steel x17 each) | capture = Steel/Pizzicato jingle + coins layer |
| UI clicks | Kenney Interface Sounds (816 KB, 100 OGG: click, confirmation, select, toggle, back, error, tick, pluck) | menus/HUD |
| Announcer (optional) | Kenney Voiceover Pack (1.8 MB, Male/Female: ready, go, time_over, you_win, you_lose, final_round; credit Jeffrey M. Smith / Giselle listed in `Credits.txt`, license file says CC0) | modern-arcade tone, may clash with fantasy |
| Footsteps | Kenney Impact `footstep_grass_*` (5), RPG Audio `footstep00..09` | hero dash/run |
**Gaps:** real crowd chatter (only CC-BY found), gore-free hero grunts with personality. **Freesound:** CC0 filter exists, but originals need a login; only `cdn.freesound.org/previews/<a>/<id>_<user>-lq.mp3|ogg` are anonymous (low-quality). Two orchestral fanfares I checked there (Sheyvan 470083, humanoide9000 466133) are CC-BY 4.0, not CC0.

## 3. Fonts (SIL OFL 1.1, verified in `google/fonts` METADATA.pb + OFL.txt)
- **Title: Lilita One** (Juan Montoreano): `raw.githubusercontent.com/google/fonts/main/ofl/lilitaone/LilitaOne-Regular.ttf` (28 KB). Chunky, playful, one weight. Alt: Titan One (55 KB), MedievalSharp (`ofl/medievalsharp/MedievalSharp.ttf`) for lore text, Cinzel Decorative for the Crown banner.
- **HUD/body: Nunito** variable (`ofl/nunito/Nunito[wght].ttf`, 277 KB, subset it) or Fredoka variable (159 KB, rounder). npm: `@fontsource/lilita-one` 5.3.0, `@fontsource-variable/nunito` 5.3.0 (both OFL-1.1) give woff2 for Vite with no CDN. Luckiest Guy is Apache (not under /ofl); skipped.

## 4. Procedural audio and tooling
| Tool | License | Verdict |
|---|---|---|
| ZzFX 1.3.2 | MIT (npm + GitHub, ~1 KB core) | good for pitch-varied UI sweeteners and "pop" layers; alone it is the beep sound the owner rejected |
| jsfxr 1.4.1 | Unlicense on GitHub (npm license field empty); tool, not runtime | use offline to author 1-2 stingers; same beep caveat |
| Tone.js 15.1.22 | MIT, 5.4 MB unpacked (bundle size UNVERIFIED) | only worth it for adaptive music layering/transport; raw Web Audio GainNodes crossfade is enough for 5 tracks |
| Howler 2.2.4 | MIT | optional wrapper for iOS unlock + pooling; not required |
| gltf-transform CLI 4.5.1 | MIT; commands `optimize`, `meshopt`, `draco`, `resample`, `prune`, `dedup`, `weld`, `palette`, `webp`, `uastc`, `etc1s` | `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress webp`; no command deletes animations, script it via `@gltf-transform/core` (`doc.getRoot().listAnimations()` then `.dispose()` for clips you drop) |
| gltfpack / meshoptimizer 1.3.0 | MIT | alternative single binary; three needs `MeshoptDecoder` set on GLTFLoader |
| FBX2glTF (npm `fbx2gltf` 0.9.7-p1, BSD-3) | | only if you take Quaternius FBX; Kenney/KayKit already ship GLB/glTF |
| audiosprite 0.7.2 | MIT on GitHub, last push 2022 | skip |
| ffmpeg | installed here; libvorbis, libopus, libmp3lame, aac present | tested: 108 s loop WAV 18.6 MB -> OGG q3 1.49 MB, Opus 96k 1.19 MB |

## 5. Exact download commands (tested end to end 2026-09-30, 1m14s, 175 MB of raw sources)
Run from repo root. Raw sources go to `assets-src/` (add to .gitignore); commit only converted output plus a LICENSES.md. Kenney zip URLs contain a version hash and OGA files can be removed, so after the first successful pull, archive the converted files yourself.
```bash
set -euo pipefail
SRC=assets-src; mkdir -p $SRC/{kaykit,kenney,oga,fonts}
OGA=https://opengameart.org/sites/default/files; KENNEY=https://kenney.nl/media/pages/assets
# KayKit via sparse git (only glTF folders; full repos are 24 MB + 29 MB)
cd $SRC/kaykit
git clone -q --depth 1 --filter=blob:none --sparse https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0.git adv
(cd adv && git sparse-checkout set addons/kaykit_character_pack_adventures/Characters/gltf addons/kaykit_character_pack_adventures/Assets/gltf)
git clone -q --depth 1 --filter=blob:none --sparse https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0.git hex
(cd hex && git sparse-checkout set addons/kaykit_medieval_hexagon_pack/Assets/gltf)
cd ../..
k(){ curl -fsSL -o $SRC/kenney/$1.zip $KENNEY/$2; unzip -qo $SRC/kenney/$1.zip -d $SRC/kenney/$1; }
k mini-dungeon mini-dungeon/6cd72dc849-1785314274/kenney_mini-dungeon.zip
k impact       impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
k interface    interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip
k rpg-audio    rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip
k jingles      music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip
k particles    particle-pack/f8fe0f8cb8-1677578741/kenney_particle-pack.zip
o(){ curl -fsSL -o "$SRC/oga/$1" "$OGA/$2"; }
o creature-sfx.zip 80-CC0-creature-SFX_0.zip; o rpg-sfx.zip 80-CC0-RPG-SFX_0.zip; o swishes.zip swishes.zip
for f in Loop_The_Old_Tower_Inn.wav Loop_The_Bards_Tale.wav Loop_Minstrel_Dance_0.wav battle_7.mp3 victory.mp3 defeat.mp3 determined_pursuit_loop.wav; do o $f $f; done
for z in creature-sfx rpg-sfx swishes; do unzip -qo $SRC/oga/$z.zip -d $SRC/oga/$z; done
G=https://raw.githubusercontent.com/google/fonts/main/ofl
curl -fsSL -o $SRC/fonts/LilitaOne-Regular.ttf $G/lilitaone/LilitaOne-Regular.ttf
curl -fsSL -o $SRC/fonts/Nunito.ttf "$G/nunito/Nunito%5Bwght%5D.ttf"
curl -fsSL -o $SRC/fonts/OFL-lilitaone.txt $G/lilitaone/OFL.txt
```
Conversion (ffmpeg tested; gltf-transform commands from docs, NOT run):
```bash
# music: normalize ~-18 LUFS, OGG q4 (measured -17.3 LUFS out, 780 KB for the 50 s menu loop)
ffmpeg -y -i $SRC/oga/Loop_The_Old_Tower_Inn.wav -af loudnorm=I=-18:TP=-1.5:LRA=9 -ar 44100 -c:a libvorbis -q:a 4 public/audio/menu.ogg
# sfx: mono, trim leading silence, OGG q3 (a 0.13 s swish becomes ~5 KB)
ffmpeg -y -i in.wav -ac 1 -ar 44100 -af silenceremove=start_periods=1:start_threshold=-50dB -c:a libvorbis -q:a 3 out.ogg
# models
npx @gltf-transform/cli optimize Knight.glb public/models/knight.glb --compress meshopt --texture-compress webp
```
Gapless loops: Vorbis adds encoder delay; loop with `AudioBufferSourceNode.loopStart/loopEnd` and trim or test the seam.

## 6. Provenance to keep in `LICENSES.md`
KayKit (Kay Lousberg, kaylousberg.com, CC0), Kenney (kenney.nl, CC0), RandomMind + Emma_MA + artisticdude + rubberduck (OpenGameArt, CC0), Google Fonts (OFL, ship OFL.txt with the fonts). Credit is optional for all CC0 items but costs nothing; add a credits screen line. CC0 already-downloaded copies stay CC0 even if an author changes terms later, so record download date + source URL per file.

## 7. Sources
- https://github.com/KayKit-Game-Assets (LICENSE.txt in each repo: CC0); https://kaylousberg.itch.io/kaykit-adventurers ; https://kaylousberg.itch.io/kaykit-medieval-hexagon ; https://kaylousberg.itch.io/kaykit-character-animations
- https://kenney.nl/support (CC0 statement); https://kenney.nl/assets/mini-dungeon ; /castle-kit ; /impact-sounds ; /interface-sounds ; /rpg-audio ; /music-jingles ; /particle-pack ; /voiceover-pack
- https://quaternius.com/license.html (QAL v1.0, updated 2026-08-28); https://opengameart.org/content/textured-cute-monster-pack ; https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6
- https://opengameart.org/users/randommind ; https://opengameart.org/content/determined-pursuit-epic-orchestra-loop ; https://opengameart.org/content/80-cc0-creature-sfx ; /80-cc0-rpg-sfx ; /swishes-sound-pack ; https://opengameart.org/content/cc0-fantasy-music-sounds (curated list)
- https://github.com/google/fonts/tree/main/ofl/lilitaone ; https://gltf-transform.dev/cli ; https://github.com/MikeFernandez-Pro/three-vat ; https://discourse.threejs.org/t/instancedmesh-animations-like-with-skinnedmesh/12388 ; https://caniuse.com/ogg-vorbis ; https://github.com/KilledByAPixel/ZzFX ; https://github.com/chr15m/jsfxr
