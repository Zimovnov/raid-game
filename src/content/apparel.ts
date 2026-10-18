import type { Character, Color, Faction } from '../domain/types.js';
import { rgb } from '../domain/util.js';
import { OVERHAUL_CAMOUFLAGES } from './overhaul-camouflages.js';

/** Cosmetic selections are independent of equipment instances and never grant armor or capacity. */
export interface Appearance {
    jacket: string;
    trousers: string;
    jacketCamo: string;
    trouserCamo: string;
    headwear: string;
    gloves: string;
    boots: string;
    rig: string;
    rigCamo: string;
    backpack: string;
    backpackCamo: string;
}
export type CamoPattern = 'solid' | 'digital' | 'woodland' | 'stripe' | 'leaf' | 'arid' | 'snow';
export interface Camouflage {
    id: string;
    name: string;
    colors: Color[];
    pattern: CamoPattern;
    description: string;
}
export interface ApparelChoice {
    id: string;
    name: string;
    shape: string;
    description: string;
    region: 'СССР' | 'Россия' | 'США' | 'Универсальное';
    free: true;
}

function camo(id: string, name: string, pattern: CamoPattern, colors: string[], description: string): Camouflage {
    return { id, name, pattern, colors: colors.map(rgb), description };
}

// Every mark is authored geometry. Reference names identify a visual tradition, not a copied print.
export const CAMOUFLAGES: Camouflage[] = [
    camo('olive', 'Олива', 'solid', ['#63694b'], 'Матовая оливковая ткань.'),
    camo('ranger_green', 'Ranger Green', 'solid', ['#545f50'], 'Приглушённый серо-зелёный цвет.'),
    camo('coyote', 'Coyote Brown', 'solid', ['#88704b'], 'Сдержанный коричневый тон снаряжения.'),
    camo('khaki', 'Хаки / песочный', 'solid', ['#a49772'], 'Светлая полевая ткань.'),
    camo('wolf_gray', 'Wolf Grey', 'solid', ['#687071'], 'Холодный серый без яркого синего.'),
    camo('graphite', 'Графит', 'solid', ['#343b3b'], 'Тёмная неблестящая ткань.'),
    camo('navy', 'Тёмно-синий', 'solid', ['#3a454f'], 'Глубокий сине-серый тон.'),
    camo('foliage', 'Foliage Green', 'solid', ['#798174'], 'Светлый серо-зелёный оттенок.'),
    camo('emr', 'ЕМР · лето', 'digital', ['#586345', '#38482d', '#858568', '#34392d'], 'Авторская геометрическая интерпретация мелкой зелёной мозаики ЕМР.'),
    camo('flora', 'Флора', 'stripe', ['#728064', '#3b513a', '#555445'], 'Авторские горизонтальные пятна в палитре «Флоры».'),
    camo('berezka', 'Берёзка', 'leaf', ['#546744', '#bbbc83', '#858a56'], 'Оливковая основа и светлые угловатые листья; рисунок создан для игры.'),
    camo('partizan', 'Партизан · лес', 'leaf', ['#84754e', '#4b5838', '#b4a46e', '#333c2f'], 'Самостоятельный лесной рисунок с контрастной листвой.'),
    camo('woodland', 'M81 Woodland', 'woodland', ['#657354', '#3d4b32', '#786044', '#2e352d'], 'Собственная low-poly интерпретация четырёхцветного лесного рисунка.'),
    camo('multicam', 'MultiCam · палитра', 'woodland', ['#a49a75', '#767d55', '#645b43', '#c1b38a'], 'Авторские пятна в умеренной песочно-зелёной палитре; не скопированная ткань.'),
    camo('tropic', 'Тропический лес', 'woodland', ['#697650', '#415637', '#8a8f66', '#303f2e'], 'Плотная зелёная листва и тёмные разрывы.'),
    camo('arid', 'Засушливая степь', 'arid', ['#ad9b76', '#847451', '#cec19e', '#6e6750'], 'Спокойные песочные и коричневые пятна.'),
    camo('dcu', 'DCU · три цвета', 'arid', ['#b6a686', '#c8b999', '#897756'], 'Самостоятельная трёхцветная пустынная расцветка.'),
    camo('digital_desert', 'Пустынная цифра', 'digital', ['#a89575', '#c4b18d', '#826e52', '#635846'], 'Мелкая песчаная цифровая мозаика.'),
    camo('digital_forest', 'Лесная цифра', 'digital', ['#68714d', '#4a5438', '#928768', '#303a2d'], 'Авторская тёмная лесная мозаика.'),
    camo('winter', 'Зимняя маскировка', 'snow', ['#cfcec0', '#8c9490', '#abb0a2'], 'Матовый светлый фон с редкими серыми ветвями.'),
    ...OVERHAUL_CAMOUFLAGES
];

