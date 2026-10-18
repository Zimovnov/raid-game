import type { Profile, Character, Equipment, Item, BuildPreset, RaidResult } from './types.js';
import { CATALOG, QUESTS, TRADERS } from '../content/catalog.js';
import { createItem, createWeapon, walk, calculateStats, validateBuild, validateItem, value, fromPreset, flatGear, stashFits, bagFits, pack } from './items.js';
import { loadedRounds, isMagazine, magazineCapacity } from './ammunition.js';
import { uid, clone, check, cleanName, safeRecord } from './util.js';
import { isAppearance, normalizeAppearance } from '../content/apparel.js';
import { equipmentSlot } from './equipment.js';
import { isPatchSelection } from './patches.js';
export const emptyGear = (): Equipment => ({ primary: null, secondary: null, armor: null, helmet: null, bag: [], safe: [] });
const validId = (v: unknown, max = 100): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
export function newProfile(character: Character): Profile {
    const primary = createWeapon(character.faction === 'BEAR' ? 'weapon_ak74m' : 'weapon_m4a1');
    const ammo = 'ammo_' + CATALOG[primary.def].ammo;
    character = { ...character, name: cleanName(character.name), appearance: normalizeAppearance(character.appearance, character.faction, character.outfit) };
    const spares = [0, 1].map(() => { const m = createItem(primary.children.magazine.def); m.rounds = 30; return m; });
    const pistolSpare = createItem('pm_8'); pistolSpare.rounds = 8;
    return { schema: 3, id: uid(), revision: 0, character, cash: 50000, stash: [createWeapon('weapon_akm'), createItem(ammo, 90), createItem('loot_medical_09'), createItem('loot_food_drink_15')], inbox: [], gear: { primary, secondary: createWeapon('weapon_pm'), armor: createItem('armor_light'), helmet: null, bag: [...spares, pistolSpare, createItem(ammo, 30), createItem('ammo_9x18', 24), createItem('loot_medical_09'), createItem('loot_medical_01'), createItem('loot_medical_19'), createItem('loot_food_drink_15')], safe: [] }, quests: {}, presets: [], journal: [], applied: [], transactions: [], pending: null, stats: { raids: 0, extracted: 0, kills: 0 } };
}
export function validateEquipment(g: Equipment, seen = new Set<string>()) {
    check(safeRecord(g) && Array.isArray(g.bag) && Array.isArray(g.safe) && g.bag.length < 80 && g.safe.length < 10, 'Некорректная экипировка');
    for (const i of flatGear(g))
        validateItem(i, seen);
    for (const k of ['primary', 'secondary'] as const)
        if (g[k]) {
            check(validateBuild(g[k]!).length === 0, 'Невалидная оружейная сборка');
            check(loadedRounds(g[k]!) <= calculateStats(g[k]!).capacity + 1, 'Боекомплект превышает ёмкость магазина');
        }
    check(!g.armor || equipmentSlot(CATALOG[g.armor.def]) === 'armor', 'Неверная броня');
    check(!g.helmet || equipmentSlot(CATALOG[g.helmet.def]) === 'helmet', 'Неверный шлем');
    check(bagFits(g.bag), 'Рюкзак переполнен');
    check(!!pack(g.safe, 2, 2) && g.safe.every(i => ['valuables', 'documents'].includes(CATALOG[i.def].category)), 'Содержимое защищённого контейнера недопустимо');
}
export function validateProfile(p: unknown): asserts p is Profile {
    check(safeRecord(p) && p.schema === 3 && validId(p.id) && Number.isSafeInteger(p.revision) && Number(p.revision) >= 0, 'Формат профиля не поддерживается');
    check(safeRecord(p.character), 'Нет персонажа');
    check(typeof p.character.name === 'string', 'Повреждённый позывной');
    cleanName(p.character.name);
    check(['BEAR', 'USEC'].includes(String(p.character.faction)), 'Неизвестная фракция');
    check(Number.isInteger(p.character.face) && Number(p.character.face) >= 0 && Number(p.character.face) < 12, 'Неверное лицо');
    check(Number.isInteger(p.character.outfit) && Number(p.character.outfit) >= 0 && Number(p.character.outfit) < 12, 'Неверная одежда');
    check(p.character.appearance === undefined || isAppearance(p.character.appearance), 'Неверный комплект одежды');
    check(p.character.patches === undefined || isPatchSelection(p.character.patches), 'Неверные патчи');
    check(typeof p.cash === 'number' && Number.isSafeInteger(p.cash) && p.cash >= 0 && p.cash < 1e10, 'Неверная сумма');
    check(Array.isArray(p.stash) && p.stash.length <= 300 && Array.isArray(p.inbox) && p.inbox.length <= 1000, 'Превышен объём хранилища');
    const seen = new Set<string>();
    for (const i of [...p.stash, ...p.inbox])
        validateItem(i, seen);
    validateEquipment(p.gear as Equipment, seen);
    check(Array.isArray(p.applied) && p.applied.length <= 2000 && Array.isArray(p.transactions) && p.transactions.length <= 300, 'Неверный журнал операций');
    check(safeRecord(p.quests) && Array.isArray(p.presets) && p.presets.length <= 20 && Array.isArray(p.journal) && p.journal.length <= 30 && safeRecord(p.stats), 'Повреждённый профиль');
    for (const id of [...p.applied, ...p.transactions])
        check(typeof id === 'string' && id.length > 0 && id.length <= 200, 'Повреждённый ID операции');
    for (const [id, state] of Object.entries(p.quests)) {
        check(QUESTS.some(q => q.id === id) && safeRecord(state) && typeof state.accepted === 'boolean' && typeof state.claimed === 'boolean' && Number.isSafeInteger(state.progress) && Number(state.progress) >= 0 && Number(state.progress) < 100000, 'Повреждённое задание');
    }
    for (const preset of p.presets) {
        check(safeRecord(preset) && typeof preset.name === 'string' && preset.name.length > 0 && preset.name.length <= 32 && typeof preset.def === 'string', 'Повреждённый пресет');
        const gun = fromPreset(preset.tree as BuildPreset);
        check(gun.def === preset.def && validateBuild(gun).length === 0, 'Несовместимый пресет в профиле');
    }
    for (const n of ['raids', 'extracted', 'kills'])
        check(Number.isSafeInteger(p.stats[n]) && Number(p.stats[n]) >= 0 && Number(p.stats[n]) < 10000000, 'Повреждённая статистика');
    for (const r of p.journal) validateRaidResult(r);
    if (p.pending !== null) {
        check(safeRecord(p.pending) && validId(p.pending.raidId) && validId(p.pending.map) && ['prepared', 'active'].includes(String(p.pending.stage)), 'Повреждённый рейд');
        validateEquipment(p.pending.gear as Equipment, seen);
        check(flatGear(p.gear as Equipment).length === 0, 'Экипировка уже находится в незавершённом рейде');
    }
}
function validateRaidResult(r: unknown): asserts r is RaidResult {
    check(safeRecord(r) && validId(r.id, 200) && validId(r.raidId) && validId(r.playerId) && validId(r.map)
        && ['extracted', 'dead', 'missing', 'technical'].includes(String(r.outcome))
        && typeof r.seconds === 'number' && Number.isFinite(r.seconds) && r.seconds >= 0
        && Number.isSafeInteger(r.kills) && Number(r.kills) >= 0 && Number(r.kills) < 10000000
        && Array.isArray(r.visited) && r.visited.length < 50 && r.visited.every(v => validId(v)), 'Повреждённый результат рейда');
    check(r.cause === undefined || typeof r.cause === 'string' && r.cause.length <= 96, 'Повреждённая причина завершения');
    validateEquipment(r.gear as Equipment);
}
export function transaction(profile: Profile, id: string, fn: (p: Profile) => void): Profile {
    if (profile.transactions.includes(id))
        return profile;
    const p = clone(profile);
    check(!p.pending, 'Завершите текущий рейд');
    fn(p);
    check(stashFits(p.stash), 'Нет места в схроне');
    p.transactions = [...p.transactions.slice(-255), id];
    p.revision++;
    validateProfile(p);
    return p;
}
/** Cosmetics do not create a new profile, charge currency or touch owned equipment. */
export function saveAppearance(p: Profile, character: Character, op = uid()): Profile {
    return transaction(p, op, q => {
        check(isAppearance(character.appearance), 'Неверный комплект одежды');
        check(Number.isInteger(character.face) && character.face >= 0 && character.face < 12, 'Неверное лицо');
        q.character.appearance = clone(character.appearance);
        q.character.face = character.face;
        if (character.patches !== undefined) {
            check(isPatchSelection(character.patches), 'Неверные патчи');
            q.character.patches = clone(character.patches);
        }
        q.character.outfit = character.outfit;
    });
}
export function purchaseCost(item: Item, traderBuyFactor: number): number { return Math.ceil(value(item) * traderBuyFactor); }
export function buy(p: Profile, def: string, qty: number, op = uid()): Profile { return transaction(p, op, q => { const d = CATALOG[def]; check(d, 'Нет такого товара'); check(Number.isSafeInteger(qty) && qty > 0 && qty <= d.maxStack, 'Неверное количество покупки'); const t = TRADERS.find(t => t.categories.includes(d.category)); check(t, 'Товар недоступен'); const i = d.category === 'weapon' ? createWeapon(def, false) : createItem(def, qty); const cost = purchaseCost(i, t.buy); check(q.cash >= cost, 'Недостаточно денег'); q.cash -= cost; q.stash.push(i); }); }
export function sell(p: Profile, id: string, trader: number, op = uid()): Profile { return transaction(p, op, q => { const i = q.stash.find(i => i.id === id) || q.inbox.find(i => i.id === id); check(i, 'Предмет уже продан или не находится в схроне'); const t = TRADERS[trader]; check(t && t.categories.includes(CATALOG[i.def].category), 'Этот торговец не покупает такую категорию'); q.cash += value(i, t.sell); q.stash = q.stash.filter(i => i.id !== id); q.inbox = q.inbox.filter(i => i.id !== id); }); }
export function moveItem(p: Profile, id: string, target: 'stash' | 'bag' | 'safe' | 'primary' | 'secondary' | 'armor' | 'helmet', op = uid()): Profile {
    return transaction(p, op, q => {
        check(['stash', 'bag', 'safe', 'primary', 'secondary', 'armor', 'helmet'].includes(target), 'Неверный слот назначения');
        let found: Item | undefined;
        for (const a of [q.stash, q.inbox, q.gear.bag, q.gear.safe]) {
            const n = a.findIndex(i => i.id === id);
            if (n >= 0)
                found = a.splice(n, 1)[0];
        }
        for (const s of ['primary', 'secondary', 'armor', 'helmet'] as const)
            if (q.gear[s]?.id === id) {
                found = q.gear[s]!;
                q.gear[s] = null;
            }
        check(found, 'Предмет не найден');
        if (target === 'stash')
            q.stash.push(found);
        else if (target === 'bag') {
            q.gear.bag.push(found);
            check(bagFits(q.gear.bag), 'Нет места или превышена масса рюкзака');
        }
        else if (target === 'safe') {
            check(['documents', 'valuables'].includes(CATALOG[found.def].category), 'В защищённый контейнер можно класть только документы и ценности');
            q.gear.safe.push(found);
            check(!!pack(q.gear.safe, 2, 2), 'Защищённый контейнер заполнен');
        }
        else {
            check(target === 'primary' || target === 'secondary' ? CATALOG[found.def].category === 'weapon' : equipmentSlot(CATALOG[found.def]) === target, 'Неверный слот');
            const old = q.gear[target];
            q.gear[target] = found;
            if (old)
                q.stash.push(old);
        }
    });
}
export function splitStack(p: Profile, id: string, count: number): Profile { return transaction(p, uid(), q => { const i = q.stash.find(i => i.id === id) || q.gear.bag.find(i => i.id === id); check(i && Number.isInteger(count) && count > 0 && count < i.qty, 'Неверный размер части стопки'); i.qty -= count; const n = { ...clone(i), id: uid(), qty: count }; q.stash.push(n); }); }
export function quoteBuild(p: Profile, gun: Item, preset: BuildPreset): {
    cost: number;
    result: Item;
    leftovers: Item[];
    missing: string[];
    consumed: string[];
} {
    check(preset.def === gun.def, 'Пресет относится к другой основе');
    const result = fromPreset(preset);
    check(validateBuild(result).length === 0, validateBuild(result).join('; '));
    const loose = p.stash.filter(i => CATALOG[i.def].category === 'module');
    const gunNodes = walk(gun).slice(1);
    const pool = [
        ...gunNodes.map(n => ({ item: n.item, path: n.path, source: '' })),
        ...loose.flatMap(i => walk(i).map(n => ({ item: n.item, path: '', source: i.id })))
    ];
    const used = new Set<string>(), consumed = new Set<string>();
    let cost = 0;
    const missing: string[] = [];
    function assign(node: Item, path = ''): Item {
        // Prefer the existing item in this exact slot, so an unchanged build preserves IDs.
        let idx = pool.findIndex(i => !i.source && i.path === path && i.item.def === node.def);
        if (idx < 0) idx = pool.findIndex(i => i.item.def === node.def);
        let n: Item;
        if (!path)
            n = { ...clone(gun), children: {} };
        else if (idx >= 0) {
            const candidate = pool.splice(idx, 1)[0];
            used.add(candidate.item.id);
            if (candidate.source) consumed.add(candidate.source);
            n = { ...clone(candidate.item), children: {} };
        }
        else {
            n = { ...node, children: {} };
            cost += Math.ceil(CATALOG[node.def].price * 1.2);
            missing.push(node.def);
        }
        for (const [k, c] of Object.entries(node.children))
            n.children[k] = assign(c, path ? path + '.' + k : k);
        return n;
    }
    const out = assign(result);
    // Only disassemble a stored assembly if one of its actual instances was used.
    // Unused subtrees remain assembled; removing a parent promotes its surviving children.
    function retain(node: Item): Item[] {
        const children: Record<string, Item> = {}, promoted: Item[] = [];
        for (const [slot, child] of Object.entries(node.children)) {
            const remaining = retain(child);
            if (!used.has(child.id)) {
                children[slot] = remaining[0];
                promoted.push(...remaining.slice(1));
            } else promoted.push(...remaining);
        }
        return used.has(node.id) ? [...Object.values(children), ...promoted] : [{ ...clone(node), children }, ...promoted];
    }
    const leftovers = gunNodes.filter(n => !used.has(n.item.id)).map(n => ({ ...clone(n.item), children: {} }));
    for (const item of loose) if (consumed.has(item.id)) leftovers.push(...retain(item));
    // Each magazine retains its own ammunition, ID and condition. Nothing is poured into the replacement.
    if (CATALOG[out.def].feed === 'detachable') out.rounds = 0;
    return { cost, result: out, leftovers, missing, consumed: [...consumed] };
}
export function applyBuild(p: Profile, gunId: string, preset: BuildPreset, op = uid(), ownedOnly = false): Profile {
    return transaction(p, op, q => {
        const gun = [q.gear.primary, q.gear.secondary, ...q.stash].find(i => i?.id === gunId);
        check(gun, 'Оружие не найдено');
        const built = quoteBuild(q, gun, preset);
        check(!ownedOnly || built.missing.length === 0, 'Не хватает своих деталей: ' + built.missing.map(id => CATALOG[id].name).join(', '));
        check(q.cash >= built.cost, 'Недостаточно денег');
        q.cash -= built.cost;
        q.stash = q.stash.filter(i => !built.consumed.includes(i.id));
        if (q.gear.primary?.id === gunId)
            q.gear.primary = built.result;
        else if (q.gear.secondary?.id === gunId)
            q.gear.secondary = built.result;
        else
            q.stash = q.stash.map(i => i.id === gunId ? built.result : i);
        q.stash.push(...built.leftovers);
    });
}
export function prepareRaid(p: Profile, raidId: string, map: string): Profile { check(!p.pending, 'Уже есть незавершённый рейд'); check(validId(raidId) && validId(map), 'Неверный ID рейда или карты'); check(!p.journal.some(r => r.raidId === raidId) && !p.applied.includes('recovery-' + raidId), 'Этот рейд уже завершён'); check(p.inbox.length <= 1000 - 36, 'Заберите или продайте вещи из приёмного контейнера: нужно место для добычи следующего рейда'); check(p.gear.primary || p.gear.secondary, 'Возьмите оружие'); validateEquipment(p.gear); const q = clone(p); q.pending = { raidId, stage: 'prepared', gear: clone(p.gear), map }; q.gear = emptyGear(); q.revision++; validateProfile(q); return q; }
export function activateRaid(p: Profile): Profile { check(p.pending, 'Рейд не подготовлен'); const q = clone(p); q.pending!.stage = 'active'; q.revision++; return q; }
export function applyResult(p: Profile, result: RaidResult): Profile {
    validateRaidResult(result);
    if (p.applied.includes(result.id))
        return p;
    check(p.pending?.raidId === result.raidId && p.pending.map === result.map && p.id === result.playerId, 'Результат не относится к текущему рейду');
    const q = clone(p), before = q.pending!.gear;
    if (result.outcome === 'technical')
        q.gear = before;
    else if (result.outcome === 'extracted') {
        validateEquipment(result.gear);
        q.gear = clone(result.gear);
        const items = q.gear.bag.filter(i => i.found === result.raidId);
        q.gear.bag = q.gear.bag.filter(i => i.found !== result.raidId);
        for (const i of items) {
            if (stashFits([...q.stash, i]))
                q.stash.push(i);
            else
                q.inbox.push(i);
        }
        q.stats.extracted++;
        for (const def of QUESTS) {
            const state = q.quests[def.id];
            if (!state?.accepted || state.claimed || def.map !== result.map)
                continue;
            if (def.kind === 'visit' && result.visited.includes(def.target))
                state.progress = 1;
            if (def.kind === 'extract')
                state.progress += flatGear(result.gear).filter(i => i.def === def.target && i.found === result.raidId).reduce((n, i) => n + i.qty, 0);
        }
    }
    else {
        q.gear = emptyGear();
        q.gear.safe = clone(result.gear.safe);
    }
    if (result.outcome !== 'technical') {
        q.stats.raids++;
        q.stats.kills += result.kills;
    }
    q.pending = null;
    q.applied = [...q.applied.slice(-1998), result.id];
    q.journal = [clone(result), ...q.journal].slice(0, 30);
    q.revision++;
    validateProfile(q);
    return q;
}
export function recovery(p: Profile): Profile { if (!p.pending)
    return p; return applyResult(p, { id: 'recovery-' + p.pending.raidId, raidId: p.pending.raidId, playerId: p.id, outcome: 'technical', map: p.pending.map, seconds: 0, kills: 0, gear: p.pending.gear, visited: [] }); }
