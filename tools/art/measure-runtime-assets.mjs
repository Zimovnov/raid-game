/** Asset budgets from existing runtime files; these are not GPU/frame-time measurements. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { CATALOG } from '../../dist/src/content/catalog.js';
import { MODEL_ASSETS } from '../../dist/src/content/model-assets.js';
import { createWeapon } from '../../dist/src/domain/items.js';
import { weaponModel } from '../../dist/src/rendering/models.js';
import { geometry } from '../../dist/src/rendering/geometry.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = new Map();
for (const asset of Object.values(MODEL_ASSETS)) {
  const file = asset.url.split('?')[0]; if (files.has(file)) continue;
  const bytes = await fs.readFile(path.join(root, 'public', file));
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(8) !== bytes.length) throw Error('Invalid GLB: ' + file);
  const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12))), groups = {};
  const visit = (index, inherited = {}) => {
    const node = data.nodes[index], extras = node.extras?.assetKey ? node.extras : inherited;
    if (node.mesh !== undefined) {
      const key = extras.lod + ':' + extras.assetKey;
      const group = groups[key] ||= { triangles: 0, drawCalls: 0, materials: new Set(), uv: true, normals: true };
      for (const primitive of data.meshes[node.mesh].primitives) {
        const count = data.accessors[primitive.indices ?? primitive.attributes.POSITION].count;
        if (primitive.mode !== undefined && primitive.mode !== 4) throw Error('Unsupported primitive mode: ' + file);
        group.triangles += count / 3; group.drawCalls++;
        group.materials.add(primitive.material);
        group.uv &&= primitive.attributes.TEXCOORD_0 !== undefined;
        group.normals &&= primitive.attributes.NORMAL !== undefined;
      }
    }
    for (const child of node.children || []) visit(child, extras);
  };
  for (const scene of data.scenes || []) for (const index of scene.nodes || []) visit(index);
  for (const group of Object.values(groups)) group.materials = [...group.materials];
  files.set(file, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), materialCount: data.materials?.length || 0, images: data.images?.length || 0, groups });
}
const weapons = [];
for (const item of Object.values(CATALOG).filter(item => item.category === 'weapon')) {
  const parts = weaponModel(createWeapon(item.id, false)), assembly = {};
  for (const lod of [0, 1]) {
    const materials = new Set(); let triangles = 0, drawCalls = 0;
    for (const part of parts.filter(part => part.asset?.first)) {
      const asset = MODEL_ASSETS[part.asset.weapon], file = files.get(asset.url.split('?')[0]), group = file.groups[lod + ':' + part.asset.group];
      if (!group) throw Error('Missing group: ' + item.id + '/' + part.asset.group);
      triangles += group.triangles; drawCalls += group.drawCalls;
      for (const material of group.materials) materials.add(asset.url + '/' + material);
    }
    const proceduralTriangles = parts.filter(part => !part.asset).reduce((sum, part) => sum + geometry(part.shape).count / 3, 0);
    assembly['lod' + lod] = { triangles: triangles + proceduralTriangles, trianglesGLB: triangles, trianglesProcedural: proceduralTriangles, drawCallsGLB: drawCalls, materialsGLB: materials.size };
  }
  weapons.push({ id: item.id, name: item.name, defaultAssembly: assembly, proceduralParts: parts.filter(part => !part.asset).length });
}
const report = { generatedAt: new Date().toISOString(), scope: 'Existing runtime assets before art replacement. Default assembled weapons only; material primitive counts approximate scene draw calls. No FPS, CPU or GPU timing claimed.', files: Object.fromEntries(files), weapons };
const target = process.argv[2] || path.join(root, 'art/overhaul/baseline-assets.json');
await fs.writeFile(target, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ files: files.size, weapons: weapons.length, proceduralDefaultParts: weapons.reduce((sum, item) => sum + item.proceduralParts, 0), report: target }, null, 2));