const garment = (id: string, name: string, shape: string, region: ApparelChoice['region'], description: string): ApparelChoice =>
    ({ id, name, shape, region, description, free: true });

export const JACKETS: ApparelChoice[] = [
    garment('jacket_afghanka', 'Афганка · полевая куртка', 'afghanka', 'СССР', 'Прямой полевой крой, нагрудные карманы с клапанами и погоны.'),
    garment('jacket_gorka', 'Горка · штормовая куртка', 'gorka', 'Россия', 'Свободный крой, убранный капюшон и контрастные тканевые усиления. Горка — покрой, расцветка выбирается отдельно.'),
    garment('jacket_sumrak', 'Сумрак · маскировочная куртка', 'sumrak', 'Россия', 'Лёгкий свободный верх, манжеты и объёмные карманы.'),
    garment('jacket_kombat', 'ССО «Комбат», тип 3', 'kombat', 'Россия', 'Боевая рубашка: гладкая середина, полевые рукава, высокий ворот и усиления локтей.'),
    garment('jacket_m65', 'M-65 · полевая куртка', 'm65', 'США', 'Удлинённая куртка с четырьмя клапанными карманами и воротом-стойкой.'),
    garment('jacket_bdu', 'BDU · полевой китель', 'bdu', 'США', 'Прямой китель с нагрудными и нижними карманами.'),
    garment('jacket_acu', 'ACU · полевой китель', 'acu', 'США', 'Наклонные нагрудные карманы, плечевые карманы и ворот-стойка.'),
    garment('jacket_g4', 'Crye G4 · боевая рубашка', 'g4', 'США', 'Приталенная середина, отдельные рукава и низкопрофильные плечевые карманы.'),
    garment('jacket_fleece', 'L3 · флисовая куртка', 'fleece', 'Универсальное', 'Однотонная середина, молния и усиления плеч; умеренный объём.'),
    garment('jacket_softshell', 'L5 · куртка softshell', 'softshell', 'Универсальное', 'Короткая ветровая куртка с молнией и небольшими плечевыми карманами.')
];

export const TROUSERS: ApparelChoice[] = [
    garment('trousers_afghanka', 'Афганка · полевые брюки', 'afghanka', 'СССР', 'Прямые штанины, объёмные боковые карманы, заправленный низ.'),
    garment('trousers_gorka', 'Горка · усиленные брюки', 'gorka', 'Россия', 'Свободный крой и широкие тканевые усиления коленей.'),
    garment('trousers_sumrak', 'Сумрак · лёгкие брюки', 'sumrak', 'Россия', 'Свободные штанины с собранным низом; без жёсткой защиты колена.'),
    garment('trousers_kombat', 'ССО «Комбат» PRO V', 'kombat', 'Россия', 'Полевые брюки с артикулированным коленом и низкими карманами.'),
    garment('trousers_bdu', 'BDU · брюки', 'bdu', 'США', 'Классический прямой карго-крой с клапанными карманами.'),
    garment('trousers_acu', 'ACU · брюки', 'acu', 'США', 'Наклонные боковые карманы и дополнительные карманы ниже колена.'),
    garment('trousers_g4', 'Crye G4 · боевые брюки', 'g4', 'США', 'Зауженные штанины, отдельные вставки коленей и компактные карманы.'),
    garment('trousers_softshell', 'L5 · брюки softshell', 'softshell', 'Универсальное', 'Спокойный походный крой, усиленный низ и небольшие боковые карманы.')
];

