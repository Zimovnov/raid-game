import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { validateCharacterAssetDefinition, validateCharacterMeshMetadata } from '../dist/src/rendering/character-asset-contract.js';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await fs.readFile(new URL('art/overhaul/character_sources/manifest.json', root), 'utf8'));
const digest = await import('node:crypto');

test('all 45 authored character layers are distinct, complete and use the existing rigid contract', async () => {
    assert.equal(manifest.layers.length, 45);
    assert.equal(new Set(manifest.layers.map(row => row.id)).size, 45);
    assert.equal(new Set(manifest.layers.map(row => row.sha256)).size, 45);
    for (const row of manifest.layers) {
        const bytes = await fs.readFile(new URL('public'+row.url, root));
        assert.equal(digest.createHash('sha256').update(bytes).digest('hex'), row.sha256, row.id);
        assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
        assert.equal(bytes.readUInt32LE(8), bytes.length);
        const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.toString('utf8', 20, 20+jsonLength));
        assert.equal(gltf.skins, undefined, row.id+' must preserve rigid anchors');
        const definition = {url:row.url, frame:'meters', groups:Object.keys(row.groups), character:{layer:row.layer,groups:row.groups}};
        validateCharacterAssetDefinition(definition);
        const coverage = new Set();
        for (const node of gltf.nodes.filter(node => node.mesh !== undefined)) {
            validateCharacterMeshMetadata(definition,node.extras,false);
            coverage.add(node.extras.assetKey+':'+node.extras.lod+':'+node.extras.materialRole);
            for (const primitive of gltf.meshes[node.mesh].primitives) {
                assert.notEqual(primitive.attributes.TEXCOORD_0,undefined,row.id+' UV missing');
                assert.notEqual(primitive.attributes.NORMAL,undefined,row.id+' normal missing');
            }
        }
        for (const [group, metadata] of Object.entries(row.groups)) for (const lod of [0,1]) for (const role of metadata.roles) assert.ok(coverage.has(group+':'+lod+':'+role),row.id+' incomplete role/LOD');
        assert.ok(row.triangles[1] < row.triangles[0],row.id+' LOD1 must actually simplify geometry');
    }
});

test('embedded PBR maps contain valid color, nonzero normals and roughness, including reopened GLB bytes', async () => {
    const checked = new Set();
    for (const row of manifest.layers) {
        const bytes = await fs.readFile(new URL('public'+row.url, root));
        const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.toString('utf8',20,20+jsonLength));
        const binary = 20+jsonLength+8;
        for (const material of gltf.materials) {
            if (checked.has(material.name)) continue;
            checked.add(material.name);
            for (const [kind, texture] of [['color',material.pbrMetallicRoughness.baseColorTexture],['normal',material.normalTexture],['roughness',material.pbrMetallicRoughness.metallicRoughnessTexture]]) {
                assert.ok(texture, material.name+' '+kind+' missing');
                const image=gltf.images[gltf.textures[texture.index].source], view=gltf.bufferViews[image.bufferView];
                const stats=await sharp(bytes.subarray(binary+(view.byteOffset||0),binary+(view.byteOffset||0)+view.byteLength)).stats();
                assert.ok(stats.channels.slice(0,3).some(c=>c.mean>3),material.name+' '+kind+' is black');
                if (kind==='normal') assert.ok(stats.channels[2].mean>220,material.name+' normal blue channel invalid');
                if (kind==='roughness') assert.ok(stats.channels[1].mean>80,material.name+' unexpectedly glossy');
            }
        }
    }
    assert.ok(checked.size>=15);
});
