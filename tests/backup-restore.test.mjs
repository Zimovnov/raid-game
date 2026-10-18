import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AccountStore } from '../server/store.mjs';

test('a live SQLite backup restores an interrupted raid as a technical result', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'raid-restore-'));
  const source = path.join(directory, 'source.sqlite');
  const backup = path.join(directory, 'backup.sqlite');
  const restoredFile = path.join(directory, 'restored.sqlite');
  let original;
  let restored;
  try {
    original = new AccountStore(source);
    const { accountId, profile } = await original.register({
      username: 'backup_tester',
      password: 'backup-test-password',
      character: { name: 'Проверка копии', faction: 'BEAR' },
    });
    original.prepareRoom([{ accountId }], 'interrupted-raid', 'factory');
    assert(original.profile(accountId).pending);

    const result = spawnSync(process.execPath, ['tools/backup-db.mjs', source, backup], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readdirSync(directory).filter(name => name.startsWith('backup.sqlite.tmp-')), []);
    copyFileSync(backup, restoredFile);

    restored = new AccountStore(restoredFile);
    const recovered = restored.profile(accountId);
    assert.equal(recovered.pending, null);
    assert.equal(recovered.journal.at(-1)?.outcome, 'technical');
    assert.deepEqual(recovered.gear, profile.gear);
    assert.equal((await restored.login('backup_tester', 'backup-test-password')).profile.id, profile.id);
  } finally {
    restored?.close();
    original?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
