import test from 'node:test';
import assert from 'node:assert/strict';
import { APPEARANCE_PRESETS, normalizeAppearance } from '../dist/src/content/apparel.js';
import { EQUIPMENT_DEFS } from '../dist/src/content/equipment.js';
import { CATALOG } from '../dist/src/content/catalog.js';
import { MAPS } from '../dist/src/content/maps.js';
import { newProfile, saveAppearance, validateProfile, moveItem, prepareRaid, activateRaid, applyResult } from '../dist/src/domain/profile.js';
import { createItem } from '../dist/src/domain/items.js';
import { armorAbsorption, equipmentSlot } from '../dist/src/domain/equipment.js';
import { migrateProfile } from '../dist/src/domain/migration.js';
import { World } from '../dist/src/simulation/world.js';
import { wardrobeView, wardrobeEquipment } from '../dist/src/ui/wardrobe.js';
import { handsModel } from '../dist/src/rendering/weapon-animation.js';
import { createWeapon } from '../dist/src/domain/items.js';

const character = { name: 'Проверка Гардероба', faction: 'BEAR', face: 2, outfit: 0 };
const fresh = () => newProfile(character);
const appearance = () => structuredClone(APPEARANCE_PRESETS.find(p => p.id === 'factory_pelmeni').appearance);

test('wardrobe save is free and preserves profile, inventory, quests and progress', () => {
    const p = fresh(); p.quests.quest_01 = { accepted: true, progress: 0, claimed: false };
    const before = structuredClone(p);
    const next = saveAppearance(p, { ...p.character, appearance: appearance(), face: 7, faction: 'USEC', name: 'Ignored Identity' }, 'wardrobe-save');
    assert.equal(next.id, p.id); assert.equal(next.cash, p.cash); assert.equal(next.character.name, p.character.name); assert.equal(next.character.faction, p.character.faction);
    assert.deepEqual(next.stash, p.stash); assert.deepEqual(next.gear, p.gear); assert.deepEqual(next.quests, p.quests); assert.deepEqual(next.stats, p.stats);
    assert.equal(next.character.face, 7); assert.equal(next.character.appearance.rig, 'rig_buyanov'); assert.equal(next.revision, p.revision + 1);
    assert.deepEqual(p, before); validateProfile(next);
    assert.equal(saveAppearance(next, p.character, 'wardrobe-save'), next, 'same transaction cannot apply again');
});

test('schema 3 profiles without apparel remain loadable without mutation or free items', () => {
    const old = fresh(); delete old.character.appearance;
    const before = JSON.stringify(old), restored = migrateProfile(old);
    assert.equal(restored.changed, false); assert.equal(JSON.stringify(restored.profile), before);
    const next = saveAppearance(restored.profile, { ...old.character, appearance: normalizeAppearance(undefined, old.character.faction, old.character.outfit) });
    assert.equal(next.schema, 3); assert.deepEqual(next.gear, old.gear); assert.equal(next.cash, old.cash);
});

test('opening a legacy wardrobe allows immediate save and face-only edits', async () => {
    const { Game } = await import('../dist/src/main.js');
    for (const faction of ['BEAR', 'USEC']) {
        const p = newProfile({ ...character, faction }); delete p.character.appearance;
        const original = structuredClone(p), game = Object.create(Game.prototype);
        Object.assign(game, { profile: p, page: 'main', session: null, controls: { unlock() {} }, renderer: {}, store: { async patches() { return []; } }, patchUrls: {}, render() {} });
        await game.navigate('wardrobe');
        assert.deepEqual(game.character.appearance, normalizeAppearance(undefined, faction, p.character.outfit));
        const saved = saveAppearance(p, game.character);
        assert.deepEqual(saved.gear, p.gear); assert.equal(saved.cash, p.cash);
        game.character.face = 3;
        const faceOnly = saveAppearance(saved, game.character);
        assert.equal(faceOnly.character.face, 3); assert.deepEqual(faceOnly.character.appearance, saved.character.appearance);
        assert.deepEqual(p, original, 'entering wardrobe must not mutate the persisted legacy profile');
    }
});

