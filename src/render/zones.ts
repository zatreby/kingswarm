// Warden turrets and lingering area zones (scorch, vortex). Small fixed pools, reused in place.
import * as THREE from 'three';
import type { World } from '../sim/types';
import { PAL, TeamPalette } from './palette';
import { toon, toonNew, outlineMaterial, faceted } from './materials';
import { merge } from './shapes';
import { sceneX, sceneZ } from './mapping';

const POOL = { turrets: 6, zones: 10 } as const;

const zoneVert = 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const zoneFrag = /* glsl */ `
uniform float uKind;   // 0 scorch, 1 vortex
uniform float uTime, uLife, uR;
uniform vec3 uColor;
varying vec2 vP;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float r = length(vP) / uR;
  if (r > 1.0) discard;
  float fade = smoothstep(0.0, 0.25, uLife);
  vec4 c;
  if (uKind < 0.5) {
    // charred ground: dark soot core, round flickering embers, a hot ragged rim
    vec2 cell = vP * 5.0;
    vec2 id = floor(cell), f = fract(cell) - 0.5;
    float n = hash(id);
    vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
    float dot = 1.0 - smoothstep(0.08, 0.16, length(f - off * 0.5));
    float ember = step(0.62, n) * dot * (0.55 + 0.45 * sin(uTime * (6.0 + n * 8.0) + n * 40.0));
    float soot = 0.75 + 0.25 * hash(floor(vP * 11.0));
    vec3 col = mix(vec3(0.13, 0.09, 0.07) * soot, vec3(1.0, 0.62, 0.25), ember);
    float wob = 0.06 * sin(atan(vP.y, vP.x) * 7.0 + uTime * 2.0);
    float rim = smoothstep(0.72 + wob, 0.9 + wob, r) * (1.0 - smoothstep(0.95, 1.0, r));
    col = mix(col, vec3(1.0, 0.54, 0.24), rim * (0.75 + 0.25 * sin(uTime * 6.0)));
    c = vec4(col, (0.8 * (1.0 - smoothstep(0.8, 1.0, r)) + rim * 0.7 + ember * 0.2) * fade);
  } else {
    // spiral arms turning inward
    float a = atan(vP.y, vP.x);
    float s = sin(a * 3.0 + r * 9.0 + uTime * 7.0);
    float arms = smoothstep(0.2, 0.9, s) * (1.0 - r) * 1.2;
    float rim = smoothstep(0.85, 0.98, r) * (1.0 - smoothstep(0.98, 1.0, r));
    vec3 col = mix(uColor, vec3(1.0), arms * 0.5);
    c = vec4(col, (arms * 0.6 + rim * 0.8 + 0.12) * fade);
  }
  gl_FragColor = c;
  #include <colorspace_fragment>
}`;

export class Zones {
  readonly group = new THREE.Group();
  private turrets: { g: THREE.Group; head: THREE.Group; mat: THREE.MeshToonMaterial }[] = [];
  private zones: { m: THREE.Mesh; u: Record<string, { value: number | THREE.Color }> }[] = [];
  private readonly pal = new TeamPalette();

  constructor() {
    // Turret: stone footing, wooden tripod, team-coloured crossbow head.
    const legs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.CylinderGeometry(0.04, 0.05, 0.62, 5); l.rotateZ(0.32); l.translate(0.12, 0.28, 0); l.rotateY((i * Math.PI * 2) / 3); legs.push(l); }
    const legGeo = faceted(merge(legs));
    const baseGeo = faceted(new THREE.CylinderGeometry(0.34, 0.4, 0.12, 7)); baseGeo.translate(0, 0.06, 0);
    const bodyGeo = faceted(new THREE.BoxGeometry(0.34, 0.2, 0.44)); bodyGeo.translate(0, 0, 0.02);
    const bowGeo = faceted(new THREE.BoxGeometry(0.72, 0.06, 0.08)); bowGeo.translate(0, 0.02, 0.24);
    const boltGeo = faceted(new THREE.ConeGeometry(0.04, 0.3, 4)); boltGeo.rotateX(Math.PI / 2); boltGeo.translate(0, 0.08, 0.3);
    const out = outlineMaterial(PAL.ink, 0.03);
    for (let i = 0; i < POOL.turrets; i++) {
      const g = new THREE.Group(), head = new THREE.Group();
      const mat = toonNew(PAL.blue);
      const parts: [THREE.BufferGeometry, THREE.Material, THREE.Object3D][] = [
        [baseGeo, toon(PAL.stone), g], [legGeo, toon(PAL.wood), g], [bodyGeo, mat, head], [bowGeo, toon(PAL.wood), head], [boltGeo, toon(PAL.stone), head],
      ];
      for (const [geo, m, p] of parts) { const mesh = new THREE.Mesh(geo, m); p.add(mesh); }
      head.add(new THREE.Mesh(bodyGeo, out));
      head.position.y = 0.66;
      g.add(head);
      g.scale.setScalar(1.35);
      g.visible = false;
      this.group.add(g);
      this.turrets.push({ g, head, mat });
    }
    const zg = new THREE.PlaneGeometry(2, 2); zg.rotateX(-Math.PI / 2);
    for (let i = 0; i < POOL.zones; i++) {
      const u = { uKind: { value: 0 }, uTime: { value: 0 }, uLife: { value: 1 }, uR: { value: 1 }, uColor: { value: new THREE.Color() } };
      const m = new THREE.Mesh(zg, new THREE.ShaderMaterial({ uniforms: u, vertexShader: zoneVert, fragmentShader: zoneFrag, transparent: true, depthWrite: false }));
      m.position.y = 0.03; m.renderOrder = 4; m.visible = false;
      this.group.add(m);
      this.zones.push({ m, u });
    }
  }

  setColors(colorBlind: boolean): void { this.pal.set(colorBlind); }

  update(world: World, time: number): void {
    for (let i = 0; i < this.turrets.length; i++) {
      const v = this.turrets[i], t = world.turrets[i];
      v.g.visible = !!t;
      if (!t) continue;
      v.g.position.set(sceneX(t.x), 0, sceneZ(t.y));
      // sim aim is radians in sim space (x right, y toward camera); the head's forward is +z
      v.head.rotation.y = Math.PI / 2 - t.aim;
      v.mat.color.copy(this.pal.body[t.team]);
      // sink away in the last half second of life
      v.g.scale.setScalar(1.35 * Math.min(1, t.life * 2));
    }
    for (let i = 0; i < this.zones.length; i++) {
      const v = this.zones[i], z = world.zones[i];
      v.m.visible = !!z;
      if (!z) continue;
      v.m.position.set(sceneX(z.x), 0.03 + i * 0.002, sceneZ(z.y));
      v.m.scale.set(z.r, 1, z.r);
      v.u.uKind.value = z.kind === 'scorch' ? 0 : 1;
      v.u.uTime.value = time;
      v.u.uLife.value = z.maxLife > 0 ? z.life / z.maxLife : 1;
      v.u.uR.value = 1;
      (v.u.uColor.value as THREE.Color).copy(this.pal.light[z.team]);
    }
  }

  dispose(): void {
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  }
}
