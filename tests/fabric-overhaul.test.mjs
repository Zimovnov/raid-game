import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CAMOUFLAGES,defaultAppearance,isAppearance} from '../dist/src/content/apparel.js';
import {FABRIC_ASSETS,FABRIC_NORMAL} from '../dist/src/content/fabric-assets.js';
test('49 fabric tiles preserve existing IDs and validate all new saved appearances',()=>{
 assert.equal(CAMOUFLAGES.length,49);assert.equal(Object.keys(FABRIC_ASSETS).length,49);
 for(const id of ['olive','ranger_green','coyote','khaki','wolf_gray','graphite','navy','foliage','emr','flora','berezka','partizan','woodland','multicam','tropic','arid','dcu','digital_desert','digital_forest','winter'])assert(CAMOUFLAGES.some(c=>c.id===id));
 const hashes=new Set();
 for(const c of CAMOUFLAGES){
  const a=defaultAppearance();for(const key of ['jacketCamo','trouserCamo','rigCamo','backpackCamo'])a[key]=c.id;assert(isAppearance(a),c.id+' must survive save validation');
  const url=FABRIC_ASSETS[c.id];assert(url?.startsWith('/assets/art-overhaul/fabrics/'),c.id);
  const bytes=fs.readFileSync('public'+url.split('?')[0]);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),1024);assert.equal(bytes.readUInt32BE(20),1024);
  const hash=createHash('sha256').update(bytes).digest('hex');assert.equal(url.split('?v=')[1],hash.slice(0,12));assert(!hashes.has(hash),'different fabrics must not reuse identical pixels');hashes.add(hash);
 }
 const normal=fs.readFileSync('public'+FABRIC_NORMAL.split('?')[0]);assert.equal(normal.readUInt32BE(16),1024);
});
