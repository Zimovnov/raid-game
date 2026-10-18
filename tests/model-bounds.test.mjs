import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL_ASSETS, MODULE_MODEL_ASSETS } from '../dist/src/content/model-assets.js';
import { validateModelAssetFrame } from '../dist/src/rendering/asset-frame.js';
import { presentationBounds, lootGroundOffset } from '../dist/src/rendering/model-bounds.js';
import { createWeapon, replacePreview } from '../dist/src/domain/items.js';
import { lootModel, weaponModel } from '../dist/src/rendering/models.js';

const near = (a,b) => a.forEach((n,i) => assert(Math.abs(n-b[i])<1e-6, `${a} != ${b}`));
const visible = () => ({shape:'box',p:[0,1,0],s:[.2,.4,.2],r:[0,0,0],c:[1,1,1]});

test('authored bounds reject invalid metadata without changing legacy normalized manifests', () => {
 const definition={url:'fixture',frame:'meters',groups:['body'],groupBounds:{body:{min:[-.2,-.6,-.1],max:[.2,.3,.4]}}};
 validateModelAssetFrame(definition);
 validateModelAssetFrame({url:'legacy',groups:['body']});
 for(const bounds of [{min:[],max:[]},{min:[0,Infinity,0],max:[1,2,3]},{min:[0,NaN,0],max:[1,2,3]},{min:[0,3,0],max:[1,2,3]}]) assert.throws(()=>validateModelAssetFrame({...definition,groupBounds:{body:bounds}}), /group bounds/);
 assert.throws(()=>validateModelAssetFrame({...definition,frame:undefined}),/metre coordinate/);
 assert.throws(()=>validateModelAssetFrame({...definition,groupBounds:{unknown:definition.groupBounds.body}}),/group bounds/);
});

test('bounds compose authored rotation, socket pose and loot scale once, and suppress replaced fallback parts', () => {
 const definition={url:'fixture',frame:'meters',groups:['body'],groupBounds:{body:{min:[-.2,-.6,-.1],max:[.2,.3,.4]}},groupTransforms:{body:{p:[0,.25,0],s:[1,1,1],r:[0,0,Math.PI/2]}}};
 MODEL_ASSETS.bounds_fixture=definition;
 const part={...visible(),asset:{weapon:'bounds_fixture',group:'body',first:true,transform:{p:[1,.5,2],s:[.8,.8,.8],r:[Math.PI/2,0,0]}}};
 const duplicate={...visible(),p:[0,-20,0],asset:{...part.asset,first:false}};
 try {
  const bounds=presentationBounds([part,duplicate],()=>true);
  near(bounds.min,[.76,.18,2.04]);near(bounds.max,[1.48,.58,2.36]);
  near(presentationBounds([part],()=>false).min,[-.1,.8,-.1]);
  assert.equal(presentationBounds([{...part,assetOnly:true}],()=>false),null);
  assert(presentationBounds([part,duplicate],()=>false).min[1]<-19,'failed GLB keeps all visible fallback pieces');
 } finally {delete MODEL_ASSETS.bounds_fixture;}
});

test('dropped weapon follows loaded magazine geometry while preserving body, ammunition and fallback placement', () => {
 const gun=createWeapon('weapon_mpx',false), before=structuredClone(gun), original=weaponModel(gun);
 const ids=[gun.children.magazine.def,'mpx_20'], previous=ids.map(id=>MODULE_MODEL_ASSETS[id]);
 MODEL_ASSETS.bounds_magazines={url:'fixture',frame:'meters',groups:ids,groupBounds:Object.fromEntries(ids.map((id,i)=>[id,{min:[-.025,i?-.18:-.6,-.04],max:[.025,.08,.04]}]))};
 try {
  ids.forEach(id=>MODULE_MODEL_ASSETS[id]={asset:'bounds_magazines',group:id});
  const body=parts=>parts.filter(p=>!p.slot||p.slot==='action');
  assert.deepEqual(body(weaponModel(gun)),body(original));
  const parts=lootModel(gun), unchanged=structuredClone(parts), short=lootModel(replacePreview(gun,'magazine','mpx_20'));
  assert.equal(lootGroundOffset(parts,()=>false),0);
  near([presentationBounds(parts,()=>false).min[1]],[0]);
  const offset=lootGroundOffset(parts,()=>true);
  assert(offset>0,'long authored magazine extends below old fallback');
  near([presentationBounds(parts,()=>true).min[1]+offset],[0]);
  assert.notEqual(lootGroundOffset(short,()=>true),offset,'selected magazine changes grounding');
  assert.equal(lootGroundOffset(parts,()=>false),0,'availability loss restores the prior fallback');
  assert.deepEqual(parts,unchanged);assert.deepEqual(gun,before);
 } finally {
  delete MODEL_ASSETS.bounds_magazines;
  ids.forEach((id,i)=>{if(previous[i])MODULE_MODEL_ASSETS[id]=previous[i];else delete MODULE_MODEL_ASSETS[id];});
 }
});
