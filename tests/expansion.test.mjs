import { scavLoadout } from '../dist/src/content/scav-loadouts.js';
import { loadedRounds as botRounds, setLoadedRounds as botSetRounds } from '../dist/src/domain/ammunition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, WEAPONS, MODULES, LOOT } from '../dist/src/content/catalog.js';
import { WORKSHOP_PRESETS } from '../dist/src/content/presets.js';
import * as I from '../dist/src/domain/items.js';
import * as A from '../dist/src/domain/ammunition.js';
import * as P from '../dist/src/domain/profile.js';
import { geometry } from '../dist/src/rendering/geometry.js';
import { weaponModel, lootModel } from '../dist/src/rendering/models.js';
import { muzzlePoint } from '../dist/src/domain/weapon-pose.js';
import { weaponSound } from '../dist/src/audio/weapon-sound.js';
import { World } from '../dist/src/simulation/world.js';
import { Collision, Navigation, raySphere } from '../dist/src/simulation/collision.js';
import { findCover } from '../dist/src/simulation/cover.js';
import { uid, noInput, dist, norm, sub } from '../dist/src/domain/util.js';

const character = { name: 'Проверка Расширения', faction: 'BEAR', face: 0, outfit: 0 };
function arena() {
    return { id: uid(), name: 'Test only', theme: 'factory', size: [40, 40], ground: [.3,.3,.3], fog: [.7,.7,.7],
        duration: 600, boxes: [], surfaces: [], doors: [], loot: [], spawn: [[0,0,12],[3,0,12]], bots: [],
        exits: [], pois: [], signs: [] };
}
function steps(world, count) { for (let i = 0; i < count; i++) world.step(); }
function allIds(profile) { return [...profile.stash, ...I.flatGear(profile.gear)].flatMap(i => I.walk(i).map(n => n.item.id)); }
const signature = parts => JSON.stringify(parts.map(({shape,p,s,r,c}) => ({shape,p,s,r,c})));

for (const d of WEAPONS) test('authoritative fire, feed reload and snapshot retain the weapon: '+d.id, () => {
    const gear = P.emptyGear(); gear.primary = I.createWeapon(d.id);
    const gun = gear.primary, capacity = I.calculateStats(gun).capacity;
    if (A.detachable(gun)) { const spare = I.createItem(gun.children.magazine.def); spare.rounds = capacity; gear.bag.push(spare); }
    else gear.bag.push(I.createItem('ammo_'+d.ammo, 4));
    const world = new World(arena(), uid(), false, 11), a = world.addPlayer(uid(), character, gear);
    world.input(a.id, {...noInput(),seq:1,fire:true,aim:true}); world.step();
    world.input(a.id, {...noInput(),seq:2}); world.step();
    assert.equal(A.loadedRounds(a.gear.primary), capacity-1);
    assert.equal(world.events.filter(e => e.type === 'shot').length, 1);
    const beforeMagazine = a.gear.primary.children.magazine?.id;
    assert(world.action(a.id, {id:uid(),type:'reload'}).ok);
    assert(!world.action(a.id, {id:uid(),type:'reload'}).ok);
    steps(world, 170);
    assert.equal(A.loadedRounds(a.gear.primary), capacity+1);
    if (A.detachable(gun)) {
        assert.notEqual(a.gear.primary.children.magazine.id, beforeMagazine);
        assert(a.gear.bag.some(i => i.id === beforeMagazine && i.rounds === capacity-2));
    } else assert.equal(I.reserveAmmo(a.gear, d.ammo), 2);
    const snapshot = JSON.parse(JSON.stringify(world.snapshot()));
    P.validateEquipment(snapshot.players[0].gear);
    assert.deepEqual(I.presetOf(snapshot.players[0].gear.primary), I.presetOf(gun));
    assert(weaponModel(a.gear.primary, '', 0, {reload:.45,mode:A.detachable(gun)?'swap':'rounds'}).length > 8);
});