export function questAction(p: Profile, id: string): Profile {
    return transaction(p, uid(), q => {
        const def = QUESTS.find(x => x.id === id);
        check(def, 'Задание не найдено');
        let state = q.quests[id];
        if (!state) {
            q.quests[id] = { accepted: true, progress: 0, claimed: false };
            return;
        }
        check(!state.claimed, 'Награда уже получена');
        if (def.kind === 'deliver') {
            const candidates = q.stash.filter(i => i.def === def.target && i.found && i.foundMap === def.map);
            check(candidates.reduce((n, i) => n + i.qty, 0) >= def.count, 'Нужны найденные в рейде вещи в схроне');
            let left = def.count;
            for (const i of candidates) {
                const n = Math.min(i.qty, left);
                i.qty -= n;
                left -= n;
            }
            q.stash = q.stash.filter(i => i.qty > 0);
            state.progress = def.count;
        }
        check(state.progress >= def.count, 'Условия ещё не выполнены');
        q.cash += def.reward;
        state.claimed = true;
    });
}
export function emergencyKit(p: Profile): Profile {
    return transaction(p, uid(), q => {
        check(q.cash < 12000 && ![...q.stash, ...q.inbox, ...flatGear(q.gear)].some(i => CATALOG[i.def].category === 'weapon'), 'Помощь доступна только без оружия и денег на пистолет');
        // Rescue grant is a bound zero-resale tool, not a money generator. Condition 0 remains usable.
        const gun = createWeapon('weapon_pm');
        for (const n of walk(gun)) {
            n.item.condition = 0;
            n.item.bound = true;
        }
        q.gear.secondary = gun;
        const ammo = createItem('ammo_9x18', 16);
        ammo.bound = true;
        q.gear.bag.push(ammo);
    });
}

