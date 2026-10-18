import test from 'node:test';
import assert from 'node:assert/strict';
import { APPEARANCE_FIELDS, APPEARANCE_OPTIONS, APPEARANCE_PRESETS, BACKPACKS, BOOTS, CAMOUFLAGES, GLOVES, HEADWEAR, JACKETS, RIGS, TROUSERS, appearancePalette, defaultAppearance, isAppearance, normalizeAppearance } from '../dist/src/content/apparel.js';
import { CATALOG, WEAPONS } from '../dist/src/content/catalog.js';
import { createItem, createWeapon } from '../dist/src/domain/items.js';
import { characterAppearanceModel, characterJointPose, equipmentAppearanceModel, pelmeniLettering } from '../dist/src/rendering/apparel.js';
import { heldWeaponMatrix, normalizedWeaponPose } from '../dist/src/rendering/held-weapon.js';
import { characterModel } from '../dist/src/rendering/models.js';
import { weaponMotion } from '../dist/src/rendering/weapon-animation.js';
import { lookAt, model, transform } from '../dist/src/rendering/math.js';

const character = (appearance = defaultAppearance()) => ({ name: 'Проверка одежды', faction: 'BEAR', face: 0, outfit: 0, appearance });
const validGeometry = parts => {
    assert(parts.length > 0);
    for (const p of parts) {
        assert([...p.p, ...p.r, ...p.s, ...p.c].every(Number.isFinite), p.slot);
        assert(p.s.every(n => n > 0 && n < 2), p.slot);
        assert(p.c.every(n => n >= 0 && n <= 1), p.slot);
    }
};
const corners = p => {
    const m = model(p.p, p.s, p.r), points = [];
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) points.push(transform(m, [x, y, z]));
    return points;
};
const empty = { armor: null, helmet: null };

test('apparel catalog separates garment cuts, colors and functional equipment', () => {
    assert(CAMOUFLAGES.length >= 12 && JACKETS.length >= 8 && TROUSERS.length >= 6);
    assert(RIGS.length + BACKPACKS.length + HEADWEAR.length >= 20);
    for (const entries of [CAMOUFLAGES, JACKETS, TROUSERS, RIGS, BACKPACKS, HEADWEAR, GLOVES, BOOTS]) {
        assert.equal(new Set(entries.map(x => x.id)).size, entries.length);
        for (const entry of entries) assert(entry.name && entry.description);
    }
    for (const entry of [...JACKETS, ...TROUSERS, ...RIGS, ...BACKPACKS, ...HEADWEAR, ...GLOVES, ...BOOTS]) {
        assert.equal(entry.free, true);
        assert.equal(entry.protection, undefined, 'wardrobe cosmetics cannot supply ballistic stats');
        assert.equal(entry.capacity, undefined, 'a free visual bag cannot change inventory capacity');
    }
    assert(!CAMOUFLAGES.some(x => /горка/i.test(x.name)), 'Gorka is a cut, not camouflage');
    assert.equal(RIGS.find(x => x.id === 'rig_buyanov').name, 'Бронежилет Буянова');
});

test('old appearance data migrates field by field and preserves independently selected clothing', () => {
    for (const faction of ['BEAR', 'USEC']) for (let outfit = 0; outfit < 12; outfit++) {
        const appearance = normalizeAppearance(undefined, faction, outfit);
        assert(isAppearance(appearance));
        assert.equal(appearance.jacketCamo, appearance.trouserCamo);
        assert.deepEqual(normalizeAppearance(appearance, faction, outfit), appearance);
    }
    const sparse = { jacket: 'removed_jacket', trousers: 'trousers_g4', jacketCamo: 'flora', trouserCamo: 'coyote', backpack: 'pack_none' };
    const migrated = normalizeAppearance(sparse);
    assert.equal(migrated.jacket, defaultAppearance().jacket);
    assert.equal(migrated.trousers, 'trousers_g4');
    assert.equal(migrated.jacketCamo, 'flora');
    assert.equal(migrated.trouserCamo, 'coyote');
    assert.equal(migrated.backpack, 'pack_none');
    assert.deepEqual(sparse, { jacket: 'removed_jacket', trousers: 'trousers_g4', jacketCamo: 'flora', trouserCamo: 'coyote', backpack: 'pack_none' });
});

