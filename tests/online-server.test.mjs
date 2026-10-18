import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { createGameServer } from '../server/app.mjs';
import { BUILD_VERSION, CONTENT_VERSION } from '../dist/src/content/catalog.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('five authenticated players join one server-owned raid; sixth is rejected; host disconnect does not stop it', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'raid-online-'));
  const dbFile = path.join(temp, 'profile.sqlite');
  const origin = 'http://127.0.0.1:18981';
  const app = createGameServer({ dbFile, staticDir: path.resolve('dist-web'), origins: [origin] });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const sockets = [];
  let clients = [];
  try {
    for (let i = 0; i < 6; i++) {
      const response = await fetch(base + '/api/register', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'tester_' + i, password: 'valid-password-' + i, character: { name: 'Игрок ' + i, faction: 'BEAR' } }) });
      assert.equal(response.status, 201);
      const data = await response.json();
      assert.equal(data.profile.schema, 3);
      assert.match(data.recoveryCode, /^[a-f0-9]{48}$/);
      const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', { headers: { Origin: origin, Cookie: response.headers.get('set-cookie').split(';')[0] } });
      sockets.push(ws);
      await once(ws, 'open');
      const messages = [];
      ws.on('message', data => messages.push(JSON.parse(data.toString())));
      ws.send(JSON.stringify({ type: 'HELLO', build: BUILD_VERSION, content: CONTENT_VERSION }));
      clients.push({ ws, messages, profile: data.profile, cookie: response.headers.get('set-cookie').split(';')[0], csrf: data.csrf });
    }
    const next = async (client, type) => {
      for (let n = 0; n < 100; n++) {
        const index = client.messages.findIndex(message => message.type === type);
        if (index >= 0) return client.messages.splice(index, 1)[0];
        await wait(10);
      }
      throw Error('Timed out waiting for ' + type);
    };
    const operationId = randomUUID();
    const profileCommand = { type: 'sort', expectedRevision: clients[0].profile.revision, operationId };
    const commandHeaders = { Origin: origin, Cookie: clients[0].cookie, 'X-CSRF-Token': clients[0].csrf, 'Content-Type': 'application/json' };
    const command = () => fetch(base + '/api/profile/command', { method: 'POST', headers: commandHeaders, body: JSON.stringify(profileCommand) });
    const firstCommand = await command();
    assert.equal(firstCommand.status, 200);
    const firstProfile = (await firstCommand.json()).profile;
    const replay = await command();
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).profile.revision, firstProfile.revision);
    const stale = new WebSocket(base.replace('http:', 'ws:') + '/ws', { headers: { Origin: origin, Cookie: clients[0].cookie } });
    sockets.push(stale);
    await once(stale, 'open');
    stale.send(JSON.stringify({ type: 'HELLO', build: 'obsolete', content: CONTENT_VERSION }));
    assert.equal((await once(stale, 'close'))[0], 4002);
    clients[0].ws.send(JSON.stringify({ type: 'CREATE' }));
    const created = await next(clients[0], 'LOBBY');
    const code = created.code;
    const wardrobeInLobby = await fetch(base + '/api/profile/command', { method: 'POST', headers: commandHeaders, body: JSON.stringify({ type: 'save-appearance', appearance: firstProfile.character.appearance, face: 1, expectedRevision: firstProfile.revision, operationId: randomUUID() }) });
    assert.equal(wardrobeInLobby.status, 400);
    assert.match((await wardrobeInLobby.json()).error, /выйдите из отряда/);
    for (let i = 1; i < 5; i++) {
      clients[i].ws.send(JSON.stringify({ type: 'JOIN', code }));
      assert.equal((await next(clients[i], 'LOBBY')).lobby.members.length, i + 1);
    }
    clients[5].ws.send(JSON.stringify({ type: 'JOIN', code }));
    assert.match((await next(clients[5], 'ERROR')).message, /заполнен/);
    for (let i = 0; i < 5; i++) clients[i].ws.send(JSON.stringify({ type: 'READY', ready: true }));
    await wait(80);
    clients[0].ws.send(JSON.stringify({ type: 'START' }));
    const started = await next(clients[0], 'START');
    assert.equal(started.snapshot.players.length, 5);
    assert.equal(new Set(started.snapshot.players.map(player => player.p.join(','))).size, 5);
    const room = app.rooms.get(code);
    assert.equal(room.world.players.size, 5);
    app.beginDrain();
    clients[5].ws.send(JSON.stringify({ type: 'CREATE' }));
    assert.match((await next(clients[5], 'ERROR')).message, /обновлению/);
    assert.equal((await (await fetch(base + '/health')).json()).draining, true);
    const tick = room.world.tick;
    clients[0].ws.close();
    await wait(150);
    assert(room.world.tick > tick);
    assert.equal(room.members.length, 5);
    const target = room.world.players.get(clients[1].profile.id);
    clients[1].messages.splice(0, clients[1].messages.length, ...clients[1].messages.filter(message => message.type !== 'PROFILE'));
    room.world.finish(target, 'extracted');
    await next(clients[1], 'PROFILE');
    const me = await fetch(base + '/api/me', { headers: { Cookie: clients[1].cookie } });
    const saved = (await me.json()).profile;
    assert.equal(saved.journal.filter(result => result.raidId === room.raidId).length, 1);
    assert.equal(saved.pending, null);
    const abandonId = randomUUID();
    clients[2].messages.length = 0;
    clients[2].ws.send(JSON.stringify({ type: 'ACTION', action: { id: abandonId, type: 'abandon' } }));
    for (let n = 0; n < 100 && !clients[2].messages.some(message => message.type === 'ACTION_REPLY' && message.reply.id === abandonId); n++) await wait(10);
    const resultPackets = clients[2].messages.filter(message => message.type === 'PROFILE' || message.type === 'ACTION_REPLY');
    assert.deepEqual(resultPackets.map(message => message.type), ['PROFILE', 'ACTION_REPLY']);
    const abandoned = await fetch(base + '/api/me', { headers: { Cookie: clients[2].cookie } });
    assert.equal((await abandoned.json()).profile.pending, null);
    const bad = await fetch(base + '/api/profile/command', { method: 'POST', headers: { Origin: origin, Cookie: clients[1].cookie, 'X-CSRF-Token': clients[1].csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'set-cash', cash: 9999999, expectedRevision: saved.revision }) });
    assert.notEqual(bad.status, 200);
    const wrongOrigin = await fetch(base + '/api/profile/command', { method: 'POST', headers: { Origin: 'https://evil.example', Cookie: clients[1].cookie, 'X-CSRF-Token': clients[1].csrf, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(wrongOrigin.status, 403);
    for (let i = 0; i < 4; i++) {
      const extra = await fetch(base + '/api/register', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'tester_extra_' + i, password: 'valid-password-extra-' + i, character: { name: 'Дополнительный игрок', faction: 'BEAR' } }) });
      assert.equal(extra.status, 201);
    }
    const excessive = await fetch(base + '/api/register', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'tester_extra_4', password: 'valid-password-extra-4', character: { name: 'Дополнительный игрок', faction: 'BEAR' } }) });
    assert.equal(excessive.status, 400);
    assert.match((await excessive.json()).error, /Слишком много попыток/);
  } finally {
    for (const socket of sockets) socket.terminate();
    await app.close();
    const restored = createGameServer({ dbFile, staticDir: path.resolve('dist-web'), origins: [origin] });
    try {
      const active = restored.accounts.db.prepare('SELECT profile_json FROM accounts WHERE username=?').get('tester_3');
      if (active) {
        const profile = JSON.parse(active.profile_json);
        assert.equal(profile.pending, null);
        assert.equal(profile.journal.at(-1)?.outcome, 'technical');
      }
    } finally { await restored.close(); rmSync(temp, { recursive: true, force: true }); }
  }
});
