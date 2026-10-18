import type { Profile, Settings } from '../domain/types.js';
import { migrateProfile } from '../domain/migration.js';
import { validateProfile } from '../domain/profile.js';
import { check, uid, safeRecord } from '../domain/util.js';
import { PATCH_LIMIT, PATCH_OUTPUT_BYTES, isPatchId, selectedPatches, type PatchInfo } from '../domain/patches.js';
import { base64Blob, blobBase64, normalizePatchImage, patchHash } from './patch-images.js';
interface StoredPatch extends PatchInfo { blob: Blob }
const DB = 'reid-save-v1';
export class Store {
    private db: IDBDatabase | null = null;
    private revision: number | null = null;
    private unlock: (() => void) | null = null;
    private leaseTimer = 0;
    private writes: Promise<void> = Promise.resolve();
    private opening = false;
    private ownsLease: (() => boolean) | null = null;
    async open(): Promise<Profile | null> {
        check(!this.db && !this.opening, 'Хранилище уже открыто');
        this.opening = true;
        try {
        if (navigator.locks) {
            await new Promise<void>((resolve, reject) => { navigator.locks.request('reid-profile-exclusive', { ifAvailable: true }, async (lock) => { if (!lock) {
                reject(Error('Этот профиль уже открыт в другой вкладке. Закройте её и обновите страницу.'));
                return;
            } this.ownsLease = () => true; resolve(); await new Promise<void>(r => { this.unlock = r; }); }).catch(reject); });
        }
        else {
            const key = 'reid-lease', owner = uid(), read = (): { owner: string; time: number } | null => {
                try {
                    const lease: unknown = JSON.parse(localStorage.getItem(key) || 'null');
                    return safeRecord(lease) && typeof lease.owner === 'string' && typeof lease.time === 'number' && Number.isFinite(lease.time) ? { owner: lease.owner, time: lease.time } : null;
                } catch { return null; }
            };
            const old = read();
            if (old && Date.now() - old.time < 12000)
                throw Error('Профиль занят другой вкладкой');
            localStorage.setItem(key, JSON.stringify({ owner, time: Date.now() }));
            await new Promise(r => setTimeout(r, 80));
            if (read()?.owner !== owner)
                throw Error('Профиль открыт в другой вкладке');
            this.ownsLease = () => read()?.owner === owner;
            this.leaseTimer = window.setInterval(() => { if (read()?.owner !== owner) {
                location.reload();
                return;
            } localStorage.setItem(key, JSON.stringify({ owner, time: Date.now() })); }, 4000);
            this.unlock = () => { clearInterval(this.leaseTimer); if (read()?.owner === owner)
                localStorage.removeItem(key); };
        }
        this.db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(DB, 2); let blocked = false; r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('state')) r.result.createObjectStore('state'); if (!r.result.objectStoreNames.contains('backups')) r.result.createObjectStore('backups', { autoIncrement: true }); if (!r.result.objectStoreNames.contains('patches')) r.result.createObjectStore('patches', { keyPath: 'id' }); }; r.onsuccess = () => { if (blocked) r.result.close(); else resolve(r.result); }; r.onblocked = () => { blocked = true; reject(Error('Другая вкладка блокирует открытие сохранения. Закройте её и обновите страницу.')); }; r.onerror = () => reject(Error('IndexedDB недоступна: ' + r.error?.message)); });
        this.db.onversionchange = () => this.close();
        const db = this.db;
        const p = await new Promise<Profile | null>((resolve, reject) => { const tx = db.transaction('state'), r = tx.objectStore('state').get('profile'); r.onsuccess = () => resolve(r.result || null); r.onerror = () => reject(r.error); tx.onabort = () => reject(tx.error || Error('Не удалось прочитать профиль')); });
        this.revision = p?.revision ?? null;
        if (!p) return null;
        const migration = migrateProfile(p);
        if (migration.changed) await this.save(migration.profile, true);
        return migration.profile;
        } catch (error) {
            this.close();
            throw error;
        } finally { this.opening = false; }
    }
    async save(p: Profile, replace = false, media: StoredPatch[] = []): Promise<void> {
        validateProfile(p);
        // Capture the validated state before awaiting anything. Callers may mutate their copy.
        const snapshot = structuredClone(p), db = this.db;
        check(db, 'Хранилище не открыто');
        const run = this.writes.then(async () => {
            check(this.db === db && this.ownsLease?.(), 'Профиль открыт в другой вкладке или хранилище закрыто');
            const expected = this.revision;
            await new Promise<void>((resolve, reject) => {
            const hashes = selectedPatches(snapshot.character.patches);
            const tx = db.transaction(['state', 'backups', ...(hashes.length || media.length ? ['patches'] : [])], 'readwrite'), s = tx.objectStore('state');
            let ownError: Error | undefined;
            const r = s.get('profile');
            r.onsuccess = () => {
                try {
                    const old = r.result as Profile | undefined;
                    check((old?.revision ?? null) === expected, 'Сохранение изменилось в другой вкладке. Обновите страницу.');
                    if (!replace && old) {
                        check(snapshot.id === old.id && snapshot.revision >= old.revision, 'Устаревший профиль не может заменить более новое сохранение');
                        check(snapshot.revision !== old.revision || JSON.stringify(snapshot) === JSON.stringify(old), 'Изменение профиля требует новой ревизии');
                    }
                    if (replace && old) tx.objectStore('backups').add({ saved: Date.now(), profile: old });
                    const put = () => s.put(snapshot, 'profile');
                    if (hashes.length) {
                        const patches = tx.objectStore('patches');
                        const writeMedia = () => {
                            for (const entry of media) patches.put(entry);
                            let remaining = hashes.length;
                            for (const id of hashes) {
                                const request = patches.get(id);
                                request.onsuccess = () => {
                                    if (!request.result) { ownError = Error('Патч отсутствует в локальной библиотеке'); tx.abort(); return; }
                                    if (!--remaining) put();
                                };
                            }
                        };
                        if (media.length) {
                            const existing = patches.getAll(); existing.onsuccess = () => {
                                const ids = new Set((existing.result as StoredPatch[]).map(entry => entry.id));
                                if (ids.size + media.filter(entry => !ids.has(entry.id)).length > PATCH_LIMIT) { ownError = Error('В библиотеке уже 20 патчей. Удалите неиспользуемый'); tx.abort(); }
                                else writeMedia();
                            };
                        } else writeMedia();
                    } else put();
                } catch (error) {
                    ownError = error instanceof Error ? error : Error('Не удалось сохранить профиль');
                    tx.abort();
                }
            };
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(ownError || Error('Не удалось сохранить профиль: ' + (tx.error?.message || 'недостаточно места')));
            tx.onerror = () => reject(tx.error);
            });
            if (this.db === db) this.revision = snapshot.revision;
        });
        this.writes = run.catch(() => { });
        await run;
    }
    async export(p: Profile): Promise<string> {
        validateProfile(p); const payload = JSON.stringify(p), checksum = await digest(payload), media: { id: string; png: string }[] = [];
        for (const id of selectedPatches(p.character.patches)) {
            const blob = await this.patch(id); check(blob, 'Патч отсутствует в локальной библиотеке');
            media.push({ id, png: await blobBase64(blob) });
        }
        return JSON.stringify({ format: 'REID_PROFILE', schema: 3, checksum, payload, ...(media.length ? { media } : {}) }, null, 2);
    }
    async import(text: string): Promise<Profile> {
        check(text.length < 3000000, 'Файл профиля слишком большой'); const envelope: unknown = JSON.parse(text);
        check(safeRecord(envelope) && envelope.format === 'REID_PROFILE' && typeof envelope.schema === 'number' && [1, 2, 3].includes(envelope.schema) && typeof envelope.payload === 'string' && envelope.payload.length < 2000000, 'Неподдерживаемый файл профиля');
        check(await digest(envelope.payload) === envelope.checksum, 'Контрольная сумма не совпадает');
        const raw: unknown = JSON.parse(envelope.payload); check(safeRecord(raw) && raw.schema === envelope.schema, 'Версия профиля не совпадает с версией файла');
        const { profile } = migrateProfile(raw), hashes = selectedPatches(profile.character.patches), media: StoredPatch[] = [];
        if (envelope.media !== undefined) {
            check(Array.isArray(envelope.media) && envelope.media.length <= 2, 'Повреждены изображения профиля');
            for (const entry of envelope.media) {
                check(safeRecord(entry) && isPatchId(entry.id) && hashes.includes(entry.id) && typeof entry.png === 'string' && !media.some(patch => patch.id === entry.id), 'Повреждено изображение патча');
                const blob = base64Blob(entry.png);
                check(blob.size <= PATCH_OUTPUT_BYTES && await patchHash(blob) === entry.id, 'Контрольная сумма патча не совпадает');
                const head = new DataView(await blob.slice(0, 24).arrayBuffer());
                check(head.byteLength === 24 && head.getUint32(0) === 0x89504e47 && head.getUint32(4) === 0x0d0a1a0a && head.getUint32(16) === 256 && head.getUint32(20) === 256, 'Неверный формат патча');
                // Imported media is already canonical and hash-addressed. Reject
                // metadata rather than retaining it or silently changing its ID.
                await normalizePatchImage(blob, true);
                media.push({ id: entry.id, blob, bytes: blob.size, createdAt: Date.now() });
            }
        }
        await this.save(profile, true, media); return profile;
    }
    private patchRequest<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
        const db = this.db; check(db && this.ownsLease?.(), 'Хранилище не открыто');
        return new Promise((resolve, reject) => {
            const tx = db.transaction('patches', mode), request = run(tx.objectStore('patches'));
            tx.oncomplete = () => resolve(request.result);
            tx.onabort = () => reject(tx.error || Error('Не удалось сохранить патч'));
            tx.onerror = () => reject(tx.error || Error('Не удалось прочитать патч'));
        });
    }
    async patches(): Promise<PatchInfo[]> { return (await this.patchRequest<StoredPatch[]>('readonly', store => store.getAll())).map(({ id, bytes, createdAt }) => ({ id, bytes, createdAt })); }
    async patch(id: string): Promise<Blob | null> { if (!isPatchId(id)) return null; return (await this.patchRequest<StoredPatch | undefined>('readonly', store => store.get(id)))?.blob || null; }
    async addPatch(blob: Blob): Promise<PatchInfo> {
        const id = await patchHash(blob), entry: StoredPatch = { id, blob, bytes: blob.size, createdAt: Date.now() };
        check(blob.type === 'image/png' && blob.size <= PATCH_OUTPUT_BYTES, 'Неверный формат патча');
        const db = this.db; check(db && this.ownsLease?.(), 'Хранилище не открыто');
        return new Promise((resolve, reject) => {
            const tx = db.transaction('patches', 'readwrite'), store = tx.objectStore('patches'), existing = store.get(id); let ownError: Error | undefined;
            existing.onsuccess = () => {
                if (existing.result) { entry.createdAt = existing.result.createdAt; return; }
                const count = store.count(); count.onsuccess = () => {
                    if (count.result >= PATCH_LIMIT) { ownError = Error('В библиотеке уже 20 патчей. Удалите неиспользуемый'); tx.abort(); }
                    else store.put(entry);
                };
            };
            tx.oncomplete = () => resolve({ id, bytes: blob.size, createdAt: entry.createdAt });
            tx.onabort = () => reject(ownError || tx.error || Error('Не удалось сохранить патч'));
            tx.onerror = () => reject(tx.error || Error('Не удалось сохранить патч'));
        });
    }
    async deletePatch(id: string): Promise<void> {
        check(isPatchId(id), 'Неверный патч');
        const db = this.db; check(db && this.ownsLease?.(), 'Хранилище не открыто');
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(['state', 'patches'], 'readwrite'), request = tx.objectStore('state').get('profile'); let ownError: Error | undefined;
            request.onsuccess = () => {
                const profile = request.result as Profile | undefined;
                if (profile?.pending || selectedPatches(profile?.character.patches).includes(id)) { ownError = Error('Сначала снимите патч, завершите рейд и сохраните внешний вид'); tx.abort(); }
                else tx.objectStore('patches').delete(id);
            };
            tx.oncomplete = () => resolve(); tx.onabort = () => reject(ownError || tx.error); tx.onerror = () => reject(tx.error);
        });
    }
    close() { this.db?.close(); this.db = null; this.revision = null; this.ownsLease = null; const release = this.unlock; this.unlock = null; release?.(); }
}
async function digest(s: string): Promise<string> { const bytes = new TextEncoder().encode(s); if (!crypto.subtle)
    throw Error('Для экспорта нужен HTTPS или localhost'); const result = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(result)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export const DEFAULT_SETTINGS: Settings = { sensitivity: .0022, fov: 78, volume: .42, effects: .7, voices: false, bob: true, quality: 'high', bindings: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', crouch: 'ControlLeft', jump: 'Space', reload: 'KeyR', interact: 'KeyF', inventory: 'Tab', primary: 'Digit1', secondary: 'Digit2', heal: 'Digit4', bandage: 'Digit5', food: 'Digit6', splint: 'Digit7', light: 'KeyL', laser: 'KeyK', map: 'KeyM', 'fire-mode': 'KeyB', inspect: 'KeyI', cancel: 'KeyX', slow: 'KeyC' } };
/** Settings are untrusted persisted input. Corruption must not poison the render matrix. */
export function normalizeSettings(raw: unknown): Settings {
    const out = structuredClone(DEFAULT_SETTINGS);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    const s = raw as Record<string, unknown>;
    for (const [key, lo, hi] of [['sensitivity',.0006,.006],['fov',60,100],['volume',0,1],['effects',0,1]] as const) {
        const v=s[key]; if(typeof v==='number' && Number.isFinite(v)) out[key]=Math.min(hi,Math.max(lo,v));
    }
    for(const key of ['voices','bob'] as const) if(typeof s[key]==='boolean')out[key]=s[key];
    if(s.quality==='high'||s.quality==='low')out.quality=s.quality;
    if(s.bindings && typeof s.bindings==='object' && !Array.isArray(s.bindings)) {
        const bindings=s.bindings as Record<string,unknown>, candidate={...out.bindings};
        for(const key of Object.keys(candidate)) {
            const v=bindings[key];
            if(typeof v==='string' && v.length<=32 && /^[A-Za-z][A-Za-z0-9]*$/.test(v) && v!=='Escape')candidate[key]=v;
        }
        if (bindings.splint === undefined) {
            const occupied = new Set(Object.entries(candidate).filter(([key]) => key !== 'splint').map(([, value]) => value));
            if (occupied.has(candidate.splint)) {
                const spare = ['Digit7', 'Digit8', 'Digit9', 'Digit0', ...Array.from({ length: 26 }, (_, i) => 'Key' + String.fromCharCode(65 + i))].find(code => !occupied.has(code));
                if (spare) candidate.splint = spare;
            }
        }
        // Conflicting corrupted/legacy assignments get one complete, usable default layout.
        if(new Set(Object.values(candidate)).size===Object.keys(candidate).length)out.bindings=candidate;
    }
    return out;
}
export function loadSettings(): Settings {
    try { return normalizeSettings(JSON.parse(localStorage.getItem('reid-settings') || 'null')); }
    catch { return structuredClone(DEFAULT_SETTINGS); }
}
export function saveSettings(settings: Settings) { localStorage.setItem('reid-settings', JSON.stringify(normalizeSettings(settings))); }
export function downloadText(text: string, name: string) { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
