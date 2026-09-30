// Presentation effects: fixed pools, typed arrays, one draw call per pool, no allocation per frame.
//   Particles  opaque low-poly puffs and bits (dust, smoke, debris, confetti), with a priority budget
//   GroundFx   flat instanced quads on the ground: rings, soft discs, cracks, scorch/scuff/splat decals
//   Glows      additive flash spheres and light beams
//   Tracers    arrows/bolts from towers, huts and turrets
// Everything here is cosmetic: Math.random is fine, nothing reads back into the World.
import * as THREE from 'three';
import { toonNew, faceted } from './materials';
import { budgetAllows, BUDGET, Prio } from './feel';

const FX = {
  puffCap: 240,
  bitCap: 200,
  groundCap: 72,
  decalCap: 110,
  /** Decals live this long, fading over the last `decalFade` seconds. */
  decalLife: 26, decalFade: 6,
  glowCap: 24,
  beamCap: 8,
  tracerCap: 48,
  crownCap: 3,
} as const;

// ------------------------------------------------------------------ particles

export interface PuffOpts { grav?: number; drag?: number; bounce?: boolean; spin?: number; curve?: 0 | 1 }

/** One pool of opaque instanced particles (puffs or bits). */
class Pool {
  readonly mesh: THREE.InstancedMesh;
  readonly cap: number;
  live = 0;
  private readonly alive: Uint8Array;
  private readonly f: Float32Array; // per-particle fields, stride S
  private cursor = 0;
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly e = new THREE.Euler();
  private readonly c = new THREE.Color();