test('untrusted appearance values never leak unknown IDs, executable accessors or extra fields', () => {
    for (const value of [null, false, [], 'jacket_g4', 7, NaN, Object.create({ jacket: 'jacket_g4' })]) {
        assert.equal(isAppearance(value), false);
        assert.deepEqual(normalizeAppearance(value), defaultAppearance());
    }
    let called = false;
    const accessor = { ...defaultAppearance() };
    Object.defineProperty(accessor, 'jacket', { enumerable: true, get() { called = true; throw Error('must not execute'); } });
    assert.equal(isAppearance(accessor), false);
    assert(isAppearance(normalizeAppearance(accessor)));
    assert.equal(called, false);
    assert.equal(isAppearance({ ...defaultAppearance(), armor: 'armor_6b45' }), false);
    for (const field of APPEARANCE_FIELDS) {
        assert.equal(isAppearance({ ...defaultAppearance(), [field]: '__proto__' }), false);
        assert.equal(isAppearance({ ...defaultAppearance(), [field]: {} }), false);
        assert.equal(normalizeAppearance({ [field]: '__proto__' })[field], defaultAppearance()[field]);
    }
    for (const outfit of [-100, 1e50, NaN, Infinity]) assert(isAppearance(defaultAppearance('USEC', outfit)));
});

test('every available wardrobe choice and preset survives normalization and produces finite in-bounds geometry', () => {
    for (const field of APPEARANCE_FIELDS) for (const option of APPEARANCE_OPTIONS[field]) {
        const appearance = { ...defaultAppearance(), [field]: option.id };
        assert.equal(normalizeAppearance(appearance)[field], option.id);
        assert(isAppearance(appearance));
        for (const crouch of [false, true]) {
            const parts = characterAppearanceModel(character(appearance), .2, 1, false, crouch, empty);
            validGeometry(parts);
            assert(parts.length < 700, 'bounded primitive budget: ' + field + '/' + option.id);
            for (const p of parts) assert(Math.abs(p.p[0]) < .6 && p.p[1] > -.2 && p.p[1] < 2 && Math.abs(p.p[2]) < .9, p.slot);
        }
    }
    for (const preset of APPEARANCE_PRESETS) assert(isAppearance(preset.appearance), preset.id);
});

test('camouflage has spatial detail and top/bottom selection changes only the selected fabric family', () => {
    const plain = characterAppearanceModel(character({ ...defaultAppearance(), jacketCamo: 'olive', trouserCamo: 'khaki' }));
    const patterned = characterAppearanceModel(character({ ...defaultAppearance(), jacketCamo: 'emr', trouserCamo: 'khaki' }));
    assert(patterned.filter(p => p.slot.includes(':camo:')).length > plain.filter(p => p.slot.includes(':camo:')).length + 30);
    const lower = parts => parts.filter(p => p.slot.startsWith('trousers:') || p.slot.startsWith('knee:'));
    assert.deepEqual(lower(patterned), lower(plain), 'changing jacket camouflage cannot recolor trousers');
    assert.notDeepEqual(appearancePalette(character({ ...defaultAppearance(), jacketCamo: 'emr' })).sleeve, appearancePalette(character({ ...defaultAppearance(), jacketCamo: 'wolf_gray' })).sleeve);
});

test('garment prints stay attached to animated limbs and pack/rig remain attached to crouched torso', () => {
    const c = character({ ...defaultAppearance(), jacketCamo: 'emr', trouserCamo: 'woodland', rig: 'rig_mk6', backpack: 'pack_sso_ataka' });
    const stationary = characterAppearanceModel(c, 0, 0, false, false), walking = characterAppearanceModel(c, .25, 1, false, false);
    const thigh = list => list.find(p => p.slot === 'trousers:thigh:L');
    const mark = list => list.find(p => p.slot === 'trousers:thigh:L:camo:-1:0');
    assert.notDeepEqual(thigh(stationary).p, thigh(walking).p);
    const separation = list => Math.hypot(...mark(list).p.map((n, k) => n - thigh(list).p[k]));
    assert(Math.abs(separation(stationary) - separation(walking)) < 1e-10, 'print-to-cloth distance is rigid');
    assert.deepEqual(mark(walking).r, thigh(walking).r);
    const crouched = characterAppearanceModel(c, 0, 0, false, true);
    const body = list => list.find(p => p.slot === 'jacket:body');
    for (const slot of ['pack:body', 'pack:shoulder', 'rig:panel', 'rig:strap']) {
        const s = stationary.find(p => p.slot === slot), q = crouched.find(p => p.slot === slot);
        const d1 = Math.hypot(...s.p.map((n, k) => n - body(stationary).p[k]));
        const d2 = Math.hypot(...q.p.map((n, k) => n - body(crouched).p[k]));
        assert(Math.abs(d1 - d2) < 1e-10, slot + ' detaches from torso');
        assert.deepEqual(q.r, body(crouched).r, slot);
    }
});