export const HEADWEAR: ApparelChoice[] = [
    garment('head_none', 'Без головного убора', 'none', 'Универсальное', 'Открытая голова; экипированный шлем отображается отдельно.'),
    garment('head_patrol', 'Полевая кепка', 'patrol', 'Универсальное', 'Короткий козырёк и мягкая тулья.'),
    garment('head_boonie', 'Панама', 'boonie', 'Универсальное', 'Мягкая полевая панама с широкими полями.'),
    garment('head_watch', 'Вязаная шапка', 'watch', 'Универсальное', 'Матовая шапка с небольшим отворотом.'),
    garment('head_fleece', 'Флисовая шапка', 'fleece', 'Универсальное', 'Плотная шапка без отворота.'),
    garment('head_balaclava', 'Балаклава', 'balaclava', 'Универсальное', 'Тонкий подшлемник с открытой областью глаз; носится под шлемом.'),
    garment('head_bandana', 'Полевая бандана', 'bandana', 'Универсальное', 'Тканевый головной убор с коротким узлом сзади.')
];

export const GLOVES: ApparelChoice[] = [
    garment('gloves_none', 'Без перчаток', 'none', 'Универсальное', 'Открытые руки.'),
    garment('gloves_leather', 'Кожаные · чёрные', 'leather', 'Универсальное', 'Закрытые кожаные перчатки с усиленной ладонью.'),
    garment('gloves_coyote', 'Тактические · койот', 'coyote', 'США', 'Песочные закрытые перчатки с накладками на костяшках.'),
    garment('gloves_olive', 'Тактические · олива', 'olive', 'Россия', 'Оливковые закрытые перчатки с усилением тыльной стороны.'),
    garment('gloves_fingerless', 'Кожаные · без пальцев', 'fingerless', 'Универсальное', 'Открытые кончики пальцев и короткая кожаная манжета.')
];

export const BOOTS: ApparelChoice[] = [
    garment('boots_leather', 'Берцы · чёрная кожа', 'leather', 'СССР', 'Высокие чёрные берцы с отдельной подошвой и шнуровкой.'),
    garment('boots_desert', 'Пустынные ботинки', 'desert', 'США', 'Песочная замша, высокая голень и тёмная подошва.'),
    garment('boots_jungle', 'Jungle boots', 'jungle', 'США', 'Тёмная кожа, оливковые тканевые голени и выраженная подошва.'),
    garment('boots_hiking', 'Треккинговые ботинки', 'hiking', 'Универсальное', 'Невысокий коричневый ботинок с защищённым носком.')
];

export const RIGS: ApparelChoice[] = [
    garment('rig_none', 'Без разгрузки', 'none', 'Универсальное', 'Без дополнительной наружной разгрузки.'),
    garment('rig_smersh', 'ССО «СМЕРШ АК»', 'smersh', 'Россия', 'Плечевые лямки, пояс и парные низко расположенные подсумки. Внешний вид; без бронезащиты.'),
    garment('rig_smersh_pkm', 'ССО «СМЕРШ ПКМ»', 'smersh_pkm', 'Россия', 'Поясная система с широкими коробчатыми подсумками. Внешний вид; без бронезащиты.'),
    garment('rig_sso_d3', 'ССО D3 · микронагрудник', 'sso_d3', 'Россия', 'Компактный нагрудник с центральной группой подсумков и боковыми карманами.'),
    garment('rig_ana_alpha', 'ANA Tactical «Альфа»', 'ana_alpha', 'Россия', 'Широкая нагрудная разгрузка с высокими подсумками и боковыми карманами.'),
    garment('rig_mk6', 'Spiritus Micro Fight Mk 6', 'mk6', 'США', 'Компактная нагрудная платформа; здесь показана с авторским набором подсумков.'),
    garment('rig_34alpha', 'Spiritus 34 Alpha', '34alpha', 'США', 'Две раздельные нагрудные панели с центральными застёжками.'),
    garment('rig_taps', 'TAPS · нагрудная система', 'taps', 'США', 'Широкая низкая нагрудная система с несколькими узкими подсумками.'),
    garment('rig_alice', 'ALICE · поясная система', 'alice', 'США', 'Плечевые лямки, поясные подсумки и чехлы фляг.'),
    garment('rig_canvas', 'Брезентовый нагрудник', 'canvas', 'Универсальное', 'Простой исторический нагрудник: три высоких кармана с клапанами.'),
    garment('rig_buyanov', 'Бронежилет Буянова', 'buyanov', 'Универсальное', 'Полиэтиленовый пакет-разгрузка «ПЕЛЬМЕНИ». Бесплатный шуточный внешний вид. Бронезащита: 0; вместимость не меняет.')
];

