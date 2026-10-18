import { DEFAULT_BUILDS } from './weapons.js';
import type { BuildPreset } from '../domain/types.js';
export interface WorkshopPreset { id: string; name: string; description: string; tree: BuildPreset }
function preset(id:string,name:string,description:string,def:string,changes:Record<string,string|null>):WorkshopPreset {
    const tree:BuildPreset={def,children:Object.fromEntries(Object.entries(DEFAULT_BUILDS[def]).map(([slot,def])=>[slot,{def,children:{}}]))};
    for(const [path,def] of Object.entries(changes)){
        const parts=path.split('.');const key=parts.pop()!;let node=tree;
        for(const part of parts){if(!node.children[part])throw Error('Preset parent is absent: '+path);node=node.children[part];}
        if(def===null)delete node.children[key];else node.children[key]={def,children:{}};
    }
    return {id,name,description,tree};
}
// Authored game examples, not recommendations about real weapon use.
export const WORKSHOP_PRESETS:WorkshopPreset[]=[
    preset('ak-stock','АК · исходный комплект','Недорогая сборка без оптики.','weapon_ak74m',{}),
    preset('ak-light','АК · лёгкий','Рамочный приклад и более удобная рукоятка.','weapon_ak74m',{stock:'ak_skeleton',pistolgrip:'ak_ergo'}),
    preset('ak-control','АК · контроль','Дополнительный хват и коллиматор ценой массы.','weapon_ak74m',{handguard:'ak_rail','handguard.grip':'fore_vertical',mount:'ak_mount','mount.optic':'red_dot'}),
    preset('ak-quiet','АК · тихий','Глушитель снижает игровую слышимость, но не обнуляет её.','weapon_ak74m',{handguard:'ak_rail','handguard.light':'flashlight',muzzle:'ak_suppressor',mount:'ak_mount','mount.optic':'holo'}),
    preset('akm-compact','АКМ · короткий магазин','Меньше патронов и массы при неизменном игровом уроне.','weapon_akm',{stock:'ak_skeleton',magazine:'ak762_20',pistolgrip:'ak_palm'}),
    preset('ar-stock','AR · исходный комплект','Штатная игровая конфигурация.','weapon_m4a1',{}),
    preset('ar-light','AR · облегчённый','Компактное цевьё, приклад и магазин на 20.','weapon_m4a1',{stock:'ar_compact',handguard:'ar_short',magazine:'ar556_20',optic:'dot_tube'}),
    preset('ar-range','AR · умеренная оптика','Прицел ×4, длинное цевьё и передняя рукоятка.','weapon_m4a1',{handguard:'ar_long','handguard.grip':'fore_bail',stock:'ar_precision',optic:'scope4'}),
    preset('ar-heavy','AR · запас патронов','Барабан на 60: больше боекомплект, тяжелее сборка.','weapon_m4a1',{handguard:'ar_long','handguard.grip':'fore_stub',magazine:'ar556_60',stock:'ar_crane',optic:'holo'}),
    preset('aksu-short','АКС-74У · компактный','Короткое цевьё с лазером и лёгкий коллиматор.','weapon_aks74u',{handguard:'aksu_rail','handguard.laser':'laser',mount:'aksu_mount','mount.optic':'red_dot'}),
    preset('mp5-quiet','MP5 · кооператив','Компактная тихая сборка со светом.','weapon_mp5',{handguard:'mp5_rail','handguard.light':'flashlight',mount:'mp5_mount','mount.optic':'red_dot',muzzle:'smg_suppressor'}),
    preset('sv98-optic','СВ-98 · оптика ×6','Высокое увеличение и медленное повторное действие.','weapon_sv98',{optic:'scope6'}),
    preset('ak12-patrol','АК-12 · патруль','Небольшой прицел, фонарь и передний упор.','weapon_ak12',{optic:'dot_tube','handguard.light':'light_compact','handguard.grip':'fore_slim'}),
    preset('rpk-support','РПК-74М · поддержка','Магазин на 45 и оптика ×3; высокая масса остаётся заметной.','weapon_rpk74m',{mount:'ak_mount','mount.optic':'scope3_compact'}),
    preset('val-compact','АС «Вал» · компактный','Короткий магазин и коллиматор; интегрированный глушитель уже входит в основу.','weapon_asval',{magazine:'val_10',mount:'val_mount','mount.optic':'red_dot'}),
    preset('vss-observer','ВСС · наблюдатель','Оптика ×4, деревянный приклад и магазин на 20.','weapon_vss',{magazine:'val_20',mount:'val_mount','mount.optic':'scope4'}),
    preset('g36-mobile','G36K · мобильный','Короткий магазин и компактная оптика; остаётся лёгкое цевьё.','weapon_g36k',{magazine:'g36_20',optic:'prism2'}),
    preset('scar-control','SCAR-L · контроль','Длинное цевьё и открытая передняя скоба.','weapon_scarl',{handguard:'scar_guard_long','handguard.grip':'fore_bail',optic:'scope3_compact'}),
    preset('aug-city','AUG · город','Передние планки, фонарь и коллиматор на короткой платформе.','weapon_auga3',{handguard:'aug_rail','handguard.light':'light_compact',optic:'red_dot'}),
    preset('mcx-night','MCX · тихий патруль','Компактный глушитель и фонарь; не даёт невидимости для ботов.','weapon_mcxspearlt',{muzzle:'mcx_can','handguard.light':'flashlight','handguard.grip':'fore_stub',optic:'holo'}),
    preset('bren-light','BREN 2 · облегчённый','Короткий магазин и небольшой передний упор.','weapon_bren2',{magazine:'ar556_20','handguard.grip':'fore_slim',optic:'dot_tube'}),
    preset('mpx-quiet','MPX · компактный','Короткий магазин, глушитель и открытый коллиматор.','weapon_mpx',{magazine:'mpx_20',muzzle:'mpx_can',optic:'red_dot'}),
    preset('m17-optic','M17 · прицел и фонарь','Пистолетный коллиматор через площадку, магазин на 21.','weapon_m17',{mount:'m17_mount','mount.optic':'pistol_dot',magazine:'m17_21',light:'pistol_light'}),
    preset('m14-observer','M14 · оптика','Оптика ×6 и короткий магазин для дальней линии обзора.','weapon_m14',{magazine:'m14_10',mount:'m14_mount','mount.optic':'scope6'})
];