  constructor(geo: THREE.BufferGeometry, cap: number, group: THREE.Group) {
    this.cap = cap;
    this.alive = new Uint8Array(cap);
    this.f = new Float32Array(cap * S);
    this.mesh = new THREE.InstancedMesh(geo, toonNew('#ffffff'), cap);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, this.c.set('#fff'));
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    group.add(this.mesh);
  }

  /** Returns the slot or -1. Callers have checked the shared budget. */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, color: THREE.Color,
    sx = 1, sy = 1, sz = 1, o: PuffOpts = NO_OPTS): number {
    let i = -1;
    for (let k = 0; k < this.cap; k++) { const j = (this.cursor + k) % this.cap; if (!this.alive[j]) { i = j; break; } }
    if (i < 0) i = this.cursor; // full: recycle the oldest-ish slot
    else this.live++;
    this.cursor = (i + 1) % this.cap;
    this.alive[i] = 1;
    const f = this.f, b = i * S;
    f[b] = x; f[b + 1] = y; f[b + 2] = z; f[b + 3] = vx; f[b + 4] = vy; f[b + 5] = vz;
    f[b + 6] = 0; f[b + 7] = life; f[b + 8] = size;
    f[b + 9] = Math.random() * 6.28; f[b + 10] = Math.random() * 6.28; f[b + 11] = Math.random() * 6.28;
    const spin = o.spin ?? 0;
    f[b + 12] = (Math.random() - 0.5) * spin; f[b + 13] = (Math.random() - 0.5) * spin; f[b + 14] = (Math.random() - 0.5) * spin;
    f[b + 15] = o.grav ?? 0; f[b + 16] = o.drag ?? 0; f[b + 17] = o.bounce ? 1 : 0; f[b + 18] = o.curve ?? 0;
    f[b + 19] = color.r; f[b + 20] = color.g; f[b + 21] = color.b;
    f[b + 22] = sx; f[b + 23] = sy; f[b + 24] = sz;
    f[b + 25] = 0; f[b + 26] = 0; f[b + 27] = 0; f[b + 28] = 0; // swirl: cx, cz, angular speed, inward speed
    return i;
  }

  /** Turn a particle into a swirler around (cx, cz): its x/z become angle/radius about that centre. */
  swirl(i: number, cx: number, cz: number, w: number, inward: number): void {
    const f = this.f, b = i * S;
    const dx = f[b] - cx, dz = f[b + 2] - cz;
    f[b] = Math.atan2(dz, dx); f[b + 2] = Math.sqrt(dx * dx + dz * dz);
    f[b + 25] = cx; f[b + 26] = cz; f[b + 27] = w; f[b + 28] = inward;
  }

  update(dt: number): void {
    const f = this.f, mesh = this.mesh;
    let n = 0;
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) continue;
      const b = i * S;
      f[b + 6] += dt;
      const t = f[b + 6] / f[b + 7];
      if (t >= 1) { this.alive[i] = 0; this.live--; continue; }
      const drag = Math.exp(-f[b + 16] * dt);
      f[b + 3] *= drag; f[b + 5] *= drag;
      f[b + 4] = f[b + 4] * drag - f[b + 15] * dt;
      let px: number, pz: number;
      if (f[b + 27] !== 0) {
        // swirl: x = angle, z = radius about (cx, cz)
        f[b] += f[b + 27] * dt;
        f[b + 2] = Math.max(0, f[b + 2] - f[b + 28] * dt);
        f[b + 1] += f[b + 4] * dt;
        px = f[b + 25] + Math.cos(f[b]) * f[b + 2]; pz = f[b + 26] + Math.sin(f[b]) * f[b + 2];
      } else {
        f[b] += f[b + 3] * dt; f[b + 1] += f[b + 4] * dt; f[b + 2] += f[b + 5] * dt;
        px = f[b]; pz = f[b + 2];
      }
      if (f[b + 17] && f[b + 1] < 0) { f[b + 1] = 0; f[b + 4] = -f[b + 4] * 0.35; f[b + 3] *= 0.6; f[b + 5] *= 0.6; f[b + 12] *= 0.5; f[b + 14] *= 0.5; }
      f[b + 9] += f[b + 12] * dt; f[b + 10] += f[b + 13] * dt; f[b + 11] += f[b + 14] * dt;
      // size curve: puffs pop up fast and shrink away; bits hold their size then shrink at the end
      const k = f[b + 18] === 0 ? Math.min(1, t * 6) * (1 - t * t) : (t < 0.75 ? 1 : 1 - (t - 0.75) * 4);
      const sz = f[b + 8] * Math.max(0.001, k);
      this.p.set(px, f[b + 1], pz);
      this.q.setFromEuler(this.e.set(f[b + 9], f[b + 10], f[b + 11]));
      this.s.set(sz * f[b + 22], sz * f[b + 23], sz * f[b + 24]);
      mesh.setMatrixAt(n, this.m.compose(this.p, this.q, this.s));
      mesh.setColorAt(n, this.c.setRGB(f[b + 19], f[b + 20], f[b + 21]));
      n++;
    }
    mesh.count = n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
  }

  clear(): void { this.alive.fill(0); this.live = 0; this.mesh.count = 0; }
}
const S = 29;
const NO_OPTS: PuffOpts = {};

export class Particles {
  readonly group = new THREE.Group();
  readonly puffs: Pool;
  readonly bits: Pool;
  constructor() {
    const puff = faceted(new THREE.IcosahedronGeometry(1, 0));
    const bit = faceted(new THREE.BoxGeometry(1, 1, 1));
    this.puffs = new Pool(puff, FX.puffCap, this.group);
    this.bits = new Pool(bit, FX.bitCap, this.group);
  }
  get live(): number { return this.puffs.live + this.bits.live; }
  allows(prio: Prio): boolean { return budgetAllows(this.live, prio, BUDGET.cap); }

  puff(prio: Prio, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, color: THREE.Color, o?: PuffOpts): number {
    if (!this.allows(prio)) return -1;
    return this.puffs.spawn(x, y, z, vx, vy, vz, size, life, color, 1, 1, 1, o);
  }
  bit(prio: Prio, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, color: THREE.Color,
    sx: number, sy: number, sz: number, o?: PuffOpts): number {
    if (!this.allows(prio)) return -1;
    return this.bits.spawn(x, y, z, vx, vy, vz, size, life, color, sx, sy, sz, { curve: 1, ...o });
  }
  update(dt: number): void { this.puffs.update(dt); this.bits.update(dt); }
  clear(): void { this.puffs.clear(); this.bits.clear(); }
  dispose(): void { disposeGroup(this.group); }
}

// ------------------------------------------------------------------ ground quads

