// Fixed diorama camera: 56 degree tilt, narrow lens, fitted so the whole island is in frame at any aspect.
import * as THREE from 'three';
import { sceneX, sceneZ, simX, simY } from './mapping';

export const CAM = {
  tiltDeg: 56,
  fovDeg: 28,
  /** Fraction of the view kept clear around the fitted island (NDC units). */
  pad: 0.03,
} as const;

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(CAM.fovDeg, 16 / 9, 5, 400);
  /** Base pose after fitting; shake is applied on top each frame. */
  readonly basePos = new THREE.Vector3();
  readonly baseQuat = new THREE.Quaternion();
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly v = new THREE.Vector3();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  /** Scene-space points that must stay in frame (island outline corners and tall rim props). */
  private fitPoints: THREE.Vector3[] = [];

  setFitBounds(halfW: number, halfH: number, backHeight: number, cliffDepth: number): void {
    this.fitPoints = [
      new THREE.Vector3(-halfW, 0, -halfH), new THREE.Vector3(halfW, 0, -halfH),
      new THREE.Vector3(-halfW, 0, halfH), new THREE.Vector3(halfW, 0, halfH),
      new THREE.Vector3(-halfW, backHeight, -halfH), new THREE.Vector3(halfW, backHeight, -halfH),
      // cliff bottom at the near edge shows below the grass
      new THREE.Vector3(-halfW, -cliffDepth, halfH + 0.45), new THREE.Vector3(halfW, -cliffDepth, halfH + 0.45),
    ];
  }

  /** Fit distance and target so every fit point lands inside the view, centred vertically. */
  fit(aspect: number): void {
    const cam = this.camera, tilt = THREE.MathUtils.degToRad(CAM.tiltDeg);
    cam.aspect = aspect;
    cam.fov = CAM.fovDeg;
    cam.updateProjectionMatrix();
    const dir = new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt));
    const target = new THREE.Vector3();
    const lim = 1 - CAM.pad;
    const extent = (d: number) => {
      cam.position.copy(target).addScaledVector(dir, d);
      cam.lookAt(target);
      cam.updateMatrixWorld(true);
      let maxX = 0, minY = Infinity, maxY = -Infinity;
      for (const p of this.fitPoints) {
        this.v.copy(p).project(cam);
        maxX = Math.max(maxX, Math.abs(this.v.x));
        minY = Math.min(minY, this.v.y);
        maxY = Math.max(maxY, this.v.y);
      }
      return { maxX, minY, maxY };
    };
    let d = 40;
    for (let outer = 0; outer < 6; outer++) {
      // Bisect distance so the widest extent just fits.
      let lo = 5, hi = 300;
      for (let i = 0; i < 40; i++) {
        d = (lo + hi) / 2;
        const e = extent(d);
        if (e.maxX > lim || (e.maxY - e.minY) / 2 > lim) lo = d; else hi = d;
      }
      d = hi;
      // Re-centre vertically: slide the target along z by the NDC imbalance.
      const e = extent(d);
      const mid = (e.maxY + e.minY) / 2;
      const worldPerNdc = d * Math.tan(THREE.MathUtils.degToRad(CAM.fovDeg / 2)) / Math.sin(tilt);
      target.z -= mid * worldPerNdc;
    }
    extent(d);
    this.basePos.copy(cam.position);
    this.baseQuat.copy(cam.quaternion);
  }

  /** Client (viewport) px -> sim ground point. */
  screenToWorld(clientX: number, clientY: number, rect: DOMRect): { x: number; y: number } {
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, this.v);
    if (!hit) return { x: NaN, y: NaN };
    return { x: simX(hit.x), y: simY(hit.z) };
  }

  /** Sim point (+ height) -> CSS px relative to the canvas top-left. */
  worldToScreen(x: number, y: number, height: number, width: number, heightPx: number): { x: number; y: number } {
    this.v.set(sceneX(x), height, sceneZ(y)).project(this.camera);
    return { x: (this.v.x * 0.5 + 0.5) * width, y: (-this.v.y * 0.5 + 0.5) * heightPx };
  }
}
