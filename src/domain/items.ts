import { isMagazine, detachable, magazineCapacity, setLoadedRounds } from './ammunition.js';
import { CATALOG } from '../content/catalog.js';
import { DEFAULT_BUILDS } from '../content/weapons.js';
import type { Item, Equipment, BuildPreset, Slot, WeaponStats } from './types.js';
import { uid, check, clone, clamp, safeRecord } from './util.js';
export function createItem(def: string, qty = 1, id = uid()): Item { const d = CATALOG[def]; check(d, 'Неизвестный предмет'); check(Number.isInteger(qty) && qty > 0 && qty <= d.maxStack, 'Недопустимое количество'); return { id, def, qty, condition: 100, rounds: 0, children: {}, ...(d.category === 'weapon' ? { chamber: 0 } : {}) }; }
export function createWeapon(def: string, loaded = true): Item { const root = createItem(def); check(CATALOG[def].category === 'weapon', 'Это не оружие'); for (const [s, d] of Object.entries(DEFAULT_BUILDS[def] || {}))
    root.children[s] = createItem(d); if (loaded) setLoadedRounds(root, calculateStats(root).capacity); return root; }
export function walk(item: Item, path = ''): {
    item: Item;
    path: string;
}[] { return [{ item, path }, ...Object.entries(item.children).flatMap(([s, c]) => walk(c, path ? path + '.' + s : s))]; }
export function flatGear(g: Equipment): Item[] { return [g.primary, g.secondary, g.armor, g.helmet, ...g.bag, ...g.safe].filter((i): i is Item => i !== null); }
export function cartridgeWeight(i: Item): number { const d = CATALOG[i.def]; return (i.rounds + (i.chamber || 0)) * (CATALOG['ammo_' + d.ammo]?.weight || 0); }
export function weight(items: Item[]): number { return items.reduce((sum, i) => sum + walk(i).reduce((s, n) => s + CATALOG[n.item.def].weight * n.item.qty + cartridgeWeight(n.item), 0), 0); }
export function value(item: Item, factor = 1): number { return Math.round(walk(item).reduce((s, n) => s + (n.item.bound ? 0 : CATALOG[n.item.def].price * n.item.qty * (.35 + .65 * n.item.condition / 100) + (n.item.rounds + (n.item.chamber || 0)) * (CATALOG['ammo_' + CATALOG[n.item.def].ammo]?.price || 0)), 0) * factor); }
export function validateItem(value: unknown, seen = new Set<string>(), depth = 0): asserts value is Item {
    check(depth <= 8 && safeRecord(value), 'Некорректное дерево предмета');
    check(typeof value.def === 'string' && !!CATALOG[value.def], 'Неизвестный ID определения');
    check(typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 100 && !seen.has(value.id), 'Повтор или неверный экземпляр');
    seen.add(value.id);
    const d = CATALOG[value.def];
    check(typeof value.qty === 'number' && Number.isInteger(value.qty) && value.qty > 0 && value.qty <= d.maxStack, 'Количество вне диапазона');
    check(typeof value.condition === 'number' && Number.isFinite(value.condition) && value.condition >= 0 && value.condition <= 100, 'Повреждённое состояние предмета');
    check(typeof value.rounds === 'number' && Number.isInteger(value.rounds) && value.rounds >= 0 && value.rounds <= 90, 'Некорректный боекомплект');
    check(safeRecord(value.children) && Object.keys(value.children).length <= 10, 'Неверные дочерние слоты');
    check(d.category === 'weapon' ? value.chamber === 0 || value.chamber === 1 : value.chamber === undefined || value.chamber === 0, 'Некорректное состояние патронника');
    check(value.fireMode === undefined || d.category === 'weapon' && (value.fireMode === 'single' || value.fireMode === 'auto' && d.stats?.auto === true), 'Режим огня не поддерживается');
    for (const key of ['bound', 'rotated']) check(value[key] === undefined || typeof value[key] === 'boolean', 'Повреждённый флаг предмета');
    for (const key of ['found', 'foundMap']) check(value[key] === undefined || typeof value[key] === 'string' && value[key].length > 0 && value[key].length <= 100, 'Повреждённое происхождение предмета');
    const item = value as unknown as Item;
    const capacity = isMagazine(item) ? magazineCapacity(item) : d.category === 'weapon' && !detachable(item) ? d.stats!.capacity : 0;
    check(value.rounds <= capacity, 'Патроны должны находиться в подходящем магазине / внутренней подаче');
    for (const [slot, c] of Object.entries(value.children)) {
        validateItem(c, seen, depth + 1);
        const attachment = CATALOG[c.def], provided = d.slots?.find(s => s.id === slot);
        check(provided && attachment.category === 'module' && provided.accepts === attachment.interface, 'Предмет вложен в неподходящий слот');
        check(!d.ammo || !attachment.ammo || d.ammo === attachment.ammo, 'Несовместимая группа боеприпасов');
    }
}
export function validateBuild(root: Item): string[] {
    const errors: string[] = [];
    try {
        validateItem(root);
    }
    catch (e) {
        return [(e as Error).message];
    }
    const w = CATALOG[root.def];
    if (w.category !== 'weapon')
        return ['Основа не является оружием'];
    const definitions = walk(root).map(n => CATALOG[n.item.def]);
    const tags = new Set(definitions.flatMap(d => [d.id, ...(d.provides || [])]));
    function visit(parent: Item, path: string) {
        const occupied = new Map<string, string>();
        const d = CATALOG[parent.def];
        const slots = d.slots || [];
        for (const s of slots)
            if (s.required && !parent.children[s.id])
                errors.push(`${path}${s.name}: обязательная деталь отсутствует`);
        for (const [id, c] of Object.entries(parent.children)) {
            const s = slots.find(x => x.id === id), cd = CATALOG[c.def];
            if (!s)
                errors.push(`${path}${id}: слот не предоставлен родителем`);
            else if (s.accepts !== cd.interface)
                errors.push(`${s.name}: требуется интерфейс ${s.accepts}`);
            if (cd.platforms && !cd.platforms.includes(root.def))
                errors.push('Другой вариант платформы');
            if (cd.ammo && cd.ammo !== w.ammo)
                errors.push('Несовместимая группа боеприпасов');
            if (cd.requiresAll?.some(tag => !tags.has(tag))) errors.push(`${cd.name}: отсутствует обязательное крепление (${cd.requiresAll.join(', ')})`);
            if (cd.requiresAny?.length && !cd.requiresAny.some(tag => tags.has(tag))) errors.push(`${cd.name}: требуется длинное или широкое рельсовое цевьё`);
            if (cd.excludes?.some(tag => tags.has(tag))) errors.push(`${cd.name}: конфликт с установленной деталью`);
            for (const position of cd.occupiedPositions || []) {
                if (occupied.has(position)) errors.push(`${cd.name}: позицию ${position} уже занимает ${occupied.get(position)}`);
                else occupied.set(position, cd.name);
            }
            visit(c, path + id + '.');
        }
    }
    visit(root, '');
    return errors;
}
export function calculateStats(root: Item): WeaponStats {
    const base = CATALOG[root.def]?.stats;
    check(base, 'Оружие не найдено');
    const s = { ...base, weight: 0 };
    for (const { item } of walk(root)) {
        const d = CATALOG[item.def];
        s.weight += d.weight * item.qty + cartridgeWeight(item);
        if (!d.mods)
            continue;
        for (const [k, v] of Object.entries(d.mods)) {
            if (v === undefined)
                continue;
            switch (k) {
                case 'capacity':
                    s.capacity = v;
                    break;
                case 'zoom':
                    s.zoom = v;
                    break;
                case 'recoil':
                    s.recoil += v;
                    break;
                case 'ergo':
                    s.ergo += v;
                    break;
                case 'reload':
                    s.reload += v;
                    break;
                case 'noise':
                    s.noise += v;
                    break;
                case 'spread':
                    s.spread += v;
                    break;
            }
        }
    }
    s.recoil = clamp(s.recoil, .22, 2.5);
    s.ergo = clamp(s.ergo, 5, 95);
    s.reload = clamp(s.reload, .4, 5);
    s.noise = clamp(s.noise, .2, 1.5);
    s.zoom = clamp(s.zoom, 1, 8);
    s.spread = clamp(s.spread, .002, .12);
    s.ads = clamp(.44 - s.ergo * .0035, .12, .5);
    s.capacity = clamp(Math.round(s.capacity), 1, 90);
    return s;
}
export function presetOf(i: Item): BuildPreset { return { def: i.def, children: Object.fromEntries(Object.entries(i.children).map(([s, c]) => [s, presetOf(c)])) }; }
export function fromPreset(p: BuildPreset, depth = 0): Item { check(depth < 8 && safeRecord(p) && typeof p.def === 'string' && !!CATALOG[p.def] && safeRecord(p.children), 'Повреждённый пресет'); check(Object.keys(p.children).length <= 10, 'Слишком много деталей'); const i = createItem(p.def); i.children = Object.fromEntries(Object.entries(p.children).map(([s, c]) => [s, fromPreset(c, depth + 1)])); return i; }
export function getNode(root: Item, path: string): Item | undefined { return path.split('.').filter(Boolean).reduce<Item | undefined>((p, s) => p?.children[s], root); }
export function getSlots(root: Item): {
    path: string;
    slot: Slot;
    item?: Item;
}[] { return walk(root).flatMap(({ item, path }) => (CATALOG[item.def].slots || []).map(slot => ({ path: path ? path + '.' + slot.id : slot.id, slot, item: item.children[slot.id] }))); }
export function replacePreview(root: Item, path: string, def: string | null): Item { const n = clone(root), keys = path.split('.'), slot = keys.pop()!, p = getNode(n, keys.join('.')); check(p, 'Сначала установите родительское крепление'); if (def)
    p.children[slot] = createItem(def);
else
    delete p.children[slot]; return n; }
