import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createGameServer} from '../server/app.mjs';
test('staged deployment serves assets/health while preventing new economy writes',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'raid-admission-')),flag=path.join(dir,'admission.closed'),origin='http://127.0.0.1:18351';
 writeFileSync(flag,'release acceptance');
 const app=createGameServer({dbFile:path.join(dir,'test.sqlite'),staticDir:path.resolve('dist-web'),origins:[origin],admissionFile:flag});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base='http://127.0.0.1:'+app.server.address().port;
 try{
  assert.equal((await (await fetch(base+'/health')).json()).admissionClosed,true);
  assert.equal((await fetch(base+'/')).status,200);
  const register=()=>fetch(base+'/api/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'staged_test',password:'acceptance-test-password',character:{name:'Проверка',faction:'BEAR'}})});
  assert.equal((await register()).status,503);
  assert.equal(app.accounts.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,0);
  rmSync(flag);assert.equal((await register()).status,201);
  assert.equal((await (await fetch(base+'/health')).json()).admissionClosed,false);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