test('36 weapon render recipes and 180 loot appearances are not data-only catalogue entries', () => {
    assert.equal(WEAPONS.length, 36); assert.equal(MODULES.length,202); assert.equal(LOOT.length,180);
    assert.equal(new Set(WEAPONS.map(d => signature(weaponModel(I.createWeapon(d.id))))).size,36);
    for (const d of LOOT) {
        assert(d.description.length > 10 && d.spawnZones.length > 0 && d.price > 0);
        const parts = lootModel(I.createItem(d.id));
        assert(parts.length >= 2, d.id);
        for (const p of parts) assert([...p.p,...p.s,...p.c,...p.r].every(Number.isFinite),d.id);
    }
    for (const id of ['loot_food_drink_03','loot_food_drink_05','loot_medical_06']) assert.equal(CATALOG[id].effect,undefined);
    assert.notEqual(signature(lootModel(I.createItem('loot_electronics_04'))),signature(lootModel(I.createItem('loot_medical_09'))));
    assert.notEqual(signature(lootModel(I.createItem('loot_valuables_17'))),signature(lootModel(I.createItem('loot_valuables_16'))));
});

test('24 authored presets are valid; preview quotes never mutate money or inventory', () => {
    assert.equal(WORKSHOP_PRESETS.length,24);
    for (const example of WORKSHOP_PRESETS) {
        const p=P.newProfile(character); p.gear.primary=I.createWeapon(example.tree.def);
        const before=structuredClone(p), quote=P.quoteBuild(p,p.gear.primary,example.tree);
        assert.deepEqual(I.validateBuild(I.fromPreset(example.tree)),[],example.id);
        assert.deepEqual(I.validateBuild(quote.result),[],example.id);
        assert.deepEqual(p,before);
        assert(Number.isSafeInteger(quote.cost) && quote.cost>=0);
    }
});

test('owned-only preset fails atomically; actual missing parts can be bought and reused once', () => {
    let p=P.newProfile(character); p.cash=200000;
    const example=WORKSHOP_PRESETS.find(x=>x.id==='ak-control'), before=structuredClone(p);
    assert.throws(()=>P.applyBuild(p,p.gear.primary.id,example.tree,uid(),true)); assert.deepEqual(p,before);
    const quote=P.quoteBuild(p,p.gear.primary,example.tree), id=p.gear.primary.id;
    p=P.applyBuild(p,id,example.tree,'preset-purchase');
    assert.equal(p.cash,before.cash-quote.cost); assert.equal(P.applyBuild(p,id,example.tree,'preset-purchase'),p);
    const after=P.applyBuild(p,id,example.tree,'preset-owned',true); assert.equal(after.cash,p.cash);
    assert.deepEqual(new Set(allIds(after)),new Set(allIds(p)));
});

test('requirements, occupied mounting positions and platform variant reject invalid previews', () => {
    const base=I.createWeapon('weapon_m4a1');
    let long=I.replacePreview(base,'handguard','ar_long');
    assert.deepEqual(I.validateBuild(I.replacePreview(long,'handguard.grip','fore_bail')),[]);
    const short=I.replacePreview(base,'handguard','ar_short');
    assert(I.validateBuild(I.replacePreview(short,'handguard.grip','fore_bail')).length>0);
    long=I.replacePreview(long,'handguard.light','flashlight');
    assert(I.validateBuild(I.replacePreview(long,'handguard.laser','laser_dual')).some(x=>x.includes('позицию')));
    const mp5=I.replacePreview(I.createWeapon('weapon_mp5'),'mount','mp5_mount');
    assert(I.validateBuild(I.replacePreview(mp5,'mount.optic','scope6')).includes('Другой вариант платформы'));
});

test('100 sequential real build transactions reuse existing instances and ammunition', () => {
    let p=P.newProfile(character); p.cash=100000;
    p=P.applyBuild(p,p.gear.primary.id,I.presetOf(I.replacePreview(p.gear.primary,'stock','ak_skeleton')));
    const ids=new Set(allIds(p)), cash=p.cash, magazineId=p.gear.primary.children.magazine.id;
    for(let i=0;i<100;i++){
        p=P.applyBuild(p,p.gear.primary.id,I.presetOf(I.replacePreview(p.gear.primary,'stock',i%2?'ak_skeleton':'ak_stock')),'swap-'+i,true);
        assert.deepEqual(new Set(allIds(p)),ids); assert.equal(p.cash,cash);
        assert.equal(p.gear.primary.children.magazine.id,magazineId); assert.equal(A.loadedRounds(p.gear.primary),30);
    }
    // This checks domain lifetime, not WebGL/listener memory or browser performance.
    P.validateProfile(p);
});

test('all primitive normals point outward with finite non-degenerate triangles', () => {
    for (const shape of ['box','wedge','sphere','cone','cylinder']) {
        const v=geometry(shape).vertices, center=shape==='wedge'?[0,-.25,0]:[0,0,0];
        for (let i=0;i<v.length;i+=18) {
            const normal=Array.from(v.slice(i+3,i+6)); assert(Math.abs(Math.hypot(...normal)-1)<1e-5);
            const centroid=[0,1,2].map(k=>(v[i+k]+v[i+6+k]+v[i+12+k])/3-center[k]);
            assert(normal.reduce((n,x,k)=>n+x*centroid[k],0)>0,shape);
        }
    }
});

