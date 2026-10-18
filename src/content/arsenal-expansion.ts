import type { Definition, Mods, Slot, WeaponStats } from '../domain/types.js';
import { rgb } from '../domain/util.js';

// Names and broad visual families are researched; all attachment interfaces and
// numerical effects below are authored game rules, not factory specifications.
const slot = (id: string, name: string, accepts: string, required = false): Slot => ({ id, name, accepts, required });
const stock = (family: string) => slot('stock', 'Приклад / ложа', family + '-stock', true);
const guard = (family: string) => slot('handguard', 'Цевьё', family + '-handguard', true);
const grip = (family: string) => slot('pistolgrip', 'Рукоятка', family + '-grip', true);
const mag = (family: string) => slot('magazine', 'Магазин', family + '-mag', true);
const muzzle = (family: string) => slot('muzzle', 'Дульное устройство', family + '-muzzle');
const mount = (family: string) => slot('mount', 'Кронштейн', family + '-mount');
const optic = slot('optic', 'Оптика', 'rail-optic');
const light = slot('light', 'Подствольный фонарь', 'pistol-light');
const rail = [slot('grip', 'Передняя рукоятка', 'rail-grip'), slot('light', 'Фонарь', 'rail-light'), slot('laser', 'Лазер', 'rail-laser')];
const rifle = (family: string, magazine = family, pistolgrip = family) => [stock(family), guard(family), grip(pistolgrip), mag(magazine), optic, muzzle(family)];

function weapon(id: string, name: string, shape: string, ammo: string, price: number, slots: Slot[], changes: Partial<WeaponStats>, description: string, feed: Definition['feed'] = 'detachable'): Definition {
    const stats: WeaponStats = { damage: 27, rpm: 650, recoil: .96, ergo: 54, reload: 2.6, capacity: 30, zoom: 1, noise: 1, spread: .018, weight: 2.15, ads: .23, auto: true, pellets: 1, ...changes };
    return { id: 'weapon_' + id, name, shape, ammo, price, slots, stats, feed, category: 'weapon', weight: stats.weight,
        size: ['m9a3', 'm17'].includes(shape) ? [2, 2] : shape === 'rpk74' || shape === 'm14' ? [5, 2] : [4, 2], rarity: 2, maxStack: 1,
        color: rgb(['scar', 'mcx', 'm9a3', 'm17'].includes(shape) ? '#a99772' : '#394043'),
        description: description + ' Игровая стилизация: характеристики и соединения деталей условные. Комплект продаётся без патронов.' };
}

