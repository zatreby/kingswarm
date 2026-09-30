// Critters: instanced squashy blobs with big eyes. One body+outline InstancedMesh per team (Blue round,
// Red with a pointed tuft), shared eye/pupil/gear/shadow meshes. All animation is presentation-only,
// derived from critter state + per-slot cosmetic state kept here. No allocations per frame.
import * as THREE from 'three';
import { MAX_CRITTERS, DT } from '../sim/types';
import type { World, Critter, CritterKind, Team } from '../sim/types';
import { PAL, teamColors } from './palette';
import { toonNew, outlineMaterial, radialTexture } from './materials';
import { blobGeometry, merge, posNormal } from './shapes';
import { UNIT_STENCIL } from './rings';
import { sceneX, sceneZ, flightHeight, flightSlope, angleDelta, approach } from './mapping';

export const CR = {
  radius: 0.3,
  /** Body height / width: a touch taller than round so the 56 degree camera sees a face, not a disc. */
  squash: 1.08,
  kindScale: { critter: 1, runt: 0.74, brute: 1.34, bomber: 1.02, guard: 1.04 } as Record<CritterKind, number>,
  outline: 0.045,
  hopHeight: 0.2,
  hopsPerUnit: 0.9,
  moveSpeed: 0.45,
  lookRate: 12,
  lookRange: 3.5,
  eyeR: 0.11, pupilR: 0.06, eyeAz: 0.42, eyeEl: 0.72,
  popTime: 0.22,
  shadowOpacity: 0.34,
  stunTint: '#FFF6C8', stunMix: 0.45,
  frostMix: 0.55,
} as const;

export class Critters {
  readonly group = new THREE.Group();
  private readonly body: [THREE.InstancedMesh, THREE.InstancedMesh];
  private readonly outline: [THREE.InstancedMesh, THREE.InstancedMesh];
  private readonly outlineMats: [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial];
  private readonly eyes: THREE.InstancedMesh;
  private readonly pupils: THREE.InstancedMesh;
  private readonly brow: THREE.InstancedMesh;
  private readonly bomb: THREE.InstancedMesh;
  private readonly spark: THREE.InstancedMesh;
  private readonly helmet: THREE.InstancedMesh;
  private readonly shadow: THREE.InstancedMesh;

  // per-slot presentation state
  private readonly alive = new Uint8Array(MAX_CRITTERS);
  private readonly born = new Float32Array(MAX_CRITTERS);
  private readonly yaw = new Float32Array(MAX_CRITTERS);
  private readonly lastX = new Float32Array(MAX_CRITTERS);
  private readonly lastY = new Float32Array(MAX_CRITTERS);
  private readonly spd = new Float32Array(MAX_CRITTERS);
  private readonly hop = new Float32Array(MAX_CRITTERS);
  private readonly target = new Int16Array(MAX_CRITTERS).fill(-1);
  private frame = 0;
  private readonly counts = new Int32Array(2);
  private readonly shared: THREE.InstancedMesh[];

  // scratch
  private readonly m = new THREE.Matrix4();
  private readonly m2 = new THREE.Matrix4();
  private readonly m3 = new THREE.Matrix4();
  private readonly centre = new THREE.Matrix4().makeTranslation(0, -CR.radius * CR.squash, 0);
  private readonly eyeL: [THREE.Matrix4, THREE.Matrix4];
  private readonly browL = new THREE.Matrix4();
  private readonly bombL = new THREE.Matrix4();
  private readonly sparkL = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly scl = new THREE.Vector3();
  private readonly eul = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly col = new THREE.Color();
  private readonly teamBody = [new THREE.Color(), new THREE.Color()];
  private readonly teamLight = [new THREE.Color(), new THREE.Color()];
  private readonly teamDark = [new THREE.Color(), new THREE.Color()];
  private readonly stun = new THREE.Color(CR.stunTint);
  private readonly frost = new THREE.Color(PAL.frost);

