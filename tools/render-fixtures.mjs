import {VIEW_WEAPON_OFFSET} from '../dist/src/domain/weapon-pose.js';
import {handsModel,muzzleFlashModel,weaponMotion} from '../dist/src/rendering/weapon-animation.js';
import {Collision,doorObstacle} from '../dist/src/simulation/collision.js';
import {WEAPONS} from '../dist/src/content/catalog.js';
import {APPEARANCE_PRESETS,defaultAppearance} from '../dist/src/content/apparel.js';
import {heldWeaponMatrix} from '../dist/src/rendering/held-weapon.js';
// Export actual geometry, shaders and transforms for an independent native GLES validation.
// This is not a replacement for testing the browser Renderer class.
import fs from 'node:fs';import {geometry} from '../dist/src/rendering/geometry.js';import {weaponModel,mapModel,characterModel,lootModel} from '../dist/src/rendering/models.js';import {MAPS} from '../dist/src/content/maps.js';import {model,identity,lookAt,multiply,perspective,WORLD_NEAR,VIEWMODEL_NEAR} from '../dist/src/rendering/math.js';import {newProfile} from '../dist/src/domain/profile.js';import {createWeapon,createItem} from '../dist/src/domain/items.js';import {World} from '../dist/src/simulation/world.js';
const dir='artifacts/native-fixtures';fs.mkdirSync(dir,{recursive:true});const src=fs.readFileSync('src/rendering/renderer.ts','utf8');for(const name of ['vertex','fragment'])fs.writeFileSync(`${dir}/${name}.glsl`,src.match(new RegExp(`const ${name} = \x60([\\s\\S]*?)\x60;`))[1]);
const shapes=['box','cylinder','sphere','cone','wedge'];for(const shape of shapes){const a=geometry(shape).vertices;fs.writeFileSync(`${dir}/${shape}.bin`,Buffer.from(a.buffer,a.byteOffset,a.byteLength));}
const W=1440,H=900,fixtures=[];const gun=createWeapon('weapon_ak74m');
function fixture(name,parts,eye,target,fov,fog){const files={};for(const shape of shapes){const list=parts.filter(p=>p.shape===shape);const a=new Float32Array(list.length*20);for(let i=0;i<list.length;i++){const p=list[i];a.set(multiply(p.parent||identity(),model(p.p,p.s,p.r)),i*20);a.set([...p.c,p.material?-p.material:p.emissive||0],i*20+16);}const filename=`${name}-${shape}.bin`;fs.writeFileSync(`${dir}/${filename}`,Buffer.from(a.buffer));files[shape]={file:filename,count:list.length};}const near=/^(factory|city|village|park|mall)(?:-|$)/.test(name)?WORLD_NEAR:VIEWMODEL_NEAR;fixtures.push({name,eye,fogNear:name.endsWith('-overview')?500:55,vp:[...multiply(perspective(fov,W/H,near),lookAt(eye,target))],fog,files});}
function armedCharacter(character,weapon,time=0,moving=0,crouch=false,equipment,pose={},pitch=0){
 const presentation={gun:weapon,weaponPose:pose,pitch},parent=heldWeaponMatrix(weapon,pose,crouch,pitch,time,moving);
 return [...characterModel(character,time,moving,false,crouch,equipment,presentation),...weaponModel(weapon,'',0,pose).map(p=>({...p,parent}))];
}
fixture('gunsmith',weaponModel(gun),[Math.cos(1.2)*Math.cos(.19)*1.8,Math.sin(.19)*1.8-.04,Math.sin(1.2)*Math.cos(.19)*1.8-.13],[0,-.04,-.13],43,[.105,.13,.12]);
for(const name of ['factory','city','village','park','mall']){const map=MAPS[name],p=newProfile({name:'Native test',faction:'BEAR',face:0,outfit:0}),w=new World(map,'native-render');w.addPlayer(p.id,p.character,p.gear);const parts=mapModel(map);
 for(const bot of w.bots.values())parts.push(...characterModel({name:bot.name,faction:'BEAR',face:bot.style,outfit:bot.style}).map(p=>({...p,parent:model(bot.p,[1,1,1],[0,bot.yaw,0])})));
 for(const c of w.containers.values())if(c.items.length)parts.push(...lootModel(c.items[0]).map(p=>({...p,parent:model([c.p[0],w.collision.floor(c.p,0)+.009,c.p[2]])})));
 for(const d of map.doors){const o=doorObstacle(d);parts.push({shape:'box',p:o.p,s:o.s,r:[0,0,0],c:[.3,.4,.34]});}
 const eye=[map.spawn[0][0],map.spawn[0][1]+1.58,map.spawn[0][2]];fixture(name,parts,eye,[eye[0],eye[1],eye[2]-1],78,map.fog);
 fixture(name+'-overview',parts,[map.size[0]*.48,95,map.size[1]*.55],[0,0,0],65,map.fog);
 for(const poi of map.pois){const detailViews={ 'mall-clothing':{eye:[-28,5.58,17],target:[-20,5.1,15]},'city-utilities':{eye:[-1,1.58,-39],target:[-7,2.1,-45]} };const view=detailViews[name+'-'+poi.id];if(view){fixture(name+'-'+poi.id,parts,view.eye,view.target,68,map.fog);continue;}const candidates=[...w.navigation.nodes.values()].filter(n=>Math.abs(n.p[1]-poi.p[1])<.4&&Math.hypot(n.p[0]-poi.p[0],n.p[2]-poi.p[2])>4&&Math.hypot(n.p[0]-poi.p[0],n.p[2]-poi.p[2])<9);const node=candidates.find(n=>w.collision.visible([n.p[0],n.p[1]+1.58,n.p[2]],[poi.p[0],poi.p[1]+1.3,poi.p[2]]));if(node){const e=[node.p[0],node.p[1]+1.58,node.p[2]];fixture(name+'-'+poi.id,parts,e,[poi.p[0],poi.p[1]+1.3,poi.p[2]],78,map.fog);}}

}
for (const d of WEAPONS) {
 const target=[0,-.025,-.18],eye=[.72,.28,1.52];
 fixture('weapon-'+d.id,weaponModel(createWeapon(d.id)),eye,target,43,[.105,.13,.12]);
}
const examples=['loot_electronics_04','loot_electronics_03','loot_electronics_06','loot_electronics_09','loot_valuables_17','loot_valuables_16','loot_valuables_05','loot_industrial_03','loot_hand_tools_03','loot_medical_09','loot_factory_special_02','loot_electronics_13'];
const still=examples.flatMap((id,n)=>lootModel(createItem(id)).map(p=>({...p,parent:model([(n%4-1.5)*.65,0,(Math.floor(n/4)-1)*.7])})));
fixture('loot-selection',still,[2.1,3.4,3.7],[0,.08,0],43,[.105,.13,.12]);
fixture('reload-magazine',weaponModel(createWeapon('weapon_m4a1'),'',0,{reload:.5,mode:'swap'}),[.72,.28,1.52],[0,-.10,-.18],43,[.105,.13,.12]);
// View-model fixtures use the production motion, hands, placement and scene perspective.
for(const id of ['weapon_ak74m','weapon_m4a1','weapon_pm','weapon_mosin9130','weapon_mp133']){
 const g=createWeapon(id);for(const phase of [0,.25,.5,.8]){
 const pose={reload:phase,mode:['weapon_mosin9130','weapon_mp133'].includes(id)?'rounds':'swap',empty:true,shotAge:10};const motion=weaponMotion(g,pose);
 const parent=model(VIEW_WEAPON_OFFSET.map((v,k)=>v+motion.body[k]),[1,1,1],motion.rotation);
 const parts=[...weaponModel(g,'',0,pose),...handsModel(g,pose)].map(p=>({...p,parent}));
 fixture('fps-'+id+'-'+Math.round(phase*100),parts,[0,0,0],[0,0,-1],78,[.19,.23,.22]);
 }}
