import { scavLoadout, reloadScav, scavReloadSeconds } from '../content/scav-loadouts.js';
import { findCover } from './cover.js';
import { muzzlePoint } from '../domain/weapon-pose.js';
import type { Actor, Action, ActionReply, Bot, Character, Container, Door, Equipment, Input, MapDef, Outcome, Snapshot, Vec3, WorldEvent } from '../domain/types.js';
import { loadedRounds, setLoadedRounds, feedRounds, chamberRound, discharge, detachable, reserveMagazines, proposeMagazineSwap, magazineInGear, magazineCapacity } from '../domain/ammunition.js';
import { CATALOG, LOOT } from '../content/catalog.js';
import { BOT_NAMES, VOICES } from '../content/characters.js';
import { bagFits, calculateStats, createItem, createWeapon, flatGear, reserveAmmo, spendAmmo, validateBuild, walk, weight } from '../domain/items.js';
import { validateEquipment, emptyGear } from '../domain/profile.js';
import { armorAbsorption } from '../domain/equipment.js';
import { add, clamp, clone, direction, dist, distXZ, noInput, norm, rng, scale, sub, uid } from '../domain/util.js';
import { Collision, Navigation, raySphere, doorObstacle } from './collision.js';
const navCache = new WeakMap<MapDef, Navigation>();
const STANDING_HITBOXES = [[1.53, .22, true], [.97, .4, false], [.35, .3, false]] as const;
const CROUCHING_HITBOXES = [[1.02, .19, true], [.66, .34, false], [.25, .27, false]] as const;
const GRAVITY = 13;
/** These thresholds are game balance, not a real-world injury model. */
const SAFE_LANDING_SPEED = 8, INJURY_LANDING_SPEED = 10;
function hitboxes(a: Actor | Bot) { return 'input' in a && a.input.crouch ? CROUCHING_HITBOXES : STANDING_HITBOXES; }
export class World {
    readonly collision: Collision;
    readonly navigation: Navigation;
    readonly players = new Map<string, Actor>();
    readonly bots: Bot[] = [];
    readonly containers: Container[] = [];
    readonly events: WorldEvent[] = [];
    readonly activated = new Set<string>();
    tick = 0;
    time = 0;
    private eventId = 0;
    private random: () => number;
    private operations = new Map<string, Map<string, ActionReply>>();
    private previousFire = new Map<string, boolean>();
    private previousJump = new Map<string, boolean>();
    private footstepDistance = new Map<string, number>();
    private medicineHurtAt = new Map<string, number>();
    private botBursts = new Map<string, { remaining: number; nextShot: number }>();
    private actionsAt = new Map<string, number>();
    constructor(readonly map: MapDef, readonly raidId = uid(), readonly friendlyFire = false, seed = Date.now(), readonly range = false) {
        this.collision = new Collision(map);
        let nav = navCache.get(map);
        if (!nav) {
            nav = new Navigation(this.collision);
            navCache.set(map, nav);
        }
        this.navigation = nav;
        this.random = rng(seed);
        if (range)
            return;
        for (const point of map.loot) {
            let candidates = (['weapon', 'module', 'ammo', 'armor'].includes(point.category) ? Object.values(CATALOG) : LOOT).filter(d => d.category === point.category);
            if (!candidates.length)
                candidates = LOOT.filter(d => d.category === 'household');
            const items = [];
            for (let n = 0; n < (point.loose ? 1 : 1 + Math.floor(this.random() * 3)); n++) {
                const weighted = candidates.flatMap(d => Array.from({ length: d.rarity === 0 ? 9 : d.rarity === 1 ? 4 : d.rarity === 2 ? 2 : 1 }, () => d));
                const def = weighted[Math.floor(this.random() * weighted.length)];
                const item = def.category === 'weapon' ? createWeapon(def.id) : createItem(def.id);
                item.condition = 65 + Math.floor(this.random() * 36);
                items.push(item);
            }
            this.containers.push({ id: point.id, name: point.name, p: [...point.p], items, revision: 0, loose: point.loose, searchedBy: [], source: 'world' });
        }
        if (map.id === 'factory') this.containers.find(c => c.id === 'loot12')?.items.push(createItem('loot_documents_10'));
        const names = [...BOT_NAMES].sort(() => this.random() - .5);
        for (const [index, pos] of map.bots.entries()) {
            if (map.spawn.some(s => distXZ(s, pos) < 20 || distXZ(s, pos) < 36 && this.collision.visible([s[0], s[1]+1.58, s[2]], [pos[0],pos[1]+1.5,pos[2]])))
                continue;
            const nearest = this.navigation.closest(pos);
            if (!nearest)
                continue;
            const p = clone(nearest.p);
            // A navigation snap may cross a corner or land in a closed door. Validate the final point.
            if (!this.collision.free(p) || map.spawn.some(s => distXZ(s, p) < 20 || distXZ(s, p) < 36
                && this.collision.visible([s[0], s[1] + 1.58, s[2]], [p[0], p[1] + 1.5, p[2]]))) continue;
            this.bots.push({ id: 'bot-' + index, name: names[index % names.length], p, yaw: 0, hp: 75, mode: 'patrol', ...scavLoadout(index, Math.abs(seed) % 7), timer: .8 + this.random(), target: '', goal: [...p], path: [], lastSeen: [...p], memory: 0, nextThink: 0, voiceAt: -20, shotAt: -1, style: index % 12 });
        }
    }
    addPlayer(id: string, character: Character, gear: Equipment): Actor {
        if (this.players.has(id))
            return this.players.get(id)!;
        if (this.players.size >= this.map.spawn.length)
            throw Error('Отряд заполнен: нет свободной точки появления');
        validateEquipment(gear);
        const spawn = this.map.spawn[this.players.size];
        const a: Actor = { id, character: clone(character), p: clone(spawn), yaw: 0, pitch: 0, hp: 100, stamina: 100, bleed: false, gear: clone(gear), active: gear.primary ? 'primary' : 'secondary', status: 'active', extraction: 0, exitId: '', reload: 0, use: 0, useItem: '', kills: 0, visited: [], light: false, laser: false, lastShot: -100, lastInput: 0, input: noInput(), vy: 0, grounded: true, hurtAt: -100 };
        a.search = 0; a.searchTarget = ''; a.inspect = 0; a.safePosition = clone(spawn); a.recoveries = 0;
        a.legInjury = false; a.exhausted = false; a.sprinting = false;
        for (const g of [a.gear.primary, a.gear.secondary]) if (g) chamberRound(g);
        this.players.set(id, a);
        this.operations.set(id, new Map());
        return a;
    }
    input(id: string, data: Input) {
        const a = this.players.get(id);
        if (!a || a.status !== 'active' || !data || !Number.isSafeInteger(data.seq) || data.seq <= a.input.seq)
            return;
        if (![data.forward, data.right, data.yaw, data.pitch].every(Number.isFinite))
            return;
        if (Math.abs(data.yaw) > 1e6 || Math.abs(data.pitch) > 2 || Math.abs(data.forward) > 1 || Math.abs(data.right) > 1)
            return;
        a.input = { seq: data.seq, forward: data.forward, right: data.right, yaw: data.yaw, pitch: clamp(data.pitch, -1.48, 1.48), sprint: data.sprint === true, slow: data.slow === true, crouch: data.crouch === true, jump: data.jump === true, fire: data.fire === true, aim: data.aim === true };
        a.lastInput = this.time;
    }
    disconnect(id: string) { const a = this.players.get(id); if (a) {
        a.input = { ...noInput(), seq: a.input.seq };
        a.lastInput = this.time - 1;
    } }
    emit(e: Omit<WorldEvent, 'seq'>) { this.events.push({ ...e, seq: ++this.eventId }); if (this.events.length > 100)
        this.events.shift(); }
    gun(a: Actor) { return a.gear[a.active]; }
    action(id: string, action: Action): ActionReply {
        const a = this.players.get(id);
        if (!a || !action || typeof action.id !== 'string' || action.id.length > 120)
            return { id: action?.id || '', ok: false, message: 'Некорректное действие' };
        const log = this.operations.get(id)!;
        if (log.has(action.id))
            return log.get(action.id)!;
        let reply: ActionReply = { id: action.id, ok: true };
        try {
            if (a.status !== 'active')
                throw Error('Рейд этого игрока завершён');
            if (this.time - (this.actionsAt.get(id) ?? -1) < .025)
                throw Error('Слишком частые действия');
            this.actionsAt.set(id, this.time);
            const gun = this.gun(a);
            const busy = a.reload > 0 || a.use > 0 || !!a.search || !!a.inspect;
            switch (action.type) {
                case 'reload': {
                    if (!gun || busy) throw Error('Действие уже выполняется');
                    const d = CATALOG[gun.def], stats = calculateStats(gun);
                    if (!gun.chamber && feedRounds(gun) > 0) {
                        a.reloadMode = 'charge'; a.reloadTarget = ''; a.reload = .65; a.reloadDuration = .65;
                    } else {
                        if (feedRounds(gun) >= stats.capacity) throw Error('Магазин полон');
                        if (this.range) { a.reloadMode = 'range'; a.reloadTarget = ''; }
                        else if (detachable(gun)) {
                            const next = action.item || reserveMagazines(a.gear, gun)[0]?.id;
                            if (!next) throw Error('Нет заряженного запасного магазина. Зарядите его через инвентарь.');
                            const swap = proposeMagazineSwap(a.gear, gun, next);
                            if (!bagFits(swap.bag)) throw Error('Нет места для снятого магазина');
                            a.reloadMode = 'swap'; a.reloadTarget = next;
                        } else {
                            if (reserveAmmo(a.gear, d.ammo!) <= 0) throw Error('Нет подходящих патронов в рюкзаке');
                            a.reloadMode = 'rounds'; a.reloadTarget = '';
                        }
                        a.reload = stats.reload; a.reloadDuration = stats.reload;
                    }
                    a.reloadGun = gun.id; a.reloadEmpty = !gun.chamber;
                    this.emit({type:'mechanic', p:[...a.p], actor:id, def:gun.def, text:'reload'});
                    break;
                }
                case 'load-mag': {
                    if (busy) throw Error('Действие уже выполняется');
                    const mag = magazineInGear(a.gear, action.item || '');
                    if (!mag) throw Error('Магазин недоступен');
                    if (mag.rounds >= magazineCapacity(mag)) throw Error('Магазин полон');
                    if (reserveAmmo(a.gear, CATALOG[mag.def].ammo!) <= 0) throw Error('Нет подходящих патронов в рюкзаке');
                    a.reloadGun = gun?.id;
                    a.reloadMode = 'pack'; a.reloadTarget = mag.id; a.reload = .32; a.reloadDuration = .32;
                    break;
                }
                case 'switch':
                    if (a.use > 0)
                        throw Error('Сначала завершите действие');
                    if (action.target !== 'primary' && action.target !== 'secondary')
                        throw Error('Неверный слот');
                    if (!a.gear[action.target])
                        throw Error('Слот пуст');
                    a.active = action.target;
                    a.reload = 0; a.reloadTarget = ''; a.reloadGun = ''; a.inspect = 0; a.search = 0; a.searchTarget = '';
                    a.light = false; a.laser = false;
                    a.lastShot = this.time + .25;
                    break;
                case 'cancel':
                    a.reload = 0; a.reloadTarget = ''; a.reloadGun = ''; a.use = 0; a.useItem = '';
                    a.search = 0; a.searchTarget = ''; a.inspect = 0;
                    break;
                case 'fire-mode':
                    if (!gun || busy) throw Error('Сначала завершите действие');
                    if (!CATALOG[gun.def].stats?.auto) throw Error('У этого оружия только одиночный огонь');
                    gun.fireMode = (gun.fireMode || 'auto') === 'auto' ? 'single' : 'auto';
                    this.emit({type:'mechanic', p:[...a.p], actor:id, text:gun.fireMode});
                    break;
                case 'inspect':
                    if (!gun || busy) throw Error('Сначала завершите действие');
                    a.inspect = 1.8;
                    this.emit({type:'mechanic', p:[...a.p], actor:id, def:gun.def, text:'inspect'});
                    break;
                case 'light':
                    if (!gun || !walk(gun).some(n => CATALOG[n.item.def].shape.startsWith('light')))
                        throw Error('На оружии нет фонаря');
                    a.light = !a.light;
                    break;
                case 'laser':
                    if (!gun || !walk(gun).some(n => CATALOG[n.item.def].shape.startsWith('laser')))
                        throw Error('На оружии нет лазера');
                    a.laser = !a.laser;
                    break;
                case 'use': {
                    const i = a.gear.bag.find(i => i.id === action.item);
                    if (!i || !CATALOG[i.def].effect)
                        throw Error('Предмет нельзя использовать');
                    if (busy)
                        throw Error('Действие уже выполняется');
                    const effect = CATALOG[i.def].effect;
                    if (effect === 'heal' && a.hp >= 100) throw Error('Здоровье уже полное');
                    if (effect === 'bandage' && !a.bleed) throw Error('Кровотечения нет');
                    if (effect === 'energy' && a.stamina >= 100) throw Error('Выносливость уже полная');
                    if (effect === 'splint' && !a.legInjury) throw Error('Травмы ноги нет');
                    if (effect === 'splint' && !a.grounded) throw Error('Для наложения шины встаньте на землю');
                    a.useItem = i.id;
                    a.use = effect === 'heal' ? 3 : effect === 'splint' ? 4 : 2;
                    this.medicineHurtAt.set(a.id, a.hurtAt);
                    break;
                }
                case 'interact': {
                    if (busy) throw Error('Сначала завершите действие');
                    const activator = this.map.activators?.find(c => c.id === action.target);
                    if (activator) {
                        this.checkReach(a, activator.p);
                        if (activator.key && !flatGear(a.gear).some(i => i.def === activator.key)) throw Error('Нужен пропуск администрации');
                        this.activated.add(activator.id);
                        this.emit({type:'mechanic', p:activator.p, actor:id, text:'exit-unlocked'});
                        this.hear(activator.p, 16);
                        break;
                    }
                    const door = this.collision.doors.find(d => d.id === action.target);
                    if (door) {
                        this.checkReach(a, door.p, 3.3, door.id);
                        if (this.doorOccupied(door))
                            throw Error('Отойдите от створки двери');
                        door.open = !door.open;
                        this.emit({ type: 'door', p: door.p });
                        this.hear(door.p, 12);
                        break;
                    }
                    const c = this.containers.find(c => c.id === action.target);
                    if (!c)
                        throw Error('Контейнер не найден');
                    this.checkReach(a, c.p);
                    if (!c.loose && c.items.length && !c.searchedBy?.includes(id)) {
                        a.searchTarget = c.id;
                        a.searchDuration = Math.min(2.6, 1.2 + c.items.length * .22);
                        a.search = a.searchDuration;
                        this.hear(a.p, 5);
                    }
                    reply.container = c.id;
                    break;
                }
                case 'take': {
                    const c = this.containers.find(c => c.id === action.target);
                    if (!c)
                        throw Error('Контейнер не найден');
                    this.checkReach(a, c.p);
                    if (busy || !c.loose && !c.searchedBy?.includes(id)) throw Error('Сначала обыщите контейнер');
                    if (action.revision !== c.revision)
                        throw Error('Содержимое изменилось — выберите предмет снова');
                    const at = c.items.findIndex(i => i.id === action.item);
                    if (at < 0)
                        throw Error('Предмет уже забрали');
                    const item = clone(c.items[at]);
                    if (!bagFits([...a.gear.bag, item]))
                        throw Error('Нет места или слишком тяжело');
                    if (c.source !== 'player') {
                        item.found = this.raidId;
                        item.foundMap = this.map.id;
                    }
                    a.gear.bag.push(item);
                    c.items.splice(at, 1);
                    c.revision++;
                    this.emit({ type: 'loot', p: c.p, actor: id });
                    reply.container = c.id;
                    break;
                }
                case 'drop': {
                    if (a.useItem === action.item || a.reloadTarget === action.item) throw Error('Предмет занят текущим действием');
                    const at = a.gear.bag.findIndex(i => i.id === action.item);
                    if (at < 0)
                        throw Error('Предмет не найден');
                    const item = a.gear.bag.splice(at, 1)[0];
                    this.containers.push({ id: 'drop-'+uid(), name: 'Оставленная вещь', p: [a.p[0], this.collision.floor(a.p, .02) + .03, a.p[2]], items: [item], revision: 0, loose: true, source: 'player' });
                    break;
                }
                case 'abandon':
                    this.finish(a, 'missing', 'Рейд покинут вручную');
                    break;
                default: throw Error('Неизвестный тип действия');
            }
        }
        catch (error) {
            reply = { id: action.id, ok: false, message: (error as Error).message };
        }
        log.set(action.id, reply);
        if (log.size > 1000)
            log.delete(log.keys().next().value!);
        return reply;
    }
    /** Players and bots share the same occupied-leaf rule. */
    private doorOccupied(door: Door): boolean {
        const leaves = [doorObstacle({ ...door, open: false }), doorObstacle({ ...door, open: true })];
        const actors: (Actor | Bot)[] = [...[...this.players.values()].filter(a => a.status === 'active'), ...this.bots.filter(b => b.mode !== 'dead')];
        return actors.some(a => leaves.some(b => Math.abs(a.p[0] - b.p[0]) < b.s[0] / 2 + .37
            && Math.abs(a.p[2] - b.p[2]) < b.s[2] / 2 + .37
            && a.p[1] < b.p[1] + b.s[1] / 2
            && a.p[1] + ('input' in a && a.input.crouch ? 1.17 : 1.72) > b.p[1] - b.s[1] / 2));
    }
    private checkReach(a: Actor, p: Vec3, max = 3.2, ignoreId = '') { const eye: Vec3 = [a.p[0], a.p[1] + (a.input.crouch ? 1.07 : 1.58), a.p[2]]; if (dist(eye, p) > max)
        throw Error('Подойдите ближе'); if (!this.collision.visible(eye, p, ignoreId))
        throw Error('Объект за препятствием'); }
    step(dt = 1 / 30) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        dt = clamp(dt, 0, .1);
        this.time += dt;
        this.tick++;
        // Empty player-dropped shells are disposable; never remove unclaimed loot or map containers.
        if(this.tick%90===0 && this.containers.length>128) for(let i=this.containers.length-1;i>=0;i--)
            if(this.containers[i].id.startsWith('drop-') && !this.containers[i].items.length) this.containers.splice(i,1);

