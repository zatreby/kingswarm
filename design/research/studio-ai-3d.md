# Studio research: 3D assets for an AI-run Three.js pipeline (as of 2026-09-30)

Scope: stylized low-poly props, characters, buildings and VFX for Kingswarm, authored by agents on an Arch laptop (Iris Xe, 8 cores, 7 GB RAM, no NVIDIA), under 5 MB total download.
Tags: [MEASURED] = I ran it here today. [SRC] = read in a primary source (docs, changelog, LICENSE, registry) today. UNVERIFIED = not confirmed.
Limits of this report: the WebSearch quota was exhausted mid-session, so I did NOT get independent side-by-side quality reviews of the AI-3D services. Quality claims about them below come from vendor docs' own parameters, not from looking at outputs. Tripo, Sloyd and Rodin details are thin for that reason (Tripo pricing 403, sloyd.ai unreachable).
Builds on `design/research/assets-audio.md` (KayKit/Kenney/Quaternius licenses) and `tech-rendering.md` (critters procedural, heroes glTF); not repeated here.

## Bottom line for the studio
1. **ADOPT NOW: one pipeline = "CC0 kit bodies + code-built everything else + one shared toon material", not "one generator".** Cohesion comes from one palette, one toon ramp, one outline, one light rig (ART.md), so bodies from different sources look like one game. Source of a mesh matters less than passing it through that material.
2. **ADOPT NOW: Kings and rivals = KayKit Adventurers/Skeletons GLBs (CC0) + code-built headgear/props + palette tint.** [MEASURED] Knight.glb 3.66 MB (76 clips, 1024 px texture) becomes **285 KB** with 6 clips kept + `optimize --compress meshopt --texture-compress webp --texture-size 256`. 3 Kings + Rogue + a Skeleton boss body ~ 1.4 MB. 6 rival variants reuse those bodies (crown, hat, cape, tint built in code), so they cost ~0 KB extra.
3. **ADOPT NOW: critters, trees/rocks fill-ins, VFX meshes, ownership rings/flags = generated in code at load time** (icosphere/lathe + vertex displacement + `mergeGeometries`, vertex colors, eyes as two tiny spheres). Zero download bytes, perfectly on-palette, and already the plan in tech-rendering.md. Hard = faceted (`flatShading`), alive = smooth blobs, per ART.md.
4. **ADOPT NOW: gltf-transform 4.5.1 (CLI, MIT) as the only optimizer,** run through a repo script (`tools/assets/build-models.mjs` already does dedup/prune/weld/quantize/meshopt/webp; extend it, do not add tools). Add a clip-strip step (no CLI command; 10 lines with `@gltf-transform/core`, [MEASURED] works). Animations were ~85% of a KayKit hero's bytes.
5. **ADOPT NOW: headless turntable QA,** a contact sheet of 8 angles rendered by Three.js in system Chromium, read with the Read tool. [MEASURED] 1.1 s wall on the Iris Xe (ANGLE/EGL), 1.8 s on SwiftShader, 1024x512 PNG of ~165 KB. Every new or changed mesh gets one sheet before it merges. Reference script at `/tmp/claude-1000/-home-turbo-creative-game/42a0f085-49e4-4b98-b212-79e3f92ccf72/scratchpad/gt/turntable.mjs` + `site/index.html` (lead: copy into `tools/assets/turntable.mjs`; it uses repo `three` + `@playwright/test`, no new deps).
6. **TRY LATER (only when a specific need appears): headless Blender via the pip `bpy` 5.2.2 wheel** for booleans/bevels/auto-weights/Geometry Nodes on hero accessories. [MEASURED] works on Arch, but only on exactly Python 3.13 (system is 3.14), ~1 GB venv, ~9 min first install. Not needed for the first 80% of assets.
7. **TRY LATER: three-bvh-csg 0.0.18 / manifold-3d 3.5.4 for build-time booleans** (arched doors, windows) if a building needs them. Build-time only, never shipped. Prefer manifold-3d if watertightness matters.
8. **SKIP for v1: paid AI text/image-to-3D (Meshy, Tripo, Rodin).** Meshy's own docs show why: PBR-textured output, "Smart Topology" caps at 15,000 triangles (a critter needs ~300), auto-rig is humanoid-only, API needs a paid plan, free tier output is CC BY 4.0. Nothing here gives a *cohesive* set of 30+ pieces. Revisit only for a one-off hero prop if the owner buys a plan; `meshy-cli` (MIT, official) is the right tool then.
9. **SKIP: local open-weights 3D generators (TRELLIS.2, Hunyuan3D 2.1).** Need NVIDIA 24 GB / 10-29 GB VRAM; nothing runs on Iris Xe + 7 GB RAM. Hunyuan's license also excludes EU/UK/South Korea. Say so once, stop evaluating them.
10. **SKIP: SDF/marching-cubes meshing, Blender MCP, Mixamo.** SDF gives high-tri smooth surfaces against the faceted look. Blender MCP needs a running Blender GUI plus socket addon; `bpy` in a script is strictly simpler (CLI > MCP). Mixamo needs an Adobe login and KayKit already ships rigs with 76 clips.
11. **Flag to lead: audio, not 3D, is the budget risk.** assets-audio.md sizes music at ~5 MB after OGG. 3D total here is ~2 MB, code 0.16 MB gz, fonts 0.045 MB. Music must be trimmed or lazy-loaded after first interaction to keep "under 5 MB initial".

