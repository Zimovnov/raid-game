import type { Box, Category, Color, MapDef, Vec3 } from '../domain/types.js';
import { rgb } from '../domain/util.js';

// Original, hand-placed low-poly scenery. Every large object uses the same visible
// boxes for navigation, movement and shots. Small labels/trim never snag a capsule.
const steel = rgb('#586a68'), dark = rgb('#343e3c'), wood = rgb('#81704f');
const concrete = rgb('#92958a'), cream = rgb('#c3c2a8'), green = rgb('#687756');
const red = rgb('#94534a'), amber = rgb('#bca16a');

class Details {
    private serial = 0;
    constructor(readonly map: MapDef) {}
    box(p: Vec3, s: Vec3, color: Color, kind = 'detail', solid = true): Box {
        const box = { id: `detail-${this.map.id}-${this.serial++}`, p, s, color, kind, solid };
        this.map.boxes.push(box);
        return box;
    }
    sign(text: string, p: Vec3, yaw = 0) { this.map.signs.push({ text, p, yaw }); }
    poi(id: string, name: string, p: Vec3) { this.map.pois.push({ id, name, p }); }
    ground(x: number, z: number, w: number, d: number, color = concrete, y = 0, kind = 'walk') {
        this.box([x, y + .025, z], [w, .045, d], color, kind, false);
    }
    cabinet(x: number, z: number, w = 1.3, h = 1.9, color = steel, y = 0, facing = 1) {
        this.box([x, y + h / 2, z], [w, h, .7], color, 'cabinet');
        this.box([x, y + h / 2, z + .36 * facing], [w - .1, h - .12, .025], dark, 'cabinet-door', false);
        for (const side of [-1, 1]) {
            this.box([x + side * w * .24, y + h / 2, z + .382 * facing], [w * .43, h - .18, .02], color, 'cabinet-door', false);
            this.box([x + side * .10, y + h * .55, z + .405 * facing], [.04, .15, .03], cream, 'handle', false);
        }
    }
    counter(x: number, z: number, w: number, d: number, color = wood, y = 0) {
        this.box([x, y + .49, z], [w, .98, d], color, 'counter');
        this.box([x, y + 1.025, z], [w + .06, .09, d + .06], cream, 'counter-top');
    }
    shelf(x: number, z: number, w: number, color = wood, y = 0, facing = 1) {
        // A closed stock cabinet gives real cover. Shelf bands are surface trim.
        this.box([x, y + .88, z], [w, 1.76, .85], color, 'cabinet');
        for (const level of [.25, .80, 1.35]) {
            this.box([x, y + level, z + .44 * facing], [w - .12, .37, .03], dark, 'shelf-shadow', false);
            for (let i = 0; i < Math.floor(w / .6); i++)
                this.box([x - w / 2 + .35 + i * .6, y + level, z + .463 * facing], [.34, .27, .025], i % 2 ? cream : amber, 'stock-package', false);
        }
    }
    barrel(x: number, z: number, color = steel, y = 0) {
        this.box([x, y + .48, z], [.72, .96, .72], color, 'barrel');
        for (const height of [.18, .77]) this.box([x, y + height, z], [.75, .045, .75], dark, 'barrel-band', false);
    }
    planter(x: number, z: number, w = 3.3, d = 1.4, y = 0) {
        this.box([x, y + .55, z], [w, 1.1, d], concrete, 'planter');
        this.box([x, y + 1.12, z], [w - .16, .06, d - .16], dark, 'soil', false);
        this.box([x, y + 1.34, z], [w - .25, .4, d - .25], green, 'shrub', false);
    }
    barrier(x: number, z: number, w = 4, y = 0) {
        this.box([x, y + .56, z], [w, 1.12, .72], concrete, 'road-barrier');
        for (let n = 0; n < w / .8; n++)
            this.box([x - w / 2 + .3 + n * .8, y + .80, z + .371], [.36, .18, .018], amber, 'reflector', false);
    }
    shelter(x: number, z: number, w: number, d: number, color = steel, y = 0) {
        this.ground(x, z, w, d, concrete, y);
        this.box([x, y + 2.95, z], [w + .3, .2, d + .3], color, 'roof');
        this.box([x, y + 1.4, z + d / 2], [w, 2.8, .16], color, 'wall');
        for (const side of [-1, 1])
            this.box([x + side * (w / 2 - .1), y + 1.4, z - d / 2 + .1], [.15, 2.8, .15], color, 'pole');
    }
    light(x: number, z: number, h = 4.2) {
        this.box([x, h / 2, z], [.15, h, .15], steel, 'pole');
        this.box([x, h, z], [.9, .12, .5], cream, 'lamphead', false);
    }
    loot(x: number, z: number, category: Category, name: string, y = 0) {
        this.map.loot.push({ id: 'loot' + this.map.loot.length, p: [x, y + .85, z], category, name, loose: false });
        const gear = ['weapon', 'armor', 'module'].includes(category);
        this.box([x, y + .325, z], [category === 'weapon' ? 1.8 : 1.3, .65, .9], gear ? steel : category === 'medical' ? cream : wood, 'crate');
        if (gear) this.sign(category === 'weapon' ? 'ОРУЖЕЙНЫЙ ЯЩИК' : 'СНАРЯЖЕНИЕ', [x, y + 1.5, z - .5]);
    }
    clearTrees(x: number, z: number, w: number, d: number) {
        this.map.boxes = this.map.boxes.filter(b => !(['tree', 'trunk'].includes(b.kind)
            && Math.abs(b.p[0] - x) < w / 2 + .7 && Math.abs(b.p[2] - z) < d / 2 + .7));
    }
    rail(x: number, z: number, length: number, axis: 'x' | 'z', y: number, height = 1.3) {
        // Two continuous physical rails and closely spaced posts protect the edge,
        // while sightlines and projectiles correctly pass between the visible bars.
        for (const level of [.58, height - .07])
            this.box([x, y + level, z], axis === 'x' ? [length, .14, .12] : [.12, .14, length], steel, 'guard-bar');
        const count = Math.max(1, Math.ceil(length / 1.45));
        for (let i = 0; i <= count; i++) {
            const offset = -length / 2 + i * length / count;
            this.box([x + (axis === 'x' ? offset : 0), y + height / 2, z + (axis === 'z' ? offset : 0)], [.13, height, .13], steel, 'guard-post');
        }
    }
}