        for (const a of this.players.values())
            if (a.status === 'active')
                this.stepPlayer(a, dt);
        if (!this.range)
            for (const b of this.bots)
                if (b.mode !== 'dead')
                    this.stepBot(b, dt);
        if (!this.range) for (const a of this.players.values()) if (a.status === 'active') this.stepExtraction(a, dt);
        if (!this.range && this.time >= this.map.duration)
            for (const a of this.players.values())
                if (a.status === 'active')
                    this.finish(a, 'missing', 'Время рейда истекло');
    }
    private recoverPosition(a: Actor) {
        a.p = [...(a.safePosition || this.map.spawn[0])]; a.vy = 0; a.grounded = true; a.sprinting = false;
        a.input = { ...noInput(), seq: a.input.seq, yaw: a.yaw, pitch: a.pitch, crouch: a.input.crouch };
        a.recoveries = (a.recoveries || 0) + 1;
        this.emit({ type: 'mechanic', p: [...a.p], actor: a.id, text: 'position-recovery' });
        if (a.recoveries > 2) this.finish(a, 'technical', 'Повторная ошибка положения персонажа');
    }
    private stepPlayer(a: Actor, dt: number) {
        // Corrupt/below-world positions recover before gravity can manufacture a landing impact.
        if (!a.p.every(Number.isFinite) || a.p[1] < -8) { this.recoverPosition(a); return; }
        const input = this.time - a.lastInput > .4 ? { ...noInput(), seq: a.input.seq, yaw: a.yaw, pitch: a.pitch, crouch: a.input.crouch } : { ...a.input };
        if (!input.crouch && !this.collision.free(a.p, .33, 1.72)) input.crouch = true;
        // Snapshots, hitboxes and the muzzle all consume the actual, allowed stance.
        a.input = input;
        a.yaw = input.yaw;
        a.pitch = input.pitch;
        const moving = Math.hypot(input.forward, input.right) > .05;
        if (a.stamina <= 3) a.exhausted = true;
        if (a.exhausted && a.stamina >= 25) a.exhausted = false;
        const sprint = input.sprint && moving && a.stamina > 3 && !a.exhausted && !a.legInjury && !input.aim && !input.crouch && !input.slow && !input.fire && !a.reload && !a.search && !a.use && !a.inspect;
        a.sprinting = sprint;
        a.stamina = clamp(a.stamina + (sprint ? -17 : 11) * dt, 0, 100);
        if (sprint && a.stamina <= 3) a.exhausted = true;
        const burden = weight(flatGear(a.gear)), speed = (input.crouch ? 1.8 : sprint ? 6.2 : input.slow ? 1.45 : 3.5) * (input.aim ? .72 : 1) * (a.legInjury ? .7 : 1) * clamp(1 - (burden - 18) * .012, .68, 1);
        const amount = Math.max(1, Math.hypot(input.forward, input.right));
        const dx = (-Math.sin(a.yaw) * input.forward + Math.cos(a.yaw) * input.right) / amount * speed * dt;
        const dz = (-Math.cos(a.yaw) * input.forward - Math.sin(a.yaw) * input.right) / amount * speed * dt;
        const height = input.crouch ? 1.17 : 1.72;
        const before = [...a.p] as Vec3;
        a.p = this.collision.move(a.p, dx, dz, .33, height);
        if (input.jump && !this.previousJump.get(a.id) && a.grounded && !input.crouch && !a.legInjury && !a.exhausted && a.stamina > 10) {
            a.vy = 4.6;
            a.grounded = false;
            a.stamina -= 10;
        }
        this.previousJump.set(a.id, input.jump);
        const airborne = !a.grounded, startY = a.p[1], startVelocity = a.vy;
        const nextY = startY + startVelocity * dt - .5 * GRAVITY * dt * dt, floor = this.collision.floor(a.p, .07);
        a.vy -= GRAVITY * dt;
        if (nextY <= floor) {
            const impactSpeed = airborne && floor <= startY ? Math.sqrt(Math.max(0, startVelocity ** 2 + 2 * GRAVITY * (startY - floor))) : 0;
            a.p[1] = floor;
            a.vy = 0;
            a.grounded = true;
            if (impactSpeed > 3) {
                this.emit({ type: 'mechanic', p: [...a.p], actor: a.id, text: impactSpeed > SAFE_LANDING_SPEED ? 'land-hard' : 'land' });
                this.hear(a.p, impactSpeed > SAFE_LANDING_SPEED ? 20 : 9);
                if (impactSpeed > SAFE_LANDING_SPEED) this.damageFall(a, impactSpeed);
                if (a.status !== 'active') return;
            }
        }
        else {
            const test: Vec3 = [a.p[0], nextY, a.p[2]];
            if (a.vy > 0 && !this.collision.free(test, .32, height))
                a.vy = 0;
            else
                a.p[1] = nextY;
            a.grounded = false;
        }
        if (!a.p.every(Number.isFinite) || a.p[1] < -8) {
            this.recoverPosition(a); return;
        } else if (a.grounded && this.collision.free(a.p, .33, height)) a.safePosition = [...a.p];
        for (const p of this.map.pois)
            if (distXZ(p.p, a.p) < 7 && Math.abs(p.p[1] - a.p[1]) < 1.2 && !a.visited.includes(p.id))
                a.visited.push(p.id);
        if (a.grounded && a.p.every(Number.isFinite) && before.every(Number.isFinite)) {
            const travel = (this.footstepDistance.get(a.id) || 0) + distXZ(before, a.p);
            if (travel >= (sprint ? 1.65 : 1.25)) {
                this.hear(a.p, sprint ? 17 : input.crouch || input.slow ? 3 : 8);
                this.footstepDistance.set(a.id, 0);
            } else this.footstepDistance.set(a.id, travel);
        }
        if (a.bleed) {
            a.hp = Math.max(0, a.hp - .7 * dt);
            if (a.hp <= 0) {
                this.finish(a, 'dead', 'Кровотечение');
                return;
            }
        }
        a.inspect = Math.max(0, (a.inspect || 0) - dt);
        if (a.search) {
            const c = this.containers.find(c => c.id === a.searchTarget);
            let reachable = !!c;
            if (c) { try { this.checkReach(a, c.p); } catch { reachable = false; } }
            if (!reachable || moving || input.fire || this.time - a.hurtAt < .15) {
                a.search = 0; a.searchTarget = '';
            } else {
                a.search = Math.max(0, a.search - dt);
                if (!a.search && c) { c.searchedBy = [...new Set([...(c.searchedBy || []), a.id])]; a.searchTarget = ''; }
            }
        }
        if (a.use > 0) {
            const usingSplint = a.gear.bag.some(i => i.id === a.useItem && CATALOG[i.def].effect === 'splint');
            if (moving || input.fire || usingSplint && !a.grounded || a.hurtAt > (this.medicineHurtAt.get(a.id) ?? a.hurtAt)) {
                a.use = 0;
                a.useItem = '';
            }
            else {
                a.use = Math.max(0, a.use - dt);
                if (!a.use) {
                    const i = a.gear.bag.find(i => i.id === a.useItem);
                    if (i) {
                        const effect = CATALOG[i.def].effect;
                        const needed = effect === 'heal' ? a.hp < 100 : effect === 'bandage' ? a.bleed : effect === 'splint' ? !!a.legInjury : a.stamina < 100;
                        if (effect === 'heal')
                            a.hp = Math.min(100, a.hp + 48);
                        if (effect === 'bandage')
                            a.bleed = false;
                        if (effect === 'energy') { a.stamina = 100; a.exhausted = false; }
                        if (effect === 'splint') a.legInjury = false;
                        if (needed) {
                            i.qty--;
                            a.gear.bag = a.gear.bag.filter(i => i.qty > 0);
                            this.emit({ type: 'use', p: a.p, actor: a.id, def: i.def });
                        }
                    }
                    a.useItem = '';
                }
            }
        }
        const gun = this.gun(a);
        if (a.reload > 0) {
            const packing = a.reloadMode === 'pack';
            if ((packing && (moving || input.fire || this.time - a.hurtAt < .15)) || (!packing && gun?.id !== a.reloadGun)) {
                a.reload = 0; a.reloadTarget = '';
            } else {
                a.reload = Math.max(0, a.reload - dt);
                if (!a.reload) {
                    if (packing) {
                        const mag = magazineInGear(a.gear, a.reloadTarget || '');
                        if (mag && mag.rounds < magazineCapacity(mag)) {
                            mag.rounds += spendAmmo(a.gear, CATALOG[mag.def].ammo!, 1, mag);
                            if (mag.rounds < magazineCapacity(mag) && reserveAmmo(a.gear, CATALOG[mag.def].ammo!) > 0) a.reload = .32;
                        }
                    } else if (gun) {
                        const stats = calculateStats(gun);
                        if (a.reloadMode === 'charge') chamberRound(gun);
                        else if (a.reloadMode === 'swap') {
                            try {
                                const swap = proposeMagazineSwap(a.gear, gun, a.reloadTarget || '');
                                if (!bagFits(swap.bag)) throw Error('Нет места для снятого магазина');
                                a.gear.bag = swap.bag; gun.children.magazine = swap.next; gun.rounds = 0;
                                chamberRound(gun);
                            } catch { /* Inventory may change: atomic swap leaves original untouched. */ }
                        } else if (this.range && detachable(gun)) setLoadedRounds(gun, stats.capacity + 1);
                        else {
                            const room = Math.max(0, stats.capacity - feedRounds(gun));
                            const used = room > 0 ? this.range ? 1 : spendAmmo(a.gear, CATALOG[gun.def].ammo!, 1, gun) : 0;
                            gun.rounds += used; chamberRound(gun);
                            if (used && feedRounds(gun) < stats.capacity && (this.range || reserveAmmo(a.gear, CATALOG[gun.def].ammo!) > 0) && !input.fire) a.reload = stats.reload;
                        }
                    }
                }
            }
        }
        const prev = this.previousFire.get(a.id) || false;
        if (gun && input.fire && ((gun.fireMode ? gun.fireMode === 'auto' : calculateStats(gun).auto) || !prev) && !a.use && !a.search && !a.inspect) {
            if (a.reload && !detachable(gun))
                a.reload = 0;
            if (!a.reload)
                this.fire(a);
        }
        this.previousFire.set(a.id, input.fire);
    }
    private stepExtraction(a: Actor, dt: number) {
        if (!this.range) {
            // Resolve landing (and fatal fall damage) before a player can leave the raid.
            const exit = a.grounded ? this.map.exits.find(e => (!e.requires || this.activated.has(e.requires)) && distXZ(a.p, e.p) < e.radius && Math.abs(a.p[1] - e.p[1]) < 1.2) : undefined;
            if (exit) {
                if (a.exitId !== exit.id) {
                    a.exitId = exit.id;
                    a.extraction = 0;
                }
                a.extraction += dt;
                if (a.extraction >= exit.seconds)
                    this.finish(a, 'extracted');
            }
            else {
                a.extraction = 0;
                a.exitId = '';
            }
        }
    }
    private fire(a: Actor) {
        const gun = this.gun(a);
        if (!gun || validateBuild(gun).length)
            return;
        const stats = calculateStats(gun);
        if (this.time - a.lastShot < 60 / stats.rpm || loadedRounds(gun) <= 0)
            return;
        if (!discharge(gun)) return;
        a.lastShot = this.time;
        const eye: Vec3 = [a.p[0], a.p[1] + (a.input.crouch ? 1.07 : 1.58), a.p[2]], forward = direction(a.yaw, a.pitch);
        const muzzle = muzzlePoint(gun, eye, a.yaw, a.pitch, a.input.aim);
        const obstruction = this.collision.ray(eye, norm(sub(muzzle, eye)), dist(eye, muzzle));
        const blocked = obstruction.t < dist(eye, muzzle) - .01;
        let mainTo = add(eye, scale(forward, 80)), didHit = false;
        for (let k = 0; k < stats.pellets; k++) {
            const scatter = stats.pellets > 1 ? stats.spread * .6 : (a.input.aim ? .0007 : .004) * (1 + stats.recoil) * (stats.spread / .018);
            const d = direction(a.yaw + (this.random() - .5) * scatter, a.pitch + (this.random() - .5) * scatter);
            let max = this.collision.ray(eye, d, 160).t;
            if (blocked)
                max = obstruction.t;
            let target: Bot | Actor | undefined, head = false;
            const enemies: (Bot | Actor)[] = [...this.bots.filter(b => b.mode !== 'dead'), ...(this.friendlyFire ? [...this.players.values()].filter(p => p.id !== a.id && p.status === 'active') : [])];
            for (const enemy of enemies) {
                for (const [h, r, isHead] of hitboxes(enemy)) {
                    const hit = raySphere(eye, d, [enemy.p[0], enemy.p[1] + h, enemy.p[2]], r, max);
                    if (hit !== null) {
                        max = hit;
                        target = enemy;
                        head = isHead;
                    }
                }
            }
            let to = add(eye, scale(d, max));
            if (blocked) {
                to = add(eye, scale(norm(sub(muzzle, eye)), obstruction.t));
                target = undefined;
            } else {
                const trajectory = norm(sub(to, muzzle)), length = dist(muzzle, to);
                const wall = this.collision.ray(muzzle, trajectory, length);
                if (wall.t < length - .02) { to = add(muzzle, scale(trajectory, wall.t)); target = undefined; }
            }
            if (k === 0)
                mainTo = to;
            if (target) {
                didHit = true;
                if ('character' in target)
                    this.damagePlayer(target, stats.damage * (head ? 1.65 : 1), head);
                else {
                    target.hp -= stats.damage * (head ? 1.65 : 1);
                    target.lastSeen = [...a.p];
                    target.goal = [...a.p];
                    target.memory = 5;
                    target.target = a.id;
                    if (target.mode === 'patrol')
                        target.mode = 'alert';
                    target.timer = 1;
                    if (target.hp <= 0) {
                        this.killBot(target);
                        a.kills++;
                    }
                }
            }
            this.emit({ type: 'hit', p: to, actor: a.id, hit: !!target });
        }
        this.emit({ type: 'shot', p: muzzle, to: mainTo, actor: a.id, def: gun.def, suppressed: stats.noise < .6, hit: didHit });
        this.hear(a.p, stats.noise * 60);
    }
    private damageFall(a: Actor, speed: number) {
        // Only a real landing calls this path; armor and random gunshot bleeding do not apply.
        a.hp = Math.max(0, a.hp - (speed - SAFE_LANDING_SPEED) * 6);
        a.hurtAt = this.time;
        a.use = 0; a.useItem = ''; a.search = 0; a.searchTarget = ''; a.inspect = 0;
        a.reload = 0; a.reloadTarget = ''; a.reloadGun = ''; a.sprinting = false;
        a.stamina = Math.max(0, a.stamina - 20);
        if (speed >= INJURY_LANDING_SPEED && !a.legInjury) {
            a.legInjury = true;
            this.emit({ type: 'mechanic', p: [...a.p], actor: a.id, text: 'leg-injury' });
        }
        this.emit({ type: 'hit', p: [...a.p], actor: a.id, hit: true });
        if (a.hp <= 0) this.finish(a, 'dead', 'Падение с высоты');
    }
    private damagePlayer(a: Actor, amount: number, head = false) { if (a.status !== 'active')
        return; const armor = head ? a.gear.helmet : a.gear.armor; if (armor && armor.condition > 0) {
        amount *= 1 - armorAbsorption(armor);
        armor.condition = Math.max(0, armor.condition - amount * .55);
    } a.hp = Math.max(0, a.hp - amount); a.hurtAt = this.time; a.use = 0; a.useItem = ''; a.search = 0; a.searchTarget = ''; a.inspect = 0; if (this.random() < .12)
        a.bleed = true; this.emit({ type: 'hit', p: [a.p[0], a.p[1] + 1, a.p[2]], actor: a.id, hit: true }); if (a.hp <= 0)
        this.finish(a, 'dead', head ? 'Огнестрельное попадание в голову' : 'Огнестрельное попадание'); }
    private killBot(b: Bot) { if (b.mode === 'dead')
        return; b.mode = 'dead'; b.hp = 0; b.path = []; this.botBursts.delete(b.id); const items = [b.weapon, ...b.supplies, createItem('loot_medical_01')]; b.supplies = []; this.containers.push({ id: 'corpse-' + b.id, name: b.name, p: [b.p[0], b.p[1] + .4, b.p[2]], items, revision: 0, loose: false, source: 'world' }); this.emit({ type: 'death', p: b.p, actor: b.id }); }
    finish(a: Actor, outcome: Outcome, cause?: string) {
        if (a.status !== 'active')
            return;
        a.status = outcome;
        a.input = noInput();
        a.sprinting = false;
        a.extraction = 0;
        a.reload = 0;
        a.use = 0; a.useItem = ''; a.search = 0; a.searchTarget = ''; a.inspect = 0;
        if (outcome === 'dead' || outcome === 'missing') {
            const loot = flatGear({ ...a.gear, safe: [] });
            if (loot.length)
                this.containers.push({ id: 'corpse-' + a.id, name: a.character.name, p: [a.p[0], a.p[1] + .35, a.p[2]], items: clone(loot), revision: 0, loose: false, source: 'player' });
            const safe = clone(a.gear.safe);
            a.gear = emptyGear();
            a.gear.safe = safe;
            this.emit({ type: 'death', p: a.p, actor: a.id });
        }
        a.result = { cause, id: this.raidId + ':' + a.id + ':' + outcome, raidId: this.raidId, playerId: a.id, outcome, map: this.map.id, seconds: Math.round(this.time), kills: a.kills, gear: clone(a.gear), visited: [...a.visited] };
    }
    private voice(b: Bot, context: string) { if (this.time - b.voiceAt < 9)
        return; const pool = VOICES.filter(v => v.context === context); if (!pool.length)
        return; const voice = pool[Math.floor(this.random() * pool.length)]; b.voiceAt = this.time; this.emit({ type: 'voice', p: [...b.p], actor: b.id, text: voice.text }); }
    private canSee(b: Bot, a: Actor, eye: Vec3): boolean {
        const distance = distXZ(a.p, b.p), sightRange = a.input.crouch && a.input.slow && !a.light ? 27 : 36;
        if (a.status !== 'active' || distance >= sightRange || Math.abs(a.p[1] - b.p[1]) >= 7) return false;
        const to = norm([a.p[0] - b.p[0], 0, a.p[2] - b.p[2]]), forward = direction(b.yaw, 0);
        // A close silhouette is noticeable; beyond it, vision has a 140-degree cone.
        if (distance > 4 && forward[0] * to[0] + forward[2] * to[2] < Math.cos(70 * Math.PI / 180)) return false;
        return this.collision.visible(eye, [a.p[0], a.p[1] + (a.input.crouch ? 1.02 : 1.3), a.p[2]]);
    }
    private hear(p: Vec3, radius: number, source = '') {
        for (const b of this.bots) {
            if (b.id === source || !['patrol', 'investigate', 'search'].includes(b.mode) || Math.abs(b.p[1] - p[1]) >= 5) continue;
            const blocked = !this.collision.visible([b.p[0], b.p[1] + 1.5, b.p[2]], [p[0], p[1] + .8, p[2]]);
            if (distXZ(b.p, p) >= radius * (blocked ? .45 : 1)) continue;
            const uncertainty = blocked ? 6 : 3;
            b.lastSeen = [p[0] + (this.random() - .5) * uncertainty, p[1], p[2] + (this.random() - .5) * uncertainty];
            b.goal = [...b.lastSeen];
            b.memory = 5;
            b.path = [];
            b.mode = 'investigate';
            b.nextThink = 0;
            const to = sub(b.lastSeen, b.p);
            b.yaw = Math.atan2(-to[0], -to[2]);
            this.voice(b, 'investigate');
        }
    }
    private stepBot(b: Bot, dt: number) {
        b.timer = Math.max(0, b.timer - dt);
        b.memory = Math.max(0, b.memory - dt);
        const eye: Vec3 = [b.p[0], b.p[1] + 1.5, b.p[2]];
        if (this.time >= b.nextThink) {
            b.nextThink = this.time + .3;
            const visible = [...this.players.values()].filter(a => this.canSee(b, a, eye)).sort((a, c) => distXZ(a.p, b.p) - distXZ(c.p, b.p))[0];
            if (visible) {
                b.target = visible.id;
                b.lastSeen = [...visible.p];
                b.memory = 6;
                if (b.mode === 'patrol' || b.mode === 'investigate' || b.mode === 'search') {
                    b.mode = 'alert';
                    b.timer = .95 + this.random() * .45;
                    this.voice(b, 'spotted');
                }
                if (b.mode === 'alert' && !b.timer)
                    b.mode = 'attack';
                if (b.mode === 'attack' && b.hp < 30 && this.random() < .18) {
                    const cover = findCover(this.collision, this.navigation, b.p, visible.p);
                    b.mode = cover ? 'seekCover' : 'retreat';
                    b.timer = 4;
                    const away = norm(sub(b.p, visible.p));
                    b.goal = cover?.goal || add(b.p, scale(away, 7));
                    b.path = cover?.path || this.navigation.path(b.p, b.goal);
                    this.voice(b, 'retreat');
                }
            }
            else if (b.mode === 'attack' || b.mode === 'alert') {
                b.mode = 'search';
                b.goal = [...b.lastSeen];
                b.path = this.navigation.path(b.p, b.goal);
            }
            if ((b.mode === 'search' || b.mode === 'investigate') && !b.memory && !visible) {
                b.target = '';
                b.mode = 'patrol';
                b.path = [];
            }
            if ((b.mode === 'retreat' || b.mode === 'seekCover') && !b.timer) {
                b.mode = visible ? 'attack' : 'search';
            }
            if (b.mode === 'reload' && !b.timer) {
                if (!reloadScav(b.weapon, b.supplies)) { b.mode = 'retreat'; b.timer = 4; return; }
                b.mode = visible ? 'attack' : 'search';
                this.botBursts.set(b.id, { remaining: 0, nextShot: this.time + .3 });
            }
            if ((b.mode === 'patrol' || b.mode === 'investigate' || b.mode === 'search') && (!b.path.length || distXZ(b.p, b.goal) < 1.5)) {
                if (b.mode === 'patrol') {
                    const nearby = this.map.bots.filter(p => distXZ(p,b.p)<65);
                    const base = nearby[Math.floor(this.random() * nearby.length)] || b.p;
                    b.goal = [base[0] + (this.random() - .5) * 10, base[1], base[2] + (this.random() - .5) * 10];
                    if (this.random() < .08)
                        this.voice(b, this.map.id === 'factory' ? 'factory' : 'idle');
                }
                else if (b.mode === 'investigate' && distXZ(b.p, b.goal) < 2) {
                    b.mode = 'search';
                    b.memory = 3;
                }
                b.path = this.navigation.path(b.p, b.goal);
            }
        }
        const target = this.players.get(b.target);
        if ((b.mode === 'alert' || b.mode === 'attack') && target) {
            const d = sub(b.lastSeen, b.p);
            b.yaw = Math.atan2(-d[0], -d[2]);
        }
        if (b.mode === 'attack' && target && this.canSee(b, target, eye)) {
            const stats = calculateStats(b.weapon);
            if (loadedRounds(b.weapon) <= 0) {
                b.mode = 'reload';
                b.timer = scavReloadSeconds(b.weapon);
                this.voice(b, 'reload');
            }
            else {
                let burst = this.botBursts.get(b.id);
                if (!burst) { burst = { remaining: 0, nextShot: Math.max(this.time, b.shotAt + .45) }; this.botBursts.set(b.id, burst); }
                if (this.time < burst.nextShot) return;
                if (burst.remaining <= 0) burst.remaining = stats.auto ? 2 + Math.floor(this.random() * 2) : 1;
                b.shotAt = this.time;
                discharge(b.weapon);
                burst.remaining--;
                burst.nextShot = this.time + Math.max(60 / stats.rpm, burst.remaining > 0 ? .19 + this.random() * .11 : .8 + this.random() * .65);
                const distance = distXZ(b.p, target.p), scatter = .9 + distance * (b.weapon.def === 'weapon_mosin9130' || b.weapon.def === 'weapon_svd' ? .035 : .053);
                const aimAt: Vec3 = [target.p[0] + (this.random() - .5) * scatter, target.p[1] + (target.input.crouch ? .68 : 1.05) + (this.random() - .5) * (target.input.crouch ? .55 : .9), target.p[2] + (this.random() - .5) * scatter];
                const aim = norm(sub(aimAt, eye));
                let length = this.collision.ray(eye, aim, 80).t, hit: Actor | undefined, head = false;
                // Damage and visual tracer use the same obstructed ray, not a separate random roll.
                for (const player of this.players.values()) if (player.status === 'active')
                    for (const [height, radius, isHead] of hitboxes(player)) {
                        const t = raySphere(eye, aim, [player.p[0], player.p[1] + height, player.p[2]], radius, length);
                        if (t !== null) { length = t; hit = player; head = isHead; }
                    }
                if (hit) this.damagePlayer(hit, stats.damage * (.32 + this.random() * .12), head);
                this.emit({ type: 'shot', p: eye, to: add(eye, scale(aim, length)), actor: b.id, def: b.weapon.def, hit: !!hit });
                this.hear(b.p, 42, b.id);
                this.voice(b, 'attack');
            }
        }
        if (['patrol', 'investigate', 'search', 'retreat', 'seekCover'].includes(b.mode) && b.path.length) {
            const point = b.path[0];
            if (distXZ(b.p, point) < .35) {
                b.path.shift();
                return;
            }
            const d = norm([point[0] - b.p[0], 0, point[2] - b.p[2]]);
            b.yaw = Math.atan2(-d[0], -d[2]);
            const speed = b.mode === 'retreat' || b.mode === 'seekCover' ? 3 : 1.65;
            for (const door of this.collision.doors)
                if (!door.open && distXZ(b.p, door.p) < 1.9 && Math.abs(b.p[1] - (door.p[1] - door.s[1] / 2)) < 1.3
                    && this.collision.visible(eye, door.p, door.id) && !this.doorOccupied(door)) {
                    door.open = true;
                    this.emit({ type: 'door', p: door.p });
                }
            const before = [...b.p] as Vec3;
            b.p = this.collision.move(b.p, d[0] * dt * speed, d[2] * dt * speed);
            b.p[1] = this.collision.floor(b.p, .4);
            if (distXZ(before, b.p) < .001 && this.tick % 30 === 0) {
                b.path = this.navigation.path(b.p, b.goal);
                if (b.path.length)
                    b.path.shift();
            }
        }
    }
    snapshot(): Snapshot { return { raidId: this.raidId, tick: this.tick, time: this.time, mapId: this.map.id, players: clone([...this.players.values()]), bots: clone(this.bots), containers: clone(this.containers), doors: Object.fromEntries(this.collision.doors.map(d => [d.id, d.open])), events: clone(this.events), friendlyFire: this.friendlyFire, activated: [...this.activated] }; }
}
