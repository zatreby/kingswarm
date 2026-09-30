// Renderer entry: owns the WebGL context, lights, camera and the scene modules. Reads the World, never writes it.
import * as THREE from 'three';
import type { World, Team, SimEvent, Hero } from '../sim/types';
import { loadKit, type Kit } from './assets';
import { CameraRig } from './camera';
import { buildIsland, ISLAND_BOUNDS, type Island } from './island';
import { Buildings } from './buildings';
import { Critters } from './critters';
import { Kings } from './kings';
import { Zones } from './zones';
import { PAL } from './palette';
import { sceneX, sceneZ } from './mapping';

export interface Renderer {
  readonly canvas: HTMLCanvasElement;
  /** Build/replace the static scene for a match; looks = cosmetic King look ids per team. */
  loadMatch(world: World, opts: { localTeam: Team; looks: [string, string] }): void;
  /** Called after every sim step with that step's events. */
  onEvents(events: readonly SimEvent[], world: World): void;
  /** alpha: 0..1 interpolation between entity (px,py) and (x,y); dt: real seconds since last frame, for cosmetic animation. */
  render(world: World, alpha: number, dt: number): void;
  /** Ground-plane hit in sim units (ray vs y=0 plane). */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number };
  /** CSS px relative to the canvas top-left, for DOM HUD anchors. */
  worldToScreen(x: number, y: number, height?: number): { x: number; y: number };
  /** Which King shows the aim reticle + range ring (local human), null for none. */
  setAim(team: Team | null): void;
  resize(): void;
  setOptions(o: { quality?: 'low' | 'medium' | 'high'; shake?: number; reduceFlash?: boolean; colorBlind?: boolean }): void;
  dispose(): void;
}

/** Lab/QA extras, not part of the game contract. */
export interface RendererDebug {
  /** Close-up camera centred on sim (x, y) showing `width` sim units across; null restores the fitted view. */
  debugView(v: { x: number; y: number; width: number } | null): void;
  /** Extra Kings driven by caller-owned Hero objects. Call after loadMatch. */
  showcase(entries: { hero: Hero; look: string }[]): void;
  readonly gl: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
}

const LIGHT = {
  sky: '#D6ECFF', ground: '#7C8F55', hemi: 1.55,
  sun: '#FFF0D8', sunI: 1.9,
  /** Sun comes from the upper left of the screen (-x, far -z); shadows fall to the lower right. */
  sunDir: [-0.62, 1.3, -0.52] as const,
  shadowRadius: 3,
} as const;

const QUALITY = {
  low: { dpr: 1, shadow: 1024 },
  medium: { dpr: 1.5, shadow: 2048 },
  high: { dpr: 2, shadow: 2048 },
} as const;

