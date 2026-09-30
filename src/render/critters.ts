// Critters: instanced squashy blobs with big eyes. One body+outline InstancedMesh per team (Blue round,
// Red with a pointed tuft); every kind has its own silhouette (brute squat with horns, runt small with
// huge eyes, bomber with a big lit bomb, guard behind a shield plate). Shared meshes for eyes, gear,
// status overlays (stun stars, frost shell), Mutation accessories, flight trails and shadows.
// All animation is presentation-only, from critter state + per-slot cosmetic state. No per-frame allocation.
import * as THREE from 'three';
import { MAX_CRITTERS, DT } from '../sim/types';
import type { World, Critter, CritterKind, Team, TeamMods } from '../sim/types';
import { PAL, teamColors } from './palette';
import { toonNew, outlineMaterial, faceted } from './materials';
import { blobGeometry, merge, posNormal } from './shapes';
import { UNIT_STENCIL } from './rings';
import { sceneX, sceneZ, flightHeight, flightSlope, angleDelta, approach } from './mapping';
import { easeOutBack } from './feel';

interface KindLook { s: number; w: number; h: number; eye: number }

export const CR = {
  /** Body radius: 1/55 of a 1080p screen at the fitted camera (art review: 35 px). */
  radius: 0.36,
  /** Body height / width: a touch taller than round so the 56 degree camera sees a face, not a disc. */
  squash: 1.08,
  kind: {
    critter: { s: 1, w: 1, h: 1, eye: 1 },
    runt: { s: 0.74, w: 0.92, h: 1.12, eye: 1.45 },
    brute: { s: 1.3, w: 1.2, h: 0.84, eye: 0.82 },
    bomber: { s: 1.0, w: 1, h: 1, eye: 1 },
    guard: { s: 1.04, w: 1.02, h: 1, eye: 1 },
  } as Record<CritterKind, KindLook>,
  outline: 0.05,
  hopHeight: 0.22,
  hopsPerUnit: 0.8,
  moveSpeed: 0.45,
  lookRate: 12,
  lookRange: 3.5,
  eyeR: 0.13, pupilR: 0.07, eyeAz: 0.42, eyeEl: 0.72,
  /** Eyes never turn further than this from the camera, so a crowd seen from behind shows no white slivers. */
  gazeMax: 1.3,
  popTime: 0.22,
  shadowAlpha: 0.5,
  landSquash: 0.16,
  exclaimTime: 0.75,
} as const;

/** Mutation accessories on ordinary critters, so a team's build is visible on the battlefield. */
const ACCESSORY: { mod: keyof TeamMods; name: string }[] = [
  { mod: 'leeches', name: 'fangs' }, { mod: 'piercers', name: 'horn' }, { mod: 'homing', name: 'antenna' },
  { mod: 'frostbite', name: 'crystals' }, { mod: 'scorch', name: 'ember' }, { mod: 'shockwave', name: 'bolt' },
];

