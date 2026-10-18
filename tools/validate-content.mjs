import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATALOG,LOOT} from '../dist/src/content/catalog.js';
import {WEAPONS,MODULES} from '../dist/src/content/weapons.js';
import {RAID_MAPS} from '../dist/src/content/maps.js';
import {BOT_NAMES,VOICES,OUTFITS} from '../dist/src/content/characters.js';
import {createItem,createWeapon,getSlots,replacePreview,validateBuild} from '../dist/src/domain/items.js';
import {weaponModel,lootModel} from '../dist/src/rendering/models.js';
import {hasFixedModelPresentation} from '../dist/src/content/model-presentation.js';
import {Collision,Navigation} from '../dist/src/simulation/collision.js';
import {dist} from '../dist/src/domain/util.js';
const installed=new Map();
for(const w of WEAPONS){const root=createWeapon(w.id);assert.deepEqual(validateBuild(root),[]);const queue=[root],seen=new Set();while(queue.length){const gun=queue.shift();for(const s of getSlots(gun)){for(const mod of MODULES.filter(m=>m.interface===s.slot.accepts)){const key=w.id+':'+s.path+':'+mod.id;if(seen.has(key))continue;seen.add(key);const candidate=replacePreview(gun,s.path,mod.id);if(validateBuild(candidate).length)continue;const parts=weaponModel(candidate);assert(hasFixedModelPresentation(candidate)||parts.some(p=>p.slot===s.path),`${key}: missing geometry`);for(const p of parts)assert([...p.p,...p.s,...p.r,...p.c].every(Number.isFinite),key);installed.set(mod.id,(installed.get(mod.id)||0)+1);if(mod.slots?.length)queue.push(candidate);}}}}
assert.equal(installed.size,MODULES.length,'Every included module must be installable with geometry');
for(const l of LOOT){assert(l.name&&l.price>0&&l.size.every(x=>x>0));assert(lootModel(createItem(l.id)).length>0,l.id);}
const report={weapons:WEAPONS.length,modules:MODULES.length,loot:LOOT.length,definitions:Object.keys(CATALOG).length,names:BOT_NAMES.length,lines:VOICES.length,outfits:OUTFITS.length,installed:[...installed.keys()],maps:[],unreachable:[]};
for(const map of RAID_MAPS){const start=performance.now(),c=new Collision(map),nav=new Navigation(c);const mapreport={id:map.id,loot:map.loot.length,bots:map.bots.length,nodes:nav.nodes.size,exitPaths:[],lootAccessible:0,ms:0};
 assert(map.loot.length>=30);assert.equal(map.exits.filter(e=>!e.requires).length,6);assert.equal(map.exits.length,9);for(const spawn of map.spawn)assert(c.free(spawn),`${map.id}: blocked spawn ${spawn}`);
 const reachable=new Set(),first=nav.closest(map.spawn[0]);const stack=[first.key];while(stack.length){const k=stack.pop();if(reachable.has(k))continue;reachable.add(k);stack.push(...nav.nodes.get(k).neighbors.filter(q=>!reachable.has(q)));}
 for(const exit of map.exits){const path=nav.path(map.spawn[0],exit.p);mapreport.exitPaths.push({id:exit.id,steps:path.length});if(!path.length)report.unreachable.push(map.id+':exit:'+exit.id);}
 for(const point of map.loot){const candidates=[...nav.nodes.values()].filter(n=>Math.abs(n.p[1]-(point.p[1]-.85))<1&&dist([n.p[0],n.p[1]+1.55,n.p[2]],point.p)<3.1&&reachable.has(n.key)&&c.visible([n.p[0],n.p[1]+1.55,n.p[2]],point.p));if(candidates.length)mapreport.lootAccessible++;else report.unreachable.push(map.id+':loot:'+point.id+':'+point.p.join(','));}
 mapreport.ms=Math.round(performance.now()-start);report.maps.push(mapreport);console.log(mapreport);
}
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/content-validation.json',JSON.stringify(report,null,2));
console.log('COUNTS',report.weapons,report.modules,report.loot, 'UNREACHABLE',report.unreachable);
assert.equal(report.unreachable.length,0,'Unreachable content must be fixed');
