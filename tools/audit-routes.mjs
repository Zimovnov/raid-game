/** Actual character controller paths; combat disabled. No teleporting during a route. */
import fs from 'node:fs';
import {World} from '../dist/src/simulation/world.js';
import {RAID_MAPS} from '../dist/src/content/maps.js';
import {newProfile} from '../dist/src/domain/profile.js';
import {uid,noInput,dist,distXZ} from '../dist/src/domain/util.js';
const started=new Date().toISOString(),results=[];
const hero=newProfile({name:'Аудит маршрутов',faction:'BEAR',face:0,outfit:0});
function walk(w,a,end) {
 const path=w.navigation.path(a.p,end);
 if(!path.length && distXZ(a.p,end)>2.2)throw Error('No navigation path');
 let ticks=0,stuck=0,last=[...a.p];
 for(const point of path)while(distXZ(a.p,point)>.23){
  if(++ticks>18000)throw Error('Timed out '+JSON.stringify({at:a.p,point}));
  const yaw=Math.atan2(-(point[0]-a.p[0]),-(point[2]-a.p[2]));
  for(const d of w.collision.doors)if(!d.open&&distXZ(a.p,d.p)<2.3)w.action(a.id,{id:uid(),type:'interact',target:d.id});
  w.input(a.id,{...noInput(),seq:a.input.seq+1,yaw,forward:1});w.step(1/30);
  if(!a.p.every(Number.isFinite)||a.hp!==100||a.status!=='active'||a.recoveries)throw Error('Invalid state or recovery during route');
  if(distXZ(a.p,last)<.004)stuck++;else stuck=0;
  last=[...a.p];if(stuck>100)throw Error('Stuck '+JSON.stringify({at:a.p,point}));
 }
 w.input(a.id,{...noInput(),seq:a.input.seq+1});w.step();
 return ticks;
}
for(const map of RAID_MAPS){
 const w=new World(map,'route-audit-'+map.id,false,42,true),a=w.addPlayer(hero.id,hero.character,hero.gear);
 const targets=[...map.loot.map(t=>({...t,type:'loot'})),...map.exits.map(t=>({...t,type:'exit'})),...(map.activators||[]).map(t=>({...t,type:'control'})),...map.pois.map(t=>({...t,type:'poi'}))];
 for(let spawn=0;spawn<map.spawn.length;spawn++)for(const target of targets){
  w.collision.doors=map.doors.map(d=>({...d}));
  a.p=[...map.spawn[spawn]];a.safePosition=[...a.p];a.recoveries=0;a.vy=0;a.grounded=true;a.stamina=100;a.visited=[];
  a.input={...noInput(),seq:a.input.seq+1};
  const record={map:map.id,spawn,target:target.id,type:target.type};
  try {
   let destination=target.p;
   if(target.type!=='exit'){
    const candidates=[...w.navigation.nodes.values()].filter(n=>target.type==='poi'
      ? distXZ(n.p,target.p)<6.5&&Math.abs(n.p[1]-target.p[1])<.6
      : dist([n.p[0],n.p[1]+1.58,n.p[2]],target.p)<2.9&&w.collision.visible([n.p[0],n.p[1]+1.58,n.p[2]],target.p));
    candidates.sort((x,y)=>dist(x.p,target.p)-dist(y.p,target.p));
    const found=candidates.find(n=>w.navigation.reachable(a.p,n.p));
    if(!found)throw Error('No visible reachable interaction approach');destination=found.p;
   }
   record.ticks=walk(w,a,destination);record.final=[...a.p];
   if(!w.collision.free(a.p))throw Error('Final capsule intersects obstacle');
   if(target.type==='exit'){
    if(distXZ(a.p,target.p)>target.radius||Math.abs(a.p[1]-target.p[1])>1.2)throw Error('Not in exit zone');
   }else if(target.type==='poi'){
    if(distXZ(a.p,target.p)>=7||Math.abs(a.p[1]-target.p[1])>.6||!a.visited.includes(target.id))throw Error('POI visit was not registered on its physical floor');
   }else{
    const eye=[a.p[0],a.p[1]+1.58,a.p[2]];
    if(dist(eye,target.p)>3.2||!w.collision.visible(eye,target.p))throw Error('Cannot interact from final position');
   }
   record.status='PASS';
  }catch(e){record.status='FAIL';record.error=e.message;console.log('FAIL',record);}
  results.push(record);
 }
 console.log(map.id,results.filter(r=>r.map===map.id&&r.status==='PASS').length+'/'+results.filter(r=>r.map===map.id).length);
}
const report={scope:'Fixed-step real character controller, doors opened using production interaction, both starts to all loot/exits/controls/POIs. POIs must register on their physical floor. No combat, no WebGL, no network. Spawn reset between independent cases only; no teleport along paths.',started,finished:new Date().toISOString(),total:results.length,passed:results.filter(r=>r.status==='PASS').length,results};
report.status=report.passed===report.total?'PASS':'FAIL';
fs.mkdirSync('artifacts/current',{recursive:true});fs.writeFileSync('artifacts/current/route-audit.json',JSON.stringify(report,null,2));console.log(report.status,report.passed+'/'+report.total);if(report.status==='FAIL')process.exitCode=1;
