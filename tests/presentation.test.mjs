import test from 'node:test';
import assert from 'node:assert/strict';
import { Controls } from '../dist/src/ui/input.js';
import { AudioEngine } from '../dist/src/audio/audio.js';
import { FootstepTracker } from '../dist/src/audio/footsteps.js';
import { Renderer } from '../dist/src/rendering/renderer.js';
import { characterModel } from '../dist/src/rendering/models.js';
import { weaponMotion, muzzleFlashModel } from '../dist/src/rendering/weapon-animation.js';
import { CATALOG, WEAPONS } from '../dist/src/content/catalog.js';
import { createItem, createWeapon } from '../dist/src/domain/items.js';
import { newProfile } from '../dist/src/domain/profile.js';
import { World } from '../dist/src/simulation/world.js';
import { DEFAULT_SETTINGS } from '../dist/src/persistence/store.js';

function globals(t, values) {
    for (const [key, value] of Object.entries(values)) {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
        t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
    }
}
function dispatch(target, type, data = {}) {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(data)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
    return event;
}
function controlsFixture(t) {
    const window = new EventTarget(), document = new EventTarget(), canvas = new EventTarget();
    let controls;
    t.after(() => controls?.dispose());
    document.pointerLockElement = null;
    document.hidden = false;
    document.exitPointerLock = () => { document.pointerLockElement = null; dispatch(document, 'pointerlockchange'); };
    canvas.requestPointerLock = () => { document.pointerLockElement = canvas; dispatch(document, 'pointerlockchange'); };
    globals(t, { window, document });
    const commands = [], state = { unlocked: 0 }, settings = structuredClone(DEFAULT_SETTINGS);
    controls = new Controls(canvas, () => settings, action => commands.push(action), () => state.unlocked++);
    controls.enabled = true;
    return { controls, settings, canvas, window, document, commands, state };
}

test('real keyboard handlers hold remapped slow movement and release it without issuing a command', t => {
    const f = controlsFixture(t);
    f.settings.bindings.slow = 'KeyZ';
    f.controls.lock();
    dispatch(f.window, 'keydown', { code: 'KeyW' });
    dispatch(f.window, 'keydown', { code: 'KeyZ' });
    dispatch(f.window, 'keydown', { code: 'KeyZ', repeat: true });
    assert.equal(f.controls.input().slow, true);
    assert.equal(f.controls.input().forward, 1);
    assert.deepEqual(f.commands, []);
    dispatch(f.window, 'keyup', { code: 'KeyZ' });
    assert.equal(f.controls.input().slow, false);
    assert.equal(f.controls.input().forward, 1);
});

test('reconnected controls continue after the server input sequence', t => {
    const f = controlsFixture(t);
    f.controls.syncSequence(500);
    f.controls.lock();
    dispatch(f.window, 'keydown', { code: 'KeyW' });
    const first = f.controls.input();
    assert.equal(first.seq, 501);
    assert.equal(first.forward, 1);
    f.controls.syncSequence(400);
    assert.equal(f.controls.input().seq, 502);
});

test('disabling controls clears held fire and aim even before pointer lock is released', t => {
    const f = controlsFixture(t);
    f.controls.lock();
    dispatch(f.window, 'mousedown', { button: 0 });
    dispatch(f.window, 'mousedown', { button: 2 });
    dispatch(f.window, 'keydown', { code: 'KeyW' });
    assert.equal(f.controls.input().fire, true);
    f.controls.enabled = false;
    assert.equal(f.controls.input().fire, false);
    assert.equal(f.controls.input().aim, false);
    f.controls.enabled = true;
    assert.equal(f.controls.input().fire, false);
    assert.equal(f.controls.input().forward, 0);
});

for (const cause of ['blur', 'hidden', 'unlock']) test('losing gameplay focus clears held movement and mouse buttons: ' + cause, t => {
    const f = controlsFixture(t);
    f.controls.lock();
    dispatch(f.window, 'keydown', { code: f.settings.bindings.slow });
    dispatch(f.window, 'keydown', { code: 'KeyW' });
    dispatch(f.window, 'mousedown', { button: 0 });
    if (cause === 'blur') dispatch(f.window, 'blur');
    if (cause === 'hidden') { f.document.hidden = true; dispatch(f.document, 'visibilitychange'); }
    if (cause === 'unlock') f.controls.unlock();
    f.controls.lock();
    assert.equal(f.controls.input().slow, false);
    assert.equal(f.controls.input().forward, 0);
    assert.equal(f.controls.input().fire, false);
});

