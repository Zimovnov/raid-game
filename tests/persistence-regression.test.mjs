import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as P from '../dist/src/domain/profile.js';
import { Store } from '../dist/src/persistence/store.js';
import { storageFixture } from './fixtures/indexeddb-contract.mjs';

const fresh = () => P.newProfile({ name: 'Аудит Записи', faction: 'BEAR', face: 0, outfit: 0 });
async function setup(t) {
    const disk = storageFixture(t), store = new Store(), p = fresh();
    t.after(() => store.close());
    assert.equal(await store.open(), null);
    await store.save(p);
    return { disk, store, p };
}

test('Store contract: overlapping writes from one tab commit in order', async t => {
    const { disk, store, p } = await setup(t);
    const first = P.buy(p, 'ammo_9x18', 1, 'buy-first'), second = P.buy(first, 'ammo_9x18', 2, 'buy-second');
    await Promise.all([store.save(first), store.save(second)]);
    assert.deepEqual(disk.profile(), second);
});

test('Store contract: input mutation during a queued save cannot change the validated snapshot', async t => {
    const { disk, store, p } = await setup(t);
    const next = P.buy(p, 'ammo_9x18', 1), expected = structuredClone(next);
    const saving = store.save(next);
    next.cash = 0; next.stash.length = 0;
    await saving;
    assert.deepEqual(disk.profile(), expected);
});

test('Store contract: stale or altered same-revision profiles cannot overwrite newer progress', async t => {
    const { disk, store, p } = await setup(t);
    const next = P.buy(p, 'ammo_9x18', 1); await store.save(next);
    await assert.rejects(store.save(p), /Устаревший/);
    const sameRevision = structuredClone(next); sameRevision.cash++;
    await assert.rejects(store.save(sameRevision), /ревизии/);
    assert.deepEqual(disk.profile(), next);
    await store.save(structuredClone(next));
    assert.deepEqual(disk.profile(), next);
});

test('Store contract: replace still checks for another writer before backup and overwrite', async t => {
    const { disk, store, p } = await setup(t);
    const changedElsewhere = P.buy(p, 'ammo_9x18', 1);
    disk.forceProfile(changedElsewhere);
    await assert.rejects(store.save(fresh(), true), /другой вкладке/);
    assert.deepEqual(disk.profile(), changedElsewhere);
    assert.deepEqual(disk.backups(), []);
});

test('Store contract: quota failures retain previous progress and a subsequent retry can commit', async t => {
    const { disk, store, p } = await setup(t);
    const next = P.buy(p, 'ammo_9x18', 1);
    disk.failNextPut = true;
    await assert.rejects(store.save(next), /Quota|сохранить/);
    assert.deepEqual(disk.profile(), p);
    await store.save(next);
    assert.deepEqual(disk.profile(), next);
});

test('Store contract: synchronous put failure rolls back its accompanying backup', async t => {
    const { disk, store, p } = await setup(t);
    const imported = fresh(); disk.throwOnPut = true;
    await assert.rejects(store.save(imported, true), /clone/);
    assert.deepEqual(disk.profile(), p); assert.deepEqual(disk.backups(), []);
    await store.save(imported, true);
    assert.deepEqual(disk.profile(), imported);
    assert.equal(disk.backups().length, 1);
    assert.deepEqual(disk.backups()[0].profile, p);
});

test('Store contract: failed validation during open closes the connection and releases its exclusive lock', async t => {
    const corrupted = fresh(); corrupted.schema = 99;
    const disk = storageFixture(t, corrupted), failed = new Store();
    await assert.rejects(failed.open(), /версия/);
    assert.equal(disk.connections[0].closed, true);
    assert.deepEqual(disk.profile(), corrupted);
    disk.forceProfile(null);
    const retry = new Store(); t.after(() => retry.close());
    assert.equal(await retry.open(), null);
});

test('Store contract: unavailable IndexedDB does not leave the profile lock stuck', async t => {
    const disk = storageFixture(t), failed = new Store(); disk.openFailure = true;
    await assert.rejects(failed.open(), /IndexedDB/);
    disk.openFailure = false;
    const retry = new Store(); t.after(() => retry.close());
    assert.equal(await retry.open(), null);
});

test('Store contract: legacy migration atomically saves its exact original as a backup', async t => {
    const legacy = JSON.parse(fs.readFileSync(new URL('./fixtures/profile-v2.json', import.meta.url), 'utf8'));
    const disk = storageFixture(t, legacy), store = new Store(); t.after(() => store.close());
    const migrated = await store.open();
    assert.equal(migrated.schema, 3);
    assert.deepEqual(disk.profile(), migrated);
    assert.equal(disk.backups().length, 1);
    assert.deepEqual(disk.backups()[0].profile, legacy);
});

test('Store contract: failure to back up a migration cannot overwrite the old save', async t => {
    const legacy = JSON.parse(fs.readFileSync(new URL('./fixtures/profile-v2.json', import.meta.url), 'utf8'));
    const disk = storageFixture(t, legacy), store = new Store(); disk.failNextBackup = true;
    await assert.rejects(store.open(), /quota|сохранить/);
    assert.deepEqual(disk.profile(), legacy); assert.deepEqual(disk.backups(), []);
    const retry = new Store(); t.after(() => retry.close());
    assert.equal((await retry.open()).schema, 3);
    assert.equal(disk.backups().length, 1);
});

test('Store contract: corrupt export envelopes and mismatched schemas cannot replace a profile', async t => {
    const { disk, store, p } = await setup(t);
    const envelope = JSON.parse(await store.export(p));
    for (const data of ['null', JSON.stringify({ ...envelope, checksum: 'wrong' }), JSON.stringify({ ...envelope, schema: 2 })]) {
        await assert.rejects(store.import(data));
        assert.deepEqual(disk.profile(), p); assert.deepEqual(disk.backups(), []);
    }
});

test('Store contract: closing a store cancels queued writes before a new owner can open', async t => {
    const { disk, store, p } = await setup(t), next = P.buy(p, 'ammo_9x18', 1);
    const queued = store.save(next); store.close();
    await assert.rejects(queued, /закрыто/);
    assert.deepEqual(disk.profile(), p);
    const reopened = new Store(); t.after(() => reopened.close());
    assert.deepEqual(await reopened.open(), p);
});