test('invalid apparel cannot enter saves and pending raid locks wardrobe writes', () => {
    const p = fresh();
    assert.throws(() => saveAppearance(p, { ...p.character, appearance: { ...appearance(), jacket: '<script>' } }));
    assert.throws(() => validateProfile({ ...p, character: { ...p.character, appearance: { ...appearance(), rig: 'unknown' } } }));
    assert.throws(() => saveAppearance(prepareRaid(p, 'locked-wardrobe', 'factory'), { ...p.character, appearance: appearance() }));
    assert.throws(() => saveAppearance(p, { ...p.character, appearance: appearance(), face: 120 }));
});

test('appearance survives serialize, raid spawn, shared snapshot and death result', () => {
    let p = saveAppearance(fresh(), { ...character, appearance: appearance() });
    p = JSON.parse(JSON.stringify(p)); validateProfile(p);
    const world = new World(MAPS.range, 'clothes-in-raid', false, 7, true);
    const actor = world.addPlayer(p.id, p.character, p.gear);
    assert.deepEqual(actor.character.appearance, appearance());
    const snapshot = JSON.parse(JSON.stringify(world.snapshot()));
    assert.equal(snapshot.players[0].character.appearance.rig, 'rig_buyanov');
    let active = activateRaid(prepareRaid(p, 'clothes-result', 'factory'));
    active = applyResult(active, { id: 'wardrobe-death', raidId: 'clothes-result', playerId: p.id, map: 'factory', outcome: 'dead', seconds: 5, kills: 0, gear: structuredClone(p.gear), visited: [] });
    assert.deepEqual(active.character.appearance, appearance()); assert.equal(active.gear.armor, null);
});

for (const d of EQUIPMENT_DEFS) test('named equipment fits the correct slot and survives escrow: ' + d.id, () => {
    const p = fresh(), item = createItem(d.id); p.stash.push(item);
    const slot = equipmentSlot(d), next = moveItem(p, item.id, slot);
    assert.equal(next.gear[slot].id, item.id); validateProfile(next);
    assert.throws(() => moveItem(p, item.id, slot === 'armor' ? 'helmet' : 'armor'));
    const prepared = prepareRaid(next, 'equip-' + d.id, 'factory');
    assert.equal(prepared.pending.gear[slot].id, item.id);
    const returned = applyResult(prepared, { id: 'return-' + d.id, raidId: prepared.pending.raidId, playerId: p.id, map: 'factory', outcome: 'technical', seconds: 0, kills: 0, gear: prepared.pending.gear, visited: [] });
    assert.equal(returned.gear[slot].id, item.id);
});

test('actual damage scales continuously with armor condition and a cosmetic bag never adds protection', () => {
    const damage = (condition, cosmetic) => {
        const p = fresh(); if (cosmetic) p.character.appearance = appearance();
        p.gear.armor = createItem('armor_6b45'); p.gear.armor.condition = condition;
        const w = new World(MAPS.range, 'armor-damage-' + condition, false, 5, true), a = w.addPlayer(p.id, p.character, p.gear);
        w.damagePlayer(a, 30, false); return 100 - a.hp;
    };
    assert(damage(100, false) < damage(50, false)); assert(damage(50, false) < damage(0, false));
    assert.equal(damage(100, false), damage(100, true));
    const legacy = createItem('armor_light'); assert.equal(armorAbsorption(legacy), .44); legacy.condition = 50; assert.equal(armorAbsorption(legacy), .22);
    assert.equal(armorAbsorption(createItem('ammo_9x18')), 0);
});

test('weapon and gear cache categories create playable items instead of household fallback', () => {
    for (const category of ['weapon', 'module', 'armor']) {
        const m = { ...MAPS.range, loot: [{ id: 'crate', name: 'Контроль', p: [0, .8, 0], category, loose: true }], bots: [] };
        const w = new World(m, 'category-' + category, false, 17);
        assert.equal(CATALOG[w.containers[0].items[0].def].category, category);
        if (category === 'weapon') assert(Object.keys(w.containers[0].items[0].children).length > 0, 'cache gun must include its required parts');
    }
});