/** Ground quad shapes (the fragment shader draws each procedurally). */
export const Shape = { Ring: 0, Disc: 1, Crack: 2, Scorch: 3, Scuff: 4, Dashed: 5, Splat: 6, Spiral: 7 } as const;
export type Shape = (typeof Shape)[keyof typeof Shape];

const groundVert = /* glsl */ `
attribute vec4 aP;   // shape, alpha, p1, additive (0..1)
attribute vec2 aQ;   // seed, p2
varying vec2 vUv; varying vec3 vC; varying vec4 vP; varying vec2 vQ;
void main() {
  vUv = position.xz; vC = instanceColor; vP = aP; vQ = aQ;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const groundFrag = /* glsl */ `
varying vec2 vUv; varying vec3 vC; varying vec4 vP; varying vec2 vQ;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float r = length(vUv);
  float aa = fwidth(r) * 1.5;
  int shape = int(vP.x + 0.5);
  float a = 0.0;
  float ang = atan(vUv.y, vUv.x);
  if (shape == 0) {            // ring: band from p1 to 1
    a = smoothstep(vP.z - aa, vP.z + aa, r) * (1.0 - smoothstep(1.0 - aa, 1.0 + aa, r));
  } else if (shape == 1) {     // soft disc, p1 = hardness
    a = 1.0 - smoothstep(vP.z * 0.95, 1.0, r);
  } else if (shape == 2) {     // crack star grown to p1
    float n = 9.0;
    float sector = floor((ang / 6.2831853 + 0.5) * n);
    float len = (0.55 + 0.45 * h1(sector + vQ.x * 7.0)) * vP.z;
    float centre = ((sector + 0.5) / n - 0.5) * 6.2831853 + (h1(sector * 3.1 + vQ.x) - 0.5) * 0.3;
    float jag = sin(r * 23.0 + sector) * 0.05 + sin(r * 51.0 + sector * 2.0) * 0.025;
    float d = abs(sin(ang - centre - jag)) * r;
    float w = 0.05 * (1.0 - r / max(len, 0.001)) + 0.012;
    a = (1.0 - smoothstep(w - 0.01, w + 0.01, d)) * step(r, len) + (1.0 - smoothstep(0.1, 0.24, r)) * 0.8;
  } else if (shape == 3) {     // scorch mark: dark blotch with a noisy edge and embers
    float e = r + (vnoise(vUv * 3.0 + vQ.x * 10.0) - 0.5) * 0.35;
    a = 1.0 - smoothstep(0.55, 0.95, e);
  } else if (shape == 4) {     // landing scuff: a small smear of dirt
    float e = r + (vnoise(vUv * 4.0 + vQ.x * 10.0) - 0.5) * 0.5;
    a = (1.0 - smoothstep(0.4, 0.95, e)) * (0.6 + 0.4 * vnoise(vUv * 9.0 + vQ.x));
  } else if (shape == 5) {     // dashed ring (whistle)
    float band = smoothstep(vP.z - aa, vP.z + aa, r) * (1.0 - smoothstep(1.0 - aa, 1.0 + aa, r));
    a = band * step(0.45, fract(ang / 6.2831853 * 18.0 + vQ.y));
  } else if (shape == 6) {     // splat: blob with a few droplets
    float e = r + (vnoise(vUv * 3.5 + vQ.x * 10.0) - 0.5) * 0.4;
    a = 1.0 - smoothstep(0.35, 0.5, e);
    vec2 dp = vUv * 3.0; vec2 id = floor(dp);
    float drop = step(0.8, h2(id + vQ.x)) * (1.0 - smoothstep(0.15, 0.3, length(fract(dp) - 0.5)));
    a = max(a, drop * (1.0 - smoothstep(0.6, 1.0, r)));
  } else {                     // spiral arms turning inward, p2 = phase
    float s = sin(ang * 3.0 + r * 10.0 + vQ.y);
    a = smoothstep(0.1, 0.8, s) * (1.0 - smoothstep(0.75, 1.0, r)) * smoothstep(0.1, 0.3, r);
  }
  a *= vP.y;
  if (a < 0.004) discard;
  // premultiplied: additive where aP.w = 1, normal blending where 0
  vec3 c = vC;
  gl_FragColor = vec4(c * a, a * (1.0 - vP.w));
  #include <colorspace_fragment>
}`;

function premultBlend(m: THREE.Material): void {
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendEquation = THREE.AddEquation;
}

interface GroundSlot { on: boolean; shape: number; x: number; z: number; r0: number; r1: number; t: number; life: number; a0: number; p1a: number; p1b: number; add: number; rot: number; seed: number; spin: number; y: number; fadeIn: number }

/** Transient (expanding rings, pulses) or persistent (decals) ground quads. */
export class GroundFx {
  readonly mesh: THREE.InstancedMesh;
  private readonly slots: GroundSlot[];
  private readonly aP: THREE.InstancedBufferAttribute;
  private readonly aQ: THREE.InstancedBufferAttribute;
  private cursor = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly col = new THREE.Color();
  private readonly cols: Float32Array;

  constructor(private readonly cap: number, private readonly persistent: boolean, renderOrder: number) {
    const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({ vertexShader: groundVert, fragmentShader: groundFrag, transparent: true, depthWrite: false });
    premultBlend(mat);
    mat.polygonOffset = true; mat.polygonOffsetFactor = -3; mat.polygonOffsetUnits = -3;
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = renderOrder;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.aP.setUsage(THREE.DynamicDrawUsage);
    this.aQ = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); this.aQ.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP', this.aP); g.setAttribute('aQ', this.aQ);
    this.mesh.setColorAt(0, this.col.set('#fff'));
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.cols = new Float32Array(cap * 3);
    this.slots = Array.from({ length: cap }, () => ({ on: false, shape: 0, x: 0, z: 0, r0: 0, r1: 0, t: 0, life: 0, a0: 0, p1a: 0, p1b: 0, add: 0, rot: 0, seed: 0, spin: 0, y: 0, fadeIn: 0 }));
  }

  /**
   * Add a quad at scene (x, z). Radius animates r0 -> r1 (ease-out) and alpha a0 -> 0 over life
   * (persistent decals hold their alpha until they fade). p1 animates p1a -> p1b (ring inner edge, crack growth).
   */
  add(shape: Shape, x: number, z: number, r0: number, r1: number, life: number, color: THREE.Color, a0: number, p1a = 0.8, p1b = p1a, add = 0, rot = Math.random() * 6.28, spin = 0): void {
    let i = -1;
    for (let k = 0; k < this.cap; k++) { const j = (this.cursor + k) % this.cap; if (!this.slots[j].on) { i = j; break; } }
    if (i < 0) i = this.cursor; // recycle the oldest
    this.cursor = (i + 1) % this.cap;
    const s = this.slots[i];
    s.on = true; s.shape = shape; s.x = x; s.z = z; s.r0 = r0; s.r1 = r1; s.t = 0; s.life = life; s.a0 = a0; s.p1a = p1a; s.p1b = p1b; s.add = add; s.rot = rot; s.seed = Math.random(); s.spin = spin;
    s.y = this.persistent ? 0.012 + (i % 16) * 0.0004 : 0.06; s.fadeIn = this.persistent ? 0.25 : 0;
    this.cols[i * 3] = color.r; this.cols[i * 3 + 1] = color.g; this.cols[i * 3 + 2] = color.b;
  }

  update(dt: number): void {
    let n = 0;
    const P = this.aP.array as Float32Array, Q = this.aQ.array as Float32Array;
    for (let i = 0; i < this.cap; i++) {
      const s = this.slots[i];
      if (!s.on) continue;
      s.t += dt;
      const u = s.t / s.life;
      if (u >= 1) { s.on = false; continue; }
      const e = 1 - (1 - u) * (1 - u) * (1 - u);
      const r = s.r0 + (s.r1 - s.r0) * (this.persistent ? Math.min(1, s.t / 0.15) : e);
      let a: number;
      if (this.persistent) {
        const fadeStart = s.life - FX.decalFade;
        a = s.a0 * Math.min(1, s.t / Math.max(0.001, s.fadeIn)) * (s.t < fadeStart ? 1 : 1 - (s.t - fadeStart) / FX.decalFade);
      } else a = s.a0 * (1 - u) * (1 - u * 0.3);
      s.rot += s.spin * dt;
      this.q.setFromAxisAngle(this.up, s.rot);
      this.mesh.setMatrixAt(n, this.m.compose(this.v.set(s.x, s.y, s.z), this.q, this.s.set(r, 1, r)));
      this.mesh.setColorAt(n, this.col.setRGB(this.cols[i * 3], this.cols[i * 3 + 1], this.cols[i * 3 + 2]));
      P[n * 4] = s.shape; P[n * 4 + 1] = a; P[n * 4 + 2] = s.p1a + (s.p1b - s.p1a) * e; P[n * 4 + 3] = s.add;
      Q[n * 2] = s.seed; Q[n * 2 + 1] = s.t * 4;
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.aP.needsUpdate = true; this.aQ.needsUpdate = true;
  }

  get live(): number { let n = 0; for (const s of this.slots) if (s.on) n++; return n; }
  clear(): void { for (const s of this.slots) s.on = false; this.mesh.count = 0; }
  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

// ------------------------------------------------------------------ glows (flash spheres, beams)

const glowVert = /* glsl */ `
attribute vec2 aA; // alpha, additive
varying vec3 vC; varying vec2 vA; varying vec3 vN; varying vec3 vV; varying float vY;
void main() {
  vC = instanceColor; vA = aA; vY = uv.y;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const sphereFrag = /* glsl */ `
varying vec3 vC; varying vec2 vA; varying vec3 vN; varying vec3 vV; varying float vY;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  float a = vA.x * (0.35 + 0.65 * pow(f, 0.6));
  gl_FragColor = vec4(vC * a, a * (1.0 - vA.y));
  #include <colorspace_fragment>
}`;
const beamFrag = /* glsl */ `
varying vec3 vC; varying vec2 vA; varying vec3 vN; varying vec3 vV; varying float vY;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  float a = vA.x * pow(1.0 - vY, 1.4) * (0.25 + 0.75 * f);
  gl_FragColor = vec4(vC * a, a * (1.0 - vA.y));
  #include <colorspace_fragment>
}`;

interface GlowSlot { on: boolean; x: number; y: number; z: number; r0: number; r1: number; h: number; t: number; life: number; a0: number; add: number; hold: number }

class GlowPool {
  readonly mesh: THREE.InstancedMesh;
  private readonly slots: GlowSlot[];
  private readonly aA: THREE.InstancedBufferAttribute;
  private readonly cols: Float32Array;
  private cursor = 0;
  private readonly m = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly col = new THREE.Color();

  constructor(geo: THREE.BufferGeometry, frag: string, private readonly cap: number, renderOrder: number, private readonly beam: boolean) {
    const mat = new THREE.ShaderMaterial({ vertexShader: glowVert, fragmentShader: frag, transparent: true, depthWrite: false, side: beam ? THREE.DoubleSide : THREE.FrontSide });
    premultBlend(mat);
    this.aA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); this.aA.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aA', this.aA);
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = renderOrder;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, this.col.set('#fff'));
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.cols = new Float32Array(cap * 3);
    this.slots = Array.from({ length: cap }, () => ({ on: false, x: 0, y: 0, z: 0, r0: 0, r1: 0, h: 1, t: 0, life: 1, a0: 1, add: 1, hold: 0 }));
  }

  /** Sphere: radius r0 -> r1. Beam: radius r0 -> r1, height h, holds full alpha for `hold` of its life. */
  add(x: number, y: number, z: number, r0: number, r1: number, life: number, color: THREE.Color, a0: number, add: number, h = 1, hold = 0): void {
    let i = -1;
    for (let k = 0; k < this.cap; k++) { const j = (this.cursor + k) % this.cap; if (!this.slots[j].on) { i = j; break; } }
    if (i < 0) i = this.cursor;
    this.cursor = (i + 1) % this.cap;
    Object.assign(this.slots[i], { on: true, x, y, z, r0, r1, h, t: 0, life, a0, add, hold });
    this.cols[i * 3] = color.r; this.cols[i * 3 + 1] = color.g; this.cols[i * 3 + 2] = color.b;
  }

  update(dt: number): void {
    let n = 0;
    const A = this.aA.array as Float32Array;
    for (let i = 0; i < this.cap; i++) {
      const s = this.slots[i];
      if (!s.on) continue;
      s.t += dt;
      const u = s.t / s.life;
      if (u >= 1) { s.on = false; continue; }
      const e = 1 - (1 - u) * (1 - u);
      const r = s.r0 + (s.r1 - s.r0) * e;
      const fade = u < s.hold ? 1 : 1 - (u - s.hold) / (1 - s.hold);
      const a = s.a0 * (this.beam ? Math.min(1, u * 8) * fade : fade * fade);
      this.mesh.setMatrixAt(n, this.m.compose(this.v.set(s.x, s.y, s.z), this.q, this.s.set(r, this.beam ? s.h : r, r)));
      this.mesh.setColorAt(n, this.col.setRGB(this.cols[i * 3], this.cols[i * 3 + 1], this.cols[i * 3 + 2]));
      A[n * 2] = a; A[n * 2 + 1] = s.add;
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.aA.needsUpdate = true;
  }
  clear(): void { for (const s of this.slots) s.on = false; this.mesh.count = 0; }
}