export async function createRenderer(container: HTMLElement): Promise<Renderer & RendererDebug> {
  const kit: Kit = await loadKit(`${import.meta.env.BASE_URL}models/kit.glb`);

  const gl = new THREE.WebGLRenderer({ antialias: true, stencil: true, powerPreference: 'high-performance' });
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.NoToneMapping;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFShadowMap;
  // Only static things cast real shadows (island, buildings, trees): render the map on load, not every frame.
  gl.shadowMap.autoUpdate = false;
  gl.setClearColor(PAL.waterDeep);
  const canvas = gl.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.waterDeep);
  const hemi = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.hemi);
  const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunI);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = LIGHT.shadowRadius;
  scene.add(hemi, sun, sun.target);
  fitShadow(sun);

  const rig = new CameraRig();
  const B = ISLAND_BOUNDS;
  rig.setFitBounds(Math.max(-B.minX, B.maxX) + 0.3, Math.max(-B.minZ, B.maxZ) + 0.2, 2.8);

  const buildings = new Buildings(kit);
  const critters = new Critters();
  const kings = new Kings();
  kings.buildingTop = (i) => buildings.topOf(i);
  const zones = new Zones();
  scene.add(buildings.group, zones.group, critters.group, kings.group);

  let island: Island | null = null, islandKey = '';
  let time = 0;
  let quality: keyof typeof QUALITY = 'high';
  let colorBlind = false;
  let lastWorld: World | null = null, lastLooks: [string, string] | null = null;
  let debug: { x: number; y: number; width: number } | null = null;
  const opts = { shake: 1, reduceFlash: false };

  const applyQuality = () => {
    const q = QUALITY[quality];
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    if (sun.shadow.mapSize.x !== q.shadow) {
      sun.shadow.mapSize.set(q.shadow, q.shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      gl.shadowMap.needsUpdate = true;
    }
  };

  const resize = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    applyQuality();
    gl.setSize(w, h, false);
    if (debug) debugCamera(debug, w / h); else rig.fit(w / h);
  };

  const debugCamera = (v: { x: number; y: number; width: number }, aspect: number) => {
    const cam = rig.camera, tilt = THREE.MathUtils.degToRad(56);
    cam.aspect = aspect; cam.updateProjectionMatrix();
    const halfFovH = Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * aspect);
    const d = v.width / 2 / Math.tan(halfFovH);
    const target = new THREE.Vector3(sceneX(v.x), 0.5, sceneZ(v.y));
    cam.position.set(target.x, target.y + Math.sin(tilt) * d, target.z + Math.cos(tilt) * d);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
  };

  const onPointer = (e: PointerEvent) => {
    const p = rig.screenToWorld(e.clientX, e.clientY, canvas.getBoundingClientRect());
    kings.pointer.x = p.x; kings.pointer.y = p.y;
  };
  const onLeave = () => { kings.pointer.x = NaN; kings.pointer.y = NaN; };
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('pointerleave', onLeave);
  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();

  const r: Renderer & RendererDebug = {
    canvas, gl, scene,
    loadMatch(world, o) {
      lastWorld = world; lastLooks = o.looks;
      const key = world.config.map.id + ':' + world.buildings.map((b) => `${b.kind}${b.x},${b.y}`).join(';');
      if (key !== islandKey) {
        if (island) { scene.remove(island.group); island.dispose(); }
        island = buildIsland(kit, world.buildings, world.obstacles, hashString(world.config.map.id));
        scene.add(island.group);
        islandKey = key;
      }
      buildings.build(world);
      buildings.setColorBlind(colorBlind);
      critters.reset();
      kings.build(world, o.looks, o.localTeam, colorBlind);
      gl.shadowMap.needsUpdate = true;
    },
    onEvents() {
      // Stage 2: event VFX (throws, landings, captures, shake). Hatch pop-in is driven by critter slots coming alive.
    },
    render(world, alpha, dt) {
      time += dt;
      island?.update(time);
      buildings.update(world, time);
      zones.update(world, time);
      critters.update(world, alpha, dt, time);
      kings.update(world, alpha, dt, time, rig.camera);
      gl.render(scene, rig.camera);
    },
    screenToWorld(clientX, clientY) { return rig.screenToWorld(clientX, clientY, canvas.getBoundingClientRect()); },
    worldToScreen(x, y, height = 0) { return rig.worldToScreen(x, y, height, canvas.clientWidth, canvas.clientHeight); },
    setAim(team) { kings.setAim(team); },
    resize,
    setOptions(o) {
      if (o.quality && o.quality !== quality) { quality = o.quality; resize(); }
      if (o.shake !== undefined) opts.shake = Math.max(0, o.shake);
      if (o.reduceFlash !== undefined) opts.reduceFlash = o.reduceFlash;
      if (o.colorBlind !== undefined && o.colorBlind !== colorBlind) {
        colorBlind = o.colorBlind;
        buildings.setColorBlind(colorBlind); critters.setColors(colorBlind); zones.setColors(colorBlind);
        kings.setColors(colorBlind, lastWorld, lastLooks);
      }
    },
    dispose() {
      ro.disconnect();
      canvas.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('pointerleave', onLeave);
      island?.dispose(); buildings.dispose(); critters.dispose(); kings.dispose(); zones.dispose();
      Object.values(kit.geo).forEach((g) => g.dispose()); kit.atlas.dispose();
      gl.dispose();
      canvas.remove();
    },
    debugView(v) { debug = v; resize(); },
    showcase(entries) { kings.showcase(entries); },
  };
  return r;
}

/** Fit the sun's orthographic shadow camera tightly around the island (arena, not camera; research §8.5). */
function fitShadow(sun: THREE.DirectionalLight): void {
  const B = ISLAND_BOUNDS;
  const dir = new THREE.Vector3(...LIGHT.sunDir).normalize();
  sun.target.position.set(0, 0, 0);
  sun.position.copy(dir).multiplyScalar(40);
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  const view = new THREE.Matrix4().lookAt(sun.position, sun.target.position, new THREE.Vector3(0, 1, 0));
  view.setPosition(sun.position);
  const inv = view.clone().invert();
  const box = new THREE.Box3();
  for (const x of [B.minX, B.maxX]) for (const y of [-0.5, 5]) for (const z of [B.minZ, B.maxZ]) box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
  const c = sun.shadow.camera;
  c.left = box.min.x - 0.5; c.right = box.max.x + 0.5; c.bottom = box.min.y - 0.5; c.top = box.max.y + 0.5;
  c.near = Math.max(0.1, -box.max.z - 2); c.far = -box.min.z + 2;
  c.updateProjectionMatrix();
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
