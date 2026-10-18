import test from 'node:test';
import assert from 'node:assert/strict';
import { assetInstanceMatrix, validateModelAssetFrame } from '../dist/src/rendering/asset-frame.js';
import { model, multiply, transform } from '../dist/src/rendering/math.js';
import { MODEL_ASSETS, MODULE_MODEL_ASSETS } from '../dist/src/content/model-assets.js';
import { createItem, createWeapon } from '../dist/src/domain/items.js';
import { lootModel, weaponModel } from '../dist/src/rendering/models.js';
import { pickGeometry } from '../dist/src/rendering/picking.js';
import { weaponLayout } from '../dist/src/content/weapon-layouts.js';
import { weaponMotion } from '../dist/src/rendering/weapon-animation.js';

const near = (a, b) => { assert.equal(a.length, b.length); for (let i = 0; i < a.length; i++) assert(Math.abs(a[i] - b[i]) < 1e-6, `component ${i}: ${a[i]} vs ${b[i]}`); };
const part = () => ({ shape: 'box', p: [8, 9, 10], s: [.09, .115, .34], r: [.4, .7, .1], c: [.5, .5, .5], asset: { weapon: 'probe', group: 'body', first: true, transform: { p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0] } } });

test('legacy assets retain their exact primitive matrix; metre assets retain authored proportions', () => {
 const p = part(), parent = model([1, 2, 3], [1, 1, 1], [0, .2, 0]);
 near(assetInstanceMatrix(p, parent, { groups: ['body'], url: 'probe' }), multiply(parent, model(p.p, p.s, p.r)));
 const definition = { groups: ['body'], url: 'probe', frame: 'meters' };
 near(assetInstanceMatrix(p, parent, definition), parent);
 const changed = { ...p, p: [-99, 8, 5], s: [9, 2, 14], r: [1, 2, 3] };
 near(assetInstanceMatrix(changed, parent, definition), parent);
 near(transform(assetInstanceMatrix(p, parent, definition), [0, 0, -.8]), transform(parent, [0, 0, -.8]));
});

test('independent module GLBs preserve the protected body and centre standalone loot at the module origin', () => {
 const gun = createWeapon('weapon_ak74m', false), id = gun.children.magazine.def;
 const before = weaponModel(gun), previous = MODULE_MODEL_ASSETS[id];
 const base = parts => parts.filter(p => !p.slot || p.slot === 'action');
 try {
  MODEL_ASSETS.probe_modules = { url: 'probe', groups: ['module'], frame: 'meters' };
  MODULE_MODEL_ASSETS[id] = { asset: 'probe_modules', group: 'module' };
  const after = weaponModel(gun), magazine = after.filter(p => p.slot === 'magazine');
  assert.deepEqual(base(after), base(before));
  assert(magazine.every(p => p.asset?.weapon === 'probe_modules'));
  assert.equal(magazine.filter(p => p.asset?.first).length, 1);
  const isolated = lootModel(createItem(id)).find(p => p.asset?.first);
  assert.equal(isolated.asset.weapon, 'probe_modules');
  near([isolated.asset.transform.p[0], isolated.asset.transform.p[2]], [0, 0]);
  near(isolated.asset.transform.s, [1, 1, 1]);
  const dropped = lootModel(gun).find(p => p.slot === 'magazine' && p.asset?.first);
  near(dropped.asset.transform.s, [.8, .8, .8]);
  assert(Math.abs(dropped.asset.transform.p[2] - weaponLayout('ak').anchors.magazine[2] * .8) < 1e-6);
 } finally { delete MODEL_ASSETS.probe_modules; if (previous) MODULE_MODEL_ASSETS[id] = previous; else delete MODULE_MODEL_ASSETS[id]; }
});

test('invisible asset carriers cannot intercept legacy geometry picking', () => {
 const carrier = { ...part(), p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], slot: 'action', assetOnly: true };
 const visible = { ...part(), p: [0, 0, -1], s: [.2, .2, .2], r: [0, 0, 0], slot: 'magazine', asset: undefined };
 assert.equal(pickGeometry([carrier, visible], [0, 0, 3], [0, 0, 0], 43, 1, 0, 0), 'magazine');
});

test('explicit art corrections compose in socket space, and invalid frames fail visibly', () => {
 const p = part();p.asset.transform = { p: [.1, .2, .3], s: [1, 1, 1], r: [0, Math.PI / 2, 0] };
 const offset = { p: [0, 0, -.05], s: [1, 1, 1], r: [0, 0, 0] };
 const definition = { groups: ['body'], url: 'probe', frame: 'meters', groupTransforms: { body: offset } };
 validateModelAssetFrame(definition);
 near(assetInstanceMatrix(p, model(), definition), multiply(model(p.asset.transform.p, p.asset.transform.s, p.asset.transform.r), model(offset.p, offset.s, offset.r)));
 assert.throws(() => validateModelAssetFrame({ ...definition, frame: 'centimeters' }), /coordinate frame/);
 assert.throws(() => validateModelAssetFrame({ ...definition, frame: undefined }), /require/);
 assert.throws(() => validateModelAssetFrame({ ...definition, groupTransforms: { unknown: offset } }), /group transform/);
 assert.throws(() => assetInstanceMatrix({ ...p, asset: { ...p.asset, transform: undefined } }, model(), definition), /socket transform/);
 p.asset.transform.s = [1, 0, 1];
 assert.throws(() => assetInstanceMatrix(p, model(), definition), /socket transform/);
});

test('metre weapon groups follow authoritative layout and animation without mutating the item', () => {
 const id = 'weapon_hk416a5', old = MODEL_ASSETS[id];
 const gun = createWeapon(id, false), original = structuredClone(gun);
 const groups = ['body', 'action', ...Object.entries(gun.children).map(([path, item]) => path + '__' + item.def)];
 try {
  MODEL_ASSETS[id] = { url: 'probe', groups, frame: 'meters' };
  const pose = { reload: .5, mode: 'swap', empty: true }, motion = weaponMotion(gun, pose);
  const parts = weaponModel(gun, '', 0, pose), layout = weaponLayout('hk416');
  const first = slot => parts.find(p => p.asset?.first && (p.slot || 'body') === slot);
  near(first('body').asset.transform.p, [0, 0, 0]);
  near(first('body').asset.transform.s, [1, 1, 1]);
  near(first('action').asset.transform.p, [0, 0, motion.bolt]);
  assert.equal(first('action').assetOnly, true, 'absent legacy action gets an invisible carrier, never a visible replacement cube');
  near(first('handguard').asset.transform.p, layout.anchors.handguard);
  near(first('magazine').asset.transform.p, layout.anchors.magazine.map((v, k) => v + motion.magazine[k]));
  near(first('magazine').asset.transform.r, [motion.magazineAngle, 0, 0]);
  assert.equal(parts.filter(p => p.asset?.first).length, new Set(parts.map(p => p.asset?.group).filter(Boolean)).size);
  assert.deepEqual(gun, original);
 } finally { if (old) MODEL_ASSETS[id] = old; else delete MODEL_ASSETS[id]; }
});
