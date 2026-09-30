#!/usr/bin/env node
// Build public/models/kit.glb from the raw KayKit Medieval Hexagon pack (CC0) in assets-src/.
//   bash tools/assets/fetch-kaykit.sh && node tools/assets/build-models.mjs
// One GLB, one shared 256 px atlas, quantized + meshopt. Each model is a root node named after it.
// Team buildings: we ship the blue variant plus a per-vertex `_TEAM` mask (1 where the blue and red
// variants use different atlas UVs, i.e. roofs/banners), so the renderer can tint one model for
// neutral / blue / red / colour-blind instead of shipping four copies.
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, meshopt, textureCompress, mergeDocuments, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync, mkdirSync } from 'node:fs';

const ROOT = 'assets-src/kaykit/hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf';
const OUT = 'public/models/kit.glb';

/** [output name, path of the model to ship, path of the red variant (team models only)] */
const MODELS = [
  ['castle', 'buildings/blue/building_castle_blue.gltf', 'buildings/red/building_castle_red.gltf'],
  ['home_A', 'buildings/blue/building_home_A_blue.gltf', 'buildings/red/building_home_A_red.gltf'],
  ['home_B', 'buildings/blue/building_home_B_blue.gltf', 'buildings/red/building_home_B_red.gltf'],
  ['tower_A', 'buildings/blue/building_tower_A_blue.gltf', 'buildings/red/building_tower_A_red.gltf'],
  ['well', 'buildings/blue/building_well_blue.gltf', 'buildings/red/building_well_red.gltf'],
  ['tree_A', 'decoration/nature/tree_single_A.gltf'],
  ['tree_B', 'decoration/nature/tree_single_B.gltf'],
  ['trees_A', 'decoration/nature/trees_A_small.gltf'],
  ['trees_B', 'decoration/nature/trees_B_small.gltf'],
  ['rock_A', 'decoration/nature/rock_single_A.gltf'],
  ['rock_B', 'decoration/nature/rock_single_B.gltf'],
  ['rock_C', 'decoration/nature/rock_single_C.gltf'],
  ['rock_D', 'decoration/nature/rock_single_D.gltf'],
  ['rock_E', 'decoration/nature/rock_single_E.gltf'],
  ['lily', 'decoration/nature/waterlily_A.gltf'],
  ['reeds', 'decoration/nature/waterplant_A.gltf'],
];

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const out = new Document();
out.createBuffer();
out.createScene('kit');

for (const [name, file, redFile] of MODELS) {
  const doc = await io.read(`${ROOT}/${file}`);
  if (redFile) addTeamMask(doc, await io.read(`${ROOT}/${redFile}`), name);
  const roots = doc.getRoot().listScenes()[0].listChildren();
  if (roots.length !== 1) throw new Error(`${name}: expected one root node, got ${roots.length}`);
  roots[0].setName(name);
  const map = mergeDocuments(out, doc);
  const scene = out.getRoot().listScenes()[0];
  for (const s of out.getRoot().listScenes()) if (s !== scene) { for (const c of s.listChildren()) scene.addChild(c); s.dispose(); }
  void map;
}
// Collapse the per-model buffers into one.
const buf = out.getRoot().listBuffers()[0];
for (const a of out.getRoot().listAccessors()) a.setBuffer(buf);
for (const b of out.getRoot().listBuffers()) if (b !== buf) b.dispose();

await out.transform(
  dedup(),
  prune({ keepAttributes: true }),
  weld(),
  textureCompress({ encoder: sharp, targetFormat: 'png', resize: [256, 256] }),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ pattern: /^(POSITION|NORMAL|TEXCOORD_0)$/ }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
mkdirSync('public/models', { recursive: true });
await io.write(OUT, out);
console.log(`${OUT}: ${(statSync(OUT).size / 1024).toFixed(1)} KB, ${out.getRoot().listMeshes().length} meshes, ${out.getRoot().listTextures().length} texture(s)`);
for (const m of out.getRoot().listMeshes()) {
  let tris = 0; for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
  console.log(`  ${m.getName().padEnd(28)} ${tris} tris`);
}

function addTeamMask(blue, red, name) {
  const bm = blue.getRoot().listMeshes(), rm = red.getRoot().listMeshes();
  let masked = 0, total = 0;
  bm.forEach((mesh, mi) => mesh.listPrimitives().forEach((prim, pi) => {
    const uvB = prim.getAttribute('TEXCOORD_0'), uvR = rm[mi].listPrimitives()[pi].getAttribute('TEXCOORD_0');
    const posB = prim.getAttribute('POSITION'), posR = rm[mi].listPrimitives()[pi].getAttribute('POSITION');
    if (uvB.getCount() !== uvR.getCount()) throw new Error(`${name}: blue/red vertex counts differ`);
    const n = uvB.getCount(), mask = new Float32Array(n), a = [0, 0], b = [0, 0], p = [0, 0, 0], q = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      posB.getElement(i, p); posR.getElement(i, q);
      if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) > 1e-4) throw new Error(`${name}: blue/red vertex order differs at ${i}`);
      uvB.getElement(i, a); uvR.getElement(i, b);
      mask[i] = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 1e-4 ? 1 : 0;
      masked += mask[i]; total++;
    }
    prim.setAttribute('_TEAM', blue.createAccessor().setType('SCALAR').setArray(mask).setBuffer(blue.getRoot().listBuffers()[0]));
  }));
  console.log(`  team mask ${name}: ${masked}/${total} vertices`);
}
