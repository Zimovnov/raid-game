import { chmod, mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';

const [source, target] = process.argv.slice(2);
if (!source || !target || path.resolve(source) === path.resolve(target)) {
  console.error('Usage: node tools/backup-db.mjs SOURCE_SQLITE TARGET_SQLITE');
  process.exit(2);
}

await stat(source);
await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
const temporary = `${target}.tmp-${process.pid}`;
let database;
try {
  database = new Database(source, { readonly: true, fileMustExist: true });
  await database.backup(temporary);
  await chmod(temporary, 0o600);
  const check = new Database(temporary, { readonly: true, fileMustExist: true });
  try {
    const result = check.pragma('integrity_check', { simple: true });
    if (result !== 'ok') throw Error(`SQLite integrity check failed: ${result}`);
    check.prepare('SELECT COUNT(*) FROM accounts').get();
  } finally { check.close(); }
  await rename(temporary, target);
  await Promise.all([rm(`${temporary}-wal`, { force: true }), rm(`${temporary}-shm`, { force: true })]);
  console.log(`Verified SQLite backup: ${target}`);
} catch (error) {
  await Promise.all([temporary, `${temporary}-wal`, `${temporary}-shm`].map(file => rm(file, { force: true })));
  throw error;
} finally { database?.close(); }
