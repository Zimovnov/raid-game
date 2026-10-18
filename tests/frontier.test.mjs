import test from 'node:test';
import assert from 'node:assert/strict';
import { SCAV_WEAPONS, scavLoadout, reloadScav, scavReloadSeconds } from '../dist/src/content/scav-loadouts.js';
import { CATALOG } from '../dist/src/content/catalog.js';
import { loadedRounds, discharge, detachable } from '../dist/src/domain/ammunition.js';
import { validateBuild, calculateStats, walk } from '../dist/src/domain/items.js';
import { RAID_MAPS } from '../dist/src/content/maps.js';
import { World } from '../dist/src/simulation/world.js';
import { Collision, Navigation, doorObstacle } from '../dist/src/simulation/collision.js';
const rounds=l=>loadedRounds(l.weapon)+l.supplies.reduce((n,i)=>n+(CATALOG[i.def].category==='ammo'?i.qty:i.rounds),0);
for(const [index,id] of SCAV_WEAPONS.entries()) {
    test('scav firing, reloading and corpse preserve exact item IDs and ammunition: '+id,()=>{
        const loadout=scavLoadout(index),total=rounds(loadout),ids=walk(loadout.weapon).map(n=>n.item.id).concat(loadout.supplies.map(i=>i.id));
        assert.equal(loadout.weapon.def,id);assert.deepEqual(validateBuild(loadout.weapon),[]);
        assert(scavReloadSeconds(loadout.weapon)>=1.5);
        let fired=0;
        for(let i=0;i<500;i++) {
            if(discharge(loadout.weapon))fired++;
            else if(!reloadScav(loadout.weapon,loadout.supplies))break;
            assert.equal(rounds(loadout)+fired,total);
            if(detachable(loadout.weapon))assert.equal(loadout.weapon.rounds,0);
        }
        assert.equal(fired,total);assert.equal(loadedRounds(loadout.weapon),0);
        assert.equal(reloadScav(loadout.weapon,loadout.supplies),false);
        const map={...RAID_MAPS[0],id:'scav-corpse',size:[20,20],boxes:[],doors:[],surfaces:[],bots:[],loot:[]};
        const world=new World(map,'conservation',false,12,true);
        const bot={id:'scav',name:'Дикий',p:[0,0,0],mode:'patrol',path:[],...loadout};
        world.killBot(bot);world.killBot(bot);
        assert.equal(world.containers.length,1);
        const corpse=world.containers[0],weapon=corpse.items.find(i=>i.def===id);
        assert.equal(weapon.id,loadout.weapon.id);assert.equal(loadedRounds(weapon),0);
        const actual=corpse.items.flatMap(i=>walk(i).map(n=>n.item.id));
        for(const itemId of ids) if(detachable(weapon)||itemId!==ids.at(-1))assert(actual.includes(itemId));
        assert.equal(new Set(actual).size,actual.length);
        assert.equal(calculateStats(weapon).capacity,calculateStats(scavLoadout(index).weapon).capacity);
    });
}
for(const map of RAID_MAPS) test('expanded map has populated outer districts and peripheral exits: '+map.id,()=>{
    const original={factory:[124,106],city:[144,132],village:[158,144],park:[172,154],mall:[120,108]}[map.id];
    assert.deepEqual(map.size,original.map(v=>v*4));assert.equal(map.exits.length,9);assert.equal(map.exits.filter(e=>!e.requires).length,6);
    assert.equal(map.pois.filter(p=>p.id.startsWith('district-')).length,12);assert(map.loot.length>=134);assert.equal(map.bots.length,24);
    assert(map.loot.filter(p=>Math.abs(p.p[0])>original[0]/2||Math.abs(p.p[2])>original[1]/2).length>=96);
    for(const e of map.exits.filter(e=>e.requires))assert(map.activators.some(a=>a.id===e.requires));
    assert(map.duration>=2400);
});
test('open door broad phase includes the swung leaf across the narrow original axis',()=>{
    const map={...RAID_MAPS[0],id:'open-leaf',size:[20,20],boxes:[],surfaces:[],doors:[{id:'door',p:[1,1.33,-2],s:[3.2,2.65,.24],axis:'x',name:'door',open:true}]};
    const c=new Collision(map),nav=new Navigation(c);
    assert.equal(c.clearGroundEdge([-2,0,0],[0,0,0]),false);
    const a=nav.closest([-2,0,0]),b=nav.closest([0,0,0]);
    assert(!a.neighbors.includes(b.key));assert(c.free(a.p));assert(c.free(b.p));
    const leaf=doorObstacle(map.doors[0]);assert(leaf.s[2]>3);
});
test('spatial collision matches complete obstacle scan on deterministic capsule samples',()=>{
    let seed=12345;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    for(const map of RAID_MAPS){
        const c=new Collision(map);
        for(let n=0;n<700;n++){
            const p=[(rand()-.5)*map.size[0],0,(rand()-.5)*map.size[1]];
            if(map.surfaces.some(s=>Math.abs(s.x-p[0])<s.w/2+1&&Math.abs(s.z-p[2])<s.d/2+1))continue;
            const r=.33,h=1.72;
            const brute=Math.abs(p[0])+r<=map.size[0]/2&&Math.abs(p[2])+r<=map.size[1]/2&&!c.obstacles().some(b=>{
                if(h<=b.p[1]-b.s[1]/2+.02||0>=b.p[1]+b.s[1]/2-.02)return false;
                const dx=Math.max(0,Math.abs(p[0]-b.p[0])-b.s[0]/2),dz=Math.max(0,Math.abs(p[2]-b.p[2])-b.s[2]/2);
                return dx*dx+dz*dz<r*r;
            });
            assert.equal(c.free(p),brute,map.id+':'+p);
        }
    }
});

