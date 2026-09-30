# Kingswarm tech + rendering research (as of 2026-09-30)

Scope: browser game, deterministic 2D sim shown as a low-poly 3D diorama (fixed tilted camera, ~300 instanced units, 2 skinned heroes, ~15 buildings, soft shadows, toon shading, outline/rim, particles) at 60fps on an integrated GPU and acceptable on phones.
Tags: [MEASURED] = I ran it on this machine (Intel Iris Xe TGL GT2, Mesa, system Chromium 153, headless, Linux). [SRC] = read in primary source/source code. [SEC] = secondary blog, cross-check before betting on it. UNVERIFIED = not confirmed.

## Bottom line for Kingswarm
- **Use three.js 0.186.1 with `WebGLRenderer`, not `WebGPURenderer`, for v1.** Your scene is ~10-20 draw calls. [MEASURED] WebGLRenderer took 2.2 ms/frame at 1920x1080 on Iris Xe (2048 shadow map, MSAA, 300 instanced meshes) and 2.7 ms with outline pass + vertex squash. That is ~16% of a 16.7 ms frame. WebGPU buys nothing at this draw-call count, and in my A/B it was slower (3.6 vs 2.2 ms) and needs unsafe flags on Linux headless.
- **Keep TSL/WebGPU as a later, isolated upgrade.** The sim/render split below makes swapping `three` -> `three/webgpu` a renderer-file change. Revisit when Linux/Android WebGPU coverage is settled; today web.dev still lists Android as Android 12+ on Qualcomm/ARM only.
- **No PixiJS 2D fallback.** You already have a working Canvas2D renderer (v0.5). Keep it as the "WebGL context creation failed" fallback (Chromium docs explicitly tell you to handle that) instead of adding a second engine.
- **Reject Babylon, PlayCanvas, Godot for this game.** Babylon core is ~1.8 MB gz [SEC]; PlayCanvas ~615 kB gz and WebGPU is labeled beta [SEC/SRC]; Godot web is 33-40 MB wasm (2.4-5 MB brotli), WebGL2 Compatibility renderer only, and you would abandon your TS sim. Three tree-shaken here: **159 kB gz** (WebGL + GLTFLoader + SkeletonUtils) [MEASURED].
- **Look without post-processing.** Toon `MeshToonMaterial` (3-step NearestFilter gradient) + inverted-hull outline as a second InstancedMesh that shares the first one's `instanceMatrix` + a 1024 PCF shadow map. Verified working, including with vertex-shader squash/hop. Skip EffectComposer entirely; add bloom only on a "high" quality tier.
- **Critters: procedural, not baked.** One InstancedMesh per team-agnostic critter geometry, per-instance color via `setColorAt`, per-instance `aPhase` attribute, hop/squash in `onBeforeCompile` (verified). No vertex-animation textures, no skinning for critters. Heroes: glTF + `SkeletonUtils.clone` + one `AnimationMixer` each (2 heroes = negligible).
- **Sim: fixed step, integer-friendly, no `Math.random`, no `Date`/`performance.now` inside `sim/`.** Per spec, `Math.sin/cos/pow/exp/atan2/hypot...` are implementation-approximated; `+ - * / Math.sqrt Math.abs Math.floor` are exact. Ban the rest (or use a LUT/fdlibm port) so replays/tests are byte-stable across Chrome, Safari, Firefox.
- **Do not over-engineer neighbor search.** [MEASURED] 300 units: brute-force O(n^2) = 185 us/tick, typed-array uniform grid = 14 us, `Map<string,obj[]>` grid = 149 us (worse than brute force, and allocates). Use the typed grid only for critter-vs-critter/hut hits; plan for 1-2k units, not 100k.
- **Visual CI on SwiftShader, small viewport, manual clock.** Screenshots are byte-identical run to run on SwiftShader [MEASURED], but it costs 110-190 ms/frame at 960x540-1080p. Test at <=640x360 and step the sim explicitly through `window.__ks.step(n)`; never wait on real time.
- **Toolchain: Vite 8.3.1 + Vitest 5.0.3 + Playwright 1.63.0, TypeScript 6.0.3 (not 7.0.2 yet).** `typescript-eslint` 8.71.0 peers `typescript <6.1.0`; `@types/three` has dist-tags only up to `ts6.0`. TS 7.0.2 (native compiler) is fine to trial for `tsc --noEmit` speed; do not make it the default until those catch up (UNVERIFIED compat).

