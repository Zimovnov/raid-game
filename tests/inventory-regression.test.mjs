import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../dist/src/content/catalog.js';
import * as I from '../dist/src/domain/items.js';
import * as P from '../dist/src/domain/profile.js';
import { migrateProfile } from '../dist/src/domain/migration.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../dist/src/persistence/store.js';

const fresh = (faction = 'BEAR') => P.newProfile({ name: 'Аудит Схрона', faction, face: 0, outfit: 0 });
const ids = p => [...p.stash, ...p.inbox, ...I.flatGear(p.gear)].flatMap(i => I.walk(i).map(n => n.item.id));
const result = p => ({ id: 'result-' + p.pending.raidId, raidId: p.pending.raidId, playerId: p.id, map: p.pending.map, outcome: 'extracted', seconds: 60, kills: 0, gear: structuredClone(p.pending.gear), visited: [] });

test('invalid cartridge expenditure cannot add ammunition or delete whole stacks', () => {
    for (const count of [-1, -.5, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        const gear = fresh().gear, before = structuredClone(gear);
        assert.throws(() => I.spendAmmo(gear, '5.45x39', count));
        assert.deepEqual(gear, before);
    }
    const gear = fresh().gear, before = structuredClone(gear);
    assert.equal(I.spendAmmo(gear, '5.45x39', 0), 0);
    assert.deepEqual(gear, before);
});

test('ammunition keeps its rescue restriction only when a bound source is actually consumed', () => {
    const gear = P.emptyGear(), mag = I.createItem('pm_8'), paid = I.createItem('ammo_9x18', 2), rescue = I.createItem('ammo_9x18', 3);
    rescue.bound = true; gear.bag = [paid, rescue];
    assert.equal(I.spendAmmo(gear, '9x18', 1, mag), 1);
    assert.equal(mag.bound, undefined);
    assert.equal(I.spendAmmo(gear, '9x18', 2, mag), 2);
    assert.equal(mag.bound, true);
    assert.equal(I.reserveAmmo(gear, '9x18'), 2);
    const before = structuredClone(gear);
    assert.throws(() => I.spendAmmo(gear, '9x18', 1, I.createItem('ar556_30')));
    assert.deepEqual(gear, before);
});

test('ordinary valuables and ammunition cannot hide weapons in undeclared child slots', () => {
    for (const def of ['loot_valuables_01', 'ammo_9x18']) {
        const item = I.createItem(def); item.children.hidden = I.createWeapon('weapon_pm');
        assert.throws(() => I.validateItem(item), /слот/);
        const p = fresh(); p.gear.safe = [item];
        assert.throws(() => P.validateProfile(p));
    }
    const module = I.createItem('ak_rail'); module.children.light = I.createItem('fore_vertical');
    assert.throws(() => I.validateItem(module), /слот/);
});

test('malformed instance flags, IDs and non-weapon fire modes are rejected', () => {
    for (const patch of [{ id: '' }, { bound: 'false' }, { rotated: 1 }, { found: {} }, { foundMap: 42 }, { fireMode: 'single' }]) {
        const item = Object.assign(I.createItem('loot_valuables_01'), patch);
        assert.throws(() => I.validateItem(item));
    }
});

test('an unchanged build does not dismantle unrelated assemblies in a completely full stash', () => {
    const p = fresh(), module = I.createItem('ak_rail');
    module.children.light = I.createItem('flashlight');
    module.children.grip = I.createItem('fore_vertical');
    const [w, h] = CATALOG[module.def].size;
    p.stash = [module, ...Array.from({ length: 160 - w * h }, () => I.createItem('loot_medical_01'))];
    assert(I.stashFits(p.stash));
    const before = structuredClone(p), quote = P.quoteBuild(p, p.gear.primary, I.presetOf(p.gear.primary));
    assert.equal(quote.cost, 0); assert.deepEqual(quote.consumed, []); assert.deepEqual(quote.leftovers, []);
    const out = P.applyBuild(p, p.gear.primary.id, I.presetOf(p.gear.primary));
    assert.deepEqual(out.stash, before.stash);
    assert.deepEqual(out.gear, before.gear);
    assert.equal(out.cash, before.cash);
    assert.deepEqual(p, before);
});

test('using one owned descendant keeps the rest of that stored assembly together', () => {
    const p = fresh();
    p.gear.primary = I.replacePreview(p.gear.primary, 'handguard', 'ak_rail');
    const stored = I.createItem('ak_rail');
    stored.children.light = I.createItem('flashlight');
    stored.children.grip = I.createItem('fore_vertical');
    p.stash.push(stored);
    const ownedIds = new Set(ids(p)), lightId = stored.children.light.id, grip = structuredClone(stored.children.grip);
    const tree = I.presetOf(I.replacePreview(p.gear.primary, 'handguard.light', 'flashlight'));
    const out = P.applyBuild(p, p.gear.primary.id, tree, 'use-descendant', true);
    assert.equal(out.gear.primary.children.handguard.children.light.id, lightId);
    const remainder = out.stash.find(i => i.id === stored.id);
    assert(remainder); assert.equal(remainder.children.light, undefined);
    assert.deepEqual(remainder.children.grip, grip);
    assert.equal(out.cash, p.cash);
    assert.deepEqual(new Set(ids(out)), ownedIds);
    assert.equal(ids(out).length, ownedIds.size);
    P.validateProfile(out);
});

test('removing a stored parent preserves unused children and their instance IDs', () => {
    const p = fresh(), stored = I.createItem('ak_rail');
    stored.children.light = I.createItem('flashlight');
    stored.children.grip = I.createItem('fore_vertical');
    p.stash.push(stored);
    const prior = new Set(ids(p));
    const out = P.applyBuild(p, p.gear.primary.id, I.presetOf(I.replacePreview(p.gear.primary, 'handguard', 'ak_rail')), 'take-parent', true);
    assert.equal(out.gear.primary.children.handguard.id, stored.id);
    assert(out.stash.some(i => i.id === stored.children.light.id));
    assert(out.stash.some(i => i.id === stored.children.grip.id));
    assert.deepEqual(new Set(ids(out)), prior);
    assert.equal(ids(out).length, prior.size);
});

test('a weapon waiting in the reception inbox prevents repeated emergency grants', () => {
    const p = fresh(); p.cash = 0; p.stash = []; p.gear = P.emptyGear(); p.inbox = [I.createWeapon('weapon_pm')];
    const before = structuredClone(p);
    assert.throws(() => P.emergencyKit(p), /Помощь/);
    assert.deepEqual(p, before);
});

test('a malformed inventory destination cannot silently remove an item', () => {
    const p = fresh(), before = structuredClone(p);
    assert.throws(() => P.moveItem(p, p.stash[0].id, 'typo-slot'), /слот/);
    assert.deepEqual(p, before);
});

test('raid entry reserves inbox capacity before gear is locked in escrow', () => {
    const p = fresh(); p.inbox = Array.from({ length: 965 }, () => I.createItem('loot_medical_01'));
    const before = structuredClone(p);
    assert.throws(() => P.prepareRaid(p, 'inbox-full', 'factory'), /приёмного/);
    assert.deepEqual(p, before);
    p.inbox.pop();
    assert.equal(P.prepareRaid(p, 'inbox-room', 'factory').pending.raidId, 'inbox-room');
});

test('new characters receive one usable splint without changing the ammunition budget', () => {
    for (const faction of ['BEAR', 'USEC']) {
        const p = fresh(faction); P.validateProfile(p);
        assert.equal(p.gear.bag.filter(i => i.def === 'loot_medical_19').length, 1);
        assert(I.bagFits(p.gear.bag));
        assert.equal(I.reserveAmmo(p.gear, CATALOG[p.gear.primary.def].ammo), 30);
    }
});

test('new splint shortcut preserves old custom controls and avoids a key already in use', () => {
    const bindings = { ...DEFAULT_SETTINGS.bindings }; delete bindings.splint;
    bindings.forward = 'KeyQ';
    let settings = normalizeSettings({ bindings });
    assert.equal(settings.bindings.forward, 'KeyQ');
    assert.equal(settings.bindings.food, 'Digit6');
    assert.equal(settings.bindings.splint, 'Digit7');
    bindings.food = 'Digit7';
    settings = normalizeSettings({ bindings });
    assert.equal(settings.bindings.forward, 'KeyQ');
    assert.equal(settings.bindings.food, 'Digit7');
    assert.equal(settings.bindings.splint, 'Digit8');
    assert.equal(new Set(Object.values(settings.bindings)).size, Object.keys(settings.bindings).length);
});

test('migration rejects ambiguous schema or revision types without modifying the input', () => {
    for (const patch of [{ schema: '3' }, { schema: '2' }, { revision: '0' }, { revision: -1 }, { revision: Infinity }]) {
        const raw = Object.assign(fresh(), patch), before = structuredClone(raw);
        assert.throws(() => migrateProfile(raw)); assert.deepEqual(raw, before);
    }
});

test('raid results cannot change the map or introduce malformed quest evidence', () => {
    const p = P.prepareRaid(fresh(), 'result-validation', 'factory'), before = structuredClone(p);
    for (const patch of [{ map: 'city' }, { id: '' }, { seconds: NaN }, { kills: -1 }, { visited: [null] }, { visited: [42] }, { cause: {} }]) {
        assert.throws(() => P.applyResult(p, { ...result(p), ...patch }));
        assert.deepEqual(p, before);
    }
});

test('corrupt pending state cannot leave equipment simultaneously inside and outside raid escrow', () => {
    const p = P.prepareRaid(fresh(), 'escrow-validation', 'factory');
    p.gear.secondary = I.createWeapon('weapon_pm');
    assert.throws(() => P.validateProfile(p), /рейд/);
    for (const pending of [undefined, false, 0, {}]) {
        const q = fresh(); q.pending = pending; assert.throws(() => P.validateProfile(q));
    }
});

test('reusing a completed raid ID cannot strand gear behind an already applied recovery operation', () => {
    let p = P.prepareRaid(fresh(), 'recovery-once', 'factory');
    p = P.recovery(p); const before = structuredClone(p);
    assert.throws(() => P.prepareRaid(p, 'recovery-once', 'factory'), /завершён/);
    assert.deepEqual(p, before);
});

test('a replayed result stays idempotent while another raid is pending', () => {
    const p = P.prepareRaid(fresh(), 'raid-first', 'factory'), r = result(p);
    const next = P.prepareRaid(P.applyResult(p, r), 'raid-next', 'city');
    assert.equal(P.applyResult(next, r), next);
    assert.equal(next.pending.raidId, 'raid-next');
});
