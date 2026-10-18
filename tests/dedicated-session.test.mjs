import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DedicatedSession } from '../dist/src/network/dedicated-session.js';

class FakeWebSocket extends EventTarget {
  static OPEN = 1;
  static instances = [];
  readyState = 0;
  bufferedAmount = 0;
  sent = [];

  constructor() {
    super();
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => { this.readyState = FakeWebSocket.OPEN; this.dispatchEvent(new Event('open')); });
  }

  send(value) { this.sent.push(JSON.parse(value)); }
  emit(packet) {
    const event = new Event('message');
    Object.defineProperty(event, 'data', { value: JSON.stringify(packet) });
    this.dispatchEvent(event);
  }
  close(code = 1000) {
    this.readyState = 3;
    const event = new Event('close');
    Object.defineProperty(event, 'code', { value: code });
    this.dispatchEvent(event);
  }
}

function withSocket(fn) {
  return async () => {
    const previousSocket = globalThis.WebSocket;
    const previousLocation = globalThis.location;
    globalThis.WebSocket = FakeWebSocket;
    globalThis.location = { href: 'http://127.0.0.1:8081/' };
    FakeWebSocket.instances = [];
    try { await fn(); }
    finally { globalThis.WebSocket = previousSocket; globalThis.location = previousLocation; }
  };
}

function session(hooks = {}) {
  return new DedicatedSession({ id: 'player-1' }, {
    lobby() {}, snapshot() {}, error() {}, lost() {},
    async prepare() { return {}; }, async started() {}, reply() {}, profile() {},
    ...hooks,
  }, { current: { id: 'player-1' }, update() {} });
}

test('dedicated client rejects a failed version handshake without a five-second resume timeout', withSocket(async () => {
  const lost = [];
  const client = session({ lost: message => lost.push(message) });
  const resuming = client.resume();
  await new Promise(resolve => setImmediate(resolve));
  const socket = FakeWebSocket.instances[0];
  assert.equal(socket.sent[0].type, 'HELLO');
  socket.emit({ type: 'ERROR', message: 'Версия игры изменилась. Обновите страницу.' });
  socket.close(4002);
  await assert.rejects(resuming, /Версия игры изменилась/);
  assert.match(lost[0], /Версия игры обновилась/);
  client.close();
}));

test('dedicated client applies snapshots only after raid preparation finishes', withSocket(async () => {
  let finishPreparation;
  const received = [];
  const client = session({
    prepare: () => new Promise(resolve => { finishPreparation = resolve; }),
    snapshot: snapshot => received.push(snapshot.tick),
  });
  const resuming = client.resume();
  await new Promise(resolve => setImmediate(resolve));
  const socket = FakeWebSocket.instances[0];
  socket.emit({ type: 'LOBBY', lobby: { hostId: 'player-1', members: [], stage: 'raid', mapId: 'factory' }, code: '0123456789abcdef' });
  await resuming;
  socket.emit({ type: 'START', snapshot: { tick: 1, raidId: 'raid', mapId: 'factory' } });
  socket.emit({ type: 'SNAPSHOT', snapshot: { tick: 2 } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(received, []);
  finishPreparation({});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(received, [1, 2]);
  client.close();
}));

test('terminal raid resume skips preparation when server has already cleared escrow', withSocket(async () => {
  let prepared = 0;
  const received = [];
  const client = session({ prepare: async () => { prepared++; }, snapshot: snapshot => received.push(snapshot.raidId) });
  const resuming = client.resume();
  await new Promise(resolve => setImmediate(resolve));
  const socket = FakeWebSocket.instances[0];
  socket.emit({ type: 'LOBBY', lobby: { hostId: 'player-1', members: [], stage: 'raid', mapId: 'factory' }, code: '0123456789abcdef' });
  await resuming;
  socket.emit({ type: 'RESUME', snapshot: { tick: 5, raidId: 'finished-raid', mapId: 'factory', players: [{ id: 'player-1', result: { id: 'finished-result' } }] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prepared, 0);
  assert.deepEqual(received, ['finished-raid']);
  client.close();
}));
