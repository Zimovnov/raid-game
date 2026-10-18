import type { Definition, Mods, Slot, WeaponStats } from '../domain/types.js';
import { rgb } from '../domain/util.js';
const slot = (id: string, name: string, accepts: string, required = false): Slot => ({id,name,accepts,required});
const mag = (kind: string) => slot('magazine', 'Магазин', kind + '-mag', true);
const stock = (kind: string) => slot('stock', 'Приклад', kind + '-stock', true);
const guard = (kind: string) => slot('handguard', 'Цевьё', kind + '-handguard', true);
const grip = (kind: string) => slot('pistolgrip', 'Рукоятка', kind + '-grip', true);
const mount = (kind: string) => slot('mount', 'Кронштейн', kind + '-mount');
const optic = slot('optic','Оптика','rail-optic');
const rail: Slot[] = [slot('grip','Передняя рукоятка','rail-grip'),slot('light','Фонарь','rail-light'),slot('laser','Лазер','rail-laser')];
const muzzle = (kind: string) => slot('muzzle','Дульное устройство',kind+'-muzzle');
function w(id: string, name: string, shape: string, ammo: string, price: number, slots: Slot[], base: Partial<WeaponStats>, feed: Definition['feed'] = 'detachable'): Definition {
    const stats: WeaponStats = {damage:28,rpm:600,recoil:1,ergo:50,reload:2.6,capacity:30,zoom:1,noise:1,spread:.018,weight:2.1,ads:.24,auto:true,pellets:1,...base};
    return {id:'weapon_'+id,name,shape,ammo,price,slots,stats,feed,weight:stats.weight,category:'weapon',size:shape==='tt'||shape==='glock'||shape==='grach'?[2,2]:[4,2],rarity:2,maxStack:1,color:rgb('#394043'),description:'Стилизованная виртуальная модель по перечню ТЗ. Игровые соединения, размеры и характеристики не являются спецификацией настоящего оружия. Продаётся без патронов.'};
}
export const EXTRA_WEAPONS: Definition[] = [
    w('aks74u','АКС-74У','aksu','5.45x39',38000,[stock('aksu'),guard('aksu'),grip('ak'),mag('ak545'),mount('aksu'),muzzle('aksu')],{rpm:690,recoil:1.14,ergo:65,weight:1.65}),
    w('ak103','АК-103','ak103','7.62x39',56000,[stock('ak'),guard('ak'),grip('ak'),mag('ak762'),mount('ak'),muzzle('ak')],{damage:35,rpm:600,recoil:1.1,weight:2.25}),
    w('hk416a5','HK416 A5','hk416','5.56x45',118000,[stock('ar'),guard('hk416'),grip('ar'),mag('ar556'),optic,muzzle('ar')],{damage:26,rpm:820,recoil:.8,weight:2.5,ergo:46}),
    w('pp1901','ПП-19-01 «Витязь»','vityaz','9x19',45000,[stock('vityaz'),guard('vityaz'),grip('ak'),mag('vityaz'),mount('vityaz'),muzzle('vityaz')],{damage:20,rpm:680,recoil:.62,ergo:66,weight:1.75}),
    w('pp91','ПП-91 «Кедр»','kedr','9x18',20000,[stock('kedr'),grip('kedr'),mag('kedr')],{damage:18,rpm:900,recoil:.86,ergo:73,weight:.85,reload:2}),
    w('tt','ТТ','tt','7.62x25',15000,[grip('tt'),mag('tt')],{damage:29,rpm:310,recoil:1.03,ergo:74,weight:.59,capacity:8,reload:1.9,auto:false}),
    w('glock17','Glock 17','glock','9x19',33000,[mag('glock'),slot('light','Подствольный фонарь','pistol-light')],{damage:23,rpm:390,recoil:.64,ergo:78,weight:.51,capacity:17,reload:1.65,auto:false}),
    w('mp443','МР-443 «Грач»','grach','9x19',27000,[grip('grach'),mag('grach')],{damage:24,rpm:350,recoil:.7,ergo:70,weight:.7,capacity:18,reload:1.9,auto:false}),
    w('sks','СКС','sks','7.62x39',28000,[stock('sks'),mount('sks')],{damage:39,rpm:230,recoil:1.22,ergo:40,weight:2.45,capacity:10,reload:.6,auto:false},'internal'),
    w('mosin9130','Винтовка Мосина обр. 1891/30','mosin','7.62x54R',31000,[stock('mosin')],{damage:64,rpm:43,recoil:1.6,ergo:29,weight:2.5,capacity:5,reload:.75,auto:false},'internal'),
    w('svd','СВД','svd','7.62x54R',95000,[stock('svd'),guard('svd'),mag('svd'),mount('svd')],{damage:55,rpm:205,recoil:1.44,ergo:34,weight:2.8,capacity:10,reload:2.9,auto:false}),
    w('sv98','СВ-98','sv98','7.62x54R',112000,[stock('sv98'),mag('sv98'),optic],{damage:67,rpm:48,recoil:1.31,ergo:32,weight:3.7,capacity:10,reload:3.1,auto:false}),
    w('mp153','МР-153','mp153','12gauge',36000,[stock('sg'),guard('mp153'),mount('sg')],{damage:11,rpm:175,recoil:1.8,weight:2.6,capacity:5,reload:.68,auto:false,pellets:7,spread:.06},'tube'),
    w('saiga12k','Сайга-12К','saiga','12gauge',62000,[stock('saiga'),guard('saiga'),grip('ak'),mag('saiga'),mount('saiga')],{damage:10,rpm:205,recoil:1.75,ergo:37,weight:2.3,capacity:8,reload:2.9,auto:false,pellets:8,spread:.055})
];
function m(id: string,name: string,intf: string,shape: string,price: number,weight: number,mods: Mods = {},slots: Slot[] = [],ammo?: string): Definition {
    return {id,name,interface:intf,shape,price,weight,mods,slots,ammo,category:'module',size:intf.endsWith('-mag')&& (mods.capacity||0)>20?[1,2]:[1,1],maxStack:1,rarity:1,color:rgb(shape.includes('wood')?'#98643d':'#343b3d'),description:'Авторская виртуальная деталь «Рейд». Геометрия, интерфейс и баланс разработаны для игры; не инструкция и не заявленная заводская совместимость.'};
}
export const EXTRA_MODULES: Definition[] = [
    m('aksu_stock','Компактный рамочный приклад','aksu-stock','stock_wire',3400,.21,{ergo:5,recoil:-.04}),
    m('aksu_guard','Короткое деревянное цевьё','aksu-handguard','guard_mini_wood',2600,.19),
    m('aksu_rail','Короткое цевьё с планками','aksu-handguard','guard_mini_rail',6400,.27,{ergo:-2},rail),
    m('aksu_mount','Низкий мостик компактной платформы','aksu-mount','mount_short',4100,.10,{},[optic]),
    m('aksu_muzzle','Конусное дульное устройство','aksu-muzzle','muzzle_cone',2300,.13,{noise:-.05}),
    m('hk416_guard','Вентилируемое цевьё 416','hk416-handguard','guard_416',9200,.38,{recoil:-.05},rail),
    m('hk416_short','Укороченное цевьё 416','hk416-handguard','guard_416_short',8200,.26,{ergo:8},rail),
    m('vityaz_stock','Складной приклад ПП','vityaz-stock','stock_triangle',3900,.25,{recoil:-.06}),
    m('vityaz_guard','Узкое полимерное цевьё ПП','vityaz-handguard','guard_mini_poly',2300,.18,{ergo:4}),
    m('vityaz_rail','Узкое рельсовое цевьё ПП','vityaz-handguard','guard_mini_rail',5900,.24,{},rail),
    m('vityaz_30','Магазин ПП-19 · 30','vityaz-mag','mag_smg',2400,.21,{capacity:30},[],'9x19'),
    m('vityaz_mount','Мостик короткого ПП','vityaz-mount','mount_short',4200,.14,{},[optic]),
    m('vityaz_can','Короткий глушитель ПП','vityaz-muzzle','muzzle_short_can',14500,.25,{noise:-.52,ergo:-4}),
    m('kedr_stock','Проволочный приклад «Кедра»','kedr-stock','stock_wire_kedr',2100,.18,{recoil:-.08}),
    m('kedr_grip','Узкая рукоятка «Кедра»','kedr-grip','grip_kedr',1200,.09,{ergo:4}),
    m('kedr_20','Магазин ПП-91 · 20','kedr-mag','mag_kedr_short',1800,.12,{capacity:20,ergo:4},[],'9x18'),
    m('kedr_30','Магазин ПП-91 · 30','kedr-mag','mag_kedr_long',2800,.18,{capacity:30,ergo:-3},[],'9x18'),
    m('tt_grip','Рифлёные накладки ТТ','tt-grip','grip_tt',1000,.08),
    m('tt_8','Магазин ТТ · 8','tt-mag','mag_tt',1200,.075,{capacity:8},[],'7.62x25'),
    m('glock_17','Магазин Glock · 17','glock-mag','mag_glock',2400,.08,{capacity:17},[],'9x19'),
    m('glock_33','Удлинённый магазин Glock · 33','glock-mag','mag_glock_long',5800,.16,{capacity:33,ergo:-10,reload:.2},[],'9x19'),
    m('pistol_light','Компактный подствольный фонарь','pistol-light','light_pistol',6700,.1,{ergo:-2}),
    m('grach_grip','Контурные накладки «Грача»','grach-grip','grip_grach',1400,.11),
    m('grach_18','Магазин «Грача» · 18','grach-mag','mag_grach',2600,.095,{capacity:18},[],'9x19'),
    m('sks_stock','Деревянная ложа СКС','sks-stock','stock_sks_wood',4300,.83,{recoil:-.09,ergo:-4}),
    m('sks_synthetic','Полимерная ложа СКС','sks-stock','stock_sks_poly',9400,.59,{ergo:8}),
    m('sks_mount','Игровое крепление СКС','sks-mount','mount_sks',5500,.18,{},[optic]),
    m('mosin_stock','Длинная деревянная ложа','mosin-stock','stock_mosin_wood',4700,.97,{recoil:-.1}),
    m('svd_stock','Скелетный приклад СВД','svd-stock','stock_svd_wood',6800,.46,{recoil:-.11}),
    m('svd_guard','Вентилируемые накладки СВД','svd-handguard','guard_svd_wood',5600,.36,{ergo:2}),
    m('svd_10','Магазин СВД · 10','svd-mag','mag_svd',3500,.22,{capacity:10},[],'7.62x54R'),
    m('svd_mount','Боковое крепление СВД','svd-mount','mount_side',6200,.19,{},[optic]),
    m('sv98_stock','Спортивная ложа с щекой','sv98-stock','stock_sv98',11500,1.12,{recoil:-.13,ergo:-4}),
    m('sv98_10','Магазин СВ-98 · 10','sv98-mag','mag_sv98',4400,.19,{capacity:10},[],'7.62x54R'),
    m('mp153_guard','Длинное полимерное цевьё дробовика','mp153-handguard','guard_mp153',3200,.32,{ergo:3}),
    m('saiga_stock','Складной приклад дробовика','saiga-stock','stock_solid_short',3600,.39,{recoil:-.14}),
    m('saiga_guard','Широкое цевьё дробовика','saiga-handguard','guard_saiga',4300,.32),
    m('saiga_rail','Широкое цевьё с планками','saiga-handguard','guard_saiga_rail',9500,.44,{ergo:-4},rail),
    m('saiga_8','Коробчатый магазин 12 к. · 8','saiga-mag','mag_shotgun',4800,.36,{capacity:8},[],'12gauge'),
    m('saiga_5','Короткий магазин 12 к. · 5','saiga-mag','mag_shotgun_short',3100,.24,{capacity:5,ergo:9},[],'12gauge'),
    m('saiga_mount','Боковое крепление дробовика','saiga-mount','mount_side',5200,.19,{},[optic]),
    m('ar_crane','Приклад с широким упором','ar-stock','stock_crane',8800,.48,{ergo:2,recoil:-.14}),
    m('ar_wire','Открытый минималистичный приклад','ar-stock','stock_wire_ar',6200,.18,{ergo:14,recoil:.06}),
    m('ak_cheek','Рамочный приклад с щекой','ak-stock','stock_cheek',9100,.37,{ergo:3,recoil:-.14}),
    m('mp5_retract','Выдвижной металлический приклад','mp5-stock','stock_retract',7400,.25,{ergo:8,recoil:.03}),
    m('sg_rubber','Полимерный приклад с амортизатором','sg-stock','stock_padded',7100,.55,{recoil:-.23,ergo:-3}),
    m('ak_vent','Цевьё с продольными окнами','ak-handguard','guard_vent',8100,.29,{ergo:6},rail),
    m('ar_octagonal','Восьмигранное цевьё','ar-handguard','guard_octagon',10500,.34,{ergo:3,recoil:-.03},rail),
    m('ak_palm','Рукоятка с ладонным упором','ak-grip','grip_palm',5100,.16,{ergo:13,recoil:.03}),
    m('ar_wrapped','Рукоятка с мягкой обмоткой','ar-grip','grip_wrap',3900,.15,{ergo:7,recoil:-.03}),
    m('fore_stub','Укороченная вертикальная рукоятка','rail-grip','fore_stub',4700,.09,{ergo:3,recoil:-.07}),
    m('fore_bail','Рукоятка с открытой скобой','rail-grip','fore_bail',5200,.10,{ergo:4,recoil:-.09}),
    m('dot_tube','Закрытый трубчатый коллиматор','rail-optic','optic_tube',13200,.22,{ergo:1,zoom:1}),
    m('prism2','Призматический прицел ×2','rail-optic','optic_prism',21500,.34,{ergo:-5,zoom:2}),
    m('scope6','Длинная оптика ×6','rail-optic','optic_long',34500,.62,{ergo:-14,zoom:6}),
    m('ak762_20','Короткий магазин 7,62 · 20','ak762-mag','mag_ak_short',2400,.23,{capacity:20,ergo:7},[],'7.62x39'),
    m('ar556_20','Короткий прямой магазин 5,56 · 20','ar556-mag','mag_ar_short',2600,.15,{capacity:20,ergo:8},[],'5.56x45'),
    m('mp5_15','Короткий магазин MP5 · 15','mp5-mag','mag_smg_short',2300,.12,{capacity:15,ergo:8},[],'9x19'),
    m('ak_ported','Двухкамерный игровой компенсатор','ak-muzzle','muzzle_ported',6800,.18,{recoil:-.17,noise:.13,ergo:-2}),
    m('ar_compact_can','Компактный глушитель AR','ar-muzzle','muzzle_short_can',18000,.29,{noise:-.43,ergo:-5,recoil:-.02}),
    m('wide_light','Фонарь с широким отражателем','rail-light','light_wide',8600,.23,{ergo:-4}),
    m('laser_dual','Двухоконный лазерный блок','rail-laser','laser_dual',11200,.17,{ergo:-3})
];
export const EXTRA_BUILDS: Record<string,Record<string,string>> = {
    weapon_aks74u:{stock:'aksu_stock',handguard:'aksu_guard',pistolgrip:'ak_grip',magazine:'ak545_30',muzzle:'aksu_muzzle'},
    weapon_ak103:{stock:'ak_stock',handguard:'ak_poly',pistolgrip:'ak_grip',magazine:'ak762_30',muzzle:'ak_brake'},
    weapon_hk416a5:{stock:'ar_crane',handguard:'hk416_guard',pistolgrip:'ar_grip',magazine:'ar556_30',muzzle:'ar_brake'},
    weapon_pp1901:{stock:'vityaz_stock',handguard:'vityaz_guard',pistolgrip:'ak_grip',magazine:'vityaz_30'},
    weapon_pp91:{stock:'kedr_stock',pistolgrip:'kedr_grip',magazine:'kedr_20'},
    weapon_tt:{pistolgrip:'tt_grip',magazine:'tt_8'},weapon_glock17:{magazine:'glock_17'},weapon_mp443:{pistolgrip:'grach_grip',magazine:'grach_18'},
    weapon_sks:{stock:'sks_stock'},weapon_mosin9130:{stock:'mosin_stock'},
    weapon_svd:{stock:'svd_stock',handguard:'svd_guard',magazine:'svd_10'},weapon_sv98:{stock:'sv98_stock',magazine:'sv98_10'},
    weapon_mp153:{stock:'sg_rubber',handguard:'mp153_guard'},weapon_saiga12k:{stock:'saiga_stock',handguard:'saiga_guard',pistolgrip:'ak_grip',magazine:'saiga_8'}
};
