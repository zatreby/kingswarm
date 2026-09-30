// Buildings: KayKit models tinted per owner, a flag whose shape says the team, a capture ring,
// and the Crown's floating crown + hold ring. Neutral = parchment roof, no flag.
import * as THREE from 'three';
import type { World, Building, BuildingKind, Owner } from '../sim/types';
import type { Kit, KitModel } from './assets';
import { PAL, teamColors } from './palette';
import { kitMaterial, toon, toonNew, outlineMaterial } from './materials';
import { crownGeometry, flagGeometry } from './shapes';
import { makeRing, type Ring } from './rings';
import { sceneX, sceneZ, captureRadius, ringState, CROWN_HOLD, type RingState } from './mapping';

const BLD = {
  /** Model footprint diameter as a multiple of the building's sim radius * 2. */
  foot: { throne: 1.25, hut: 1.12, tower: 1.05, crown: 1.25 } as Record<BuildingKind, number>,
  /** Extra vertical squash so tall KayKit pieces do not wall off the view at 56 degrees. */
  heightMul: { throne: 0.74, hut: 1, tower: 0.85, crown: 0.7 } as Record<BuildingKind, number>,
  ringWidth: 0.2,
  crownFloat: 0.55,
  flagPole: 0.95,
} as const;

const MODEL: Record<BuildingKind, KitModel[]> = { throne: ['castle'], hut: ['home_A', 'home_B'], tower: ['tower_A'], crown: ['well'] };

interface View {
  b: Building;
  group: THREE.Group;
  body: THREE.Mesh;
  flagPivot: THREE.Group;
  flag: THREE.Mesh;
  ring: Ring;
  crownRing: Ring | null;
  crown: THREE.Group | null;
  owner: Owner | 99;
  top: number;
  phase: number;
}

export class Buildings {
  readonly group = new THREE.Group();
  private views: View[] = [];
  private readonly mats: { neutral: THREE.MeshToonMaterial; team: [THREE.MeshToonMaterial, THREE.MeshToonMaterial] };
  private readonly flagMats: [THREE.MeshToonMaterial, THREE.MeshToonMaterial];
  private readonly flagGeo: [THREE.BufferGeometry, THREE.BufferGeometry];
  private readonly poleGeo = new THREE.CylinderGeometry(0.03, 0.035, 1, 5);
  private readonly crownGeo = crownGeometry(0.42, 0.4);
  private readonly crownMat = toonNew(PAL.gold, { emissive: new THREE.Color(PAL.goldDeep), emissiveIntensity: 0.45 });
  private readonly crownOutline = outlineMaterial(PAL.goldDeep, 0.03);
  /** Halo under the floating crown: a flat additive ring that says 'this glows' without a solid column. */
  private readonly haloMat = new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  private readonly haloGeo = new THREE.RingGeometry(0.5, 0.62, 32).rotateX(-Math.PI / 2);
  private readonly rs: RingState = { team: -1, fill: 0, contested: false };
  private colorBlind = false;
  private readonly cols = { neutral: new THREE.Color(PAL.neutral), back: new THREE.Color(PAL.ink), team: [new THREE.Color(), new THREE.Color()] };

  constructor(private kit: Kit) {
    this.mats = { neutral: kitMaterial(kit.atlas, PAL.neutral), team: [kitMaterial(kit.atlas, PAL.blue), kitMaterial(kit.atlas, PAL.red)] };
    this.flagMats = [toonNew(PAL.blue, { side: THREE.DoubleSide }), toonNew(PAL.red, { side: THREE.DoubleSide })];
    this.flagGeo = [flagGeometry(0), flagGeometry(1)];
    this.poleGeo.translate(0, 0.5, 0);
    this.setColorBlind(false);
  }

  setColorBlind(on: boolean): void {
    this.colorBlind = on;
    for (const t of [0, 1] as const) {
      const c = teamColors(t, on).body;
      this.cols.team[t].set(c);
      this.mats.team[t].userData.team!.value.set(c);
      this.flagMats[t].color.set(c);
    }
    for (const v of this.views) v.ring.u.uPattern.value = 0;
  }

