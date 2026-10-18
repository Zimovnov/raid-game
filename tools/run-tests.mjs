import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// Enumerate in Node instead of relying on shell globs, which differ on Windows.
const paths = readdirSync('tests').filter(name => !name.startsWith('.') && name.endsWith('.test.mjs')).sort().map(name => 'tests/' + name);
if (!paths.length) { console.error('No test files found.'); process.exit(1); }
// Bound file-level parallelism on busy workstations without changing test deadlines.
const requested = process.env.RAID_TEST_CONCURRENCY;
if (requested !== undefined && (!/^[1-9]\d*$/.test(requested) || Number(requested) > 64)) {
  console.error('RAID_TEST_CONCURRENCY must be an integer from 1 to 64.'); process.exit(1);
}
const concurrency = requested ? ['--test-concurrency=' + requested] : [];
const result = spawnSync(process.execPath, ['--test', ...concurrency, ...paths], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