test('unlocked menu clicks and text input never become gameplay input', t => {
    const f = controlsFixture(t);
    dispatch(f.window, 'mousedown', { button: 0 });
    const key = dispatch(f.window, 'keydown', { code: 'Space' });
    assert.equal(key.defaultPrevented, false);
    dispatch(f.window, 'keydown', { code: f.settings.bindings.inventory, target: { tagName: 'INPUT' } });
    dispatch(f.window, 'keydown', { code: f.settings.bindings.inventory, target: { isContentEditable: true } });
    assert.deepEqual(f.commands, []);
    f.controls.lock();
    assert.equal(f.controls.input().fire, false);
    assert.equal(f.controls.input().jump, false);
});

test('pointer lock handles sync errors, legacy error events and duplicate Promise rejection once', async t => {
    const f = controlsFixture(t);
    f.canvas.requestPointerLock = () => { throw Error('Denied'); };
    assert.doesNotThrow(() => f.controls.lock());
    assert.equal(f.state.unlocked, 1);
    let reject;
    f.canvas.requestPointerLock = () => new Promise((_, fail) => { reject = fail; });
    f.controls.lock();
    dispatch(f.document, 'pointerlockerror');
    reject(Error('Denied'));
    await Promise.resolve();
    assert.equal(f.state.unlocked, 2);
    f.controls.lock();
    f.controls.dispose();
    reject(Error('Late rejection after disposal'));
    await Promise.resolve();
    assert.equal(f.state.unlocked, 2);
});

test('footsteps require actual grounded travel and reject wall pressure, jumping and large corrections', () => {
    const steps = new FootstepTracker();
    assert.equal(steps.update('me', [0,0,0], true, false, false, false), null);
    for (let i=0;i<180;i++) assert.equal(steps.update('me',[0,0,0],true,true,false,false),null);
    assert.equal(steps.update('me',[1,1,0],false,true,false,false),null);
    assert.equal(steps.update('me',[1.5,0,0],true,false,false,false),null);
    assert.equal(steps.update('me',[20,0,0],true,false,false,false),null);
    const cue=steps.update('me',[21.5,0,0],true,false,false,false);
    assert(cue && cue.gain>0);
    assert.equal(steps.update('peer',[22,0,0],true,false,false,false),null);
    steps.reset();
    assert.equal(steps.update('peer',[23.5,0,0],true,false,false,false),null);
});

test('footstep count follows distance regardless of repeated render snapshots, with quieter slow/crouch sounds', () => {
    function count(repeats, quiet=false, crouch=false) {
        const tracker=new FootstepTracker(),cues=[];
        tracker.update('me',[0,0,0],true,false,quiet,crouch);
        for(let n=1;n<=100;n++)for(let frame=0;frame<repeats;frame++){
            const cue=tracker.update('me',[n*.15,0,0],true,false,quiet,crouch);
            if(cue)cues.push(cue);
        }
        return cues;
    }
    assert.deepEqual(count(1),count(6));
    const walk=count(1),slow=count(1,true),crouch=count(1,false,true);
    assert(walk.length>=9);
    assert(slow[0].gain<walk[0].gain/2);
    assert.equal(crouch[0].gain,slow[0].gain);
    assert.notEqual(walk[0].tone,walk[1].tone);
});

function audioFixture(t) {
    const records={contexts:[],nodes:[]};
    let audio;
    t.after(()=>audio?.dispose());
    const parameter=()=>({value:0,setValueAtTime(value){this.value=value;},setTargetAtTime(value){this.value=value;},exponentialRampToValueAtTime(value){this.value=value;}});
    const node=kind=>{
        const n={kind,disconnected:false,started:false,stopped:false,gain:parameter(),frequency:parameter(),playbackRate:parameter(),positionX:parameter(),positionY:parameter(),positionZ:parameter(),onended:null,connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}};
        records.nodes.push(n);return n;
    };
    class Context {
        state='running';currentTime=0;sampleRate=64;destination={};
        listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,parameter()]));
        constructor(){records.contexts.push(this);}
        createGain(){return node('gain');}createBiquadFilter(){return node('filter');}createPanner(){return node('panner');}createBufferSource(){return node('source');}createOscillator(){return node('oscillator');}
        createBuffer(){return {getChannelData:()=>new Float32Array(64)};}
        async resume(){this.state='running';}async close(){this.state='closed';}
    }
    globals(t,{AudioContext:Context,window:{}});
    const settings=structuredClone(DEFAULT_SETTINGS);
    audio=new AudioEngine(()=>settings);
    return {settings,audio,records};
}