  build(world: World): void {
    this.clear();
    for (const b of world.buildings) {
      const kind = b.kind, models = MODEL[kind], model = models[b.id % models.length];
      const box = this.kit.box[model];
      const foot = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      const s = (b.r * 2 * BLD.foot[kind]) / foot;
      const hs = s * BLD.heightMul[kind];
      const group = new THREE.Group();
      group.position.set(sceneX(b.x), 0, sceneZ(b.y));
      const body = new THREE.Mesh(this.kit.geo[model], this.mats.neutral);
      body.scale.set(s, hs, s);
      body.position.y = -box.min.y * hs;
      // Face the arena centre a little so doors look inward; mirrored layouts stay mirrored.
      body.rotation.y = kind === 'crown' ? Math.PI / 4 : (b.x < 16 ? 0.35 : Math.PI + 0.35);
      body.castShadow = true; body.receiveShadow = true;
      group.add(body);
      const top = (box.max.y - box.min.y) * hs;

      // Flag on a pole rising from the roof peak.
      const flagPivot = new THREE.Group();
      const pole = new THREE.Mesh(this.poleGeo, toon(PAL.wood));
      pole.scale.y = BLD.flagPole;
      const flag = new THREE.Mesh(this.flagGeo[0], this.flagMats[0]);
      flag.position.set(0.02, BLD.flagPole - 0.02, 0);
      flagPivot.add(pole, flag);
      flagPivot.position.set(kind === 'hut' ? 0.1 : 0, top - 0.15, 0);
      group.add(flagPivot);

      const R = captureRadius(b);
      const ring = makeRing(R - BLD.ringWidth, R);
      ring.u.uBack.value.copy(this.cols.back);
      group.add(ring.group);

      let crown: THREE.Group | null = null, crownRing: Ring | null = null;
      if (kind === 'crown') {
        crown = new THREE.Group();
        const c = new THREE.Mesh(this.crownGeo, this.crownMat);
        const co = new THREE.Mesh(this.crownGeo, this.crownOutline);
        const halo = new THREE.Mesh(this.haloGeo, this.haloMat);
        halo.position.y = -0.12;
        crown.add(c, co, halo);
        crown.position.y = top + BLD.crownFloat;
        crown.visible = false;
        group.add(crown);
        crownRing = makeRing(R + 0.1, R + 0.34, true);
        crownRing.u.uBack.value.set(PAL.goldDeep);
        crownRing.group.visible = false;
        group.add(crownRing.group);
      }
      this.group.add(group);
      this.views.push({ b, group, body, flagPivot, flag, ring, crownRing, crown, owner: 99, top, phase: b.id * 1.7 });
    }
  }

  update(world: World, time: number): void {
    const crownOpen = world.phase === 'crown' || world.phase === 'overtime';
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i], b = world.buildings[i] ?? v.b;
      if (b.owner !== v.owner) {
        v.owner = b.owner;
        v.body.material = b.owner === -1 ? this.mats.neutral : this.mats.team[b.owner];
        v.flagPivot.visible = b.owner !== -1;
        if (b.owner !== -1) { v.flag.geometry = this.flagGeo[b.owner]; v.flag.material = this.flagMats[b.owner]; }
      }
      if (v.flagPivot.visible) {
        // Flags flutter: a slow sway plus a faster flap.
        v.flag.rotation.y = Math.sin(time * 1.3 + v.phase) * 0.25 + Math.sin(time * 6.1 + v.phase) * 0.08;
        v.flag.scale.x = 1 + Math.sin(time * 4.3 + v.phase) * 0.06;
      }
      const rs = ringState(b, this.rs), u = v.ring.u;
      u.uFill.value = rs.fill;
      u.uColor.value.copy(rs.team === -1 ? this.cols.neutral : this.cols.team[rs.team]);
      u.uContest.value = rs.contested ? 1 : 0;
      u.uPattern.value = this.colorBlind && rs.team === 1 ? 1 : 0;
      u.uZone.value = b.owner === -1 ? 0 : 1;
      u.uTime.value = time;
      v.ring.ghost.visible = b.presence[0] + b.presence[1] + b.garrison[0] + b.garrison[1] > 0;
      if (v.crown && v.crownRing) {
        v.crown.visible = crownOpen;
        v.crownRing.group.visible = crownOpen;
        if (crownOpen) {
          v.crown.position.y = v.top + BLD.crownFloat + Math.sin(time * 2) * 0.12;
          v.crown.rotation.y = time * 0.9;
          const cu = v.crownRing.u;
          cu.uFill.value = Math.min(1, world.crown[0] / CROWN_HOLD);
          cu.uFill2.value = Math.min(1, world.crown[1] / CROWN_HOLD);
          cu.uColor.value.copy(this.cols.team[0]);
          cu.uColor2.value.copy(this.cols.team[1]);
          cu.uTime.value = time;
        }
      }
    }
  }

  /** Roof height of building i, for HUD anchors and effects. */
  topOf(i: number): number { return this.views[i]?.top ?? 1; }

  clear(): void {
    for (const v of this.views) { v.ring.dispose(); v.crownRing?.dispose(); }
    this.group.clear();
    this.views = [];
  }

  dispose(): void {
    this.clear();
    this.mats.neutral.dispose(); this.mats.team.forEach((m) => m.dispose()); this.flagMats.forEach((m) => m.dispose());
    this.flagGeo.forEach((g) => g.dispose()); this.poleGeo.dispose(); this.crownGeo.dispose(); this.crownMat.dispose();
    this.crownOutline.dispose(); this.haloMat.dispose(); this.haloGeo.dispose();
  }
}

