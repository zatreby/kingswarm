// Loads public/models/kit.glb (built by tools/assets/build-models.mjs) into one float geometry per model.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type KitModel =
  | 'castle' | 'home_A' | 'home_B' | 'tower_A' | 'well'
  | 'tree_A' | 'tree_B' | 'trees_A' | 'trees_B'
  | 'rock_A' | 'rock_B' | 'rock_C' | 'rock_D' | 'rock_E' | 'lily' | 'reeds';

export interface Kit {
  atlas: THREE.Texture;
  geo: Record<KitModel, THREE.BufferGeometry>;
  /** Local bounds of each model (origin at its base centre). */
  box: Record<KitModel, THREE.Box3>;
}

export async function loadKit(url: string): Promise<Kit> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const geo = {} as Record<KitModel, THREE.BufferGeometry>, box = {} as Record<KitModel, THREE.Box3>;
  let atlas: THREE.Texture | null = null;
  for (const root of gltf.scene.children) {
    const parts: THREE.BufferGeometry[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!atlas && mat.map) atlas = mat.map;
      parts.push(toFloat(m.geometry).applyMatrix4(m.matrixWorld));
    });
    const g = parts.length === 1 ? parts[0] : mergeGeometries(parts, false)!;
    g.computeBoundingBox();
    geo[root.name as KitModel] = g;
    box[root.name as KitModel] = g.boundingBox!.clone();
  }
  if (!atlas) throw new Error('kit.glb has no atlas');
  const tex = atlas as THREE.Texture;
  tex.anisotropy = 4;
  return { atlas: tex, geo, box };
}

/** Dequantize (KHR_mesh_quantization stores int16/int8) so transforms and merges work in float. */
function toFloat(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    const a = src.getAttribute(name) as THREE.BufferAttribute;
    const n = a.count, size = a.itemSize, arr = new Float32Array(n * size);
    for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) arr[i * size + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));
  return g;
}
