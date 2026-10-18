import type { Action, ActionReply, Character, Equipment, Input, Lobby, LobbyMember, Profile, Snapshot } from '../domain/types.js';
import { BUILD_VERSION, CONTENT_VERSION } from '../content/catalog.js';
import { MAPS, RAID_MAPS } from '../content/maps.js';
import { cleanName, clone, safeRecord, uid } from '../domain/util.js';
import { isAppearance } from '../content/apparel.js';
import { validateEquipment } from '../domain/profile.js';
import { World } from '../simulation/world.js';
import { Transport } from './transport.js';
interface Hooks {
    lobby: (l: Lobby) => void;
    snapshot: (s: Snapshot) => void;
    error: (s: string) => void;
    lost: (s: string) => void;
    prepare: (raidId: string, map: string) => Promise<Equipment>;
    started: () => Promise<void>;
    reply: (r: ActionReply) => void;
}
export class Session {
    readonly transport = new Transport();
    readonly sessionToken = uid();
    readonly inviteToken = uid().replaceAll('-', '');
    lobby: Lobby;
    world: World | null = null;
    host = false;
    connected = false;
    code = '';
    private hostPeer = '';
    private invite = '';
    private closed = false;
    private peers = new Map<string, {
        id: string;
        session: string;
        disconnectedAt: number;
    }>();
    private pending = new Map<string, {
        action: Action;
        at: number;
        attempts: number;
    }>();
    private lastMessage = performance.now();
    private lostAt = 0;
    private retryAt = 0;
    private beatAt = 0;
    private starting = false;
    private preparing = false;
    private loadAt = 0;
    private guestStarting = false;
    constructor(readonly profile: Profile, readonly hooks: Hooks) {
        this.lobby = { hostId: profile.id, members: [this.member(profile)], mapId: 'factory', friendlyFire: false, stage: 'lobby', raidId: '' };
        this.transport.onMessage = (p, d) => { this.receive(p, d).catch(error => this.hooks.error((error as Error).message)); };
        this.transport.onOpen = p => { if (!this.host && p === this.hostPeer)
            this.send(p, 'HELLO', { token: this.invite, session: this.sessionToken, id: profile.id, character: profile.character, gear: profile.gear, build: BUILD_VERSION, content: CONTENT_VERSION }); };
        this.transport.onClose = p => {
            if (this.closed)
                return;
            if (this.host) {
                const peer = this.peers.get(p);
                if (peer) {
                    peer.disconnectedAt = performance.now();
                    const member = this.lobby.members.find(m => m.id === peer.id);
                    if (member)
                        member.connected = false;
                    this.world?.disconnect(peer.id);
                    this.publishLobby();
                }
            }
            else if (p === this.hostPeer) {
                this.connected = false;
                if (!this.lostAt)
                    this.lostAt = performance.now();
                this.hooks.error('Канал потерян. Персонаж остаётся в рейде; пробую переподключиться до 60 секунд.');
            }
        };
        this.transport.onError = s => this.hooks.error(s);
    }
    private member(p: Profile): LobbyMember { return { id: p.id, character: clone(p.character), gear: clone(p.gear), ready: false, loaded: false, connected: true }; }
    async create() { this.host = true; await this.transport.open(); this.code = this.transport.id + '~' + this.inviteToken; this.connected = true; this.publishLobby(); return this.code; }
    async join(raw: string) {
        let code = raw.trim();
        if (code.includes('#')) {
            const u = new URL(code);
            code = new URLSearchParams(u.hash.slice(1)).get('join') || '';
        }
        const parts = code.split('~');
        if (parts.length !== 2 || !/^[a-f0-9]{32}$/.test(parts[1]))
            throw Error('Вставьте полный код или ссылку-приглашение');
        this.host = false;
        this.hostPeer = parts[0];
        this.invite = parts[1];
        this.code = code;
        await this.transport.open();
        this.lastMessage = performance.now();
        this.lostAt = performance.now();
        this.retryAt = performance.now();
        await this.transport.dial(this.hostPeer);
    }
    private send(peer: string, type: string, payload: object = {}, essential = true) { return this.transport.send(peer, { type, v: 1, payload }, essential); }
    private broadcast(type: string, payload: object = {}, essential = true) { for (const [peer, p] of this.peers) {
        const member = this.lobby.members.find(m => m.id === p.id);
        if (member?.connected)
            this.send(peer, type, payload, essential);
    } }
    private publishLobby() { this.hooks.lobby(clone(this.lobby)); if (this.host)
        this.broadcast('LOBBY', this.lobby); }
    ready(ready: boolean) { if (this.lobby.stage !== 'lobby')
        return; if (this.host) {
        this.lobby.members[0].ready = ready;
        this.publishLobby();
    }
    else
        this.send(this.hostPeer, 'READY', { ready }); }
    configure(mapId: string, friendlyFire: boolean) { if (!this.host || this.lobby.stage !== 'lobby' || !RAID_MAPS.some(m => m.id === mapId))
        return; this.lobby.mapId = mapId; this.lobby.friendlyFire = friendlyFire; for (const m of this.lobby.members)
        m.ready = false; this.publishLobby(); }
    async start() {
        if (!this.host || this.lobby.stage !== 'lobby')
            return;
        if (!this.lobby.members.every(m => m.connected && m.ready))
            throw Error('Все участники должны подтвердить готовность');
        this.lobby.stage = 'loading';
        this.lobby.raidId = uid();
        for (const m of this.lobby.members)
            m.loaded = false;
        this.loadAt = performance.now();
        this.publishLobby();
        this.broadcast('LOAD', { raidId: this.lobby.raidId, mapId: this.lobby.mapId });
        const gear = await this.hooks.prepare(this.lobby.raidId, this.lobby.mapId);
        this.lobby.members[0].gear = gear;
        this.lobby.members[0].loaded = true;
        await this.maybeLaunch();
    }
    private async maybeLaunch() {
        this.publishLobby();
        if (this.starting || this.lobby.stage !== 'loading' || !this.lobby.members.every(m => m.loaded && m.connected))
            return;
        this.starting = true;
        try {
            const map = MAPS[this.lobby.mapId];
            this.world = new World(map, this.lobby.raidId, this.lobby.friendlyFire);
            for (const m of this.lobby.members)
                this.world.addPlayer(m.id, m.character, m.gear);
            await this.hooks.started();
            this.lobby.stage = 'raid';
            this.publishLobby();
            const snapshot = this.world.snapshot();
            this.broadcast('START', snapshot);
            this.hooks.snapshot(snapshot);
        }
        finally {
            this.starting = false;
        }
    }
    input(input: Input) { if (this.host)
        this.world?.input(this.profile.id, input);
    else if (this.connected)
        this.send(this.hostPeer, 'INPUT', input, false); }
    action(action: Action) { if (this.host) {
        const reply = this.world?.action(this.profile.id, action);
        if (reply)
            this.hooks.reply(reply);
    }
    else {
        this.pending.set(action.id, { action, at: performance.now(), attempts: 1 });
        this.send(this.hostPeer, 'ACTION', action);
    } }
    tick() {
        if (this.closed)
            return;
        const now = performance.now();
        if (this.host && this.world && this.lobby.stage === 'raid') {
            this.world.step();
            if (this.world.tick % 3 === 0) {
                const snap = this.world.snapshot();
                this.hooks.snapshot(snap);
                this.broadcast('SNAPSHOT', snap, false);
            }
        }
        if (now - this.beatAt > 1000) {
            this.beatAt = now;
            if (this.host)
                this.broadcast('PING', { at: now });
            else if (this.connected)
                this.send(this.hostPeer, 'PING', { at: now });
            for (const item of this.pending.values())
                if (now - item.at > 2000) {
                    if (item.attempts >= 6) {
                        this.pending.delete(item.action.id);
                        this.hooks.reply({ id: item.action.id, ok: false, message: 'Нет подтверждения действия. После восстановления связи проверьте инвентарь.' });
                    }
                    else {
                        item.at = now;
                        item.attempts++;
                        this.send(this.hostPeer, 'ACTION', item.action);
                    }
                }
            if (this.host) {
                for (const [peer, info] of this.peers)
                    if (info.disconnectedAt && now - info.disconnectedAt > 60000) {
                        const a = this.world?.players.get(info.id);
                        if (a?.status === 'active')
                            this.world!.finish(a, 'missing');
                        if (this.lobby.stage === 'lobby')
                            this.lobby.members = this.lobby.members.filter(m => m.id !== info.id);
                        this.peers.delete(peer);
                        this.publishLobby();
                    }
            }
        }
        if (this.host && this.lobby.stage === 'loading' && now - this.loadAt > 35000) {
            this.broadcast('CLOSED', { reason: 'Не все участники загрузили карту. Предрейдовые вещи восстановлены.' });
            this.close();
            this.hooks.lost('Загрузка отряда не завершилась. Предрейдовая экипировка восстановлена.');
        }
        if (!this.host) {
            if (this.connected && now - this.lastMessage > 16000) {
                this.connected = false;
                this.lostAt = now;
                this.hooks.error('Хозяин не отвечает. Пытаюсь восстановить соединение.');
            }
            if (!this.connected && this.lostAt) {
                if (now - this.lostAt > 60000) {
                    this.close();
                    this.hooks.lost('Связь с хозяином не восстановилась. Возвращена только предрейдовая экипировка, без собранной добычи.');
                }
                else if (now - this.retryAt > 7000) {
                    this.retryAt = now;
                    this.transport.dial(this.hostPeer).catch(e => this.hooks.error((e as Error).message));
                }
            }
        }
    }
    private async receive(peer: string, message: Record<string, unknown>) {
        if (message.v !== 1 || !safeRecord(message.payload))
            return;
        const p = message.payload;
        const type = String(message.type);
        if (this.host) {
            if (type === 'HELLO') {
                if (p.token !== this.inviteToken) {
                    this.send(peer, 'REJECT', { reason: 'Неверный или устаревший токен приглашения' });
                    return;
                }
                if (p.build !== BUILD_VERSION || p.content !== CONTENT_VERSION) {
                    this.send(peer, 'REJECT', { reason: 'Версии игры или каталога различаются. Откройте одну и ту же сборку.' });
                    return;
                }
                if (typeof p.id !== 'string' || p.id.length > 80 || p.id === this.profile.id || typeof p.session !== 'string' || p.session.length > 80 || !safeRecord(p.character))
                    return;
                const existing = this.peers.get(peer);
                if (existing && existing.session !== p.session) {
                    this.send(peer, 'REJECT', { reason: 'Эта сессия уже занята' });
                    return;
                }
                const member = this.lobby.members.find(m => m.id === p.id);
                if (member && !existing) {
                    this.send(peer, 'REJECT', { reason: 'Этот персонаж уже находится в отряде' });
                    return;
                }
                if (!existing && (this.lobby.members.length >= 2 || this.lobby.stage !== 'lobby')) {
                    this.send(peer, 'REJECT', { reason: this.lobby.members.length >= 2 ? 'В отряде уже два игрока' : 'Рейд уже начался' });
                    return;
                }
                const c = p.character as unknown as Character;
                cleanName(c.name);
                if (!['BEAR', 'USEC'].includes(c.faction) || !Number.isInteger(c.face) || c.face < 0 || c.face >= 12 || !Number.isInteger(c.outfit) || c.outfit < 0 || c.outfit >= 12)
                    return;
                if (c.appearance !== undefined && !isAppearance(c.appearance)) return;
                const gear = p.gear as unknown as Equipment;
                validateEquipment(gear);
                if (!gear.primary && !gear.secondary) {
                    this.send(peer, 'REJECT', { reason: 'Возьмите оружие перед подключением' });
                    return;
                }
                this.peers.set(peer, { id: p.id, session: p.session, disconnectedAt: 0 });
                if (member)
                    member.connected = true;
                else
                    this.lobby.members.push({ id: p.id, character: clone(c), gear: clone(gear), ready: false, loaded: false, connected: true });
                this.send(peer, 'ACCEPT', { resumed: !!existing });
                this.publishLobby();
                if (this.world && this.lobby.stage === 'raid')
                    this.send(peer, 'RESUME', this.world.snapshot());
                return;
            }
            const info = this.peers.get(peer);
            if (!info)
                return;
            const m = this.lobby.members.find(m => m.id === info.id);
            if (!m)
                return;
            if (type === 'READY' && this.lobby.stage === 'lobby') {
                m.ready = p.ready === true;
                this.publishLobby();
            }
            else if (type === 'LOADED' && this.lobby.stage === 'loading' && p.raidId === this.lobby.raidId) {
                const gear = p.gear as unknown as Equipment;
                validateEquipment(gear);
                m.gear = clone(gear);
                m.loaded = true;
                await this.maybeLaunch();
            }
            else if (type === 'INPUT' && this.lobby.stage === 'raid')
                this.world?.input(info.id, p as unknown as Input);
            else if (type === 'ACTION' && this.lobby.stage === 'raid') {
                const result = this.world?.action(info.id, p as unknown as Action);
                if (result)
                    this.send(peer, 'ACTION_REPLY', result);
            }
            else if (type === 'PING')
                this.send(peer, 'PONG', { at: p.at });
            else if (type === 'LEAVE') {
                const a = this.world?.players.get(info.id);
                if (a?.status === 'active')
                    this.world!.finish(a, 'missing');
                this.lobby.members = this.lobby.members.filter(m => m.id !== info.id);
                this.peers.delete(peer);
                this.transport.remove(peer);
                this.publishLobby();
            }
        }
        else if (peer === this.hostPeer) {
            this.lastMessage = performance.now();
            if (type === 'REJECT') {
                this.close();
                this.hooks.lost(String(p.reason || 'Соединение отклонено'));
            }
            else if (type === 'ACCEPT') {
                this.connected = true;
                this.lostAt = 0;
            }
            else if (type === 'LOBBY') {
                if (!Array.isArray(p.members) || p.members.length > 2 || typeof p.mapId !== 'string' || !MAPS[p.mapId])
                    return;
                this.lobby = p as unknown as Lobby;
                this.hooks.lobby(clone(this.lobby));
            }
            else if (type === 'LOAD' && !this.preparing) {
                if (typeof p.raidId !== 'string' || typeof p.mapId !== 'string' || !MAPS[p.mapId])
                    return;
                this.preparing = true;
                try {
                    const gear = await this.hooks.prepare(p.raidId, p.mapId);
                    this.send(peer, 'LOADED', { raidId: p.raidId, gear });
                }
                finally {
                    this.preparing = false;
                }
            }
            else if (type === 'START' || type === 'RESUME' || type === 'SNAPSHOT') {
                if (!Array.isArray(p.players) || p.players.length > 2 || !Array.isArray(p.bots) || p.bots.length > 20 || !Array.isArray(p.containers) || p.containers.length > 300 || p.raidId !== this.lobby.raidId || typeof p.tick !== 'number')
                    return;
                if ((type === 'START' || type === 'RESUME') && !this.guestStarting) {
                    this.guestStarting = true;
                    try {
                        await this.hooks.started();
                    }
                    finally {
                        this.guestStarting = false;
                    }
                }
                this.hooks.snapshot(p as unknown as Snapshot);
            }
            else if (type === 'ACTION_REPLY') {
                const reply = p as unknown as ActionReply;
                this.pending.delete(reply.id);
                this.hooks.reply(reply);
            }
            else if (type === 'PING')
                this.send(peer, 'PONG', { at: p.at });
            else if (type === 'CLOSED') {
                this.close();
                this.hooks.lost(String(p.reason || 'Хозяин закрыл отряд'));
            }
        }
    }
    nextLobby() { if (!this.host || !this.world || [...this.world.players.values()].some(a => a.status === 'active'))
        throw Error('Дождитесь завершения рейда напарником'); this.world = null; this.lobby.stage = 'lobby'; for (const m of this.lobby.members) {
        m.ready = false;
        m.loaded = false;
    } this.publishLobby(); }
    leave() { if (this.host)
        this.broadcast('CLOSED', { reason: 'Хозяин закрыл отряд. Для незавершённого рейда применяется техническое восстановление.' });
    else
        this.send(this.hostPeer, 'LEAVE'); this.close(); }
    close() { this.closed = true; this.transport.close(); this.connected = false; }
}
