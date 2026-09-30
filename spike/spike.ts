// Look-dev spike: proves the low-poly diorama direction and the headless screenshot pipeline. Throwaway.
import * as THREE from 'three';

const S = 1 / 40; // sim px -> world units
const W = 1280 * S, H = 720 * S;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d3f5e');
scene.fog = new THREE.Fog('#1d3f5e', 60, 110);

const cam = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 1, 300);
function placeCam() {
  cam.aspect = innerWidth / innerHeight;
  const dist = 41 * Math.max(1, (16 / 9) / cam.aspect);
  const tilt = THREE.MathUtils.degToRad(56);
  cam.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist + 1.5);
  cam.lookAt(0, 0, 1.2);
  cam.updateProjectionMatrix();
}
placeCam();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); placeCam(); });

scene.add(new THREE.HemisphereLight('#cfe8ff', '#3a5a2a', 1.15));
const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
sun.position.set(-14, 26, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 70;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun);

const flat = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0, flatShading: true, ...o });
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// water
const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#2b6f9e', roughness: 0.35 }));
water.rotation.x = -Math.PI / 2; water.position.y = -1.1; scene.add(water);

// island: rounded slab with a darker cliff
const shape = new THREE.Shape();
const hw = W / 2 + 1.2, hh = H / 2 + 1.2, r = 3;
shape.moveTo(-hw + r, -hh); shape.lineTo(hw - r, -hh); shape.quadraticCurveTo(hw, -hh, hw, -hh + r); shape.lineTo(hw, hh - r); shape.quadraticCurveTo(hw, hh, hw - r, hh);
shape.lineTo(-hw + r, hh); shape.quadraticCurveTo(-hw, hh, -hw, hh - r); shape.lineTo(-hw, -hh + r); shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
const islandGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: true, bevelSize: 0.35, bevelThickness: 0.35, bevelSegments: 2 });
islandGeo.rotateX(Math.PI / 2);
const island = new THREE.Mesh(islandGeo, [flat('#6fb04a'), flat('#8a6a45')]);
island.position.y = 0; island.receiveShadow = true; scene.add(island);
// grass tint patches
const patchGeo = new THREE.CircleGeometry(1, 7); patchGeo.rotateX(-Math.PI / 2);
for (let i = 0; i < 46; i++) {
  const m = new THREE.Mesh(patchGeo, new THREE.MeshStandardMaterial({ color: i % 2 ? '#7cc054' : '#62a343', roughness: 1 }));
  m.position.set((rnd() - .5) * W, 0.012 + i * 0.0004, (rnd() - .5) * H); m.scale.set(1 + rnd() * 2.4, 1, 0.8 + rnd() * 1.6); m.receiveShadow = true; scene.add(m);
}

const HALF = [{ x: 130, y: 600, t: 'throne' }, { x: 330, y: 470, t: 'village' }, { x: 170, y: 330, t: 'village' }, { x: 430, y: 640, t: 'village' }, { x: 520, y: 300, t: 'village' }, { x: 330, y: 180, t: 'village' }, { x: 620, y: 560, t: 'village' }];
const nodes = [...HALF.map(h => ({ ...h, o: 1 })), ...HALF.map(h => ({ x: 1280 - h.x, y: 720 - h.y, t: h.t, o: 2 })), { x: 640, y: 360, t: 'tower', o: 0 }];
const wx = (x: number) => x * S - W / 2, wz = (y: number) => y * S - H / 2;
const TEAM = ['#d9cfb4', '#3fa7ff', '#ff5a4f'];

// dirt roads between close nodes
for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
  const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d < 285) {
    const g = new THREE.PlaneGeometry(d * S, 0.42); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#c9b27a', roughness: 1 }));
    m.position.set((wx(a.x) + wx(b.x)) / 2, 0.03, (wz(a.y) + wz(b.y)) / 2); m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x); m.receiveShadow = true; scene.add(m);
  }
}

