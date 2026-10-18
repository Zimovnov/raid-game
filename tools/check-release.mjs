/** Record one existing check against the current built source; no PASS is inferred. */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const commands = {
    verify: ['npm', 'run', 'verify'],
    routes: ['node', 'tools/audit-routes.mjs'],
    native: ['npm', 'run', 'test:render'],
    packaging: ['npm', 'run', 'test:packaging'],
    ui: ['npm', 'run', 'test:ui'],
    browser: ['npm', 'run', 'test:e2e'],
    rtc: ['npm', 'run', 'test:rtc']
};
const name = process.argv[2], command = commands[name];
if (!command) throw Error('Select one release check: ' + Object.keys(commands).join(', '));
fs.mkdirSync('artifacts/current', { recursive: true });
const log = name === 'verify' ? 'artifacts/verify.log' : 'artifacts/' + name + '-v05.log';
const fd = fs.openSync(log, 'w'), started = new Date().toISOString(), begin = performance.now();
const result = spawnSync(command[0], command.slice(1), { stdio: ['ignore', fd, fd] });
fs.closeSync(fd);
const seconds = Math.round((performance.now() - begin) / 1000 * 1000) / 1000;
const exitCode = result.status ?? 1, status = exitCode === 0 ? 'PASS' : exitCode === 2 ? 'BLOCKED' : 'FAIL';
const build = JSON.parse(fs.readFileSync('dist/build-info.json', 'utf8'));
const record = { name, command: command.join(' '), exitCode, seconds, status, started, finished: new Date().toISOString(), log, buildHash: build.hash };
if (result.error) record.error = result.error.message;
fs.writeFileSync('artifacts/current/check-' + name + '.json', JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify(record));
if (exitCode === 1) console.log(fs.readFileSync(log, 'utf8').slice(-6000));
process.exit(exitCode);
