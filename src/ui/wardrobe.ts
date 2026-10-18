import { FABRIC_ASSETS } from '../content/fabric-assets.js';
import type { ViewModel } from './views.js';
import type { Equipment } from '../domain/types.js';
import { createItem } from '../domain/items.js';

const startingProtection = { armor: createItem('armor_light'), helmet: null };
/** Creation previews the actual starter protection; an old profile is only a wardrobe source. */
export function wardrobeEquipment(page: string, gear?: Pick<Equipment, 'armor' | 'helmet'>): Pick<Equipment, 'armor' | 'helmet'> | undefined {
    return page === 'character' ? startingProtection : gear;
}
import type { Appearance } from '../content/apparel.js';
import { APPEARANCE_PRESETS, BACKPACKS, BOOTS, CAMOUFLAGES, GLOVES, HEADWEAR, JACKETS, RIGS, TROUSERS, normalizeAppearance } from '../content/apparel.js';
import { CATALOG } from '../content/catalog.js';
import { patchControls } from './patches.js';
import { button as b, esc } from './helpers.js';

type Choice = { id: string; name: string; description?: string };
export const wardrobeFields: { key: keyof Appearance; name: string; choices: Choice[] }[] = [
    { key: 'jacket', name: 'Куртка / боевая рубашка', choices: JACKETS },
    { key: 'jacketCamo', name: 'Расцветка верха', choices: CAMOUFLAGES },
    { key: 'trousers', name: 'Брюки', choices: TROUSERS },
    { key: 'trouserCamo', name: 'Расцветка брюк', choices: CAMOUFLAGES },
    { key: 'rig', name: 'Разгрузка', choices: RIGS },
    { key: 'rigCamo', name: 'Расцветка снаряжения', choices: CAMOUFLAGES },
    { key: 'backpack', name: 'Внешний вид рюкзака', choices: BACKPACKS },
    { key: 'backpackCamo', name: 'Расцветка рюкзака', choices: CAMOUFLAGES },
    { key: 'headwear', name: 'Головной убор', choices: HEADWEAR },
    { key: 'gloves', name: 'Перчатки', choices: GLOVES },
    { key: 'boots', name: 'Обувь', choices: BOOTS },
];
function select(field: typeof wardrobeFields[number], a: Appearance): string {
    const value = a[field.key], active = field.choices.find(x => x.id === value);
    return `<label>${field.name}<select id="appearance-${field.key}" data-appearance="${field.key}">${field.choices.map(x => `<option value="${esc(x.id)}" ${value === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>${active?.description && !field.key.endsWith('Camo') ? `<small>${esc(active.description)}</small>` : ''}</label>`;
}
function chip(id: string, title: string): string {
    const c = CAMOUFLAGES.find(c => c.id === id) || CAMOUFLAGES[0];
    const color = `rgb(${c.colors[0].map(v => Math.round(v * 255)).join(',')})`;
    const texture = `background-color:${color};background-image:url('${esc(FABRIC_ASSETS[c.id])}');background-size:128px 128px`;
    return `<div class="fabric-chip"><span style="${texture}"></span><div><small>${title}</small><b>${esc(c.name)}</b></div></div>`;
}
export function wardrobeView(v: ViewModel): string {
    const creating = v.page === 'character', a = normalizeAppearance(v.character.appearance, v.character.faction, v.character.outfit);
    const selectedRig = RIGS.find(x => x.id === a.rig), pose = v.wardrobePose || 'idle';
    const gear = wardrobeEquipment(v.page, v.profile?.gear);
    return `<div class="page-head"><div><span class="caps">ПОЛЕВОЙ ГАРДЕРОБ · 0 ₽</span><h1>${creating ? 'Новый персонаж' : 'Свой комплект'}</h1><p class="small">Вся одежда и расцветки открыты сразу. Подберите форму и проверьте её в движении.</p></div><span class="wardrobe-unlock">ВСЁ ДОСТУПНО</span></div>
    <div class="wardrobe-layout"><aside class="panel wardrobe-options"><div class="wardrobe-section"><span class="caps">${creating ? 'Личное дело' : 'Персонаж'}</span>
    ${creating ? `<label>Позывной<input id="character-name" maxlength="24" value="${esc(v.character.name)}" placeholder="Ваш позывной"></label><label>Фракция<select id="faction"><option ${v.character.faction === 'BEAR' ? 'selected' : ''}>BEAR</option><option ${v.character.faction === 'USEC' ? 'selected' : ''}>USEC</option></select></label>` : `<h2>${esc(v.character.name)}</h2><p class="small">${v.character.faction} · внешний вид сохраняется между рейдами</p>`}
    <label>Лицо<select id="face">${Array.from({length: 12}, (_, i) => `<option value="${i}" ${v.character.face === i ? 'selected' : ''}>Вариант ${i + 1}</option>`).join('')}</select></label>
    <label>Готовый комплект<select id="appearance-preset"><option value="">Своя комбинация</option>${APPEARANCE_PRESETS.map(p => `<option value="${p.id}" ${JSON.stringify(a) === JSON.stringify(p.appearance) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
    <div class="wardrobe-section"><span class="caps">Форма</span>${wardrobeFields.slice(0,4).map(f => select(f,a)).join('')}</div>
    <div class="wardrobe-section"><span class="caps">Снаряжение</span>${wardrobeFields.slice(4).map(f => select(f,a)).join('')}</div></aside>
    <div class="wardrobe-stage"><div class="wardrobe-pose" role="group" aria-label="Проверка движения">${[['idle','Стойка'],['walk','Шаг'],['crouch','Присед']].map(([id,label]) => b(label,'wardrobe-pose',id,pose === id ? 'selected' : '')).join('')}</div><div class="wardrobe-caption"><span class="caps">${esc(selectedRig?.name || 'Без разгрузки')}</span><p class="small">Вращение — мышью · Масштаб — колесом</p></div></div>
    <aside class="panel wardrobe-summary"><span class="caps">Сочетание тканей</span>${chip(a.jacketCamo,'Верх')}${chip(a.trouserCamo,'Брюки')}${chip(a.rigCamo,'Снаряжение')}${chip(a.backpackCamo,'Рюкзак')}
    <div class="divider"></div><span class="caps">Бронекомплект</span><p>${gear?.armor ? esc(CATALOG[gear.armor.def].name) : creating ? 'Стартовый лёгкий бронежилет' : 'Бронежилет не надет'}</p><p class="small">${gear?.helmet ? esc(CATALOG[gear.helmet.def].name) : 'Шлем не надет'}</p>
    <p class="small">Броня и шлем надеваются в схроне. Разгрузка и модель рюкзака здесь меняют внешний вид; вместимость рюкзака — 6 × 6.</p>
    ${a.rig === 'rig_buyanov' ? '<div class="buyanov-note"><b>ПЕЛЬМЕНИ</b><p class="small">«Бронежилет Буянова» — пакет-разгрузка. Собственной бронезащиты у полиэтилена нет.</p></div>' : ''}
    ${patchControls(v)}
    <div class="wardrobe-actions">${b(creating ? 'Создать персонажа' : 'Сохранить внешний вид', creating ? 'create-character' : 'save-appearance','','primary',v.saving)}${b('Пакет «Пельмени»','wardrobe-buyanov','','ghost')}${b('Сбросить выбор','reset-appearance','','ghost')}${b(creating ? 'Назад' : 'В схрон','nav',creating ? 'main' : 'stash','ghost')}</div>
    ${creating ? `<p class="small">Старт: ${v.character.faction === 'BEAR' ? 'АК-74М' : 'M4A1'} + ПМ, лёгкая броня, патроны и медицина. 50 000 ₽ выдаются один раз при создании профиля.</p>${v.profile ? '<p class="bad small">Создание нового профиля заменит текущий после резервного копирования и подтверждения.</p>' : ''}` : b('Новый персонаж','nav','character','ghost')}
    </aside></div>`;
}