function factory(d: Details) {
    const m = d.map;
    m.subtitle = 'Производство, санпропускник, компрессорная и две лестницы в администрацию.';
    for (const z of [-16, -12, 0]) d.cabinet(-32.5, z, 1.25, 1.9);
    d.counter(-23, 2, 3.2, 1.1, steel);
    d.shelf(-29, -36.5, 3.5, cream);
    d.shelf(-12, -36.5, 3.4, cream);
    d.ground(-20, -33, 20, 10, rgb('#a5b8ad'), .015, 'cold-floor');
    for (const x of [-27, -13]) d.box([x, 3.3, -38.9], [3.5, .7, .6], steel, 'cooling-unit');
    for (const z of [6.5, 10]) d.shelf(36, z, 3, wood);
    d.sign('СМЕННАЯ ОБУВЬ ОБЯЗАТЕЛЬНА', [-20, 3.1, 6.68], Math.PI);
    d.sign('НЕ ТРОГАТЬ ДО ИНВЕНТАРИЗАЦИИ', [25, 2.5, 19.9], Math.PI);
    d.sign('ТЕМПЕРАТУРНЫЙ КОНТРОЛЬ', [-20, 2.9, -26.1], Math.PI);
    d.shelter(-26, 31, 10, 7, rgb('#76837a'));
    d.cabinet(-29, 33, 1.6, 1.95, green, 0, -1);
    d.cabinet(-23, 33, 1.6, 1.95, green, 0, -1);
    d.counter(-26, 33, 2.1, .65);
    d.sign('САНПРОПУСКНИК / СМЕНА № 2', [-26, 2.8, 27.4]);
    d.poi('changing', 'Санпропускник', [-26, 0, 30]);
    d.ground(7, -35, 10, 12, rgb('#616e66'));
    d.box([7, 1, -37], [4.3, 2, 3.1], steel, 'compressor');
    for (const x of [5.6, 8.4]) d.box([x, 2.9, -37], [.3, 1.8, .3], dark, 'pipe');
    d.box([7, 1.1, -35.4], [3.1, .9, .03], dark, 'vent', false);
    d.sign('КОМПРЕССОРНАЯ / 04', [7, 3.9, -38]);
    d.poi('boiler', 'Компрессорная площадка', [7, 0, -32]);
    for (const [x, z] of [[-39, 19], [17, 24], [35, 30]]) d.barrier(x, z);
    for (const [x, z] of [[-43, -34], [42, 32]]) { d.barrel(x, z); d.barrel(x + 1, z, red); }
    d.light(-34, 39); d.light(40, 35);
    // Overhead utility run leaves the service corridor clear at human height.
    d.box([-2.5, 3.65, -11], [.4, .4, 24], steel, 'pipe');
    d.box([-2.5, 3.65, 1], [9, .4, .4], steel, 'detail');
    for (const x of [23, 35]) d.cabinet(x, -34.4, 2, 1.75, steel, 3.4);
    d.ground(29, -28, 10, 5, rgb('#73816c'), 3.405, 'office-rug');
    d.loot(-22, -18, 'industrial', 'Шкаф контроля линии');
    d.loot(-29, -32, 'factory_special', 'Холодильный запас');
    d.loot(18, 7, 'building_material', 'Материалы фасовки');
    d.loot(5, -33, 'hand_tools', 'Ящик компрессорщика');
    d.loot(-26, 30, 'household', 'Личные вещи смены');
    d.loot(23, -24, 'documents', 'Архив технадзора', 3.4);
    d.loot(-42, 32, 'weapon', 'Оружейный ящик проходной');
    d.loot(-28, 28, 'armor', 'Сумка охраны в санпропускнике');
}

