import { WORKSHOP_PRESETS } from './content/presets.js';
import { APPEARANCE_PRESETS, defaultAppearance, normalizeAppearance, type Appearance } from './content/apparel.js';
import type { Action, ActionReply, Character, Item, Profile, RaidResult, Snapshot, Vec3 } from './domain/types.js';
import { feedRounds, setLoadedRounds, availableRounds } from './domain/ammunition.js';
import { CATALOG, QUESTS } from './content/catalog.js';
import { MAPS } from './content/maps.js';
import { calculateStats, createWeapon, fromPreset, getSlots, presetOf, replacePreview } from './domain/items.js';
import { activateRaid, applyBuild, applyResult, buy, prepareMagazine, emergencyKit, moveItem, newProfile, saveAppearance, prepareRaid, questAction, quoteBuild, recovery, sell, splitStack, transaction } from './domain/profile.js';
import { clamp, clone, direction, dist, dot, norm, sub, uid, viewedActor } from './domain/util.js';
import { Renderer } from './rendering/renderer.js';
import { Collision } from './simulation/collision.js';
import { World } from './simulation/world.js';
import { Store, downloadText, loadSettings, saveSettings } from './persistence/store.js';
import { Session } from './network/session.js';
import { DedicatedSession } from './network/dedicated-session.js';
import { OnlineApi, type ProfileCommand } from './network/online-api.js';
import { AudioEngine } from './audio/audio.js';
import { Controls } from './ui/input.js';
import { DialogFocus } from './ui/dialog-focus.js';
import { screen, raidOverlay, type ViewModel } from './ui/views.js';
import { wardrobeEquipment } from './ui/wardrobe.js';
import { PATCH_SLOTS, isPatchId, type PatchInfo, type PatchSlot } from './domain/patches.js';
import { normalizePatchImage } from './persistence/patch-images.js';
import { esc, mapSvg, timeText } from './ui/helpers.js';
import { carriedWeightText, conditionHtml, guidanceText, headingText, keyLabel, nearestExit, objectivesHtml, quickslotsHtml, useLabel } from './ui/raid-info.js';
export class Game {
    readonly root = document.querySelector<HTMLElement>('#app')!;
    readonly canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
    readonly store = new Store();
    readonly renderer: Renderer;
    readonly settings = loadSettings();
    readonly audio = new AudioEngine(() => this.settings);
    readonly controls: Controls;
    readonly dialogFocus = new DialogFocus();
    profile: Profile | null = null;
    page = 'main';
    character: Character = { name: 'Михаил Соколов', faction: 'BEAR', face: 0, outfit: 0 };
    selected = '';
    preview: Item | null = null;
    original: Item | null = null;
    slot = '';
    trader = 0;
    showIncompatible = false;
    wardrobePose: 'idle' | 'walk' | 'crouch' = 'idle';
    mapId = 'factory';
    search = '';
    session: Session | DedicatedSession | null = null;
    solo: World | null = null;
    snapshot: Snapshot | null = null;
    result: RaidResult | null = null;
    overlay = '';
    containerId = '';
    pendingNav = '';
    bind = '';
    trackedExit = '';
    saving = false;
    patchLibrary: PatchInfo[] = [];
    patchUrls: Record<string, string> = {};
    patchBusy = false;
    patchError = '';
    private collision: Collision | null = null;
    private saveQueue: Promise<void> = Promise.resolve();
    private resultBusy = false;
    private resultAttempted = '';
    private launchBusy = false;
    private inputAt = 0;
    private eventId = 0;
    private toastTimer = 0;
    private hudAt = 0;
    private subtitleUntil = 0;
    private subtitle = '';
    private rangeQuest = false;
    private rangeReturnPage = 'gunsmith';
    private closed = false;
    private inviteCode = new URLSearchParams(location.hash.slice(1)).get('join') || '';
    private menuGun = createWeapon('weapon_ak74m');
    private target = '';
    private inventorySignature = '';
    private frameId = 0;
    private tickTimer = 0;
    private lastStepTime = performance.now();
    private viewRenderer: ((view: ViewModel) => void) | null = null;
    constructor(readonly online: OnlineApi | null = null, readonly initialProfile: Profile | null = null, useBabylon = false) { this.renderer = new Renderer(this.canvas, useBabylon ? 'babylon' : 'legacy'); this.controls = new Controls(this.canvas, () => this.settings, action => this.command(action), () => { if (this.page === 'raid' && !this.overlay) {
        this.overlay = 'pause';
        this.renderOverlay();
    } }); this.installEvents(); }
    async boot() {
        try {
            this.profile = this.online ? this.initialProfile || await this.online.me() : await this.store.open();
            if (this.profile?.pending && !this.online) {
                this.profile = recovery(this.profile);
                await this.store.save(this.profile);
                this.toast('Восстановлен предрейдовый комплект после незавершённой сессии. Собранная добыча не начислена.');
            }
            if (this.profile)
                this.character = clone(this.profile.character);
            this.renderer.setPatchSource(id => this.online ? this.online.patch(id) : this.store.patch(id));
            if (this.inviteCode && this.profile)
                this.page = 'lobby';
            this.renderer.orbit = { yaw: -1.8, pitch: .1, distance: 2 };
            this.render();
            this.tickTimer = window.setInterval(() => this.tick(), 1000 / 30);
            this.frame(performance.now());
            if (this.online) void this.connectRoom(null).catch(error => this.toast((error as Error).message));
            Object.defineProperty(window, '__REID_DIAGNOSTICS', { value: () => ({ page: this.page, profile: this.profile ? { id: this.profile.id, cash: this.profile.cash, character: clone(this.profile.character), gear: clone(this.profile.gear), stash: clone(this.profile.stash), pending: clone(this.profile.pending), stats: clone(this.profile.stats), applied: [...this.profile.applied] } : null, snapshot: this.snapshot ? clone(this.snapshot) : null, render: clone(this.renderer.metrics), graphics: this.renderer.diagnostics(), network: this.session ? { ...this.session.transport.diagnostics } : null }), writable: false });
        }
        catch (error) {
            this.root.innerHTML = `<section class="boot"><h2>Не удалось открыть игру</h2><p>${esc((error as Error).message)}</p><button onclick="location.reload()">Повторить</button></section>`;
        }
    }
    private view(): ViewModel { const n = this.session?.transport.diagnostics; return { page: this.page, profile: this.profile, character: this.character, settings: this.settings, selected: this.selected, preview: this.preview, original: this.original, slot: this.slot, trader: this.trader, showIncompatible: this.showIncompatible, mapId: this.mapId, search: this.search, lobby: this.session?.lobby || null, host: !!this.session?.host, code: this.session?.code || this.inviteCode, network: n ? `Сервер: ${n.signaling}. Канал: ${n.state}. Маршрут: ${n.route}. RTT: ${n.rtt} мс. Очередь: ${n.bufferedAmount} байт.` : '', connected: !!this.session?.connected, result: this.result, saving: this.saving, snapshot: this.snapshot, overlay: this.overlay, containerId: this.containerId, pendingNav: this.pendingNav, isRange: !!this.solo?.range, bind: this.bind, trackedExit: this.trackedExit, online: !!this.online, wardrobePose: this.wardrobePose, patchLibrary: this.patchLibrary, patchUrls: this.patchUrls, patchBusy: this.patchBusy, patchError: this.patchError }; }
    setViewRenderer(renderer: (view: ViewModel) => void) { this.viewRenderer = renderer; }
    render() { const before = this.dialogFocus.capture(); const active = document.activeElement as HTMLInputElement | null, id = active?.id, start = active?.selectionStart, end = active?.selectionEnd; const view = this.view(); if (this.viewRenderer) this.viewRenderer(view); else this.root.innerHTML = screen(view); this.canvas.classList.toggle('workbench', ['gunsmith', 'character', 'wardrobe', 'main'].includes(this.page)); if (id) {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el && ['text', 'search'].includes(el.type)) {
            el.focus({ preventScroll: true });
            if (start !== null && start !== undefined)
                el.setSelectionRange(start, end ?? start);
        }
    } this.applySearch(); this.dialogFocus.update(this.root, before); }
    private renderOverlay() { if (this.viewRenderer) { this.render(); return; } const root = document.getElementById('raid-overlay'); if (root) {
        const before = this.dialogFocus.capture();
        root.innerHTML = raidOverlay(this.view());
        this.dialogFocus.update(this.root, before);
    }
    else
        this.render(); }
    toast(message: string) { const t = document.getElementById('toast')!; t.textContent = message; t.style.display = 'block'; clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => { t.style.display = 'none'; }, 6500); }
    private async change(fn: (p: Profile) => Profile, command?: ProfileCommand) { const run = this.saveQueue.then(async () => { if (!this.profile)
        throw Error('Создайте персонажа'); this.saving = true; try {
        if (this.online) {
            if (!command) throw Error('Эта операция в онлайн-профиле недоступна');
            this.profile = await this.online.command(command);
        } else {
            const next = fn(this.profile);
            await this.store.save(next);
            this.profile = next;
        }
    }
    finally {
        this.saving = false;
    } }); this.saveQueue = run.catch(() => { }); await run; }
    private findGun(id: string) { return this.profile ? [this.profile.gear.primary, this.profile.gear.secondary, ...this.profile.stash].find((i): i is Item => !!i && i.id === id && CATALOG[i.def].category === 'weapon') : undefined; }
    private chooseGun(id?: string) { const p = this.profile!, gun = this.findGun(id || '') || p.gear.primary || p.gear.secondary || p.stash.find(i => CATALOG[i.def].category === 'weapon'); this.original = gun ? clone(gun) : null; this.preview = gun ? clone(gun) : null; this.slot = gun ? getSlots(gun)[0]?.path || '' : ''; this.renderer.selection = this.slot; }
    private dirty() { return this.preview && this.original && JSON.stringify(presetOf(this.preview)) !== JSON.stringify(presetOf(this.original)); }
    private async navigate(page: string) {
        if (this.page === 'gunsmith' && this.dirty() && page !== 'gunsmith') {
            this.pendingNav = page;
            this.overlay = 'unsaved';
            this.render();
            return;
        }
        if (this.session?.lobby && ['stash', 'traders', 'gunsmith', 'character', 'wardrobe', 'maps'].includes(page)) {
            this.toast('Для изменения экипировки сначала выйдите из отряда. В текущей комнате откройте раздел «Отряд».');
            return;
        }
        if (!this.profile && !['main', 'character', 'settings', 'about'].includes(page)) {
            page = 'character';
        }
        if (page === 'range') {
            await this.startSolo('range');
            return;
        }
        this.controls.enabled = false;
        this.controls.unlock();
        this.page = page;
        this.overlay = '';
        this.search = '';
        this.bind = '';
        if (page === 'gunsmith')
            this.chooseGun(this.original?.id);
        if (page === 'character' || page === 'wardrobe') {
            this.character = this.profile ? clone(this.profile.character) : this.character;
            this.character.appearance = normalizeAppearance(this.character.appearance, this.character.faction, this.character.outfit);
            await this.refreshPatchLibrary();
        }
        if (page === 'main' || page === 'character' || page === 'wardrobe')
            this.renderer.orbit = { yaw: -1.8, pitch: .1, distance: 2 };
        else if (page === 'gunsmith')
            this.renderer.orbit = { yaw: 1.2, pitch: .19, distance: 1.8 };
        if (page === 'lobby' && this.session?.host && this.session.world && [...this.session.world.players.values()].every(p => p.status !== 'active'))
            this.session.nextLobby();
        this.render();
    }
    private installEvents() {
        this.root.addEventListener('click', e => { const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]'); if (!target || target.disabled)
            return; const action = target.dataset.act!, id = target.dataset.id || ''; void this.audio.unlock().catch(() => { }); this.audio.click(); this.handle(action, id).catch(error => { this.toast((error as Error).message); this.render(); }); });
        this.root.addEventListener('input', e => this.formInput(e.target as HTMLInputElement));
        this.root.addEventListener('change', e => this.formChange(e.target as HTMLInputElement));
        this.root.addEventListener('dragstart', e => { const el = (e.target as HTMLElement).closest<HTMLElement>('[data-item]'); if (el && e.dataTransfer)
            e.dataTransfer.setData('text/plain', el.dataset.item!); });
        this.root.addEventListener('dragover', e => { const drop = (e.target as HTMLElement).closest<HTMLElement>('.drop'); if (drop && drop.dataset.target !== 'raidbag') {
            e.preventDefault();
            drop.classList.add('dragover');
        } });
        this.root.addEventListener('dragleave', e => (e.target as HTMLElement).closest('.drop')?.classList.remove('dragover'));
        this.root.addEventListener('drop', e => { const drop = (e.target as HTMLElement).closest<HTMLElement>('.drop'); drop?.classList.remove('dragover'); if (!drop || drop.dataset.target === 'raidbag')
            return; e.preventDefault(); const id = e.dataTransfer?.getData('text/plain'); if (id) {
            this.selected = id;
            this.handle('move', drop.dataset.target!).catch(error => this.toast((error as Error).message));
        } });
        document.addEventListener('keydown', e => {
            if (this.bind) {
                e.preventDefault();
                e.stopImmediatePropagation();
                const action = this.bind;
                this.bind = '';
                if (e.code !== 'Escape') {
                    if (Object.entries(this.settings.bindings).some(([a, k]) => a !== action && k === e.code)) {
                        this.toast('Эта клавиша уже занята');
                    }
                    else if (!['F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight'].includes(e.code)) {
                        this.settings.bindings[action] = e.code;
                        saveSettings(this.settings);
                    }
                }
                this.render();
                return;
            }
            if (this.dialogFocus.trap(this.root, e)) return;
            if (e.code === 'Escape' && this.page === 'raid' && ['map', 'inventory'].includes(this.overlay)) {
                if (this.snapshot?.players.find(p => p.id === this.profile?.id)?.search) this.action({type:'cancel'});
                this.overlay = 'pause';
                this.renderOverlay();
                return;
            }
            if (e.code === 'Escape' && this.page !== 'raid') {
                if (this.overlay === 'unsaved') {
                    this.overlay = '';
                    this.pendingNav = '';
                    this.render();
                }
                else if (this.page !== 'main')
                    void this.navigate('main');
            }
        }, true);
        let drag: {
            x: number;
            y: number;
            total: number;
        } | null = null;
        this.canvas.addEventListener('pointerdown', e => { if (!['main', 'character', 'wardrobe', 'gunsmith'].includes(this.page))
            return; drag = { x: e.clientX, y: e.clientY, total: 0 }; this.canvas.setPointerCapture(e.pointerId); });
        this.canvas.addEventListener('pointermove', e => { if (!drag)
            return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.total += Math.abs(dx) + Math.abs(dy); this.renderer.orbit.yaw += dx * .008; this.renderer.orbit.pitch = clamp(this.renderer.orbit.pitch + dy * .005, -.6, 1.1); drag.x = e.clientX; drag.y = e.clientY; });
        this.canvas.addEventListener('pointerup', e => { if (drag && drag.total < 6 && this.page === 'gunsmith') {
            const slot = this.renderer.pickPreview(e.clientX, e.clientY);
            if (slot && this.preview && getSlots(this.preview).some(s => s.path === slot)) {
                this.slot = slot;
                this.renderer.selection = slot;
                this.render();
            }
        } drag = null; });
        this.canvas.addEventListener('wheel', e => { if (['main', 'character', 'wardrobe', 'gunsmith'].includes(this.page)) {
            e.preventDefault();
            this.renderer.orbit.distance = clamp(this.renderer.orbit.distance + e.deltaY * .001, 1, 3.1);
        } }, { passive: false });
        window.addEventListener('beforeunload', e => { if (this.profile?.pending) {
            e.preventDefault();
            e.returnValue = '';
        } });
        window.addEventListener('pagehide', () => { this.controls.clear(); this.store.close(); this.session?.close(); });
    }
    private formInput(el: HTMLInputElement) {
        if (el.id === 'character-name') {
            this.character.name = el.value;
            return;
        }
        if (el.id === 'search') {
            this.search = el.value;
            this.applySearch();
            return;
        }
        if (el.id === 'join-code') {
            this.inviteCode = el.value;
            return;
        }
        if (['sensitivity', 'fov', 'volume', 'effects'].includes(el.id)) {
            const id = el.id as 'sensitivity' | 'fov' | 'volume' | 'effects';
            this.settings[id] = Number(el.value);
            saveSettings(this.settings);
            this.audio.volume();
            const fov = document.getElementById('fov-value');
            if (fov)
                fov.textContent = this.settings.fov + '°';
        }
    }
    private formChange(el: HTMLInputElement) {
        if (el.id === 'patch-upload' && el.files?.[0]) {
            void this.uploadPatch(el.files[0]);
            return;
        }
        const patchSlot = el.dataset.patchSlot as PatchSlot | undefined;
        if (patchSlot && PATCH_SLOTS.includes(patchSlot) && ['character', 'wardrobe'].includes(this.page)) {
            const patches = { ...this.character.patches };
            if (isPatchId(el.value) && this.patchLibrary.some(patch => patch.id === el.value)) patches[patchSlot] = el.value;
            else delete patches[patchSlot];
            this.character.patches = patches;
            this.render();
            return;
        }
        const field = el.dataset?.appearance as keyof Appearance | undefined;
        if (field && ['character', 'wardrobe'].includes(this.page)) {
            const appearance = normalizeAppearance(this.character.appearance, this.character.faction, this.character.outfit);
            this.character.appearance = normalizeAppearance({ ...appearance, [field]: el.value }, this.character.faction, this.character.outfit);
            this.render();
            return;
        }
        switch (el.id) {
            case 'appearance-preset': {
                const preset = APPEARANCE_PRESETS.find(p => p.id === el.value);
                if (preset) this.character.appearance = clone(preset.appearance);
                this.render();
                break;
            }
            case 'faction':
                this.character.faction = el.value === 'USEC' ? 'USEC' : 'BEAR';
                this.character.appearance = defaultAppearance(this.character.faction, this.character.outfit);
                this.render();
                break;
            case 'face':
                this.character.face = Number(el.value);
                break;
            case 'outfit':
                this.character.outfit = Number(el.value);
                this.character.appearance = defaultAppearance(this.character.faction, this.character.outfit);
                this.render();
                break;
            case 'quality':
                this.settings.quality = el.value === 'low' ? 'low' : 'high';
                saveSettings(this.settings);
                break;
            case 'bob':
            case 'voices':
                this.settings[el.id] = el.checked;
                saveSettings(this.settings);
                if (el.id === 'voices' && el.checked && (!('speechSynthesis' in window) || !speechSynthesis.getVoices().some(v => v.lang.startsWith('ru'))))
                    this.toast('Русский системный голос не найден. Субтитры продолжат работать.');
                break;
            case 'signal-mode': {
                const url = new URL(location.href);
                if (el.value === 'local')
                    url.searchParams.set('signal', 'local');
                else
                    url.searchParams.delete('signal');
                history.replaceState(null, '', url);
                break;
            }
            case 'lobby-map':
            case 'friendly-fire': {
                const map = document.querySelector<HTMLSelectElement>('#lobby-map')?.value || 'factory', ff = document.querySelector<HTMLInputElement>('#friendly-fire')?.checked || false;
                this.session?.configure(map, ff);
                break;
            }
        }
    }
    private async refreshPatchLibrary() {
        const library = this.online ? await this.online.patches() : await this.store.patches();
        const urls: Record<string, string> = {};
        for (const patch of library) {
            if (this.patchUrls[patch.id]) urls[patch.id] = this.patchUrls[patch.id];
            else {
                const blob = this.online ? await this.online.patch(patch.id) : await this.store.patch(patch.id);
                if (blob) urls[patch.id] = URL.createObjectURL(blob);
            }
        }
        for (const [id, url] of Object.entries(this.patchUrls)) if (!urls[id]) { URL.revokeObjectURL(url); this.renderer.clearPatch(id); }
        this.patchLibrary = library; this.patchUrls = urls;
    }
    private async uploadPatch(file: File) {
        if (this.patchBusy) return;
        this.patchBusy = true; this.patchError = ''; this.render();
        try {
            if (this.session?.lobby || this.profile?.pending) throw Error('Сначала завершите рейд и выйдите из отряда');
            const image = await normalizePatchImage(file);
            if (this.online) await this.online.uploadPatch(image); else await this.store.addPatch(image);
            await this.refreshPatchLibrary();
        } catch (error) { this.patchError = error instanceof Error ? error.message : 'Не удалось добавить патч'; }
        finally { this.patchBusy = false; this.render(); }
    }
    private applySearch() { const q = this.search.trim().toLowerCase(); for (const el of this.root.querySelectorAll<HTMLElement>('[data-search]'))
        el.classList.toggle('item-hidden', !!q && !el.dataset.search!.includes(q)); }
    private async handle(action: string, id: string) {
        switch (action) {
            case 'switch-mode':
                if (this.session || this.profile?.pending) throw Error('Сначала завершите рейд и выйдите из отряда');
                location.href = this.online ? '/?offline=1' : '/';
                return;
            case 'logout':
                if (!this.online) return;
                if (this.session || this.profile?.pending) throw Error('Сначала завершите рейд и выйдите из отряда');
                await this.online.logout();
                location.href = '/';
                return;
            case 'nav':
                await this.navigate(id);
                return;
            case 'create-from-menu':
                await this.navigate('lobby');
                if (this.page === 'lobby' && !this.session) await this.connectRoom(true);
                return;
            case 'join-from-menu':
                await this.navigate('lobby');
                if (this.page === 'lobby' && !this.session) document.getElementById('join-code')?.focus();
                return;
            case 'wardrobe-pose':
                this.wardrobePose = id === 'walk' || id === 'crouch' ? id : 'idle';
                this.render();
                return;
            case 'wardrobe-buyanov':
                this.character.appearance = { ...normalizeAppearance(this.character.appearance, this.character.faction, this.character.outfit), rig: 'rig_buyanov' };
                this.render();
                return;
            case 'reset-appearance':
                this.character = this.profile ? clone(this.profile.character) : { ...this.character, appearance: defaultAppearance(this.character.faction, this.character.outfit) };
                this.render();
                return;
            case 'save-appearance':
                if (this.patchBusy) throw Error('Дождитесь обработки изображения');
                if (this.session?.lobby || this.profile?.pending) throw Error('Сначала завершите рейд и выйдите из отряда');
                await this.change(p => saveAppearance(p, this.character), { type: 'save-appearance', appearance: this.character.appearance, face: this.character.face, patches: this.character.patches });
                this.character = clone(this.profile!.character);
                this.toast('Внешний вид сохранён. Вся одежда бесплатная.');
                this.render();
                return;
            case 'delete-patch':
                if (this.session?.lobby || this.profile?.pending) throw Error('Сначала завершите рейд и выйдите из отряда');
                if (Object.values(this.character.patches || {}).includes(id)) throw Error('Сначала снимите патч и сохраните внешний вид');
                if (this.online) await this.online.deletePatch(id); else await this.store.deletePatch(id);
                await this.refreshPatchLibrary();
                this.render();
                return;
            case 'create-character': {
                if (this.patchBusy) throw Error('Дождитесь обработки изображения');
                if (this.online) throw Error('Новый онлайн-персонаж создаётся при регистрации аккаунта');
                if (this.session || this.profile?.pending)
                    throw Error('Завершите текущий рейд и выйдите из отряда перед созданием персонажа');
                const p = newProfile(this.character);
                if (this.profile) {
                    if (!confirm('Будет создан новый персонаж. Сначала сохранится резервная копия текущего профиля. Продолжить?'))
                        return;
                    downloadText(await this.store.export(this.profile), 'reid-backup-' + new Date().toISOString().slice(0, 10) + '.json');
                }
                this.saving = true;
                try {
                    await this.store.save(p, !!this.profile);
                    this.profile = p;
                }
                finally {
                    this.saving = false;
                }
                await this.navigate(this.inviteCode ? 'lobby' : 'stash');
                this.toast('Стартовый комплект выдан. Оружие уже заряжено, запасные патроны лежат в рюкзаке.');
                return;
            }
            case 'select-item':
                this.selected = id;
                this.page === 'raid' ? this.renderOverlay() : this.render();
                return;
            case 'move':
                if (!this.selected)
                    return;
                await this.change(p => moveItem(p, this.selected, id as Parameters<typeof moveItem>[2]), { type: 'move', id: this.selected, target: id });
                break;
            case 'pack-mag':
            case 'unload-mag':
                await this.change(p => prepareMagazine(p, id || this.selected, action === 'unload-mag'), { type: action, id: id || this.selected });
                break;
            case 'raid-pack-mag':
                this.action({ type: 'load-mag', item: id });
                break;
            case 'raid-swap-mag':
                this.action({ type: 'reload', item: id });
                break;
            case 'sort':
                await this.change(p => transaction(p, uid(), q => { q.stash.sort((a, b) => CATALOG[a.def].category.localeCompare(CATALOG[b.def].category)); }), { type: 'sort' });
                break;
            case 'rotate':
                await this.change(p => transaction(p, uid(), q => { const item = [...q.stash, ...q.gear.bag, ...q.gear.safe].find(i => i.id === this.selected); if (!item)
                    throw Error('Сначала переложите предмет из экипировки в контейнер'); item.rotated = !item.rotated; }), { type: 'rotate', id: this.selected });
                break;
            case 'split': {
                const item = this.profile && [...this.profile.stash, ...this.profile.gear.bag].find(i => i.id === this.selected);
                if (!item)
                    return;
                const count = prompt('Сколько единиц отделить?', String(Math.floor(item.qty / 2)));
                if (count === null)
                    return;
                await this.change(p => splitStack(p, this.selected, Number(count)), { type: 'split', id: this.selected, count: Number(count) });
                break;
            }
            case 'sell':
                await this.change(p => sell(p, this.selected, Number(id)), { type: 'sell', id: this.selected, trader: Number(id) });
                this.selected = '';
                break;
            case 'sell-direct':
                await this.change(p => sell(p, id, this.trader), { type: 'sell', id, trader: this.trader });
                break;
            case 'buy':
                await this.change(p => buy(p, id, CATALOG[id].category === 'ammo' ? 30 : 1), { type: 'buy', id });
                this.toast('Покупка добавлена в схрон');
                break;
            case 'rescue':
                await this.change(p => emergencyKit(p), { type: 'rescue' });
                this.toast('Выдан непередаваемый торговцу пистолет и небольшой запас патронов.');
                break;
            case 'trader':
                this.trader = Number(id);
                this.search = '';
                break;
            case 'quest':
                await this.change(p => questAction(p, id), { type: 'quest', id });
                break;
            case 'edit-gun':
                await this.navigate('gunsmith');
                this.chooseGun(id);
                break;
            case 'choose-gun':
                if (this.dirty()) {
                    this.toast('Сначала примените или сбросьте текущую сборку.');
                    return;
                }
                this.chooseGun(id);
                break;
            case 'slot':
                this.slot = id;
                this.renderer.selection = id;
                break;
            case 'module':
                if (this.preview) {
                    this.preview = replacePreview(this.preview, this.slot, id === 'none' ? null : id);
                    if (!getSlots(this.preview).some(s => s.path === this.slot))
                        this.slot = getSlots(this.preview)[0]?.path || '';
                    this.renderer.selection = this.slot;
                }
                break;
            case 'reset-build':
                if (this.original) {
                    this.preview = clone(this.original);
                    this.slot = getSlots(this.preview)[0]?.path || '';
                    this.renderer.selection = this.slot;
                }
                break;
            case 'show-incompatible':
                this.showIncompatible = !this.showIncompatible;
                break;
            case 'workshop-preset': {
                const template = WORKSHOP_PRESETS.find(p => p.id === id);
                if (!template || template.tree.def !== this.original?.def) throw Error('Сначала выберите оружие этого пресета');
                this.preview = fromPreset(template.tree);
                this.slot = getSlots(this.preview)[0]?.path || '';
                this.renderer.selection = this.slot;
                break;
            }
            case 'apply-owned':
                await this.applyCurrentBuild(true);
                break;
            case 'apply-build':
                await this.applyCurrentBuild();
                break;
            case 'confirm-nav': {
                const page = this.pendingNav;
                this.overlay = '';
                this.pendingNav = '';
                if (id === 'stay') {
                    this.render();
                    return;
                }
                if (id === 'apply')
                    await this.applyCurrentBuild();
                else if (this.original)
                    this.preview = clone(this.original);
                await this.navigate(page);
                return;
            }
            case 'reset-view':
                this.renderer.orbit = { yaw: 1.2, pitch: .19, distance: 1.8 };
                return;
            case 'explode':
                this.renderer.explode = this.renderer.explode ? 0 : 1;
                return;
            case 'catalog-range':
                await this.startSolo('range', id);
                return;
            case 'range':
                if (this.online) throw Error('Тир пока доступен в офлайн-режиме');
                await this.navigate('range');
                return;
            case 'save-preset': {
                if (!this.preview)
                    return;
                const name = prompt('Название пресета (до 32 символов)', 'Моя сборка');
                if (!name)
                    return;
                const gun = this.preview;
                await this.change(p => transaction(p, uid(), q => { if (q.presets.length >= 20 && !q.presets.some(s => s.name === name.slice(0, 32)))
                    throw Error('Достигнут лимит 20 пресетов'); q.presets = q.presets.filter(s => s.name !== name.slice(0, 32)); q.presets.push({ name: name.slice(0, 32), def: gun.def, tree: presetOf(gun) }); }), { type: 'save-preset', name, preset: presetOf(gun) });
                break;
            }
            case 'load-preset': {
                const p = this.profile?.presets.find(s => s.name === id);
                if (p)
                    this.preview = fromPreset(p.tree);
                break;
            }
            case 'export-preset':
                if (this.preview)
                    downloadText(JSON.stringify({ format: 'REID_BUILD', schema: 1, tree: presetOf(this.preview) }, null, 2), 'reid-weapon.json');
                return;
            case 'import-preset': {
                const text = await this.readTextFile();
                if (!text)
                    return;
                if (text.length > 50000)
                    throw Error('Пресет слишком большой');
                const obj = JSON.parse(text);
                if (obj.format !== 'REID_BUILD' || obj.schema !== 1)
                    throw Error('Неподдерживаемый пресет');
                const item = fromPreset(obj.tree);
                if (item.def !== this.original?.def)
                    throw Error('Пресет другой основы. Сначала выберите нужное оружие.');
                quoteBuild(this.profile!, this.original, presetOf(item));
                this.preview = item;
                break;
            }
            case 'map':
                this.mapId = id;
                break;
            case 'solo':
                if (this.online) {
                    await this.connectRoom(true);
                    this.session?.configure(this.mapId, false);
                    this.session?.ready(true);
                    await this.session?.start();
                    return;
                }
                await this.startSolo(this.mapId);
                return;
            case 'create-room':
            case 'join-room':
                await this.connectRoom(action === 'create-room');
                return;
            case 'copy-invite':
                await this.copy(this.invitation());
                this.toast(this.online ? 'Ссылка приглашения скопирована' : 'Ссылка скопирована. Для интернета она должна вести на опубликованную игру, не localhost.');
                return;
            case 'copy-code':
                await this.copy(this.session?.code || '');
                this.toast('Код скопирован');
                return;
            case 'copy-network':
                await this.copy(JSON.stringify(this.session?.transport.diagnostics || {}, null, 2));
                this.toast('Диагностика скопирована без токена приглашения');
                return;
            case 'ready': {
                const own = this.session?.lobby.members.find(m => m.id === this.profile!.id);
                this.session?.ready(!own?.ready);
                return;
            }
            case 'start-room':
                await this.session?.start();
                return;
            case 'next-room':
                this.session?.nextLobby();
                return;
            case 'leave-room': {
                if (this.online) {
                    if (this.profile?.pending && !confirm('Вы покинете рейд с потерей вещей. Продолжить?')) return;
                    await this.session?.leave();
                    this.session = null; this.snapshot = null; this.solo = null;
                    this.profile = await this.online.me();
                    await this.navigate('lobby');
                    return;
                }
                if (this.profile?.pending) {
                    if (!confirm('Вы покинете рейд с потерей вещей. Продолжить?'))
                        return;
                    const p = this.profile, pending = p.pending!, actor = this.snapshot?.players.find(a => a.id === p.id);
                    const result: RaidResult = actor?.result || { id: 'abandon-' + pending.raidId + '-' + p.id, raidId: pending.raidId, playerId: p.id, outcome: 'missing', map: pending.map, seconds: this.snapshot?.time || 0, kills: actor?.kills || 0, gear: clone(actor?.gear || pending.gear), visited: actor?.visited || [] };
                    this.session?.leave();
                    await this.change(q => applyResult(q, result));
                }
                else
                    this.session?.leave();
                this.session = null;
                this.snapshot = null;
                this.solo = null;
                await this.navigate('lobby');
                return;
            }
            case 'return-raid':
                if (this.snapshot) {
                    this.page = 'raid';
                    this.overlay = 'pause';
                    this.controls.enabled = true;
                    this.render();
                }
                return;
            case 'cancel-action':
                this.action({ type: 'cancel' });
                this.renderOverlay();
                return;
            case 'search-container':
                this.action({ type: 'interact', target: id });
                return;
            case 'resume':
                this.resumeRaid();
                return;
            case 'raid-inventory':
                this.overlay = 'inventory';
                this.containerId = '';
                this.controls.unlock();
                this.renderOverlay();
                return;
            case 'raid-map':
                this.overlay = 'map';
                this.controls.unlock();
                this.renderOverlay();
                return;
            case 'track-exit':
                if (id && !MAPS[this.snapshot?.mapId || '']?.exits.some(exit => exit.id === id))
                    throw Error('Выход не найден');
                this.trackedExit = id;
                this.renderOverlay();
                this.updateHUD(performance.now());
                return;
            case 'use':
                this.action({ type: 'use', item: id });
                this.renderOverlay();
                return;
            case 'take': {
                const c = this.snapshot?.containers.find(c => c.id === this.containerId);
                if (c)
                    this.action({ type: 'take', item: id, target: c.id, revision: c.revision });
                return;
            }
            case 'drop':
                this.action({ type: 'drop', item: id });
                return;
            case 'abandon':
                if (confirm('Вы покинете рейд и потеряете взятое снаряжение. Это не технический обрыв. Продолжить?'))
                    this.action({ type: 'abandon' });
                return;
            case 'leave-range':
                await this.leaveRange();
                return;
            case 'show-result':
                this.page = 'results';
                this.controls.enabled = false;
                this.controls.unlock();
                this.render();
                return;
            case 'spectate':
                this.page = 'raid';
                this.overlay = 'pause';
                this.controls.enabled = true;
                this.render();
                return;
            case 'result-continue':
                if (this.profile?.pending)
                    throw Error('Результат ещё не сохранён. Повторите сохранение.');
                this.controls.enabled = false;
                this.controls.unlock();
                this.solo = null;
                if (!this.session)
                    this.snapshot = null;
                await this.navigate(this.session ? 'lobby' : 'stash');
                return;
            case 'retry-result':
                if (this.result)
                    await this.resolveResult(this.result);
                return;
            case 'bind':
                this.bind = id;
                this.render();
                return;
            case 'export-profile':
                if (this.online) throw Error('Экспорт серверного профиля пока недоступен');
                if (this.profile)
                    downloadText(await this.store.export(this.profile), 'reid-profile.json');
                return;
            case 'import-profile': {
                if (this.online) throw Error('Локальные сохранения не импортируются в онлайн-экономику');
                if (this.session || this.profile?.pending)
                    throw Error('Выйдите из отряда и завершите рейд перед импортом');
                const text = await this.readTextFile();
                if (!text)
                    return;
                if (this.profile) {
                    if (!confirm('Импорт заменит профиль. Текущее состояние будет сохранено в резервной копии. Продолжить?'))
                        return;
                    downloadText(await this.store.export(this.profile), 'reid-before-import.json');
                }
                this.saving = true;
                try {
                    this.profile = await this.store.import(text);
                    if (this.profile.pending) {
                        this.profile = recovery(this.profile);
                        await this.store.save(this.profile);
                    }
                }
                finally {
                    this.saving = false;
                }
                this.toast('Профиль импортирован');
                break;
            }
        }
        this.render();
    }
    private async applyCurrentBuild(ownedOnly = false) { if (!this.original || !this.preview)
        return; const id = this.original.id, preset = presetOf(this.preview); await this.change(p => applyBuild(p, id, preset, uid(), ownedOnly), { type: 'apply-build', id, preset, ownedOnly }); this.chooseGun(id); this.toast('Сборка сохранена. В тире и рейде будет это же оружие.'); }
    private async readTextFile(): Promise<string | null> { return new Promise((resolve, reject) => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = () => { const file = input.files?.[0]; if (!file) {
        resolve(null);
        return;
    } if (file.size > 2000000) {
        reject(Error('Файл слишком большой'));
        return;
    } file.text().then(resolve, reject); }; input.addEventListener('cancel', () => resolve(null)); input.click(); }); }
    private async copy(text: string) { try {
        await navigator.clipboard.writeText(text);
    }
    catch {
        const t = document.createElement('textarea');
        t.value = text;
        document.body.append(t);
        t.select();
        const copied = document.execCommand('copy');
        t.remove();
        if (!copied) throw Error('Копирование недоступно. Выделите код и скопируйте вручную.');
    } }
    private invitation() { const u = new URL(location.href); u.hash = 'join=' + encodeURIComponent(this.session?.code || ''); return u.href; }
    private async loadRaid(raidId: string, mapId: string) {
        this.mapId = mapId;
        this.page = 'loading';
        this.controls.enabled = false;
        this.controls.unlock();
        this.render();
        await new Promise<void>(r => requestAnimationFrame(() => r()));
        if (!this.profile!.pending && this.online) this.profile = await this.online.me();
        if (!this.profile!.pending && !this.online)
            await this.change(p => prepareRaid(p, raidId, mapId));
        if (this.profile!.pending!.raidId !== raidId)
            throw Error('Уже подготовлен другой рейд');
        this.renderer.setMap(MAPS[mapId]);
        this.collision = new Collision(MAPS[mapId]);
        this.resetRaidState();
        return clone(this.profile!.pending!.gear);
    }
    private async activate() { if (this.online) return; if (this.profile?.pending?.stage === 'prepared')
        await this.change(p => activateRaid(p)); }
    private resetRaidState() { this.eventId = 0; this.rangeQuest = false; this.result = null; this.resultAttempted = ''; this.selected = ''; this.containerId = ''; this.controls.yaw = 0; this.controls.pitch = 0; this.controls.clear(); this.renderer.explode = 0; this.audio.reset(); this.subtitle = ''; this.subtitleUntil = 0; this.target = ''; this.trackedExit = 'auto'; this.inventorySignature = ''; }
    private async startSolo(mapId: string, trialDef?: string) {
        if (this.launchBusy) return;
        if (!MAPS[mapId]) throw Error('Карта не найдена');
        if (trialDef && (mapId !== 'range' || CATALOG[trialDef]?.category !== 'weapon')) throw Error('Оружие для испытания не найдено');
        if (this.profile?.pending || this.solo?.players.get(this.profile?.id || '')?.status === 'active')
            throw Error('Сначала завершите текущий рейд');
        this.launchBusy = true;
        try {
            await this.startSoloRaid(mapId, trialDef);
        } catch (error) {
            if (!this.session?.lobby) {
                this.controls.enabled = false;
                this.solo = null;
                this.snapshot = null;
                this.collision = null;
                this.overlay = '';
                this.page = this.profile ? 'maps' : 'character';
                if (this.profile?.pending) await this.change(profile => recovery(profile));
                this.render();
            }
            throw error;
        } finally {
            this.launchBusy = false;
        }
    }
    private async startSoloRaid(mapId: string, trialDef?: string) {
        if (!this.profile)
            throw Error('Создайте персонажа');
        if (this.session?.lobby)
            throw Error('Сначала выйдите из отряда');
        if (matchMedia('(pointer: coarse)').matches)
            throw Error('Рейд требует клавиатуры и мыши');
        const id = uid();
        if (mapId === 'range') {
            const gun = trialDef ? createWeapon(trialDef) : this.original && this.findGun(this.original.id) || this.profile.gear.primary || this.profile.gear.secondary;
            this.rangeReturnPage = trialDef ? 'traders' : 'gunsmith';
            if (!gun)
                throw Error('Возьмите оружие');
            this.page = 'loading';
            this.mapId = 'range';
            this.render();
            await new Promise<void>(r => requestAnimationFrame(() => r()));
            this.renderer.setMap(MAPS.range);
            this.collision = new Collision(MAPS.range);
            this.resetRaidState();
            this.solo = new World(MAPS.range, id, false, 42, true);
            const gear = clone(this.profile.gear);
            gear.primary = clone(gun);
            setLoadedRounds(gear.primary, calculateStats(gun).capacity);
            gear.secondary = null;
            this.solo.addPlayer(this.profile.id, this.profile.character, gear);
        }
        else {
            const gear = await this.loadRaid(id, mapId);
            this.solo = new World(MAPS[mapId], id);
            this.solo.addPlayer(this.profile.id, this.profile.character, gear);
            await this.activate();
        }
        this.receiveSnapshot(this.solo.snapshot());
        this.page = 'raid';
        this.overlay = 'pause';
        this.controls.enabled = true;
        this.render();
        this.lastStepTime = performance.now();
    }
    private async leaveRange() { this.controls.enabled = false; this.controls.unlock(); this.audio.reset(); this.solo = null; this.snapshot = null; this.collision = null; this.overlay = ''; await this.navigate(this.rangeReturnPage || 'gunsmith'); }
    private async connectRoom(host: boolean | null) {
        if (!this.profile)
            throw Error('Создайте персонажа');
        if (!this.profile.gear.primary && !this.profile.gear.secondary)
            throw Error('Сначала возьмите оружие');
        if (this.session)
            throw Error('Вы уже в отряде');
        this.saving = true;
        this.render();
        const hooks = { lobby: (l: import('./domain/types.js').Lobby) => { this.mapId = l.mapId; if (this.page === 'lobby')
                this.render(); }, snapshot: (s: Snapshot) => this.receiveSnapshot(s), error: (s: string) => this.toast(s), lost: (s: string) => { void this.connectionLost(s); }, prepare: (id: string, map: string) => this.loadRaid(id, map), started: () => this.activate(), reply: (r: ActionReply) => this.reply(r), profile: (p: Profile) => { this.profile = p; this.online?.update(p); if (this.page === 'lobby' || this.page === 'results') this.render(); } };
        const session = this.online ? new DedicatedSession(this.profile, hooks, this.online) : new Session(this.profile, hooks);
        this.session = session;
        try {
            if (host === null) {
                if (!(session instanceof DedicatedSession) || !await session.resume()) {
                    session.close(); this.session = null; return;
                }
            }
            else if (host)
                await session.create();
            else
                await session.join(this.inviteCode);
            this.page = 'lobby';
        }
        catch (error) {
            session.close();
            this.session = null;
            throw error;
        }
        finally {
            this.saving = false;
            this.render();
        }
    }
    private async connectionLost(message: string) {
        if (this.online) {
            this.session?.close(); this.session = null;
            this.controls.enabled = false; this.controls.unlock(); this.audio.reset();
            this.snapshot = null; this.overlay = ''; this.solo = null;
            try { this.profile = await this.online.me(); } catch (error) { this.toast((error as Error).message); }
            this.page = 'lobby'; this.render(); this.toast(message);
            return;
        }
        const pending = this.profile?.pending;
        const known = pending ? [this.result, this.snapshot?.players.find(actor => actor.id === this.profile!.id)?.result].find(result => result && result.raidId === pending.raidId && result.playerId === this.profile!.id) : undefined;
        this.session?.close();
        this.session = null;
        this.controls.enabled = false;
        this.controls.unlock();
        this.audio.reset();
        this.solo = null;
        this.snapshot = null;
        this.overlay = '';
        if (pending) {
            // A known death/extraction must never turn into a technical gear refund.
            // A failed write keeps this exact result available for an explicit retry.
            const result = known || recovery(this.profile!).journal[0];
            await this.resolveResult(result);
        } else {
            this.page = 'lobby';
            this.render();
        }
        this.toast(message + (this.profile?.pending ? ' Результат ещё не сохранён — нажмите «Повторить сохранение».' : ''));
    }
    private command(action: string) {
        if (this.page !== 'raid')
            return;
        if (action === 'cancel') {
            this.action({ type: 'cancel' });
            return;
        }
        if (action === 'inventory') {
            if (this.snapshot?.players.find(p => p.id === this.profile?.id)?.search) this.action({ type: 'cancel' });
            if (this.overlay === 'inventory') {
                this.resumeRaid();
            }
            else {
                this.overlay = 'inventory';
                this.containerId = '';
                this.controls.unlock();
                this.renderOverlay();
            }
            return;
        }
        if (action === 'map') {
            if (this.snapshot?.players.find(p => p.id === this.profile?.id)?.search) this.action({ type: 'cancel' });
            if (this.overlay === 'map') {
                this.resumeRaid();
            }
            else {
                this.overlay = 'map';
                this.controls.unlock();
                this.renderOverlay();
            }
            return;
        }
        if (!this.controls.locked || this.overlay)
            return;
        if (action === 'fire-mode' || action === 'inspect') {
            this.action({ type: action });
        }
        else if (action === 'reload') {
            this.action({ type: 'reload' });
            // Mechanical sound arrives only for an accepted action.
        }
        else if (action === 'primary' || action === 'secondary')
            this.action({ type: 'switch', target: action });
        else if (action === 'interact' && this.target)
            this.action({ type: 'interact', target: this.target });
        else if (action === 'light' || action === 'laser')
            this.action({ type: action });
        else if (['heal', 'bandage', 'food', 'splint'].includes(action)) {
            const effect = action === 'food' ? 'energy' : action, actor = this.snapshot?.players.find(p => p.id === this.profile?.id), item = actor?.gear.bag.find(i => CATALOG[i.def].effect === effect);
            if (item)
                this.action({ type: 'use', item: item.id });
            else
                this.toast('Подходящего предмета нет в рюкзаке');
        }
    }
    private action(part: Omit<Action, 'id'>) { const action: Action = { ...part, id: uid() }; if (!this.solo && this.session)
        this.session.action(action);
    else if (this.solo) {
        const result = this.solo.action(this.profile!.id, action);
        this.reply(result);
        this.receiveSnapshot(this.solo.snapshot());
    } }
    private reply(r: ActionReply) { if (!r.ok) {
        this.toast(r.message || 'Действие отклонено');
        return;
    } if (r.container) {
        this.containerId = r.container;
        this.overlay = 'inventory';
        this.controls.unlock();
        this.renderOverlay();
    }
    else if (this.overlay === 'inventory')
        this.renderOverlay(); }
    private resumeRaid() {
        if (this.snapshot?.players.find(p => p.id === this.profile?.id)?.search)
            this.action({ type: 'cancel' });
        this.controls.enabled = true;
        this.containerId = '';
        // This still happens inside the button's trusted click. If Pointer Lock
        // fails synchronously, Controls sees an empty overlay and restores pause.
        this.overlay = '';
        this.renderOverlay();
        this.controls.lock();
    }
    private receiveSnapshot(s: Snapshot) {
        if (this.snapshot && s.raidId === this.snapshot.raidId && s.tick < this.snapshot.tick)
            return;
        this.snapshot = s;
        if (this.page === 'loading') {
            this.mapId = s.mapId;
            this.page = 'raid';
            this.overlay = 'pause';
            this.controls.enabled = true;
            this.render();
        }
        const me = s.players.find(a => a.id === this.profile?.id);
        if (!me)
            return;
        this.controls.syncSequence(me.input.seq);
        if (this.trackedExit === 'auto')
            this.trackedExit = this.solo?.range ? '' : nearestExit(MAPS[s.mapId], me, s.activated);
        if (this.collision)
            for (const d of this.collision.doors)
                d.open = s.doors[d.id] ?? d.open;
        for (const e of s.events) {
            if (e.seq <= this.eventId)
                continue;
            this.eventId = e.seq;
            const listener = viewedActor(s, me.id)!;
            const ear: Vec3 = [listener.p[0], listener.p[1] + (listener.input.crouch ? 1.07 : 1.58), listener.p[2]];
            if (this.page === 'raid') this.audio.event(e, ear, this.collision);
            if (e.type === 'voice' && e.text && dist(e.p, ear) < 27) {
                this.subtitle = (s.bots.find(b => b.id === e.actor)?.name || 'Дикий') + ': ' + e.text;
                this.subtitleUntil = performance.now() + 4500;
            }
            if (e.type === 'shot' && e.actor === me.id) {
                const gun = me.gear[me.active];
                if (gun) {
                    this.controls.pitch = clamp(this.controls.pitch + calculateStats(gun).recoil * .0045, -1.45, 1.45);
                    if (this.solo?.range && !this.rangeQuest) {
                        const defaultGun = createWeapon(gun.def);
                        if (JSON.stringify(presetOf(defaultGun)) !== JSON.stringify(presetOf(gun))) {
                            this.rangeQuest = true;
                            if (this.profile?.quests.quest_12?.accepted && !this.profile.quests.quest_12.claimed)
                                void this.change(p => transaction(p, uid(), q => { q.quests.quest_12.progress = 1; })).then(() => this.toast('«Своя сборка»: испытание засчитано')).catch(error => this.toast((error as Error).message));
                        }
                    }
                }
            }
        }
        // The dedicated server can confirm the profile before it sends the terminal snapshot.
        // Still show the result when escrow has already been cleared by that confirmation.
        if (me.result && (this.profile?.pending || this.online && this.profile?.journal.some(entry => entry.id === me.result!.id)) && !this.resultBusy && this.resultAttempted !== me.result.id)
            void this.resolveResult(me.result);
        if (this.page === 'raid' && this.overlay === 'inventory') {
            const signature = JSON.stringify([s.containers.find(c => c.id === this.containerId), me.gear, me.searchTarget, Math.ceil((me.search || 0) * 10), Math.ceil(me.reload * 10), Math.ceil(me.use * 10)]);
            if (signature !== this.inventorySignature) {
                this.inventorySignature = signature;
                this.renderOverlay();
            }
        }
    }
    private async resolveResult(result: RaidResult) {
        if (this.resultBusy)
            return;
        this.resultBusy = true;
        this.resultAttempted = result.id;
        this.result = clone(result);
        this.audio.reset();
        this.controls.enabled = false;
        this.controls.unlock();
        this.page = 'results';
        this.overlay = '';
        this.saving = true;
        this.render();
        try {
            if (this.online) {
                this.profile = await this.online.me();
                if (!this.profile.journal.some(entry => entry.id === result.id)) throw Error('Сервер ещё сохраняет результат. Повторите проверку.');
            } else await this.change(p => applyResult(p, result));
            this.saving = false;
            this.render();
        }
        catch (error) {
            this.saving = false;
            this.render();
            this.toast('Результат пока не сохранён: ' + (error as Error).message);
        }
        finally {
            this.resultBusy = false;
        }
    }
    private tick() {
        if (this.closed)
            return;
        const now = performance.now(), gap = now - this.lastStepTime;
        this.lastStepTime = now;
        if (gap > 20000 && this.profile?.pending && !this.online && (this.solo || this.session?.host)) {
            void this.connectionLost('Симуляция долго не выполнялась (сон или приостановка вкладки). Применено техническое восстановление.');
            return;
        }
        if (this.page === 'raid' && this.snapshot && this.profile) {
            const input = this.controls.input();
            this.inputAt = now;
            if (!this.solo && this.session)
                this.session.input(input);
            else
                this.solo?.input(this.profile.id, input);
        }
        if (!this.solo && this.session)
            this.session.tick();
        else if (this.solo) {
            this.solo.step();
            if (this.solo.tick % 2 === 0)
                this.receiveSnapshot(this.solo.snapshot());
        }
    }
    private frame = (now: number) => {
        if (this.closed)
            return;
        const dt = Math.min((now - (this.lastFrame || now)) / 1000, .1);
        this.lastFrame = now;
        try {
            if (this.page === 'raid' && this.snapshot && this.profile) {
                this.renderer.setMap(MAPS[this.snapshot.mapId]);
                this.renderer.raid(this.snapshot, this.profile.id, { yaw: this.controls.yaw, pitch: this.controls.pitch, fov: this.settings.fov, aim: this.controls.aim, bob: this.settings.bob, quality: this.settings.quality, dt });
                const listener = viewedActor(this.snapshot, this.profile.id);
                if (listener) {
                    const own = listener.id === this.profile.id;
                    this.audio.listener([listener.p[0], listener.p[1] + (listener.input.crouch ? 1.07 : 1.58), listener.p[2]], own ? this.controls.yaw : listener.yaw, own ? this.controls.pitch : listener.pitch);
                    this.audio.motion(listener.id, listener.p, listener.grounded && listener.status === 'active', !!listener.sprinting, !!listener.input.slow, listener.input.crouch, this.mapId);
                }
                if (now - this.hudAt > 90) {
                    this.hudAt = now;
                    this.updateHUD(now);
                }
            }
            else if (this.page !== 'loading')
                this.renderer.workshop(['wardrobe', 'character'].includes(this.page) ? null : this.page === 'gunsmith' ? this.preview : this.profile?.gear.primary || this.menuGun, ['main', 'character', 'wardrobe'].includes(this.page) ? ['character', 'wardrobe'].includes(this.page) ? this.character : this.profile?.character || this.character : null, this.settings.quality, wardrobeEquipment(this.page, this.profile?.gear), ['character', 'wardrobe'].includes(this.page) ? this.wardrobePose : 'idle', now / 1000);
        }
        catch (error) {
            this.toast('Ошибка кадра: ' + (error as Error).message);
            console.error(error);
            this.closed = true;
        }
        if (!this.closed)
            this.frameId = requestAnimationFrame(this.frame);
    };
    private lastFrame = 0;
    private updateHUD(now: number) {
        const s = this.snapshot!, me = s.players.find(a => a.id === this.profile!.id);
        if (!me)
            return;
        const map = MAPS[s.mapId], shown = viewedActor(s, me.id)!, gun = shown.gear[shown.active];
        const viewYaw = shown.id === me.id ? this.controls.yaw : shown.yaw;
        const text = (id: string, t: string) => { const el = document.getElementById(id); if (el)
            el.textContent = t; };
        const html = (id: string, value: string) => { const el = document.getElementById(id); if (el && el.innerHTML !== value) el.innerHTML = value; };
        text('hud-time', timeText(map.duration - s.time));
        text('hud-hp', String(Math.ceil(shown.hp)));
        text('hud-ammo', gun ? `${feedRounds(gun)} + ${gun.chamber || 0}` : '0');
        text('hud-reserve', '/ ' + (gun ? availableRounds(shown.gear, gun) : 0));
        text('hud-gun', gun ? CATALOG[gun.def].name + ' · ' + ((gun.fireMode || (calculateStats(gun).auto ? 'auto' : 'single')) === 'auto' ? 'АВТО' : 'ОДИН') : 'Без оружия');
        text('hud-heading', headingText(viewYaw));
        text('hud-guide', guidanceText(map, { ...shown, yaw: viewYaw }, this.trackedExit, s.activated));
        text('hud-weight', carriedWeightText(shown));
        html('hud-condition', conditionHtml(shown));
        html('hud-objectives', objectivesHtml(this.profile!, me, s.mapId, s.raidId));
        html('hud-quickslots', quickslotsHtml(shown, this.settings));
        if (shown.id !== me.id) text('hud-network', 'НАБЛЮДЕНИЕ · ' + shown.character.name);
        const actionTime = shown.reload || shown.use || shown.search || shown.inspect || 0;
        const actionName = shown.reload ? (shown.reloadMode === 'pack' ? 'Зарядка магазина' : shown.reloadMode === 'charge' ? 'Досылание' : 'Перезарядка') : shown.use ? useLabel(shown) : shown.search ? 'Обыск' : shown.inspect ? 'Осмотр' : '';
        text('hud-action', actionTime ? `${actionName} · ${actionTime.toFixed(1)} с${shown.id === me.id ? ' · ' + keyLabel(this.settings, 'cancel') + ' — отмена' : ''}` : me.status !== 'active' ? 'НАБЛЮДЕНИЕ' : '');
        const health = document.getElementById('health-bar'), stamina = document.getElementById('stamina-bar');
        if (health)
            health.style.width = shown.hp + '%';
        if (stamina)
            stamina.style.width = shown.stamina + '%';
        const mini = document.getElementById('hud-minimap');
        if (mini)
            mini.innerHTML = mapSvg(map, shown, false, s.activated, this.trackedExit);
        const scope = document.getElementById('scope');
        if (scope)
            scope.className = this.renderer.scopeActive ? 'scope-mask' : '';
        document.getElementById('crosshair')?.classList.toggle('aim', this.renderer.aiming);
        document.getElementById('slot-primary')?.classList.toggle('active', shown.active === 'primary');
        document.getElementById('slot-secondary')?.classList.toggle('active', shown.active === 'secondary');
        const hurt = document.getElementById('injury');
        if (hurt)
            hurt.className = shown.hp < 30 || s.time - shown.hurtAt < .45 ? 'injury' : '';
        const extract = document.getElementById('extraction');
        if (extract) {
            const exit = map.exits.find(e => e.id === me.exitId);
            const locked = map.exits.find(e => e.requires && !s.activated?.includes(e.requires) && Math.hypot(me.p[0] - e.p[0], me.p[2] - e.p[2]) < e.radius + 2);
            extract.hidden = (!exit && !locked) || me.status !== 'active';
            extract.textContent = exit ? exit.name + ' · ' + Math.max(0, exit.seconds - me.extraction).toFixed(1) + ' с' : locked ? locked.name + ' · сначала откройте доступ (' + keyLabel(this.settings, 'map') + ' — карта)' : '';
        }
        const subtitle = document.getElementById('subtitle');
        if (subtitle) {
            subtitle.hidden = now > this.subtitleUntil;
            subtitle.textContent = this.subtitle;
        }
        this.target = '';
        const eye: Vec3 = [me.p[0], me.p[1] + (me.input.crouch ? 1.07 : 1.58), me.p[2]], forward = direction(this.controls.yaw, this.controls.pitch);
        let near = 4, label = '';
        if (me.status === 'active' && !this.overlay) {
            for (const c of s.containers) {
                const distance = dist(eye, c.p);
                if (distance < 3.15 && distance < near && dot(norm(sub(c.p, eye)), forward) > .65 && this.collision?.visible(eye, c.p)) {
                    near = distance;
                    this.target = c.id;
                    label = c.name + (c.items.length ? '' : ' · пусто');
                }
            }
            for (const a of map.activators || []) {
                const distance = dist(eye, a.p);
                if (distance < 3.15 && distance < near && dot(norm(sub(a.p, eye)), forward) > .65 && this.collision?.visible(eye, a.p)) {
                    near = distance;
                    this.target = a.id;
                    label = a.name + (s.activated?.includes(a.id) ? ' · открыт' : a.key ? ' · нужен пропуск' : ' · открыть выход');
                }
            }
            for (const d of this.collision?.doors || []) {
                const distance = dist(eye, d.p);
                if (distance < 3.2 && distance < near && dot(norm(sub(d.p, eye)), forward) > .65 && this.collision?.visible(eye, d.p, d.id)) {
                    near = distance;
                    this.target = d.id;
                    label = (d.open ? 'Закрыть' : 'Открыть') + ' · ' + d.name;
                }
            }
        }
        const interaction = document.getElementById('interaction');
        if (interaction) {
            interaction.hidden = !this.target;
            interaction.textContent = this.settings.bindings.interact.replace('Key', '') + ' · ' + label;
        }
        const labels = document.getElementById('teammate-labels');
        if (labels) {
            labels.innerHTML = s.players.filter(a => a.id !== shown.id && a.status === 'active' && this.collision?.visible([shown.p[0], shown.p[1] + 1.58, shown.p[2]], [a.p[0], a.p[1] + (a.input.crouch ? 1.07 : 1.58), a.p[2]])).map(a => { const p = this.renderer.project([a.p[0], a.p[1] + (a.input.crouch ? 1.55 : 2.15), a.p[2]]); return p.visible ? `<span class="remote-label" style="left:${p.x}px;top:${p.y}px">${esc(a.character.name)}</span>` : ''; }).join('');
        }
    }
    dispose() { this.closed = true; for (const url of Object.values(this.patchUrls)) URL.revokeObjectURL(url); this.patchUrls = {}; cancelAnimationFrame(this.frameId); clearInterval(this.tickTimer); void this.inputAt; void QUESTS; this.controls.dispose(); this.renderer.dispose(); this.audio.dispose(); this.session?.close(); this.store.close(); }
}