## The recommended pipeline (budget for the stated content list)
| Content | Method | Size |
|---|---|---|
| 3 Kings (Knight, Mage, Barbarian) | KayKit GLB, 6-8 clips kept (Idle, Running_A, Throw, Hit_A, Death_A, Cheer + 2 ability casts) | ~285 KB each [MEASURED for Knight] |
| 6 rival variants | Same bodies + Rogue/Skeleton_Warrior; per-rival crown/hat/cape/props built in code, attached to head/back bones; tint via palette. Boss King Mora = Skeleton_Warrior + gold crown | Rogue + Skeleton ~ 0.6 MB |
| 5 critter kinds | Code: blob body per kind, distinct silhouette, tuft (Red) vs round top (Blue), big eyes; one InstancedMesh per kind, hop/squash in shader | 0 KB |
| 4 buildings x 3 ownership states | Existing `kit.glb` (263 KB, 256 px atlas, `_TEAM` per-vertex mask, tinted neutral/blue/red at runtime); scaffolding/stage models for capture progress | done, 263 KB |
| Trees, rocks, props | Kit trees/rocks already in kit.glb; extras in code (bush, mushroom, stump) | ~0 |
| VFX meshes (splat rings, capture rings, crown glow, shockwave, flags) | Code: lathe/ring/cone geometry, additive toon materials, Kenney particle PNGs only if a texture is needed | ~0 |
| **Total 3D** | | **~1.6-2.0 MB** |
Tri counts [MEASURED]: optimized Knight = 6,834 tris, 11 draw calls; fine for 2-4 skinned heroes, never for crowds. Rig-sharing trick if bytes get tight: the four Adventurers share one rig, so keep 6 clips in ONE animation-only GLB and drop clips from the other bodies (saves ~140 KB x 3; UNVERIFIED that bone names match, check with `gltf-transform inspect`).
Distinctiveness note: KayKit alone reads as "generic KayKit jam game". Identity must come from what only we build: the critters and their eyes, the rival headgear, the palette remap to ART.md colors, the inverted-hull outline, the toon ramp. Do the look test in assets-audio.md (hero + hex tile + critter in the final material) before any purchase decision.

## Evidence 1: procedural in code
- Three.js primitives + custom `BufferGeometry` + `BufferGeometryUtils.mergeGeometries` are already in the shipped 159 kB gz bundle (tech-rendering.md [MEASURED]). Runtime cost of generation for ~10 shapes is negligible; no asset download, no license.
- three-bvh-csg 0.0.18, MIT, published 2026-02-17, peers `three >=0.179`, `three-mesh-bvh >=0.9.7`; repo pushed 2026-09-27, 949 stars, 48 open issues [SRC: npm + GitHub API]. Version 0.0.x = API may break; pin exact. Use at build time only.
- manifold-3d 3.5.4, Apache-2.0, published 2026-09-25, WASM, 2.8 MB unpacked [SRC: npm]. Guaranteed-manifold booleans; heavier, so build-time bake to GLB only.
- Also current: three 0.186.1 (2026-09-24), three-mesh-bvh 0.9.15 (2026-09-09), meshoptimizer 1.3.0 (2026-09-25) [SRC: npm registry].
- Marching cubes / SDF: SKIP for props (smooth, high tri count, needs decimation to look faceted, which is what code primitives give directly).