const shadowVert = /* glsl */ `varying vec2 vUv; varying float vA;
void main(){ vUv = uv; vA = instanceColor.r; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const shadowFrag = /* glsl */ `uniform vec3 uColor; varying vec2 vUv; varying float vA;
void main(){ float r = length(vUv - 0.5) * 2.0; float a = vA * (1.0 - smoothstep(0.55, 1.0, r)); if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

export class Critters {
  readonly group = new THREE.Group();
  private readonly body: [THREE.InstancedMesh, THREE.InstancedMesh];
  private readonly outline: [THREE.InstancedMesh, THREE.InstancedMesh];
  private readonly outlineMats: [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial];
  private readonly eyes: THREE.InstancedMesh;
  private readonly pupils: THREE.InstancedMesh;
  private readonly brute: THREE.InstancedMesh;
  private readonly bomb: THREE.InstancedMesh;
  private readonly spark: THREE.InstancedMesh;
  private readonly guard: THREE.InstancedMesh;
  private readonly shadow: THREE.InstancedMesh;
  private readonly stars: THREE.InstancedMesh;
  private readonly frost: THREE.InstancedMesh;
  private readonly trail: THREE.InstancedMesh;
  private readonly marks: THREE.InstancedMesh;
  private readonly acc: THREE.InstancedMesh[];
  private readonly accOn: [boolean[], boolean[]] = [[], []];
  private readonly shared: THREE.InstancedMesh[];

  // per-slot presentation state
  private readonly alive = new Uint8Array(MAX_CRITTERS);
  private readonly born = new Float32Array(MAX_CRITTERS);
  private readonly yaw = new Float32Array(MAX_CRITTERS);
  private readonly lastX = new Float32Array(MAX_CRITTERS);
  private readonly lastY = new Float32Array(MAX_CRITTERS);
  private readonly spd = new Float32Array(MAX_CRITTERS);
  private readonly hop = new Float32Array(MAX_CRITTERS);
  private readonly landT = new Float32Array(MAX_CRITTERS).fill(-99);
  private readonly markT = new Float32Array(MAX_CRITTERS).fill(-99);
  private readonly target = new Int16Array(MAX_CRITTERS).fill(-1);
  private frame = 0;
  private time = 0;
  private readonly counts = new Int32Array(2);

  // scratch
  private readonly m = new THREE.Matrix4();
  private readonly m2 = new THREE.Matrix4();
  private readonly m3 = new THREE.Matrix4();
  private readonly rotY = new THREE.Matrix4();
  private readonly centre = new THREE.Matrix4().makeTranslation(0, -CR.radius * CR.squash, 0);
  private readonly eyeL: [THREE.Matrix4, THREE.Matrix4];
  private readonly bombL = new THREE.Matrix4();
  private readonly sparkL = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly camQ = new THREE.Quaternion();
  private readonly scl = new THREE.Vector3();
  private readonly eul = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly col = new THREE.Color();
  private readonly teamBody = [new THREE.Color(), new THREE.Color()];
  private readonly teamLight = [new THREE.Color(), new THREE.Color()];
  private readonly teamDark = [new THREE.Color(), new THREE.Color()];
  private readonly frostC = new THREE.Color(PAL.frost);
  private readonly white = new THREE.Color(PAL.white);
  private readonly cryo = new THREE.Color('#CFF4FF');
  private readonly alphaC = new THREE.Color();

  constructor() {
    const R = CR.radius, N = MAX_CRITTERS, top = R * CR.squash * 2;
    const blueGeo = posNormal(blobGeometry(R, 16, 12, CR.squash));
    // Red's shape cue: a tall swept-back tuft that breaks the round silhouette even from above.
    const tuft = new THREE.ConeGeometry(0.12, 0.4, 6);
    tuft.translate(0, 0.2, 0);
    tuft.rotateX(-0.55);
    tuft.translate(0, top - 0.1, -0.12);
    const redGeo = merge([blobGeometry(R, 16, 12, CR.squash), tuft]);
    const stencil = { stencilWrite: true, stencilRef: UNIT_STENCIL, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp } as const;
    const bodyMat = toonNew(PAL.white, { ...stencil });
    this.outlineMats = [outlineMaterial(PAL.blueDark, CR.outline), outlineMaterial(PAL.redDark, CR.outline)];
    for (const m of this.outlineMats) Object.assign(m, stencil);
    const mk = (g: THREE.BufferGeometry, mat: THREE.Material, n: number, color = false) => {
      const im = new THREE.InstancedMesh(g, mat, n);
      im.frustumCulled = false; im.count = 0; im.castShadow = false; im.receiveShadow = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (color) { im.setColorAt(0, this.col.set(PAL.white)); im.instanceColor!.setUsage(THREE.DynamicDrawUsage); }
      this.group.add(im);
      return im;
    };
    this.body = [mk(blueGeo, bodyMat, N, true), mk(redGeo, bodyMat, N, true)];
    for (const b of this.body) b.receiveShadow = true;
    this.outline = [mk(blueGeo, this.outlineMats[0], N), mk(redGeo, this.outlineMats[1], N)];
    // Outlines share the body's matrices: one buffer, one upload.
    this.outline[0].instanceMatrix = this.body[0].instanceMatrix;
    this.outline[1].instanceMatrix = this.body[1].instanceMatrix;

    const eyeGeo = new THREE.SphereGeometry(CR.eyeR, 12, 8); eyeGeo.scale(1, 1.08, 0.62);
    const pupGeo = new THREE.SphereGeometry(CR.pupilR, 8, 6); pupGeo.scale(1, 1.1, 0.5);
    this.eyes = mk(eyeGeo, new THREE.MeshBasicMaterial({ color: PAL.white }), N * 2);
    this.pupils = mk(pupGeo, new THREE.MeshBasicMaterial({ color: PAL.ink }), N * 2);
    this.eyeL = [-1, 1].map((sgn) => {
      const az = CR.eyeAz * sgn, el = CR.eyeEl;
      const p = new THREE.Vector3(Math.sin(az) * Math.cos(el) * R, R * CR.squash + Math.sin(el) * R * CR.squash, Math.cos(az) * Math.cos(el) * R).multiplyScalar(0.97);
      return new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(-el * 0.7, az, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    }) as [THREE.Matrix4, THREE.Matrix4];

    const vc = (parts: [THREE.BufferGeometry, string][]) => {
      const gs = parts.map(([g]) => posNormal(g));
      const out = merge(gs);
      const col = new Float32Array(out.getAttribute('position').count * 3);
      let o = 0; const c = new THREE.Color();
      parts.forEach(([, hex], k) => { c.set(hex); const n = gs[k].getAttribute('position').count; for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], (o + i) * 3); o += n; });
      out.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return out;
    };
    const DARK = '#3A2F3A', IVORY = '#F1E4C4', STEEL = '#C3CBD6', STEEL_D = '#6E7887';

    // Brute: heavy brow, two ivory horns out to the sides, back plates. Horns carry the silhouette.
    const brow = new THREE.TorusGeometry(R * 0.74, 0.07, 5, 12, Math.PI * 0.62);
    brow.rotateZ(Math.PI * 0.19); brow.rotateX(-Math.PI / 2 + 0.95); brow.translate(0, top * 0.96, R * 0.02);
    const bruteParts: [THREE.BufferGeometry, string][] = [[brow, DARK]];
    for (const s of [-1, 1]) {
      const horn = new THREE.ConeGeometry(0.075, 0.34, 6); horn.translate(0, 0.17, 0); horn.rotateZ(-s * 1.0); horn.rotateX(-0.2);
      horn.translate(s * R * 0.62, top * 0.8, -0.02);
      bruteParts.push([faceted(horn), IVORY]);
    }
    for (let i = 0; i < 3; i++) { const p = new THREE.ConeGeometry(0.1, 0.24, 4); p.rotateX(-0.5 - i * 0.35); p.translate(0, top * (0.98 - i * 0.16), -R * (0.2 + i * 0.36)); bruteParts.push([faceted(p), DARK]); }
    this.brute = mk(vc(bruteParts), toonNew(PAL.white, { vertexColors: true }), N);

    // Bomber: a big black bomb with an orange band strapped high on its back, fuse up, and a live spark.
    const bombBall = new THREE.SphereGeometry(0.25, 12, 9);
    const band = new THREE.TorusGeometry(0.25, 0.045, 5, 14); band.rotateX(Math.PI / 2);
    const fuse = new THREE.CylinderGeometry(0.03, 0.03, 0.18, 4); fuse.translate(0, 0.32, 0);
    const cap = new THREE.CylinderGeometry(0.08, 0.1, 0.08, 6); cap.translate(0, 0.25, 0);
    this.bomb = mk(vc([[bombBall, '#23262E'], [band, PAL.danger], [cap, '#4A4F5A'], [fuse, PAL.wood]]), toonNew(PAL.white, { vertexColors: true }), N, true);
    this.bombL.makeTranslation(0, top * 0.92, -R * 0.62);
    this.spark = mk(faceted(new THREE.OctahedronGeometry(0.12, 0)), new THREE.MeshBasicMaterial({ color: '#FFB25C' }), N);
    this.sparkL.makeTranslation(0, top * 0.92 + 0.44, -R * 0.62);

    // Guard: a flat steel shield plate held out front-left (a hard rectangle in the silhouette) and a helmet.
    const plate = new THREE.BoxGeometry(0.4, 0.46, 0.06); plate.rotateY(0.45); plate.translate(-R * 0.62, R * CR.squash * 0.95, R * 0.72);
    const boss = new THREE.SphereGeometry(0.07, 8, 6); boss.scale(1, 1, 0.6); boss.translate(-R * 0.62 + 0.03, R * CR.squash * 0.95, R * 0.72 + 0.05);
    const rimT = new THREE.BoxGeometry(0.44, 0.05, 0.08); rimT.rotateY(0.45); rimT.translate(-R * 0.62, R * CR.squash * 0.95 + 0.23, R * 0.72);
    const dome = new THREE.SphereGeometry(R * 0.66, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); dome.scale(1, 0.8, 1); dome.translate(0, top - 0.12, -0.05);
    const spike = new THREE.ConeGeometry(0.05, 0.18, 4); spike.translate(0, top - 0.12 + R * 0.53, -0.05);
    this.guard = mk(vc([[faceted(plate), STEEL], [boss, STEEL_D], [faceted(rimT), STEEL_D], [dome, STEEL], [spike, STEEL_D]]), toonNew(PAL.white, { vertexColors: true }), N);

    // Mutation accessories.
    const accGeo: Record<string, THREE.BufferGeometry> = {};
    { const f: [THREE.BufferGeometry, string][] = [];
      for (const s of [-1, 1]) { const c = new THREE.ConeGeometry(0.045, 0.14, 4); c.rotateX(Math.PI); c.translate(s * 0.08, R * CR.squash * 0.78, R * 0.93); f.push([c, '#FFFFFF']); }
      accGeo.fangs = vc(f); }
    { const h = new THREE.ConeGeometry(0.07, 0.34, 6); h.translate(0, 0.17, 0); h.rotateX(1.05); h.translate(0, top * 0.8, R * 0.62); accGeo.horn = vc([[faceted(h), STEEL]]); }
    { const st = new THREE.CylinderGeometry(0.018, 0.018, 0.26, 4); st.rotateX(-0.3); st.translate(0, top + 0.1, -0.02);
      const bulb = new THREE.SphereGeometry(0.075, 8, 6); bulb.translate(0, top + 0.24, -0.06);
      accGeo.antenna = vc([[st, PAL.ink], [bulb, '#F2FFB0']]); }
    { const f: [THREE.BufferGeometry, string][] = [];
      [[-0.14, 0.95, -0.1, 0.5], [0.12, 1.0, -0.18, -0.4], [0.0, 0.9, -0.3, 0.1]].forEach(([x, y, z, rz]) => { const o = new THREE.OctahedronGeometry(0.09, 0); o.scale(0.7, 1.5, 0.7); o.rotateZ(rz); o.translate(x, top * y, z); f.push([faceted(o), PAL.frost]); });
      accGeo.crystals = vc(f); }
    { const fl = new THREE.ConeGeometry(0.09, 0.3, 5); fl.translate(0, 0.15, 0); fl.rotateX(-0.9); fl.translate(0, top * 0.62, -R * 0.9);
      const core = new THREE.ConeGeometry(0.05, 0.18, 5); core.translate(0, 0.09, 0); core.rotateX(-0.9); core.translate(0, top * 0.62 + 0.02, -R * 0.92);
      accGeo.ember = vc([[faceted(fl), PAL.danger], [faceted(core), '#FFE08A']]); }
    { const bolt = new THREE.BufferGeometry();
      const pts = [[0, 0.2], [0.09, 0.02], [0.02, 0.02], [0.07, -0.2], [-0.08, 0.04], [-0.01, 0.04]];
      const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      bolt.copy(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false })); bolt.rotateY(Math.PI / 2); bolt.translate(R * 0.98, R * CR.squash * 1.1, 0);
      const b2 = bolt.clone(); b2.scale(-1, 1, 1);
      accGeo.bolt = vc([[bolt, '#FFE66B'], [b2, '#FFE66B']]); }
    this.acc = ACCESSORY.map(({ name }) => { const im = mk(accGeo[name], toonNew(PAL.white, { vertexColors: true }), N); im.visible = false; return im; });

    // Status overlays that keep the team hue: stun stars orbit the head, a frost shell crusts a slowed body.
    this.stars = mk(faceted(new THREE.OctahedronGeometry(0.09, 0)), new THREE.MeshBasicMaterial({ color: '#FFF3A0' }), N * 2);
    const shell = faceted(new THREE.IcosahedronGeometry(R * 1.14, 1)); shell.scale(1, CR.squash, 1); shell.translate(0, R * CR.squash, 0);
    this.frost = mk(shell, new THREE.MeshBasicMaterial({ color: PAL.frost, transparent: true, opacity: 0.45, depthWrite: false }), N);
    this.frost.renderOrder = 6;

    // Flight trail: two fading ghosts behind each thrown critter so a volley reads as shots, not a caterpillar.
    const ghost = posNormal(blobGeometry(R, 10, 8, CR.squash));
    this.trail = mk(ghost, new THREE.MeshBasicMaterial({ color: PAL.white, transparent: true, opacity: 0.32, depthWrite: false }), N * 2, true);
    this.trail.renderOrder = 5;

    // Recall '!' marks: billboards over recalled critters.
    const mg = new THREE.PlaneGeometry(0.32, 0.46);
    this.marks = mk(mg, new THREE.MeshBasicMaterial({ map: exclaimTexture(), transparent: true, depthTest: false, depthWrite: false }), N);
    this.marks.renderOrder = 58;

    // Contact shadows: crisp dark dot, shrinking and fading with height (per-instance alpha in instanceColor.r).
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
    const smat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(PAL.ink) } }, vertexShader: shadowVert, fragmentShader: shadowFrag, transparent: true, depthWrite: false });
    smat.polygonOffset = true; smat.polygonOffsetFactor = -1; smat.polygonOffsetUnits = -1;
    this.shadow = mk(sg, smat, N, true);
    this.shadow.renderOrder = 2;
    this.shared = [this.eyes, this.pupils, this.brute, this.bomb, this.spark, this.guard, this.shadow, this.stars, this.frost, this.trail, this.marks, ...this.acc];
    this.setColors(false);
  }

  setColors(colorBlind: boolean): void {
    for (const t of [0, 1] as const) {
      const tc = teamColors(t, colorBlind);
      this.teamBody[t].set(tc.body); this.teamLight[t].set(tc.light); this.teamDark[t].set(tc.dark);
      this.outlineMats[t].color.set(tc.dark);
    }
  }

  /** Which Mutation accessories each team's critters wear (from TeamMods, fixed for the match). */
  setMods(mods: readonly [TeamMods, TeamMods] | undefined): void {
    for (const t of [0, 1] as const) this.accOn[t] = ACCESSORY.map(({ mod }) => !!mods?.[t]?.[mod]);
  }

  reset(): void { this.alive.fill(0); this.target.fill(-1); this.landT.fill(-99); this.markT.fill(-99); }

  /** Landing squash for a critter slot. */
  land(slot: number): void { if (slot >= 0 && slot < MAX_CRITTERS) this.landT[slot] = this.time; }
  /** Recall: a '!' and a little hop. */
  exclaim(slot: number): void { if (slot >= 0 && slot < MAX_CRITTERS) this.markT[slot] = this.time + Math.random() * 0.12; }

  /** Interpolated ground position of a critter slot (for effects), into out. */
  posOf(world: World, slot: number, out: { x: number; y: number }): typeof out {
    const c = world.critters[slot]; out.x = c.x; out.y = c.y; return out;
  }

  update(world: World, alpha: number, dt: number, time: number, camera: THREE.Camera): void {
    this.time = time;
    camera.getWorldQuaternion(this.camQ);
    const cs = world.critters;
    const counts = this.counts;
    counts[0] = 0; counts[1] = 0;
    let ne = 0, nbr = 0, nbomb = 0, ng = 0, ns = 0, nst = 0, nfr = 0, ntr = 0, nmk = 0;
    const nacc = this.accN; nacc.fill(0);
    const lookK = approach(CR.lookRate, dt), spdK = approach(10, dt);
    this.frame++;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.alive) { this.alive[i] = 0; continue; }
      const x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha;
      if (!this.alive[i]) {
        this.alive[i] = 1; this.born[i] = time; this.lastX[i] = x; this.lastY[i] = y; this.spd[i] = 0;
        this.hop[i] = c.tint; this.yaw[i] = (c.tint - 0.5) * 1.2; this.target[i] = -1; this.landT[i] = -99; this.markT[i] = -99;
      }
      const dx = x - this.lastX[i], dy = y - this.lastY[i], moved = Math.sqrt(dx * dx + dy * dy);
      this.lastX[i] = x; this.lastY[i] = y;
      if (dt > 0) this.spd[i] += (Math.min(moved / dt, 30) - this.spd[i]) * spdK;
      if ((i & 3) === (this.frame & 3)) this.target[i] = this.nearestEnemy(world, c, x, y);

      const team = c.team as Team, kl = CR.kind[c.kind], k = kl.s;
      let h = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0, wantYaw = this.yaw[i];
      const moving = this.spd[i] > CR.moveSpeed;
      const flying = c.state === 'fly';
      let u = 0, fdx = 0, fdy = 0, fdist = 0;
      if (flying) {
        u = c.flightDur > 0 ? Math.min(1, Math.max(0, (c.flightT - DT + alpha * DT) / c.flightDur)) : 1;
        fdx = c.tx - c.sx; fdy = c.ty - c.sy; fdist = Math.sqrt(fdx * fdx + fdy * fdy);
        h = flightHeight(u, fdist, c.flat);
        wantYaw = Math.atan2(fdx, fdy);
        pitch = -Math.atan(flightSlope(u, fdist, c.flat));
        const v = c.flightDur > 0 ? fdist / c.flightDur : 0;
        const st = 1 + Math.min(0.45, v * 0.026);
        sz = st; sx = sy = 1 / Math.sqrt(st); // stretched along the flight, volume kept
        roll = Math.sin(u * Math.PI * 2 + c.tint * 6.28) * 0.35;
        this.yaw[i] = wantYaw; // no lag in the air: the body points where it flies
      } else {
        if (moving) {
          wantYaw = Math.atan2(dx, dy);
          this.hop[i] += moved * CR.hopsPerUnit;
        } else if (this.target[i] >= 0) {
          const e = this.target[i] < MAX_CRITTERS ? cs[this.target[i]] : world.heroes[this.target[i] - MAX_CRITTERS];
          wantYaw = Math.atan2(e.x - x, e.y - y);
        } else if (c.state === 'garrison' && c.building >= 0) {
          const b = world.buildings[c.building];
          wantYaw = Math.atan2(x - b.x, y - b.y) + Math.sin(time * 0.7 + c.tint * 9) * 0.5;
        } else {
          wantYaw = (c.tint - 0.5) * 1.4; // face the viewer, each a little differently
        }
        // Finish the current hop when stopping, so feet land.
        const f = this.hop[i] - Math.floor(this.hop[i]);
        if (!moving && f > 0.02) this.hop[i] += Math.min(1 - f, dt * 4);
        const ph = this.hop[i] - Math.floor(this.hop[i]);
        const air = Math.sin(Math.PI * ph);
        if (moving || ph > 0.02) {
          h = air * CR.hopHeight * k;
          sy = ph < 0.12 || ph > 0.88 ? 0.84 : 1 + 0.12 * air; // squash at take-off/landing, stretch in the air
        } else if (c.state === 'hold') {
          const a = Math.abs(Math.sin(time * 13 + c.tint * 20));
          h = a * 0.07; sy = 1 + (a - 0.5) * 0.14;
          wantYaw += Math.sin(time * 17 + c.tint * 30) * 0.35;
        } else if (c.state === 'garrison') {
          sy = 1 + Math.sin(time * 1.7 + c.tint * 6.28) * 0.05;
        } else {
          sy = 1 + Math.sin(time * 2.6 + c.tint * 6.28) * 0.04;
          roll = Math.sin(time * 1.3 + c.tint * 12) * 0.06;
        }
        // Landing squash (from the land event): flatten and spring back.
        const lt = time - this.landT[i];
        if (lt >= 0 && lt < 0.3) { const w = Math.exp(-lt * 14) * Math.cos(lt * 30); sy *= 1 - CR.landSquash * 1.6 * w; }
        // Recall: a quick surprised hop.
        const mt = time - this.markT[i];
        if (mt >= 0 && mt < 0.3) h += Math.sin((mt / 0.3) * Math.PI) * 0.35 * k;
        if (c.stunT > 0) { sy = 0.72; roll = Math.sin(time * 9 + c.tint * 7) * 0.22; h = 0; }
        sx = sz = 1 / Math.sqrt(sy);
        this.yaw[i] += angleDelta(this.yaw[i], wantYaw) * lookK;
      }
      // Pop in with a little overshoot when hatched.
      const age = (time - this.born[i]) / CR.popTime;
      const pop = age >= 1 ? 1 : easeOutBack(Math.max(0, age));
      const ks = k * pop;

      // body matrix: T(ground + centre height) * R * S * T(-centre)
      const cy = CR.radius * CR.squash * ks * sy * kl.h;
      this.pos.set(sceneX(x), h + cy, sceneZ(y));
      this.eul.set(pitch, this.yaw[i], roll);
      this.quat.setFromEuler(this.eul);
      this.scl.set(sx * ks * kl.w, sy * ks * kl.h, sz * ks * kl.w);
      this.m.compose(this.pos, this.quat, this.scl).multiply(this.centre);
      const bi = counts[team]++;
      this.body[team].setMatrixAt(bi, this.m);
      this.col.copy(this.teamBody[team]);
      if (c.kind === 'runt') this.col.lerp(this.teamLight[team], 0.22);
      else if (c.kind === 'brute') this.col.lerp(this.teamDark[team], 0.14);
      if (c.slowT > 0) this.col.lerp(this.frostC, 0.18);
      this.body[team].setColorAt(bi, this.col);

      // Eyes: turned back toward the camera if the body faces away, so they never become slivers.
      const yawN = angleDelta(0, this.yaw[i]);
      const clamped = yawN > CR.gazeMax ? CR.gazeMax : yawN < -CR.gazeMax ? -CR.gazeMax : yawN;
      this.rotY.makeRotationY(clamped - yawN);
      const lead = Math.max(-1, Math.min(1, angleDelta(this.yaw[i], wantYaw) * 2)) * CR.eyeR * 0.35;
      const blink = ((time * 0.23 + c.tint * 7.3) % 1) < 0.025 ? 0.12 : 1;
      const eyeY = flying ? 0.38 : blink; // squint in the air
      const ek = kl.eye;
      for (let e = 0; e < 2; e++) {
        this.m2.multiplyMatrices(this.m, this.rotY).multiply(this.eyeL[e]);
        if (ek !== 1 || eyeY < 1) this.m2.scale(this.scl.set(ek, ek * eyeY, ek));
        this.eyes.setMatrixAt(ne, this.m2);
        this.m3.makeTranslation(lead, -CR.eyeR * 0.08, CR.eyeR * 0.5);
        this.m2.multiply(this.m3);
        this.pupils.setMatrixAt(ne, this.m2);
        ne++;
      }
      if (c.kind === 'brute') this.brute.setMatrixAt(nbr++, this.m);
      else if (c.kind === 'bomber') {
        this.m2.multiplyMatrices(this.m, this.bombL); this.bomb.setMatrixAt(nbomb, this.m2);
        this.bomb.setColorAt(nbomb, world.mods?.[team]?.cryoBombs ? this.cryo : this.white);
        const fl = 0.7 + 0.6 * Math.abs(Math.sin(time * 23 + i * 1.7));
        this.m2.multiplyMatrices(this.m, this.sparkL); this.m2.scale(this.scl.set(fl, fl, fl)); this.spark.setMatrixAt(nbomb, this.m2);
        nbomb++;
      } else if (c.kind === 'guard') this.guard.setMatrixAt(ng++, this.m);
      else {
        const on = this.accOn[team];
        for (let a = 0; a < on.length; a++) if (on[a]) {
          if (ACCESSORY[a].name === 'ember') { const fl = 0.85 + 0.3 * Math.abs(Math.sin(time * 17 + i)); this.m2.copy(this.m).scale(this.scl.set(1, fl, 1)); this.acc[a].setMatrixAt(nacc[a]++, this.m2); }
          else this.acc[a].setMatrixAt(nacc[a]++, this.m);
        }
      }

      // Status overlays.
      if (c.stunT > 0 && !flying) {
        for (let s = 0; s < 2; s++) {
          const a = time * 6 + s * Math.PI + c.tint * 6;
          this.m2.makeRotationY(a * 1.5);
          this.m2.setPosition(sceneX(x) + Math.cos(a) * 0.3 * ks, cy * 2 + 0.16, sceneZ(y) + Math.sin(a) * 0.3 * ks);
          this.stars.setMatrixAt(nst++, this.m2);
        }
      }
      if (c.slowT > 0) this.frost.setMatrixAt(nfr++, this.m);

      if (flying) {
        // two ghosts back along the arc
        for (let g = 1; g <= 2; g++) {
          const ug = u - g * 0.07;
          if (ug <= 0) break;
          const gx = c.sx + fdx * ug, gy = c.sy + fdy * ug, gh = flightHeight(ug, fdist, c.flat);
          const gs = ks * (1 - g * 0.22);
          this.m2.compose(this.pos.set(sceneX(gx), gh + CR.radius * CR.squash * gs, sceneZ(gy)), this.quat, this.scl.set(sx * gs, sy * gs, sz * gs * 1.15)).multiply(this.centre);
          this.trail.setMatrixAt(ntr, this.m2);
          this.trail.setColorAt(ntr, this.teamLight[team]);
          ntr++;
        }
      }

      const mt = time - this.markT[i];
      if (mt >= 0 && mt < CR.exclaimTime) {
        const pk = mt < 0.12 ? easeOutBack(mt / 0.12) : 1 - Math.max(0, (mt - CR.exclaimTime + 0.15) / 0.15);
        this.m2.compose(this.pos.set(sceneX(x), h + cy * 2 + 0.42, sceneZ(y)), this.camQ, this.scl.setScalar(Math.max(0.001, pk)));
        this.marks.setMatrixAt(nmk++, this.m2);
      }

      // Contact shadow: crisp, shrinking and fading as the body rises, kept clear under it.
      const ss = CR.radius * 2.1 * ks * kl.w * (1 - Math.min(0.55, h * 0.2));
      this.m2.makeScale(ss, 1, ss); this.m2.setPosition(sceneX(x), 0.02, sceneZ(y));
      this.shadow.setMatrixAt(ns, this.m2);
      this.shadow.setColorAt(ns, this.alphaC.setRGB(CR.shadowAlpha * (flying ? Math.max(0.35, 1 - h * 0.18) + 0.15 : 1), 0, 0));
      ns++;
    }
    for (let t = 0; t < 2; t++) {
      this.body[t].count = counts[t]; this.outline[t].count = counts[t];
      this.body[t].instanceMatrix.needsUpdate = true; this.body[t].instanceColor!.needsUpdate = true;
    }
    const setN = (im: THREE.InstancedMesh, n: number) => { im.count = n; im.visible = n > 0; };
    setN(this.eyes, ne); setN(this.pupils, ne); setN(this.brute, nbr); setN(this.bomb, nbomb); setN(this.spark, nbomb); setN(this.guard, ng);
    setN(this.shadow, ns); setN(this.stars, nst); setN(this.frost, nfr); setN(this.trail, ntr); setN(this.marks, nmk);
    for (let a = 0; a < this.acc.length; a++) setN(this.acc[a], nacc[a]);
    for (let k = 0; k < this.shared.length; k++) this.shared[k].instanceMatrix.needsUpdate = true;
    this.shadow.instanceColor!.needsUpdate = true; this.trail.instanceColor!.needsUpdate = true; this.bomb.instanceColor!.needsUpdate = true;
  }
  private readonly accN = new Int32Array(ACCESSORY.length);

  /** Index of the nearest enemy within look range: critter slot, or MAX_CRITTERS + team for a King. -1 if none. */
  private nearestEnemy(world: World, c: Critter, x: number, y: number): number {
    let best = -1, bd = CR.lookRange * CR.lookRange;
    const cs = world.critters;
    for (let j = 0; j < cs.length; j++) {
      const o = cs[j];
      if (!o.alive || o.team === c.team || o.state === 'fly') continue;
      const ex = o.x - x, ey = o.y - y, d = ex * ex + ey * ey;
      if (d < bd) { bd = d; best = j; }
    }
    const hero = world.heroes[1 - c.team];
    if (hero.alive) { const ex = hero.x - x, ey = hero.y - y; if (ex * ex + ey * ey < bd) best = MAX_CRITTERS + (1 - c.team); }
    return best;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh) return;
      m.geometry.dispose();
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map?.dispose(); mat.dispose();
    });
  }
}

/** '!' tag: white rounded card, ink outline and mark. */
function exclaimTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 92;
  const g = c.getContext('2d')!;
  g.fillStyle = PAL.ink; g.beginPath(); g.roundRect(4, 4, 56, 84, 20); g.fill();
  g.fillStyle = PAL.white; g.beginPath(); g.roundRect(10, 10, 44, 72, 15); g.fill();
  g.fillStyle = PAL.ink; g.beginPath(); g.roundRect(26, 18, 12, 38, 6); g.fill();
  g.beginPath(); g.arc(32, 68, 7, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
