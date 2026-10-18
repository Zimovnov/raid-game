import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BUILD_VERSION} from '../dist/src/content/catalog.js';
const base='https://raid-game.ru';
const digest=data=>createHash('sha256').update(data).digest('hex');
const healthResponse=await fetch(base+'/health',{signal:AbortSignal.timeout(15000)});
assert.equal(healthResponse.status,200);
const health=await healthResponse.json();assert.equal(health.build,BUILD_VERSION);assert.equal(health.storageReady,true);
const manifest=JSON.parse(await fs.readFile(new URL('../dist-web/asset-manifest.json',import.meta.url),'utf8'));
let verified=0;
for(const asset of manifest.assets.filter(asset=>asset.path.startsWith('public/'))){
 const file=new URL('../dist-web/'+asset.path.slice(7),import.meta.url);
 assert.equal(digest(await fs.readFile(file)),asset.sha256,asset.path);verified++;
}
const home=await fetch(base+'/',{signal:AbortSignal.timeout(15000)});assert.equal(home.status,200);assert(home.headers.get('strict-transport-security'));
const html=await home.text();
const resources=[...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match=>match[1]))];
resources.push('/assets/art-overhaul/weapons/weapon_hk416a5.glb','/assets/art-overhaul/attachments/ak545_30.glb','/assets/art-overhaul/attachments-secondary/aug_guard.glb','/assets/art-overhaul/characters/face_00.glb','/assets/art-overhaul/fabrics/camo-atacs_fg.png','/assets/art-overhaul/fabrics/camo-multicam_black.png');
for(const url of resources){
 const response=await fetch(base+url,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,url);
 const expected=await fs.readFile(new URL('../dist-web'+url,import.meta.url));
 assert.equal(digest(Buffer.from(await response.arrayBuffer())),digest(expected),url);
}
assert.equal((await fetch(base+'/api/patches',{signal:AbortSignal.timeout(15000)})).status,401);
console.log(JSON.stringify({status:'PASSED',scope:'VPS public HTTPS/HTML/JS/CSS/sample art bytes and unauthenticated patch access; all public files checked on disk. Authenticated profile/WebSocket covered separately on a database copy. No real multiplayer gameplay claim.',health,publicAssetsVerified:verified,httpResources:resources},null,2));