test('two-segment walk and crouch gait keep soles above ground and at least one stance foot planted', () => {
    for (const crouch of [false, true]) for (const movement of [0, .5, 1, 1.35]) for (let n = 0; n < 32; n++) {
        const parts = characterAppearanceModel(character(), n / 27, movement, false, crouch);
        const soles = parts.filter(p => p.slot.endsWith(':sole'));
        const heights = soles.map(p => Math.min(...corners(p).map(v => v[1])));
        assert(heights.every(h => h > -.001), JSON.stringify({ crouch, movement, n, heights }));
        assert(Math.min(...heights) < .018, 'at least one grounded foot throughout gait');
        const joints = characterJointPose(n / 27, movement, crouch);
        for (const side of ['L', 'R']) {
            const a = joints['thigh' + side].p, b = joints['shin' + side].p, f = joints['foot' + side].p;
            assert(Math.abs(Math.hypot(...a.map((v, k) => v - b[k])) - .33) < 1e-9);
            assert(Math.abs(Math.hypot(...b.map((v, k) => v - f[k])) - .31) < 1e-9);
        }
    }
});

test('all platforms keep both third-person palms on animated weapon grips with reachable articulated arms', () => {
    const c = character({ ...defaultAppearance(), jacket: 'jacket_m65' });
    const distance = (a, b) => Math.hypot(...a.map((n, k) => n - b[k]));
    for (const def of WEAPONS) {
        const gun = createWeapon(def.id);
        for (const crouch of [false, true]) for (const pitch of [-1.48, -.8, 0, .8, 1.48])
            for (const mode of ['swap', 'rounds', 'charge', 'range', 'inspect']) for (const phase of [0, .15, .3, .5, .7, .9, 1]) {
                const weaponPose = { reload: mode === 'inspect' ? 0 : phase, inspect: mode === 'inspect' ? phase : 0, mode, empty: true, shotAge: .04 };
                const presentation = { gun, weaponPose, pitch }, matrix = heldWeaponMatrix(gun, weaponPose, crouch, pitch, .19, 1);
                const motion = weaponMotion(gun, weaponPose), joints = characterJointPose(.19, 1, crouch, presentation);
                const parts = characterModel(c, .19, 1, false, crouch, empty, presentation);
                for (const [side, grip] of [['L', motion.left], ['R', motion.right]]) {
                    const target = transform(matrix, grip), hand = parts.find(p => p.slot === 'hand:' + side);
                    const shoulder = joints['upper' + side].p, elbow = joints['fore' + side].p;
                    const where = `${def.id}/${crouch}/${pitch}/${mode}/${phase}/${side}`;
                    assert(distance(hand.p, target) < 1e-6, 'palm separated from held mesh: ' + where);
                    assert(distance(shoulder, elbow) >= .2999 && distance(shoulder, elbow) < .322, 'upper-arm reach: ' + where);
                    assert(distance(elbow, hand.p) >= .3199 && distance(elbow, hand.p) < .344, 'forearm reach: ' + where);
                    // Sample the actual centerlines against the widest jacket torso in its tilted
                    // local frame. This catches a charging/support arm passing through the chest.
                    for (const [a, b] of [[shoulder, elbow], [elbow, hand.p]]) for (let n = 1; n <= 8; n++) {
                        const relative = a.map((v, k) => v + (b[k] - v) * n / 8 - joints.torso.p[k]);
                        const y = relative[1] * Math.cos(-joints.torso.x) - relative[2] * Math.sin(-joints.torso.x);
                        const z = relative[1] * Math.sin(-joints.torso.x) + relative[2] * Math.cos(-joints.torso.x);
                        assert(Math.abs(relative[0]) >= .23 || Math.abs(y) >= .2575 || Math.abs(z) >= .1475, 'arm crosses torso: ' + where);
                    }
                }
            }
    }
});

test('unarmed wardrobe uses relaxed arms and malformed held animation values remain finite', () => {
    const c = character({ ...defaultAppearance(), rig: 'rig_buyanov' });
    const relaxed = characterModel(c, .19, 1, false, false, empty);
    for (const side of ['L', 'R']) {
        const hand = relaxed.find(p => p.slot === 'hand:' + side);
        assert(hand.p[1] < .75 && Math.abs(hand.p[0]) > .30, 'empty hands must hang beside the jacket');
    }
    const gun = createWeapon('weapon_auga3');
    for (const n of [NaN, Infinity, -Infinity, 1e308, -1e308]) {
        const weaponPose = { reload: n, inspect: n, shotAge: n, mode: 'swap', empty: true };
        const matrix = heldWeaponMatrix(gun, weaponPose, true, n, n, n);
        assert([...matrix].every(Number.isFinite));
        validGeometry(characterModel(c, n, n, false, true, empty, { gun, weaponPose, pitch: n }));
        const normalized = normalizedWeaponPose(weaponPose);
        assert(normalized.reload >= 0 && normalized.reload <= 1 && normalized.inspect >= 0 && normalized.inspect <= 1);
    }
});

