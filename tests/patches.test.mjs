import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import WebSocket from 'ws';
import { isPatchSelection, selectedPatches } from '../dist/src/domain/patches.js';
import { newProfile, saveAppearance, validateProfile } from '../dist/src/domain/profile.js';
import { defaultAppearance } from '../dist/src/content/apparel.js';
import { BUILD_VERSION, CONTENT_VERSION } from '../dist/src/content/catalog.js';
import { characterAppearanceModel } from '../dist/src/rendering/apparel.js';
import { normalizePatch } from '../server/patch-images.mjs';
import { AccountStore } from '../server/store.mjs';
import { createGameServer } from '../server/app.mjs';
import { normalizePatchImage } from '../dist/src/persistence/patch-images.js';

const image = (color = '#847342') => sharp({ create: { width: 64, height: 32, channels: 4, background: color } }).png().toBuffer();
const character = { name: 'Проверка', faction: 'BEAR', face: 0, outfit: 0 };

test('offline patch intake rejects unsafe headers before invoking the browser decoder', async () => {
  let decodes = 0;
  const previous = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => { decodes++; throw Error('decoder reached'); };
  try {
    const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#fff' } }).png().toBuffer();
    await assert.rejects(normalizePatchImage(new Blob([huge])), /16 мегапикселей/);
    const apng = Buffer.concat([await image(), Buffer.from([0,0,0,0,97,99,84,76,0,0,0,0])]);
    await assert.rejects(normalizePatchImage(new Blob([apng])), /неподвижным/);
    const metadata = await sharp(await image()).withMetadata().png().toBuffer();
    await assert.rejects(normalizePatchImage(new Blob([metadata]), true), /метаданные/);
    await assert.rejects(normalizePatchImage(new Blob(['<svg/>'])), /PNG, JPEG/);
    assert.equal(decodes, 0);
    for (const format of ['png', 'jpeg', 'webp']) {
      const input = await sharp(await image()).toFormat(format).toBuffer();
      await assert.rejects(normalizePatchImage(new Blob([input])), /прочитать изображение/);
    }
    assert.equal(decodes, 3, 'all three supported raster formats reach the browser decoder');
  } finally {
    if (previous) globalThis.createImageBitmap = previous;
    else delete globalThis.createImageBitmap;
  }
});

test('patch selection rejects untrusted properties and preserves old schema-3 profiles', () => {
  const hash = 'a'.repeat(64);
  for (const invalid of [null, [], 'x', { leftShoulder: '../file' }, { anything: hash }, { leftShoulder: undefined }, Object.create({ leftShoulder: hash })]) assert.equal(isPatchSelection(invalid), false);
  let called = false;
  const accessor = Object.defineProperty({}, 'leftShoulder', { enumerable: true, get() { called = true; return hash; } });
  assert.equal(isPatchSelection(accessor), false); assert.equal(called, false);
  const profile = newProfile(character); validateProfile(profile);
  const selection = { leftShoulder: hash, rightShoulder: hash };
  assert.deepEqual(selectedPatches(selection), [hash]);
  const changed = saveAppearance(profile, { ...profile.character, appearance: defaultAppearance(), patches: selection }, 'patch-save');
  assert.equal(changed.schema, 3); assert.deepEqual(changed.gear, profile.gear); assert.equal(changed.cash, profile.cash);
  assert.deepEqual(changed.character.patches, selection);
  assert.deepEqual(saveAppearance(changed, { ...changed.character, patches: {} }, 'patch-remove').character.patches, {});
  const base = characterAppearanceModel(profile.character), patched = characterAppearanceModel(changed.character);
  assert.equal(patched.filter(part => part.patch).length, 2);
  assert.deepEqual(patched.filter(part => !part.patch), base, 'patches must not change the body or equipment');
  assert.deepEqual(characterAppearanceModel({ ...profile.character, patches: {} }), base, 'cached appearance must not inherit another character patches');
});

