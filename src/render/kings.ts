// Kings: procedural blob characters (about twice a critter) with crown, cape, ground ring and a look
// (hero or rival) that gives each a distinct silhouette. State shows as shape and a few overlay meshes.
import * as THREE from 'three';
import type { World, Hero, Team } from '../sim/types';
import { PAL, teamColors, TeamPalette } from './palette';
import { toonNew, outlineMaterial, faceted } from './materials';
import { blobGeometry, crownGeometry, posNormal } from './shapes';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { UNIT_STENCIL, KING_STENCIL, makeRing, type Ring } from './rings';
import { sceneX, sceneZ, angleDelta, approach, THROW_RANGE } from './mapping';

export const KING = {
  /** About twice a critter on screen (art review: ~70 px at 1080p). */
  radius: 0.66,
  outline: 0.08,
  eyeR: 0.18, pupilR: 0.095, eyeAz: 0.36, eyeEl: 0.62,
  hopsPerUnit: 0.55, hopHeight: 0.16,
  turnRate: 14,
  leanMax: 0.22,
  capeFlareMax: 1.0,
  /** Mirrors tuning.hero.respawnTime (seconds dead). */
  respawnTime: 5,
  ringR0: 0.86, ringR1: 1.02,
  hpBarW: 1.2, hpBarH: 0.15,
  /** Throw range ring: an arc facing the aim, clipped to land, strong only while firing. */
  aimArc: 1.1,
  flashTime: 0.07,
} as const;

export type LookId = 'brawler' | 'blink' | 'warden' | 'bumble' | 'pip' | 'brood' | 'gorm' | 'sable' | 'mora';
export const LOOKS: LookId[] = ['brawler', 'blink', 'warden', 'bumble', 'pip', 'brood', 'gorm', 'sable', 'mora'];

interface LookSpec { w: number; h: number; eyes: 'round' | 'sleepy' | 'many' | 'none'; capeLen: number; crown: 'normal' | 'askew' | 'tall' | 'onHelm' }
const SPECS: Record<LookId, LookSpec> = {
  brawler: { w: 1.14, h: 1.02, eyes: 'round', capeLen: 0.75, crown: 'normal' },
  blink: { w: 0.84, h: 1.24, eyes: 'round', capeLen: 0.7, crown: 'normal' },
  warden: { w: 1.18, h: 1.06, eyes: 'round', capeLen: 0.8, crown: 'onHelm' },
  bumble: { w: 1.12, h: 1.06, eyes: 'sleepy', capeLen: 0.65, crown: 'askew' },
  pip: { w: 0.95, h: 1.06, eyes: 'round', capeLen: 0.6, crown: 'normal' },
  brood: { w: 1.28, h: 1.2, eyes: 'many', capeLen: 0.8, crown: 'normal' },
  gorm: { w: 1.36, h: 1.0, eyes: 'round', capeLen: 0.8, crown: 'onHelm' },
  sable: { w: 0.8, h: 1.22, eyes: 'round', capeLen: 0.75, crown: 'normal' },
  mora: { w: 0.9, h: 1.36, eyes: 'round', capeLen: 1.35, crown: 'tall' },
};

const STEEL = '#B9C2CF', IVORY = '#F1E4C4', LEATHER = '#8A5A3A', BRASS = '#C8923A';

interface KingView {
  team: Team;
  /** Lab showcase Kings read this Hero instead of world.heroes[team]. */
  fixture: Hero | null;
  root: THREE.Group;      // position + yaw
  lean: THREE.Group;      // lean / squash
  cape: THREE.Group;
  bodyMat: THREE.MeshToonMaterial;
  top: number;
  ring: THREE.Mesh; ringMat: THREE.MeshBasicMaterial;
  marker: THREE.Group | null;
  stars: THREE.Group; shield: THREE.Mesh; aura: THREE.Mesh;
  hp: THREE.Group; hpBar: THREE.Group; hpFill: THREE.Mesh; hpFillMat: THREE.MeshBasicMaterial;
  ghost: THREE.Group; ghostRing: Ring;
  yaw: number; hop: number; lastX: number; lastY: number; spd: number; capeYaw: number; capeFlare: number;
  /** Cosmetic reaction timers (seconds of presentation time). */
  flashT: number; flashK: number; hitT: number; hitK: number; recoil: number; shieldT: number;
  disposables: { dispose(): void }[];
}

export class Kings {
  readonly group = new THREE.Group();
  private views: KingView[] = [];
  private localTeam: Team = 0;
  private aimTeam: Team | null = null;
  private colorBlind = false;
  private readonly aim: { range: THREE.Mesh; rangeMat: THREE.ShaderMaterial; reticle: THREE.Group; reticleMat: THREE.MeshBasicMaterial; fire: number };
  private time = 0;
  /** Crown geometry and materials, shared with the effect that knocks a crown off a fallen King. */
  readonly crownGeo = crownGeometry(0.3, 0.3, 5, 1);
  readonly crownMats: THREE.Material[] = [toonNew(PAL.gold, { emissive: new THREE.Color(PAL.goldDeep), emissiveIntensity: 0.35 }), outlineMaterial(PAL.goldDeep, 0.03)];
  /** Last pointer ground point (sim units), for the reticle's distance; NaN when unknown (gamepad). */
  readonly pointer = { x: NaN, y: NaN };
  private readonly camQuat = new THREE.Quaternion();
  private readonly pal = new TeamPalette();
  /** Roof height of building i (set by the renderer), so the dead King's ghost floats above his Throne. */
  buildingTop: (i: number) => number = () => 2.5;

