import type { Definition } from '../domain/types.js';
import { rgb } from '../domain/util.js';

/** Original low-poly representations. Price, mass and absorption are game balance.
 * A named plate carrier represents a complete in-game set with plates installed.
 * No NIJ/GOST rating or real-world ballistic performance is asserted. */
const armor = (id: string, name: string, price: number, weight: number, protection: number, color: string, description: string): Definition => ({
    id, name, category: 'armor', equipmentSlot: 'armor', price, weight, protection,
    size: [3, 3], maxStack: 1, rarity: price > 33000 ? 3 : price > 19000 ? 2 : 1,
    shape: id, color: rgb(color), description: description + ' Комплект для игры: защита уменьшается при износе.'
});
const helmet = (id: string, name: string, price: number, weight: number, protection: number, color: string, description: string): Definition => ({
    id, name, category: 'armor', equipmentSlot: 'helmet', price, weight, protection,
    size: [2, 2], maxStack: 1, rarity: price > 17000 ? 3 : price > 9000 ? 2 : 1,
    shape: id, color: rgb(color), description: description + ' Защищает голову в упрощённой игровой модели; лицо отдельно не бронируется.'
});

export const EQUIPMENT_DEFS: Definition[] = [
    armor('armor_6b2', '6Б2', 10500, 4.8, .29, '#777650', 'Советский жилет: мягкий чехол, широкие плечи, оливковая ткань.'),
    armor('armor_6b3', '6Б3ТМ', 16000, 8.6, .43, '#696e48', 'Тяжёлый советский бронежилет с секциями и крупными накладными карманами.'),
    armor('armor_6b5', '6Б5-15', 19000, 8.2, .46, '#5b6446', 'Советский общевойсковой бронежилет с характерными карманами спереди.'),
    armor('armor_6b13', '6Б13', 24000, 7.9, .51, '#646944', 'Российский бронежилет с высоким чехлом и выраженными плечевыми секциями.'),
    armor('armor_6b23', '6Б23-1', 27000, 7.1, .49, '#596347', 'Общевойсковой бронежилет с воротником и широким поясом.'),
    armor('armor_6b45', '6Б45', 34000, 8.3, .56, '#596b4a', 'Российский жилет с крупными передней и задней панелями.'),
    armor('armor_paca', 'PACA Low Visibility', 11000, 2.7, .27, '#908d73', 'Мягкий жилет низкого профиля; небольшой вес ценой меньшей игровой защиты.'),
    armor('armor_pasgt', 'PASGT vest', 13000, 4.0, .32, '#697347', 'Американский жилет старого образца с высоким воротником и крупными плечами.'),
    armor('armor_iba', 'Interceptor OTV', 23000, 7.8, .47, '#737855', 'Американский жилет с передним раскрытием, воротником и широкими секциями.'),
    armor('armor_iotv', 'IOTV', 35500, 10.2, .58, '#8d8468', 'Тяжёлый американский бронекомплект с широкой площадью чехла.'),
    armor('armor_jpc', 'Crye JPC 2.0 · с плитами', 28000, 5.4, .45, '#788066', 'Компактный плитоносец с открытыми боками и узкими плечевыми лямками.'),
    armor('armor_avs', 'Crye AVS · с плитами', 36500, 6.9, .52, '#8a7a55', 'Модульный плитоносец с объёмным поясом и выраженными плечевыми подушками.'),
    armor('armor_lv119', 'Spiritus LV-119 · с плитами', 29000, 5.9, .46, '#667059', 'Низкопрофильный плитоносец со сдержанным силуэтом.'),
    armor('armor_spc', 'Crye AirLite SPC · с плитами', 34500, 5.0, .45, '#7e8867', 'Облегчённый плитоносец с открытым структурным поясом.'),
    helmet('helmet_ssh68', 'СШ-68', 3200, 1.4, .16, '#596648', 'Советский стальной шлем с характерным высоким куполом.'),
    helmet('helmet_6b7', '6Б7-1М', 8500, 1.4, .28, '#62704d', 'Российский общевойсковой шлем с полноразмерными боковинами.'),
    helmet('helmet_6b47', '6Б47', 14000, 1.2, .32, '#627251', 'Российский шлем с передним креплением и боковыми площадками.'),
    helmet('helmet_pasgt', 'PASGT helmet', 6800, 1.6, .26, '#75734f', 'Американский шлем с выраженным козырьком и низкими боковинами.'),
    helmet('helmet_mich', 'MICH 2000', 10500, 1.4, .30, '#73745c', 'Американский шлем без выступающего козырька, с закрытыми боковинами.'),
    helmet('helmet_ach', 'ACH', 14500, 1.4, .34, '#797960', 'Американский общевойсковой шлем с компактным куполом.'),
    helmet('helmet_fast', 'Ops-Core FAST · баллистический', 23000, 1.2, .33, '#8e8267', 'Высокий боковой вырез, боковые рельсы и переднее крепление.'),
];
