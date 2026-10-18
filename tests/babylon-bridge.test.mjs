import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { BabylonBridge } from '../dist/src/rendering/babylon-bridge.js';

test('Babylon bridge registers and applies thin-instance transforms', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const mesh = new Mesh('probe', scene);
    const geometry = new VertexData();
    geometry.positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    geometry.indices = [0, 1, 2];
    geometry.applyToMesh(mesh);
    const transform = new Float32Array([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 3, 4, 5, 1]);
    mesh.thinInstanceSetBuffer('matrix', transform, 16, true);
    assert.equal(mesh.thinInstanceCount, 1);
    assert.equal(mesh.hasThinInstances, true);
    assert.deepEqual(Array.from(mesh.thinInstanceGetWorldMatrices()[0].m), Array.from(transform));
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test('workshop picks the nearest visible imported or fallback module with its installed slot', () => {
  const engine = new NullEngine({ renderWidth: 512, renderHeight: 512 });
  const scene = new Scene(engine);
  const camera = new FreeCamera('camera', new Vector3(0, 0, 5), scene);
  camera.setTarget(Vector3.Zero()); scene.activeCamera = camera;
  const bridge = { scene, camera, engine };
  const box = (name, z, metadata) => {
    const mesh = new Mesh(name, scene); CreateBoxVertexData({ size: 1 }).applyToMesh(mesh);
    mesh.thinInstanceEnablePicking = true;
    mesh.thinInstanceSetBuffer('matrix', new Float32Array(Matrix.Translation(0, 0, z).m), 16, true);
    mesh.metadata = metadata; mesh.computeWorldMatrix(true); mesh.thinInstanceRefreshBoundingInfo(); return mesh;
  };
  try {
    const body = box('authored-body', 0, { raidAsset: 'weapon_probe', raidGroup: 'body' });
    const fallback = box('fallback-magazine', 1.5, { raidSlots: ['magazine'] });
    for (const scaling of [1, .5, 2]) {
      engine.setHardwareScalingLevel(scaling);
      assert.deepEqual(BabylonBridge.prototype.pickWeapon.call(bridge, .5, .5), { hit: true, slot: 'magazine' });
    }
    engine.setHardwareScalingLevel(1);
    fallback.isVisible = false;
    assert.deepEqual(BabylonBridge.prototype.pickWeapon.call(bridge, .5, .5), { hit: true, slot: '' });
    body.metadata.raidGroup = 'mount_optic__red_dot';
    assert.deepEqual(BabylonBridge.prototype.pickWeapon.call(bridge, .5, .5), { hit: true, slot: 'mount.optic' });
    body.isVisible = false;
    assert.deepEqual(BabylonBridge.prototype.pickWeapon.call(bridge, .5, .5), { hit: false, slot: '' });
  } finally { scene.dispose(); engine.dispose(); }
});
