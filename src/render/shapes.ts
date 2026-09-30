// Small procedural geometries shared by buildings, Kings and critters.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { faceted } from './materials';

/** Strip everything but position+normal so pieces from different generators merge. */
export function posNormal(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
}
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(parts.map(posNormal), false)!;
}

/** A faceted five-point crown, base at y=0, radius ~r. */
export function crownGeometry(r = 0.3, h = 0.28, points = 5, tall = 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const band = new THREE.CylinderGeometry(r, r * 0.88, h * 0.55, points * 2, 1, false);
  band.translate(0, h * 0.275, 0);
  parts.push(band);
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const spike = new THREE.ConeGeometry(r * 0.3, h * 0.75 * tall, 4);
    spike.translate(Math.cos(a) * r * 0.86, h * 0.55 + h * 0.37 * tall, Math.sin(a) * r * 0.86);
    parts.push(spike);
    const ball = new THREE.OctahedronGeometry(r * 0.12, 0);
    ball.translate(Math.cos(a) * r * 0.86, h * 0.55 + h * 0.8 * tall, Math.sin(a) * r * 0.86);
    parts.push(ball);
  }
  return faceted(merge(parts));
}

/** Flag cloth in the pole's local frame: x out from the pole, y down from the top. Blue swallow-tailed, Red triangular (ART.md shape cue). */
export function flagGeometry(team: 0 | 1, len = 0.85, h = 0.52): THREE.BufferGeometry {
  const pts = team === 0
    ? [[0, 0], [len, 0], [len * 0.68, -h / 2], [len, -h], [0, -h]]
    : [[0, 0], [len * 1.05, -h / 2], [0, -h]];
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(s);
  return g;
}

/** Rounded blob body: a sphere squashed a little, flat-ish base at y=0. */
export function blobGeometry(r: number, wSeg = 16, hSeg = 12, squash = 0.88): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, wSeg, hSeg);
  g.scale(1, squash, 1);
  g.translate(0, r * squash, 0);
  return g;
}