## 1. Recommended stack (npm `latest` checked 2026-09-30)
| Package | Version | Note |
|---|---|---|
| three | 0.186.1 (2026-09-24) | r186.0 was 2026-09-08. Pin exact; three ships breaking changes every release |
| @types/three | 0.186.0 | dist-tag `latest`; `ts6.0` also 0.186.0 |
| vite | 8.3.1 | Rolldown-based; Node ^20.19 or >=22.12 (local: Node 22.22.3 OK) |
| typescript | 6.0.3 (7.0.2 = trial) | see above |
| vitest | 5.0.3 | Node ^22.12 / ^24; peers vite ^6.4/^7/^8; `@vitest/browser-playwright` 5.0.3 if you want browser mode |
| @playwright/test | 1.63.0 | pins `playwright` 1.63.0 |
| peerjs | 1.5.5 | your online mode, unchanged (last publish 2026-01-04) |
| @gltf-transform/cli | 4.5.1 | dev: meshopt/quantize/prune hero glTFs, KTX2 if textures grow |
| optional: postprocessing | 6.39.5 | peers `three >=0.168 <0.187`: will block r187+ until it updates |
| optional: three-mesh-bvh 0.9.15, @three.ez/instanced-mesh 0.3.16 | | not needed at 300 units |
| dev tools: lil-gui 0.21.0, stats-gl 4.2.3 | | tuning + FPS/GPU panel, dev builds only |
| audio: howler 2.2.4 | last publish 2023-09-19 | still works for samples; unmaintained. Tone 15.1.22 is heavy for one-shot SFX. Audio is out of scope here |
Rejected engines, versions for the record: @babylonjs/core 9.27.1 (v9.0 released 2026-03), playcanvas 2.22.6, pixi.js 8.21.0.

## 2. Engine comparison (why three)
- **three.js r186.** [SRC: package tarball] `three` (WebGL) and `three/webgpu` + `three/tsl` are separate entry points; core is shared (`three.core.js`). Tree-shaken minified (esbuild 0.28) [MEASURED]: WebGL renderer + GLTFLoader + SkeletonUtils + InstancedMesh/Toon/shadows/AnimationMixer = 630 kB raw, 159 kB gz; `three/webgpu` renderer only = 808 kB raw, 220 kB gz (179 kB br). Utsubo quotes 185/300 kB [SEC]: same order.
- **WebGPURenderer maturity.** Ships since r171 (npm 2024-11-29). Auto-fallback to a WebGL2 backend [MEASURED: headless default -> "No available adapters ... running under WebGL2 backend", rendered fine]. `forceWebGL: true` exists [SRC]. `renderAsync()` is deprecated in r186 [MEASURED console warning]: use `await renderer.init()` then `render()`. Utsubo notes forum reports of WebGPURenderer being slower than WebGLRenderer in some scenes [SEC]; matches my A/B.
- **r183 (2026-02-18) renames [SRC]:** `Clock` deprecated -> `Timer`; `PostProcessing` extends new `RenderPipeline`. **r186 [SRC]:** `PCFSoftShadowMap` removed (warns, falls back to `PCFShadowMap`). LLM-written three code still emits both: grep for them.
- **WebGPU reach (Sep 2026).** Chrome/Edge 113+ (Win/mac/ChromeOS), Android Chrome 121+ (Android 12, Qualcomm/ARM only per web.dev), Safari 26 (macOS/iOS/iPadOS), Firefox 141+ Win / 145+ macOS ARM; Linux "in progress" per web.dev, "Chrome 147 Linux" per Utsubo [conflict; headless Chromium 153 here still had no adapter without flags]. Caniuse-ish global ~83-87% [SEC].
- **Babylon.js 9.x.** Full engine, Apache-2.0, ~1.8 MB gz for full core [SEC]. "Babylon Lite" is WebGPU-only with no WebGL fallback and self-described as young [SRC: babylonjs.com/lite]. Wrong tool for a phone-first browser game.
- **PlayCanvas 2.22.6.** MIT, ~615 kB gz [SEC], WebGPU beta with WebGL fallback [SRC docs]. Its value is the cloud editor; your pipeline is code-first. Pass.
- **PixiJS 8.21.0.** ~450 kB min, WebGPU renderer "feature complete" but docs recommend WebGL for production [SEC]. It is 2D; it would duplicate your existing Canvas2D fallback.
- **Godot 4 web.** Single-thread export is default since 4.3; threads need `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` [SRC docs], which GitHub Pages cannot set (and itch.io needs its SharedArrayBuffer toggle; Firefox lacks `credentialless`, so threaded builds are Chromium-only there [SRC itch.io blog]). Size: 4.3 wasm ~40 MB raw / ~5 MB brotli [SRC Godot blog]; 33 MB default, 2.4 MB br after disabling modules [SRC amann.dev]. WebGL2 + Compatibility renderer only; C# cannot export to web; AudioEffects unsupported in Sample playback mode; Safari WebGL2 issues; mobile web performance is noticeably worse [SRC docs]. Fine for Steam later, wrong for a 3-second-load browser game.
- **Steam later:** wrap the same Vite build (Electron/Tauri). UNVERIFIED; not researched here.