test('audio caps concurrent effects, resets all active nodes, and can sound again after reset', async t => {
    const f=audioFixture(t);await f.audio.unlock();
    for(let n=0;n<60;n++)f.audio.event({seq:n,type:'shot',p:[0,1,0],def:'weapon_akm'},[0,1,0],null);
    assert.equal(f.records.nodes.filter(n=>n.kind==='source').length,28);
    f.audio.reset();
    const oldSources=f.records.nodes.filter(n=>['source','oscillator','filter','panner'].includes(n.kind));
    assert(oldSources.every(n=>n.disconnected));
    assert(oldSources.filter(n=>['source','oscillator'].includes(n.kind)).every(n=>n.stopped));
    f.audio.click();
    assert.equal(f.records.nodes.filter(n=>n.kind==='source').length,29);
    f.audio.dispose();
    await f.audio.unlock();
    assert.equal(f.records.contexts.length,1);
    assert.equal(f.records.contexts[0].state,'closed');
});

test('zero effects produces no quiet residual noise; audio starts at saved master volume', async t => {
    const f=audioFixture(t);f.settings.volume=.12;f.settings.effects=0;
    await f.audio.unlock();
    assert.equal(f.records.nodes[0].gain.value,.12);
    f.audio.click();f.audio.reload();
    f.audio.event({seq:1,type:'mechanic',text:'land-hard',p:[0,0,0]},[0,1,0],null);
    assert.equal(f.records.nodes.filter(n=>n.kind==='source').length,0);
    f.settings.effects=1;
    f.audio.click();
    assert.equal(f.records.nodes.filter(n=>n.kind==='source').length,1);
});

test('listener up vector stays perpendicular to look direction while looking up or down', async t => {
    const f=audioFixture(t);await f.audio.unlock();
    f.audio.listener([3,2,1],1.2,.9);
    const l=f.records.contexts[0].listener;
    const dot=l.forwardX.value*l.upX.value+l.forwardY.value*l.upY.value+l.forwardZ.value*l.upZ.value;
    assert(Math.abs(dot)<1e-12);
    assert.equal(l.positionX.value,3);
});

test('range reload uses loose-round animation for internal feeds and swap for detachable magazines', () => {
    for(const definition of WEAPONS){
        const gun=createWeapon(definition.id),range=weaponMotion(gun,{reload:.5,mode:'range'});
        if(CATALOG[gun.def].feed==='detachable'){
            assert(Math.hypot(...range.magazine)>.1,gun.def);
            assert.equal(range.round,false);
        }else{
            assert.deepEqual(range.magazine,[0,0,0],gun.def);
            assert.equal(range.magazineAngle,0);
            assert.equal(range.round,true);
        }
        const packing=weaponMotion(gun,{reload:.5,mode:'pack'});
        assert.equal(packing.magazineAngle,0,'packing must not detach '+gun.def);
    }
});

test('muzzle flash has finite short lifetime and suppressed flash is smaller on all weapon families', () => {
    for(const definition of WEAPONS){
        const gun=createWeapon(definition.id),flash=muzzleFlashModel(gun,0),quiet=muzzleFlashModel(gun,0,true);
        assert.equal(flash.length,2);
        assert(quiet[0].s[0]<flash[0].s[0]);
        for(const p of [...flash,...quiet])assert([...p.p,...p.s,...p.r,...p.c].every(Number.isFinite));
        for(const age of [-1,.2,NaN,Infinity])assert.deepEqual(muzzleFlashModel(gun,age),[]);
    }
});

test('crouched third-person body matches lower head/torso and preserves face proportions', () => {
    for(let face=0;face<12;face++){
        const c={name:'Тест',faction:'BEAR',face,outfit:face},standing=characterModel(c),crouched=characterModel(c,0,0,false,true);
        const head=standing.find(p=>p.slot==='face:head'),lowerHead=crouched.find(p=>p.slot==='face:head');
        const torso=crouched.find(p=>p.slot==='jacket:body');
        assert(head&&lowerHead&&torso,'semantic body pieces must exist regardless of garment detail count');
        assert(Math.abs(head.p[1]-1.53)<.22,'head stays within standing hitbox');
        assert(Math.abs(lowerHead.p[1]-1.02)<1e-9,'crouched head matches simulation head hitbox');
        assert.deepEqual(lowerHead.s,head.s);
        assert(Math.abs(torso.p[1]-.66)<1e-9,'crouched torso matches simulation body hitbox');
        for(const p of crouched)assert([...p.p,...p.s,...p.r,...p.c].every(Number.isFinite));
        assert.deepEqual(characterModel(c,0,0,true,true),characterModel(c,0,0,true,false));
    }
});