export const BACKPACKS: ApparelChoice[] = [
    garment('pack_none', 'Без наружного рюкзака', 'none', 'Универсальное', 'Скрывает только внешнюю модель; инвентарь не меняется.'),
    garment('pack_veshmeshok', 'Армейский вещмешок', 'veshmeshok', 'СССР', 'Брезентовый мешок со стянутой горловиной и простыми лямками.'),
    garment('pack_rd54', 'РД-54 · десантный ранец', 'rd54', 'СССР', 'Низкий прямоугольный ранец с клапаном и боковыми карманами.'),
    garment('pack_alice', 'ALICE · средний рюкзак', 'alice', 'США', 'Округлый клапан, три наружных кармана и видимая часть рамы.'),
    garment('pack_assault', 'MOLLE II · штурмовой рюкзак', 'assault', 'США', 'Двухсекционный ранец с фронтальной сеткой строп.'),
    garment('pack_sso_map', 'ССО MAP MOLLE', 'sso_map', 'Россия', 'Компактный узкий ранец с наружными стропами.'),
    garment('pack_sso_ataka', 'ССО «Атака 5»', 'sso_ataka', 'Россия', 'Высокий походный рюкзак с верхним клапаном, боковыми объёмами и стяжками.'),
    garment('pack_day', 'Дневной рюкзак', 'daypack', 'Универсальное', 'Гражданский небольшой рюкзак с простым внешним карманом.')
];

export const APPEARANCE_OPTIONS: Record<keyof Appearance, readonly { id: string; name: string }[]> = {
    jacket: JACKETS, trousers: TROUSERS, jacketCamo: CAMOUFLAGES, trouserCamo: CAMOUFLAGES,
    headwear: HEADWEAR, gloves: GLOVES, boots: BOOTS, rig: RIGS, rigCamo: CAMOUFLAGES,
    backpack: BACKPACKS, backpackCamo: CAMOUFLAGES
};
export const APPEARANCE_FIELDS = Object.keys(APPEARANCE_OPTIONS) as (keyof Appearance)[];
const allowed = Object.fromEntries(APPEARANCE_FIELDS.map(key => [key, new Set(APPEARANCE_OPTIONS[key].map(x => x.id))])) as Record<keyof Appearance, Set<string>>;
const legacyCamos = ['olive', 'wolf_gray', 'emr', 'flora', 'berezka', 'partizan', 'coyote', 'graphite', 'woodland', 'arid', 'ranger_green', 'khaki'];

export function defaultAppearance(faction: Faction = 'BEAR', outfit = 0): Appearance {
    const index = Number.isSafeInteger(outfit) ? ((outfit % legacyCamos.length) + legacyCamos.length) % legacyCamos.length : 0;
    const selected = legacyCamos[index];
    const usec = faction === 'USEC';
    return {
        jacket: usec ? 'jacket_g4' : 'jacket_kombat', trousers: usec ? 'trousers_g4' : 'trousers_kombat',
        jacketCamo: selected, trouserCamo: selected, headwear: 'head_patrol',
        gloves: usec ? 'gloves_coyote' : 'gloves_olive', boots: usec ? 'boots_desert' : 'boots_leather',
        rig: usec ? 'rig_mk6' : 'rig_smersh', rigCamo: usec ? 'coyote' : 'olive',
        backpack: usec ? 'pack_assault' : 'pack_rd54', backpackCamo: usec ? 'coyote' : 'olive'
    };
}

function plainRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Migration/import fallback is per field: a missing old jacket must not reset valid trousers. */
export function normalizeAppearance(value: unknown, faction: Faction = 'BEAR', outfit = 0): Appearance {
    const result = defaultAppearance(faction, outfit);
    if (!plainRecord(value)) return result;
    for (const key of APPEARANCE_FIELDS) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        const selected = descriptor && 'value' in descriptor ? descriptor.value : undefined;
        if (typeof selected === 'string' && allowed[key].has(selected)) result[key] = selected;
    }
    return result;
}

/** Strict validation for an already-normalized network/profile value; never silently accept extra data. */
export function isAppearance(value: unknown): value is Appearance {
    if (!plainRecord(value) || Object.keys(value).length !== APPEARANCE_FIELDS.length) return false;
    return APPEARANCE_FIELDS.every(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return !!descriptor && 'value' in descriptor && typeof descriptor.value === 'string' && allowed[key].has(descriptor.value);
    });
}

export function camouflage(id: string): Camouflage {
    return CAMOUFLAGES.find(x => x.id === id) || CAMOUFLAGES[0];
}

export function appearancePalette(character: Pick<Character, 'faction' | 'outfit'> & { appearance?: unknown }): {
    appearance: Appearance; sleeve: Color; torso: Color; trousers: Color; gloves: Color; boots: Color;
} {
    const appearance = normalizeAppearance(character.appearance, character.faction, character.outfit);
    const jacket = JACKETS.find(x => x.id === appearance.jacket)!;
    const sleeve = [...camouflage(appearance.jacketCamo).colors[0]] as Color;
    const combat = ['kombat', 'g4', 'fleece'].includes(jacket.shape);
    const torso = combat ? sleeve.map(v => v * .79) as Color : [...sleeve] as Color;
    const gloves = rgb(appearance.gloves === 'gloves_coyote' ? '#897650' : appearance.gloves === 'gloves_olive' ? '#51573b' : '#323635');
    const boots = rgb(appearance.boots === 'boots_desert' ? '#a78d64' : appearance.boots === 'boots_hiking' ? '#62503d' : '#2e322f');
    return { appearance, sleeve, torso, trousers: [...camouflage(appearance.trouserCamo).colors[0]] as Color, gloves, boots };
}

