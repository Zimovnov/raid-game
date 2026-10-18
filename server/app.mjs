import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { AccountStore } from './store.mjs';
import { ResultWriter } from './result-writer.mjs';
import { World } from '../dist/src/simulation/world.js';
import { MAPS, RAID_MAPS } from '../dist/src/content/maps.js';
import { BUILD_VERSION, CONTENT_VERSION } from '../dist/src/content/catalog.js';
import { uid } from '../dist/src/domain/util.js';
import { isPatchId, selectedPatches } from '../dist/src/domain/patches.js';
import { PatchError, readPatchBody, normalizePatch } from './patch-images.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const cookie = req => /(?:^|;\s*)sid=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1] || '';
const json = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }); res.end(JSON.stringify(body)); };
const safeMessage = error => error instanceof Error ? error.message : 'Не удалось выполнить запрос';

export function createGameServer({ dbFile, staticDir, origins, secureCookies = false, admissionFile = null }) {
  const accounts = new AccountStore(dbFile);
  const resultWriter = new ResultWriter(dbFile);
  const allowed = new Set(origins);
  const rooms = new Map();
  const connections = new Map();
  const authAttempts = new Map();
  const stepSamples = [];
  let draining = false;
  let patchDecoders = 0;
  const admissionClosed = () => !!admissionFile && existsSync(admissionFile);
  const wsServer = new WebSocketServer({ noServer: true, maxPayload: 65536, perMessageDeflate: false });

  function sendPayload(accountId, payload) { const client = connections.get(accountId); if (client?.ws.readyState === WebSocket.OPEN && client.ws.bufferedAmount < 1024 * 1024) client.ws.send(payload); }
  function send(accountId, packet) { sendPayload(accountId, JSON.stringify(packet)); }
  function roomOf(accountId) { for (const room of rooms.values()) if (room.members.some(member => member.accountId === accountId)) return room; return null; }
  function publicLobby(room) { return { hostId: room.members[0]?.profileId || '', members: room.members.map(member => ({ id: member.profileId, character: member.character, gear: member.gear, ready: member.ready, loaded: member.loaded, connected: member.connected })), mapId: room.mapId, friendlyFire: room.friendlyFire, stage: room.stage, raidId: room.raidId, capacity: 5 }; }
  function publish(room) { const payload = JSON.stringify({ type: 'LOBBY', lobby: publicLobby(room), code: room.code }); for (const member of room.members) sendPayload(member.accountId, payload); }
  function snapshot(room, type = 'SNAPSHOT') { if (!room.world) return; const payload = JSON.stringify({ type, snapshot: room.world.snapshot() }); for (const member of room.members) sendPayload(member.accountId, payload); }
  function recordResults(room) {
    if (room.storagePromise) return room.storagePromise;
    const pending = room.members.filter(member => room.world?.players.get(member.profileId)?.result && !member.recorded);
    if (!pending.length) { if (room.paused === 'storage') room.paused = false; return Promise.resolve(); }
    room.paused = 'storage';
    const task = (async () => {
      for (const member of pending) {
        const profile = await resultWriter.commitResult(member.accountId, room.world.players.get(member.profileId).result);
        member.recorded = true;
        send(member.accountId, { type: 'PROFILE', profile });
      }
    })();
    room.storagePromise = task;
    void task.then(() => {
      room.storagePromise = null;
      if (room.members.some(member => room.world?.players.get(member.profileId)?.result && !member.recorded)) {
        void recordResults(room).catch(() => {});
        return;
      }
      room.paused = false;
      for (const { accountId, reply } of room.pendingReplies.splice(0)) send(accountId, { type: 'ACTION_REPLY', reply });
      snapshot(room);
    }, error => {
      room.storagePromise = null;
      room.nextStorageRetryAt = Date.now() + 1000;
      console.error('Raid result paused:', error);
      for (const member of room.members) send(member.accountId, { type: 'ERROR', message: 'Рейд приостановлен из-за ошибки сохранения. Сервер повторит запись.' });
    });
    return task;
  }
  async function removeMember(room, accountId) {
    const index = room.members.findIndex(member => member.accountId === accountId);
    if (index < 0) return;
    const member = room.members[index];
    if (room.world) {
      const actor = room.world.players.get(member.profileId);
      if (actor?.status === 'active') room.world.finish(actor, 'missing');
      while (actor?.result && !member.recorded) await recordResults(room);
    }
    room.members.splice(index, 1);
    send(accountId, { type: 'LEFT' });
    if (!room.members.length) rooms.delete(room.code);
    else publish(room);
  }
  function memberFromAccount(accountId) {
    const profile = accounts.profile(accountId);
    if (!profile || !profile.gear.primary && !profile.gear.secondary) throw Error('Возьмите оружие перед входом в отряд');
    if (profile.pending) throw Error('Уже есть незавершённый рейд');
    return { accountId, profileId: profile.id, character: profile.character, gear: profile.gear, ready: false, loaded: false, connected: true, disconnectedAt: 0, recorded: false };
  }
  function startRoom(room, accountId) {
    if (draining || admissionClosed()) throw Error('Сервер готовится к обновлению. Новый рейд пока недоступен.');
    if (resultWriter.exited) throw Error('Сохранение временно недоступно. Рейд пока нельзя начать.');
    if (room.members[0]?.accountId !== accountId || room.stage !== 'lobby') throw Error('Начать рейд может создатель отряда');
    if (room.members.some(member => !member.connected || !member.ready)) throw Error('Все участники должны подтвердить готовность');
    if ([...rooms.values()].some(other => other !== room && other.world && [...other.world.players.values()].some(actor => actor.status === 'active'))) throw Error('Сервер занят рейдом. Повторите после его завершения.');
    const raidId = uid();
    const profiles = accounts.prepareRoom(room.members, raidId, room.mapId);
    room.raidId = raidId;
    room.stage = 'raid';
    room.world = new World(MAPS[room.mapId], raidId, room.friendlyFire);
    for (const member of room.members) {
      const profile = profiles.get(member.accountId);
      member.gear = profile.pending.gear;
      member.loaded = true;
      member.recorded = false;
      room.world.addPlayer(member.profileId, member.character, profile.pending.gear);
      send(member.accountId, { type: 'PROFILE', profile });
    }
    publish(room);
    snapshot(room, 'START');
  }
  function handlePacket(client, packet) {
    if (!packet || typeof packet !== 'object' || typeof packet.type !== 'string') return;
    const accountId = client.accountId;
    if (packet.type === 'HELLO') {
      if (packet.build !== BUILD_VERSION || packet.content !== CONTENT_VERSION) throw Error('Версия игры изменилась. Обновите страницу.');
      const room = roomOf(accountId);
      if (room) {
        const member = room.members.find(member => member.accountId === accountId);
        member.connected = true; member.disconnectedAt = 0;
        publish(room);
        if (room.world) snapshot(room, 'RESUME');
      } else send(accountId, { type: 'HELLO', profile: accounts.profile(accountId) });
      return;
    }
    if (!client.verified) throw Error('Сначала подтвердите версию клиента');
    let room = roomOf(accountId);
    switch (packet.type) {
      case 'CREATE': {
        if (draining || admissionClosed()) throw Error('Сервер готовится к обновлению. Новый отряд пока недоступен.');
        if (resultWriter.exited) throw Error('Сохранение временно недоступно. Отряд пока нельзя создать.');
        if (room) throw Error('Вы уже в отряде');
        const code = randomBytes(8).toString('hex');
        room = { code, members: [memberFromAccount(accountId)], mapId: 'factory', friendlyFire: false, stage: 'lobby', raidId: '', world: null, paused: false, storagePromise: null, nextStorageRetryAt: 0, pendingReplies: [] };
        rooms.set(code, room); publish(room); break;
      }
      case 'JOIN': {
        if (room) throw Error('Вы уже в отряде');
        if (typeof packet.code !== 'string') throw Error('Введите код приглашения');
        room = rooms.get(packet.code.toLowerCase());
        if (!room || room.stage !== 'lobby') throw Error('Отряд не найден или рейд уже начался');
        if (room.members.length >= 5) throw Error('Отряд заполнен: максимум пять игроков');
        room.members.push(memberFromAccount(accountId)); publish(room); break;
      }
      case 'CONFIGURE': {
        if (!room || room.members[0]?.accountId !== accountId || room.stage !== 'lobby') throw Error('Изменить карту может создатель отряда');
        if (!RAID_MAPS.some(map => map.id === packet.mapId)) throw Error('Карта не найдена');
        room.mapId = packet.mapId;
        room.friendlyFire = packet.friendlyFire === true;
        for (const member of room.members) member.ready = false;
        publish(room); break;
      }
      case 'READY': {
        if (!room || room.stage !== 'lobby') throw Error('Отряд не готов к рейду');
        room.members.find(member => member.accountId === accountId).ready = packet.ready === true;
        publish(room); break;
      }
      case 'START': { if (!room) throw Error('Сначала создайте отряд'); startRoom(room, accountId); break; }
      case 'INPUT': { if (room?.stage === 'raid' && room.world && !room.paused) room.world.input(room.members.find(member => member.accountId === accountId).profileId, packet.input); break; }
      case 'ACTION': {
        if (!room?.world || room.stage !== 'raid' || room.paused) throw Error('Рейд не активен');
        const reply = room.world.action(room.members.find(member => member.accountId === accountId).profileId, packet.action);
        if (room.members.some(member => room.world.players.get(member.profileId)?.result && !member.recorded)) {
          room.pendingReplies.push({ accountId, reply });
          void recordResults(room).catch(() => {});
        } else send(accountId, { type: 'ACTION_REPLY', reply });
        break;
      }
      case 'NEXT_LOBBY': {
        if (!room?.world || room.members[0]?.accountId !== accountId || room.paused || [...room.world.players.values()].some(actor => actor.status === 'active')) throw Error('Дождитесь завершения рейда всеми участниками');
        room.world = null; room.stage = 'lobby'; room.raidId = '';
        for (const member of room.members) { member.ready = false; member.loaded = false; }
        publish(room); break;
      }
      case 'LEAVE': { if (room) {
        const member = room.members.find(member => member.accountId === accountId);
        if (!member.removing) {
          member.removing = true;
          void removeMember(room, accountId).catch(error => { console.error('Leave result:', error); send(accountId, { type: 'ERROR', message: 'Результат пока не сохранён. Сервер повторит запись.' }); }).finally(() => { member.removing = false; });
        }
      } break; }
      default: break;
    }
  }

  async function readBody(req) {
    let text = '';
    for await (const chunk of req) { text += chunk; if (text.length > 16384) throw Error('Запрос слишком большой'); }
    return JSON.parse(text || '{}');
  }
  function requestIp(req) {
    const peer = req.socket.remoteAddress || 'unknown';
    if (peer !== '127.0.0.1' && peer !== '::1' && peer !== '::ffff:127.0.0.1') return peer;
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return isIP(forwarded) ? forwarded : peer;
  }
  function consumeAttempt(key, maximum, duration) {
    const now = Date.now();
    const entry = authAttempts.get(key);
    if (entry && entry.until > now && entry.count >= maximum) throw Error('Слишком много попыток. Повторите позже.');
    authAttempts.set(key, entry && entry.until > now ? { count: entry.count + 1, until: entry.until } : { count: 1, until: now + duration });
    if (authAttempts.size > 10000) for (const [storedKey, value] of authAttempts) if (value.until < now) authAttempts.delete(storedKey);
  }
  function limitAuthentication(req, username) {
    const ip = requestIp(req);
    consumeAttempt(`auth-ip:${ip}`, 30, 15 * 60 * 1000);
    const accountKey = `auth-account:${ip}:${String(username || '').toLowerCase()}`;
    consumeAttempt(accountKey, 6, 15 * 60 * 1000);
    return accountKey;
  }
  function setCookie(token, maxAge = 30 * 24 * 60 * 60) { return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`; }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/health') {
        const sorted = [...stepSamples].sort((a, b) => a - b);
        return json(res, 200, { game: 'REID', server: true, storageReady: !resultWriter.exited, rooms: rooms.size, activeRaids: [...rooms.values()].filter(room => room.world && [...room.world.players.values()].some(actor => actor.status === 'active')).length, pendingResults: [...rooms.values()].reduce((total, room) => total + room.members.filter(member => room.world?.players.get(member.profileId)?.result && !member.recorded).length, 0), draining, admissionClosed: admissionClosed(), build: BUILD_VERSION, content: CONTENT_VERSION, stepP95Ms: sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null, stepSamples: sorted.length, rssMiB: Math.round(process.memoryUsage().rss / 1048576) });
      }
      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Метод не поддерживается' });
        if (req.method === 'POST' && !allowed.has(req.headers.origin)) return json(res, 403, { error: 'Источник запроса не разрешён' });
        if (admissionClosed() && req.method === 'POST' && !['/api/login', '/api/logout'].includes(url.pathname)) return json(res, 503, { error: 'Проверяем обновление. Сохранения и новые рейды временно закрыты.' });
        if (url.pathname === '/api/register' && req.method === 'POST') {
          consumeAttempt(`register:${requestIp(req)}`, 10, 60 * 60 * 1000);
          const created = await accounts.register(await readBody(req));
          const session = accounts.createSession(created.accountId);
          return json(res, 201, { profile: created.profile, recoveryCode: created.recoveryCode, csrf: session.csrf }, { 'Set-Cookie': setCookie(session.token) });
        }
        if (url.pathname === '/api/login' && req.method === 'POST') {
          const body = await readBody(req);
          const attempt = limitAuthentication(req, body.username);
          const session = await accounts.login(body.username, body.password);
          authAttempts.delete(attempt);
          return json(res, 200, { profile: session.profile, csrf: session.csrf }, { 'Set-Cookie': setCookie(session.token) });
        }
        if (url.pathname === '/api/recover' && req.method === 'POST') {
          const body = await readBody(req);
          const attempt = limitAuthentication(req, body.username);
          const session = await accounts.recover(body.username, body.code, body.password);
          authAttempts.delete(attempt);
          connections.get(session.accountId)?.ws.close(4003, 'Сессия обновлена');
          return json(res, 200, { profile: session.profile, csrf: session.csrf, recoveryCode: session.recoveryCode }, { 'Set-Cookie': setCookie(session.token) });
        }
        const session = accounts.session(cookie(req));
        if (!session) return json(res, 401, { error: 'Войдите в аккаунт' });
        if (url.pathname === '/api/me' && req.method === 'GET') return json(res, 200, { profile: session.profile, csrf: session.csrf });
        if (req.method === 'POST' && req.headers['x-csrf-token'] !== session.csrf) return json(res, 403, { error: 'Сессия формы устарела. Обновите страницу.' });
        if (url.pathname === '/api/patches' && req.method === 'GET') return json(res, 200, { patches: accounts.patches(session.accountId) });
        if (url.pathname === '/api/patches' && req.method === 'POST') {
          if (roomOf(session.accountId) || session.profile.pending) throw new PatchError(409, 'Для изменения патчей выйдите из отряда и завершите рейд');
          try { consumeAttempt('patch:' + session.accountId, 10, 60000); }
          catch { throw new PatchError(429, 'Слишком много загрузок. Повторите через минуту'); }
          if (patchDecoders >= 2) throw new PatchError(429, 'Обработка изображений занята. Повторите загрузку');
          patchDecoders++;
          try {
            const png = await normalizePatch(await readPatchBody(req));
            // Membership can change while the decoder is running.
            if (roomOf(session.accountId) || accounts.profile(session.accountId)?.pending) throw new PatchError(409, 'Для изменения патчей выйдите из отряда и завершите рейд');
            return json(res, 201, { patch: accounts.addPatch(session.accountId, png) });
          } finally { patchDecoders--; }
        }
        const patchRoute = /^\/api\/patches\/([a-f0-9]{64})(\.png|\/delete)$/.exec(url.pathname);
        if (patchRoute && isPatchId(patchRoute[1])) {
          const hash = patchRoute[1];
          if (patchRoute[2] === '/delete' && req.method === 'POST') {
            if (roomOf(session.accountId)) throw new PatchError(409, 'Для изменения патчей выйдите из отряда');
            accounts.deletePatch(session.accountId, hash);
            return json(res, 200, { ok: true });
          }
          if (patchRoute[2] === '.png' && req.method === 'GET') {
            let png = accounts.patch(session.accountId, hash);
            if (!png) {
              const room = roomOf(session.accountId);
              const member = room?.members.find(candidate => selectedPatches(candidate.character.patches).includes(hash));
              if (member) png = accounts.patch(member.accountId, hash);
            }
            if (!png) throw new PatchError(404, 'Патч недоступен');
            res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
            return res.end(png);
          }
        }
        if (url.pathname === '/api/logout' && req.method === 'POST') { accounts.logout(cookie(req)); connections.get(session.accountId)?.ws.close(4003, 'Выход из аккаунта'); return json(res, 200, { ok: true }, { 'Set-Cookie': setCookie('', 0) }); }
        if (url.pathname === '/api/profile/command' && req.method === 'POST') {
          if (roomOf(session.accountId)?.stage === 'raid') throw Error('Изменять схрон во время рейда нельзя');
          const command = await readBody(req);
          if (command.type === 'save-appearance' && roomOf(session.accountId)) throw Error('Для изменения внешности выйдите из отряда');
          const profile = accounts.command(session.accountId, command);
          return json(res, 200, { profile });
        }
        return json(res, 404, { error: 'Метод не найден' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Метод не поддерживается' });
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(staticDir, '.' + relative);
      if (!file.startsWith(staticDir + path.sep)) return json(res, 403, { error: 'Доступ запрещён' });
      try {
        const info = await stat(file);
        if (!info.isFile()) throw Error('not-file');
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': relative.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
        if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
      } catch { json(res, 404, { error: 'Файл не найден' }); }
    } catch (error) { json(res, error instanceof PatchError ? error.status : 400, { error: safeMessage(error) }); }
  });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const session = accounts.session(cookie(req));
    if (url.pathname !== '/ws' || !session || !allowed.has(req.headers.origin)) { socket.destroy(); return; }
    wsServer.handleUpgrade(req, socket, head, ws => {
      const client = { ws, accountId: session.accountId, token: cookie(req), verified: false, rateAt: Date.now(), rate: 0, sessionCheckAt: 0 };
      ws.on('message', data => {
        try {
          if (client.verified && connections.get(session.accountId) !== client) return;
          const now = Date.now();
          if (now >= client.sessionCheckAt) {
            if (!accounts.session(client.token)) { ws.close(4003, 'Сессия закончилась'); return; }
            client.sessionCheckAt = now + 5000;
          }
          if (now - client.rateAt > 1000) { client.rateAt = now; client.rate = 0; }
          if (++client.rate > 100) { ws.close(1008, 'Слишком много сообщений'); return; }
          const packet = JSON.parse(data.toString());
          if (packet?.type === 'HELLO') {
            if (packet.build !== BUILD_VERSION || packet.content !== CONTENT_VERSION) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Версия игры изменилась. Обновите страницу.' }));
              ws.close(4002, 'Версия игры изменилась');
              return;
            }
            if (!client.verified) {
              const old = connections.get(session.accountId);
              connections.set(session.accountId, client);
              client.verified = true;
              if (old) old.ws.close(4001, 'Новая сессия');
            }
          } else if (!client.verified) {
            ws.close(1008, 'Сначала подтвердите версию клиента');
            return;
          }
          handlePacket(client, packet);
        } catch (error) { send(session.accountId, { type: 'ERROR', message: safeMessage(error) }); }
      });
      ws.on('close', () => {
        if (connections.get(session.accountId) !== client) return;
        connections.delete(session.accountId);
        const room = roomOf(session.accountId);
        const member = room?.members.find(member => member.accountId === session.accountId);
        if (member) { member.connected = false; member.disconnectedAt = Date.now(); room.world?.disconnect(member.profileId); publish(room); }
      });
    });
  });

  const timer = setInterval(() => {
    for (const room of rooms.values()) {
      if (room.world && room.stage === 'raid' && room.paused === 'storage') {
        if (!room.storagePromise && Date.now() >= room.nextStorageRetryAt) void recordResults(room).catch(() => {});
      }
      if (room.world && room.stage === 'raid' && !room.paused) {
        const startedAt = performance.now();
        try {
          room.world.step();
        } catch (error) {
          room.paused = 'simulation';
          console.error('Simulation paused:', error);
          for (const member of room.members) send(member.accountId, { type: 'ERROR', message: 'Рейд приостановлен из-за ошибки симуляции.' });
        }
        if (!room.paused) {
          void recordResults(room).catch(() => {});
          if (!room.paused && room.world.tick % 3 === 0) snapshot(room);
        }
        stepSamples.push(performance.now() - startedAt);
        if (stepSamples.length > 900) stepSamples.shift();
      }
      for (const member of [...room.members]) if (!member.connected && member.disconnectedAt && Date.now() - member.disconnectedAt > 60000) {
        if (!member.removing) {
          member.removing = true;
          void removeMember(room, member.accountId).catch(error => { console.error('Disconnect result:', error); room.paused = 'storage'; }).finally(() => { member.removing = false; });
        }
      }
    }
  }, 1000 / 30);
  timer.unref();
  return { server, accounts, rooms, beginDrain: () => { draining = true; }, close: async () => { clearInterval(timer); for (const client of connections.values()) client.ws.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); wsServer.close(); await resultWriter.close(); accounts.close(); } };
}