test('server normalizes raster inputs, preserves aspect/alpha, and rejects non-raster or excessive images', async () => {
  for (const format of ['png', 'jpeg', 'webp']) {
    const input = await sharp(await image()).toFormat(format).toBuffer();
    const output = await normalizePatch(input), metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 256); assert.equal(metadata.height, 256);
    assert.equal(metadata.hasAlpha, true); assert.equal(metadata.exif, undefined);
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0, 'padding is transparent');
    assert.equal(data[(128 * info.width + 128) * info.channels + 3], 255);
  }
  await assert.rejects(normalizePatch(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')), /PNG, JPEG/);
  await assert.rejects(normalizePatch((await image()).subarray(0, 40)), /повреждено/);
  const apng = readFileSync(new URL('./fixtures/animated-patch.png', import.meta.url));
  await assert.rejects(normalizePatch(apng), /неподвижным/);
  await assert.rejects(normalizePatchImage(new Blob([apng])), /неподвижным/);
  const animatedWebp = await sharp(Buffer.concat([Buffer.alloc(16, 255), Buffer.alloc(16, 100)]), { raw: { width: 2, height: 4, channels: 4, pageHeight: 2 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animatedWebp).metadata()).pages, 2);
  await assert.rejects(normalizePatch(animatedWebp), /неподвижным/);
  await assert.rejects(normalizePatchImage(new Blob([animatedWebp])), /неподвижным/);
  await assert.rejects(normalizePatch(Buffer.alloc(2 * 1024 * 1024 + 1)), /2 МиБ/);
  const oversized = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#fff' } }).png().toBuffer();
  await assert.rejects(normalizePatch(oversized), /16 мегапикселей/);
});

