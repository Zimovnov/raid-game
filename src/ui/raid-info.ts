import { CATALOG, QUESTS } from '../content/catalog.js';
import { MAPS } from '../content/maps.js';
import { flatGear, weight } from '../domain/items.js';
import type { Actor, MapDef, Profile, Settings } from '../domain/types.js';
import { esc } from './helpers.js';

const wrap = (degrees: number) => (degrees % 360 + 360) % 360;
const directions = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
export const headingDegrees = (yaw: number) => wrap(-yaw * 180 / Math.PI);
export function headingText(yaw: number): string {
    const degrees = Math.round(headingDegrees(yaw)) % 360;
    return `${directions[Math.round(degrees / 45) % 8]} · ${String(degrees).padStart(3, '0')}°`;
}
export function keyLabel(settings: Settings, action: string): string {
    const key = settings.bindings[action] || '';
    const names: Record<string, string> = { ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', Space: 'Пробел', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
    return names[key] || key.replace(/^Key|^Digit/, '');
}
export function nearestExit(map: MapDef, actor: Actor, activated: string[] = []): string {
    return map.exits.filter(exit => !exit.requires || activated.includes(exit.requires))
        .sort((a, b) => Math.hypot(a.p[0] - actor.p[0], a.p[2] - actor.p[2]) - Math.hypot(b.p[0] - actor.p[0], b.p[2] - actor.p[2]))[0]?.id || '';
}
export function exitGuidance(map: MapDef, actor: Actor, exitId: string, activated: string[] = []) {
    const exit = map.exits.find(value => value.id === exitId);
    if (!exit) return null;
    const dx = exit.p[0] - actor.p[0], dz = exit.p[2] - actor.p[2];
    const distance = Math.hypot(dx, dz);
    const bearing = wrap(Math.atan2(dx, -dz) * 180 / Math.PI);
    const relative = wrap(bearing - headingDegrees(actor.yaw) + 180) - 180;
    const arrow = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][Math.round(wrap(relative) / 45) % 8];
    return { exit, distance, bearing, relative, arrow, available: !exit.requires || activated.includes(exit.requires) };
}
export function guidanceText(map: MapDef, actor: Actor, exitId: string, activated: string[] = []): string {
    const guide = exitGuidance(map, actor, exitId, activated);
    if (!guide) return 'Выберите выход на карте';
    return `${guide.arrow} ${guide.exit.name} · ${Math.round(guide.distance)} м по прямой${guide.available ? '' : ' · закрыт'}`;
}
export function conditionHtml(actor: Actor): string {
    const status: string[] = [];
    if (actor.bleed) status.push('<span class="bad">Кровотечение · нужен бинт</span>');
    if (actor.legInjury) status.push('<span class="bad">Травма ноги · нужна шина</span>');
    if (actor.exhausted) status.push('<span class="warning">Истощение · бег после 25% сил</span>');
    if (actor.status === 'active') {
        const move = actor.sprinting ? 'Бег' : actor.input.crouch ? 'Приседание' : actor.input.slow ? 'Тихий шаг' : '';
        if (move) status.push(`<span class="good">${move}</span>`);
    }
    return status.join('');
}
export function useLabel(actor: Actor): string {
    const item = actor.gear.bag.find(i => i.id === actor.useItem);
    const names = { heal: 'Аптечка', bandage: 'Перевязка', splint: 'Наложение шины', energy: 'Еда / вода' };
    return item && CATALOG[item.def].effect ? names[CATALOG[item.def].effect!] : 'Использование';
}
export interface RaidObjective {
    id: string;
    name: string;
    detail: string;
    count: number;
    needed: number;
    ready: boolean;
}
/** Read-only preview of requirements. Only the persisted result awards progress. */
export function raidObjectives(profile: Profile, actor: Actor, mapId: string, raidId: string): RaidObjective[] {
    const active = actor.status === 'active';
    const gear = active ? flatGear(actor.gear) : [];
    return QUESTS.filter(quest => quest.map === mapId && profile.quests[quest.id]?.accepted && !profile.quests[quest.id].claimed).map(quest => {
        const state = profile.quests[quest.id];
        let count = state.progress, detail = '';
        if (quest.kind === 'visit') {
            count = Math.max(count, active && actor.visited.includes(quest.target) ? 1 : 0);
            detail = count >= quest.count ? state.progress >= quest.count ? 'Уже зачтено · награда в меню' : 'Точка посещена · эвакуируйтесь' : `Посетить: ${MAPS[mapId]?.pois.find(p => p.id === quest.target)?.name || quest.target}`;
        } else if (quest.kind === 'extract') {
            count += gear.filter(item => item.def === quest.target && item.found === raidId).reduce((n, item) => n + item.qty, 0);
            detail = state.progress >= quest.count ? 'Уже зачтено · награда в меню' : count >= quest.count ? 'Предмет при вас · эвакуируйтесь' : `Найти: ${CATALOG[quest.target]?.name || quest.target}`;
        } else if (quest.kind === 'deliver') {
            const stash = profile.stash.filter(item => item.def === quest.target && item.found && item.foundMap === mapId).reduce((n, item) => n + item.qty, 0);
            const carried = gear.filter(item => item.def === quest.target && item.found && item.foundMap === mapId).reduce((n, item) => n + item.qty, 0);
            count = stash + carried;
            detail = stash >= quest.count ? 'В схроне · сдайте после рейда' : count >= quest.count ? 'Хватит после выноса · эвакуируйтесь' : `Найти: ${CATALOG[quest.target]?.name || quest.target}`;
        } else {
            detail = count >= quest.count ? 'Испытание зачтено · награда в меню' : 'Измените сборку и выстрелите';
        }
        return { id: quest.id, name: quest.name, detail, count: Math.min(count, quest.count), needed: quest.count, ready: count >= quest.count };
    });
}
export function objectivesHtml(profile: Profile, actor: Actor, mapId: string, raidId: string): string {
    const objectives = raidObjectives(profile, actor, mapId, raidId);
    return objectives.length ? `<span class="caps">Задачи в рейде</span>${objectives.map(objective => `<div class="raid-objective ${objective.ready ? 'ready' : ''}"><b>${esc(objective.name)} <span>${objective.count}/${objective.needed}</span></b><small>${esc(objective.detail)}</small></div>`).join('')}` : '';
}
export function quickslotsHtml(actor: Actor, settings: Settings): string {
    const slots = [
        { action: 'primary', name: 'Основное', count: actor.gear.primary ? 1 : 0 },
        { action: 'secondary', name: 'Второе', count: actor.gear.secondary ? 1 : 0 },
        ...(['heal', 'bandage', 'energy', 'splint'] as const).map(effect => ({
            action: effect === 'energy' ? 'food' : effect,
            name: { heal: 'Аптечка', bandage: 'Бинт', energy: 'Еда', splint: 'Шина' }[effect],
            count: actor.gear.bag.filter(item => CATALOG[item.def].effect === effect).reduce((n, item) => n + item.qty, 0)
        }))
    ];
    return slots.map(slot => `<span${slot.action === 'primary' || slot.action === 'secondary' ? ` id="slot-${slot.action}"` : ''} class="${slot.count ? '' : 'empty'} ${actor.active === slot.action ? 'active' : ''}"><kbd>${esc(keyLabel(settings, slot.action))}</kbd>${slot.name}${['primary', 'secondary'].includes(slot.action) ? '' : ` <small>×${slot.count}</small>`}</span>`).join('');
}
export function carriedWeightText(actor: Actor): string {
    return `Снаряжение ${weight(flatGear(actor.gear)).toFixed(1)} кг · рюкзак ${weight(actor.gear.bag).toFixed(1)}/24 кг`;
}
