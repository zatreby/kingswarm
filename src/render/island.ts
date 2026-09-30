// The diorama: rounded grass island with a faceted dirt cliff in calm water, a painted ground texture
// (grass patches, dirt paths, pads), obstacles from the World and seeded decor that avoids gameplay space.
import * as THREE from 'three';
import type { Obstacle, BuildingKind } from '../sim/types';
import type { Kit, KitModel } from './assets';
import { PAL } from './palette';
import { toonNew, kitMaterial, faceted } from './materials';
import { sceneX, sceneZ, captureRadius, mulberry32, pathPairs, segDist, HALF_W, HALF_H } from './mapping';

export const ISLAND = {
  /** Island extents beyond the arena, scene units (far edge gets more room for rim trees). */
  side: 1.6, near: 1.3, far: 1.9,
  corner: 3.2,
  edgeNoise: 0.22,
  outlinePts: 220,
  waterY: -1.0,
  /** Ground texture pixels per world unit. */
  ppu: 48,
  pathWidth: 0.62,
} as const;

export const ISLAND_BOUNDS = {
  minX: -HALF_W - ISLAND.side, maxX: HALF_W + ISLAND.side,
  minZ: -HALF_H - ISLAND.far, maxZ: HALF_H + ISLAND.near,
};

export interface LayoutBuilding { x: number; y: number; r: number; kind: BuildingKind }

export interface Island {
  group: THREE.Group;
  update(time: number): void;
  dispose(): void;
}

type V2 = { x: number; z: number; nx: number; nz: number };

