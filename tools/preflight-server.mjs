import assert from 'node:assert/strict';
import {once} from 'node:events';
import path from 'node:path';
import WebSocket from 'ws';
import {createGameServer} from '../server/app.mjs';
import {BUILD_VERSION,CONTENT_VERSION} from '../dist/src/content/catalog.js';
const dbFile=process.argv[2];
if(!dbFile?.endsWith('.preflight.sqlite'))throw Error('Only a disposable .preflight.sqlite copy is accepted');
const origin='http://127.0.0.1:18352';
const app=createGameServer({dbFile,staticDir:path.resolve(import.meta.dirname,'../dist-web'),origins:[origin]});
let ws;
try{
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base='http://127.0.0.1:'+app.server.address().port;
 const password='local-acceptance-'+Date.now(),username='accept_'+Date.now();
 const register=await fetch(base+'/api/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,password,character:{name:'Приёмка',faction:'BEAR'}})});assert.equal(register.status,201);
 const body=await register.json();assert.equal(body.profile.schema,3);
 const cookie=register.headers.get('set-cookie').split(';')[0];
 const me=await fetch(base+'/api/me',{headers:{Cookie:cookie}});assert.equal(me.status,200);
 ws=new WebSocket(base.replace('http:','ws:')+'/ws',{headers:{Origin:origin,Cookie:cookie}});
 await once(ws,'open');const hello=once(ws,'message');ws.send(JSON.stringify({type:'HELLO',build:BUILD_VERSION,content:CONTENT_VERSION}));
 const [packet]=await Promise.race([hello,new Promise((_,reject)=>setTimeout(()=>reject(Error('HELLO timeout')),5000).unref())]);assert.equal(JSON.parse(packet).type,'HELLO');
 console.log(JSON.stringify({preflight:'PASSED',scope:'SQLite copy: registration, profile read, current-build WebSocket handshake',build:BUILD_VERSION}));
}finally{ws?.terminate();await app.close();}