function hut(n: typeof nodes[number], owned: number) {
  const g = new THREE.Group();
  const big = n.t === 'throne';
  const s = big ? 1.45 : 1;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25 * s, 1.35 * s, 0.16, 10), flat('#c9b27a')); base.position.y = 0.08; g.add(base);
  if (n.t === 'tower') {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.7, 10), flat('#8d97a6')); ring.position.y = 0.45; g.add(ring);
    const wat = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.05, 10), new THREE.MeshStandardMaterial({ color: '#69c7ff', roughness: 0.2, emissive: '#1a6fa8', emissiveIntensity: 0.5 })); wat.position.y = 0.78; g.add(wat);
    for (const sx of [-0.8, 0.8]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), flat('#7a5230')); p.position.set(sx, 1.2, 0); g.add(p); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.7, 4), flat('#7a5230')); roof.position.y = 2.25; roof.rotation.y = Math.PI / 4; g.add(roof);
  } else {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.35 * s, 0.95 * s, 1.15 * s), flat('#f1e4c4')); wall.position.y = 0.16 + 0.475 * s; g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25 * s, 1.0 * s, 4), flat(TEAM[owned])); roof.position.y = 0.16 + 0.95 * s + 0.5 * s; roof.rotation.y = Math.PI / 4; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.5 * s, 0.05), flat('#6b4526')); door.position.set(0, 0.16 + 0.25 * s, 0.58 * s); g.add(door);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5 * s, 5), flat('#6b4526')); pole.position.set(0.72 * s, 0.16 + 1.3 * s, -0.3 * s); g.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.32 * s, 0.03), flat(TEAM[owned])); flag.position.set(0.72 * s + 0.3 * s, 0.16 + 1.85 * s, -0.3 * s); g.add(flag);
    if (big) {
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.9, 7), flat('#e6d7b2')); t.position.set(dx * 0.95, 1.1, dz * 0.8); g.add(t); const c = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.6, 7), flat(TEAM[owned])); c.position.set(dx * 0.95, 2.35, dz * 0.8); g.add(c); }
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.26, 5), new THREE.MeshStandardMaterial({ color: '#ffd166', roughness: 0.3, metalness: 0.6, flatShading: true, emissive: '#7a5a10', emissiveIntensity: 0.4 })); crown.position.y = 3.35; g.add(crown);
    }
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(wx(n.x), 0, wz(n.y)); scene.add(g);
}
nodes.forEach((n, i) => hut(n, n.t === 'tower' ? 0 : (i === 0 || i === 1 || i === 2 ? 1 : (i === 7 || i === 8 ? 2 : 0))));

// trees + rocks around the rim
const trunkG = new THREE.CylinderGeometry(0.09, 0.12, 0.5, 5), leafG = new THREE.ConeGeometry(0.55, 1.2, 6), leaf2 = new THREE.ConeGeometry(0.42, 0.9, 6);
for (let i = 0; i < 70; i++) {
  const edge = rnd() < 0.8; let x = (rnd() - .5) * (W + 1), z = (rnd() - .5) * (H + 1);
  if (edge) { if (rnd() < .5) z = (rnd() < .5 ? -1 : 1) * (H / 2 + 0.3 + rnd() * 0.5); else x = (rnd() < .5 ? -1 : 1) * (W / 2 + 0.3 + rnd() * 0.5); }
  if (nodes.some(n => Math.hypot(wx(n.x) - x, wz(n.y) - z) < 2.6)) continue;
  const g = new THREE.Group(), sc2 = 0.8 + rnd() * 0.7, green = ['#3f8f3a', '#2f7d3b', '#4f9c3f'][i % 3];
  const t = new THREE.Mesh(trunkG, flat('#6b4526')); t.position.y = 0.25; g.add(t);
  const l = new THREE.Mesh(leafG, flat(green)); l.position.y = 1.0; g.add(l);
  const l2 = new THREE.Mesh(leaf2, flat(green)); l2.position.y = 1.55; g.add(l2);
  g.scale.setScalar(sc2); g.position.set(x, 0, z); g.rotation.y = rnd() * 6;
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } }); scene.add(g);
}

