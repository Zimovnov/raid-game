import { EXTRA_WEAPONS, EXTRA_MODULES, EXTRA_BUILDS } from './weapon-expansion.js';
import { ARSENAL_WEAPONS, ARSENAL_MODULES, ARSENAL_BUILDS, ARSENAL_AMMO } from './arsenal-expansion.js';
import { EQUIPMENT_DEFS } from './equipment.js';
import type { Definition, Slot, WeaponStats, Mods } from '../domain/types.js';
import { rgb } from '../domain/util.js';
const slot = (id: string, name: string, accepts: string, required = false): Slot => ({ id, name, accepts, required });
const accessorySlots = [slot('grip', 'Передняя рукоятка', 'rail-grip'), slot('light', 'Фонарь', 'rail-light'), slot('laser', 'Лазер', 'rail-laser')];
const optSlot = [slot('optic', 'Оптика', 'rail-optic')];
const rifleSlots = (family: string, mag: string, rail = false): Slot[] => [
    slot('stock', 'Приклад', family + '-stock', true), slot('handguard', 'Цевьё', family + '-handguard', true),
    slot('pistolgrip', 'Рукоятка', family + '-grip', true), slot('magazine', 'Магазин', mag, true),
    slot('muzzle', 'Дульное устройство', family + '-muzzle'), slot(rail ? 'optic' : 'mount', rail ? 'Оптика' : 'Кронштейн', rail ? 'rail-optic' : family + '-mount')
];
const stats = (damage: number, rpm: number, recoil: number, capacity: number, auto = true, pellets = 1): WeaponStats => ({ damage, rpm, recoil, capacity, auto, pellets, ergo: 50, reload: 2.5, zoom: 1, noise: 1, spread: .018, weight: 2.3, ads: .22 });
function weapon(id: string, name: string, price: number, shape: string, ammo: string, slots: Slot[], s: WeaponStats): Definition {
    return { id, name, price, shape, ammo, slots, stats: s, feed: shape === 'shotgun' ? 'tube' : 'detachable', category: 'weapon', size: [4, 2], weight: s.weight, maxStack: 1, rarity: 2, color: rgb(0x394043), description: 'Самостоятельная игровая low-poly стилизация. Размеры, совместимость и баланс не описывают настоящее оружие.' };
}
export const WEAPONS: Definition[] = [
    ...EXTRA_WEAPONS,
    weapon('weapon_ak74m', 'АК-74М', 42000, 'ak', '5.45x39', rifleSlots('ak', 'ak545-mag'), stats(28, 610, 1, 30)),
    weapon('weapon_akm', 'АКМ', 36000, 'akm', '7.62x39', rifleSlots('ak', 'ak762-mag'), stats(35, 570, 1.25, 30)),
    weapon('weapon_m4a1', 'M4A1', 88000, 'ar', '5.56x45', rifleSlots('ar', 'ar556-mag', true), stats(26, 760, .88, 30)),
    weapon('weapon_mp5', 'HK MP5', 54000, 'mp5', '9x19', [
        slot('stock', 'Приклад', 'mp5-stock', true), slot('handguard', 'Цевьё', 'mp5-handguard', true), slot('magazine', 'Магазин', 'mp5-mag', true), slot('mount', 'Крепление', 'mp5-mount'), slot('muzzle', 'Дульное устройство', 'smg-muzzle')
    ], stats(20, 780, .62, 30)),
    weapon('weapon_pm', 'ПМ', 12000, 'pm', '9x18', [slot('pistolgrip', 'Накладки', 'pm-grip', true), slot('magazine', 'Магазин', 'pm-mag', true)], { ...stats(23, 280, .72, 8, false), weight: .56, reload: 1.7 }),
    weapon('weapon_mp133', 'МР-133', 24000, 'shotgun', '12gauge', [slot('stock', 'Приклад', 'sg-stock', true), slot('handguard', 'Цевьё', 'sg-handguard', true), slot('mount', 'Крепление', 'sg-mount')], { ...stats(11, 70, 1.6, 6, false, 7), reload: .65, weight: 2.4, spread: .06 }),
    ...ARSENAL_WEAPONS
];
function mod(id: string, name: string, intf: string, shape: string, price: number, weight: number, mods: Mods = {}, slots: Slot[] = [], ammo?: string): Definition {
    return { id, name, category: 'module', interface: intf, shape, price, weight, mods, slots, ammo, size: [1, 1], maxStack: 1, rarity: 1, color: rgb(shape.includes('wood') ? 0x98643d : 0x343b3d), description: 'Виртуальная деталь мастерской «Рейд». Не является проверенной репликой или руководством по реальной совместимости.' };
}
export const MODULES: Definition[] = [
    ...EXTRA_MODULES,
    mod('ak_stock', 'Полимерный приклад', 'ak-stock', 'stock_solid', 2600, .36, { recoil: -.07 }),
    mod('ak_wood_stock', 'Деревянный приклад', 'ak-stock', 'stock_wood', 3100, .49, { recoil: -.1, ergo: -3 }),
    mod('ak_skeleton', 'Рамочный приклад', 'ak-stock', 'stock_skeleton', 6500, .22, { ergo: 9, recoil: -.04 }),
    mod('ar_stock', 'Телескопический приклад', 'ar-stock', 'stock_telescopic', 4100, .34, { recoil: -.08 }),
    mod('ar_compact', 'Компактный приклад', 'ar-stock', 'stock_compact', 6800, .21, { ergo: 12, recoil: .03 }),
    mod('ar_precision', 'Приклад с щекой', 'ar-stock', 'stock_precision', 12500, .64, { recoil: -.2, ergo: -8 }),
    mod('mp5_stock', 'Приклад MP5', 'mp5-stock', 'stock_solid', 3600, .28, { recoil: -.06 }),
    mod('sg_stock', 'Охотничий приклад', 'sg-stock', 'stock_wood', 2400, .5, { recoil: -.13 }),
    mod('ak_poly', 'Полимерное цевьё', 'ak-handguard', 'guard_poly', 2600, .24, { ergo: 3 }),
    mod('ak_wood', 'Деревянное цевьё', 'ak-handguard', 'guard_wood', 2200, .31, { recoil: -.03 }),
    mod('ak_rail', 'Рельсовое цевьё', 'ak-handguard', 'guard_rail', 7600, .4, { ergo: -2, recoil: -.03 }, accessorySlots),
    mod('ar_poly', 'Ребристое цевьё', 'ar-handguard', 'guard_round', 3500, .28, { ergo: 3 }),
    mod('ar_short', 'Короткое рельсовое цевьё', 'ar-handguard', 'guard_short', 6200, .24, { ergo: 7 }, accessorySlots),
    mod('ar_long', 'Длинное рельсовое цевьё', 'ar-handguard', 'guard_long', 8800, .45, { ergo: -4, recoil: -.05 }, accessorySlots),
    mod('mp5_guard', 'Цевьё MP5', 'mp5-handguard', 'guard_poly', 2500, .2),
    mod('mp5_rail', 'Цевьё MP5 с планками', 'mp5-handguard', 'guard_rail', 7200, .3, { ergo: -3 }, accessorySlots),
    mod('sg_pump', 'Деревянное помповое цевьё', 'sg-handguard', 'guard_pump_wood', 2100, .25),
    mod('ak_grip', 'Простая рукоятка АК', 'ak-grip', 'grip_plain', 1300, .12),
    mod('ak_ergo', 'Рукоятка с упором', 'ak-grip', 'grip_ergo', 3900, .15, { ergo: 9 }),
    mod('ar_grip', 'Простая рукоятка AR', 'ar-grip', 'grip_plain', 1900, .11),
    mod('ar_ergo', 'Вертикальная рукоятка AR', 'ar-grip', 'grip_vertical', 4300, .13, { ergo: 10 }),
    mod('pm_grip', 'Бакелитовые накладки', 'pm-grip', 'grip_wood', 1000, .08),
    mod('pm_rubber', 'Резиновые накладки', 'pm-grip', 'grip_rubber', 2600, .1, { ergo: 6, recoil: -.07 }),
    mod('ak_mount', 'Боковой кронштейн', 'ak-mount', 'mount_side', 5800, .2, {}, optSlot),
    mod('mp5_mount', 'Мостик MP5', 'mp5-mount', 'mount_bridge', 4800, .12, {}, optSlot),
    mod('sg_mount', 'Планка ствольной коробки', 'sg-mount', 'mount_flat', 4200, .14, {}, optSlot),
    mod('red_dot', 'Открытый коллиматор', 'rail-optic', 'optic_open', 9800, .16, { ergo: 3, zoom: 1 }),
    mod('holo', 'Голографический прицел', 'rail-optic', 'optic_holo', 18000, .28, { ergo: -2, zoom: 1.15 }),
    mod('scope4', 'Компактная оптика ×4', 'rail-optic', 'optic_scope', 26000, .44, { ergo: -9, zoom: 4 }),
    mod('fore_vertical', 'Вертикальная передняя рукоятка', 'rail-grip', 'fore_vertical', 4500, .14, { recoil: -.13, ergo: -3 }),
    mod('fore_angled', 'Угловая передняя рукоятка', 'rail-grip', 'fore_angled', 5800, .11, { recoil: -.08, ergo: 6 }),
    mod('fore_stop', 'Небольшой упор', 'rail-grip', 'fore_stop', 3200, .05, { recoil: -.03, ergo: 5 }),
    mod('flashlight', 'Оружейный фонарь', 'rail-light', 'light', 6000, .17, { ergo: -2 }),
    mod('laser', 'Лазерный указатель', 'rail-laser', 'laser', 8500, .1, { ergo: -1 }),
    mod('ak545_30', 'Магазин 5,45 · 30', 'ak545-mag', 'mag_curved', 1800, .24, { capacity: 30 }, [], '5.45x39'),
    mod('ak545_45', 'Магазин 5,45 · 45', 'ak545-mag', 'mag_long', 3900, .36, { capacity: 45, ergo: -8, reload: .25 }, [], '5.45x39'),
    mod('ak762_30', 'Магазин 7,62 · 30', 'ak762-mag', 'mag_banana', 2100, .31, { capacity: 30 }, [], '7.62x39'),
    mod('ar556_30', 'Магазин 5,56 · 30', 'ar556-mag', 'mag_straight', 2500, .2, { capacity: 30 }, [], '5.56x45'),
    mod('ar556_60', 'Барабан 5,56 · 60', 'ar556-mag', 'mag_drum', 7800, .68, { capacity: 60, ergo: -17, reload: .65 }, [], '5.56x45'),
    mod('mp5_30', 'Магазин 9×19 · 30', 'mp5-mag', 'mag_smg', 1800, .17, { capacity: 30 }, [], '9x19'),
    mod('pm_8', 'Магазин 9×18 · 8', 'pm-mag', 'mag_pistol', 1000, .06, { capacity: 8 }, [], '9x18'),
    mod('ak_brake', 'Компенсатор АК', 'ak-muzzle', 'muzzle_brake', 3300, .1, { recoil: -.1, noise: .08 }),
    mod('ak_suppressor', 'Глушитель АК (игровой)', 'ak-muzzle', 'muzzle_suppressor', 21000, .5, { noise: -.55, recoil: -.06, ergo: -10 }),
    mod('ar_brake', 'Компенсатор AR', 'ar-muzzle', 'muzzle_brake', 3900, .1, { recoil: -.12, noise: .1 }),
    mod('ar_suppressor', 'Глушитель AR (игровой)', 'ar-muzzle', 'muzzle_suppressor', 24000, .43, { noise: -.6, recoil: -.05, ergo: -9 }),
    mod('smg_suppressor', 'Глушитель MP5 (игровой)', 'smg-muzzle', 'muzzle_suppressor', 17500, .29, { noise: -.6, ergo: -6 }),
    ...ARSENAL_MODULES
];
export const DEFAULT_BUILDS: Record<string, Record<string, string>> = {
    ...EXTRA_BUILDS,
    ...ARSENAL_BUILDS,
    weapon_ak74m: { stock: 'ak_stock', handguard: 'ak_poly', pistolgrip: 'ak_grip', magazine: 'ak545_30', muzzle: 'ak_brake' },
    weapon_akm: { stock: 'ak_wood_stock', handguard: 'ak_wood', pistolgrip: 'ak_grip', magazine: 'ak762_30', muzzle: 'ak_brake' },
    weapon_m4a1: { stock: 'ar_stock', handguard: 'ar_poly', pistolgrip: 'ar_grip', magazine: 'ar556_30', muzzle: 'ar_brake' },
    weapon_mp5: { stock: 'mp5_stock', handguard: 'mp5_guard', magazine: 'mp5_30' },
    weapon_pm: { pistolgrip: 'pm_grip', magazine: 'pm_8' }, weapon_mp133: { stock: 'sg_stock', handguard: 'sg_pump' }
};
export const AMMO: Definition[] = ['5.45x39', '7.62x39', '5.56x45', '9x19', '9x18', '12gauge', '7.62x25', '7.62x54R'].map((a, i) => ({ id: 'ammo_' + a, name: 'Патроны ' + a, category: 'ammo', price: [38, 46, 52, 24, 18, 65, 34, 84][i], size: [1, 1], weight: .012, maxStack: 90, rarity: 0, shape: 'ammo', ammo: a, color: rgb(0xad935b), description: 'Боеприпасы только для указанной игровой группы.' }));
export const ARMOR: Definition[] = [{ id: 'armor_light', name: 'Лёгкий бронежилет', category: 'armor', price: 14000, size: [3, 3], weight: 3.4, maxStack: 1, rarity: 1, shape: 'armor', color: rgb(0x626348), description: 'Снижает урон в корпус. Защита уменьшается при износе.' }, { id: 'helmet_light', name: 'Защитный шлем', category: 'armor', price: 7500, size: [2, 2], weight: 1.2, maxStack: 1, rarity: 1, shape: 'helmet', color: rgb(0x505c4c), description: 'Снижает урон в голову. Изнашивается от попаданий.' }];
AMMO.push(...ARSENAL_AMMO);
ARMOR.push(...EQUIPMENT_DEFS);

// These restrictions describe virtual asset clearance, not factory compatibility.
const rules: Record<string, Partial<Definition>> = {
    ar_long: { provides: ['guard:long'] }, hk416_guard: { provides: ['guard:long'] },
    saiga_rail: { provides: ['guard:wide'] },
    fore_bail: { requiresAny: ['guard:long', 'guard:wide'] },
    flashlight: { occupiedPositions: ['right-front'] }, wide_light: { occupiedPositions: ['right-front'] },
    laser: { occupiedPositions: ['left-front'] }, laser_dual: { occupiedPositions: ['right-front', 'left-front'] },
    scope6: { platforms: ['weapon_m4a1','weapon_hk416a5','weapon_sks','weapon_svd','weapon_sv98','weapon_ak12','weapon_rpk74m','weapon_asval','weapon_vss','weapon_g36k','weapon_scarl','weapon_auga3','weapon_mcxspearlt','weapon_bren2','weapon_m14'] }
};
for (const module of MODULES) Object.assign(module, rules[module.id] || {});
