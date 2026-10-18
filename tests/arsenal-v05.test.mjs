import test from 'node:test';
import assert from 'node:assert/strict';
import { ARSENAL_WEAPONS, ARSENAL_MODULES, ARSENAL_AMMO } from '../dist/src/content/arsenal-expansion.js';
import { CATALOG } from '../dist/src/content/catalog.js';
import { WORKSHOP_PRESETS } from '../dist/src/content/presets.js';
import { weaponLayout, weaponSightHeight } from '../dist/src/content/weapon-layouts.js';
import * as I from '../dist/src/domain/items.js';
import * as A from '../dist/src/domain/ammunition.js';
import * as P from '../dist/src/domain/profile.js';
import { muzzlePoint } from '../dist/src/domain/weapon-pose.js';
import { ANIMATIONS, weaponMotion, muzzleFlashModel } from '../dist/src/rendering/weapon-animation.js';
import { arsenalWeaponBase } from '../dist/src/rendering/arsenal-models.js';
import { weaponModel } from '../dist/src/rendering/models.js';
import { weaponSound } from '../dist/src/audio/weapon-sound.js';

const character = { name: 'Арсенал 05', faction: 'BEAR', face: 0, outfit: 0 };
const fresh = () => { const p = P.newProfile(character); p.cash = 500000; p.stash = []; return p; };
const geometrySignature = parts => JSON.stringify(parts.map(({ shape, p, s, r }) => ({ shape, p, s, r })));

for (const d of ARSENAL_WEAPONS) test('new platform is normally purchasable complete and empty: ' + d.id, () => {
    const before = fresh(), after = P.buy(before, d.id, 1, 'purchase-new-platform');
    assert(after.cash < before.cash);
    assert.equal(before.stash.length, 0, 'purchase must not mutate the old snapshot');
    const gun = after.stash[0];
    assert.equal(gun.def, d.id);
    assert.deepEqual(I.validateBuild(gun), []);
    assert.equal(A.loadedRounds(gun), 0);
    assert.equal(gun.chamber, 0);
    assert.equal(new Set(I.walk(gun).map(n => n.item.id)).size, I.walk(gun).length);
    const loaded = I.createWeapon(d.id);
    const rounds = I.calculateStats(loaded).capacity;
    for (let i = 0; i < rounds; i++) assert(A.discharge(loaded), d.id + ' must feed every round exactly once');
    assert.equal(A.loadedRounds(loaded), 0);
    assert(!A.discharge(loaded));
    assert.equal(loaded.rounds, 0, 'an emptied weapon must not hide a second ammunition counter');
    I.validateItem(loaded);
});

test('16 authored new receiver silhouettes and explicit animation profiles exist, without color-only copies', () => {
    assert.equal(ARSENAL_WEAPONS.length, 16);
    assert.equal(ARSENAL_MODULES.length, 94);
    const bodies = ARSENAL_WEAPONS.map(d => {
        const parts = arsenalWeaponBase(d.shape);
        assert(parts && parts.length > 8, d.id);
        assert(ANIMATIONS[d.id], d.id + ' must not use fallback animation');
        assert(parts.some(p => p.slot === 'action'), d.id + ' must have an animated action');
        for (const part of parts) {
            assert([...part.p, ...part.s, ...part.r, ...part.c].every(Number.isFinite), d.id);
            assert(part.s.every(v => v > 0), d.id);
        }
        return geometrySignature(parts);
    });
    assert.equal(new Set(bodies).size, bodies.length);
});