export function prepareMagazine(p: Profile, id: string, unload = false, op = uid()): Profile {
    return transaction(p, op, q => {
        const root = [...q.stash, ...q.gear.bag, q.gear.primary, q.gear.secondary].find(i => i?.id === id);
        check(root, 'Магазин или оружие не найдено');
        const mag = isMagazine(root) ? root : root.children.magazine;
        check(mag && isMagazine(mag), 'Этот предмет не имеет съёмного магазина');
        const ammoDef = 'ammo_' + CATALOG[mag.def].ammo;
        if (unload) {
            check(mag.rounds > 0, 'Магазин пуст');
            const rounds = createItem(ammoDef, mag.rounds); rounds.bound = mag.bound || root.bound;
            q.stash.push(rounds); mag.rounds = 0;
        } else {
            let need = magazineCapacity(mag) - mag.rounds;
            check(need > 0, 'Магазин полон');
            const before = mag.rounds;
            for (const a of [...q.stash, ...q.gear.bag]) if (a.def === ammoDef && need > 0) {
                const n = Math.min(need, a.qty); a.qty -= n; mag.rounds += n; need -= n;
                if (a.bound) mag.bound = true;
            }
            check(mag.rounds > before, 'Нет подходящих патронов в схроне или рюкзаке');
            q.stash = q.stash.filter(i => i.qty > 0); q.gear.bag = q.gear.bag.filter(i => i.qty > 0);
        }
        // Packing/unpacking a magazine must not consume or manufacture the chambered round.
    });
}
