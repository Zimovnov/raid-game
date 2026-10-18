import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {once} from 'node:events';
import WebSocket from 'ws';
import {AccountStore} from '../server/store.mjs';
import {BUILD_VERSION,CONTENT_VERSION} from '../dist/src/content/catalog.js';
if(process.argv[2]!=='--temporary-production-acceptance')throw Error('Explicit temporary production acceptance flag required');
const store=new AccountStore('/var/lib/raid-game/raid-game.sqlite',{recoverInterrupted:false});
const base='https://raid-game.ru',username='accept_'+randomUUID().replaceAll('-','').slice(0,12),password=randomBytes(32).toString('base64url');
const existing=store.db.prepare('SELECT id,profile_json FROM accounts ORDER BY id').all();
const fingerprint=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
let created,headers,ws,passed=false;
try{
 created=await store.register({username,password,character:{name:'Приёмка обновления',faction:'BEAR'}});
 const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username,password}),signal:AbortSignal.timeout(15000)});assert.equal(login.status,200);
 const body=await login.json();assert.equal(body.profile.schema,3);
 headers={Origin:base,Cookie:login.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':body.csrf};
 assert.equal((await fetch(base+'/api/me',{headers,signal:AbortSignal.timeout(15000)})).status,200);
 ws=new WebSocket('wss://raid-game.ru/ws',{headers});await once(ws,'open');
 const hello=once(ws,'message');ws.send(JSON.stringify({type:'HELLO',build:BUILD_VERSION,content:CONTENT_VERSION}));
 const [packet]=await Promise.race([hello,new Promise((_,reject)=>setTimeout(()=>reject(Error('Live HELLO timeout')),10000).unref())]);assert.equal(JSON.parse(packet).type,'HELLO');
 ws.close();await once(ws,'close');ws=undefined;
 assert.equal((await fetch(base+'/api/logout',{method:'POST',headers,signal:AbortSignal.timeout(15000)})).status,200);headers=undefined;passed=true;
}finally{
 ws?.terminate();
 if(headers)await fetch(base+'/api/logout',{method:'POST',headers,signal:AbortSignal.timeout(10000)}).catch(()=>{});
 if(created){
  const row=store.db.prepare('SELECT username FROM accounts WHERE id=?').get(created.accountId);
  assert.equal(row?.username,username,'Only this newly created acceptance account may be cleaned up');
  store.db.prepare('DELETE FROM accounts WHERE id=? AND username=?').run(created.accountId,username);
 }
 const after=store.db.prepare('SELECT id,profile_json FROM accounts ORDER BY id').all();assert.equal(fingerprint(after),fingerprint(existing),'Existing profiles must remain identical');
 store.close();
}
assert(passed);
console.log(JSON.stringify({status:'PASSED',build:BUILD_VERSION,scope:'Actual public HTTPS login/profile/WSS HELLO/logout; one temporary acceptance account removed. No multiplayer gameplay claim.',existingProfilesPreserved:existing.length,temporaryAccountRemoved:true}));
