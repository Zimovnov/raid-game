import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_MODEL_ASSETS } from '../dist/src/content/character-model-assets.js';
import { MODEL_ASSETS } from '../dist/src/content/model-assets.js';
import { CHARACTER_LAYER_JOINTS, validateCharacterAssetDefinition, validateCharacterMeshMetadata } from '../dist/src/rendering/character-asset-contract.js';
import { bindCharacterAssets, characterLayerForSlot } from '../dist/src/rendering/character-asset-binding.js';
import { characterAppearanceModel, characterJointPose } from '../dist/src/rendering/apparel.js';
import { handsModel, weaponMotion } from '../dist/src/rendering/weapon-animation.js';
import { defaultAppearance } from '../dist/src/content/apparel.js';
import { createItem, createWeapon } from '../dist/src/domain/items.js';
import { model, transform } from '../dist/src/rendering/math.js';

const near = (a, b) => a.forEach((n, i) => assert(Math.abs(n - b[i]) < 1e-6, `${a} vs ${b}`));
const definition = layer => ({ url: 'neutral-engineering-fixture', frame: 'meters', groups: CHARACTER_LAYER_JOINTS[layer].map(joint => 'probe_' + joint), character: { layer, groups: Object.fromEntries(CHARACTER_LAYER_JOINTS[layer].map(joint => ['probe_' + joint, { joint, roles: ['fabric', 'trim'] }])) } });
function registered(id, layer, run) {
    const asset = 'test_character_' + layer, oldSelection = CHARACTER_MODEL_ASSETS[id], oldDefinition = MODEL_ASSETS[asset];
    CHARACTER_MODEL_ASSETS[id] = { asset, layer }; MODEL_ASSETS[asset] = definition(layer);
    try { return run(asset); }
    finally {
        if (oldSelection) CHARACTER_MODEL_ASSETS[id] = oldSelection; else delete CHARACTER_MODEL_ASSETS[id];
        if (oldDefinition) MODEL_ASSETS[asset] = oldDefinition; else delete MODEL_ASSETS[asset];
    }
}
const appearance = () => defaultAppearance('BEAR');
const character = () => ({ name: 'Fixture', faction: 'BEAR', face: 2, outfit: 0, appearance: appearance() });

test('character layers require their complete existing rigid rig and explicit material roles', () => {
    const valid = definition('jacket'); validateCharacterAssetDefinition(valid);
    const incomplete = structuredClone(valid); delete incomplete.character.groups.probe_foreR;
    assert.throws(() => validateCharacterAssetDefinition(incomplete), /Incomplete/);
    const missingJoint = structuredClone(valid); missingJoint.character.groups.probe_foreR.joint = 'foreL';
    assert.throws(() => validateCharacterAssetDefinition(missingJoint), /Missing character joint: foreR/);
    const wrongRig = structuredClone(valid); wrongRig.character.groups.probe_foreR.joint = 'head';
    assert.throws(() => validateCharacterAssetDefinition(wrongRig), /rigid group/);
    const wrongRole = structuredClone(valid); wrongRole.character.groups.probe_foreR.roles = ['weapon'];
    assert.throws(() => validateCharacterAssetDefinition(wrongRole), /rigid group/);
    assert.throws(() => validateCharacterAssetDefinition({ ...valid, frame: 'normalized' }), /coordinate frame/);
    const metadata = { assetKey: 'probe_foreL', lod: 0, raidLayer: 'jacket', raidJoint: 'foreL', materialRole: 'fabric' };
    validateCharacterMeshMetadata(valid, metadata, false);
    assert.throws(() => validateCharacterMeshMetadata(valid, { ...metadata, raidJoint: 'foreR' }, false), /metadata/);
    assert.throws(() => validateCharacterMeshMetadata(valid, metadata, true), /metadata/);
});