function city(d: Details) {
    const m = d.map;
    m.subtitle = 'Четыре разных двора, киоск, котельная, аптека и мастерская.';
    const courts = [[-35, -30, 34, 26], [32, -33, 36, 23], [-39, 27, 28, 25], [34, 30, 31, 25]];
    courts.forEach(([x, z, w, depth], i) => {
        d.ground(x, z, w - 1, depth - 1, rgb(i % 2 ? '#818880' : '#a09983'));
        d.planter(x - 8, z, 4.2, 1.6);
        d.box([x + 9, .67, z + 5], [2, 1.34, 1.45], steel, 'waste-bin');
        d.box([x + 9, 1.37, z + 5], [2.1, .12, 1.5], dark, 'bin-lid');
        for (let n = 0; n < 4; n++) d.box([x - w / 2 + .28, 1.5, z - 7 + n * .7], [.12, .35, .5], green, 'mailbox', false);
        d.box([x + w / 2 - .28, 3.7, z - 4], [.12, 6, .15], dark, 'drainpipe', false);
        d.sign(['ДВОРНИЦКАЯ', 'ЖИЛЬЦАМ / ВХОД', 'АРХИВ КОНТОРЫ', 'СЛУЖЕБНЫЙ ДВОР'][i], [x, 2.5, z + depth / 2 - .27], Math.PI);
        d.box([x + 8, 2.3, z - depth / 2 + .28], [1.7, .8, .06], cream, 'notice-board', false);
    });
    d.counter(-7.8, 4, 2.2, 1.3, steel);
    d.cabinet(7.7, -3.5, 1.4, 2, steel);
    d.counter(6.2, 4.8, 3, 1.2, steel);
    d.sign('РЕМОНТ / ПРИЁМ ДЕТАЛЕЙ', [0, 3.4, 7.72], Math.PI);
    d.shelf(-52, 2, 6.5, cream, 0, -1);
    d.sign('АПТЕКА / ПЕРВАЯ ПОМОЩЬ', [-51, 2.8, -9.7]);
    d.shelf(48, -8.7, 8.5, green);
    d.counter(54, 1.8, 2.1, 1.1);
    d.shelter(9, 34, 7, 5, green);
    d.counter(10.6, 35, 2.2, 1.1);
    d.box([9, 2.75, 31.35], [6.3, .42, .18], cream, 'signboard', false);
    d.sign('ГАЗЕТЫ / ВОДА', [9, 2.78, 31.2]);
    d.poi('kiosk', 'Газетный киоск', [8, 0, 33]);
    d.ground(-7, -45, 12, 10, rgb('#606b67'));
    d.box([-11, 1.6, -45], [3.1, 3.2, 5.5], rgb('#867968'), 'utility-housing');
    for (const x of [-11.8, -10.2]) d.box([x, 4.6, -45], [.36, 3, .36], steel, 'pipe');
    d.cabinet(-4, -45, 2, 1.8, steel);
    d.sign('КОТЕЛЬНАЯ / ОБХОД СПРАВА', [-7, 3.3, -42]);
    d.poi('utilities', 'Двор котельной', [-7, 0, -43]);
    d.rail(0, -61, 110, 'x', 0);
    for (const x of [-35, 30]) d.barrier(x, 51.5, 5);
    for (const x of [-42, 38]) d.light(x, 52.5);
    for (let i = 0; i < 7; i++) d.ground(-5 + i * 1.6, 47.5, .7, 4.4, cream, .01, 'crosswalk');
    d.loot(-31, -35, 'household', 'Дворницкий запас');
    d.loot(38, -37, 'documents', 'Документы жильцов');
    d.loot(-43, 33, 'household', 'Коробка конторы');
    d.loot(40, 35, 'electronics', 'Техника диспетчера');
    d.loot(7, 34, 'food_drink', 'Запас киоска');
    d.loot(-6, -47, 'industrial', 'Ремкомплект котельной');
    d.loot(6, 0, 'weapon', 'Ящик в ремонтной мастерской');
    d.loot(-37, 33, 'module', 'Кейс радиомастерской');
}

