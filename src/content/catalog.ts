import { BUILD_HASH } from './version.js';
import { WEAPONS, MODULES, AMMO, ARMOR } from './weapons.js';
import { LOOT } from './loot.js';
import { FIELD_NOTES } from './field-notes.js';
import type { Definition, QuestDef } from '../domain/types.js';
export { WEAPONS, MODULES, AMMO, ARMOR, LOOT };
export const CATALOG: Record<string, Definition> = Object.fromEntries([...WEAPONS, ...MODULES, ...AMMO, ...ARMOR, ...LOOT].map(d => [d.id, FIELD_NOTES[d.id] ? { ...d, joke: FIELD_NOTES[d.id] } : d]));
export const QUESTS: QuestDef[] = [
    { id: 'quest_01', name: 'Требуется инструмент', map: 'factory', kind: 'deliver', target: 'loot_hand_tools_03', count: 1, reward: 8500 },
    { id: 'quest_02', name: 'Книга технолога', map: 'factory', kind: 'extract', target: 'loot_factory_special_01', count: 1, reward: 17000 },
    { id: 'quest_03', name: 'Партия под контролем', map: 'factory', kind: 'extract', target: 'loot_factory_special_03', count: 1, reward: 11000 },
    { id: 'quest_04', name: 'На соседней улице', map: 'city', kind: 'visit', target: 'workshop', count: 1, reward: 9000 },
    { id: 'quest_05', name: 'После смены', map: 'city', kind: 'deliver', target: 'loot_medical_09', count: 2, reward: 15000 },
    { id: 'quest_06', name: 'Квартальные записи', map: 'city', kind: 'extract', target: 'loot_documents_09', count: 1, reward: 9500 },
    { id: 'quest_07', name: 'Дачное снабжение', map: 'village', kind: 'deliver', target: 'loot_food_drink_01', count: 3, reward: 7000 },
    { id: 'quest_08', name: 'Гаражный запас', map: 'village', kind: 'deliver', target: 'loot_building_material_11', count: 2, reward: 6500 },
    { id: 'quest_09', name: 'Прогулка с пользой', map: 'park', kind: 'visit', target: 'yard', count: 1, reward: 9000 },
    { id: 'quest_10', name: 'Электрик на выезде', map: 'park', kind: 'deliver', target: 'loot_electronics_16', count: 1, reward: 12000 },
    { id: 'quest_11', name: 'Проверенная техника', map: 'mall', kind: 'extract', target: 'loot_electronics_05', count: 1, reward: 16500 },
    { id: 'quest_12', name: 'Своя сборка', map: 'range', kind: 'test', target: 'custom', count: 1, reward: 10000 },
    { id: 'quest_13', name: 'Смена по пропуску', map: 'factory', kind: 'visit', target: 'changing', count: 1, reward: 7500 },
    { id: 'quest_14', name: 'Давление в системе', map: 'factory', kind: 'visit', target: 'boiler', count: 1, reward: 10500 },
    { id: 'quest_15', name: 'Последний тираж', map: 'city', kind: 'visit', target: 'kiosk', count: 1, reward: 7000 },
    { id: 'quest_16', name: 'Обход теплотрассы', map: 'city', kind: 'visit', target: 'utilities', count: 1, reward: 10000 },
    { id: 'quest_17', name: 'Без света', map: 'village', kind: 'visit', target: 'substation', count: 1, reward: 9000 },
    { id: 'quest_18', name: 'Автобус не придёт', map: 'village', kind: 'visit', target: 'bus_stop', count: 1, reward: 7500 },
    { id: 'quest_19', name: 'Открытая площадка', map: 'park', kind: 'visit', target: 'exercise', count: 1, reward: 8500 },
    { id: 'quest_20', name: 'Дежурство лесничего', map: 'park', kind: 'visit', target: 'ranger', count: 1, reward: 11500 },
    { id: 'quest_21', name: 'Новая форма', map: 'mall', kind: 'visit', target: 'clothing', count: 1, reward: 9000 },
    { id: 'quest_22', name: 'Пост сдан', map: 'mall', kind: 'visit', target: 'security', count: 1, reward: 12000 },
    { id: 'quest_23', name: 'Дальний склад', map: 'factory', kind: 'visit', target: 'district-1', count: 1, reward: 15000 },
    { id: 'quest_24', name: 'Высота над автобазой', map: 'factory', kind: 'visit', target: 'lookout-4', count: 1, reward: 18000 },
    { id: 'quest_25', name: 'Связь с кварталом', map: 'city', kind: 'visit', target: 'district-9', count: 1, reward: 15500 },
    { id: 'quest_26', name: 'На другом конце района', map: 'city', kind: 'visit', target: 'district-6', count: 1, reward: 16500 },
    { id: 'quest_27', name: 'След лесорубов', map: 'village', kind: 'visit', target: 'district-0', count: 1, reward: 15000 },
    { id: 'quest_28', name: 'Последний прогноз', map: 'village', kind: 'visit', target: 'district-11', count: 1, reward: 17000 },
    { id: 'quest_29', name: 'Дальнее лесничество', map: 'park', kind: 'visit', target: 'district-6', count: 1, reward: 16000 },
    { id: 'quest_30', name: 'Санаторий на горизонте', map: 'park', kind: 'visit', target: 'lookout-7', count: 1, reward: 18000 },
    { id: 'quest_31', name: 'Неучтённый груз', map: 'mall', kind: 'visit', target: 'district-9', count: 1, reward: 15500 },
    { id: 'quest_32', name: 'Обход гипермаркета', map: 'mall', kind: 'visit', target: 'district-6', count: 1, reward: 16500 }
];
export const TRADERS = [
    { id: 'guns', name: 'Игорь Мельников', role: 'Оружейник', categories: ['weapon', 'module', 'ammo'], buy: 1.2, sell: .45 },
    { id: 'supply', name: 'Анна Белова', role: 'Снабжение', categories: ['medical', 'food_drink', 'armor'], buy: 1.2, sell: .48 },
    { id: 'goods', name: 'Павел Седов', role: 'Техника и хозяйство', categories: ['hand_tools', 'electronics', 'industrial', 'building_material', 'valuables', 'household', 'documents', 'factory_special'], buy: 1.3, sell: .5 }
];
export const BUILD_VERSION = '0.6.0-' + BUILD_HASH.slice(0, 16);
// Updated with protocol/layout changes. Not a security signature.
export const CONTENT_VERSION = 'reid-online-060-schema3-frontier16-scav-items-quests32';