test('empty armor slots do not render ghost armor and actual equipment replaces soft headwear', () => {
    const c = character({ ...defaultAppearance(), headwear: 'head_boonie' });
    assert(!characterAppearanceModel(c, 0, 0, false, false, empty).some(p => p.slot.startsWith('armor:') || p.slot.startsWith('helmet:')));
    const equipped = { armor: createItem('armor_6b45'), helmet: createItem('helmet_fast') };
    const parts = characterAppearanceModel(c, 0, 0, false, false, equipped);
    assert(parts.some(p => p.slot === 'armor:front'));
    assert(parts.some(p => p.slot === 'helmet:shroud'));
    assert(!parts.some(p => p.slot.startsWith('headwear:')), 'boonie must not protrude through ballistic helmet');
    const masked = characterAppearanceModel(character({ ...c.appearance, headwear: 'head_balaclava' }), 0, 0, false, false, equipped);
    assert(masked.some(p => p.slot === 'headwear:maskjaw'));
    assert(masked.some(p => p.slot === 'helmet:dome'));
});

test('all armor and helmet definitions have matching wearable and isolated loot geometry', () => {
    const defs = Object.values(CATALOG).filter(d => d.category === 'armor');
    const silhouettes = new Set();
    assert(defs.length >= 20);
    for (const definition of defs) {
        const item = createItem(definition.id), isHelmet = definition.shape.startsWith('helmet');
        const worn = characterAppearanceModel(character(), .4, 1, false, true, { armor: isHelmet ? null : item, helmet: isHelmet ? item : null });
        assert(worn.some(p => p.slot.startsWith(isHelmet ? 'helmet:' : 'armor:')), definition.id);
        const loose = equipmentAppearanceModel(item);
        silhouettes.add(JSON.stringify(loose.map(p => [p.shape, p.p, p.s, p.r])));
        validGeometry(loose);
        assert(loose.every(p => p.slot.startsWith(isHelmet ? 'helmet:' : 'armor:')));
        assert(loose.every(p => Math.abs(p.p[1]) < .5), 'isolated mesh centered: ' + definition.id);
    }
    assert.equal(silhouettes.size, defs.length, 'equipment variants must differ in geometry, not only name/color');
    assert.deepEqual(equipmentAppearanceModel(createItem('weapon_pm')), []);
});

test('Бронежилет Буянова has readable front-facing mesh text, open handles and no armor grant', () => {
    const c = character({ ...defaultAppearance(), rig: 'rig_buyanov', jacket: 'jacket_m65' });
    const parts = characterAppearanceModel(c, 0, 0, false, false, empty);
    assert(parts.some(p => p.slot === 'rig:buyanov:bag'));
    assert.equal(parts.filter(p => p.slot === 'rig:buyanov:handle_outer').length, 2);
    assert.equal(parts.filter(p => p.slot === 'rig:buyanov:handle_inner').length, 2);
    assert(!parts.some(p => p.slot.startsWith('armor:')));
    const letters = pelmeniLettering(), frontCamera = lookAt([0, 0, -3], [0, 0, 0]);
    const first = letters.filter(p => p.slot.startsWith('pelmeni:0:'));
    const last = letters.filter(p => p.slot.startsWith('pelmeni:7:'));
    assert(Math.max(...first.map(p => transform(frontCamera, p.p)[0])) < Math.min(...last.map(p => transform(frontCamera, p.p)[0])), 'ПЕЛЬМЕНИ must not be mirrored from the front');
    assert.equal(new Set(letters.map(p => p.slot.split(':')[1])).size, 8);
    validGeometry(letters);
    validGeometry(pelmeniLettering(NaN));
    const bag = parts.find(p => p.slot === 'rig:buyanov:bag');
    assert(parts.filter(p => p.slot.startsWith('pelmeni:')).every(p => p.p[2] < bag.p[2] - bag.s[2] / 2), 'lettering must be ahead of bag surface');
});

test('cached outfits cannot be corrupted by caller mutation and malformed animation inputs stay finite', () => {
    const c = character(), expected = characterAppearanceModel(c);
    const mutated = characterAppearanceModel(c);
    mutated[0].p[1] = 99; mutated[0].s[0] = 99; mutated[0].c[0] = 99;
    assert.deepEqual(characterAppearanceModel(c), expected);
    for (const n of [NaN, Infinity, -Infinity]) validGeometry(characterAppearanceModel({ ...c, face: n }, n, n));
    assert.deepEqual(characterAppearanceModel(c, .4, 1, true, false), characterAppearanceModel(c, 4, 1, true, true));
});