export class Glows {
  readonly group = new THREE.Group();
  readonly spheres: GlowPool;
  readonly beams: GlowPool;
  constructor() {
    this.spheres = new GlowPool(new THREE.IcosahedronGeometry(1, 2), sphereFrag, FX.glowCap, 46, false);
    const bg = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true); bg.translate(0, 0.5, 0);
    this.beams = new GlowPool(bg, beamFrag, FX.beamCap, 47, true);
    this.group.add(this.spheres.mesh, this.beams.mesh);
  }
  update(dt: number): void { this.spheres.update(dt); this.beams.update(dt); }
  clear(): void { this.spheres.clear(); this.beams.clear(); }
  dispose(): void { disposeGroup(this.group); }
}

// ------------------------------------------------------------------ tracers

interface Tracer { on: boolean; sx: number; sy: number; sz: number; tx: number; tz: number; t: number; dur: number; apex: number }

/** Arrows and bolts on a shallow arc, pointing along their velocity. */
export class Tracers {
  readonly mesh: THREE.InstancedMesh;
  private readonly list: Tracer[];
  private readonly cols: Float32Array;
  private cursor = 0;
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly d = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly fwd = new THREE.Vector3(0, 0, 1);
  private readonly col = new THREE.Color();
  /** Called when a tracer lands (scene x, z). */
  onHit: (x: number, z: number, i: number) => void = () => {};