// critters: instanced blobs with eyes
const N = 110;
const bodyG = new THREE.SphereGeometry(0.27, 12, 9); bodyG.scale(1, 0.9, 1); bodyG.translate(0, 0.25, 0);
const body = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ roughness: 0.55 }), N); body.castShadow = true;
const eyeG = new THREE.SphereGeometry(0.085, 7, 6);
const eyes = new THREE.InstancedMesh(eyeG, new THREE.MeshBasicMaterial({ color: '#fff' }), N * 2);
const pupG = new THREE.SphereGeometry(0.045, 6, 5);
const pups = new THREE.InstancedMesh(pupG, new THREE.MeshBasicMaterial({ color: '#15202b' }), N * 2);
const outG = bodyG.clone(); outG.scale(1.16, 1.14, 1.16); outG.translate(0, -0.02, 0);
const outline = new THREE.InstancedMesh(outG, new THREE.MeshBasicMaterial({ side: THREE.BackSide }), N);
scene.add(body, eyes, pups, outline);
const cr: { x: number, z: number, o: number, ph: number, a: number }[] = [];
const heroPos = [{ x: wx(390), z: wz(420) }, { x: wx(840), z: wz(330) }];
for (let i = 0; i < N; i++) {
  const o = i < 62 ? 1 : 2, hp = heroPos[o - 1]; const guard = rnd() < 0.3; const n = nodes[o === 1 ? (i % 3) : 7 + (i % 2)];
  const a = rnd() * 6.283, d = guard ? 1.2 + rnd() * 1 : 0.9 + Math.sqrt(rnd()) * 2.3;
  cr.push({ x: (guard ? wx(n.x) : hp.x) + Math.cos(a) * d, z: (guard ? wz(n.y) : hp.z) + Math.sin(a) * d, o, ph: rnd() * 6.28, a: o === 1 ? 0.3 : Math.PI - 0.3 });
  body.setColorAt(i, new THREE.Color(TEAM[o])); outline.setColorAt(i, new THREE.Color(o === 1 ? '#0e2f57' : '#5e0f0a'));
}
// a volley of thrown critters mid-air from blue hero toward red
for (let k = 0; k < 14; k++) { const c = cr[k]; const u = k / 14; c.x = heroPos[0].x + (heroPos[1].x - heroPos[0].x) * u * 0.9; c.z = heroPos[0].z + (heroPos[1].z - heroPos[0].z) * u * 0.9; (c as any).air = Math.sin(u * Math.PI) * 1.6 + 0.2; }

function hero(o: number, p: { x: number, z: number }) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), new THREE.MeshStandardMaterial({ color: TEAM[o], roughness: 0.5 })); b.scale.y = 0.95; b.position.y = 0.62; g.add(b); g.scale.setScalar(1.15);
  for (const sx of [-0.17, 0.17]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' })); e.position.set(sx, 0.62, 0.36); g.add(e); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), new THREE.MeshBasicMaterial({ color: '#15202b' })); pu.position.set(sx, 0.62, 0.46); g.add(pu); }
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.24, 5, 1, true), new THREE.MeshStandardMaterial({ color: '#ffd166', roughness: 0.3, metalness: 0.5, flatShading: true, side: THREE.DoubleSide, emissive: '#7a5a10', emissiveIntensity: 0.5 })); crown.position.y = 1.02; g.add(crown);
  const cape = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 8, 1, true, Math.PI * 0.75, Math.PI * 0.5), flat(o === 1 ? '#1c5a95' : '#9a2820', { side: THREE.DoubleSide })); cape.position.set(0, 0.42, -0.12); g.add(cape);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 24), new THREE.MeshBasicMaterial({ color: TEAM[o], transparent: true, opacity: 0.85 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
  g.traverse(m => { if ((m as THREE.Mesh).isMesh && m !== ring) m.castShadow = true; });
  g.position.set(p.x, 0, p.z); g.rotation.y = o === 1 ? 0.5 : -2.4; scene.add(g);
}
hero(1, heroPos[0]); hero(2, heroPos[1]);

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), SC = new THREE.Vector3(), E = new THREE.Euler();
function frame(t: number) {
  const T = t / 1000;
  for (let i = 0; i < N; i++) {
    const c = cr[i], air = (c as any).air || 0, hop = air ? 0 : Math.abs(Math.sin(T * 9 + c.ph)) * 0.09, sq = air ? 1 : 1 - hop * 1.2;
    E.set(0, c.a, 0); Q.setFromEuler(E);
    P.set(c.x, hop + air, c.z); SC.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); M.compose(P, Q, SC); body.setMatrixAt(i, M); outline.setMatrixAt(i, M);
    const fx = Math.sin(c.a), fz = Math.cos(c.a), rx = Math.cos(c.a), rz = -Math.sin(c.a);
    for (let e = 0; e < 2; e++) { const s = e ? 1 : -1; P.set(c.x + fx * 0.2 + rx * 0.11 * s, 0.32 + hop + air, c.z + fz * 0.2 + rz * 0.11 * s); SC.setScalar(1); M.compose(P, Q, SC); eyes.setMatrixAt(i * 2 + e, M); P.set(c.x + fx * 0.265 + rx * 0.11 * s, 0.32 + hop + air, c.z + fz * 0.265 + rz * 0.11 * s); M.compose(P, Q, SC); pups.setMatrixAt(i * 2 + e, M); }
  }
  body.instanceMatrix.needsUpdate = true; outline.instanceMatrix.needsUpdate = true; eyes.instanceMatrix.needsUpdate = true; pups.instanceMatrix.needsUpdate = true;
  renderer.render(scene, cam);
  (window as any).__frames = ((window as any).__frames || 0) + 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
