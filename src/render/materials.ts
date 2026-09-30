// Toon look: one shared 3-step gradient, cached flat-colour toon materials, inverted-hull outlines,
// and the KayKit atlas material with an optional per-vertex team tint (see tools/assets/build-models.mjs).
import * as THREE from 'three';

const LOOK = {
  /** Toon light steps (shadow side, terminator, lit). Kept high so shade reads as colour, not black. */
  gradient: [120, 200, 255],
  /** Team-tinted atlas texels: luminance of the blue swatch that maps to the plain team colour. */
  teamRefLum: 0.22,
} as const;

let gradientTex: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (gradientTex) return gradientTex;
  const g = LOOK.gradient, data = new Uint8Array(g.length * 4);
  g.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  gradientTex = new THREE.DataTexture(data, g.length, 1, THREE.RGBAFormat);
  gradientTex.minFilter = THREE.NearestFilter;
  gradientTex.magFilter = THREE.NearestFilter;
  gradientTex.generateMipmaps = false;
  gradientTex.needsUpdate = true;
  return gradientTex;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();
/** Shared flat-colour toon material. Do not mutate the result; ask for a fresh one with `toonNew`. */
export function toon(color: THREE.ColorRepresentation, key = ''): THREE.MeshToonMaterial {
  const k = new THREE.Color(color).getHexString() + key;
  let m = toonCache.get(k);
  if (!m) { m = toonNew(color); toonCache.set(k, m); }
  return m;
}
export function toonNew(color: THREE.ColorRepresentation, params: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...params });
}

/** Inverted-hull outline: back faces pushed out along the normal by `width` (object space, before instance scale). */
export function outlineMaterial(color: THREE.ColorRepresentation, width: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uOutline = { value: width };
    s.vertexShader = 'uniform float uOutline;\n' + s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * uOutline;');
  };
  m.customProgramCacheKey = () => 'outline';
  m.userData.width = width;
  return m;
}

/** Atlas material for KayKit models. With `team`, vertices flagged by the `_team` attribute take that colour, keeping the atlas shading. */
export function kitMaterial(atlas: THREE.Texture, team: THREE.ColorRepresentation | null): THREE.MeshToonMaterial & { userData: { team?: { value: THREE.Color } } } {
  const m = new THREE.MeshToonMaterial({ map: atlas, gradientMap: toonGradient() });
  if (team === null) return m;
  const uTeam = { value: new THREE.Color(team) };
  m.userData.team = uTeam;
  m.onBeforeCompile = (s) => {
    s.uniforms.uTeam = uTeam;
    s.vertexShader = 'attribute float _team;\nvarying float vTeam;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTeam = _team;');
    s.fragmentShader = 'uniform vec3 uTeam;\nvarying float vTeam;\n' + s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      if (vTeam > 0.5) {
        float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = uTeam * clamp(pow(l / ${LOOK.teamRefLum.toFixed(3)}, 0.5), 0.6, 1.15);
      }`);
  };
  m.customProgramCacheKey = () => 'kit-team';
  return m;
}

/** Radial soft disc texture (blob shadows, glows). */
export function radialTexture(size = 64, inner = 0.0, outer = 1.0): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, (inner * size) / 2, size / 2, size / 2, (outer * size) / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Non-indexed copy with per-face normals: the faceted low-poly look for hard things (toon has no flatShading). */
export function faceted(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const f = g.index ? g.toNonIndexed() : g.clone();
  f.deleteAttribute('normal');
  f.computeVertexNormals();
  return f;
}