export const ARSENAL_WEAPONS: Definition[] = [
    weapon('ak12', 'АК-12', 'ak12', '5.45x39', 69000, rifle('ak12', 'ak545', 'ak'), { rpm: 700, recoil: .94, ergo: 58, weight: 2.05 }, 'Современная платформа с верхней планкой, регулируемым прикладом и угловатым цевьём.'),
    weapon('rpk74m', 'РПК-74М', 'rpk74', '5.45x39', 79000, [stock('rpk'), guard('rpk'), grip('ak'), mag('ak545'), mount('ak'), muzzle('ak')], { damage: 29, rpm: 600, recoil: .76, ergo: 31, weight: 3.2, capacity: 45, reload: 3.2, spread: .014 }, 'Длинный тяжёлый силуэт и большой магазин. Сошки показаны в сложенном положении; развёртывания сошек пока нет.'),
    weapon('asval', 'АС «Вал»', 'asval', '9x39', 98000, [stock('val'), guard('val'), grip('val'), mag('val'), mount('val')], { damage: 34, rpm: 850, recoil: .91, ergo: 59, weight: 1.9, capacity: 20, noise: .40, spread: .021 }, 'Компактный специальный автомат: тонкий рамочный приклад и интегрированный глушитель. Тише обычных автоматов, но не бесшумен.'),
    weapon('vss', 'ВСС «Винторез»', 'vss', '9x39', 103000, [stock('vss'), guard('val'), mag('val'), mount('val')], { damage: 38, rpm: 700, recoil: .83, ergo: 43, weight: 1.95, capacity: 10, noise: .38, spread: .012 }, 'Специальная винтовка с деревянным прикладом с вырезом и интегрированным глушителем. Общая игровая группа магазинов с «Валом».'),
    weapon('g36k', 'HK G36K', 'g36', '5.56x45', 92000, rifle('g36'), { rpm: 750, recoil: .89, ergo: 60, weight: 2.0 }, 'Полимерная коробка, высокий мостик и складной скелетный приклад. Собственная группа магазинов G36.'),
    weapon('scarl', 'FN SCAR-L Mk2', 'scar', '5.56x45', 126000, rifle('scar', 'ar556', 'ar'), { rpm: 625, recoil: .79, ergo: 51, weight: 2.4 }, 'Высокая прямоугольная коробка песочного цвета, массивный регулируемый приклад и боковая рукоятка.'),
    weapon('auga3', 'Steyr AUG A3', 'aug', '5.56x45', 105000, [stock('aug'), guard('aug'), mag('aug'), optic, muzzle('aug')], { rpm: 740, recoil: .91, ergo: 63, reload: 3.0, weight: 2.15 }, 'Булл-пап: магазин позади рукоятки, короткий общий силуэт, отдельный передний хват. Анимация замены магазина учитывает его заднее положение.'),
    weapon('mcxspearlt', 'SIG MCX-SPEAR LT · 5,56', 'mcx', '5.56x45', 138000, rifle('mcx', 'ar556', 'ar'), { rpm: 800, recoil: .83, ergo: 58, weight: 2.15 }, 'Песочная ствольная коробка, длинные окна цевья и облегчённый складной приклад. В игре представлена только версия 5,56×45.'),
    weapon('bren2', 'CZ BREN 2 · 5,56', 'bren', '5.56x45', 107000, rifle('bren', 'ar556', 'bren'), { rpm: 790, recoil: .87, ergo: 65, weight: 1.93 }, 'Угловатая коробка, боковая рукоятка и складной приклад. Версия под 5,56×45 с коротким цевьём.'),
    weapon('scorpion', 'CZ Scorpion EVO 3 A1', 'scorpion', '9x19', 57000, rifle('scorpion'), { damage: 20, rpm: 1040, recoil: .80, ergo: 72, weight: 1.65, spread: .023, reload: 2.25 }, 'Компактный полимерный пистолет-пулемёт со скошенной коробкой и характерным изогнутым магазином.'),
    weapon('mpx', 'SIG MPX', 'mpx', '9x19', 76000, rifle('mpx', 'mpx', 'ar'), { damage: 21, rpm: 850, recoil: .58, ergo: 74, weight: 1.5, reload: 2.15 }, 'Короткий пистолет-пулемёт с органами управления семейства AR и своим узким магазином.'),
    weapon('m9a3', 'Beretta M9A3', 'm9a3', '9x19', 39000, [grip('m9'), mag('m9'), light], { damage: 24, rpm: 340, recoil: .68, ergo: 76, weight: .65, capacity: 17, reload: 1.8, auto: false }, 'Песочный пистолет с открытой верхней частью затвора и отдельными накладками рукоятки.'),
    weapon('m17', 'SIG P320-M17', 'm17', '9x19', 45000, [grip('m17'), mag('m17'), light, mount('m17')], { damage: 24, rpm: 370, recoil: .65, ergo: 79, weight: .56, capacity: 17, reload: 1.7, auto: false }, 'Полимерная модульная рамка, высокий затвор и передняя насечка. Компактный прицел ставится через отдельную игровую площадку.'),
    weapon('rem870', 'Remington 870', 'rem870', '12gauge', 29000, [stock('870'), guard('870'), mount('sg')], { damage: 11, rpm: 75, recoil: 1.7, ergo: 48, weight: 2.1, capacity: 6, reload: .67, auto: false, pellets: 7, spread: .058 }, 'Помповое ружьё: стальная коробка, отдельное подвижное цевьё и трубчатое питание.', 'tube'),
    weapon('benellim4', 'Benelli M4', 'benelli', '12gauge', 88000, [stock('benelli'), guard('benelli'), optic], { damage: 11, rpm: 185, recoil: 1.44, ergo: 44, weight: 2.35, capacity: 7, reload: .72, auto: false, pellets: 7, spread: .055 }, 'Самозарядное ружьё с трубчатой подачей, диоптрическим целиком и регулируемым прикладом. Цевьё не двигается как помпа.', 'tube'),
    weapon('m14', 'M14', 'm14', '7.62x51', 85000, [stock('m14'), guard('m14'), mag('m14'), mount('m14'), muzzle('m14')], { damage: 51, rpm: 240, recoil: 1.5, ergo: 34, weight: 2.55, capacity: 20, reload: 2.9, auto: false, spread: .013 }, 'Длинная американская винтовка с деревянной ложей, открытой верхней частью коробки и отдельным магазином. Представлена с одиночным режимом огня.')
];