export function buildIsland(kit: Kit, buildings: readonly LayoutBuilding[], obstacles: readonly Obstacle[], seed: number): Island {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'island';
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(d: T) => (disposables.push(d), d);

  const outline = makeOutline(rnd);
  const paths = pathPairs(buildings, 8.2, 2).map(([i, j]) => {
    const a = buildings[i], b = buildings[j];
    // Bend each path a little to one side so the network looks trodden, not ruled.
    const bend = (rnd() - 0.5) * 1.4;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y, cx: mx - ((b.y - a.y) / len) * bend, cy: my + ((b.x - a.x) / len) * bend };
  });

  // --- ground top with painted texture
  const tex = track(paintGround(outline, buildings, obstacles, paths, rnd));
  const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, -p.z)));
  const topGeo = track(new THREE.ShapeGeometry(shape, 1));
  topGeo.rotateX(-Math.PI / 2);
  const B = ISLAND_BOUNDS, pos = topGeo.getAttribute('position'), uv = topGeo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - B.minX) / (B.maxX - B.minX), 1 - (pos.getZ(i) - B.minZ) / (B.maxZ - B.minZ));
  }
  const top = new THREE.Mesh(topGeo, track(toonNew(PAL.white, { map: tex })));
  top.receiveShadow = true;
  top.name = 'ground';
  group.add(top);

  // --- cliff: rings stepping down and in, jittered for facets, coloured by band
  const cliff = new THREE.Mesh(track(cliffGeometry(outline, rnd)), track(toonNew(PAL.white, { vertexColors: true })));
  cliff.receiveShadow = true;
  group.add(cliff);

  // --- water: shallow glow near the shore fading to deep, plus a foam line
  // Calm water: the vertex-colour depth gradient plus faint slow glints (two crossed sine fields, thresholded).
  const waterTime = { value: 0 };
  const waterMat = track(new THREE.MeshBasicMaterial({ vertexColors: true }));
  waterMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = waterTime;
    s.vertexShader = 'varying vec2 vWP;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = position.xz;');
    s.fragmentShader = 'uniform float uTime;\nvarying vec2 vWP;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float w = sin(vWP.x * 0.45 + uTime * 0.35 + sin(vWP.y * 0.9) * 1.8) * sin(vWP.y * 3.1 - uTime * 0.5 + sin(vWP.x * 0.3) * 2.0);
      float fadeFar = 1.0 - smoothstep(16.0, 40.0, length(vWP * vec2(1.0, 1.6)));
      diffuseColor.rgb += vec3(0.035, 0.055, 0.07) * smoothstep(0.86, 0.99, w) * fadeFar;`);
  };
  const water = new THREE.Mesh(track(waterGeometry()), waterMat);
  water.position.y = ISLAND.waterY;
  group.add(water);
  const shoreMat = track(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  const shore = new THREE.Mesh(track(shoreGeometry(outline)), shoreMat);
  shore.position.y = ISLAND.waterY + 0.01;
  group.add(shore);

  // --- props: obstacles, rim and interior decor, all instanced per model
  const scatter = new Scatter(kit);
  const blocked = (x: number, y: number, pad: number) =>
    buildings.some((b) => Math.hypot(b.x - x, b.y - y) < captureRadius(b) + pad) ||
    obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + pad) ||
    paths.some((p) => segDist(x, y, p.ax, p.ay, p.cx, p.cy) < ISLAND.pathWidth / 2 + pad || segDist(x, y, p.cx, p.cy, p.bx, p.by) < ISLAND.pathWidth / 2 + pad);

  const ponds: THREE.Mesh[] = [];
  for (const o of obstacles) {
    const x = sceneX(o.x), z = sceneZ(o.y);
    if (o.look === 'trees') {
      const n = 3 + Math.floor(o.r * 2.5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.6, d = i === 0 ? 0 : o.r * (0.45 + rnd() * 0.3);
        scatter.add(rnd() < 0.5 ? 'tree_A' : 'tree_B', x + Math.cos(a) * d, z + Math.sin(a) * d, 1.35 + rnd() * 0.5, rnd() * 6.28, 'height');
      }
      for (let i = 0; i < 3; i++) { const a = rnd() * 6.28; scatter.bush(x + Math.cos(a) * o.r * 0.9, z + Math.sin(a) * o.r * 0.9, 0.3 + rnd() * 0.15, rnd); }
    } else if (o.look === 'rock') {
      scatter.add('rock_E', x, z, o.r * 1.9, rnd() * 6.28, 'width');
      const n = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.28, d = o.r * (0.75 + rnd() * 0.25);
        scatter.add((['rock_A', 'rock_B', 'rock_C', 'rock_D'] as const)[Math.floor(rnd() * 4)], x + Math.cos(a) * d, z + Math.sin(a) * d, o.r * (0.6 + rnd() * 0.4), rnd() * 6.28, 'width');
      }
    } else {
      const pond = new THREE.Mesh(track(pondGeometry(o.r, rnd)), track(toonNew(PAL.waterLight)));
      pond.position.set(x, 0.025, z);
      pond.receiveShadow = true;
      ponds.push(pond);
      group.add(pond);
      for (let i = 0; i < 3; i++) { const a = rnd() * 6.28, d = o.r * (0.25 + rnd() * 0.45); scatter.add('lily', x + Math.cos(a) * d, z + Math.sin(a) * d, 0.35 + rnd() * 0.15, rnd() * 6.28, 'width'); }
      for (let i = 0; i < 2; i++) { const a = rnd() * 6.28, d = o.r * 0.95; scatter.add('reeds', x + Math.cos(a) * d, z + Math.sin(a) * d, 0.5 + rnd() * 0.2, rnd() * 6.28, 'height'); }
    }
  }

  // Rim: tall trees along the far and side edges (they hide nothing important there), low stuff along the near edge.
  for (let i = 0; i < outline.length; i += 2) {
    const p = outline[i];
    const inset = 0.35 + rnd() * 0.9;
    const x = p.x - p.nx * inset, z = p.z - p.nz * inset;
    const sx = x + HALF_W, sy = z + HALF_H;
    if (blocked(sx, sy, 0.4)) continue;
    const nearEdge = z > HALF_H - 0.2;
    const inArena = sx > 0.15 && sx < 31.85 && sy > 0.15 && sy < 17.85;
    const r = rnd();
    if (!nearEdge && !inArena && r < 0.55) {
      const m: KitModel = r < 0.1 ? 'trees_A' : r < 0.2 ? 'trees_B' : r < 0.38 ? 'tree_A' : 'tree_B';
      scatter.add(m, x, z, m.startsWith('trees') ? 1.9 + rnd() * 0.5 : 1.5 + rnd() * 0.8, rnd() * 6.28, 'height');
    } else if (r < 0.7) scatter.bush(x, z, 0.28 + rnd() * 0.2, rnd);
    else if (r < 0.8) scatter.add((['rock_A', 'rock_B', 'rock_C', 'rock_D'] as const)[Math.floor(rnd() * 4)], x, z, 0.35 + rnd() * 0.35, rnd() * 6.28, 'width');
    else scatter.flowers(x, z, 3, rnd);
  }
  // Interior: small, flat things only (flowers, tufts, pebbles) so they never read as cover.
  for (let i = 0; i < 260; i++) {
    const sx = 0.5 + rnd() * 31, sy = 0.5 + rnd() * 17;
    if (blocked(sx, sy, 0.35)) continue;
    const x = sceneX(sx), z = sceneZ(sy), r = rnd();
    if (r < 0.35) scatter.tuft(x, z, rnd);
    else if (r < 0.55) scatter.flowers(x, z, 2 + Math.floor(rnd() * 4), rnd);
    else if (r < 0.62) scatter.add('rock_A', x, z, 0.16 + rnd() * 0.12, rnd() * 6.28, 'width');
    else if (r < 0.66) scatter.bush(x, z, 0.2 + rnd() * 0.1, rnd);
  }
  for (const m of scatter.build()) { group.add(m); disposables.push(m); }

  return {
    group,
    update(time: number) {
      // Foam breathes slowly; ponds shimmer a touch. Cheap uniforms/scalars only.
      shoreMat.opacity = 0.85 + 0.15 * Math.sin(time * 0.8);
      waterTime.value = time;
      for (let i = 0; i < ponds.length; i++) ponds[i].rotation.y = Math.sin(time * 0.3 + i) * 0.05;
    },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}

// ---------------------------------------------------------------- geometry

function makeOutline(rnd: () => number): V2[] {
  const B = ISLAND_BOUNDS, r = ISLAND.corner;
  // Rounded rectangle sampled by arc length, then pushed out by a smooth seeded wobble.
  const straightW = B.maxX - B.minX - 2 * r, straightH = B.maxZ - B.minZ - 2 * r, arc = (Math.PI / 2) * r;
  const per = 2 * straightW + 2 * straightH + 4 * arc;
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const pts: V2[] = [];
  for (let i = 0; i < ISLAND.outlinePts; i++) {
    let s = (i / ISLAND.outlinePts) * per;
    let x = 0, z = 0, nx = 0, nz = 0;
    const seg = (len: number) => { if (s <= len) return true; s -= len; return false; };
    if (seg(straightW)) { x = B.minX + r + s; z = B.minZ; nx = 0; nz = -1; }
    else if (seg(arc)) { const a = -Math.PI / 2 + s / r; x = B.maxX - r + Math.cos(a) * r; z = B.minZ + r + Math.sin(a) * r; nx = Math.cos(a); nz = Math.sin(a); }
    else if (seg(straightH)) { x = B.maxX; z = B.minZ + r + s; nx = 1; nz = 0; }
    else if (seg(arc)) { const a = s / r; x = B.maxX - r + Math.cos(a) * r; z = B.maxZ - r + Math.sin(a) * r; nx = Math.cos(a); nz = Math.sin(a); }
    else if (seg(straightW)) { x = B.maxX - r - s; z = B.maxZ; nx = 0; nz = 1; }
    else if (seg(arc)) { const a = Math.PI / 2 + s / r; x = B.minX + r + Math.cos(a) * r; z = B.maxZ - r + Math.sin(a) * r; nx = Math.cos(a); nz = Math.sin(a); }
    else if (seg(straightH)) { x = B.minX; z = B.maxZ - r - s; nx = -1; nz = 0; }
    else { const a = Math.PI + Math.min(s, arc) / r; x = B.minX + r + Math.cos(a) * r; z = B.minZ + r + Math.sin(a) * r; nx = Math.cos(a); nz = Math.sin(a); }
    const t = (i / ISLAND.outlinePts) * Math.PI * 2;
    const w = ISLAND.edgeNoise * (0.55 * Math.sin(t * 5 + ph[0]) + 0.3 * Math.sin(t * 11 + ph[1]) + 0.15 * Math.sin(t * 23 + ph[2]));
    pts.push({ x: x + nx * w, z: z + nz * w, nx, nz });
  }
  return pts;
}

function cliffGeometry(outline: V2[], rnd: () => number): THREE.BufferGeometry {
  // [outward offset, height, colour] per ring; jitter on the lower rings gives the faceted rock face.
  // The face flares outward as it drops so the 56 degree camera sees it below the grass lip.
  const rings: [number, number, string, number][] = [
    [0, 0, PAL.grassEdge, 0], [0.05, -0.12, PAL.grassEdge, 0], [0.1, -0.22, PAL.cliff, 0.03],
    [0.28, -0.7, PAL.cliff, 0.1], [0.5, -1.2, PAL.cliffDark, 0.14], [0.9, -2.2, PAL.cliffDark, 0.08],
  ];
  const n = outline.length, cols = rings.map((r) => new THREE.Color(r[2]));
  const ringPts = rings.map(([o, y, , j]) => outline.map((p) => {
    const jo = o + (rnd() - 0.5) * j * 2, jy = y + (rnd() - 0.5) * j;
    return new THREE.Vector3(p.x + p.nx * jo, jy, p.z + p.nz * jo);
  }));
  const pos: number[] = [], col: number[] = [];
  for (let k = 0; k < rings.length - 1; k++) {
    const A = ringPts[k], Bp = ringPts[k + 1], c = cols[k + 1];
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      for (const v of [A[i], Bp[i], A[i2], A[i2], Bp[i], Bp[i2]]) { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return faceted(g);
}

function waterGeometry(): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(160, 48, 0, Math.PI * 2);
  g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position'), c: number[] = [];
  const near = new THREE.Color(PAL.water), far = new THREE.Color(PAL.waterDeep), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i), p.getZ(i) * 1.6);
    tmp.copy(near).lerp(far, Math.min(1, Math.max(0, (d - 14) / 40)));
    c.push(tmp.r, tmp.g, tmp.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}

function shoreGeometry(outline: V2[]): THREE.BufferGeometry {
  // Bands: foam at the cliff foot, then shallow water fading into the sea.
  const bands: [number, string, number][] = [[-0.3, '#FFFFFF', 0.75], [0.12, '#FFFFFF', 0.6], [0.2, PAL.waterLight, 0.7], [1.6, PAL.waterLight, 0]];
  const n = outline.length, pos: number[] = [], col: number[] = [], idx: number[] = [];
  bands.forEach(([o, c, a]) => {
    const cc = new THREE.Color(c);
    for (const p of outline) { pos.push(p.x + p.nx * o, 0, p.z + p.nz * o); col.push(cc.r, cc.g, cc.b, a); }
  });
  for (let k = 0; k < bands.length - 1; k++) for (let i = 0; i < n; i++) {
    const a = k * n + i, b = k * n + ((i + 1) % n), c = (k + 1) * n + i, d = (k + 1) * n + ((i + 1) % n);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

function pondGeometry(r: number, rnd: () => number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, rr = r * (0.9 + rnd() * 0.15); pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); }
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------- ground texture

function paintGround(outline: V2[], buildings: readonly LayoutBuilding[], obstacles: readonly Obstacle[],
  paths: { ax: number; ay: number; bx: number; by: number; cx: number; cy: number }[], rnd: () => number): THREE.CanvasTexture {
  const B = ISLAND_BOUNDS, ppu = ISLAND.ppu;
  const W = Math.round((B.maxX - B.minX) * ppu), H = Math.round((B.maxZ - B.minZ) * ppu);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.setTransform(ppu, 0, 0, ppu, -B.minX * ppu, -B.minZ * ppu); // draw in scene (x, z)
  g.fillStyle = PAL.grass;
  g.fillRect(B.minX, B.minZ, B.maxX - B.minX, B.maxZ - B.minZ);

  const blob = (x: number, z: number, r: number, color: string, alpha: number, sx = 1) => {
    // Fade to a transparent version of the same colour: fading to transparent black leaves a dark fringe.
    const c = new THREE.Color(color), rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    g.save(); g.translate(x, z); g.scale(sx, 1);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, `rgba(${rgb},1)`); grd.addColorStop(0.6, `rgba(${rgb},1)`); grd.addColorStop(1, `rgba(${rgb},0)`);
    g.globalAlpha = alpha; g.fillStyle = grd; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.restore();
    g.globalAlpha = 1;
  };
  /** Irregular soft-edged patch (blurred polygon) for organic grass variation. */
  const patch = (x: number, z: number, r: number, color: string, alpha: number) => {
    g.save(); g.filter = `blur(${Math.round(r * ppu * 0.25)}px)`; g.globalAlpha = alpha; g.fillStyle = color; g.beginPath();
    const n = 9, rot = rnd() * 6.28;
    for (let i = 0; i <= n; i++) { const a = rot + (i / n) * Math.PI * 2, rr = r * (0.65 + rnd() * 0.5); const px = x + Math.cos(a) * rr * 1.3, pz = z + Math.sin(a) * rr; if (i) g.lineTo(px, pz); else g.moveTo(px, pz); }
    g.fill(); g.restore();
  };
  // Large soft patches of lighter and darker grass.
  for (let i = 0; i < 70; i++) {
    patch(B.minX + rnd() * (B.maxX - B.minX), B.minZ + rnd() * (B.maxZ - B.minZ), 0.9 + rnd() * 2.0, i % 2 ? PAL.grassLight : PAL.grassDark, 0.6);
  }
  // Fine blade flecks so the grass is not a flat fill up close.
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = B.minX + rnd() * (B.maxX - B.minX), z = B.minZ + rnd() * (B.maxZ - B.minZ);
    g.strokeStyle = rnd() < 0.5 ? PAL.grassLight : PAL.grassDark;
    g.globalAlpha = 0.5; g.lineWidth = 0.035;
    g.beginPath(); g.moveTo(x, z); g.lineTo(x + (rnd() - 0.5) * 0.08, z - 0.1 - rnd() * 0.06); g.stroke();
  }
  g.globalAlpha = 1;
  // Darker trampled rim inside the island edge.
  g.beginPath();
  outline.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z)));
  g.closePath();
  g.strokeStyle = PAL.grassEdge; g.globalAlpha = 0.35; g.lineWidth = 0.7; g.stroke();
  g.globalAlpha = 1;

  // Paths: dark edge, dirt body, light centre wear, pebbles.
  const curve = (p: typeof paths[number]) => { g.beginPath(); g.moveTo(sceneX(p.ax), sceneZ(p.ay)); g.quadraticCurveTo(sceneX(p.cx), sceneZ(p.cy), sceneX(p.bx), sceneZ(p.by)); };
  for (const p of paths) { curve(p); g.strokeStyle = PAL.grassEdge; g.globalAlpha = 0.45; g.lineWidth = ISLAND.pathWidth + 0.16; g.stroke(); }
  for (const p of paths) { curve(p); g.strokeStyle = PAL.dirtDark; g.globalAlpha = 1; g.lineWidth = ISLAND.pathWidth; g.stroke(); }
  for (const p of paths) { curve(p); g.strokeStyle = PAL.dirt; g.lineWidth = ISLAND.pathWidth * 0.72; g.stroke(); }
  for (const p of paths) { curve(p); g.strokeStyle = '#D8C48E'; g.globalAlpha = 0.6; g.lineWidth = ISLAND.pathWidth * 0.22; g.stroke(); }
  g.globalAlpha = 1;
  // Worn dirt yards under buildings, pond banks.
  for (const b of buildings) {
    const x = sceneX(b.x), z = sceneZ(b.y);
    blob(x, z, b.r * 1.35, PAL.dirtDark, 0.55);
    blob(x, z, b.r * 1.15, PAL.dirt, 1);
  }
  for (const o of obstacles) {
    const x = sceneX(o.x), z = sceneZ(o.y);
    if (o.look === 'pond') { blob(x, z, o.r + 0.45, PAL.dirtDark, 0.8); blob(x, z, o.r + 0.3, PAL.dirt, 1); }
    else blob(x, z, o.r + 0.35, PAL.grassDark, 0.8);
  }
  // Pebble specks on dirt.
  for (let i = 0; i < 500; i++) {
    const p = paths[Math.floor(rnd() * paths.length)];
    if (!p) break;
    const t = rnd(), u = 1 - t;
    const x = sceneX(u * u * p.ax + 2 * u * t * p.cx + t * t * p.bx) + (rnd() - 0.5) * 0.4, z = sceneZ(u * u * p.ay + 2 * u * t * p.cy + t * t * p.by) + (rnd() - 0.5) * 0.4;
    g.fillStyle = rnd() < 0.5 ? '#E2D2A2' : '#9F8752'; g.globalAlpha = 0.8;
    g.beginPath(); g.arc(x, z, 0.03 + rnd() * 0.03, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------- instanced scatter

class Scatter {
  private items = new Map<KitModel, THREE.Matrix4[]>();
  private bushes: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  private tufts: THREE.Matrix4[] = [];
  private flowerItems: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(private kit: Kit) {}

  /** Place a kit model scaled so its height (or footprint width) equals `size`. */
  add(model: KitModel, x: number, z: number, size: number, rot: number, by: 'height' | 'width'): void {
    const b = this.kit.box[model];
    const ref = by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    const s = size / (ref || 1);
    const list = this.items.get(model) ?? [];
    list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, -b.min.y * s, z), this.q.setFromAxisAngle(this.up, rot).clone(), new THREE.Vector3(s, s, s)));
    this.items.set(model, list);
  }
  bush(x: number, z: number, r: number, rnd: () => number): void {
    // Two or three overlapping lumps so bushes do not read as balls in a row.
    const c = new THREE.Color(['#3F8F3A', '#4F9C3F', '#2F7D3B'][Math.floor(rnd() * 3)]);
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = i ? r * 0.7 : 0, rr = r * (i ? 0.6 + rnd() * 0.2 : 1);
      this.bushes.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * d, rr * 0.45, z + Math.sin(a) * d), this.q.setFromAxisAngle(this.up, rnd() * 6).clone(), new THREE.Vector3(rr, rr * 0.75, rr)), c: c.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.06) });
    }
  }
  tuft(x: number, z: number, rnd: () => number): void {
    const s = 0.8 + rnd() * 0.6;
    this.tufts.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), this.q.setFromAxisAngle(this.up, rnd() * 6).clone(), new THREE.Vector3(s, s, s)));
  }
  flowers(x: number, z: number, n: number, rnd: () => number): void {
    const cols = ['#F4F1E0', '#FFE98A', '#F7A8BC', '#C9B0F0'];
    const c = new THREE.Color(cols[Math.floor(rnd() * cols.length)]);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = rnd() * 0.3;
      this.flowerItems.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * d, 0.06, z + Math.sin(a) * d), this.q.identity().clone(), new THREE.Vector3(1, 1, 1)), c });
    }
  }

  build(): (THREE.InstancedMesh)[] {
    const out: THREE.InstancedMesh[] = [];
    const mat = kitMaterial(this.kit.atlas, null);
    for (const [model, list] of this.items) {
      const im = new THREE.InstancedMesh(this.kit.geo[model], mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = !model.startsWith('lily');
      im.receiveShadow = true;
      im.computeBoundingSphere();
      out.push(im);
    }
    if (this.bushes.length) {
      const g = faceted(new THREE.IcosahedronGeometry(1, 1));
      const im = new THREE.InstancedMesh(g, toonNew(PAL.white), this.bushes.length);
      this.bushes.forEach((b, i) => { im.setMatrixAt(i, b.m); im.setColorAt(i, b.c); });
      im.castShadow = true; im.receiveShadow = true;
      out.push(im);
    }
    if (this.tufts.length) {
      const blades: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const b = new THREE.ConeGeometry(0.035, 0.22, 3);
        b.translate(0, 0.11, 0); b.rotateZ((i - 1) * 0.35); b.translate((i - 1) * 0.05, 0, 0);
        blades.push(b);
      }
      const g = faceted(mergeSimple(blades));
      const im = new THREE.InstancedMesh(g, toonNew('#4E9A38'), this.tufts.length);
      this.tufts.forEach((m, i) => im.setMatrixAt(i, m));
      im.receiveShadow = true;
      out.push(im);
    }
    if (this.flowerItems.length) {
      const g = faceted(new THREE.OctahedronGeometry(0.045, 0));
      g.scale(1, 0.6, 1);
      const im = new THREE.InstancedMesh(g, toonNew(PAL.white), this.flowerItems.length);
      this.flowerItems.forEach((f, i) => { im.setMatrixAt(i, f.m); im.setColorAt(i, f.c); });
      im.receiveShadow = true;
      out.push(im);
    }
    return out;
  }
}

function mergeSimple(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = parts.reduce((s, g) => s + g.getAttribute('position').count, 0);
  const pos = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.getAttribute('position').array as Float32Array, o); o += g.getAttribute('position').count * 3; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return out;
}