// A CPU adapter checks Renderer lifecycle/finite matrices. It is not a GPU or browser test.
function rendererFixture(t) {
    const matrices=[];
    const gl=new Proxy({}, {get:(_,key)=>{
        if(key==='getShaderParameter'||key==='getProgramParameter')return ()=>true;
        if(key==='uniformMatrix4fv')return (_location,_transpose,matrix)=>matrices.push([...matrix]);
        if(typeof key==='string'&&key.startsWith('create'))return ()=>({});
        if(typeof key==='string'&&key.toUpperCase()===key)return 1;
        return ()=>{};
    }});
    const canvas={getContext:()=>gl,width:0,height:0,clientWidth:1280,clientHeight:720};
    globals(t,{devicePixelRatio:1});
    const renderer=new Renderer(canvas),character={name:'Тест',faction:'BEAR',face:0,outfit:0};
    const map={id:'presentation-arena',name:'Test',subtitle:'',size:[48,48],theme:'factory',ground:[.4,.4,.4],fog:[.7,.7,.7],duration:600,boxes:[],surfaces:[],doors:[],loot:[],spawn:[[0,0,12],[2,0,12]],bots:[],exits:[],pois:[],signs:[]};
    const p=newProfile(character),world=new World(map,'render-one',false,23),actor=world.addPlayer(p.id,p.character,p.gear);
    renderer.setMap(map);t.after(()=>renderer.dispose());
    const view={yaw:0,pitch:0,fov:78,aim:false,bob:true,quality:'high',dt:1/60};
    return {renderer,canvas,matrices,map,actor,world,view};
}

test('Renderer CPU lifecycle starts a second raid on same map without stale camera, ADS or event IDs', t => {
    const f=rendererFixture(t),old=f.world.snapshot();
    old.events=[{seq:90,type:'hit',p:[0,1,-3]},{seq:91,type:'shot',p:[0,1,0],actor:f.actor.id,def:f.actor.gear.primary.def}];
    f.renderer.raid(old,f.actor.id,{...f.view,aim:true,dt:.1});
    assert(f.renderer.aim>0);
    assert.equal(f.renderer.marks.length,1);
    const next=structuredClone(old);next.raidId='render-two';next.time=0;next.players[0].p=[10,0,8];
    next.events=[{seq:1,type:'shot',p:[10,1,8],actor:f.actor.id,def:f.actor.gear.primary.def}];
    f.renderer.setMap(f.map);
    f.renderer.raid(next,f.actor.id,f.view);
    assert.equal(f.renderer.aim,0);
    assert.equal(f.renderer.lastEvent,1);
    assert.equal(f.renderer.marks.length,0);
    assert.deepEqual(f.renderer.smoothed.get(f.actor.id),[10,0,8]);
    assert(f.renderer.recoil>0,'first shot of the second raid must be recognized');
    assert(f.matrices.flat().every(Number.isFinite));
});

test('Renderer CPU lifecycle expires visual flashes even if network snapshot stops advancing', t => {
    const f=rendererFixture(t),snapshot=f.world.snapshot();
    snapshot.events=[{seq:1,type:'shot',p:[0,1,12],actor:f.actor.id,def:f.actor.gear.primary.def}];
    f.renderer.raid(snapshot,f.actor.id,f.view);
    assert.equal(f.renderer.shotFlashes.size,1);
    for(let frame=0;frame<30;frame++)f.renderer.raid(snapshot,f.actor.id,f.view);
    assert.equal(f.renderer.shotFlashes.size,0);
});

test('Renderer CPU lifecycle produces finite projection for a collapsed canvas', t => {
    const f=rendererFixture(t);f.canvas.clientWidth=0;f.canvas.clientHeight=0;
    f.renderer.raid(f.world.snapshot(),f.actor.id,f.view);
    assert.equal(f.canvas.width,1);assert.equal(f.canvas.height,1);
    assert(f.matrices.flat().every(Number.isFinite));
});

test('Renderer CPU aiming exposes scope only after ADS and follows the surviving spectator target', t => {
    const f=rendererFixture(t),snapshot=f.world.snapshot(),me=snapshot.players[0];
    me.gear.primary=createWeapon('weapon_m4a1');
    me.gear.primary.children.optic=createItem('scope4');
    f.renderer.raid(snapshot,f.actor.id,{...f.view,aim:true});
    assert.equal(f.renderer.aiming,true);
    assert.equal(f.renderer.scopeActive,false,'mask must wait for the view-model ADS transition');
    for(let frame=0;frame<60;frame++)f.renderer.raid(snapshot,f.actor.id,{...f.view,aim:true});
    assert.equal(f.renderer.scopeActive,true);
    const peer=structuredClone(me);peer.id='surviving-peer';peer.input.aim=true;
    me.status='dead';me.gear.primary=null;snapshot.players.push(peer);
    for(let frame=0;frame<60;frame++)f.renderer.raid(snapshot,f.actor.id,f.view);
    assert.equal(f.renderer.aiming,true);
    assert.equal(f.renderer.scopeActive,true,'spectator mask must use the living player optic');
    peer.input.aim=false;
    for(let frame=0;frame<60;frame++)f.renderer.raid(snapshot,f.actor.id,f.view);
    assert.equal(f.renderer.scopeActive,false);
});