export const APPEARANCE_PRESETS: { id: string; name: string; appearance: Appearance }[] = [
    { id: 'soviet_field', name: 'Советский полевой', appearance: { ...defaultAppearance(), jacket: 'jacket_afghanka', trousers: 'trousers_afghanka', jacketCamo: 'khaki', trouserCamo: 'khaki', rig: 'rig_canvas', rigCamo: 'olive', backpack: 'pack_veshmeshok' } },
    { id: 'woodland_patrol', name: 'Лесной патруль', appearance: { ...defaultAppearance(), jacket: 'jacket_gorka', trousers: 'trousers_gorka', jacketCamo: 'olive', trouserCamo: 'olive', headwear: 'head_boonie', rig: 'rig_smersh' } },
    { id: 'emr_combat', name: 'ЕМР · современный', appearance: { ...defaultAppearance('BEAR', 2), rig: 'rig_sso_d3', rigCamo: 'emr', backpack: 'pack_sso_map', backpackCamo: 'emr' } },
    { id: 'american_field', name: 'США · Woodland', appearance: { ...defaultAppearance('USEC', 8), jacket: 'jacket_bdu', trousers: 'trousers_bdu', headwear: 'head_boonie', rig: 'rig_alice', rigCamo: 'olive', backpack: 'pack_alice', backpackCamo: 'olive', boots: 'boots_jungle' } },
    { id: 'american_modern', name: 'США · современный', appearance: { ...defaultAppearance('USEC'), jacketCamo: 'multicam', trouserCamo: 'multicam', rigCamo: 'ranger_green', backpackCamo: 'coyote' } },
    { id: 'desert_patrol', name: 'Пустынный патруль', appearance: { ...defaultAppearance('USEC'), jacket: 'jacket_acu', trousers: 'trousers_acu', jacketCamo: 'dcu', trouserCamo: 'dcu', rig: 'rig_taps', headwear: 'head_boonie' } },
    { id: 'gray_layer', name: 'Город · смешанные слои', appearance: { ...defaultAppearance(), jacket: 'jacket_softshell', jacketCamo: 'wolf_gray', trousers: 'trousers_g4', trouserCamo: 'ranger_green', headwear: 'head_watch', rig: 'rig_34alpha', rigCamo: 'graphite', backpack: 'pack_day', backpackCamo: 'graphite' } },
    { id: 'factory_pelmeni', name: 'Пельменный резерв', appearance: { ...defaultAppearance(), jacket: 'jacket_m65', jacketCamo: 'olive', trousers: 'trousers_bdu', trouserCamo: 'khaki', headwear: 'head_watch', rig: 'rig_buyanov', backpack: 'pack_veshmeshok', backpackCamo: 'khaki' } }
];

/** Read-only visual/name references, checked 2026-10-11. No downloaded photos, patterns or logos. */
export const APPAREL_REFERENCES = [
    { title: 'Crye Precision G4 Combat Shirt', url: 'https://www.cryeprecision.com/G4-Combat-Shirt', use: 'Combat-shirt cut, separate torso/sleeves, subdued color families; no material performance simulated.' },
    { title: 'Crye Precision G4 Combat Pant', url: 'https://www.cryeprecision.com/G4-Combat-Pant', use: 'Articulated cut and knee insert silhouette.' },
    { title: 'Spiritus Micro Fight Chassis Mk 6', url: 'https://www.spiritussystems.com/micro-fight-chassis-mk-6/', use: 'Current compact chest-rig platform and independent pouch layout.' },
    { title: 'Spiritus 34 Alpha Chest Rig', url: 'https://www.spiritussystems.com/34-alpha-chest-rig/', use: 'Split front panels and central buckle silhouette.' },
    { title: 'ССО СМЕРШ АК', url: 'https://sso-mil.ru/catalog/snaryazhenie/komplekt_snaryazheniya_smersh_ak/', use: 'Low belt-mounted pouches with shoulder harness; shape only.' },
    { title: 'ССО снаряжение', url: 'https://sso-mil.ru/catalog/smersh/', use: 'Separate АК and ПКМ kit names; visual family reference.' },
    { title: 'ССО D3', url: 'https://sso-mil.ru/catalog/snaryazhenie/mikronagrudnik_d3/', use: 'Compact Russian chest-rig reference.' },
    { title: 'ССО Комбат', url: 'https://sso-mil.ru/catalog/kombat/', use: 'КОМБАТ тип 3 shirt and PRO V trousers are distinct garments.' },
    { title: 'ССО рюкзаки', url: 'https://sso-mil.ru/catalog/ryukzak/', use: 'MAP MOLLE and АТАКА 5 names and pack families.' },
    { title: 'ССО расцветки', url: 'https://sso-mil.ru/color/', use: 'Color vocabulary; no manufacturer claims about camouflage effectiveness adopted.' },
    { title: 'ANA Tactical Альфа', url: 'https://anatactical.ru/snaryazhenie/zhilety/7991', use: 'Product name verified by official indexed listing; direct page returned 403, no detailed specification inferred.' },
    { title: 'Helikon-Tex M65 field-jacket history', url: 'https://blog.helikon-tex.com/en/m65-jacket-two-versions-of-a-classic/', use: 'Historic field-jacket cut; no copied garment assets.' }
];