// New authored feedback uses the same GLES shaders as every other fixture.
for(const [name,id,suppressed] of [['flash-ak','weapon_ak74m',false],['flash-pistol','weapon_pm',false],['flash-suppressed','weapon_ak74m',true]]){
 const g=createWeapon(id),parent=model(VIEW_WEAPON_OFFSET);
 if(suppressed)g.children.muzzle=createItem('ak_suppressor');
 const parts=[...weaponModel(g),...handsModel(g),...muzzleFlashModel(g,0,suppressed)].map(p=>({...p,parent}));
 fixture(name,parts,[0,0,0],[0,0,-1],78,[.19,.23,.22]);
}
for(const [name,crouch] of [['character-standing',false],['character-crouched',true]]){
 const c={name:'Проверка стойки',faction:'BEAR',face:0,outfit:0};
 const parts=armedCharacter(c,gun,0,0,crouch);
 fixture(name,parts,[2.5,1.65,3.1],[0,.82,0],43,[.105,.13,.12]);
}
// Independent apparel views: actual production geometry, including joint-bound prints and lettering.
for(const preset of APPEARANCE_PRESETS){
 const c={name:preset.name,faction:'BEAR',face:3,outfit:0,appearance:preset.appearance};
 fixture('apparel-'+preset.id,characterModel(c),[1.45,1.27,-3.2],[0,.91,0],43,[.105,.13,.12]);
}
const bagCharacter={name:'Пельменный резерв',faction:'BEAR',face:1,outfit:0,appearance:{...defaultAppearance(),jacket:'jacket_m65',trousers:'trousers_bdu',rig:'rig_buyanov',jacketCamo:'olive',trouserCamo:'khaki',headwear:'head_watch',backpack:'pack_rd54'}};
fixture('apparel-buyanov-front',characterModel(bagCharacter),[0,1.08,-1.9],[0,1.04,0],43,[.105,.13,.12]);
fixture('apparel-buyanov-back',characterModel(bagCharacter),[1.7,1.3,3.2],[0,.88,0],43,[.105,.13,.12]);
const modernCharacter={name:'Современный комплект',faction:'USEC',face:4,outfit:8,appearance:{...defaultAppearance('USEC'),jacketCamo:'multicam',trouserCamo:'emr',rigCamo:'ranger_green',backpack:'pack_sso_ataka',backpackCamo:'coyote'}};
const modernGear={armor:createItem('armor_jpc'),helmet:createItem('helmet_fast')};
fixture('apparel-walk',armedCharacter(modernCharacter,gun,.19,1,false,modernGear),[1.8,1.27,-3.0],[0,.88,0],43,[.105,.13,.12]);
fixture('apparel-crouch',armedCharacter(modernCharacter,createWeapon('weapon_auga3'),.19,1,true,modernGear),[1.8,1.14,-2.7],[0,.58,0],43,[.105,.13,.12]);
fixture('apparel-grip-ak-side',armedCharacter(modernCharacter,gun,0,0,false,modernGear),[3,1.5,-.7],[0,1.05,-.12],43,[.105,.13,.12]);
fixture('apparel-grip-aug-reload',armedCharacter(modernCharacter,createWeapon('weapon_auga3'),.19,1,false,modernGear,{reload:.5,mode:'swap',empty:true},-.28),[1.6,1.5,-2.8],[0,1.03,-.17],43,[.105,.13,.12]);
fixture('apparel-grip-m17',armedCharacter(modernCharacter,createWeapon('weapon_m17'),0,0,false,modernGear,{},.28),[1.8,1.4,-2.6],[0,1.03,-.17],43,[.105,.13,.12]);
fixture('apparel-grip-mosin-crouch',armedCharacter(modernCharacter,createWeapon('weapon_mosin9130'),.19,1,true,modernGear,{reload:.5,mode:'rounds'},-.32),[2,1.3,-2.7],[0,.64,-.12],43,[.105,.13,.12]);
const armorDisplay=['armor_6b2','armor_6b45','armor_iotv','armor_jpc','armor_spc','helmet_ssh68','helmet_pasgt','helmet_fast'].flatMap((id,n)=>lootModel(createItem(id)).map(p=>({...p,parent:model([(n%4-1.5)*.72,n<4?.70:0,0])})));
fixture('apparel-equipment-display',armorDisplay,[.9,1.0,-3.5],[0,.41,0],43,[.105,.13,.12]);
for(const id of ['weapon_mosin9130','weapon_mp133']){
 const g=createWeapon(id),pose={reload:.5,mode:'range',empty:true,shotAge:10},motion=weaponMotion(g,pose);
 const parent=model(VIEW_WEAPON_OFFSET.map((v,k)=>v+motion.body[k]),[1,1,1],motion.rotation);
 fixture('range-loading-'+id,[...weaponModel(g,'',0,pose),...handsModel(g,pose)].map(p=>({...p,parent})),[0,0,0],[0,0,-1],78,[.19,.23,.22]);
}
fs.writeFileSync(`${dir}/manifest.json`,JSON.stringify({width:W,height:H,fixtures}));