## 3. Measured render results (this machine, unthrottled, `gl.finish()`-synced, 120 frames avg)
| Scene | Renderer | Res | ms/frame |
|---|---|---|---|
| 300 lit instanced boxes, 2048 PCF shadow, MSAA | WebGLRenderer, Iris Xe | 640x400 | 0.60 |
| same | WebGLRenderer, Iris Xe | 1920x1080 | 2.23 |
| same, 3000 instances | WebGLRenderer, Iris Xe | 640x400 | 2.23 |
| same | WebGPURenderer native (unsafe flags) | 1920x1080 | 3.61 |
| 300 toon capsules + outline hull + squash + 2 skinned heroes, 1024 shadow, 8 draw calls | WebGLRenderer, Iris Xe | 1920x1080 | 2.71 (1.11 at 1280x720) |
| same | SwiftShader (CPU) | 960x540 | 109-139 |
Caveats: desktop-class Iris Xe (TGL, 96 EU) is stronger than a budget laptop/phone; canvas DPR=1; no vsync. Treat as headroom of ~6x on this machine; phones are UNVERIFIED (get a real device before promising 60fps). `WebGPURenderer` forced-WebGL numbers were not trusted (sync method unreliable) and are omitted.

## 4. Look recipe (all verified in the scratch page unless marked)
- Camera: `PerspectiveCamera` fov ~25-30, fixed pos, fit arena bounds to aspect (compute distance from arena width/height; portrait phones need letterbox or a rotate hint). Cursor -> world: ray vs y=0 plane, no raycast against meshes.
- Toon: `MeshToonMaterial` + 3-texel `DataTexture` gradientMap, `NearestFilter` min+mag, `needsUpdate=true`. Base `color` white when using `setColorAt` (instance color multiplies material color).
- Shadows [SRC shader chunk]: r186 `PCFShadowMap` = hardware 4-tap PCF x 5-tap Vogel disk; soften with `light.shadow.radius`. Fit the ortho shadow frustum to the arena; `shadow.normalBias` 0.03 avoids acne on capsules. Use 1024 (mobile 512-1024 [SEC]). `SunLight` CSM (r186) is unnecessary for a fixed camera. Tier: real shadows for heroes/buildings, blob-shadow quads (one InstancedMesh) for critters on low tier.
- Outline: second `InstancedMesh`, same geometry, `MeshBasicMaterial({side: BackSide})`, `io.instanceMatrix = im.instanceMatrix` (shared buffer, one upload), vertex patch `transformed += normal * 0.05`. Adds 1 draw call. `OutlinePass`/`OutlineEffect` are not instancing-friendly (three.js issue #18533 [SEC]).
- Squash/hop: `onBeforeCompile` patch on `#include <begin_vertex>`, per-instance `aPhase` (`InstancedBufferAttribute`), `uTime` uniform: `hop=abs(sin(t)); sq=1+0.25*cos(2t)*(1-hop); y=y*sq+hop*h; xz*=1/sqrt(sq)`. Visual-only, so native `sin` is fine here. Set `frustumCulled=false` (or recompute bounds). Patch `customDepthMaterial` too or shadows won't squash (UNVERIFIED, standard three behavior).
- Rim light: fresnel term added in the toon fragment via `onBeforeCompile` (UNVERIFIED, not tested).
- Post-processing: fill-rate cost; half-res post "roughly doubles" fps in fill-bound scenes [SEC]; MSAA and composer fight. Default: none. If bloom: `postprocessing` 6.39.5 merged effects, half-res, high tier only. DPR cap 2 desktop, 1.5-2 phones [SEC: cap at 2].
- InstancedMesh vs BatchedMesh: you have 2-4 distinct geometries -> separate InstancedMesh each (critter, arrow/projectile, hut types) [SEC: forum guidance]. BatchedMesh's multi-draw is emulated instancing and ~1.5x slower on iGPU than true instancing [SEC, three.js issue #31935]. Budget ~100 draw calls on mobile [SEC]; you are at ~10-20.
- Heroes: glTF with meshopt via gltf-transform, `SkeletonUtils.clone` per instance (clones bones), own `AnimationMixer`, `mixer.update(dt)` with render dt, not sim dt. Toon skinned materials worked (bent test bone).
- HUD: DOM overlay above canvas (`pointer-events:none` on container, `touch-action:none; user-select:none` on canvas/controls, `viewport-fit=cover` + safe-area insets). Text, buttons, timer, throne HP in DOM; world-anchored labels via `Vector3.project` for <=20 anchors only; never per-critter labels.

## 5. Sim patterns (TypeScript)
- Loop (Gaffer, "Fix Your Timestep" [SRC]): accumulator, clamp frame time to 0.25 s, `while (acc>=dt){prev=cur; step(); acc-=dt}`, render with `alpha=acc/dt`. Choose dt=1/30 (33.3 ms) or 1/60; 30 Hz halves CPU + network snapshot cost and interpolation hides it. Keep `prevX/prevY` typed arrays for interpolation; snap (no lerp) on spawn/teleport/dash start via a per-entity `teleported` flag.
- Hidden tabs: rAF stops; your existing worker-timer tick (commit 02d18d8) drives sim; skip render while `document.hidden`.
- RNG: `mulberry32` or `sfc32` (32-bit, `Math.imul`, `>>>0`), state stored in the world struct and included in snapshots/hash. One stream for sim; a separate stream for cosmetics (particles) so VFX never perturb the sim. Lint: `no-restricted-properties` for `Math.random`, `Date.now`, `performance.now` in `src/sim/**`.
- Trig: sim uses `Math.sqrt/abs/floor/min/max` + LUT sin/cos (1024 entries generated at load from a fdlibm-style routine, or precomputed literal table). Spec confirmed [SRC ecma262 spec.html]: `Math.sin/cos/atan2/exp/pow/hypot/...` "implementation-approximated"; `Math.sqrt` exact. `Math.hypot` and `**` are traps.
- Data layout: struct-of-arrays (`Float32Array x,y,vx,vy`, `Uint8Array team,state`, `Uint16Array hp`), fixed capacity, free-list + generation counter for ids, zero allocation in `step()`. Command input as a small fixed struct per player per tick (move x/y, fire, dash) so an input log + seed reproduces a match.
- Determinism harness: Vitest node test runs 3600 ticks from seed 1234 with scripted inputs, hashes state (FNV-1a over typed arrays), compares with a committed golden; second test runs it twice in one process and compares. Online stays host-authoritative snapshots (no cross-engine lockstep promise needed); determinism buys replays, tests, and AI-vs-AI balance sims (headless, thousands of matches).
- GC: `--trace-gc` over the whole benchmark (typed + Map + brute-force, 9k ticks) logged 167 GC events, not split per variant (the allocating Map/array variant is the source); the typed grid allocates nothing per tick; keep temp vectors as module-level scratch, reuse `Object3D`/`Matrix4`/`Color` in render, write matrices with `im.instanceMatrix.array` directly if profiling shows `setMatrixAt` matters, then `needsUpdate=true` once per frame.

## 6. Headless visual testing (Playwright + Chromium)
- [MEASURED] Chromium 153 headless (system `/usr/bin/chromium` via `executablePath`) gives WebGL2 with **zero flags** (ANGLE -> Vulkan -> SwiftShader). Explicit forms that also worked and produced byte-identical PNGs (md5 equal): `--use-angle=swiftshader --enable-unsafe-swiftshader`; `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader` (form from Chromium's swiftshader.md [SRC]). Chrome deprecates automatic SwiftShader fallback, so pass `--enable-unsafe-swiftshader` explicitly in CI to be future-proof [SRC].
- Real GPU in headless: `--use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist` used Iris Xe (renderer string confirmed) but pixels differ from SwiftShader (different md5). Never mix: baselines come from SwiftShader only.
- WebGPU in headless: default = no adapter (WebGPURenderer silently falls back to WebGL2). `--enable-unsafe-webgpu --enable-features=Vulkan --use-angle=vulkan` got a real WebGPU backend on this Mesa GPU. Test the WebGL path in CI; WebGPU is manual.
- `preserveDrawingBuffer`: NOT needed for `page.screenshot()` [MEASURED: pdb=0 and pdb=1 screenshots byte-identical]. It is needed only if you read the canvas (`toDataURL`, `readPixels`) outside the render task; it costs perf, so enable only under `?test`. Alternative: call `renderer.render()` then read in the same task.
- Determinism recipe: URL `?test&seed=1&w=640&h=360`; app skips rAF, exposes `window.__ks={step(n),render(),hash()}`; test does `step(240); render(); await expect(page).toHaveScreenshot('t4s.png',{maxDiffPixelRatio:0.001,animations:'disabled'})`. Playwright names baselines per browser+platform and recommends the same environment (Docker) for baselines [SRC]. Vitest 5 browser mode has `toMatchScreenshot` (Playwright provider) [SEC], but a plain `@playwright/test` spec against the Vite preview server is simpler for a whole-page canvas.
- Watch for: "GPU stall due to ReadPixels" console warning (harmless), 404 on favicon (fail-on-console rules should whitelist), SwiftShader speed (110-190 ms/frame => keep <=640x360, <=20 screenshots per run).

## 7. Starter architecture
```
src/sim/     rng.ts trig.ts world.ts(SoA) step.ts spatial.ts(grid) commands.ts snapshot.ts hash.ts   // pure TS, zero imports from three/DOM
src/ai/      rival.ts (reads world, emits commands)
src/render/  renderer.ts(quality tiers, dpr, context-loss) camera.ts critters.ts heroes.ts buildings.ts fx.ts(pooled particles) toon.ts(outline+squash patches)
src/ui/      hud.ts (DOM) menu.ts touch.ts input.ts
src/net/     host.ts guest.ts (PeerJS, snapshot encode)
src/audio/   sfx.ts music.ts
src/main.ts  tick(worker timer)->sim.step ; rAF->render(alpha)
tests/       sim.determinism.test.ts  e2e/visual.spec.ts  playwright.config.ts
```
Rules: `sim` imports nothing outside `sim`; `render` reads sim arrays read-only; enforced by `no-restricted-imports` (or tsconfig project references). Particles: pooled fixed-size `Points`/InstancedMesh with GPU-side age; no per-particle objects. Quality tiers chosen at boot + auto-downgrade if 60-frame avg > 20 ms: shadows off -> DPR 1 -> hero-only outline.
Vite: `base:'/<repo>/'` for GitHub Pages project sites [SRC vite docs]; your current deploy is `docs/` on main, so set `build.outDir:'docs'` or move to the Actions workflow from Vite docs; reference assets via `import.meta.env.BASE_URL`; use `?raw` for GLSL rather than vite-plugin-glsl 1.6.1 (extra dep, peers esbuild >=0.25).

## 8. Gotchas
1. `InstancedMesh` color multiplies material color; use white base.
2. `three/webgpu` API drift: `renderAsync`, `Clock`, `PostProcessing`, `PCFSoftShadowMap`, `rangeFog`, `viewportResolution` are deprecated/removed by r186 [SRC + SEC]. Pin `three` exact; upgrade deliberately (4 releases r183-r186 between Feb and Sep 2026).
3. `@types/three` lags `three` by a patch (0.186.0 vs 0.186.1): fine, but pin both.
4. Vertex-patched materials need matching `customDepthMaterial` for shadows (UNVERIFIED).
5. Shadow frustum must track arena, not camera; `shadow.bias/normalBias` tuning differs between PCF and VSM.
6. Mobile: cap DPR, avoid MSAA + composer, handle `webglcontextlost/restored`, unlock audio on first gesture, expect thermal throttling after ~30 s [SEC]; test a real mid-tier Android and an iPhone before claiming 60fps.
7. Toon banding looks wrong if gradientMap uses Linear filtering or the texture lacks `needsUpdate`.
8. Do not use `Map<string,...>` or object literals in hot sim paths (measured 10x slower than typed grid, plus GC).
9. Determinism leaks: `Math.sin/pow/hypot/**`, `Date`, iteration over `Object.keys` with numeric-like keys, float32 vs float64 mix (`Float32Array` stores round; be consistent), `Array.sort` with non-total comparators, using render dt in sim.
10. Godot/Babylon Lite-style WebGPU-only targets shut out iOS < 26 and most Android: never make WebGPU a requirement.
11. Vitest 5 and Vite 8 need Node >=22.12; pin `.nvmrc`/`engines`. Vite 8 replaces Rollup/esbuild with Rolldown: verify any Rollup plugin before adding.
12. GitHub Pages cannot send COOP/COEP headers: no SharedArrayBuffer/threads. Keep the sim single-threaded (worker only as timer).
13. Web fetch of GitHub release pages via the summarizer returned wrong (2024) dates; all dates above come from the npm registry `time` field.

## Sources
- npm registry (`npm view <pkg> version|time|peerDependencies`), 2026-09-30.
- three.js r186.1 package tarball (constants.js, WebGLShadowMap.js, shadowmap_pars_fragment.glsl.js, Clock.js, WebGPURenderer.js, PostProcessing.js): https://www.npmjs.com/package/three
- three.js releases: https://github.com/mrdoob/three.js/releases ; three.js issues: https://github.com/mrdoob/three.js/issues/31935 , https://github.com/mrdoob/three.js/issues/18533 , https://github.com/mrdoob/three.js/issues/30352
- Utsubo three.js 2026 status, comparison, 100 tips: https://www.utsubo.com/blog/threejs-2026-what-changed , https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison , https://www.utsubo.com/blog/threejs-best-practices-100-tips
- WebGPU browser availability: https://web.dev/blog/webgpu-supported-major-browsers
- Babylon Lite: https://www.babylonjs.com/lite/ ; Babylon 9.0: https://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0/
- PlayCanvas graphics docs: https://developer.playcanvas.com/user-manual/graphics/ ; PixiJS v8: https://pixijs.com/blog/pixi-v8-launches , https://pixijs.com/8.x/guides/components/renderers
- Godot: https://github.com/godotengine/godot-docs/blob/master/tutorials/export/exporting_for_web.rst , https://godotengine.org/article/progress-report-web-export-in-4-3/ , https://amann.dev/blog/2025/godot_web_size/ , https://itch.io/blog/456223/godot-cross-origin-isolation-and-sharedarraybuffers
- Chromium SwiftShader: https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md ; intent to remove fallback: https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM
- Playwright snapshots: https://playwright.dev/docs/test-snapshots ; Vitest visual regression: https://vitest.dev/guide/browser/visual-regression-testing
- Vite 8: https://vite.dev/blog/announcing-vite8 ; GitHub Pages deploy: https://vite.dev/guide/static-deploy.html
- Gaffer On Games, Fix Your Timestep: https://gafferongames.com/post/fix_your_timestep/
- ECMAScript spec source (implementation-approximated Math): https://github.com/tc39/ecma262/blob/main/spec.html ; cross-engine trig discussion [SEC]: https://github.com/jjgroenendijk/sunset-driver/issues/471
- Scratch experiments (not committed): `/tmp/claude-1000/-home-turbo-creative-game/42a0f085-49e4-4b98-b212-79e3f92ccf72/scratchpad/t/` (site/index.html, site/toon.html, run.mjs, bench.mjs).
