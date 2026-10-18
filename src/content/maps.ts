import type { MapDef, Vec3, Category } from '../domain/types.js';
import { rgb, rng } from '../domain/util.js';
import { Builder } from './map-builder.js';
import { expandMap } from './map-expansion.js';
import { enrichMap } from './map-details.js';
const brick = rgb(0x936755), concrete = rgb(0x91928b), steel = rgb(0x55676a), wood = rgb(0x847454);
function factory(): MapDef {
    const b = new Builder('factory', 'Пельменный завод Буянова', 'Цех, морозилка, погрузка и кабинет технолога.', 'factory', [124, 106], rgb(0x70786c), rgb(0xa5b0aa));
    b.boundary();
    b.room(-20, -7, 29, 28, 'ЦЕХ № 2', brick, 'nsew', 5.8);
    b.room(24, 9, 29, 23, 'СКЛАД УПАКОВКИ', rgb(0x827765), 'nsw', 5.2);
    b.room(-20, -33, 23, 13, 'МОРОЗИЛЬНАЯ КАМЕРА', rgb(0x9ba59e), 'se', 4);
    b.room(29, -29, 26, 16, 'ОТДЕЛ КОНТРОЛЯ КАЧЕСТВА', brick, 'nsew', 6.8, false);
    b.room(-43, 30, 14, 11, 'ПРОХОДНАЯ', brick, 'ne', 3.3);
    b.door([-20, 1.33, 7], 'x', 'Дверь цеха');
    b.door([9.5, 1.33, 9], 'z', 'Дверь склада', true);
    // Full-height passages connect the two exterior stairs to the administrative deck.
    b.m.boxes = b.m.boxes.filter(o => !(o.kind === 'wall' && (Math.abs(o.p[2] + 37) < .01 || Math.abs(o.p[2] + 21) < .01) && o.p[0] >= 16 && o.p[0] <= 42));
    for (const z of [-37, -21]) {
        for (const [left, right] of [[16, 18.2], [21.8, 27.3], [30.7, 36.2], [39.8, 42]])
            b.box([(left + right) / 2, 3.4, z], [right - left, 6.8, .45], brick, 'wall');
        b.box([29, 6.25, z], [26, 1.1, .45], brick, 'wall');
    }
    b.deck(29, -28, 24, 14, 3.4);
    b.stairs(20, -40, 3.4, 10, 0, 3.4);
    b.stairs(38, -16, 3.4, 10, 3.4, -3.4);
    for (const x of [17.4, 40.6])
        b.box([x, 4, -28], [.18, 1.2, 12], steel, 'rail');
    for (const z of [-34.9, -21.1])
        b.box([29, 4, z], [13, 1.2, .14], steel, 'rail');
    for (const x of [-28, -14]) {
        b.box([x, .75, -7], [3.3, 1.5, 12], steel, 'machine');
        b.box([x, 1.7, -7], [2.4, .35, 10], rgb(0xa6aaa1), 'conveyor');
        for (const z of [-11, -7, -3])
            b.box([x, 2.3, z], [1.8, .9, 1.4], concrete, 'machine');
    }
    for (const x of [19, 29, 37])
        for (const z of [3, 14])
            b.box([x, 1, z], [3, 2, 2.8], wood, 'pallet');
    b.box([-1, 1.2, 29], [5, 2.4, 11], rgb(0x687a73), 'truck');
    b.box([-1, 1.4, 36], [5, 2.8, 3], rgb(0xb1aa87), 'cab');
    b.box([47, 2, 4], [2, 4, 25], steel, 'container');
    b.box([-48, 1, -13], [4, 2, 9], wood, 'pallet');
    b.poi('workshop', 'Формовочный цех', [-20, 0, -7]);
    b.poi('office', 'Кабинет технолога', [29, 3.4, -28]);
    b.poi('freezer', 'Морозилка', [-20, 0, -33]);
    const pts: [
        number,
        number,
        Category,
        string,
        number?
    ][] = [[-32, 3, 'hand_tools', 'Ящик слесаря'], [-9, 2, 'industrial', 'Запчасти'], [-29, -17, 'industrial', 'Датчики'], [-9, -16, 'hand_tools', 'Рабочий стол'], [-21, -4, 'factory_special', 'Контрольный образец'], [-25, -33, 'food_drink', 'Холодильный ларь'], [-15, -34, 'factory_special', 'Продукция'], [14, 1, 'building_material', 'Крепёж'], [24, 0, 'household', 'Хозяйственный ящик'], [36, 0, 'food_drink', 'Запас смены'], [14, 16, 'building_material', 'Упаковочные материалы'], [30, 18, 'industrial', 'Ремкомплект'], [25, -28, 'documents', 'Стол технолога', 3.4], [34, -28, 'factory_special', 'Рецептуры', 3.4], [29, -32, 'electronics', 'Рабочая станция', 3.4], [32, -24, 'medical', 'Аптечный шкаф', 3.4], [-46, 29, 'documents', 'Накладные'], [-41, 28, 'medical', 'Аптечка проходной'], [-48, 5, 'hand_tools', 'Служебный шкаф'], [49, 27, 'electronics', 'Ремонтная сумка'], [43, -30, 'industrial', 'Инструментальный шкаф'], [-37, -42, 'household', 'Забытый ящик'], [3, -31, 'building_material', 'Складские остатки'], [3, -8, 'medical', 'Санитарный пост'], [23, 34, 'food_drink', 'Стол рабочего'], [-26, 27, 'household', 'Бытовка'], [-31, 14, 'hand_tools', 'Переносной ящик'], [4, 17, 'electronics', 'Щитовая'], [-6, -42, 'factory_special', 'Журнал партии'], [44, -6, 'valuables', 'Потерянный портфель']];
    pts.forEach(([x, z, c, n, y], i) => b.loot(x, z, c, n, y || 0, i % 4 === 0));
    b.m.spawn = [[-50, 0, 42], [-46, 0, 42], [-42, 0, 42], [-50, 0, 38], [-46, 0, 38]];
    b.m.bots = [[-23, 0, -12], [26, 0, 6], [5, 0, -26], [-20, 0, -35], [34, 3.4, -29], [44, 0, 15]];
    b.exit('gate', 'Служебная калитка', [-51, 0, -43]);
    b.exit('ramp', 'Погрузочная рампа', [51, 0, 39]);
    return b.m;
}
function city(): MapDef {
    const b = new Builder('city', 'Обводный квартал', 'Три двора, ремонтная мастерская и служебный переулок.', 'city', [144, 132], rgb(0x777d79), rgb(0xb4bcba));
    b.boundary();
    for (const [x, z, w, d] of [[-35, -30, 34, 26], [32, -33, 36, 23], [-39, 27, 28, 25], [34, 30, 31, 25]]) {
        b.room(x, z, w, d, x < 0 ? 'ДВОР / ЛИТЕРА А' : 'ДВОР / ЛИТЕРА Б', rgb(x < 0 ? 0xa3937e : 0x9b7163), 'nsew', 8.5, false);
        for (let xx = x - w / 2 + 3; xx < x + w / 2; xx += 5)
            for (const yy of [4.1, 6.6]) {
                b.box([xx, yy, z + d / 2 + .25], [1.1, 1.8, .09], rgb(0x354b50), 'window', false);
                b.box([xx, yy, z - d / 2 - .25], [1.1, 1.8, .09], rgb(0x354b50), 'window', false);
            }
    }
    b.room(0, -2, 20, 20, 'РЕМОНТНАЯ МАСТЕРСКА', brick, 'nsew', 4.5);
    b.room(-51, -3, 17, 14, 'АПТЕКА', rgb(0x8a998b), 'ew', 4);
    b.room(48, -3, 17, 14, 'ПРОДУКТЫ', rgb(0xb1a387), 'ew', 4);
    b.door([0, 1.33, 8], 'x', 'Дверь мастерской');
    b.box([0, .02, 49], [134, .04, 9], rgb(0x4b5355), 'road', false);
    b.box([0, .08, -57], [134, .16, 6], rgb(0x979b93), 'walk', false);
    for (const x of [-56, -13, 15, 55]) {
        b.box([x, 1.2, 45], [2.6, 2.4, 4.8], rgb(x < 0 ? 0x717458 : 0x536871), 'car');
    }
    for (const z of [-21, 22])
        for (const x of [-15, 15]) {
            b.box([x, .6, z], [3, 1.2, 1], wood, 'bench');
            b.tree(x + 3, z + 2, 1);
        }
    b.poi('workshop', 'Мастерская', [0, 0, -2]);
    b.poi('pharmacy', 'Аптека', [-51, 0, -3]);
    b.poi('canal', 'Служебная набережная', [0, 0, -55]);
    const zones: [
        number,
        number,
        Category,
        string
    ][] = [[-35, -30, 'household', 'Дворовый шкаф'], [32, -33, 'valuables', 'Квартирные вещи'], [-39, 27, 'electronics', 'Склад конторы'], [34, 30, 'documents', 'Архив'], [-51, -3, 'medical', 'Аптечный шкаф'], [48, -3, 'food_drink', 'Продуктовая полка'], [0, -2, 'hand_tools', 'Верстак'], [0, -2, 'industrial', 'Ящик мастера'], [0, -53, 'building_material', 'Служебный ящик'], [-60, 45, 'household', 'Остановка']];
    zones.forEach(([x, z, c, n], i) => { for (let j = 0; j < 3; j++)
        b.loot(x - 4 + j * 3, z + (i % 2 ? 3 : -3), c, n + ' ' + (j + 1), 0, j === 1); });
    b.m.spawn = [[-61, 0, 54], [-57, 0, 54], [-53, 0, 54], [-61, 0, 50], [-57, 0, 50]];
    b.m.bots = [[-35, 0, -27], [32, 0, -35], [3, 0, -4], [-46, 0, 21], [44, 0, 24], [0, 0, -48]];
    b.exit('canal', 'Проход к каналу', [-62, 0, -56]);
    b.exit('alley', 'Служебный переулок', [61, 0, 55]);
    return b.m;
}
function village(): MapDef {
    const b = new Builder('village', 'Дачный посёлок', 'Дома среди сосен, гараж и большая дача.', 'village', [158, 144], rgb(0x68794f), rgb(0xaebaa1));
    b.boundary();
    b.box([0, .01, 0], [10, .02, 140], rgb(0x9e9780), 'dirt', false);
    b.box([0, .015, 0], [150, .03, 8], rgb(0xa5a18d), 'dirt', false);
    const plots = [[-42, -43], [-22, -18], [-49, 26], [-22, 49], [31, -45], [47, -13], [29, 23], [53, 49]];
    plots.forEach(([x, z], i) => {
        b.room(x, z, 14, 12, i === 4 ? 'ДАЧА № 7' : 'УЛ. СОСНОВАЯ · ' + (i + 1), rgb([0x9b875e, 0x839082, 0x799094][i % 3]), i % 2 ? 'ns' : 'ew', 3.4);
        b.box([x, 4.2, z], [15, 1.6, 13], rgb(0x62685e), 'gable', false);
        // The garage driveway belongs to the large-dacha plot. A continuous fence
        // here used to seal its west entrance after the buildings were separated.
        if (i === 4) {
            b.box([x + 11, .9, z - 9.8], [.2, 1.8, 3.4], wood, 'fence');
            b.box([x + 11, .9, z + 8], [.2, 1.8, 7], wood, 'fence');
        } else b.box([x + 11, .9, z], [.2, 1.8, 23], wood, 'fence');
        b.box([x - 2, .9, z - 10], [22, 1.8, .2], wood, 'fence');
        b.tree(x + 7, z + 9, i % 3 === 0 ? 1 : 0);
    });
    // Keep a genuine 3.5 m service passage instead of intersecting the dacha.
    b.room(50, -51, 17, 14, 'ГАРАЖНАЯ МАСТЕРСКА', brick, 'sw', 4.2);
    b.room(-51, 52, 16, 12, 'ЛАВКА', wood, 'ne', 3.5);
    b.door([50, 1.33, -44], 'x', 'Гаражные ворота');
    b.box([16, .6, -4], [2.5, 1.2, 2.5], concrete, 'well');
    b.poi('garage', 'Гараж', [50, 0, -51]);
    b.poi('dacha', 'Большая дача', [31, 0, -45]);
    b.poi('shop', 'Лавка', [-51, 0, 52]);
    plots.forEach(([x, z], i) => { b.loot(x - 3, z - 3, i === 4 ? 'valuables' : i % 2 ? 'household' : 'food_drink', 'Домовой шкаф'); b.loot(x + 3, z + 2, i === 4 ? 'electronics' : 'hand_tools', 'Тумба'); b.loot(x + 8, z + 6, 'building_material', 'Сарай'); });
    [[46, -54], [54, -54], [50, -48]].forEach(([x, z]) => b.loot(x, z, 'hand_tools', 'Инструменты', 0, true));
    b.loot(-55, 51, 'food_drink', 'Бакалея');
    b.loot(-48, 49, 'medical', 'Аптечка');
    b.loot(17, -7, 'industrial', 'Насосная');
    const random = rng(1707);
    for (let i = 0; i < 30; i++) {
        const x = (random() - .5) * 148, z = (random() - .5) * 135;
        if (Math.abs(x) > 65 || Math.abs(z) > 62)
            b.tree(x, z, i % 4 === 0 ? 1 : 0);
    }
    b.m.spawn = [[-65, 0, 61], [-61, 0, 62], [-57, 0, 61], [-65, 0, 57], [-61, 0, 57]];
    b.m.bots = [[31, 0, -44], [-20, 0, -15], [47, 0, -12], [29, 0, 21], [-41, 0, -40], [14, 0, -14]];
    b.exit('forest', 'Лесная дорога', [67, 0, -62]);
    b.exit('bus', 'Автобусный разворот', [4, 0, 61]);
    return b.m;
}
function park(): MapDef {
    const b = new Builder('park', 'Сосновый парк', 'Аллеи, павильоны, пруд и хозяйственный двор.', 'park', [172, 154], rgb(0x63784e), rgb(0xaebba7));
    b.boundary();
    b.box([0, .01, 0], [8, .02, 147], rgb(0xa9a593), 'path', false);
    b.box([0, .012, 0], [163, .024, 8], rgb(0xa9a593), 'path', false);
    b.box([0, .018, 38], [138, .036, 5], rgb(0xa9a593), 'path', false);
    b.room(-37, 20, 16, 14, 'ПРОКАТ', rgb(0x829178), 'nse', 3.3);
    b.room(36, -35, 22, 18, 'ХОЗЯЙСТВЕННЫЙ ДВОР', brick, 'nsew', 4);
    b.room(-38, -37, 15, 13, 'ИНВЕНТАРЬ', wood, 'ns', 3.4);
    b.room(33, 24, 15, 13, 'ПАВИЛЬОН', rgb(0x9d9278), 'nsew', 3.4);
    b.box([39, .05, -6], [30, .1, 21], rgb(0x597e82), 'water', false);
    b.box([39, -.4, -6], [32, 1, 23], rgb(0x4c6a6a), 'pond', true);
    for (const x of [23, 55])
        b.box([x, .5, -6], [.3, 1, 23], wood, 'rail');
    for (const z of [-18, 6])
        b.box([39, .5, z], [32, 1, .3], wood, 'rail');
    const r = rng(1009);
    for (let i = 0; i < 130; i++) {
        const x = (r() - .5) * 162, z = (r() - .5) * 145;
        if (Math.abs(x) < 8 || Math.abs(z) < 7 || Math.abs(z - 38) < 5)
            continue;
        if (b.m.boxes.some(o => ['wall', 'roof', 'pond'].includes(o.kind) && Math.abs(o.p[0] - x) < o.s[0] / 2 + 4 && Math.abs(o.p[2] - z) < o.s[2] / 2 + 4))
            continue;
        b.tree(x, z, i % 6 === 0 ? 1 : 0);
    }
    for (let z = -60; z <= 60; z += 20) {
        b.box([7, .6, z], [3, 1.2, .8], wood, 'bench');
        b.box([-7, 2.5, z], [.12, 5, .12], steel, 'lamp');
        b.box([-7, 5, z], [.8, .16, .8], rgb(0xe1d4a5), 'lamphead', false);
    }
    b.door([36, 1.33, -26], 'x', 'Дверь хозяйственного двора');
    b.poi('yard', 'Хозяйственный двор', [36, 0, -35]);
    // The visit marker must be on the public bank, not 11 m inside the fenced water.
    b.poi('pond', 'Смотровая у пруда', [20, 0, -6]);
    b.poi('sports', 'Спортплощадка', [-31, 0, -6]);
    const zones: [
        number,
        number,
        Category
    ][] = [[-37, 20, 'household'], [36, -35, 'electronics'], [-38, -37, 'hand_tools'], [33, 24, 'medical']];
    zones.forEach(([x, z, c]) => { for (let i = 0; i < 5; i++)
        b.loot(x - 5 + (i % 3) * 4, z - 3 + Math.floor(i / 3) * 5, c, 'Павильонный шкаф', 0, i % 3 === 0); });
    for (let i = 0; i < 10; i++)
        b.loot(i % 2 ? 12 : -12, -60 + Math.floor(i / 2) * 24, i % 3 === 0 ? 'food_drink' : 'household', 'Служебная скамья', 0, true);
    b.m.spawn = [[-9, 0, 67], [-13, 0, 67], [-1, 0, 67], [-9, 0, 63], [-5, 0, 63]];
    b.m.bots = [[34, 0, -35], [-36, 0, -38], [31, 0, 24], [-35, 0, 20], [0, 0, -35], [55, 0, 32]];
    b.exit('main', 'Главные ворота', [-65, 0, 64]);
    b.exit('north', 'Северная просека', [0, 0, -66]);
    return b.m;
}
function mall(): MapDef {
    const b = new Builder('mall', 'Торговый центр', 'Атриум, аптека, техномагазин и две лестницы.', 'mall', [120, 108], rgb(0x929790), rgb(0xb8c0ba));
    b.boundary();
    b.room(0, 0, 91, 77, 'ТОРГОВЫЙ ЦЕНТР «СЕВЕР»', rgb(0xadb2a4), 'nsew', 9, false);
    b.box([0, .015, 0], [90, .03, 76], rgb(0xc4c6b7), 'tile', false);
    b.room(-26, -22, 27, 20, 'ЭЛЕКТРОНИКА', steel, 'se', 3.6);
    b.room(26, -22, 27, 20, 'ПРОДУКТЫ', rgb(0x969c7f), 'sw', 3.6);
    b.room(-26, 22, 27, 20, 'АПТЕКА', rgb(0x91a197), 'ne', 3.6);
    b.room(26, 22, 27, 20, 'ХОЗТОВАРЫ', wood, 'nw', 3.6);
    b.deck(-27, 0, 32, 74, 4);
    b.deck(27, 0, 32, 74, 4);
    b.deck(0, -30, 23, 14, 4);
    b.deck(0, 30, 23, 14, 4);
    // Two physically independent ramps connect floors, without a fake teleport trigger.
    b.stairs(-6, 9, 4, 28, 0, 4);
    b.stairs(6, -9, 4, 28, 4, -4);
    for (const x of [-11, 11])
        b.box([x, 4.65, 0], [.16, 1.3, 46], steel, 'rail');
    // Guard the actual atrium lip. The former +/-18 m segments stood on the
    // mezzanine itself and left both central edges completely unguarded.
    for (const [z, left, right] of [[23, -11.5, -8.3], [23, -3.7, 11.5], [-23, -11.5, 3.7], [-23, 8.3, 11.5]])
        b.box([(left + right) / 2, 4.65, z], [right - left, 1.3, .16], steel, 'rail');
    b.box([0, 0.5, 0], [5, 1, 5], rgb(0x737f71), 'planter');
    for (const x of [-38, 38])
        for (const z of [-31, 31])
            b.box([x, 4.5, z], [1, 9, 1], concrete, 'pillar');
    b.door([-26, 1.33, 12], 'x', 'Дверь аптеки');
    b.poi('atrium', 'Атриум', [0, 0, 0]);
    b.poi('tech', 'Техномагазин', [-28, 4, -20]);
    b.poi('foodcourt', 'Фудкорт', [28, 4, 20]);
    for (const [x, z, c] of [[-28, -22, 'electronics'], [28, -22, 'food_drink'], [-28, 22, 'medical'], [28, 22, 'household']] as [
        number,
        number,
        Category
    ][]) {
        for (let i = 0; i < 4; i++)
            b.loot(x - 7 + (i % 2) * 12, z - 5 + Math.floor(i / 2) * 9, c, 'Магазинная полка');
    }
    for (let i = 0; i < 8; i++)
        b.loot(i < 4 ? -29 : 29, -27 + (i % 4) * 17, i < 4 ? 'electronics' : 'food_drink', i < 4 ? 'Техномагазин' : 'Фудкорт', 4, i % 2 === 0);
    for (let i = 0; i < 6; i++)
        b.loot(-32 + i * 12, 45, i % 2 ? 'building_material' : 'industrial', 'Зона разгрузки');
    b.m.signs.push({ text: 'ТЕХНО / 2 ЭТАЖ', p: [-27, 6, -34], yaw: 0 }, { text: 'ФУДКОРТ', p: [27, 6, 34], yaw: Math.PI });
    b.m.spawn = [[-48, 0, 44], [-47, 0, 47], [-40, 0, 44], [-48, 0, 40], [-44, 0, 40]];
    b.m.bots = [[-26, 0, -22], [26, 0, -22], [26, 0, 22], [32, 4, -24], [-29, 4, 18], [42, 0, 42]];
    b.exit('loading', 'Зона разгрузки', [48, 0, -43]);
    b.exit('parking', 'Выход через парковку', [47, 0, 44]);
    return b.m;
}
function range(): MapDef {
    const b = new Builder('range', 'Тренировочный тир', 'Патроны не расходуются из профиля.', 'range', [34, 94], rgb(0x73786c), rgb(0xa7b1a5));
    b.boundary();
    b.m.duration = 3600;
    b.m.spawn = [[0, 0, 36]];
    b.room(0, 35, 26, 12, 'СТРЕЛКОВЫЙ РУБЕЖ', rgb(0x6c7771), 'ns', 3.6);
    for (const [i, z] of [23, 10, -8, -32].entries()) {
        b.box([(i % 2 ? 1 : -1) * 4, 1.25, z], [1.1, 1.9, .16], rgb(0xd5c9a3), 'target');
        b.m.signs.push({ text: [12, 25, 43, 67][i] + ' м', p: [(i % 2 ? 1 : -1) * 4, 2.8, z], yaw: 0 });
    }
    return b.m;
}
function gameplayPass(m: MapDef): MapDef {
    if (m.id === 'range') return m;
    // Preserve both unconditional exits. The extra route trades a detour for a different escape.
    const options: Record<string, {name:string; exit:Vec3; control:Vec3; key?:string}> = {
        factory:{name:'Административный выход',exit:[46,0,-45],control:[30,4.7,-23],key:'loot_documents_10'},
        city:{name:'Гаражные ворота',exit:[60,0,-53],control:[7,1.35,-8]},
        village:{name:'Старая калитка',exit:[-66,0,-56],control:[18,1.35,-4]},
        park:{name:'Служебная дорога',exit:[70,0,-63],control:[43,1.35,-32]},
        mall:{name:'Служебные ворота',exit:[-50,0,-44],control:[35,1.35,15]}
    };
    const option = options[m.id], control = m.id+'-access';
    m.activators = [{id:control,name:option.key?'Замок администрации':'Пульт: '+option.name,p:option.control,key:option.key}];
    m.exits.push({id:'service',name:option.name,p:option.exit,radius:2.8,seconds:8,requires:control});
    m.signs.push({text:option.key?'АДМИНИСТРАЦИЯ / НУЖЕН ПРОПУСК':'ПУЛЬТ СЛУЖЕБНОГО ВЫХОДА',p:[option.control[0],option.control[1]+.65,option.control[2]],yaw:0});
    m.boxes.push({id:control+'-pedestal',p:[option.control[0],(option.control[1]+(m.id==='factory'?3.4:0))/2-.05,option.control[2]],s:[.34,Math.max(.2,option.control[1]-(m.id==='factory'?3.4:0)-.15),.34],color:steel,kind:'pole',solid:false});
    // Readable service entrance: visible sign and supports, no invisible exit wall.
    m.signs.push({text:'ВЫХОД / '+option.name,p:[option.exit[0],2.6,option.exit[2]-1.5],yaw:0});
    for(const offset of [-2.3,2.3])m.boxes.push({id:control+'-exit-post'+offset,p:[option.exit[0]+offset,1.3,option.exit[2]-1.5],s:[.14,2.6,.14],color:steel,kind:'pole',solid:true});
    if(m.id==='factory'){
        m.boxes.push({id:'loading-pavement',p:[0,.008,29],s:[105,.016,25],color:rgb('#535e5b'),kind:'road',solid:false});
        for(let n=0;n<9;n++)m.boxes.push({id:'loading-mark'+n,p:[-43+n*10,.02,29],s:[3,.01,.14],color:rgb('#adac95'),kind:'marking',solid:false});
        for(const [n,x,z] of [[0,-34,27],[1,14,30],[2,6,-25],[3,-42,-26]])m.boxes.push({id:'yard-cover'+n,p:[x,.6,z],s:[2.8,1.2,1.1],color:rgb('#7f806e'),kind:'pallet',solid:true});
    }
    // Decorative caps on machinery/cars were outside the collision model.
    for (const b of [...m.boxes]) {
        if (b.kind === 'machine') m.boxes.push({id:b.id+'-cap',p:[b.p[0],b.p[1]+b.s[1]/2+.2,b.p[2]],s:[b.s[0]*.6,.4,b.s[2]*.6],kind:'collision-only',color:b.color,solid:true});
        if (b.kind === 'car' || b.kind === 'truck') m.boxes.push({id:b.id+'-cabin',p:[b.p[0],b.p[1]+b.s[1]*.6,b.p[2]],s:[b.s[0]*.8,b.s[1]*.45,b.s[2]*.45],kind:'collision-only',color:b.color,solid:true});
    }
    return m;
}
export const MAPS: Record<string, MapDef> = Object.fromEntries([factory(), city(), village(), park(), mall(), range()].map(enrichMap).map(gameplayPass).map(expandMap).map(m => [m.id, m]));
export const RAID_MAPS = Object.values(MAPS).filter(m => m.id !== 'range');
