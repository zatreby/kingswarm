// Capture rings: a ground ring per building whose arc fills with the owner's / claimant's colour.
// A second "ghost" pass draws only where units stand (stencil), so the ring still reads under a crowd.
import * as THREE from 'three';

/** Stencil value written by critters; ghost rings draw only there. Kings write KING_STENCIL so rings never paint over a King. */
export const UNIT_STENCIL = 1;
export const KING_STENCIL = 2;

const vert = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const frag = /* glsl */ `
uniform float uFill;      // 0..1 arc in uColor
uniform vec3 uColor;
uniform vec3 uBack;       // empty-track colour
uniform float uContest;   // 1 = both teams present
uniform float uPattern;   // 1 = colour-blind notches on this ring's colour
uniform float uTime;
uniform float uR0, uR1;   // inner / outer radius
uniform float uAlpha;
uniform float uZone;      // soft zone tint inside the ring
uniform float uCrown;     // crown ring mode: uFill = team 0 (clockwise), uFill2 = team 1 (counter-clockwise)
uniform float uFill2;
uniform vec3 uColor2;
varying vec2 vP;
const float PI = 3.14159265;
void main() {
  float r = length(vP);
  float aa = fwidth(r) * 1.2;
  float band = smoothstep(uR0 - aa, uR0 + aa, r) * (1.0 - smoothstep(uR1 - aa, uR1 + aa, r));
  // angle measured clockwise from screen-up (-z), 0..1
  float a = fract(atan(vP.x, -vP.y) / (2.0 * PI) + 1.0);
  float edge = fwidth(a) * 1.5;
  vec3 col = uBack;
  float alpha = 0.55;
  if (uCrown > 0.5) {
    float f0 = 1.0 - smoothstep(uFill - edge, uFill + edge, a);
    float f1 = smoothstep(1.0 - uFill2 - edge, 1.0 - uFill2 + edge, a);
    col = mix(col, uColor, f0); col = mix(col, uColor2, f1 * (1.0 - f0));
    alpha = mix(alpha, 1.0, max(f0, f1));
  } else {
    float f = 1.0 - smoothstep(uFill - edge, uFill + edge, a);
    if (uFill >= 0.999) f = 1.0;
    col = mix(col, uColor, f);
    alpha = mix(alpha, 1.0, f);
    if (uPattern > 0.5 && f > 0.5) {
      // notches every 1/12 turn: a non-colour cue for colour-blind players
      float n = fract(a * 12.0);
      col = mix(col, uBack, step(0.82, n));
    }
  }
  if (uContest > 0.5) {
    // marching diagonal stripes + pulse: frozen, fought over
    float s = fract((a * 40.0) - uTime * 1.5 + (r - uR0) / (uR1 - uR0) * 0.5);
    col = mix(col, vec3(1.0), step(0.5, s) * 0.55);
    alpha = max(alpha, 0.75 + 0.25 * sin(uTime * 8.0));
  }
  // thin dark rims so the ring reads on any ground
  float rim = smoothstep(uR0 + 0.035 + aa, uR0 + 0.035 - aa, r) + smoothstep(uR1 - 0.035 - aa, uR1 - 0.035 + aa, r);
  col = mix(col, uBack * 0.5, clamp(rim, 0.0, 1.0) * 0.8);
  float zone = (1.0 - smoothstep(uR0 - aa, uR0 + aa, r)) * uZone;
  float outA = band * alpha + zone * 0.16;
  vec3 outC = band > 0.001 ? col : uColor;
  if (outA < 0.003) discard;
  gl_FragColor = vec4(outC, outA * uAlpha);
  #include <colorspace_fragment>
}`;

export interface RingUniforms {
  uFill: { value: number }; uFill2: { value: number };
  uColor: { value: THREE.Color }; uColor2: { value: THREE.Color }; uBack: { value: THREE.Color };
  uContest: { value: number }; uPattern: { value: number }; uTime: { value: number };
  uR0: { value: number }; uR1: { value: number }; uAlpha: { value: number }; uZone: { value: number }; uCrown: { value: number };
}

export interface Ring { group: THREE.Group; u: RingUniforms; /** The see-through-crowd pass; hide it when nobody stands on the ring. */ ghost: THREE.Mesh; dispose(): void }

export function makeRing(r0: number, r1: number, crown = false): Ring {
  const u: RingUniforms = {
    uFill: { value: 0 }, uFill2: { value: 0 },
    uColor: { value: new THREE.Color('#ffffff') }, uColor2: { value: new THREE.Color('#ffffff') }, uBack: { value: new THREE.Color('#1B2430') },
    uContest: { value: 0 }, uPattern: { value: 0 }, uTime: { value: 0 },
    uR0: { value: r0 }, uR1: { value: r1 }, uAlpha: { value: 1 }, uZone: { value: 0 }, uCrown: { value: crown ? 1 : 0 },
  };
  const geo = new THREE.PlaneGeometry(r1 * 2 + 0.2, r1 * 2 + 0.2);
  geo.rotateX(-Math.PI / 2);
  const base = new THREE.ShaderMaterial({ uniforms: u as unknown as Record<string, THREE.IUniform>, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false });
  base.polygonOffset = true; base.polygonOffsetFactor = -2; base.polygonOffsetUnits = -2;
  // Ghost: same uniforms (plus a fade), no depth test, only where a unit wrote the stencil.
  const gu = { ...u, uAlpha: { value: 0.3 }, uZone: { value: 0 } };
  const ghost = new THREE.ShaderMaterial({
    uniforms: gu as unknown as Record<string, THREE.IUniform>, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: false,
    stencilWrite: true, stencilRef: UNIT_STENCIL, stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp, stencilWriteMask: 0,
  });
  const g = new THREE.Group();
  const m1 = new THREE.Mesh(geo, base);
  m1.position.y = 0.035; m1.renderOrder = 1;
  const m2 = new THREE.Mesh(geo, ghost);
  m2.position.y = 0.035; m2.renderOrder = 50;
  g.add(m1, m2);
  return { group: g, u, ghost: m2, dispose() { geo.dispose(); base.dispose(); ghost.dispose(); } };
}