  constructor() {
    // Arrow along +z: shaft, head, fletching. White base; instance colour tints it.
    const shaft = new THREE.BoxGeometry(0.07, 0.07, 0.62);
    const head = new THREE.ConeGeometry(0.1, 0.22, 4); head.rotateX(Math.PI / 2); head.translate(0, 0, 0.4);
    const fl = new THREE.BoxGeometry(0.22, 0.03, 0.16); fl.translate(0, 0, -0.26);
    const fl2 = new THREE.BoxGeometry(0.03, 0.22, 0.16); fl2.translate(0, 0, -0.26);
    const parts = [shaft, head, fl, fl2].map((g) => faceted(g));
    const geo = new THREE.BufferGeometry();
    const merged = parts.map((g) => g.getAttribute('position').array as Float32Array);
    const total = merged.reduce((a, b) => a + b.length, 0);
    const pos = new Float32Array(total); let o = 0;
    for (const a of merged) { pos.set(a, o); o += a.length; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    this.mesh = new THREE.InstancedMesh(geo, toonNew('#ffffff'), FX.tracerCap);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, this.col.set('#fff'));
    this.list = Array.from({ length: FX.tracerCap }, () => ({ on: false, sx: 0, sy: 0, sz: 0, tx: 0, tz: 0, t: 0, dur: 1, apex: 0 }));
    this.cols = new Float32Array(FX.tracerCap * 3);
  }