test('muzzle pose follows actual model length, side offset and view orientation', () => {
    const eye=[0,1.58,0], long=I.createWeapon('weapon_mosin9130'), short=I.createWeapon('weapon_pm');
    assert(dist(eye,muzzlePoint(long,eye,0,0,true))>dist(eye,muzzlePoint(short,eye,0,0,true))+.5);
    assert(muzzlePoint(short,eye,0,0,false)[0]>.2); assert.equal(muzzlePoint(short,eye,0,0,true)[0],0);
    const m=arena();m.boxes.push({id:'barrier',p:[0,1.3,-1],s:[2,2,.1],solid:true,color:[.3,.3,.3],kind:'wall'});
    const c=new Collision(m), muzzle=muzzlePoint(long,eye,0,0,true);
    assert(c.ray(eye,norm(sub(muzzle,eye)),dist(muzzle,eye)).t<dist(muzzle,eye));
});

test('new firearm families select distinct original procedural sound profiles', () => {
    assert.deepEqual(weaponSound('weapon_mp153'),weaponSound('weapon_mp133'));
    assert.notDeepEqual(weaponSound('weapon_mp153'),weaponSound('weapon_glock17'));
    assert.deepEqual(weaponSound('weapon_tt'),weaponSound('weapon_pm'));
    assert.notDeepEqual(weaponSound('weapon_sv98'),weaponSound('weapon_hk416a5'));
    assert(weaponSound('weapon_ak103',true).gain<weaponSound('weapon_ak103').gain);
});

test('unacceptable weapon purchase quantities roll back before any debit or new instance', () => {
    const p=P.newProfile(character),before=structuredClone(p);
    for(const qty of [-1,0,NaN,Infinity,1.5,2])assert.throws(()=>P.buy(p,'weapon_pm',qty));
    assert.deepEqual(p,before);
});

test('bot corpse keeps remaining magazine ammunition and is created once', () => {
    const w=new World(arena()), bot={id:'bot',name:'Дикий',p:[0,0,0],hp:5,...scavLoadout(0),mode:'attack',path:[]};
    botSetRounds(bot.weapon,3);
    w.killBot(bot);w.killBot(bot);assert.equal(w.containers.length,1);
    assert.equal(A.loadedRounds(w.containers[0].items[0]),3);
});

test('cover requires both a collision-obstructed view and a navigation path', () => {
    const m=arena(),empty=new Collision(m); assert.equal(findCover(empty,new Navigation(empty),[0,0,0],[0,0,-10]),null);
    m.boxes.push({id:'cover',p:[4,1.5,0],s:[3,3,2],solid:true,color:[.3,.3,.3],kind:'wall'});
    const c=new Collision(m),nav=new Navigation(c),found=findCover(c,nav,[0,0,3],[4,0,-10]);
    assert(found);assert(found.path.length);assert(c.free(found.goal));
    assert(!c.visible([4,1.5,-10],[found.goal[0],found.goal[1]+1.5,found.goal[2]]));
});

test('bot damage agrees with the rendered ray instead of an unrelated chance roll', () => {
    const w=new World(arena(),uid(),false,17),p=P.newProfile(character),a=w.addPlayer(p.id,p.character,p.gear);
    const b={id:'aim-bot',name:'Дикий',p:[0,0,0],yaw:0,hp:75,mode:'attack',...scavLoadout(0),timer:0,target:a.id,goal:[0,0,0],path:[],lastSeen:[...a.p],memory:5,nextThink:999,voiceAt:0,shotAt:-100,style:0};
    w.bots.push(b);
    for(let n=0;n<150;n++){
        const previous=w.events.at(-1)?.seq||0;
        w.step();
        for(const e of w.events.filter(e=>e.seq>previous&&e.type==='shot'&&e.actor===b.id)){
            const d=norm(sub(e.to,e.p)),length=dist(e.to,e.p);
            const intersects=[[1.53,.22],[.97,.4],[.35,.3]].some(([h,r])=>raySphere(e.p,d,[a.p[0],a.p[1]+h,a.p[2]],r,length+.02)!==null);
            assert.equal(e.hit,intersects);
        }
    }
});