test('patch BLOBs survive database backup/reopen; ownership, selected deletion and quota are transactional', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'raid-patch-store-'));
  const file = path.join(directory, 'accounts.sqlite'); let store = new AccountStore(file);
  try {
    const a = await store.register({ username: 'patch_owner', password: 'patch-test-password', character });
    const b = await store.register({ username: 'patch_other', password: 'patch-test-password', character });
    const png = await normalizePatch(await image()); const patch = store.addPatch(a.accountId, png);
    assert.equal(patch.id, createHash('sha256').update(png).digest('hex'));
    assert.deepEqual(store.addPatch(a.accountId, png), patch); assert.equal(store.patches(a.accountId).length, 1);
    const command = { type: 'save-appearance', appearance: defaultAppearance(), face: 0, patches: { leftShoulder: patch.id }, expectedRevision: 0, operationId: randomUUID() };
    assert.throws(() => store.command(b.accountId, command), /вашей библиотеке/);
    const saved = store.command(a.accountId, command);
    assert.deepEqual(store.command(a.accountId, command), saved, 'operation retry is idempotent');
    assert.throws(() => store.deletePatch(a.accountId, patch.id), /Сначала снимите/);
    for (let i = 1; i < 20; i++) store.addPatch(a.accountId, await normalizePatch(await image('#' + (0x200000 + i * 101).toString(16))));
    const extra = await normalizePatch(await image('#ff6600'));
    assert.throws(() => store.addPatch(a.accountId, extra), /20 патчей/);
    const backup = path.join(directory, 'backup.sqlite'); await store.backup(backup);
    store.close(); store = new AccountStore(backup);
    assert.deepEqual(store.patch(a.accountId, patch.id), png); assert.deepEqual(store.profile(a.accountId), saved);
    store.command(a.accountId, { ...command, patches: {}, expectedRevision: saved.revision, operationId: randomUUID() });
    store.deletePatch(a.accountId, patch.id); assert.equal(store.patch(a.accountId, patch.id), null);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('authenticated patch HTTP API shares only equipped images within an actual WebSocket lobby', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'raid-patch-api-')), origin = 'http://127.0.0.1:19081';
  const app = createGameServer({ dbFile: path.join(directory, 'accounts.sqlite'), staticDir: path.resolve('dist-web'), origins: [origin] });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`, sockets = [];
  const register = async username => {
    const response = await fetch(base + '/api/register', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'patch-api-password', character }) });
    assert.equal(response.status, 201); const data = await response.json();
    return { ...data, headers: { Cookie: response.headers.get('set-cookie').split(';')[0], Origin: origin, 'X-CSRF-Token': data.csrf } };
  };
  const connect = async client => {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', { headers: client.headers }); sockets.push(ws);
    await once(ws, 'open'); ws.send(JSON.stringify({ type: 'HELLO', build: BUILD_VERSION, content: CONTENT_VERSION })); return ws;
  };
  const packet = (ws, type) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off('message', handler); reject(Error('No ' + type)); }, 3000);
    const handler = bytes => { const data = JSON.parse(bytes); if (data.type === type) { clearTimeout(timer); ws.off('message', handler); resolve(data); } };
    ws.on('message', handler);
  });
  try {
    const owner = await register('patch_api_owner'), peer = await register('patch_api_peer');
    const upload = await fetch(base + '/api/patches', { method: 'POST', headers: owner.headers, body: await image() }); assert.equal(upload.status, 201);
    const { patch } = await upload.json(), url = base + '/api/patches/' + patch.id + '.png';
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: peer.headers })).status, 404);
    assert.equal((await fetch(base + '/api/patches', { headers: peer.headers }).then(r => r.json())).patches.length, 0);
    const hidden = app.accounts.addPatch(app.accounts.db.prepare('SELECT id FROM accounts WHERE username=?').get('patch_api_owner').id, await normalizePatch(await image('#678932')));
    const equip = await fetch(base + '/api/profile/command', { method: 'POST', headers: { ...owner.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'save-appearance', appearance: owner.profile.character.appearance, face: 0, patches: { leftShoulder: patch.id }, expectedRevision: 0, operationId: randomUUID() }) }); assert.equal(equip.status, 200);
    const hostSocket = await connect(owner), peerSocket = await connect(peer);
    const created = packet(hostSocket, 'LOBBY'); hostSocket.send(JSON.stringify({ type: 'CREATE' })); const { code } = await created;
    const joined = packet(peerSocket, 'LOBBY'); peerSocket.send(JSON.stringify({ type: 'JOIN', code })); await joined;
    const visible = await fetch(url, { headers: peer.headers }); assert.equal(visible.status, 200); assert.equal(visible.headers.get('content-type'), 'image/png'); assert.match(visible.headers.get('cache-control'), /private/);
    assert.equal((await fetch(base + '/api/patches/' + hidden.id + '.png', { headers: peer.headers })).status, 404, 'the whole library is never shared');
    assert.equal((await fetch(base + '/api/patches', { method: 'POST', headers: owner.headers, body: await image() })).status, 409);
    assert.equal((await fetch(base + '/api/patches/' + patch.id + '/delete', { method: 'POST', headers: owner.headers })).status, 409);
    const left = packet(peerSocket, 'LEFT'); peerSocket.send(JSON.stringify({ type: 'LEAVE' })); await left;
    assert.equal((await fetch(url, { headers: peer.headers })).status, 404, 'room access ends on leave');
    assert.equal((await fetch(base + '/api/patches', { method: 'POST', headers: { Cookie: peer.headers.Cookie, Origin: origin }, body: await image() })).status, 403);
    assert.equal((await fetch(base + '/api/patches', { method: 'POST', headers: peer.headers, body: '<svg/>' })).status, 415);
    assert.equal((await fetch(base + '/api/patches', { method: 'POST', headers: peer.headers, body: (await image()).subarray(0, 40) })).status, 400);
    assert.equal((await fetch(base + '/api/patches', { method: 'POST', headers: peer.headers, body: Buffer.alloc(2 * 1024 * 1024 + 1) })).status, 413);
  } finally { for (const ws of sockets) ws.terminate(); await app.close(); rmSync(directory, { recursive: true, force: true }); }
});
