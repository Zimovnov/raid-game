import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MODEL_ASSETS,MODULE_MODEL_ASSETS} from '../dist/src/content/model-assets.js';
import {modelPresentation} from '../dist/src/content/model-presentation.js';
import {CATALOG} from '../dist/src/content/catalog.js';
import {createWeapon,replacePreview} from '../dist/src/domain/items.js';
import {weaponModel} from '../dist/src/rendering/models.js';
function glb(path){const b=fs.readFileSync(path);assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));}
test('Field Kit weapons render installed modules while retaining authored body and action',()=>{
 const gun=createWeapon('weapon_glock17',false),modified=replacePreview(gun,'magazine','glock_33');
 assert.notDeepEqual(modified.children,gun.children);
 assert.equal(modelPresentation(modified),modified);
 const keys=(item)=>weaponModel(item).map(part=>part.asset&&`${part.asset.weapon}/${part.asset.group}`).filter(Boolean);
 const magazine=item=>weaponModel(item).filter(part=>part.slot==='magazine');
 assert(magazine(modified).length>0,'installed magazine must have visible geometry, including the pre-import fallback');
 assert.notDeepEqual(magazine(modified),magazine(gun));
 assert(!keys(modified).some(key=>key.endsWith('/magazine__glock_17')));
 const base=item=>weaponModel(item).filter(part=>!part.slot||part.slot==='action');
 assert.deepEqual(base(modified),base(gun));
 const snapshot=structuredClone(modified);weaponModel(modified,'magazine',.4,{reload:.5,mode:'swap'});
 assert.deepEqual(modified,snapshot,'rendering must not mutate ammunition or item ownership');
 const ak=createWeapon('weapon_akm',false),railed=replacePreview(ak,'mount','ak_mount');
 const optic=replacePreview(railed,'mount.optic','red_dot');
 assert(weaponModel(optic).some(part=>part.slot==='mount.optic'));
 assert(!weaponModel(railed).some(part=>part.slot==='mount.optic'));
 assert.deepEqual(base(optic),base(ak));
});
test('AK-74M and AKM use versioned PBR meshes for their complete base builds',()=>{
 const shared=MODEL_ASSETS.weapon_ak_common;
 assert(shared?.url.includes('weapon_ak_common.glb?v='),'shared AK Blender asset is missing');
 for(const id of ['weapon_ak74m','weapon_akm']){
  const asset=MODEL_ASSETS[id];assert(asset?.url.includes('?v='),id);
  assert.equal(asset.url,shared.url,id+' must use the shared Blender body');
  const data=glb('public'+asset.url.split('?')[0]);
  assert(data.images?.length&&data.materials?.some(m=>m.pbrMetallicRoughness?.baseColorTexture),id+' has no PBR surface');
  assert(data.meshes.every(m=>m.primitives.every(p=>p.attributes.TEXCOORD_0!==undefined)),id+' has no UVs');
  for(const group of asset.groups)for(const lod of [0,1])assert(data.nodes.some(n=>n.extras?.assetKey===group&&n.extras?.lod===lod),id+'/'+group+'/'+lod);
  const gun=createWeapon(id,false);
  assert(weaponModel(gun).every(p=>p.asset),id+' default build has untextured parts');
  for(const part of weaponModel(gun)) {
   if(!part.slot||part.slot==='action')assert.equal(part.asset?.weapon,'weapon_ak_common',id+' protected body/action must stay in their shared source');
   else if(MODULE_MODEL_ASSETS[gun.children[part.slot]?.def])assert.equal(part.asset?.weapon,MODULE_MODEL_ASSETS[gun.children[part.slot].def].asset);
   else assert.equal(part.asset?.weapon,'weapon_ak_common',id+' unchanged legacy module must retain its source');
  }
 }
 assert(shared.groups.includes('magazine__ak545_30'),'shared model is missing the AK-74M magazine');
 assert(shared.groups.includes('magazine__ak762_30'),'shared model is missing the AKM magazine');
});
test('all 36 platforms and 202 selected modules resolve to versioned PBR meshes and both LODs',()=>{
 const weapons=Object.values(CATALOG).filter(d=>d.category==='weapon');
 const modules=Object.values(CATALOG).filter(d=>d.category==='module');
 assert.equal(weapons.length,36);assert.equal(modules.length,202);
 const checked=new Set();
 function checkAsset(id){
  if(checked.has(id))return;checked.add(id);
  const asset=MODEL_ASSETS[id];assert(asset?.url.includes('?v='),id);
  const data=glb('public'+asset.url.split('?')[0]),nodes=data.nodes.filter(n=>n.mesh!==undefined);
  assert(nodes.every(n=>n.extras?.assetKey),id+' must not contain accidental Blender scene objects');
  for(const key of asset.groups)for(const lod of [0,1])assert(nodes.some(n=>n.extras.assetKey===key&&n.extras.lod===lod),id+'/'+key+'/'+lod);
  assert(data.images?.length,id+' missing original PBR texture');
  assert(data.materials.some(m=>m.pbrMetallicRoughness?.baseColorTexture),id+' missing PBR color binding');
  assert(data.meshes.every(m=>m.primitives.every(p=>p.attributes.TEXCOORD_0!==undefined&&p.attributes.NORMAL!==undefined)),id+' missing UVs/normals');
 }
 for(const weapon of weapons){
  checkAsset(weapon.id);
  const asset=MODEL_ASSETS[weapon.id];
  if(!['weapon_akm','weapon_ak74m','weapon_glock17'].includes(weapon.id)){
   assert.equal(asset.frame,'meters');assert.deepEqual(new Set(asset.groups),new Set(['body','action']));
  }
  const gun=createWeapon(weapon.id,false),parts=weaponModel(gun);assert(parts.every(p=>p.asset),weapon.id+' unbound displayed geometry');
  for(const part of parts.filter(p=>p.asset?.first)){
   const binding=part.asset;checkAsset(binding.weapon);assert(MODEL_ASSETS[binding.weapon].groups.includes(binding.group),weapon.id+'/'+binding.group);
   if(part.slot&&part.slot!=='action'){
    const item=part.slot.split('.').reduce((item,key)=>item.children[key],gun),selected=MODULE_MODEL_ASSETS[item.def];
    assert.equal(binding.weapon,selected.asset);assert.equal(binding.group,selected.group);
   }
  }
 }
 assert.equal(Object.keys(MODULE_MODEL_ASSETS).length,202);
 for(const module of modules){const binding=MODULE_MODEL_ASSETS[module.id];assert(binding,module.id);checkAsset(binding.asset);assert(MODEL_ASSETS[binding.asset].groups.includes(binding.group),module.id);}
});
test('Glock runtime copy retains original embedded atlas bytes',()=>{
 const source=fs.readFileSync('art/Glock17_Gen4/Glock17_Gen4_LOD0.glb'), target=fs.readFileSync('public/assets/field-kit-051/weapon_glock17.glb');
 const a=glb('art/Glock17_Gen4/Glock17_Gen4_LOD0.glb'),b=glb('public/assets/field-kit-051/weapon_glock17.glb');
 const extract=(buffer,g)=>g.images.map(i=>{const view=g.bufferViews[i.bufferView];const start=28+buffer.readUInt32LE(12)+view.byteOffset;return buffer.subarray(start,start+view.byteLength);});
 const original=extract(source,a),runtime=extract(target,b);
 for(const pixels of original)assert(runtime.some(r=>pixels.equals(r)),'embedded Glock texture must be preserved exactly');
});

test('runtime attachment rest transforms agree with Blender export recipes',async()=>{
 const {model}=await import('../dist/src/rendering/math.js');
 const recipes=JSON.parse(fs.readFileSync('art/FieldKit051/recipes.json','utf8')).weapons;
 for(const [id,recipe] of Object.entries(recipes)){
  if(id==='weapon_ak_common')continue;
  for(const part of weaponModel(createWeapon(id,false), '', 0, {}, false)){
  if(!part.asset?.first||MODEL_ASSETS[part.asset.weapon].frame==='meters')continue;
  const expected=recipe.groups[part.asset.group].firstMatrix,actual=Array.from(model(part.p,part.s,part.r));
  for(let i=0;i<16;i++)assert(Math.abs(expected[i]-actual[i])<1e-6,id+'/'+part.asset.group+' matrix '+i);
  }
 }
});
