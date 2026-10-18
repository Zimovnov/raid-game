import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AccountStore } from '../server/store.mjs';
import { defaultAppearance } from '../dist/src/content/apparel.js';
import { prepareRaid } from '../dist/src/domain/profile.js';

test('server wardrobe preserves an old schema-3 account, rejects invalid/stale writes, and survives reopen', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'raid-wardrobe-'));
  const file = path.join(directory, 'accounts.sqlite');
  let store = new AccountStore(file);
  try {
    const { accountId } = await store.register({ username: 'wardrobe_test', password: 'wardrobe-test-password', character: { name: 'Тест', faction: 'USEC' } });
    const old = store.profile(accountId);
    delete old.character.appearance;
    store.saveProfile(accountId, old);
    const appearance = { ...defaultAppearance('USEC', old.character.outfit), jacketCamo: 'flora', rig: 'rig_buyanov' };
    const command = { type: 'save-appearance', appearance, face: 4, expectedRevision: old.revision, operationId: randomUUID(), cash: 999999, name: 'Подмена', faction: 'BEAR' };
    const saved = store.command(accountId, command);
    assert.deepEqual(saved.character, { ...old.character, appearance, face: 4 });
    for (const key of ['id', 'schema', 'cash', 'gear', 'stash', 'inbox', 'quests', 'stats', 'journal', 'pending']) assert.deepEqual(saved[key], old[key], key);
    assert.equal(saved.revision, old.revision + 1);
    assert.deepEqual(store.command(accountId, command), saved);
    assert.throws(() => store.command(accountId, { ...command, operationId: randomUUID() }), /Профиль изменился/);
    for (const invalid of [{ face: 12 }, { appearance: { ...appearance, jacket: 'unknown' } }, { appearance: null }]) {
      assert.throws(() => store.command(accountId, { ...command, ...invalid, expectedRevision: saved.revision, operationId: randomUUID() }));
      assert.deepEqual(store.profile(accountId), saved);
    }
    store.close();
    store = new AccountStore(file);
    assert.deepEqual(store.profile(accountId), saved);
    const pending = prepareRaid(saved, randomUUID(), 'factory');
    store.saveProfile(accountId, pending);
    assert.throws(() => store.command(accountId, { ...command, expectedRevision: pending.revision, operationId: randomUUID() }), /рейд/);
    assert.deepEqual(store.profile(accountId), pending);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