## Evidence 2: Blender headless
- PyPI `bpy` **5.2.2** (2026-09-15), GPL-3.0, `requires_python ==3.13.*`; also 5.2.1 (2026-08-25), 5.2.0 (2026-07-14); LTS line 4.5.14 (2026-09-15, cp311 only) [SRC: pypi.org/pypi/bpy/json]. manylinux_2_28 x86_64 wheel = **402 MB**.
- [MEASURED] `uv venv --python 3.13` (uv 0.12.13 downloads CPython 3.13.15) + `uv pip install bpy==5.2.2`: works, **~9 min** on this connection, **958 MB** venv. Script test: `bpy 5.2.2 LTS` on Python 3.13.15, icosphere -> Decimate modifier (40 tris) -> flat shade -> GeometryNodeTree creation OK -> glTF export 5 KB GLB, 14 s cold start. Automatic weights (`parent_set(type='ARMATURE_AUTO')`) on a 2-bone armature exported a 21 KB skinned GLB (weight quality NOT inspected).
- **Draco and meshopt export are unavailable in the wheel** (`libbf_intern_draco_bridge.so` / meshopt bridge missing, [MEASURED] error log). Irrelevant: compress with gltf-transform afterwards.
- System Python 3.14.6 cannot install the wheel. Use uv with `UV_PYTHON_INSTALL_DIR` and `UV_CACHE_DIR` inside the repo dir and gitignore it (`.venv-bpy/`, ~1 GB). Alternative: portable tarball `blender-5.2.2-linux-x64.tar.xz`, 383 MB [SRC: download.blender.org HEAD]; no Python-version constraint, run `blender -b -P script.py`. Wheel is easier for agents (plain Python); tarball is the fallback if uv/3.13 is a problem. Software rendering of Blender is not needed: we render previews with Three.js, not Cycles.
- Verdict: capability confirmed, cost high (1 GB, 9 min), so on demand only. Anything doable with Three primitives + gltf-transform should not go through Blender.

## Evidence 3: AI 3D services and models
| Service / model | Facts (source) | Fit for low-poly toy game |
|---|---|---|
| **Meshy** (meshy-7.1 = `latest`, Sept 2026) | Changelog: 7.1 adds "higher geometry detail", Meshy 5 retired, Smart Topology (Aug 2026) cleaner topology, 100-15,000 faces; old `lowpoly` model deprecated. Params: `target_polycount` 100-300k, `topology` quad/triangle, `pose_mode` a/t. Rigging: humanoid-only, textured only, GLB/FBX, walk+run included, 5 credits. Text-to-3D full chain ~30 credits, ~7 min. Free: 100 credits/mo, **CC BY 4.0 (attribution)**, **API on Pro and up**; paid = exclusive ownership. Official MIT `meshy-cli` 0.4.0 (2026-09-23, Node >=22.12, JSON output, `MESHY_API_KEY`) and `@meshy-ai/meshy-mcp-server` 0.5.2. [SRC: docs.meshy.ai changelog/text-to-3d/rigging, meshy.ai/pricing, npm] | Best tooling of the group, but output is PBR-textured realistic-leaning meshes; you would still retopo/bake to our palette. Critters are non-humanoid so no rig. ~3 assets/month free. **SKIP v1.** |
| **Tripo** | Docs mention text/image-to-model, rig, animate, stylize (low-poly), face-limit "smart low-poly", credits, free credits for new users, MCP (VAST-AI `tripo-mcp`, MIT, alpha, needs Blender addon). pricing/terms page returned 403. [SRC partial] | Same class as Meshy. Prices, license, quality UNVERIFIED. |
| **Rodin / Hyper3D** | Free tier: generate free, pay $1.50/credit to confirm; Creator $30/mo (~60 models, smart low-poly); **API only on Business $120/mo**; free users have "limited commercial rights". [SRC: hyper3d.ai/pricing] | Expensive for API. **SKIP.** |
| **Sloyd** (parametric props) | Site unreachable from here; npm `@sloyd/api` 0.0.17 last published 2025-06-22, `@sloyd/types` 0.0.29 2025-10-01. Pricing, license, current status UNVERIFIED. | Parametric generators would suit cohesive props, but unverified; do not plan around it. |
| **TRELLIS.2** (Microsoft) | 4B params, MIT, needs NVIDIA GPU >=24 GB, tested A100/H100, Linux; PBR GLB out; repo pushed 2026-07-10. [SRC: github] | No local run possible here. |
| **Hunyuan3D 2.1** (Tencent) | 10 GB VRAM shape / 21 GB texture / 29 GB both; last push 2025-10-17; **license does not apply in EU, UK, South Korea**, no use of outputs to train other models, 1M MAU cap [SRC: repo LICENSE]. Newer `Hunyuan3D-Buffalo1.0` (paper 2026-08-05): weights/license not stated on repo page, UNVERIFIED. | Local: no. License: risky for a public web game. **SKIP.** |
| Local CPU/iGPU generation | No source found for any of the above running on CPU/iGPU; all list CUDA/VRAM requirements. Conclusion: not feasible on this laptop. | Cloud only, needs owner account. |
Staleness: everything in this table is from Aug-Sep 2026 docs except Hunyuan 2.1 (Oct 2025, treated as possibly stale; a 2.5/3.x line was not found on the repo).