test('new platforms accept only the correct magazine families even at the same calibre', () => {
    const cases = [
        ['weapon_ak12', 'ak545_45', 'ak762_30'], ['weapon_rpk74m', 'ak545_window_30', 'ar556_30'],
        ['weapon_vss', 'val_20', 'vityaz_30'], ['weapon_asval', 'val_10', 'glock_17'],
        ['weapon_g36k', 'g36_30', 'ar556_30'], ['weapon_auga3', 'aug_30', 'g36_30'],
        ['weapon_scarl', 'ar556_20', 'aug_30'], ['weapon_mcxspearlt', 'ar556_30', 'ak762_30'],
        ['weapon_bren2', 'ar556_60', 'g36_30'], ['weapon_scorpion', 'scorpion_20', 'mpx_20'],
        ['weapon_mpx', 'mpx_30', 'mp5_30'], ['weapon_m9a3', 'm9_20', 'm17_21'],
        ['weapon_m17', 'm17_21', 'glock_17'], ['weapon_m14', 'm14_10', 'svd_10']
    ];
    for (const [weapon, accepted, rejected] of cases) {
        const gun = I.createWeapon(weapon, false), bad = I.createItem(rejected); bad.rounds = 1;
        assert(A.compatibleMagazine(gun, I.createItem(accepted)), weapon + '/' + accepted);
        assert(!A.compatibleMagazine(gun, bad), weapon + '/' + rejected);
        assert(I.validateBuild(I.replacePreview(gun, 'magazine', rejected)).length > 0);
        assert.throws(() => A.proposeMagazineSwap({ ...P.emptyGear(), bag: [bad] }, gun, bad.id));
    }
    for (const id of ['weapon_rem870', 'weapon_benellim4']) assert(!A.detachable(I.createWeapon(id)));
});

for (const [gunId, ammoId, wrongId] of [['weapon_vss', 'ammo_9x39', 'ammo_9x19'], ['weapon_m14', 'ammo_7.62x51', 'ammo_7.62x54R']]) {
    test('new calibre packing and unpacking conserve rounds and reject similar names: ' + ammoId, () => {
        let p = fresh(); p.gear = P.emptyGear(); p.gear.primary = I.createWeapon(gunId, false);
        p.stash = [I.createItem(wrongId, 30)];
        const before = structuredClone(p);
        assert.throws(() => P.prepareMagazine(p, p.gear.primary.id));
        assert.deepEqual(p, before);
        p.stash.push(I.createItem(ammoId, 30));
        const id = p.gear.primary.children.magazine.id, capacity = I.calculateStats(p.gear.primary).capacity;
        p = P.prepareMagazine(p, p.gear.primary.id, false, 'load-new-calibre');
        assert.equal(p.gear.primary.children.magazine.id, id);
        assert.equal(p.gear.primary.children.magazine.rounds, capacity);
        assert.equal(p.gear.primary.chamber, 0);
        assert.equal(p.stash.filter(i => i.def === ammoId).reduce((sum, i) => sum + i.qty, 0), 30 - capacity);
        p = P.prepareMagazine(p, p.gear.primary.id, true, 'unload-new-calibre');
        assert.equal(p.gear.primary.children.magazine.rounds, 0);
        assert.equal(p.stash.filter(i => i.def === ammoId).reduce((sum, i) => sum + i.qty, 0), 30);
        assert.equal(p.stash.find(i => i.def === wrongId).qty, 30);
        P.validateProfile(p);
    });
}

test('new ammo remains distinct in registry, total mass and sale value', () => {
    assert.deepEqual(ARSENAL_AMMO.map(a => a.ammo), ['9x39', '7.62x51']);
    for (const ammo of ARSENAL_AMMO) {
        assert.equal(CATALOG[ammo.id].ammo, ammo.ammo);
        const rounds = I.createItem(ammo.id, 30);
        assert.equal(I.weight([rounds]), 30 * ammo.weight);
        assert.equal(I.value(rounds), 30 * ammo.price);
    }
});

test('AUG rear magazine position and bullpup reload differ from front-magazine rifles', () => {
    const aug = I.createWeapon('weapon_auga3'), rifle = I.createWeapon('weapon_m4a1');
    const layout = weaponLayout(CATALOG[aug.def].shape);
    assert(layout.anchors.magazine[2] > layout.anchors.pistolgrip[2]);
    const idle = weaponMotion(aug), reload = weaponMotion(aug, { reload: .5, mode: 'swap' });
    assert(reload.left[2] > idle.left[2] + .20, 'support hand must reach the magazine behind the trigger');
    assert(reload.magazine[1] < -.15);
    assert(reload.magazine[2] > weaponMotion(rifle, { reload: .5, mode: 'swap' }).magazine[2]);
    const idleParts = weaponModel(aug).filter(p => p.slot === 'magazine');
    const movingParts = weaponModel(aug, '', 0, { reload: .5, mode: 'swap' }).filter(p => p.slot === 'magazine');
    assert.notEqual(geometrySignature(idleParts), geometrySignature(movingParts));
});