function village(d: Details) {
    const m = d.map;
    m.subtitle = 'Обжитые дачи, разнесённые гараж и дом, подстанция и остановка.';
    const plots = [[-42, -43], [-22, -18], [-49, 26], [-22, 49], [31, -45], [47, -13], [29, 23], [53, 49]];
    plots.forEach(([x, z], i) => {
        d.box([x - 3, .28, z + 1.7], [2.6, .56, 1.5], wood, 'bed');
        d.box([x - 3, .63, z + 1.7], [2.5, .14, 1.45], rgb(i % 2 ? '#75866c' : '#a89b7e'), 'mattress');
        d.box([x - 3.85, .76, z + 1.7], [.6, .13, 1.15], cream, 'pillow', false);
        d.cabinet(x + 4.6, z - 3.9, 1.6, 1.9, wood);
        d.ground(x, z, 2.7, 2.2, rgb(i % 2 ? '#826d54' : '#6b7d77'), .015, 'rug');
        for (const side of [-1, 1]) {
            d.box([x + side * 4.2, 1.8, z + 6.24], [1.45, 1.3, .05], rgb('#485f63'), 'window', false);
            d.box([x + side * 4.2, 1.12, z + 6.28], [1.65, .09, .12], cream, 'window-sill', false);
        }
        d.ground(x + (i % 2 ? 0 : 8), z + (i % 2 ? 7 : 0), i % 2 ? 3.8 : 3, i % 2 ? 3 : 3.8, rgb('#91907b'));
        d.box([x - 4, .2, z + 8.5], [4, .4, 1.3], wood, 'flower-bed');
        d.box([x - 4, .46, z + 8.5], [3.8, .16, 1.15], green, 'plants', false);
    });
    d.ground(40, -47, 2.5, 13, rgb('#a39a80'));
    d.ground(50, -40, 8, 7, rgb('#8b907f'));
    d.sign('ПРОХОД К ГАРАЖУ', [39.5, 2.5, -43]);
    d.counter(56, -50, 2, 2.5, steel);
    d.cabinet(56.4, -56.6, 2, 2, steel);
    d.box([43.3, .65, -55], [1.9, 1.3, 1.2], steel, 'work-compressor');
    d.barrel(55.8, -46, red);
    d.ground(17, -20, 8, 8, rgb('#90917d'));
    d.box([17, 1.2, -21], [4.4, 2.4, 3], steel, 'transformer');
    for (const x of [15.7, 18.3]) d.box([x, 2.8, -21], [.28, .8, .28], cream, 'insulator', false);
    d.cabinet(20, -23, 1.8, 1.9, green);
    d.sign('ПОДСТАНЦИЯ / СОСНОВАЯ', [17, 3.5, -22.6]);
    d.poi('substation', 'Поселковая подстанция', [17, 0, -17]);
    d.shelter(12, 57, 8, 4.5, rgb('#637c75'));
    d.counter(12, 58.1, 5, .7);
    d.sign('СОСНОВАЯ / ОСТАНОВКА', [12, 2.8, 54.6]);
    d.box([7.2, 1.75, 55], [.11, 3.5, .11], steel, 'pole');
    d.box([7.2, 3.2, 55], [.7, .8, .09], rgb('#547c96'), 'bus-sign', false);
    d.poi('bus_stop', 'Остановка «Сосновая»', [12, 0, 55]);
    for (const [x, z] of [[-10, -34], [9, 19], [-12, 29]]) {
        d.barrel(x, z, wood);
        d.box([x + 1.7, .7, z], [2, 1.4, 1.1], wood, 'pallet');
    }
    d.loot(-42, -47, 'medical', 'Домашняя аптечка');
    d.loot(-18, 46, 'documents', 'Дачные бумаги');
    d.loot(27, -49, 'documents', 'Папка владельца дачи');
    d.loot(54, -48, 'industrial', 'Запчасти из гаража');
    d.loot(-54, 57, 'food_drink', 'Запас бакалеи');
    d.loot(21, -8, 'industrial', 'Обслуживание насоса');
    d.loot(33, -49, 'weapon', 'Охотничий ящик на даче');
    d.loot(47, -50, 'module', 'Кейс в гаражной мастерской');
}

