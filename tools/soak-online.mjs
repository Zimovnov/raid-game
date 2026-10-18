import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createGameServer } from '../server/app.mjs';
import { BUILD_VERSION, CONTENT_VERSION } from '../dist/src/content/catalog.js';

const seconds = Number(process.argv[2] || 1800);
if (!Number.isInteger(seconds) || seconds < 10 || seconds > 3600) throw Error('Duration must be 10–3600 seconds');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const temp = mkdtempSync(path.join(tmpdir(), 'raid-soak-'));
const origin = 'http://127.0.0.1:19991';
const app = createGameServer({ dbFile: path.join(temp, 'soak.sqlite'), staticDir: path.resolve('dist-web'), origins: [origin] });
const sockets = [];
let inputTimer;
let peakP95 = 0;
let peakRss = 0;
let raids = 0;
let snapshots = 0;
let activeClients = [];

async function receive(client, type, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const index = client.messages.findIndex(packet => packet.type === type);
    if (index >= 0) return client.messages.splice(index, 1)[0];
    await wait(10);
  }
  throw Error(`Timed out waiting for ${type}`);
}

async function newClient(base, group, index) {
  const response = await fetch(base + '/api/register', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${group + 10}` },
    body: JSON.stringify({ username: `soak_${group}_${index}`, password: `load-test-password-${group}-${index}`, character: { name: `Нагрузка ${index + 1}`, faction: 'BEAR' } }),
  });
  assert.equal(response.status, 201);
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', { headers: { Origin: origin, Cookie: response.headers.get('set-cookie').split(';')[0] } });
  sockets.push(ws);
  await once(ws, 'open');
  const client = { ws, messages: [], seq: 0 };
  ws.on('message', raw => {
    const packet = JSON.parse(raw.toString());
    if (packet.type === 'SNAPSHOT') snapshots++;
    if (packet.type === 'ERROR') throw Error(packet.message);
    client.messages.push(packet);
    if (client.messages.length > 100) client.messages.splice(0, 50);
  });
  ws.send(JSON.stringify({ type: 'HELLO', build: BUILD_VERSION, content: CONTENT_VERSION }));
  await receive(client, 'HELLO');
  return client;
}

async function startRaid(base) {
  const clients = await Promise.all(Array.from({ length: 5 }, (_, index) => newClient(base, raids, index)));
  clients[0].ws.send(JSON.stringify({ type: 'CREATE' }));
  const { code } = await receive(clients[0], 'LOBBY');
  for (let i = 1; i < clients.length; i++) {
    clients[i].ws.send(JSON.stringify({ type: 'JOIN', code }));
    await receive(clients[i], 'LOBBY');
  }
  clients[0].ws.send(JSON.stringify({ type: 'CONFIGURE', mapId: 'city', friendlyFire: false }));
  await wait(50);
  for (const client of clients) client.ws.send(JSON.stringify({ type: 'READY', ready: true }));
  await wait(100);
  clients[0].ws.send(JSON.stringify({ type: 'START' }));
  const started = await receive(clients[0], 'START');
  assert.equal(started.snapshot.players.length, 5);
  raids++;
  activeClients = clients;
}

try {
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const startedAt = Date.now();
  await startRaid(base);
  inputTimer = setInterval(() => {
    for (const client of activeClients) if (client.ws.readyState === WebSocket.OPEN) client.ws.send(JSON.stringify({ type: 'INPUT', input: { seq: ++client.seq, forward: 0, right: 0, yaw: 0, pitch: 0, sprint: false, slow: false, crouch: false, jump: false, fire: false, aim: false } }));
  }, 1000 / 30);
  while (Date.now() - startedAt < seconds * 1000) {
    await wait(Math.min(5000, Math.max(1, seconds * 1000 - (Date.now() - startedAt))));
    const health = await (await fetch(base + '/health')).json();
    peakP95 = Math.max(peakP95, health.stepP95Ms || 0);
    peakRss = Math.max(peakRss, health.rssMiB);
    if (!health.activeRaids && Date.now() - startedAt < seconds * 1000 - 5000) {
      for (const client of activeClients) client.ws.close();
      await startRaid(base);
    }
  }
  console.log(JSON.stringify({ seconds, raids, snapshots, peakP95Ms: Number(peakP95.toFixed(2)), peakRssMiB: peakRss, finalHealth: await (await fetch(base + '/health')).json() }));
  assert(peakP95 <= 33.3, `Step p95 exceeded 33.3 ms: ${peakP95}`);
} finally {
  clearInterval(inputTimer);
  for (const socket of sockets) socket.terminate();
  await app.close();
  rmSync(temp, { recursive: true, force: true });
}
