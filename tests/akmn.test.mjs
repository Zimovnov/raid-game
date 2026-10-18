import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AnimationEventCursor } from '../dist/src/rendering/animation-events.js';
import { usesAKMNAsset, AKMN_ASSET_URL } from '../dist/src/content/akmn-asset.js';
import { createWeapon, createItem } from '../dist/src/domain/items.js';
import { muzzlePoint, viewWeaponOffset } from '../dist/src/domain/weapon-pose.js';
import { weaponLayout } from '../dist/src/content/weapon-layouts.js';

test('AKMN asset URL invalidates immutable cache when rig bytes change', () => {
    const hash = createHash('sha256').update(readFileSync('public/assets/akmn/AKMN_FP_ContactReview.glb')).digest('hex').slice(0, 12);
    assert.equal(AKMN_ASSET_URL, `/assets/akmn/AKMN_FP_ContactReview.glb?v=${hash}`);
});

test('AKMN visual events cross skipped frames exactly once and reset on playback restart', () => {
    const cursor = new AnimationEventCursor();
    const events = [{name:'detach',seconds:.5,normalized:.2},{name:'attach',seconds:2,normalized:.8}];
    assert.deepEqual(cursor.advance('one',.1,events), []);
    assert.deepEqual(cursor.advance('one',2.4,events).map(e=>e.name), ['detach','attach']);
    assert.deepEqual(cursor.advance('one',2.4,events), []);
    assert.deepEqual(cursor.advance('two',.6,events).map(e=>e.name), ['detach']);
    cursor.reset();
    assert.deepEqual(cursor.advance('three',.2,events), []);
});
test('AKMN legacy rig is retired in favour of the common Field Kit model', () => {
    const gun=createWeapon('weapon_akm'); const before=structuredClone(gun);
    assert.equal(usesAKMNAsset(gun),false); assert.deepEqual(gun,before);
    gun.children.stock=createItem('ak_stock');
    assert.equal(usesAKMNAsset(gun),false);
    assert.equal(usesAKMNAsset(createWeapon('weapon_ak74m')),false);
});
test('AKM authoritative muzzle uses the shared Field Kit placement', () => {
    const point=muzzlePoint(createWeapon('weapon_akm'),[0,0,0],0,0,false);
    const muzzle=weaponLayout('akm').muzzle;
    assert.ok(Math.abs(point[1]-(-.28+muzzle[1]))<1e-8);
    assert.ok(Math.abs(point[2]-(-.69+muzzle[2]))<1e-8);
});
test('Glock uses a closer first-person presentation without changing its mesh', () => {
    assert.deepEqual(viewWeaponOffset(createWeapon('weapon_glock17')),[.25,-.28,-.55]);
    assert.deepEqual(viewWeaponOffset(createWeapon('weapon_akm')),[.25,-.28,-.69]);
});