function park(d: Details) {
    const m = d.map;
    m.subtitle = 'Пруд со смотровой, спортивные площадки, лесная петля и пост лесничего.';
    // New authored footpaths are actually cleared of trunks, not decals through trees.
    for (const [x, z, w, depth] of [[-62, 0, 3.8, 118], [64, 27, 3.8, 63], [-33, -56, 62, 3.8]]) {
        d.clearTrees(x, z, w, depth);
        d.ground(x, z, w, depth, rgb('#919b78'), 0, 'path');
    }
    d.clearTrees(-31, -6, 25, 17);
    d.ground(-31, -6, 25, 17, rgb('#86785e'), 0, 'sports-surface');
    for (const x of [-42, -20]) d.box([x, 1.7, -6], [.14, 3.4, .14], steel, 'pole');
    for (const x of [-42, -20]) d.box([x, 3.1, -6], [.18, .85, 1.45], cream, 'backboard');
    for (const z of [-13, 1]) d.ground(-31, z, 22, .1, cream, .01, 'court-line');
    for (const x of [-42, -20]) d.ground(x, -6, .1, 14, cream, .01, 'court-line');
    d.clearTrees(-57, 40, 14, 12);
    d.ground(-57, 40, 14, 12, rgb('#8c896a'), 0, 'sports-surface');
    for (const x of [-61, -57, -53]) {
        for (const z of [37, 40]) d.box([x, 1.45, z], [.12, 2.9, .12], steel, 'pole');
        d.box([x, 2.83, 38.5], [.12, .14, 3.1], steel, 'exercise-bar');
    }
    d.sign('ТУРНИКИ / ЛЕСНАЯ ПЕТЛЯ', [-57, 3.5, 35]);
    d.poi('exercise', 'Турниковая площадка', [-57, 0, 43]);
    d.clearTrees(59, 44, 16, 14);
    d.shelter(59, 44, 10, 8, green);
    d.box([54, 1.4, 44], [.16, 2.8, 8], green, 'wall');
    d.cabinet(62, 46.7, 1.8, 1.9, green, 0, -1);
    d.counter(56, 46.5, 2.8, 1);
    d.sign('ЛЕСНИЧЕСТВО / ОБХОД № 3', [59, 2.8, 39.8]);
    d.poi('ranger', 'Пост лесничего', [59, 0, 43]);
    d.clearTrees(19, -6, 5, 14);
    d.ground(19, -6, 5, 14, wood, 0, 'boardwalk');
    d.sign('ПРУД / ПРОХОД ПО БЕРЕГУ', [19, 2.3, -11]);
    d.planter(16.5, -1.5, 3, 1);
    d.shelf(-40, -41.8, 4, wood);
    d.cabinet(44.5, -41.8, 2, 2, steel);
    d.counter(31, -41.5, 4, 1.1, steel);
    d.shelf(33, 28.8, 5, cream, 0, -1);
    d.counter(-41, 24.8, 4, 1.1);
    for (const [x, z] of [[-8, 10], [10, -32], [-29, 33], [57, 11]]) d.planter(x, z);
    // High tree cover is visual; these fallen timber stacks are physical low cover.
    for (const [x, z] of [[-51, -49], [65, -25], [42, 58]])
        d.box([x, .65, z], [4.8, 1.3, 1.5], wood, 'timber-stack');
    d.loot(-57, 44, 'household', 'Служебный ящик спортплощадки');
    d.loot(58, 45, 'documents', 'Журнал обхода лесничего');
    d.loot(17, -10, 'food_drink', 'Забытый короб у смотровой');
    d.loot(43, -38, 'industrial', 'Запас хозяйственной службы');
    d.loot(-39, -34, 'building_material', 'Материалы ремонта аллей');
    d.loot(30, 27, 'medical', 'Резерв медпункта');
    d.loot(57, 41.5, 'weapon', 'Оружейный ящик лесничего');
    d.loot(61, 42, 'armor', 'Снаряжение патруля');
}