function module(id: string, name: string, intf: string, shape: string, price: number, weight: number, mods: Mods = {}, slots: Slot[] = [], ammo?: string, extra: Partial<Definition> = {}): Definition {
    return { id, name, interface: intf, shape, price, weight, mods, slots, ammo, category: 'module',
        size: intf.endsWith('-mag') && (mods.capacity || 0) > 20 ? [1, 2] : [1, 1], rarity: 1, maxStack: 1,
        color: rgb(shape.includes('wood') ? '#906244' : shape.includes('sand') || shape.includes('scar') || shape.includes('mcx') || shape.includes('m17') ? '#a28d67' : '#363d39'),
        description: 'Деталь игровой мастерской. Меняет указанную сборку и её параметры; интерфейс не подтверждает совместимость настоящих изделий.', ...extra };
}

export const ARSENAL_MODULES: Definition[] = [
    module('ak12_stock', 'АК-12 · регулируемый приклад', 'ak12-stock', 'stock_ak12', 5800, .35, { recoil: -.08, ergo: 3 }),
    module('ak12_cheek', 'АК-12 · приклад с высокой щекой', 'ak12-stock', 'stock_ak12_cheek', 9300, .45, { recoil: -.16, ergo: -4 }),
    module('ak12_guard', 'АК-12 · угловатое цевьё', 'ak12-handguard', 'guard_ak12', 5600, .25, { ergo: 3 }, rail),
    module('ak12_guard_long', 'АК-12 · удлинённое цевьё мастерской', 'ak12-handguard', 'guard_ak12_long', 8900, .38, { recoil: -.05, ergo: -3 }, rail, undefined, { provides: ['guard:long'] }),
    module('ak12_brake', 'АК-12 · дульное устройство', 'ak12-muzzle', 'muzzle_ported', 4200, .13, { recoil: -.10, noise: .06 }),
    module('ak12_can', 'АК-12 · игровой глушитель', 'ak12-muzzle', 'muzzle_suppressor', 22500, .43, { noise: -.53, recoil: -.04, ergo: -9 }),
    module('ak545_window_30', 'Магазин 5,45 · окно · 30', 'ak545-mag', 'mag_545_window', 3200, .23, { capacity: 30, ergo: 2 }, [], '5.45x39'),
    module('rpk_stock', 'РПК · широкий полимерный приклад', 'rpk-stock', 'stock_rpk', 4700, .52, { recoil: -.14, ergo: -2 }),
    module('rpk_guard', 'РПК · массивное цевьё', 'rpk-handguard', 'guard_rpk', 3900, .3, { recoil: -.03 }),
    module('rpk_rail', 'РПК · цевьё с планками', 'rpk-handguard', 'guard_rpk_rail', 8700, .45, { recoil: -.04, ergo: -5 }, rail, undefined, { provides: ['guard:long'] }),
    module('val_stock', 'АС · трубчатый рамочный приклад', 'val-stock', 'stock_val', 6600, .23, { ergo: 7, recoil: -.04 }),
    module('val_grip', 'АС · полимерная рукоятка', 'val-grip', 'grip_plain', 2400, .11, { ergo: 3 }),
    module('val_ergo', 'АС · рукоятка с упором', 'val-grip', 'grip_ergo', 5700, .16, { ergo: 9, recoil: -.03 }),
    module('val_guard', 'АС / ВСС · узкое цевьё', 'val-handguard', 'guard_val', 3600, .16, { ergo: 4 }),
    module('val_rail', 'АС / ВСС · короткое рельсовое цевьё', 'val-handguard', 'guard_val_rail', 7800, .28, { ergo: -3 }, rail),
    module('vss_stock', 'ВСС · деревянный приклад с вырезом', 'vss-stock', 'stock_vss_wood', 7100, .58, { recoil: -.13, ergo: -2 }),
    module('vss_poly', 'ВСС · ложа мастерской с щекой', 'vss-stock', 'stock_vss_poly', 13800, .69, { recoil: -.20, ergo: -6 }),
    module('val_10', 'Магазин АС / ВСС · 10', 'val-mag', 'mag_val_short', 2900, .13, { capacity: 10, ergo: 5 }, [], '9x39'),
    module('val_20', 'Магазин АС / ВСС · 20', 'val-mag', 'mag_val', 4900, .21, { capacity: 20 }, [], '9x39'),
    module('val_30', 'Магазин АС / ВСС · 30 · мастерская', 'val-mag', 'mag_val_long', 9500, .34, { capacity: 30, ergo: -9, reload: .25 }, [], '9x39'),
    module('val_mount', 'АС / ВСС · боковой кронштейн', 'val-mount', 'mount_side', 6700, .18, {}, [optic]),
    module('g36_stock', 'G36 · складной скелетный приклад', 'g36-stock', 'stock_g36', 6900, .3, { recoil: -.07, ergo: 5 }),
    module('g36_adjust', 'G36 · регулируемый приклад с щекой', 'g36-stock', 'stock_g36_adjust', 11200, .48, { recoil: -.17, ergo: -5 }),
    module('g36_guard', 'G36K · вентилируемое цевьё', 'g36-handguard', 'guard_g36', 5700, .23, { ergo: 5 }),
    module('g36_rail', 'G36K · рельсовое цевьё', 'g36-handguard', 'guard_g36_rail', 9100, .37, { ergo: -3, recoil: -.04 }, rail),
    module('g36_grip', 'G36 · блок рукоятки', 'g36-grip', 'grip_vertical', 3400, .16),
    module('g36_30', 'Магазин G36 · 30', 'g36-mag', 'mag_g36', 3300, .16, { capacity: 30 }, [], '5.56x45'),
    module('g36_20', 'Короткий магазин G36 · 20', 'g36-mag', 'mag_g36_short', 3600, .13, { capacity: 20, ergo: 6 }, [], '5.56x45'),
    module('g36_muzzle', 'G36 · дульное устройство', 'g36-muzzle', 'muzzle_brake', 3700, .09, { recoil: -.06 }),
    module('g36_can', 'G36 · игровой глушитель', 'g36-muzzle', 'muzzle_suppressor', 24800, .41, { noise: -.54, ergo: -8 }),
    module('scar_stock', 'SCAR · регулируемый приклад', 'scar-stock', 'stock_scar', 8700, .51, { recoil: -.13 }),
    module('scar_precision', 'SCAR · приклад с увеличенной щекой', 'scar-stock', 'stock_scar_precision', 14700, .66, { recoil: -.23, ergo: -9 }),
    module('scar_guard', 'SCAR · короткое цевьё с планками', 'scar-handguard', 'guard_scar', 6600, .3, { ergo: 3 }, rail),
    module('scar_guard_long', 'SCAR · длинное цевьё мастерской', 'scar-handguard', 'guard_scar_long', 11300, .45, { recoil: -.06, ergo: -5 }, rail, undefined, { provides: ['guard:long'] }),
    module('scar_brake', 'SCAR-L · игровой компенсатор', 'scar-muzzle', 'muzzle_ported', 5800, .14, { recoil: -.13, noise: .10 }),
    module('aug_stock', 'AUG · оливковый корпус приклада', 'aug-stock', 'stock_aug', 8900, .61, { recoil: -.09 }, [], undefined, { color: rgb('#666b48') }),
    module('aug_stock_padded', 'AUG · корпус с накладкой затыльника', 'aug-stock', 'stock_aug_padded', 12900, .74, { recoil: -.18, ergo: -5 }),
    module('aug_guard', 'AUG · складная передняя рукоятка', 'aug-handguard', 'guard_aug', 4500, .14, { recoil: -.09, ergo: 3 }),
    module('aug_rail', 'AUG · передний модуль с планками', 'aug-handguard', 'guard_aug_rail', 9200, .31, { ergo: -4 }, rail),
    module('aug_30', 'Магазин AUG · 30', 'aug-mag', 'mag_aug', 3700, .16, { capacity: 30 }, [], '5.56x45', { color: rgb('#817752') }),
    module('aug_42', 'Длинный магазин AUG · 42', 'aug-mag', 'mag_aug_long', 6500, .26, { capacity: 42, ergo: -7, reload: .20 }, [], '5.56x45', { color: rgb('#817752') }),
    module('aug_muzzle', 'AUG · дульное устройство', 'aug-muzzle', 'muzzle_brake', 4400, .10, { recoil: -.07 }),
    module('mcx_stock', 'MCX · тонкий складной приклад', 'mcx-stock', 'stock_mcx', 9800, .26, { ergo: 7, recoil: -.07 }),
    module('mcx_compact', 'MCX · компактный приклад мастерской', 'mcx-stock', 'stock_mcx_compact', 11200, .20, { ergo: 12, recoil: .02 }),
    module('mcx_guard', 'MCX · цевьё с продольными окнами', 'mcx-handguard', 'guard_mcx', 11700, .29, { ergo: 5, recoil: -.03 }, rail, undefined, { provides: ['guard:long'] }),
    module('mcx_guard_short', 'MCX · короткое цевьё мастерской', 'mcx-handguard', 'guard_mcx_short', 9800, .20, { ergo: 9 }, rail),
    module('mcx_muzzle', 'MCX · дульное устройство', 'mcx-muzzle', 'muzzle_brake', 5400, .10, { recoil: -.08 }),
    module('mcx_can', 'MCX · компактный игровой глушитель', 'mcx-muzzle', 'muzzle_short_can', 26000, .29, { noise: -.45, ergo: -6 }),
    module('bren_stock', 'BREN 2 · складной приклад', 'bren-stock', 'stock_bren', 8200, .32, { ergo: 4, recoil: -.09 }),
    module('bren_guard', 'BREN 2 · короткое цевьё', 'bren-handguard', 'guard_bren', 6500, .19, { ergo: 7 }, rail),
    module('bren_guard_long', 'BREN 2 · длинное цевьё мастерской', 'bren-handguard', 'guard_bren_long', 10900, .34, { recoil: -.06, ergo: -3 }, rail, undefined, { provides: ['guard:long'] }),
    module('bren_grip', 'BREN 2 · контурная рукоятка', 'bren-grip', 'grip_ergo', 3900, .11, { ergo: 6 }),
    module('bren_muzzle', 'BREN 2 · дульное устройство', 'bren-muzzle', 'muzzle_brake', 4200, .09, { recoil: -.08 }),
    module('scorpion_stock', 'Scorpion · складной приклад', 'scorpion-stock', 'stock_scorpion', 5100, .27, { ergo: 4, recoil: -.06 }),
    module('scorpion_guard', 'Scorpion · короткое полимерное цевьё', 'scorpion-handguard', 'guard_scorpion', 3500, .18, { ergo: 4 }, rail),
    module('scorpion_guard_long', 'Scorpion · длинное цевьё мастерской', 'scorpion-handguard', 'guard_scorpion_long', 7300, .29, { recoil: -.05, ergo: -3 }, rail),
    module('scorpion_grip', 'Scorpion · наклонная рукоятка', 'scorpion-grip', 'grip_scorpion', 2700, .10),
    module('scorpion_20', 'Магазин Scorpion · 20', 'scorpion-mag', 'mag_scorpion_short', 2700, .12, { capacity: 20, ergo: 7 }, [], '9x19'),
    module('scorpion_30', 'Магазин Scorpion · 30', 'scorpion-mag', 'mag_scorpion', 3600, .17, { capacity: 30 }, [], '9x19'),
    module('scorpion_can', 'Scorpion · игровой глушитель', 'scorpion-muzzle', 'muzzle_short_can', 18000, .28, { noise: -.55, ergo: -5 }),
    module('mpx_stock', 'MPX · выдвижной приклад', 'mpx-stock', 'stock_mpx', 6700, .24, { ergo: 6, recoil: -.06 }),
    module('mpx_guard', 'MPX · короткое цевьё с окнами', 'mpx-handguard', 'guard_mpx', 5900, .18, { ergo: 5 }, rail),
    module('mpx_guard_long', 'MPX · удлинённое цевьё мастерской', 'mpx-handguard', 'guard_mpx_long', 8800, .29, { recoil: -.06, ergo: -3 }, rail),
    module('mpx_20', 'Магазин MPX · 20', 'mpx-mag', 'mag_mpx_short', 3600, .13, { capacity: 20, ergo: 6 }, [], '9x19'),
    module('mpx_30', 'Магазин MPX · 30', 'mpx-mag', 'mag_mpx', 4700, .19, { capacity: 30 }, [], '9x19'),
    module('mpx_can', 'MPX · игровой глушитель', 'mpx-muzzle', 'muzzle_short_can', 21800, .25, { noise: -.56, ergo: -5 }),
    module('m9_grip', 'M9A3 · тонкие накладки', 'm9-grip', 'grip_m9_sand', 2500, .075, { ergo: 3 }),
    module('m9_rubber', 'M9A3 · объёмные резиновые накладки', 'm9-grip', 'grip_m9_rubber', 4200, .11, { recoil: -.07, ergo: 7 }),
    module('m9_17', 'Магазин M9A3 · 17', 'm9-mag', 'mag_m9', 2600, .09, { capacity: 17 }, [], '9x19'),
    module('m9_20', 'Магазин M9A3 · 20', 'm9-mag', 'mag_m9_long', 4100, .13, { capacity: 20, ergo: -3 }, [], '9x19'),
    module('m17_grip', 'M17 · рамка с рукояткой', 'm17-grip', 'grip_m17', 3900, .12, { ergo: 4 }),
    module('m17_grip_slim', 'M17 · узкая рамка мастерской', 'm17-grip', 'grip_m17_slim', 6200, .105, { ergo: 9, recoil: .02 }),
    module('m17_17', 'Магазин M17 · 17', 'm17-mag', 'mag_m17', 3300, .085, { capacity: 17 }, [], '9x19'),
    module('m17_21', 'Магазин M17 · 21', 'm17-mag', 'mag_m17_long', 5300, .11, { capacity: 21, ergo: -4 }, [], '9x19'),
    module('m17_mount', 'M17 · игровая площадка прицела', 'm17-mount', 'mount_pistol', 3400, .035, {}, [slot('optic', 'Компактный коллиматор', 'pistol-optic')]),
    module('pistol_dot', 'Компактный пистолетный коллиматор', 'pistol-optic', 'optic_micro', 13500, .04, { zoom: 1, ergo: -1 }),
    module('870_wood', '870 · деревянный приклад', '870-stock', 'stock_870_wood', 3400, .50, { recoil: -.13 }),
    module('870_tactical', '870 · полимерный приклад с рукояткой', '870-stock', 'stock_870_tactical', 7400, .55, { recoil: -.20, ergo: 3 }),
    module('870_pump', '870 · деревянное подвижное цевьё', '870-handguard', 'guard_870_wood', 2400, .24),
    module('870_pump_rail', '870 · подвижное цевьё с планками', '870-handguard', 'guard_870_rail', 5300, .30, { recoil: -.04, ergo: -2 }, rail),
    module('benelli_stock', 'M4 · регулируемый приклад с рукояткой', 'benelli-stock', 'stock_benelli', 10400, .48, { recoil: -.16 }),
    module('benelli_fixed', 'M4 · фиксированный приклад с накладкой', 'benelli-stock', 'stock_benelli_fixed', 8300, .61, { recoil: -.23, ergo: -5 }),
    module('benelli_guard', 'M4 · раздельные полимерные накладки', 'benelli-handguard', 'guard_benelli', 4600, .25, { ergo: 3 }),
    module('benelli_rail', 'M4 · рельсовое цевьё мастерской', 'benelli-handguard', 'guard_benelli_rail', 10600, .39, { recoil: -.04, ergo: -4 }, rail),
    module('m14_stock', 'M14 · деревянная ложа', 'm14-stock', 'stock_m14_wood', 6800, .86, { recoil: -.13, ergo: -3 }),
    module('m14_chassis', 'M14 · алюминиевое шасси мастерской', 'm14-stock', 'stock_m14_chassis', 21000, 1.20, { recoil: -.26, ergo: -11 }),
    module('m14_guard', 'M14 · верхняя накладка', 'm14-handguard', 'guard_m14', 2600, .10, { ergo: 2 }),
    module('m14_20', 'Магазин M14 · 20', 'm14-mag', 'mag_m14', 3800, .23, { capacity: 20 }, [], '7.62x51'),
    module('m14_10', 'Магазин M14 · 10', 'm14-mag', 'mag_m14_short', 2900, .16, { capacity: 10, ergo: 7 }, [], '7.62x51'),
    module('m14_mount', 'M14 · боковой мостик оптики', 'm14-mount', 'mount_side', 8300, .24, { ergo: -2 }, [optic]),
    module('m14_muzzle', 'M14 · длинный пламегаситель', 'm14-muzzle', 'muzzle_m14', 4200, .13, { recoil: -.07 }),
    module('scope3_compact', 'Компактная оптика ×3', 'rail-optic', 'optic_prism', 22500, .28, { zoom: 3, ergo: -4 }),
    module('fore_slim', 'Тонкий передний упор', 'rail-grip', 'fore_slim', 3500, .065, { recoil: -.05, ergo: 5 }),
    module('light_compact', 'Укороченный рельсовый фонарь', 'rail-light', 'light_compact', 6900, .10, { ergo: -1 }, [], undefined, { occupiedPositions: ['right-front'] })
];

