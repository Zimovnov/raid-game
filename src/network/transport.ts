import { safeRecord, uid } from '../domain/util.js';
interface Signal {
    type: string;
    src?: string;
    dst?: string;
    payload?: {
        sdp?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
        connectionId?: string;
        type?: string;
    };
}
interface Link {
    pc: RTCPeerConnection;
    channel: RTCDataChannel | null;
    connectionId: string;
    candidates: RTCIceCandidateInit[];
    lastMessage: number;
    rate: number;
    rateAt: number;
}
export interface NetworkConfig {
    signalUrl: string;
    iceServers: RTCIceServer[];
}
export async function networkConfig(): Promise<NetworkConfig> {
    const r = await fetch('./network-config.json', { cache: 'no-store' });
    if (!r.ok)
        throw Error('Не найден network-config.json');
    const c = await r.json() as NetworkConfig;
    if (new URLSearchParams(location.search).get('signal') === 'local') {
        c.signalUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/peerjs`;
        c.iceServers = [];
    }
    return c;
}
/** Native WebRTC. The WebSocket server only forwards offers and ICE candidates; game state never travels over it. */
export class Transport {
    id = 'reid-' + uid().replaceAll('-', '');
    private ws: WebSocket | null = null;
    private links = new Map<string, Link>();
    private timer = 0;
    private closed = false;
    private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
    private config: NetworkConfig | null = null;
    onOpen: (peer: string) => void = () => { };
    onClose: (peer: string) => void = () => { };
    onMessage: (peer: string, data: Record<string, unknown>) => void = () => { };
    onError: (message: string) => void = () => { };
    diagnostics = { signaling: 'не подключено', state: 'нет соединения', rtt: 0, bufferedAmount: 0, received: 0, sent: 0, route: 'неизвестно', ice: 'new' };
    async open() {
        this.config = await networkConfig();
        if (!globalThis.RTCPeerConnection)
            throw Error('В этом браузере нет WebRTC');
        await new Promise<void>((resolve, reject) => {
            const url = new URL(this.config!.signalUrl);
            url.searchParams.set('key', 'peerjs');
            url.searchParams.set('id', this.id);
            url.searchParams.set('token', uid());
            url.searchParams.set('version', '1.5.5');
            const ws = new WebSocket(url);
            this.ws = ws;
            let ready = false;
            const timeout = window.setTimeout(() => { ws.close(); reject(Error('Сигнализация не отвечает. Одиночный режим доступен; проверьте сеть или адрес PeerServer.')); }, 12000);
            ws.onmessage = e => { try {
                if (typeof e.data !== 'string' || e.data.length > 180000)
                    return;
                const msg = JSON.parse(e.data) as Signal;
                if (msg.type === 'OPEN') {
                    ready = true;
                    clearTimeout(timeout);
                    this.diagnostics.signaling = 'доступна';
                    resolve();
                }
                else if (['ERROR', 'ID-TAKEN', 'INVALID-KEY'].includes(msg.type)) {
                    clearTimeout(timeout);
                    reject(Error('Сигнализация отклонила подключение: ' + msg.type));
                }
                else if (msg.type === 'EXPIRE') {
                    this.onError('Отряд не найден или хозяин уже вышел.');
                }
                else
                    this.handleSignal(msg).catch(error => this.onError((error as Error).message));
            }
            catch {
                this.onError('Некорректный ответ сигнализации');
            } };
            ws.onerror = () => { if (!ready) {
                clearTimeout(timeout);
                reject(Error('Не удалось подключиться к серверу сигнализации. Проверьте интернет или выберите одиночный режим.'));
            } };
            ws.onclose = () => { this.diagnostics.signaling = 'отключена'; if (!ready) {
                clearTimeout(timeout);
                reject(Error('Сервер сигнализации закрыл соединение'));
            }
            else if (!this.closed)
                this.onError('Сигнализация отключилась. Уже установленный канал WebRTC может продолжать работу.'); };
        });
        this.timer = window.setInterval(() => { this.signal({ type: 'HEARTBEAT' }); for (const link of this.links.values()) {
            this.diagnostics.bufferedAmount = link.channel?.bufferedAmount || 0;
            link.pc.getStats().then(stats => { stats.forEach(s => { if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated) {
                this.diagnostics.rtt = Math.round((s.currentRoundTripTime || 0) * 1000);
                const local = stats.get(s.localCandidateId);
                this.diagnostics.route = local?.candidateType === 'relay' ? 'TURN relay' : 'прямой WebRTC';
            } }); }).catch(() => { });
        } }, 5000);
    }
    private signal(s: Signal) { if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify(s)); }
    private createLink(peer: string, connectionId: string): Link {
        this.remove(peer, false);
        const pc = new RTCPeerConnection({ iceServers: this.config?.iceServers || [] });
        const link: Link = { pc, channel: null, connectionId, candidates: this.pendingCandidates.get(peer) || [], lastMessage: performance.now(), rate: 0, rateAt: performance.now() };
        this.pendingCandidates.delete(peer);
        this.links.set(peer, link);
        pc.onicecandidate = e => { if (e.candidate)
            this.signal({ type: 'CANDIDATE', dst: peer, payload: { candidate: e.candidate.toJSON(), connectionId, type: 'data' } }); };
        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete' && !pc.localDescription?.sdp.includes('a=candidate:')) {
                this.diagnostics.ice = 'no-candidates';
                this.onError('Браузер не получил ICE-кандидаты. Проверьте сетевые ограничения браузера или настройки разрешённого TURN-сервера. Одиночный режим доступен.');
            }
        };
        pc.ondatachannel = e => { if (e.channel.label !== 'reid') { e.channel.close(); return; } this.bind(peer, e.channel); };
        pc.onconnectionstatechange = () => { this.diagnostics.state = pc.connectionState; this.diagnostics.ice = pc.iceConnectionState; if (pc.connectionState === 'failed' || pc.connectionState === 'closed')
            this.remove(peer, true); };
        return link;
    }
    async dial(peer: string) { if (!/^reid-[a-f0-9]{32}$/.test(peer))
        throw Error('Неверный код отряда'); const link = this.createLink(peer, 'dc_' + uid()); this.bind(peer, link.pc.createDataChannel('reid', { ordered: true })); const offer = await link.pc.createOffer(); await link.pc.setLocalDescription(offer); this.signal({ type: 'OFFER', dst: peer, payload: { sdp: offer, connectionId: link.connectionId, type: 'data' } }); }
    private async handleSignal(s: Signal) {
        const peer = s.src;
        if (!peer || !/^reid-[a-f0-9]{32}$/.test(peer))
            return;
        const payload = s.payload;
        if (!payload)
            return;
        if (s.type === 'OFFER' && payload.sdp) {
            if (this.links.size >= 3 && !this.links.has(peer))
                return;
            const link = this.createLink(peer, payload.connectionId || uid());
            await link.pc.setRemoteDescription(payload.sdp);
            for (const c of link.candidates)
                await link.pc.addIceCandidate(c).catch(() => { });
            link.candidates = [];
            const answer = await link.pc.createAnswer();
            await link.pc.setLocalDescription(answer);
            this.signal({ type: 'ANSWER', dst: peer, payload: { sdp: answer, connectionId: link.connectionId, type: 'data' } });
        }
        else if (s.type === 'ANSWER' && payload.sdp) {
            const link = this.links.get(peer);
            if (!link || payload.connectionId !== link.connectionId)
                return;
            await link.pc.setRemoteDescription(payload.sdp);
            for (const c of link.candidates)
                await link.pc.addIceCandidate(c).catch(() => { });
            link.candidates = [];
        }
        else if (s.type === 'CANDIDATE' && payload.candidate) {
            const link = this.links.get(peer);
            if (!link) {
                if (!this.pendingCandidates.has(peer) && this.pendingCandidates.size >= 8) return;
                const list = this.pendingCandidates.get(peer) || [];
                if (list.length < 50)
                    list.push(payload.candidate);
                this.pendingCandidates.set(peer, list);
                return;
            }
            if (payload.connectionId !== link.connectionId) return;
            if (link.pc.remoteDescription)
                await link.pc.addIceCandidate(payload.candidate).catch(() => { });
            else if (link.candidates.length < 50)
                link.candidates.push(payload.candidate);
        }
        else if (s.type === 'LEAVE')
            this.remove(peer, true);
    }
    private bind(peer: string, channel: RTCDataChannel) {
        const link = this.links.get(peer)!;
        link.channel = channel;
        channel.bufferedAmountLowThreshold = 65536;
        channel.onopen = () => { this.diagnostics.state = 'connected'; this.onOpen(peer); };
        channel.onclose = () => { if (this.links.get(peer) === link)
            this.remove(peer, true); };
        channel.onmessage = e => { if (typeof e.data !== 'string' || e.data.length > 256000) {
            this.remove(peer, true);
            return;
        } const now = performance.now(); if (now - link.rateAt > 1000) {
            link.rate = 0;
            link.rateAt = now;
        } if (++link.rate > 140) {
            this.remove(peer, true);
            return;
        } try {
            const data: unknown = JSON.parse(e.data);
            if (!safeRecord(data) || typeof data.type !== 'string')
                return;
            link.lastMessage = now;
            this.diagnostics.received++;
            this.onMessage(peer, data);
        }
        catch {
            this.onError('Отклонён повреждённый сетевой пакет');
        } };
    }
    send(peer: string, data: object, essential = true): boolean { const ch = this.links.get(peer)?.channel; if (ch?.readyState !== 'open')
        return false; const text = JSON.stringify(data); if (text.length > 256000)
        return false; if (ch.bufferedAmount > (essential ? 1024 * 1024 : 180000))
        return false; try {
        ch.send(text);
        this.diagnostics.sent++;
        return true;
    }
    catch {
        return false;
    } }
    remove(peer: string, notify = false) { const link = this.links.get(peer); if (!link)
        return; this.links.delete(peer); link.pc.onconnectionstatechange = null; link.pc.onicegatheringstatechange = null; link.pc.onicecandidate = null; if (link.channel) {
        link.channel.onclose = null;
        link.channel.close();
    } link.pc.close(); if (notify)
        this.onClose(peer); }
    close() { this.closed = true; clearInterval(this.timer); for (const p of [...this.links.keys()])
        this.remove(p); this.ws?.close(); this.pendingCandidates.clear(); }
}