test('ten frontier assignments require extraction and pay only once on schema-3 profiles',async()=>{
    const {QUESTS}=await import('../dist/src/content/catalog.js');
    const P=await import('../dist/src/domain/profile.js');
    const quests=QUESTS.filter(q=>Number(q.id.slice(6))>=23);assert.equal(quests.length,10);
    for(const quest of quests){
        const map=RAID_MAPS.find(m=>m.id===quest.map);assert(map.pois.some(p=>p.id===quest.target));
        for(const outcome of ['dead','extracted']){
            let p=P.questAction(P.newProfile({name:'Дальний обход',faction:'BEAR',face:0,outfit:0}),quest.id);
            p=P.activateRaid(P.prepareRaid(p,'frontier-'+quest.id,quest.map));
            const result={id:'result-'+quest.id,raidId:p.pending.raidId,playerId:p.id,outcome,map:quest.map,seconds:300,kills:0,gear:structuredClone(p.pending.gear),visited:[quest.target]};
            const q=P.applyResult(p,result);assert.equal(q.schema,3);assert.equal(P.applyResult(q,result),q);
            if(outcome==='dead'){assert.equal(q.quests[quest.id].progress,0);assert.throws(()=>P.questAction(q,quest.id));}
            else {const paid=P.questAction(q,quest.id);assert.equal(paid.cash,q.cash+quest.reward);assert.throws(()=>P.questAction(paid,quest.id));}
        }
    }
});

test('indexed navigation preserves exact nearest nodes including heights, ties and outside coordinates',()=>{
    for(const map of RAID_MAPS){
        const nav=new World(map,'nearest-'+map.id,false,606).navigation;
        const points=Array.from({length:40},(_,i)=>[(Math.sin(i*13.1)*.54)*map.size[0],i%4===0?4:0,Math.cos(i*7.7)*.54*map.size[1]]);
        points.push([0,0,0],[8,2,8],[-8,0,-8]);
        for(const p of points){
            let expected,best=Infinity;
            for(const n of nav.nodes.values()){
                const cost=Math.hypot(n.p[0]-p[0],n.p[2]-p[2])+Math.abs(n.p[1]-p[1])*5;
                if(cost<best){best=cost;expected=n;}
            }
            assert.equal(nav.closest(p)?.key,expected?.key,map.id+':'+p);
        }
    }
});