export const ARSENAL_BUILDS: Record<string, Record<string, string>> = {
    weapon_ak12: { stock: 'ak12_stock', handguard: 'ak12_guard', pistolgrip: 'ak_grip', magazine: 'ak545_window_30', muzzle: 'ak12_brake' },
    weapon_rpk74m: { stock: 'rpk_stock', handguard: 'rpk_guard', pistolgrip: 'ak_grip', magazine: 'ak545_45', muzzle: 'ak_brake' },
    weapon_asval: { stock: 'val_stock', handguard: 'val_guard', pistolgrip: 'val_grip', magazine: 'val_20' },
    weapon_vss: { stock: 'vss_stock', handguard: 'val_guard', magazine: 'val_10' },
    weapon_g36k: { stock: 'g36_stock', handguard: 'g36_guard', pistolgrip: 'g36_grip', magazine: 'g36_30', muzzle: 'g36_muzzle' },
    weapon_scarl: { stock: 'scar_stock', handguard: 'scar_guard', pistolgrip: 'ar_grip', magazine: 'ar556_30', muzzle: 'scar_brake' },
    weapon_auga3: { stock: 'aug_stock', handguard: 'aug_guard', magazine: 'aug_30', muzzle: 'aug_muzzle' },
    weapon_mcxspearlt: { stock: 'mcx_stock', handguard: 'mcx_guard', pistolgrip: 'ar_grip', magazine: 'ar556_30', muzzle: 'mcx_muzzle' },
    weapon_bren2: { stock: 'bren_stock', handguard: 'bren_guard', pistolgrip: 'bren_grip', magazine: 'ar556_30', muzzle: 'bren_muzzle' },
    weapon_scorpion: { stock: 'scorpion_stock', handguard: 'scorpion_guard', pistolgrip: 'scorpion_grip', magazine: 'scorpion_30' },
    weapon_mpx: { stock: 'mpx_stock', handguard: 'mpx_guard', pistolgrip: 'ar_grip', magazine: 'mpx_30' },
    weapon_m9a3: { pistolgrip: 'm9_grip', magazine: 'm9_17' },
    weapon_m17: { pistolgrip: 'm17_grip', magazine: 'm17_17' },
    weapon_rem870: { stock: '870_wood', handguard: '870_pump' },
    weapon_benellim4: { stock: 'benelli_stock', handguard: 'benelli_guard' },
    weapon_m14: { stock: 'm14_stock', handguard: 'm14_guard', magazine: 'm14_20', muzzle: 'm14_muzzle' }
};

export const ARSENAL_AMMO: Definition[] = [
    { id: 'ammo_9x39', name: 'Патроны 9×39', category: 'ammo', ammo: '9x39', shape: 'ammo', price: 92, weight: .020, maxStack: 90, size: [1, 1], rarity: 1, color: rgb('#9b8a58'), description: 'Игровая группа боеприпасов для АС «Вал» и ВСС. Несовместима с пистолетными 9×19 и 9×18.' },
    { id: 'ammo_7.62x51', name: 'Патроны 7,62×51', category: 'ammo', ammo: '7.62x51', shape: 'ammo', price: 89, weight: .024, maxStack: 90, size: [1, 1], rarity: 1, color: rgb('#b39a62'), description: 'Игровая группа боеприпасов для M14. Не заменяет 7,62×39 или 7,62×54R.' }
];