test('870 cycles its actual fore-end while Benelli fore-end stays fixed', () => {
    const pump = I.createWeapon('weapon_rem870'), auto = I.createWeapon('weapon_benellim4');
    const pose = { shotAge: ANIMATIONS[pump.def].cycle / 2 };
    const idle = weaponModel(pump).filter(p => p.slot === 'handguard');
    const cycling = weaponModel(pump, '', 0, pose).filter(p => p.slot === 'handguard');
    assert(weaponMotion(pump, pose).pump > .10);
    assert(cycling[0].p[2] > idle[0].p[2] + .10);
    assert.equal(weaponMotion(auto, { shotAge: .08 }).pump, 0);
    assert.equal(geometrySignature(weaponModel(auto).filter(p => p.slot === 'handguard')), geometrySignature(weaponModel(auto, '', 0, { shotAge: .08 }).filter(p => p.slot === 'handguard')));
});

test('pistol red dot requires its adapter and renders the installed optic', () => {
    const gun = I.replacePreview(I.replacePreview(I.createWeapon('weapon_m17'), 'mount', 'm17_mount'), 'mount.optic', 'pistol_dot');
    assert.deepEqual(I.validateBuild(gun), []);
    assert(I.validateBuild(I.replacePreview(gun, 'mount.optic', 'scope6')).length > 0);
    const layout = weaponLayout('m17'), height = weaponSightHeight(layout, true, true);
    const point = muzzlePoint(gun, [0, 1.58, 0], 0, 0, true);
    assert(Math.abs(point[1] - (1.58 - height + layout.muzzle[1])) < 1e-9);
    const dot = weaponModel(gun).filter(p => p.slot === 'mount.optic');
    assert(dot.length > 0);
    assert(dot.every(part => part.asset?.group === 'optic__pistol_dot' && part.asset?.weapon === 'overhaul_module_pistol_dot'));
    assert.equal(weaponModel(I.replacePreview(gun, 'mount', null)).filter(part => part.slot === 'mount.optic').length, 0);
    assert(weaponSightHeight(weaponLayout('g36'), true) > weaponSightHeight(weaponLayout('ar'), true));
});

test('integrally suppressed weapons keep a visible muzzle and nonzero sound', () => {
    for (const id of ['weapon_asval', 'weapon_vss']) {
        const gun = I.createWeapon(id), stats = I.calculateStats(gun);
        assert(stats.noise > 0 && stats.noise < .6);
        assert(weaponSound(id, true).gain > 0);
        assert(muzzleFlashModel(gun, 0, true).length > 0);
        assert.equal(muzzleFlashModel(gun, .1, true).length, 0);
    }
    assert.deepEqual(weaponSound('weapon_m17'), weaponSound('weapon_glock17'));
    assert.deepEqual(weaponSound('weapon_m9a3'), weaponSound('weapon_pm'));
    assert.deepEqual(weaponSound('weapon_m14'), weaponSound('weapon_svd'));
});

test('twelve new workshop presets remain valid and can be purchased without changing gun identity', () => {
    const ids = new Set(ARSENAL_WEAPONS.map(w => w.id));
    const presets = WORKSHOP_PRESETS.filter(p => ids.has(p.tree.def));
    assert.equal(presets.length, 12);
    for (const example of presets) {
        const p = fresh(); p.gear.primary = I.createWeapon(example.tree.def);
        const before = structuredClone(p), id = p.gear.primary.id;
        const quote = P.quoteBuild(p, p.gear.primary, example.tree);
        assert.deepEqual(p, before);
        assert.deepEqual(I.validateBuild(quote.result), [], example.id);
        const after = P.applyBuild(p, id, example.tree, 'new-preset-' + example.id);
        assert.equal(after.gear.primary.id, id);
        assert.deepEqual(I.validateBuild(after.gear.primary), []);
        assert.equal(P.applyBuild(after, id, example.tree, 'new-preset-' + example.id), after);
    }
});