test('all legacy pieces of a layer share one atomic asset; armor, packs and patches keep their owner', () => {
    const make = slot => ({ joint: 'torso', part: { shape: 'box', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], c: [.5, .4, .3], slot } });
    const bound = ['jacket:body', 'jacket:pocket', 'armor:front', 'pack:body', 'patch:L'].map(make), original = structuredClone(bound);
    registered('fixture_jacket', 'jacket', () => {
        const parts = bindCharacterAssets(bound, [{ id: 'fixture_jacket', layer: 'jacket', skin: [.7, .5, .3], fabric: 'multicam', fabricColor: [.2, .3, .2] }], true);
        assert.equal(parts.filter(p => p.part.assetOnly).length, 5);
        assert(parts.slice(0, 2).every(p => p.part.asset?.kind === 'character' && p.part.asset.first === false));
        assert(parts.slice(2, 5).every(p => !p.part.asset));
        assert.deepEqual(bound, original, 'outfit cache must not be tagged or mutated');
    });
    assert.equal(characterLayerForSlot('hand:L', false), 'body');
    assert.equal(characterLayerForSlot('hand:L', true), 'gloves');
    assert.equal(characterLayerForSlot('rig:front', true), null);
});

test('authored character groups follow joint poses, death and one whole-actor LOD origin', () => {
    const actor = character(), saved = structuredClone(actor), equipment = { armor: createItem('armor_6b13'), helmet: null };
    const baseline = characterAppearanceModel(actor, .8, .7, false, false, equipment);
    registered(actor.appearance.jacket, 'jacket', () => {
        for (const [dead, crouch] of [[false, false], [false, true], [true, false]]) {
            const parts = characterAppearanceModel(actor, .8, .7, dead, crouch, equipment), carriers = parts.filter(p => p.asset?.kind === 'character' && p.asset.layer === 'jacket' && p.asset.first);
            assert.equal(carriers.length, 5);
            const pose = characterJointPose(dead ? 0 : .8, dead ? 0 : .7, dead ? false : crouch, dead ? { relaxed: true } : {});
            for (const part of carriers) {
                const joint = MODEL_ASSETS[part.asset.assetId].character.groups[part.asset.group].joint, frame = pose[joint];
                near(part.asset.transform.p, dead ? [frame.p[0], .40 - frame.p[2], frame.p[1] - .75] : frame.p);
                near(part.asset.transform.s, [1, frame.scaleY || 1, 1]);
                near(part.asset.lodOrigin, carriers[0].asset.lodOrigin);
            }
        }
        const after = characterAppearanceModel(actor, .8, .7, false, false, equipment);
        const unaffected = list => list.filter(p => !p.slot?.startsWith('jacket:') && !p.assetOnly);
        assert.deepEqual(unaffected(after), unaffected(baseline));
    });
    assert.deepEqual(actor, saved);
});

test('first-person uses the same jacket/glove IDs and places authored wrists at the existing action targets', () => {
    const a = appearance(), gun = createWeapon('weapon_ak74m', false);
    registered(a.jacket, 'jacket', () => registered(a.gloves, 'gloves', () => {
        for (const pose of [{}, { reload: .5, mode: 'swap' }, { reload: .6, mode: 'charge' }]) {
            const parts = handsModel(gun, pose, 0, 2, a), motion = weaponMotion(gun, pose), carriers = parts.filter(p => p.asset?.first);
            assert.equal(carriers.filter(p => p.asset.layer === 'jacket').length, 4, 'FP never draws torso');
            assert.equal(carriers.filter(p => p.asset.layer === 'gloves').length, 2);
            for (const side of ['L', 'R']) {
                const sleeve = carriers.find(p => p.asset.layer === 'jacket' && p.asset.group === 'probe_fore' + side);
                const glove = carriers.find(p => p.asset.layer === 'gloves' && p.asset.group === 'probe_fore' + side);
                const frame = sleeve.asset.transform;
                near(transform(model(frame.p, frame.s, frame.r), [0, -.289, 0]), side === 'L' ? motion.left : motion.right);
                assert.deepEqual(frame, glove.asset.transform);
                assert.equal(sleeve.asset.fabric, a.jacketCamo);
            }
        }
    }));
});

test('soft headwear is suppressed by the existing helmet rule before authored carriers are emitted', () => {
    const actor = character(); actor.appearance.headwear = 'head_patrol';
    registered(actor.appearance.headwear, 'headwear', () => {
        assert(characterAppearanceModel(actor).some(p => p.asset?.first && p.asset.layer === 'headwear'));
        assert(!characterAppearanceModel(actor, 0, 0, false, false, { armor: null, helmet: createItem('helmet_6b47') }).some(p => p.asset?.first && p.asset.layer === 'headwear'));
    });
});