function mall(d: Details) {
    const m = d.map;
    m.subtitle = 'Два этажа, магазин одежды, пост охраны, фудкорт и защищённый атриум.';
    for (const [x, z, color] of [[-27, -24, steel], [27, -24, green], [-27, 24, cream], [27, 24, wood]] as [number, number, Color][]) {
        d.shelf(x, z, 6.5, color, 0, z > 0 ? -1 : 1);
        d.counter(x + 6, z + 3.5, 2, 1.1, color);
    }
    d.ground(-24, 13, 13, 20, rgb('#7e8575'), 4.008, 'retail-carpet');
    for (const z of [10, 22]) {
        d.box([-20, 5.05, z], [3.4, 2.1, 1.1], wood, 'clothing-display');
        for (const x of [-21, -20, -19]) d.box([x, 5.05, z + .57], [.68, 1.42, .03], x === -20 ? green : cream, 'folded-clothing', false);
    }
    d.shelf(-40, 13, 3, wood, 4);
    d.sign('ОДЕЖДА / ПОЛЕВОЙ СЕЗОН', [-23, 6.7, 19]);
    d.poi('clothing', 'Магазин одежды', [-24, 4, 14]);
    for (const [x, z] of [[36, 14], [36, 28], [21, 32]]) {
        d.counter(x, z, 1.7, 1.7, cream, 4);
        d.box([x, 4.32, z + 1.65], [1.6, .64, .7], red, 'seat');
    }
    d.counter(36, -28, 6, 1.2, steel, 4);
    d.cabinet(-40, -29, 2, 1.8, steel, 4);
    for (const [x, z] of [[-14, -12], [14, 12]]) d.planter(x, z, 2.5, 1.8, 4);
    d.shelter(-49, 25, 6, 8, steel);
    d.box([-52, 1.4, 25], [.15, 2.8, 8], steel, 'wall');
    d.cabinet(-47.2, 27.4, 1.2, 1.7, green, 0, -1);
    d.sign('ОХРАНА / СЛУЖЕБНЫЙ ПОСТ', [-49, 2.8, 20.8]);
    d.poi('security', 'Пост охраны', [-49, 0, 25]);
    for (const z of [-15, 16]) d.box([51, .85, z], [2.5, 1.7, 4.7], rgb('#677b78'), 'car');
    for (const z of [-29, 2, 31]) d.barrier(55, z, 4);
    for (let n = 0; n < 6; n++) d.ground(-30 + n * 12, 49, 8, .12, amber, 0, 'loading-mark');
    d.sign('ВТОРОЙ ЭТАЖ / ЛЕСТНИЦА А', [-6, 2.7, -6]);
    d.sign('ВТОРОЙ ЭТАЖ / ЛЕСТНИЦА Б', [6, 2.7, 6], Math.PI);
    d.sign('ЭВАКУАЦИЯ / ПАРКОВКА', [43, 2.8, 29], Math.PI / 2);
    d.loot(-24, 14, 'household', 'Склад одежды', 4);
    d.loot(-36, -7, 'electronics', 'Возвраты техномагазина', 4);
    d.loot(35, 18, 'food_drink', 'Запас фудкорта', 4);
    d.loot(22, -26, 'food_drink', 'Сухой склад продуктов');
    d.loot(-49, 26, 'documents', 'Журнал охраны');
    d.loot(5, 44, 'industrial', 'Инструмент разгрузки');
    d.loot(-50, 23, 'weapon', 'Оружейный ящик охраны');
    d.loot(-46.9, 23, 'armor', 'Бронекомплект охраны');
}

/** Extends the five existing authored layouts; never changes their stable map IDs. */
export function enrichMap(map: MapDef): MapDef {
    if (map.id === 'range') return map;
    const d = new Details(map);
    const passes: Record<string, (details: Details) => void> = { factory, city, village, park, mall };
    passes[map.id]?.(d);
    // Replace opaque slab railings with real rails. Park's higher 1.55 m shoreline
    // fence cannot be climbed using the normal jump+step height from flat ground.
    const oldRails = map.boxes.filter(b => b.kind === 'rail');
    map.boxes = map.boxes.filter(b => b.kind !== 'rail');
    for (const b of oldRails) {
        const axis = b.s[0] > b.s[2] ? 'x' : 'z', y = b.p[1] - b.s[1] / 2;
        d.rail(b.p[0], b.p[2], axis === 'x' ? b.s[0] : b.s[2], axis, y, map.id === 'park' ? 1.55 : b.s[1]);
    }
    return map;
}
