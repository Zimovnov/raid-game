import fs from 'node:fs';
import {ARSENAL_WEAPONS} from '../../../dist/src/content/arsenal-expansion.js';
import {CAMOUFLAGES} from '../../../dist/src/content/apparel.js';
import {CATALOG} from '../../../dist/src/content/catalog.js';
import {createWeapon,getSlots,replacePreview,moduleProblems,getNode} from '../../../dist/src/domain/items.js';
import {weaponModel} from '../../../dist/src/rendering/models.js';
import {geometry} from '../../../dist/src/rendering/geometry.js';
import {model} from '../../../dist/src/rendering/math.js';
const weapons={};
for(const def of ['weapon_ak74m','weapon_akm',...ARSENAL_WEAPONS.map(w=>w.id),'weapon_glock17']) {
 const groups={},seen=new Set(),queue=[createWeapon(def,false)];
 while(queue.length) {
  const gun=queue.shift();
  const parts=weaponModel(gun,'',0,{},false);
  const grouped={};
  for(const part of parts) {
   const path=part.slot||'body',node=getNode(gun,path);
   const key=path==='body'||path==='action'?path:path.replaceAll('.','_')+'__'+node?.def;
   (grouped[key]??=[]).push(part);
  }
  for(const [key,parts] of Object.entries(grouped)) if(!groups[key])groups[key]={parts,firstMatrix:Array.from(model(parts[0].p,parts[0].s,parts[0].r))};
  for(const {path,slot} of getSlots(gun)) for(const d of Object.values(CATALOG)){
   if(d.category!=='module'||d.interface!==slot.accepts||moduleProblems(gun,path,d.id).length)continue;
   const key=path+'__'+d.id;if(seen.has(key))continue;seen.add(key);
   queue.push(replacePreview(gun,path,d.id));
  }
 }
 weapons[def]={name:CATALOG[def].name,groups};
}
// АК-74М и АКМ используют один исходный Blender-корпус.  В нём есть все
// совместимые модули обеих платформ, в том числе разные магазины 5.45 и 7.62.
// Корпус и затвор берём от АКМ как от канонического исходника; совпадающие
// крепления остаются едиными, уникальные группы АК-74М добавляются без дублей.
const akm = weapons.weapon_akm, ak74m = weapons.weapon_ak74m;
weapons.weapon_ak_common = {
 name: 'АК · общий корпус',
 groups: {...akm.groups, ...Object.fromEntries(Object.entries(ak74m.groups).filter(([key])=>!(key in akm.groups)))},
};
const shapes=Object.fromEntries(['box','cylinder','cone','sphere','wedge'].map(k=>[k,Array.from(geometry(k).vertices)]));
fs.writeFileSync('art/FieldKit051/recipes.json',JSON.stringify({weapons,shapes,camouflages:CAMOUFLAGES}));
console.log(Object.fromEntries(Object.entries(weapons).map(([k,v])=>[k,Object.keys(v.groups).length])));
