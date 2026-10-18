import type { Action, ActionReply, Equipment, Input, Lobby, Profile, Snapshot } from '../domain/types.js';
import { BUILD_VERSION, CONTENT_VERSION } from '../content/catalog.js';
import type { OnlineApi } from './online-api.js';

interface Hooks {
  lobby: (lobby: Lobby) => void;
  snapshot: (snapshot: Snapshot) => void;
  error: (message: string) => void;
  lost: (message: string) => void;
  prepare: (raidId: string, mapId: string) => Promise<Equipment>;
  started: () => Promise<void>;
  reply: (reply: ActionReply) => void;
  profile: (profile: Profile) => void;
}

export class DedicatedSession {
  lobby: Lobby = { hostId: '', members: [], mapId: 'factory', friendlyFire: false, stage: 'lobby', raidId: '' };
  world = null;
  host = false;
  connected = false;
  code = '';
  readonly transport = { diagnostics: { signaling: 'Сервер', state: 'Подключение', route: 'WebSocket', rtt: 0, bufferedAmount: 0 } };
  private socket: WebSocket | null = null;
  private receiveQueue: Promise<void> = Promise.resolve();
  private starting = false;
  private closed = false;
  private waitLobby: ((value: void) => void) | null = null;
  private waitError: ((reason: Error) => void) | null = null;
  private waitLeft: (() => void) | null = null;
  private waitWelcome: { resolve: (room: boolean) => void; reject: (reason: Error) => void } | null = null;
  private welcomeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly profile: Profile, readonly hooks: Hooks, readonly api: OnlineApi) {}

  private send(packet: object) { if (this.socket?.readyState !== WebSocket.OPEN) throw Error('Нет связи с сервером'); this.socket.send(JSON.stringify(packet)); }
  private async open() {
    if (this.socket) return;
    const url = new URL('/ws', location.href); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url);
    this.socket = ws;
    ws.addEventListener('message', event => {
      this.receiveQueue = this.receiveQueue.then(async () => {
        if (this.socket === ws && !this.closed) await this.receive(JSON.parse(String(event.data)));
      }).catch(error => this.hooks.error((error as Error).message));
    });
    ws.addEventListener('close', event => {
      const closed = Error(event.code === 4002 ? 'Версия игры изменилась. Обновите страницу.' : 'Соединение с сервером закрыто');
      this.completeWelcome(closed);
      this.waitError?.(closed); this.waitError = null; this.waitLobby = null;
      if (this.closed) return;
      this.connected = false;
      this.transport.diagnostics.state = 'Разрыв';
      if (event.code === 4002) { this.closed = true; this.hooks.lost('Версия игры обновилась. Обновите страницу, чтобы продолжить.'); return; }
      if (event.code === 4001 || event.code === 4003) { this.closed = true; this.hooks.lost('Сессия закрыта. Проверьте вход в аккаунт.'); return; }
      this.hooks.error('Связь потеряна. Персонаж остаётся в рейде; переподключение доступно в течение 60 секунд.');
      this.reconnect();
    });
    await new Promise<void>((resolve, reject) => { ws.addEventListener('open', () => resolve(), { once: true }); ws.addEventListener('error', () => reject(Error('Не удалось подключиться к серверу')), { once: true }); });
    this.connected = true;
    this.transport.diagnostics.state = 'Открыт';
    this.send({ type: 'HELLO', build: BUILD_VERSION, content: CONTENT_VERSION });
  }

  private reconnect() {
    if (this.closed) return;
    this.socket = null;
    const started = Date.now();
    const retry = () => {
      if (this.closed || this.connected) return;
      if (Date.now() - started > 60000) { this.hooks.lost('Связь с сервером не восстановилась. Проверьте результат в аккаунте.'); return; }
      void this.open().catch(() => setTimeout(retry, 3000));
    };
    setTimeout(retry, 1500);
  }

  private completeWelcome(value: boolean | Error) {
    const waiting = this.waitWelcome;
    if (!waiting) return;
    this.waitWelcome = null;
    if (this.welcomeTimer) clearTimeout(this.welcomeTimer);
    this.welcomeTimer = null;
    if (value instanceof Error) waiting.reject(value); else waiting.resolve(value);
  }

  private async receive(packet: Record<string, unknown>) {
    switch (packet.type) {
      case 'HELLO': if (packet.profile) this.updateProfile(packet.profile as Profile); this.completeWelcome(false); break;
      case 'PROFILE': if (packet.profile) this.updateProfile(packet.profile as Profile); break;
      case 'LOBBY': {
        this.lobby = packet.lobby as Lobby;
        this.code = String(packet.code || this.code);
        this.host = this.lobby.hostId === this.api.current?.id;
        this.hooks.lobby(this.lobby);
        this.completeWelcome(true);
        this.waitLobby?.(); this.waitLobby = null; this.waitError = null;
        break;
      }
      case 'START':
      case 'RESUME': {
        const snapshot = packet.snapshot as Snapshot;
        if (!this.starting) {
          this.starting = true;
          // A reconnect can arrive after the server has already committed the result.
          // There is no escrow to prepare in that case; the snapshot still opens results.
          const own = snapshot.players?.find(actor => actor.id === this.api.current?.id);
          if (own?.result && !this.api.current?.pending) {
            this.hooks.snapshot(snapshot);
            break;
          }
          await this.hooks.prepare(snapshot.raidId, snapshot.mapId);
          await this.hooks.started();
          this.hooks.snapshot(snapshot);
        } else this.hooks.snapshot(snapshot);
        break;
      }
      case 'SNAPSHOT': this.hooks.snapshot(packet.snapshot as Snapshot); break;
      case 'ACTION_REPLY': this.hooks.reply(packet.reply as ActionReply); break;
      case 'ERROR': {
        const error = Error(String(packet.message || 'Ошибка сервера'));
        this.completeWelcome(error);
        if (this.waitError) { this.waitError(error); this.waitError = null; this.waitLobby = null; }
        this.hooks.error(error.message); break;
      }
      case 'LEFT': this.waitLeft?.(); this.waitLeft = null; this.close(); break;
    }
  }

  private updateProfile(profile: Profile) { this.api.update(profile); this.hooks.profile(profile); }
  private waitForLobby() { return new Promise<void>((resolve, reject) => { this.waitLobby = resolve; this.waitError = reject; }); }
  async create() { await this.open(); const wait = this.waitForLobby(); this.send({ type: 'CREATE' }); await wait; return this.code; }
  async resume(): Promise<boolean> {
    const welcome = new Promise<boolean>((resolve, reject) => {
      this.waitWelcome = { resolve, reject };
      this.welcomeTimer = setTimeout(() => this.completeWelcome(Error('Сервер не ответил на восстановление отряда')), 5000);
    });
    const [, room] = await Promise.all([this.open(), welcome]);
    return room;
  }
  async join(raw: string) {
    let code = raw.trim();
    if (code.includes('#')) code = new URLSearchParams(new URL(code).hash.slice(1)).get('join') || '';
    if (!/^[a-f0-9]{16}$/i.test(code)) throw Error('Введите полный код приглашения');
    await this.open(); const wait = this.waitForLobby(); this.send({ type: 'JOIN', code }); await wait;
  }
  ready(ready: boolean) { this.send({ type: 'READY', ready }); }
  configure(mapId: string, friendlyFire: boolean) { this.send({ type: 'CONFIGURE', mapId, friendlyFire }); }
  async start() { this.send({ type: 'START' }); }
  input(input: Input) { if (this.connected && this.socket?.bufferedAmount! < 65536) this.send({ type: 'INPUT', input }); }
  action(action: Action) { this.send({ type: 'ACTION', action }); }
  tick() { this.transport.diagnostics.bufferedAmount = this.socket?.bufferedAmount || 0; }
  nextLobby() { this.starting = false; this.send({ type: 'NEXT_LOBBY' }); }
  async leave() {
    if (!this.connected) throw Error('Нет связи с сервером. Дождитесь переподключения.');
    const done = new Promise<void>((resolve, reject) => {
      this.waitLeft = resolve;
      setTimeout(() => { if (this.waitLeft === resolve) { this.waitLeft = null; reject(Error('Нет подтверждения выхода из отряда')); } }, 5000);
    });
    this.send({ type: 'LEAVE' });
    await done;
  }
  close() { this.closed = true; this.connected = false; this.socket?.close(); this.socket = null; }
}