## Evidence 4: CC0 kits and modification
- Licenses and file details are in assets-audio.md (verified 2026-09-30): KayKit (CC0, GitHub), Kenney (CC0), **Quaternius now under a custom no-redistribution license (updated 2026-08-28), avoid committing it**.
- [MEASURED] KayKit Adventurers `Knight.glb` (raw GitHub path `addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb`): 3,659,532 bytes, generator Khronos Blender I/O 1.7.33, 76 clips, one 1024x1024 texture, 20,856 render vertices in bind pose.
- Modify by code, not by hand: attach crowns/hats to the head bone (`SkeletonUtils.clone` + `bone.add(mesh)`), swap palette rows in the atlas texture at build time (`sharp`), tint via material color/vertex color. The existing `build-models.mjs` `_TEAM` mask approach for buildings is the right model for every team-dependent mesh.

## Evidence 5: optimization toolchain (gltf-transform 4.5.1, 2026-09-28) [MEASURED on Knight.glb]
| Step | Result |
|---|---|
| original | 3.66 MB |
| strip to 6 clips (custom script) | 2.52 MB |
| + `optimize --compress meshopt --texture-compress webp --texture-size 256` | **284.9 KB** |
| same with `--compress draco --texture-size 128` | 272.9 KB |
| all 76 clips kept, meshopt + webp 128 | 2.01 MB |
- Texture is only ~2 KB after resize (gradient atlas); geometry + animation are the bytes. Keep meshopt (three's `MeshoptDecoder` is what `assets.ts` already uses; Draco needs a separate WASM decoder, extra shipped bytes for 12 KB savings).
- CLI commands confirmed [SRC: gltf-transform.dev/cli]: `inspect`, `validate`, `optimize`, `dedup`, `prune`, `weld`, `simplify`, `meshopt`, `draco`, `resize`, `webp`, `etc1s`, `uastc`, `instance`, `join`, `resample`, `sparse`. `sharp` is needed for textures; KTX2 (`etc1s`/`uastc`) needs the `toktx` binary from KTX-Software (latest v4.4.2, 2025-10-04) which is **not installed here**. KTX2 only saves GPU memory at these atlas sizes; skip it. WebP textures loaded fine in Three (`EXT_texture_webp`) [MEASURED].
- Do not `simplify` characters (breaks skinning silhouettes); use it on props only.

## Evidence 6: rigging and animation for 2-3 heroes
- Best: use KayKit's existing rig and 76 clips (no rigging at all). Mixamo needs an Adobe account (NEEDS OWNER if ever wanted) and its clips do not fit a chibi rig without retargeting.
- Custom-body fallback: Blender `bpy` armature + automatic weights (works, see above), or Meshy rig 5 credits for a *humanoid* only. Not needed for 3 Kings.
- Critters: no skeleton; procedural hop/squash in shader (tech-rendering.md). GPU instanced skinning does not exist in three.

## Evidence 7: headless visual QA [MEASURED]
- Loop: Node http server serves `/three` from repo `node_modules/three` and a tiny `index.html` (importmap, GLTFLoader + MeshoptDecoder, toon-ish lighting, 8 cameras around the bounding box, scissor viewports into one 1024x512 canvas, reports triangle count, bounding size, draw calls, GPU string). Playwright launches `/usr/bin/chromium` with `--use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist` (real Iris Xe: "ANGLE (Intel, Mesa Intel(R) Iris(R) Xe Graphics (TGL GT2))") or `--use-angle=swiftshader --enable-unsafe-swiftshader` for reproducible pixels. Then `Read` the PNG.
- What I saw in the Knight sheet: helmet, shield and sword, red cape and small face read cleanly from all 8 angles; the sheet also exposed that the bind pose (arms out, shield floating) needs an Idle clip applied before QA, and that my auto framing centered on the T-pose box so the feet sank below the ground disc. So: play `Idle` at t=0 and frame on the body before judging.
- Add to every sheet: a printed tri count, bbox height vs. the ART.md target (critter ~1/55 screen width, King 2x), and a second render at 22 px height to test the "nothing important below ~22 px" rule.

## NEEDS OWNER
- **Nothing required for the recommended pipeline** (KayKit/Kenney are public downloads, gltf-transform and Three are npm, Blender optional).
- Optional, only if the owner wants AI-generated one-off props: **Meshy Pro plan** (API needs Pro; price not shown in fetched page, check meshy.ai/pricing) and an **API key** from meshy.ai/settings/api exported as `MESHY_API_KEY`, or `meshy auth login` (browser sign-in, a human step). Free plan output requires crediting Meshy (CC BY 4.0) and has no API.
- Optional: Tripo or Hyper3D Rodin API keys (Rodin API = Business $120/mo). Not recommended.
- Optional: Mixamo (Adobe login). Not recommended.
- Decision for the owner: is the 1 GB `bpy` venv acceptable on this 7 GB-RAM, 231 GB-free laptop if Blender work is ever needed? (No action until then.)
- Decision for the lead, no owner needed: trim music so total initial download stays under 5 MB.