export interface Placement {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}
export function pack(items: Item[], cols: number, rows: number): Placement[] | null {
    const grid = new Uint8Array(cols * rows), out: Placement[] = [];
    const ordered = [...items].sort((a, b) => CATALOG[b.def].size[0] * CATALOG[b.def].size[1] - CATALOG[a.def].size[0] * CATALOG[a.def].size[1]);
    for (const i of ordered) {
        let [w, h] = CATALOG[i.def].size;
        if (i.rotated)
            [w, h] = [h, w];
        let found = false;
        for (let y = 0; y <= rows - h && !found; y++)
            for (let x = 0; x <= cols - w && !found; x++) {
                let free = true;
                for (let yy = 0; yy < h; yy++)
                    for (let xx = 0; xx < w; xx++)
                        if (grid[(y + yy) * cols + x + xx])
                            free = false;
                if (free) {
                    for (let yy = 0; yy < h; yy++)
                        for (let xx = 0; xx < w; xx++)
                            grid[(y + yy) * cols + x + xx] = 1;
                    out.push({ id: i.id, x, y, w, h });
                    found = true;
                }
            }
        if (!found)
            return null;
    }
    return out;
}
export const bagFits = (items: Item[]) => !!pack(items, 6, 6) && weight(items) <= 24;
export const stashFits = (items: Item[]) => !!pack(items, 10, 16);
export function reserveAmmo(g: Equipment, ammo: string): number { return g.bag.filter(i => CATALOG[i.def].ammo === ammo && CATALOG[i.def].category === 'ammo').reduce((s, i) => s + i.qty, 0); }
export function spendAmmo(g: Equipment, ammo: string, count: number, holder?: Item): number {
    check(Number.isSafeInteger(count) && count >= 0, 'Неверное количество патронов');
    if (holder) check(CATALOG[holder.def]?.ammo === ammo, 'Несовместимая группа боеприпасов');
    let left = count; for (const i of g.bag) {
    if (CATALOG[i.def].category === 'ammo' && CATALOG[i.def].ammo === ammo) {
        const take = Math.min(left, i.qty);
        if (take > 0 && i.bound && holder) holder.bound = true;
        i.qty -= take;
        left -= take;
    }
} g.bag = g.bag.filter(i => i.qty > 0); return count - left; }

/** Same validation path as applying presets and host validation; never compare display names. */
export function moduleProblems(root: Item, path: string, def: string): string[] {
    try { return validateBuild(replacePreview(root, path, def)); }
    catch (e) { return [(e as Error).message]; }
}