test('wardrobe UI distinguishes free cosmetics, equipped protection, creation and saving', () => {
    const p = fresh(), base = { page: 'wardrobe', profile: p, character: { ...p.character, appearance: appearance() }, saving: false, wardrobePose: 'crouch' };
    const html = wardrobeView(base);
    assert.match(html, /data-act="save-appearance"/); assert.doesNotMatch(html, /data-act="create-character"/);
    assert.match(html, /data-appearance="trouserCamo"/); assert.match(html, /data-appearance="jacketCamo"/);
    assert.match(html, /ПЕЛЬМЕНИ/); assert.match(html, /Собственной бронезащиты/); assert.match(html, /data-act="wardrobe-pose" data-id="crouch"/);
    const creation = wardrobeView({ ...base, page: 'character', profile: null, character: { ...base.character, name: '<img onerror=x>' } });
    assert.match(creation, /data-act="create-character"/); assert.match(creation, /&lt;img onerror=x&gt;/); assert.doesNotMatch(creation, /<img/);
});

test('new-character preview uses starter protection while wardrobe keeps actual equipped items', () => {
    const p = fresh(); p.gear.armor = createItem('armor_6b45'); p.gear.helmet = createItem('helmet_fast');
    const previous = structuredClone(p);
    const creationGear = wardrobeEquipment('character', p.gear);
    assert.equal(creationGear.armor.def, fresh().gear.armor.def); assert.equal(creationGear.helmet, null);
    assert.equal(wardrobeEquipment('wardrobe', p.gear), p.gear);
    const creation = wardrobeView({ page: 'character', profile: p, character: p.character, saving: false });
    assert(creation.includes(CATALOG.armor_light.name)); assert(!creation.includes(CATALOG.armor_6b45.name)); assert(!creation.includes(CATALOG.helmet_fast.name));
    const wardrobe = wardrobeView({ page: 'wardrobe', profile: p, character: p.character, saving: false });
    assert(wardrobe.includes(CATALOG.armor_6b45.name)); assert(wardrobe.includes(CATALOG.helmet_fast.name));
    assert.deepEqual(p, previous);
});

test('first-person selected camouflage and gloves move with reload geometry', () => {
    const gun = createWeapon('weapon_ak74m'), a = appearance(); a.jacketCamo = 'emr';
    const standing = handsModel(gun, {}, 0, 2, a), reload = handsModel(gun, { reload: .55, mode: 'swap' }, 0, 2, a);
    assert(standing.length > 35); assert.equal(standing.length, reload.length);
    assert.notDeepEqual(standing.map(p => p.p), reload.map(p => p.p));
    assert.deepEqual(standing.map(p => p.c), reload.map(p => p.c));
    const bare = handsModel(gun, {}, 0, 2, { ...a, gloves: 'gloves_none' });
    assert.notDeepEqual(bare.map(p => p.c), standing.map(p => p.c));
    for (const p of reload) assert([...p.p, ...p.s, ...p.r, ...p.c].every(Number.isFinite));
});

test('catalog range lends a real complete weapon without charging or persisting it', async t => {
    const { Game } = await import('../dist/src/main.js');
    const savedMatchMedia = globalThis.matchMedia, savedFrame = globalThis.requestAnimationFrame;
    globalThis.matchMedia = () => ({ matches: false });
    globalThis.requestAnimationFrame = fn => { fn(0); return 1; };
    t.after(() => { if (savedMatchMedia === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = savedMatchMedia; if (savedFrame === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = savedFrame; });
    const game = Object.create(Game.prototype);
    Object.assign(game, { profile: fresh(), launchBusy: false, session: null, solo: null, original: null,
        controls: { clear() {}, unlock() {} }, renderer: { setMap() {} }, audio: { reset() {} }, render() {},
        receiveSnapshot(s) { this.snapshot = s; }, async navigate(page) { this.page = page; } });
    const before = structuredClone(game.profile);
    await game.startSolo('range', 'weapon_auga3');
    assert.equal(game.solo.range, true);
    const actor = game.solo.players.get(game.profile.id);
    assert.equal(actor.gear.primary.def, 'weapon_auga3'); assert(Object.keys(actor.gear.primary.children).length > 3);
    actor.gear.primary.condition = 2; actor.gear.bag.length = 0;
    await game.leaveRange();
    assert.equal(game.page, 'traders'); assert.deepEqual(game.profile, before); assert.equal(game.solo, null);
    await assert.rejects(game.startSolo('factory', 'weapon_auga3'), /Оружие для испытания/);
    await assert.rejects(game.startSolo('range', 'ammo_9x18'), /Оружие для испытания/);
});