  constructor() {
    const rangeMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(PAL.white) }, uTime: { value: 0 }, uAim: { value: new THREE.Vector2(1, 0) },
        uFire: { value: 0 }, uArc: { value: KING.aimArc }, uClip: { value: new THREE.Vector4(-16.2, -9.2, 16.2, 9.2) },
      },
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vP; varying vec2 vW; void main(){ vP = position.xz; vW = (modelMatrix * vec4(position,1.0)).xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform vec2 uAim; uniform float uFire; uniform float uArc; uniform vec4 uClip;
        varying vec2 vP; varying vec2 vW;
        void main(){
          if (vW.x < uClip.x || vW.y < uClip.y || vW.x > uClip.z || vW.y > uClip.w) discard;
          float a = atan(vP.y, vP.x);
          float off = abs(atan(uAim.x * vP.y - uAim.y * vP.x, dot(uAim, vP)));
          float arc = 1.0 - smoothstep(uArc * 0.6, uArc, off);
          float d = step(0.45, fract(a * 64.0 / 6.2831853 + uTime * 0.4));
          float al = d * arc * mix(0.14, 0.55, uFire);
          if (al < 0.01) discard;
          gl_FragColor = vec4(uColor, al);
          #include <colorspace_fragment>
        }`,
    });
    const rg = new THREE.RingGeometry(0.975, 1.0, 160, 1); rg.rotateX(-Math.PI / 2);
    const range = new THREE.Mesh(rg, rangeMat);
    range.renderOrder = 3; range.visible = false;
    const reticleMat = new THREE.MeshBasicMaterial({ color: PAL.white, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false });
    const inkMat = new THREE.MeshBasicMaterial({ color: PAL.ink, transparent: true, opacity: 0.75, depthWrite: false, depthTest: false });
    const reticle = new THREE.Group();
    const parts = (w: number) => {
      const rp: THREE.BufferGeometry[] = [new THREE.RingGeometry(0.36 - w, 0.44 + w, 32).rotateX(-Math.PI / 2)];
      for (let i = 0; i < 4; i++) rp.push(new THREE.BoxGeometry(0.22 + w * 2, 0.01, 0.08 + w * 2).translate(0.56, 0, 0).rotateY((i * Math.PI) / 2));
      return mergeGeometries(rp.map((g) => posNormal(g)), false)!;
    };
    const ink = new THREE.Mesh(parts(0.045), inkMat); ink.renderOrder = 54;
    const fill = new THREE.Mesh(parts(0), reticleMat); fill.renderOrder = 55; fill.position.y = 0.002;
    reticle.add(ink, fill);
    reticle.position.y = 0.05; reticle.visible = false;
    this.group.add(range, reticle);
    this.aim = { range, rangeMat, reticle, reticleMat, fire: 0 };
  }

  build(world: World, looks: [string, string], localTeam: Team, colorBlind: boolean): void {
    this.clear();
    this.localTeam = localTeam;
    this.colorBlind = colorBlind;
    this.pal.set(colorBlind);
    for (const t of [0, 1] as const) {
      const look = (LOOKS as string[]).includes(looks[t]) ? (looks[t] as LookId) : (world.heroes[t].kind as LookId);
      const v = this.makeKing(t, look, t === localTeam);
      this.views.push(v);
      this.group.add(v.root, v.hp, v.ghost);
      const h = world.heroes[t];
      v.lastX = h.x; v.lastY = h.y;
      v.yaw = Math.atan2(h.aimX, h.aimY);
    }
  }

  setAim(team: Team | null): void { this.aimTeam = team; }

  /** Lab/QA only: add extra Kings driven by caller-owned Hero objects (e.g. every look side by side). */
  showcase(entries: { hero: Hero; look: string }[]): void {
    for (const { hero, look } of entries) {
      const v = this.makeKing(hero.team, (LOOKS as string[]).includes(look) ? (look as LookId) : 'brawler', false);
      v.fixture = hero; v.lastX = hero.x; v.lastY = hero.y; v.yaw = Math.atan2(hero.aimX, hero.aimY);
      this.views.push(v);
      this.group.add(v.root, v.hp, v.ghost);
    }
  }

  update(world: World, alpha: number, dt: number, time: number, camera: THREE.Camera): void {
    this.time = time;
    camera.getWorldQuaternion(this.camQuat);
    for (const v of this.views) this.updateKing(v, v.fixture ?? world.heroes[v.team], world, alpha, dt, time);
    this.updateAim(world, alpha, dt, time);
  }

  // ------------------------------------------------------------ event reactions (cosmetic)

  /** White hit flash; repeated hits inside the window extend it and grow the wobble (aggregated, no numbers). */
  flash(team: Team, strength: number): void {
    const v = this.views[team]; if (!v) return;
    v.flashT = this.time + KING.flashTime; v.flashK = Math.max(strength, this.time < v.flashT ? v.flashK : 0);
    v.hitK = Math.min(1, (this.time - v.hitT < 0.25 ? v.hitK : 0) + 0.35); v.hitT = this.time;
  }
  /** Throw recoil: a small lean back from the aim. */
  recoil(team: Team): void { const v = this.views[team]; if (v) v.recoil = Math.min(1, v.recoil + 0.45); }
  /** Shield absorbed a hit: the bubble pulses. */
  shieldHit(team: Team): void { const v = this.views[team]; if (v) v.shieldT = this.time; }
  /** A small squash (no-ammo click, cast). */
  bump(team: Team, k = 0.5): void { const v = this.views[team]; if (v) { v.hitK = Math.max(v.hitK, k); v.hitT = this.time; } }
  /** Scene-space top of the head of King t. */
  headY(t: Team): number { return this.views[t]?.top ?? 1.3; }

  private updateKing(v: KingView, h: Hero, world: World, alpha: number, dt: number, time: number): void {
    const x = h.px + (h.x - h.px) * alpha, y = h.py + (h.y - h.py) * alpha;
    v.root.visible = h.alive;
    v.ghost.visible = !h.alive;
    if (!h.alive) {
      const th = world.buildings[world.thrones[v.team]];
      if (th) v.ghost.position.set(sceneX(th.x), 0, sceneZ(th.y));
      v.ghost.children[0].position.y = this.buildingTop(world.thrones[v.team]) + 0.35 + Math.sin(time * 2.4) * 0.14;
      v.ghost.children[0].rotation.y = Math.sin(time * 0.9) * 0.4;
      v.ghostRing.u.uFill.value = 1 - Math.max(0, Math.min(1, h.respawnT / KING.respawnTime));
      v.ghostRing.u.uTime.value = time;
      v.hp.visible = false;
      v.lastX = x; v.lastY = y;
      return;
    }
    const dx = x - v.lastX, dy = y - v.lastY, moved = Math.sqrt(dx * dx + dy * dy);
    v.lastX = x; v.lastY = y;
    if (dt > 0) v.spd += (Math.min(moved / dt, 40) - v.spd) * approach(12, dt);
    const moving = v.spd > 0.4;
    const dashing = h.dashT > 0, stunned = h.stunT > 0;

    // Face the aim; while dashing face the dash.
    const velYaw = Math.atan2(h.vx, h.vy);
    const wantYaw = dashing && (h.vx !== 0 || h.vy !== 0) ? velYaw : Math.atan2(h.aimX, h.aimY);
    v.yaw += angleDelta(v.yaw, wantYaw) * approach(KING.turnRate, dt);
    v.root.position.set(sceneX(x), 0, sceneZ(y));
    v.root.rotation.y = v.yaw;

    // Body: breathe when idle, hop + lean when moving, stretch when dashing, squash when stunned.
    let sy = 1 + Math.sin(time * 2.2 + v.team) * 0.03, lift = 0, leanX = 0, leanZ = 0;
    if (moving && !dashing) {
      v.hop += moved * KING.hopsPerUnit;
      const ph = v.hop - Math.floor(v.hop), air = Math.sin(Math.PI * ph);
      lift = air * KING.hopHeight;
      sy = ph < 0.12 || ph > 0.88 ? 0.88 : 1 + 0.07 * air;
    }
    if (moving) {
      // lean into the movement direction, expressed in the King's local frame
      const rel = velYaw - v.yaw, lean = Math.min(KING.leanMax, v.spd * 0.035);
      leanX = Math.cos(rel) * lean; leanZ = -Math.sin(rel) * lean;
    }
    // Hit wobble (aggregated hits ring it harder).
    const ht = time - v.hitT;
    if (ht >= 0 && ht < 0.4) sy *= 1 - 0.14 * v.hitK * Math.exp(-ht * 10) * Math.cos(ht * 34);
    let sxz = 1 / Math.sqrt(sy), sz = sxz;
    if (dashing) { sy = 0.8; sxz = 0.95; sz = 1.45; lift = 0.1; }
    if (stunned) { sy = 0.72; sxz = sz = 1.16; lift = 0; }
    v.recoil *= Math.exp(-dt * 14);
    v.lean.position.y = lift;
    v.lean.rotation.set(leanX - v.recoil * 0.22, 0, leanZ);
    v.lean.scale.set(sxz, sy, sz);

    // Cape trails the velocity, flaring with speed; hangs at rest.
    const wantCapeYaw = moving ? Math.max(-1.1, Math.min(1.1, angleDelta(v.yaw, velYaw))) : 0;
    v.capeYaw += (wantCapeYaw - v.capeYaw) * approach(8, dt);
    const wantFlare = 0.12 + Math.min(KING.capeFlareMax, v.spd * 0.11) + (moving ? Math.sin(time * 14) * 0.05 : 0);
    v.capeFlare += (wantFlare - v.capeFlare) * approach(10, dt);
    v.cape.rotation.set(v.capeFlare, v.capeYaw, 0, 'YXZ');

    // Rampage tint, shield, stars.
    const fl = time < v.flashT ? v.flashK : 0;
    const rg = h.rampageT > 0 ? 0.35 + 0.15 * Math.sin(time * 12) : 0;
    v.bodyMat.emissive.setRGB(rg + fl, (h.rampageT > 0 ? 0.08 : 0) + fl, fl);
    v.aura.visible = h.rampageT > 0;
    if (v.aura.visible) { const s = 1 + Math.sin(time * 10) * 0.06; v.aura.scale.set(s, 1 + Math.sin(time * 7) * 0.1, s); v.aura.rotation.y = time * 2; }
    v.shield.visible = h.shieldT > 0 && h.shield > 0;
    if (v.shield.visible) { const st = time - v.shieldT; const s = 1 + Math.sin(time * 5) * 0.03 + (st < 0.3 ? 0.12 * (1 - st / 0.3) : 0); v.shield.scale.setScalar(s); }
    v.stars.visible = stunned;
    if (stunned) { v.stars.rotation.y = time * 5; v.stars.position.y = v.top + 0.25 + lift; }
    // Respawn grace / dash i-frames: gentle blink so it reads without flashing hard.
    v.lean.visible = !(h.invulnT > 0 && !dashing && Math.sin(time * 28) > 0.6);

    // Ground ring and local marker.
    v.ringMat.opacity = 0.92;
    if (v.marker) v.marker.position.y = (v.fixture ? 0 : 0.2) + Math.abs(Math.sin(time * 3.2)) * 0.16;

    // Tag: chevron (local) always, HP bar only when hurt.
    const frac = h.maxHp > 0 ? h.hp / h.maxHp : 1;
    const hurt = frac < 0.999;
    v.hp.visible = hurt || !!v.marker;
    v.hpBar.visible = hurt;
    v.hp.position.set(sceneX(x), v.top + 0.62 + lift, sceneZ(y));
    v.hp.quaternion.copy(this.camQuat);
    v.hpBar.position.y = v.marker ? 0 : 0;
    if (v.marker) v.marker.position.y += hurt ? 0.3 : 0;
    if (hurt) {
      v.hpFill.scale.x = Math.max(0.001, frac);
      v.hpFillMat.color.copy(frac < 0.3 ? this.pal.danger : this.pal.body[v.team]);
    }
  }

  private updateAim(world: World, alpha: number, dt: number, time: number): void {
    const { range, reticle, rangeMat } = this.aim;
    const t = this.aimTeam;
    const h = t === null ? null : world.heroes[t];
    const on = !!h && h.alive;
    range.visible = on; reticle.visible = on;
    if (!on || !h || t === null) return;
    const x = h.px + (h.x - h.px) * alpha, y = h.py + (h.y - h.py) * alpha;
    const r = THROW_RANGE * (world.mods?.[t]?.throwRangeMul ?? 1);
    range.position.set(sceneX(x), 0.04, sceneZ(y));
    range.scale.set(r, 1, r);
    this.aim.fire += ((h.prev?.fire ? 1 : 0) - this.aim.fire) * approach(10, dt);
    rangeMat.uniforms.uTime.value = time;
    rangeMat.uniforms.uFire.value = this.aim.fire;
    rangeMat.uniforms.uAim.value.set(h.aimX, h.aimY);
    rangeMat.uniforms.uColor.value.copy(this.pal.light[t]);
    // Direction is the sim's aim; distance comes from the pointer when we have one.
    let d = r * 0.6;
    if (!Number.isNaN(this.pointer.x)) d = Math.min(r, Math.hypot(this.pointer.x - x, this.pointer.y - y));
    reticle.position.set(sceneX(x + h.aimX * d), 0.05, sceneZ(y + h.aimY * d));
    reticle.rotation.y = time * 0.8;
    this.aim.reticleMat.color.copy(this.pal.light[t]);
  }

  setColors(colorBlind: boolean, world: World | null, looks: [string, string] | null): void {
    if (colorBlind === this.colorBlind || !world || !looks) { this.colorBlind = colorBlind; this.pal.set(colorBlind); return; }
    this.build(world, looks, this.localTeam, colorBlind);
  }

  /** Top of King t's head (scene units), for HUD anchors. */
  topOf(t: Team): number { return this.views[t]?.top ?? 1.3; }

  // ------------------------------------------------------------ construction

  private makeKing(team: Team, look: LookId, local: boolean): KingView {
    const spec = SPECS[look], tc = teamColors(team, this.colorBlind);
    const R = KING.radius, sq = 0.9;
    const disposables: { dispose(): void }[] = [];
    const D = <T extends { dispose(): void }>(d: T) => (disposables.push(d), d);
    const stencil = { stencilWrite: true, stencilRef: KING_STENCIL, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp } as const;
    // Full team saturation (pale reads as another faction); size, crown, cape and the thick outline separate him from his crowd.
    const bodyMat = D(toonNew(tc.body, { ...stencil }));
    const lightMat = D(toonNew(tc.light));
    const capeCol = new THREE.Color(tc.body).lerp(new THREE.Color(tc.dark), 0.55);
    const capeMat = D(toonNew(capeCol, { side: THREE.DoubleSide }));
    const outMat = D(outlineMaterial(tc.dark, KING.outline));
    Object.assign(outMat, stencil);
    const goldMat = D(toonNew(PAL.gold, { emissive: new THREE.Color(PAL.goldDeep), emissiveIntensity: 0.35 }));
    const goldOut = D(outlineMaterial(PAL.goldDeep, 0.03));
    const white = D(new THREE.MeshBasicMaterial({ color: PAL.white }));
    const ink = D(new THREE.MeshBasicMaterial({ color: PAL.ink }));
    const matCache = new Map<string, THREE.MeshToonMaterial>();
    const mat = (c: string) => { let m = matCache.get(c); if (!m) { m = D(toonNew(c)); matCache.set(c, m); } return m; };

    const root = new THREE.Group(), lean = new THREE.Group();
    root.add(lean);
    const W = spec.w, Hh = spec.h;
    const top = R * 2 * sq * Hh;
    const add = (g: THREE.BufferGeometry, m: THREE.Material, outline = false, parent: THREE.Object3D = lean) => {
      D(g);
      const mesh = new THREE.Mesh(g, m);
      // Kings move: they get a blob shadow disc, not a real one (the shadow map is static).
      parent.add(mesh);
      if (outline) { const o = new THREE.Mesh(g, m === goldMat ? goldOut : outMat); parent.add(o); }
      return mesh;
    };

    // Body + belly.
    const bodyG = blobGeometry(R, 20, 14, sq); bodyG.scale(W, Hh, W);
    add(bodyG, bodyMat, true);
    // X-ray: where anything (crowd, building, tree) hides the King, draw his silhouette in team light.
    const xray = new THREE.Mesh(bodyG, D(new THREE.MeshBasicMaterial({
      color: tc.light, transparent: true, opacity: local ? 0.6 : 0.4, depthWrite: false, depthFunc: THREE.GreaterDepth,
      stencilWrite: true, stencilRef: KING_STENCIL, stencilFunc: THREE.NotEqualStencilFunc, stencilWriteMask: 0,
      stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
    })));
    xray.userData.xray = true;
    xray.renderOrder = 45;
    lean.add(xray);
    const belly = new THREE.SphereGeometry(R * 0.62, 14, 10); belly.scale(W * 0.95, Hh * 0.8, 0.45); belly.translate(0, top * 0.36, R * W * 0.72);
    add(belly, lightMat);

    // Eyes (placed on the front of the scaled blob).
    const eyeAt = (az: number, el: number, er: number, sleepy = false) => {
      const p = new THREE.Vector3(Math.sin(az) * Math.cos(el) * R * W, top / 2 + Math.sin(el) * (top / 2), Math.cos(az) * Math.cos(el) * R * W).multiplyScalar(0.97);
      p.y = top / 2 + Math.sin(el) * (top / 2) * 0.97;
      const g = new THREE.Group();
      g.position.copy(p); g.rotation.set(-el * 0.6, az, 0, 'YXZ');
      const e = new THREE.SphereGeometry(er, 14, 10); e.scale(1, 1.08, 0.62);
      add(e, white, false, g);
      const pg = new THREE.SphereGeometry(er * 0.52, 10, 8); pg.scale(1, 1.1, 0.5); pg.translate(0, -er * 0.08, er * 0.5);
      add(pg, ink, false, g);
      if (sleepy) {
        // Heavy upper lid: covers the top of the eye only, tilted forward.
        const lid = new THREE.SphereGeometry(er * 1.1, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); lid.scale(1, 1.08, 0.7); lid.rotateX(1.25);
        add(lid, bodyMat, false, g);
      }
      lean.add(g);
      return g;
    };
    if (spec.eyes === 'many') {
      const spots: [number, number, number][] = [[-0.3, 0.42, 0.1], [0.3, 0.42, 0.1], [-0.12, 0.62, 0.085], [0.12, 0.62, 0.085], [-0.46, 0.2, 0.07], [0.46, 0.2, 0.07], [0, 0.3, 0.075]];
      for (const [az, el, er] of spots) eyeAt(az, el, er);
    } else {
      for (const s of [-1, 1]) eyeAt(KING.eyeAz * s, KING.eyeEl, KING.eyeR, spec.eyes === 'sleepy');
    }

    // Crown.
    const crownG = look === 'mora' ? crownGeometry(0.31, 0.38, 7, 1.9) : crownGeometry(0.3, 0.3, 5, 1);
    const crown = add(crownG, goldMat, true);
    crown.position.y = top - 0.07;
    if (spec.crown === 'askew') { crown.scale.setScalar(0.62); crown.rotation.z = 0.42; crown.position.set(0.12, top - 0.05, 0); }
    if (spec.crown === 'onHelm') crown.position.y = top + 0.08;
    if (look === 'mora') { const gem = new THREE.OctahedronGeometry(0.07, 0); gem.translate(0, 0.2, 0.25); add(gem, mat(tc.light), false, crown); }

    // Cape: a curved sheet hanging from the shoulders, pivoting at the top.
    const cape = new THREE.Group();
    cape.position.set(0, top * 0.72, 0);
    const capeH = top * 0.8 * spec.capeLen + (look === 'mora' ? 0.15 : 0);
    const capeG = new THREE.CylinderGeometry(R * W * 0.7, R * W * 1.18, capeH, 14, 1, true, Math.PI - 1.2, 2.4);
    capeG.translate(0, -capeH / 2, 0);
    const capeMesh = new THREE.Mesh(D(capeG), capeMat);
    cape.add(capeMesh);
    lean.add(cape);

    // Look accessories.
    const outline = true;
    switch (look) {
      case 'brawler': {
        for (const s of [-1, 1]) {
          const fist = new THREE.SphereGeometry(0.2, 12, 9); fist.scale(1, 0.9, 1.05); fist.translate(s * (R * W + 0.06), top * 0.36, R * 0.35);
          add(fist, mat(tc.light), outline);
          const wrap = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 10); wrap.rotateX(Math.PI / 2); wrap.translate(s * (R * W + 0.06), top * 0.36, R * 0.35 - 0.16);
          add(wrap, mat(LEATHER));
        }
        const band = new THREE.TorusGeometry(R * W * 0.83, 0.05, 6, 20); band.rotateX(Math.PI / 2); band.translate(0, top * 0.8, 0);
        add(band, mat(tc.dark));
        break;
      }
      case 'blink': {
        const hood = new THREE.SphereGeometry(R * 1.04, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42); hood.scale(W * 1.02, Hh, W * 1.02); hood.translate(0, top / 2 - R * 0.05, -0.04);
        add(hood, capeMat, outline);
        const tip = new THREE.ConeGeometry(0.14, 0.34, 6); tip.rotateX(-1.9); tip.translate(0, top * 0.86, -R * W * 0.95);
        add(faceted(tip), capeMat);
        const scarf = new THREE.TorusGeometry(R * W * 0.9, 0.075, 6, 20); scarf.rotateX(Math.PI / 2); scarf.translate(0, top * 0.44, 0);
        add(scarf, mat(tc.light), outline);
        const tail = new THREE.BoxGeometry(0.14, 0.04, 0.4); tail.rotateX(-0.5); tail.translate(0.18, top * 0.4, -R * W - 0.12);
        add(tail, mat(tc.light));
        break;
      }
      case 'warden': {
        // Kettle helmet sitting on the crown of the head (not a full cap, or the head vanishes from behind).
        const helm = new THREE.SphereGeometry(R * W * 0.66, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5); helm.scale(1, 0.8, 1); helm.translate(0, top - 0.16, -0.04);
        add(helm, mat(STEEL), outline);
        const brim = new THREE.TorusGeometry(R * W * 0.68, 0.05, 5, 20); brim.rotateX(Math.PI / 2); brim.translate(0, top - 0.16, -0.04);
        add(brim, mat(STEEL));
        const nose = new THREE.BoxGeometry(0.06, 0.14, 0.05); nose.rotateX(0.5); nose.translate(0, top - 0.2, R * W * 0.66);
        add(nose, mat(STEEL));
        const shield = new THREE.CylinderGeometry(0.38, 0.38, 0.07, 14); shield.rotateZ(Math.PI / 2); shield.rotateY(-0.5); shield.translate(-(R * W + 0.08), top * 0.42, R * 0.3);
        add(shield, mat(tc.dark), outline);
        const face = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14); face.rotateZ(Math.PI / 2); face.rotateY(-0.5); face.translate(-(R * W + 0.11), top * 0.42, R * 0.32);
        add(face, mat(tc.light));
        const boss = new THREE.SphereGeometry(0.08, 8, 6); boss.translate(-(R * W + 0.16), top * 0.42, R * 0.36);
        add(boss, mat(STEEL));
        break;
      }
      case 'bumble': {
        const cheek = new THREE.SphereGeometry(0.08, 8, 6);
        for (const s of [-1, 1]) { const c = cheek.clone(); c.translate(s * 0.34, top * 0.44, R * W * 0.84); add(c, mat('#FF9FB0')); }
        cheek.dispose();
        break;
      }
      case 'pip': {
        const strap = new THREE.TorusGeometry(R * W * 0.98, 0.04, 6, 24); strap.rotateX(Math.PI / 2); strap.translate(0, top / 2 + Math.sin(KING.eyeEl) * top / 2, 0);
        add(strap, mat(LEATHER));
        for (const s of [-1, 1]) {
          const az = KING.eyeAz * s, el = KING.eyeEl;
          const ring = new THREE.TorusGeometry(KING.eyeR * 1.02, 0.05, 6, 14);
          ring.rotateX(-el * 0.6); ring.rotateY(az);
          ring.translate(Math.sin(az) * Math.cos(el) * R * W, top / 2 + Math.sin(el) * top / 2 * 0.97, Math.cos(az) * Math.cos(el) * R * W * 0.99);
          add(ring, mat(BRASS), outline);
        }
        const pack = new THREE.BoxGeometry(0.5, 0.52, 0.3); pack.translate(0, top * 0.5, -R * W - 0.08);
        add(faceted(pack), mat(LEATHER), outline);
        const pipe = new THREE.CylinderGeometry(0.05, 0.06, 0.3, 6); pipe.translate(0.16, top * 0.5 + 0.38, -R * W - 0.12);
        add(pipe, mat(STEEL));
        const handle = new THREE.BoxGeometry(0.07, 0.5, 0.07); handle.rotateZ(-0.5); handle.translate(R * W + 0.12, top * 0.42, R * 0.4);
        add(handle, mat(STEEL), outline);
        const jaw = new THREE.TorusGeometry(0.1, 0.045, 5, 10, Math.PI * 1.4); jaw.rotateZ(-0.5 + Math.PI * 0.8); jaw.translate(R * W + 0.26, top * 0.42 + 0.26, R * 0.4);
        add(jaw, mat(STEEL));
        break;
      }
      case 'brood': {
        const sacs: [number, number, number, number][] = [[-0.28, 0.55, -0.6, 0.2], [0.26, 0.5, -0.62, 0.22], [0, 0.85, -0.55, 0.18], [0.02, 0.28, -0.72, 0.17]];
        for (const [sx, sy, sz, r] of sacs) { const e = new THREE.SphereGeometry(r, 12, 9); e.scale(1, 1.15, 1); e.translate(sx * W, top * sy, sz * W); add(e, mat('#E8F0B8'), outline); }
        break;
      }
      case 'gorm': {
        const helm = new THREE.SphereGeometry(R * W * 0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5); helm.scale(1, 0.75, 1); helm.translate(0, top - 0.14, -0.02);
        add(helm, mat(STEEL), outline);
        const band = new THREE.TorusGeometry(R * W * 0.62, 0.055, 5, 20); band.rotateX(Math.PI / 2); band.translate(0, top - 0.14, -0.02);
        add(band, mat(BRASS));
        for (const s of [-1, 1]) {
          const horn = new THREE.ConeGeometry(0.11, 0.5, 7); horn.translate(0, 0.25, 0); horn.rotateZ(-s * 0.95); horn.translate(s * R * W * 0.55, top - 0.1, 0);
          add(horn, mat(IVORY), outline);
        }
        const tusk = new THREE.ConeGeometry(0.05, 0.16, 5);
        for (const s of [-1, 1]) { const t = tusk.clone(); t.translate(s * 0.16, top * 0.3, R * W * 0.92); add(t, mat(IVORY)); }
        tusk.dispose();
        break;
      }
      case 'sable': {
        const mask = new THREE.TorusGeometry(R * W * 0.96, 0.11, 6, 24); mask.scale(1, 1, 1); mask.rotateX(Math.PI / 2); mask.translate(0, top / 2 + Math.sin(KING.eyeEl) * top / 2 * 0.95, 0);
        add(mask, mat(PAL.ink));
        for (const s of [-1, 1]) {
          const blade = new THREE.ConeGeometry(0.06, 0.42, 4); blade.rotateX(Math.PI / 2 + 0.3); blade.translate(s * (R * W + 0.1), top * 0.3, R * 0.55);
          add(faceted(blade), mat(STEEL), outline);
          const hilt = new THREE.BoxGeometry(0.16, 0.05, 0.05); hilt.translate(s * (R * W + 0.1), top * 0.27, R * 0.3);
          add(hilt, mat(LEATHER));
        }
        break;
      }
      case 'mora': {
        const staff = new THREE.CylinderGeometry(0.035, 0.035, top * 1.1, 6); staff.translate(R * W + 0.14, top * 0.5, R * 0.3);
        add(staff, goldMat, true);
        const orb = new THREE.IcosahedronGeometry(0.12, 1); orb.translate(R * W + 0.14, top * 1.08, R * 0.3);
        add(orb, mat(tc.light), outline);
        break;
      }
    }

    // Bold team ground ring with an ink rim, under both Kings. It also draws through critters
    // (stencil = UNIT_STENCIL) so each King is found instantly inside a crowd.
    const r1 = local ? KING.ringR1 + 0.05 : KING.ringR1;
    const ringG = new THREE.RingGeometry(KING.ringR0, r1, 48); ringG.rotateX(-Math.PI / 2);
    const ringMat = D(new THREE.MeshBasicMaterial({ color: local ? tc.light : tc.body, transparent: true, opacity: 0.92, depthWrite: false }));
    const ring = new THREE.Mesh(D(ringG), ringMat);
    ring.position.y = 0.045; ring.renderOrder = 3;
    root.add(ring);
    const rimG = new THREE.RingGeometry(KING.ringR0 - 0.06, KING.ringR0, 48); rimG.rotateX(-Math.PI / 2);
    const rimG2 = new THREE.RingGeometry(r1, r1 + 0.07, 48); rimG2.rotateX(-Math.PI / 2);
    const rimMat = D(new THREE.MeshBasicMaterial({ color: PAL.ink, transparent: true, opacity: 0.8, depthWrite: false }));
    for (const g of [rimG, rimG2]) { const m = new THREE.Mesh(D(g), rimMat); m.position.y = 0.045; m.renderOrder = 3; root.add(m); }
    const ghostMat = D(new THREE.MeshBasicMaterial({
      color: local ? tc.light : tc.body, transparent: true, opacity: local ? 0.75 : 0.55, depthWrite: false, depthTest: false,
      stencilWrite: true, stencilRef: UNIT_STENCIL, stencilFunc: THREE.EqualStencilFunc, stencilWriteMask: 0,
      stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
    }));
    const ghostRing = new THREE.Mesh(ringG, ghostMat);
    ghostRing.position.y = 0.045; ghostRing.renderOrder = 52;
    root.add(ghostRing);
    const shadowG = new THREE.CircleGeometry(KING.ringR0 * 0.95, 24); shadowG.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(D(shadowG), D(new THREE.MeshBasicMaterial({ color: PAL.ink, transparent: true, opacity: 0.32, depthWrite: false })));
    shadow.position.y = 0.03; shadow.renderOrder = 2;
    root.add(shadow);
    // State overlays.
    const stars = new THREE.Group();
    const starG = D(faceted(new THREE.OctahedronGeometry(0.17, 0)));
    const starM = D(new THREE.MeshBasicMaterial({ color: '#FFF3A0' }));
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(starG, starM); const a = (i / 4) * Math.PI * 2; s.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62); s.scale.y = 1.4; stars.add(s); }
    stars.visible = false; root.add(stars);
    const shield = new THREE.Mesh(D(new THREE.SphereGeometry(R * Math.max(W, 1) * 1.55, 24, 16)), D(fresnelMaterial(tc.light)));
    shield.position.y = top * 0.5; shield.visible = false; shield.renderOrder = 40; root.add(shield);
    const auraG = new THREE.CylinderGeometry(R * W * 1.25, R * W * 1.45, top * 1.3, 20, 1, true); auraG.translate(0, top * 0.65, 0);
    const aura = new THREE.Mesh(D(auraG), D(auraMaterial(PAL.danger)));
    aura.visible = false; aura.renderOrder = 41; root.add(aura);

    // Billboard tag above the head: the local King's bobbing chevron, the rival's crown badge, and the HP bar when hurt.
    const hp = new THREE.Group();
    const bar = new THREE.Group();
    const bgG = new THREE.PlaneGeometry(KING.hpBarW + 0.1, KING.hpBarH + 0.1);
    const bg = new THREE.Mesh(D(bgG), D(new THREE.MeshBasicMaterial({ color: PAL.ink, depthTest: false, transparent: true, opacity: 0.88 })));
    const fillG = new THREE.PlaneGeometry(KING.hpBarW, KING.hpBarH); fillG.translate(KING.hpBarW / 2, 0, 0);
    const hpFillMat = D(new THREE.MeshBasicMaterial({ color: tc.body, depthTest: false, transparent: true }));
    const hpFill = new THREE.Mesh(D(fillG), hpFillMat);
    hpFill.position.set(-KING.hpBarW / 2, 0, 0.001);
    bg.renderOrder = 60; hpFill.renderOrder = 61;
    bar.add(bg, hpFill);
    bar.visible = false;
    hp.add(bar);
    let marker: THREE.Group | null = null;
    if (local || team !== this.localTeam) {
      marker = new THREE.Group();
      const tex = D(local ? chevronTexture() : badgeTexture(tc.body));
      const size = local ? 0.95 : 0.78;
      const m = new THREE.Mesh(D(new THREE.PlaneGeometry(size, size)), D(new THREE.MeshBasicMaterial({ map: tex, depthTest: false, transparent: true })));
      m.renderOrder = 70; m.position.y = 0.42;
      marker.add(m);
      hp.add(marker);
    }

    // Ghost at the Throne while dead: a translucent crowned King with a respawn countdown ring.
    const ghost = new THREE.Group();
    const gBody = new THREE.Group();
    const gbG = blobGeometry(R * 0.9, 16, 12, 0.95); gbG.scale(W, Hh, W);
    const gb = new THREE.Mesh(D(gbG), D(new THREE.MeshBasicMaterial({ color: tc.light, transparent: true, opacity: 0.6, depthWrite: false })));
    const gbo = new THREE.Mesh(gbG, D(Object.assign(outlineMaterial(tc.dark, 0.05), { transparent: true, opacity: 0.5, depthWrite: false })));
    const gc = new THREE.Mesh(crownG, D(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.85 })));
    gc.position.y = R * 0.9 * 2 * 0.95 * Hh - 0.06;
    gBody.add(gbo, gb, gc);
    ghost.add(gBody);
    const ghostRing2 = makeRing(1.75, 1.97);
    ghostRing2.u.uColor.value.set(tc.light);
    ghostRing2.group.position.y = 0.02;
    ghost.add(ghostRing2.group);
    disposables.push(ghostRing2);
    ghost.visible = false;

    // Bake all rigid parts into one mesh per material: a King is ~12 draw calls instead of ~35.
    for (const g of mergeRigid(lean, new Set<THREE.Object3D>([cape, xray]))) disposables.push(g);
    // Every part of the King writes KING_STENCIL, so the x-ray pass ignores self-occlusion (crown over body).
    lean.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.xray) return;
      Object.assign(m.material as THREE.Material, stencil);
    });
    return {
      team, fixture: null, root, lean, cape, bodyMat, top, ring, ringMat, marker, stars, shield, aura, hp, hpBar: bar, hpFill, hpFillMat, ghost, ghostRing: ghostRing2,
      yaw: 0, hop: 0, lastX: 0, lastY: 0, spd: 0, capeYaw: 0, capeFlare: 0.12, disposables,
      flashT: -1, flashK: 0, hitT: -9, hitK: 0, recoil: 0, shieldT: -9,
    };
  }

  clear(): void {
    for (const v of this.views) { for (const d of v.disposables) d.dispose(); this.group.remove(v.root, v.hp, v.ghost); }
    this.views = [];
  }

  dispose(): void {
    this.clear();
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  }
}

/** Replace every mesh under `parent` (except `keep` subtrees) with one merged mesh per material, transforms baked. */
function mergeRigid(parent: THREE.Object3D, keep: Set<THREE.Object3D>): THREE.BufferGeometry[] {
  parent.updateMatrixWorld(true);
  const inv = parent.matrixWorld.clone().invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const victims: THREE.Object3D[] = [];
  const walk = (o: THREE.Object3D) => {
    if (keep.has(o)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const g = posNormal(m.geometry.clone()).applyMatrix4(inv.clone().multiply(m.matrixWorld));
      const mat = m.material as THREE.Material;
      (byMat.get(mat) ?? byMat.set(mat, []).get(mat)!).push(g);
    }
    for (const c of o.children) walk(c);
  };
  for (const c of parent.children) { if (!keep.has(c)) victims.push(c); walk(c); }
  for (const v of victims) v.removeFromParent();
  const out: THREE.BufferGeometry[] = [];
  for (const [mat, gs] of byMat) {
    const merged = mergeGeometries(gs, false);
    gs.forEach((g) => g.dispose());
    if (merged) { parent.add(new THREE.Mesh(merged, mat)); out.push(merged); }
  }
  return out;
}

function fresnelMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uColor, 0.12 + 0.75 * f);
      #include <colorspace_fragment>
      }`,
  });
}

function auraMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv;
      void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.45 * sin(vUv.x * 62.83)); gl_FragColor = vec4(uColor, a * 0.6);
      #include <colorspace_fragment>
      }`,
  });
}


/** Local player marker: a white chevron with a thick ink outline. */
function chevronTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const path = () => { g.beginPath(); g.moveTo(18, 30); g.lineTo(64, 56); g.lineTo(110, 30); g.lineTo(64, 112); g.closePath(); };
  g.lineJoin = 'round';
  path(); g.lineWidth = 22; g.strokeStyle = PAL.ink; g.stroke();
  path(); g.fillStyle = PAL.white; g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Rival marker: a small team-colour badge ringed in ink with a gold crown inside. */
function badgeTexture(team: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.beginPath(); g.arc(64, 60, 50, 0, Math.PI * 2); g.fillStyle = PAL.ink; g.fill();
  g.beginPath(); g.arc(64, 60, 41, 0, Math.PI * 2); g.fillStyle = team; g.fill();
  g.beginPath(); g.moveTo(64, 116); g.lineTo(50, 100); g.lineTo(78, 100); g.closePath(); g.fillStyle = PAL.ink; g.fill();
  g.beginPath();
  g.moveTo(38, 78); g.lineTo(34, 42); g.lineTo(50, 56); g.lineTo(64, 34); g.lineTo(78, 56); g.lineTo(94, 42); g.lineTo(90, 78); g.closePath();
  g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = PAL.goldDeep; g.stroke(); g.fillStyle = PAL.gold; g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