  fire(sx: number, sy: number, sz: number, tx: number, tz: number, color: THREE.Color): void {
    let i = -1;
    for (let k = 0; k < this.list.length; k++) { const j = (this.cursor + k) % this.list.length; if (!this.list[j].on) { i = j; break; } }
    if (i < 0) i = this.cursor;
    this.cursor = (i + 1) % this.list.length;
    const d = Math.hypot(tx - sx, tz - sz);
    Object.assign(this.list[i], { on: true, sx, sy, sz, tx, tz, t: 0, dur: 0.08 + d / 20, apex: 0.25 + d * 0.06 });
    this.cols[i * 3] = color.r; this.cols[i * 3 + 1] = color.g; this.cols[i * 3 + 2] = color.b;
  }

  private at(tr: Tracer, u: number, out: THREE.Vector3): THREE.Vector3 {
    const endY = 0.35;
    return out.set(tr.sx + (tr.tx - tr.sx) * u, tr.sy + (endY - tr.sy) * u + 4 * u * (1 - u) * tr.apex, tr.sz + (tr.tz - tr.sz) * u);
  }

  update(dt: number): void {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      const tr = this.list[i];
      if (!tr.on) continue;
      tr.t += dt;
      const u = tr.t / tr.dur;
      if (u >= 1) { tr.on = false; this.onHit(tr.tx, tr.tz, i); continue; }
      this.at(tr, u, this.p);
      this.at(tr, Math.min(1, u + 0.02), this.d).sub(this.p).normalize();
      this.q.setFromUnitVectors(this.fwd, this.d);
      this.mesh.setMatrixAt(n, this.m.compose(this.p, this.q, this.s));
      this.mesh.setColorAt(n, this.col.setRGB(this.cols[i * 3], this.cols[i * 3 + 1], this.cols[i * 3 + 2]));
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear(): void { for (const t of this.list) t.on = false; this.mesh.count = 0; }
  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

// ------------------------------------------------------------------ flying crowns (a King's crown knocked off)

interface Flyer { on: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; rx: number; rz: number; wx: number; wz: number; t: number; life: number }

export class CrownFlyers {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly list: Flyer[] = [];
  constructor(geo: THREE.BufferGeometry, mats: THREE.Material[]) {
    for (let i = 0; i < FX.crownCap; i++) {
      const g = new THREE.Group();
      for (const m of mats) g.add(new THREE.Mesh(geo, m));
      g.visible = false;
      this.group.add(g);
      this.meshes.push(g as unknown as THREE.Mesh);
      this.list.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, wx: 0, wz: 0, t: 0, life: 1 });
    }
  }
  launch(x: number, y: number, z: number, dx: number, dz: number): void {
    const i = this.list.findIndex((f) => !f.on);
    if (i < 0) return;
    const l = Math.hypot(dx, dz) || 1;
    Object.assign(this.list[i], { on: true, x, y, z, vx: (dx / l) * 2.2, vy: 7.5, vz: (dz / l) * 2.2, rx: 0, rz: 0, wx: 9 + Math.random() * 4, wz: 5, t: 0, life: 1.9 });
  }
  update(dt: number): void {
    for (let i = 0; i < this.list.length; i++) {
      const f = this.list[i], m = this.meshes[i];
      m.visible = f.on;
      if (!f.on) continue;
      f.t += dt;
      if (f.t > f.life) { f.on = false; m.visible = false; continue; }
      f.vy -= 22 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      if (f.y < 0.12) { f.y = 0.12; f.vy = Math.abs(f.vy) * 0.38; f.vx *= 0.55; f.vz *= 0.55; f.wx *= 0.4; f.wz *= 0.4; }
      f.rx += f.wx * dt; f.rz += f.wz * dt;
      m.position.set(f.x, f.y, f.z);
      m.rotation.set(f.rx, 0, f.rz);
      const k = f.t > f.life - 0.3 ? (f.life - f.t) / 0.3 : 1;
      m.scale.setScalar(Math.max(0.001, k));
    }
  }
  clear(): void { for (const f of this.list) f.on = false; for (const m of this.meshes) m.visible = false; }
}

export function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
}

export const FX_LIMITS = FX;