  constructor() {
    const R = CR.radius, N = MAX_CRITTERS;
    const blueGeo = posNormal(blobGeometry(R, 16, 12, CR.squash));
    // Red's shape cue: a tall swept-back tuft that breaks the round silhouette even from above.
    const tuft = new THREE.ConeGeometry(0.1, 0.34, 6);
    tuft.translate(0, 0.17, 0);
    tuft.rotateX(-0.55);
    tuft.translate(0, R * CR.squash * 2 - 0.08, -0.1);
    const redGeo = merge([blobGeometry(R, 16, 12, CR.squash), tuft]);
    const stencil = { stencilWrite: true, stencilRef: UNIT_STENCIL, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp } as const;
    const bodyMat = toonNew(PAL.white, { ...stencil });
    this.outlineMats = [outlineMaterial(PAL.blueDark, CR.outline), outlineMaterial(PAL.redDark, CR.outline)];
    for (const m of this.outlineMats) Object.assign(m, stencil);
    const mk = (g: THREE.BufferGeometry, mat: THREE.Material, n: number, shadow = false) => {
      const im = new THREE.InstancedMesh(g, mat, n);
      im.frustumCulled = false; im.count = 0; im.castShadow = shadow; im.receiveShadow = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(im);
      return im;
    };
    this.body = [mk(blueGeo, bodyMat, N), mk(redGeo, bodyMat, N)];
    for (const b of this.body) { b.setColorAt(0, this.col.set(PAL.white)); b.instanceColor!.setUsage(THREE.DynamicDrawUsage); b.receiveShadow = true; }
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

    // Brute: heavy brow ridge + back plates (team-dark via instance colour).
    // Brow: a thick ridge hugging the forehead above the eyes.
    const browBar = new THREE.TorusGeometry(R * 0.72, 0.06, 5, 12, Math.PI * 0.62);
    browBar.rotateZ(Math.PI * 0.19); browBar.rotateX(-Math.PI / 2 + 0.95); browBar.translate(0, R * CR.squash * 1.93, R * 0.02);
    const plates: THREE.BufferGeometry[] = [browBar];
    for (let i = 0; i < 3; i++) { const p = new THREE.ConeGeometry(0.095, 0.22, 4); p.rotateX(-0.5 - i * 0.35); p.translate(0, R * CR.squash * (1.98 - i * 0.3), -R * (0.15 + i * 0.36)); plates.push(p); }
    this.brow = mk(merge(plates), toonNew(PAL.white), N, false);
    this.brow.setColorAt(0, this.col); this.brow.instanceColor!.setUsage(THREE.DynamicDrawUsage);

    // Bomber: a black bomb with an orange band strapped on its back, fuse up, and a flickering spark.
    const bombBall = new THREE.SphereGeometry(0.17, 10, 8);
    const band = new THREE.TorusGeometry(0.17, 0.035, 5, 12); band.rotateX(Math.PI / 2);
    const fuse = new THREE.CylinderGeometry(0.025, 0.025, 0.14, 4); fuse.translate(0, 0.22, 0);
    const bombGeo = merge([bombBall, band, fuse]);
    const bc = new Float32Array(bombGeo.getAttribute('position').count * 3);
    const ballN = posNormal(bombBall).getAttribute('position').count, bandN = posNormal(band).getAttribute('position').count;
    const dark = new THREE.Color('#23262E'), orange = new THREE.Color(PAL.danger), rope = new THREE.Color(PAL.wood);
    for (let i = 0; i < bc.length / 3; i++) { const c = i < ballN ? dark : i < ballN + bandN ? orange : rope; bc.set([c.r, c.g, c.b], i * 3); }
    bombGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    this.bomb = mk(bombGeo, toonNew(PAL.white, { vertexColors: true }), N);
    this.bombL.makeTranslation(0, R * CR.squash * 1.9, -R * 0.5);
    this.spark = mk(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ color: '#FFD76A' }), N);
    this.sparkL.makeTranslation(0, R * CR.squash * 1.9 + 0.32, -R * 0.5);

    // Guard: a little steel helmet with a spike.
    const dome = new THREE.SphereGeometry(R * 0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); dome.translate(0, R * CR.squash * 2 - 0.1, -0.04);
    const rim = new THREE.TorusGeometry(R * 0.6, 0.03, 4, 14); rim.rotateX(Math.PI / 2); rim.translate(0, R * CR.squash * 2 - 0.1, -0.04);
    const spike = new THREE.ConeGeometry(0.05, 0.2, 4); spike.translate(0, R * CR.squash * 2 + R * 0.62 - 0.02, -0.04);
    this.helmet = mk(merge([dome, rim, spike]), toonNew('#B9C2CF'), N);

    // Blob shadows under every unit: anchor to the ground and keep flight height readable.
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
    const smat = new THREE.MeshBasicMaterial({ color: PAL.ink, map: radialTexture(64), transparent: true, opacity: CR.shadowOpacity, depthWrite: false });
    smat.polygonOffset = true; smat.polygonOffsetFactor = -1; smat.polygonOffsetUnits = -1;
    this.shadow = mk(sg, smat, N);
    this.shadow.renderOrder = 2;
    this.shared = [this.eyes, this.pupils, this.brow, this.bomb, this.spark, this.helmet, this.shadow];
    this.setColors(false);
  }

  setColors(colorBlind: boolean): void {
    for (const t of [0, 1] as const) {
      const tc = teamColors(t, colorBlind);
      this.teamBody[t].set(tc.body); this.teamLight[t].set(tc.light); this.teamDark[t].set(tc.dark);
      this.outlineMats[t].color.set(tc.dark);
    }
  }

  reset(): void { this.alive.fill(0); this.target.fill(-1); }

  update(world: World, alpha: number, dt: number, time: number): void {
    const cs = world.critters;
    const counts = this.counts;
    counts[0] = 0; counts[1] = 0;
    let ne = 0, nb = 0, nbomb = 0, nh = 0, ns = 0;
    const kHop = CR.hopsPerUnit, lookK = approach(CR.lookRate, dt), spdK = approach(10, dt);
    this.frame++;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.alive) { this.alive[i] = 0; continue; }
      let x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha;
      if (!this.alive[i]) {
        this.alive[i] = 1; this.born[i] = time; this.lastX[i] = x; this.lastY[i] = y; this.spd[i] = 0;
        this.hop[i] = c.tint; this.yaw[i] = (c.tint - 0.5) * 1.2; this.target[i] = -1;
      }
      const dx = x - this.lastX[i], dy = y - this.lastY[i], moved = Math.sqrt(dx * dx + dy * dy);
      this.lastX[i] = x; this.lastY[i] = y;
      if (dt > 0) this.spd[i] += (Math.min(moved / dt, 30) - this.spd[i]) * spdK;
      if ((i & 3) === (this.frame & 3)) this.target[i] = this.nearestEnemy(world, c, x, y);

      const team = c.team as Team, k = CR.kindScale[c.kind];
      let h = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0, wantYaw = this.yaw[i];
      const moving = this.spd[i] > CR.moveSpeed;
      if (c.state === 'fly') {
        const u = c.flightDur > 0 ? Math.min(1, Math.max(0, (c.flightT - DT + alpha * DT) / c.flightDur)) : 1;
        const fdx = c.tx - c.sx, fdy = c.ty - c.sy, dist = Math.sqrt(fdx * fdx + fdy * fdy);
        h = flightHeight(u, dist, c.flat);
        wantYaw = Math.atan2(fdx, fdy);
        pitch = -Math.atan(flightSlope(u, dist, c.flat));
        const v = c.flightDur > 0 ? dist / c.flightDur : 0;
        const st = 1 + Math.min(0.4, v * 0.022);
        sz = st; sx = sy = 1 / Math.sqrt(st);
        roll = Math.sin(u * Math.PI * 2 + c.tint * 6.28) * 0.35;
        this.yaw[i] = wantYaw; // no lag in the air: the body points where it flies
      } else {
        if (moving) {
          wantYaw = Math.atan2(dx, dy);
          this.hop[i] += moved * kHop;
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
        if (c.stunT > 0) { sy = 0.68; roll = Math.sin(time * 9 + c.tint * 7) * 0.2; h = 0; }
        sx = sz = 1 / Math.sqrt(sy);
        this.yaw[i] += angleDelta(this.yaw[i], wantYaw) * lookK;
      }
      // Pop in with a little overshoot when hatched.
      const age = (time - this.born[i]) / CR.popTime;
      const pop = age >= 1 ? 1 : easeOutBack(Math.max(0, age));
      const ks = k * pop;

      // body matrix: T(ground + centre height) * R * S * T(-centre)
      const cy = CR.radius * CR.squash * ks * sy;
      this.pos.set(sceneX(x), h + cy, sceneZ(y));
      this.eul.set(pitch, this.yaw[i], roll);
      this.quat.setFromEuler(this.eul);
      this.scl.set(sx * ks, sy * ks, sz * ks);
      this.m.compose(this.pos, this.quat, this.scl).multiply(this.centre);
      const bi = counts[team]++;
      this.body[team].setMatrixAt(bi, this.m);
      this.col.copy(this.teamBody[team]);
      if (c.kind === 'runt') this.col.lerp(this.teamLight[team], 0.35);
      else if (c.kind === 'brute') this.col.lerp(this.teamDark[team], 0.12);
      if (c.stunT > 0) this.col.lerp(this.stun, CR.stunMix);
      if (c.slowT > 0) this.col.lerp(this.frost, CR.frostMix);
      this.body[team].setColorAt(bi, this.col);

      // eyes + pupils; pupils lead toward where the body is turning
      const lead = Math.max(-1, Math.min(1, angleDelta(this.yaw[i], wantYaw) * 2)) * CR.eyeR * 0.35;
      const blink = ((time * 0.23 + c.tint * 7.3) % 1) < 0.025 ? 0.12 : 1;
      for (let e = 0; e < 2; e++) {
        this.m2.multiplyMatrices(this.m, this.eyeL[e]);
        if (blink < 1) this.m2.scale(this.scl.set(1, blink, 1));
        this.eyes.setMatrixAt(ne, this.m2);
        this.m3.makeTranslation(lead, -CR.eyeR * 0.08, CR.eyeR * 0.5);
        this.m2.multiply(this.m3);
        this.pupils.setMatrixAt(ne, this.m2);
        ne++;
      }
      if (c.kind === 'brute') { this.m2.copy(this.m); this.brow.setMatrixAt(nb, this.m2); this.brow.setColorAt(nb, this.teamDark[team]); nb++; }
      else if (c.kind === 'bomber') {
        this.m2.multiplyMatrices(this.m, this.bombL); this.bomb.setMatrixAt(nbomb, this.m2);
        const fl = 0.75 + 0.5 * Math.abs(Math.sin(time * 23 + i));
        this.m2.multiplyMatrices(this.m, this.sparkL); this.m2.scale(this.scl.set(fl, fl, fl)); this.spark.setMatrixAt(nbomb, this.m2);
        nbomb++;
      } else if (c.kind === 'guard') { this.helmet.setMatrixAt(nh++, this.m); }

      // blob shadow shrinks and fades as the body rises
      const ss = CR.radius * 2.3 * ks * (1 - Math.min(0.5, h * 0.22));
      this.m2.makeScale(ss, 1, ss); this.m2.setPosition(sceneX(x), 0.02, sceneZ(y));
      this.shadow.setMatrixAt(ns++, this.m2);
    }
    for (let t = 0; t < 2; t++) {
      this.body[t].count = counts[t]; this.outline[t].count = counts[t];
      this.body[t].instanceMatrix.needsUpdate = true; this.body[t].instanceColor!.needsUpdate = true;
    }
    this.eyes.count = ne; this.pupils.count = ne; this.brow.count = nb; this.bomb.count = nbomb; this.spark.count = nbomb; this.helmet.count = nh; this.shadow.count = ns;
    for (let k = 0; k < this.shared.length; k++) this.shared[k].instanceMatrix.needsUpdate = true;
    this.brow.instanceColor!.needsUpdate = true;
  }

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
    this.group.traverse((o) => { const m = o as THREE.InstancedMesh; if (m.isInstancedMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

