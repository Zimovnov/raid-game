import { scavReloadSeconds } from '../content/scav-loadouts.js';
import { viewWeaponOffset } from '../domain/weapon-pose.js';
import { pickGeometry } from './picking.js';
import { handsModel, muzzleFlashModel, weaponMotion, type WeaponPose } from './weapon-animation.js';
import { CATALOG } from '../content/catalog.js';
import { weaponLayout } from './weapon-bases.js';
import type { Character, Color, Item, MapDef, Part, Shape, Snapshot, Vec3 } from '../domain/types.js';
import { identity, lookAt, model, multiply, perspective, transform, VIEWMODEL_NEAR, WORLD_NEAR, type Mat4 } from './math.js';
import { geometry } from './geometry.js';
import { characterModel, lootModel, mapModel, weaponModel } from './models.js';
import { lootGroundOffset } from './model-bounds.js';
import { weaponSightHeight } from '../content/weapon-layouts.js';
import { normalizeAppearance } from '../content/apparel.js';
import { heldWeaponMatrix } from './held-weapon.js';
import { add, clamp, direction, distXZ, lerp, rgb, viewedActor } from '../domain/util.js';
import { calculateStats } from '../domain/items.js';
import { Collision, doorObstacle } from '../simulation/collision.js';
import { BabylonBridge } from './babylon-bridge.js';
const vertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;
layout(location=2) in mat4 aModel;layout(location=6) in vec4 aColor;
uniform mat4 uViewProjection;out vec3 vWorld;out vec3 vNormal;out vec4 vColor;
void main(){vec4 world=aModel*vec4(aPos,1.);vWorld=world.xyz;
vNormal=normalize(mat3(aModel)* (aNormal / vec3(max(dot(aModel[0].xyz,aModel[0].xyz),.000001),max(dot(aModel[1].xyz,aModel[1].xyz),.000001),max(dot(aModel[2].xyz,aModel[2].xyz),.000001))));
vColor=aColor;gl_Position=uViewProjection*world;}`;
const fragment = `#version 300 es
precision highp float;in vec3 vWorld;in vec3 vNormal;in vec4 vColor;
uniform vec3 uEye;uniform vec3 uFog;uniform float uFogNear;uniform vec3 uLightPos[2];uniform vec3 uLightDir[2];uniform float uLightOn[2];out vec4 outColor;
void main(){vec3 n=normalize(vNormal);float sunlight=max(dot(n,normalize(vec3(-.5,.9,.35))),0.);
float ambient=.38+.19*(n.y*.5+.5);vec3 c=vColor.rgb*(ambient+sunlight*.53);
for(int i=0;i<2;i++){vec3 ray=vWorld-uLightPos[i];float len=length(ray);float cone=smoothstep(.88,.975,dot(normalize(ray),normalize(uLightDir[i])));c+=vColor.rgb*vec3(1.,.9,.7)*uLightOn[i]*cone*max(dot(n,-normalize(ray)),.15)*3.5/(1.+len*.08+len*len*.008);}
// Original procedural materials: no external images, UV atlas or texture requests.
vec2 plane=abs(n.y)>.65?vWorld.xz:abs(n.x)>.65?vWorld.zy:vWorld.xy;
float material=-vColor.a;float detail=1.;
if(material>.5 && material<1.5){
 vec2 cell=vec2(plane.x/.95+mod(floor(plane.y/.26),2.)*.5,plane.y/.26);
 vec2 edge=min(fract(cell),1.-fract(cell));vec2 aa=max(fwidth(cell),vec2(.005));
 float brick=smoothstep(.025,.025+aa.x,edge.x)*smoothstep(.035,.035+aa.y,edge.y);
 detail=mix(.72,1.035,brick);
}else if(material<2.5 && material>1.5){
 vec2 cell=plane/vec2(3.8,2.4),edge=min(fract(cell),1.-fract(cell));
 detail=.94+.06*smoothstep(.004,.012,min(edge.x,edge.y));
}else if(material<3.5 && material>2.5){
 float seam=smoothstep(.01,.045,min(fract(plane.x/.24),1.-fract(plane.x/.24)));
 detail=.85+.13*seam+.025*sin(plane.y*35.+sin(plane.x*18.));
}else if(material<4.5 && material>3.5){
 // Fade subpixel grain before it aliases into broad moving bands on distant roads.
 vec2 frequency=vec2(34.,39.);
 float grain=1.-smoothstep(.8,3.14,max(fwidth(plane).x*frequency.x,fwidth(plane).y*frequency.y));
 detail=.97+.035*sin(plane.x*frequency.x)*sin(plane.y*frequency.y)*grain;
}else if(material<5.5 && material>4.5){
 vec2 c=plane/.85,e=min(fract(c),1.-fract(c));
 detail=.8+.2*smoothstep(.008,.032,min(e.x,e.y));
}else if(material>5.5){detail=.96+.04*sin(plane.x*.58)*sin(plane.y*.77);}
c*=detail;
c+=vColor.rgb*max(vColor.a,0.);
float fog=smoothstep(uFogNear,uFogNear+105.,distance(vWorld,uEye));c=mix(c,uFog,fog);c=pow(max(c,vec3(0)),vec3(.90));outColor=vec4(c,1.);}`;
const textVertex = `#version 300 es
precision highp float;layout(location=0) in vec2 aPos;uniform mat4 uMatrix;out vec2 uv;void main(){uv=vec2(aPos.x+.5,.5-aPos.y);gl_Position=uMatrix*vec4(aPos.x,aPos.y,0.,1.);}`;
const textFragment = `#version 300 es
precision mediump float;in vec2 uv;uniform sampler2D uTexture;out vec4 c;void main(){c=texture(uTexture,uv);if(c.a<.01)discard;}`;
interface Batch {
    vao: WebGLVertexArrayObject;
    instances: WebGLBuffer;
    vertices: WebGLBuffer;
    count: number;
    size: number;
}
interface Draw {
    part: Part;
    parent: Mat4;
}
interface Sign {
    texture: WebGLTexture;
    p: Vec3;
    yaw: number;
}
const workshopBackdrop = (character = false): Part[] => [
    { shape: 'box', p: [0, character ? -.075 : -.58, 0], s: [16, .15, 16], r: [0, 0, 0], c: rgb('#151c18') },
    { shape: 'box', p: [0, .5, -6], s: [16, 8, .1], r: [0, 0, 0], c: rgb('#101815') },
    ...[-2, -1, 0, 1, 2].map(x => ({ shape: 'box' as const, p: [x, .2, -5.94] as Vec3, s: [.01, 3, .02] as Vec3, r: [0, 0, 0] as Vec3, c: rgb('#27352a') }))
];
export class Renderer {
    setPatchSource(source: (id: string) => Promise<Blob | null>) { this.bridge?.setPatchSource(source); }
    clearPatch(id: string) { this.bridge?.clearPatch(id); }
    readonly gl!: WebGL2RenderingContext;
    private program!: WebGLProgram;
    private textProgram!: WebGLProgram;
    private shapes = new Map<Shape, Batch>();
    private staticBatches = new Map<Shape, {
        buffer: WebGLBuffer;
        count: number;
    }>();
    private signs: Sign[] = [];
    private textVao!: WebGLVertexArrayObject;
    private textBuffer!: WebGLBuffer;
    private bridge: BabylonBridge | null = null;
    private scavParts(gun: Item): Part[] {
        let parts=this.botWeaponParts.get(gun.def);
        if(!parts){parts=weaponModel(gun);this.botWeaponParts.set(gun.def,parts);}
        return parts;
    }
    private botWeaponParts = new Map<string, Part[]>();
    private map: MapDef | null = null;
    private collision: Collision | null = null;
    private staticParts: Part[] = [];
    private dynamic: Draw[] = [];
    private vp = identity();
    private eye: Vec3 = [0, 0, 0];
    private fog: Color = [.12, .15, .14];
    private flashPos: Vec3[] = [[0, 0, 0], [0, 0, 0]];
    private flashDir: Vec3[] = [[0, 0, -1], [0, 0, -1]];
    private flashOn = [0, 0];
    private smoothed = new Map<string, Vec3>();
    private marks: {
        p: Vec3;
        born: number;
    }[] = [];
    private shotFlashes = new Map<string, { born: number; suppressed: boolean }>();
    private lastEvent = 0;
    private aim = 0;
    private recoil = 0;
    private sprint = 0;
    private landing = 0;
    private raidId = '';
    private cameraActorId = '';
    private animationTime = 0;
    private effectTime = 0;
    private stridePhase = 0;
    private strideAmount = 0;
    private cameraPosition: Vec3 | null = null;
    scopeActive = false;
    aiming = false;
    orbit = { yaw: 1.1, pitch: .22, distance: 1.8 };
    selection = '';
    explode = 0;
    private previewParts: Part[] = [];
    metrics = { drawCalls: 0, triangles: 0, instances: 0, glBuffers: 0, glTextures: 0, frames: 0, frameTimes: [] as number[] };
    constructor(readonly canvas: HTMLCanvasElement, readonly backend: 'legacy' | 'babylon' = 'legacy') {
        if (backend === 'babylon') {
            this.bridge = new BabylonBridge(canvas);
            return;
        }
        const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
        if (!gl)
            throw Error('Нужен браузер с WebGL2. Включите аппаратное ускорение в Chrome или Edge.');
        this.gl = gl;
        this.program = this.makeProgram(vertex, fragment);
        this.textProgram = this.makeProgram(textVertex, textFragment);
        for (const shape of ['box', 'cylinder', 'sphere', 'cone', 'wedge', 'plane'] as Shape[]) {
            const geo = geometry(shape), vao = gl.createVertexArray()!, vertices = gl.createBuffer()!, instances = gl.createBuffer()!;
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
            gl.bufferData(gl.ARRAY_BUFFER, geo.vertices, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
            this.bindInstances(instances);
            this.shapes.set(shape, { vao, vertices, instances, count: geo.count, size: 0 });
        }
        this.textVao = gl.createVertexArray()!;
        this.textBuffer = gl.createBuffer()!;
        gl.bindVertexArray(this.textVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, -.5, .5, -.5, .5, .5, -.5, -.5, .5, .5, -.5, .5]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        this.metrics.glBuffers = 11;
    }
    private makeProgram(vs: string, fs: string): WebGLProgram { const gl = this.gl, p = gl.createProgram()!; for (const [type, source] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            throw Error(gl.getShaderInfoLog(s) || 'Ошибка шейдера');
        gl.attachShader(p, s);
        gl.deleteShader(s);
    } gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(p) || 'Ошибка WebGL'); return p; }
    private bindInstances(buffer: WebGLBuffer) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, buffer); for (let i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(2 + i);
        gl.vertexAttribPointer(2 + i, 4, gl.FLOAT, false, 80, i * 16);
        gl.vertexAttribDivisor(2 + i, 1);
    } gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 80, 64); gl.vertexAttribDivisor(6, 1); }
    private data(draws: Draw[]): Float32Array { const a = new Float32Array(draws.length * 20); for (let i = 0; i < draws.length; i++) {
        const { part: p, parent } = draws[i];
        a.set(multiply(parent, model(p.p, p.s, p.r)), i * 20);
        a.set([...p.c, p.material ? -p.material : p.emissive || 0], i * 20 + 16);
    } return a; }
    private resetRaid(raidId = '', time = 0) {
        this.raidId = raidId;
        this.animationTime = time;
        this.effectTime = 0;
        this.cameraActorId = '';
        this.cameraPosition = null;
        this.smoothed.clear();
        this.marks = [];
        this.shotFlashes.clear();
        this.lastEvent = 0;
        this.aim = this.recoil = this.sprint = this.landing = this.stridePhase = this.strideAmount = 0;
        this.scopeActive = this.aiming = false;
    }
    private backdropCharacter = false;
    setMap(map: MapDef | null, character = false) {
        if (this.bridge) {
            if (this.map?.id === map?.id && this.staticParts.length && this.backdropCharacter === character) return;
            this.resetRaid();
            this.map = map;
            this.collision = map ? new Collision(map) : null;
            this.backdropCharacter = character;
            this.staticParts = map ? mapModel(map) : workshopBackdrop(character);
            this.bridge.setMap(map);
            this.metrics.glTextures = map?.signs.length || 0;
            return;
        }
        if (this.map?.id === map?.id && this.staticBatches.size && this.backdropCharacter === character)
            return;
        const gl = this.gl;
        for (const b of this.staticBatches.values())
            gl.deleteBuffer(b.buffer);
        this.staticBatches.clear();
        for (const s of this.signs)
            gl.deleteTexture(s.texture);
        this.signs = [];
        this.resetRaid();
        this.map = map;
        this.collision = map ? new Collision(map) : null;
        this.backdropCharacter = character;
            this.staticParts = map ? mapModel(map) : workshopBackdrop(character);
        for (const shape of this.shapes.keys()) {
            const arr = this.staticParts.filter(p => p.shape === shape && !p.babylonOnly).map(part => ({ part, parent: identity() }));
            if (arr.length) {
                const buffer = gl.createBuffer()!;
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, this.data(arr), gl.STATIC_DRAW);
                this.staticBatches.set(shape, { buffer, count: arr.length });
            }
        }
        for (const s of map?.signs || []) {
            const c = document.createElement('canvas');
            c.width = 1024;
            c.height = 160;
            const ctx = c.getContext('2d')!;
            ctx.fillStyle = s.text.startsWith('ВЫХОД') ? '#476247' : '#35433e';
            ctx.fillRect(0, 0, 1024, 160);
            ctx.strokeStyle = '#b0b59b';
            ctx.lineWidth = 6;
            ctx.strokeRect(6, 6, 1012, 148);
            ctx.fillStyle = '#eeead8';
            ctx.font = 'bold 49px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.text, 512, 82, 965);
            const texture = gl.createTexture()!;
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            this.signs.push({ texture, p: s.p, yaw: s.yaw });
        }
        this.metrics.glBuffers = 11 + this.staticBatches.size;
        this.metrics.glTextures = this.signs.length;
    }
    private add(parts: Part[], parent = identity()) { for (const part of parts)
        if(this.bridge || (!part.babylonOnly && !part.assetOnly)) this.dynamic.push({ part, parent }); }
    private begin(eye: Vec3, target: Vec3, fov: number, fog: Color, quality: 'low' | 'high', near = VIEWMODEL_NEAR) {
        if (this.bridge) {
            this.bridge.begin(eye, target, fov, fog, quality, near);
            this.eye = eye; this.fog = fog;
            this.vp = multiply(perspective(fov, Math.max(1, this.canvas.clientWidth) / Math.max(1, this.canvas.clientHeight), near), lookAt(eye, target));
            this.dynamic = []; this.metrics.drawCalls = this.metrics.triangles = this.metrics.instances = 0;
            this.flashOn = [0, 0];
            return;
        }
        const gl = this.gl, dpr = Math.min(devicePixelRatio || 1, quality === 'low' ? 1 : 1.4), w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
        gl.clearColor(...fog, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.eye = eye;
        this.fog = fog;
        this.vp = multiply(perspective(fov, w / h, near), lookAt(eye, target));
        this.dynamic = [];
        this.metrics.drawCalls = 0;
        this.metrics.triangles = 0;
        this.metrics.instances = 0;
        this.flashOn = [0, 0];
    }
    workshop(gun: Item | null, character: Character | null, quality: 'low' | 'high' = 'high', equipment?: Pick<import('../domain/types.js').Equipment, 'armor' | 'helmet'>, pose: 'idle' | 'walk' | 'crouch' = 'idle', time = 0) {
        this.setMap(null, !!character);
        const o = this.orbit, focus: Vec3 = character ? [0, pose === 'crouch' ? .63 : .86, 0] : [0, -.04, -.13], dist = character ? o.distance * 1.65 : o.distance;
        const eye: Vec3 = [Math.cos(o.yaw) * Math.cos(o.pitch) * dist, Math.sin(o.pitch) * dist + focus[1], Math.sin(o.yaw) * Math.cos(o.pitch) * dist + focus[2]];
        this.begin(eye, focus, 43, [.105, .13, .12], quality);
        this.previewParts = [];
        if (character)
            this.add(characterModel(character, time, pose === 'walk' ? 1 : 0, false, pose === 'crouch', equipment, { gun: gun || undefined, relaxed: !gun }));
        if (gun) {
            this.previewParts = weaponModel(gun, this.selection, this.explode);
            const parent = character ? heldWeaponMatrix(gun, {}, pose === 'crouch', 0, time, pose === 'walk' ? 1 : 0) : identity();
            if (!this.explode && this.bridge?.akmn.available(gun)) this.bridge.akmn.show(parent, {}, false);
            else this.add(this.previewParts, parent);
        }
        this.draw();
    }
    raid(snapshot: Snapshot, id: string, view: {
        yaw: number;
        pitch: number;
        fov: number;
        aim: boolean;
        bob: boolean;
        quality: 'low' | 'high';
        dt: number;
    }) {
        const start = performance.now(), me = snapshot.players.find(a => a.id === id);
        if (!me || !this.map)
            return;
        if (this.raidId !== snapshot.raidId) this.resetRaid(snapshot.raidId, snapshot.time);
        const dt = clamp(view.dt, 0, .1);
        this.effectTime += dt;
        // Interpolate short visual intervals between authoritative snapshots only.
        this.animationTime = Math.max(snapshot.time, Math.min(this.animationTime + dt, snapshot.time + .075));
        const cameraActor = viewedActor(snapshot, id)!;
        const active = cameraActor.status === 'active', own = cameraActor.id === id;
        if (this.cameraActorId !== cameraActor.id) {
            this.cameraActorId = cameraActor.id;
            this.cameraPosition = [...cameraActor.p];
            this.aim = this.recoil = this.sprint = this.landing = this.stridePhase = this.strideAmount = 0;
        }
        const yaw = own ? view.yaw : cameraActor.yaw, pitch = own ? view.pitch : cameraActor.pitch;
        const smooth = this.smoothed.get(cameraActor.id) || [...cameraActor.p] as Vec3;
        const t = 1 - Math.exp(-dt * (own ? 24 : 12));
        for (let j = 0; j < 3; j++)
            smooth[j] = lerp(smooth[j], cameraActor.p[j], t);
        this.smoothed.set(cameraActor.id, smooth);
        const eye: Vec3 = [smooth[0], smooth[1] + (cameraActor.input.crouch ? 1.07 : 1.58), smooth[2]];
        const gun = cameraActor.gear[cameraActor.active], stats = gun ? calculateStats(gun) : null;
        const aiming = active && (own ? view.aim : cameraActor.input.aim) && !cameraActor.reload && !cameraActor.inspect && !cameraActor.search && !cameraActor.use;
        this.aim = lerp(this.aim, aiming ? 1 : 0, 1 - Math.exp(-dt / (stats?.ads || .2) * 3));
        this.aiming = aiming;
        this.scopeActive = active && this.aim > .93 && (stats?.zoom || 1) > 2;
        const fov = view.fov * (1 - this.aim * (1 - 1 / (stats?.zoom || 1.08))) * (1 - this.aim * .08);
        this.begin(eye, add(eye, direction(yaw, pitch)), fov, this.map.fog, view.quality, WORLD_NEAR);
        if (this.collision)
            for (const d of this.collision.doors)
                d.open = snapshot.doors[d.id] ?? d.open;
        const elapsed = this.animationTime, ahead = elapsed - snapshot.time;
        for (const event of snapshot.events) {
            if (event.seq <= this.lastEvent) continue;
            this.lastEvent = event.seq;
            if (event.type === 'hit') this.marks.push({ p: event.p, born: elapsed });
            if (event.type === 'shot' && event.actor) {
                this.shotFlashes.set(event.actor, { born: this.effectTime, suppressed: !!event.suppressed });
                if (event.actor === cameraActor.id) this.recoil = Math.min(.12, this.recoil + .018 * (stats?.recoil || 1));
            }
            if (event.type === 'mechanic' && event.actor === cameraActor.id && (event.text === 'land' || event.text === 'land-hard'))
                this.landing = event.text === 'land-hard' ? .07 : .035;
        }
        for (const [actorId, flash] of this.shotFlashes) if (this.effectTime-flash.born > .12) this.shotFlashes.delete(actorId);
        for (const a of snapshot.players) {
            if (a.id === cameraActor.id && active)
                continue;
            if (a.status === 'extracted')
                continue;
            const prev = this.smoothed.get(a.id) || [...a.p] as Vec3;
            for (let j = 0; j < 3; j++)
                prev[j] = lerp(prev[j], a.p[j], 1 - Math.exp(-dt * 12));
            this.smoothed.set(a.id, prev);
            const parent = model(prev, [1, 1, 1], [0, a.yaw, 0]);
            const otherGun = a.gear[a.active];
            const moving = Math.hypot(a.input.forward, a.input.right);
            const otherPose: WeaponPose = { reload: a.reload ? 1 - Math.max(0, a.reload - ahead) / (a.reloadDuration || 1) : 0, mode: a.reloadMode, shotAge: elapsed - a.lastShot, empty: a.reloadEmpty, inspect: a.inspect ? 1 - Math.max(0, a.inspect - ahead) / 1.8 : 0 };
            this.add(characterModel(a.character, elapsed, moving, a.status === 'dead' || a.status === 'missing', a.input.crouch, a.gear, { gun: otherGun || undefined, weaponPose: otherPose, pitch: a.pitch, relaxed: !otherGun }), parent);
            if (otherGun && a.status === 'active') {
                const gunParent = multiply(parent, heldWeaponMatrix(otherGun, otherPose, a.input.crouch, a.pitch, elapsed, moving));
                this.add(weaponModel(otherGun, '', 0, otherPose), gunParent);
                const flash = this.shotFlashes.get(a.id);
                if (flash) this.add(muzzleFlashModel(otherGun, this.effectTime-flash.born, flash.suppressed), gunParent);
            }
        }
        for (const b of snapshot.bots) {
            if (distXZ(b.p, eye) > 145)
                continue;
            const prev = this.smoothed.get(b.id) || [...b.p] as Vec3;
            for (let j = 0; j < 3; j++)
                prev[j] = lerp(prev[j], b.p[j], 1 - Math.exp(-dt * 12));
            this.smoothed.set(b.id, prev);
            const parent = model(prev, [1, 1, 1], [0, b.yaw, 0]), moving = b.path.length ? 1 : 0;
            const botPose: WeaponPose = { reload: b.mode === 'reload' ? 1 - b.timer / scavReloadSeconds(b.weapon) : 0, mode: 'swap', shotAge: elapsed - b.shotAt };
            this.add(characterModel({ name: b.name, faction: 'BEAR', face: b.style, outfit: b.style }, elapsed, moving, b.mode === 'dead', false, undefined, { gun: b.weapon, weaponPose: botPose }), parent);
            if (b.mode !== 'dead') {
                const gunParent = multiply(parent, heldWeaponMatrix(b.weapon, botPose, false, 0, elapsed, moving));
                this.add(b.mode === 'reload' ? weaponModel(b.weapon, '', 0, botPose) : this.scavParts(b.weapon), gunParent);
                const flash = this.shotFlashes.get(b.id);
                if (flash) this.add(muzzleFlashModel(b.weapon, this.effectTime-flash.born, flash.suppressed), gunParent);
            }
        }
        for (const d of this.map.doors) {
            const pose=doorObstacle({...d,open:snapshot.doors[d.id] ?? d.open});
            this.add([{shape:'box',p:pose.p,s:pose.s,r:[0,0,0],c:rgb('#4b6257')}]);
        }
        for (const c of this.map.activators || []) {
            const on=snapshot.activated?.includes(c.id);
            this.add([{shape:'box',p:c.p,s:[.38,.45,.22],r:[0,0,0],c:rgb('#465354')},
                {shape:'sphere',p:[c.p[0],c.p[1]+.06,c.p[2]+.12],s:[.075,.075,.04],r:[0,0,0],c:on?rgb('#8ac487'):rgb('#d8a95b'),emissive:.2}]);
        }
        for (const c of snapshot.containers) {
            if (!c.items.length || distXZ(c.p, eye) > 65)
                continue;
            const parts = lootModel(c.items[0]);
            const offset = this.bridge ? lootGroundOffset(parts, (id, group) => this.bridge!.models.hasGroup(id, group)) : 0;
            this.add(parts, model([c.p[0], (this.collision?.floor(c.p,0) || 0)+.009+offset,c.p[2]], [1,1,1]));
        }
        for (const e of this.map.exits) {
            this.add([{ shape: 'cylinder', p: [e.p[0], e.p[1] + .012, e.p[2]], s: [e.radius * 2, .018, e.radius * 2], r: [0, 0, 0], c: e.requires && !snapshot.activated?.includes(e.requires) ? rgb('#816740') : rgb('#496f51'), emissive: .08 }]);
        }
        this.marks = this.marks.filter(m => elapsed - m.born < 35).slice(-90);
        for (const m of this.marks)
            this.add([{ shape: 'sphere', p: m.p, s: [.045, .045, .045], r: [0, 0, 0], c: rgb('#1d2826') }]);
        snapshot.players.filter(a => a.status === 'active' && a.light).slice(0, 2).forEach((a, i) => { this.flashOn[i] = 1; this.flashPos[i] = [a.p[0], a.p[1] + (a.input.crouch ? .90 : 1.4), a.p[2]]; this.flashDir[i] = direction(a.yaw, a.pitch); });
        for (const a of snapshot.players.filter(a => a.status === 'active' && a.laser))
            if (this.collision) {
                const o: Vec3 = [a.p[0], a.p[1] + (a.input.crouch ? 1.07 : 1.58), a.p[2]], d = direction(a.yaw, a.pitch), len = this.collision.ray(o, d, 70).t;
                const p = add(o, d.map(v => v * (len - .025)) as Vec3);
                this.add([{ shape: 'sphere', p, s: [.046, .046, .046], r: [0, 0, 0], c: [1, .03, .015], emissive: 1 }]);
            }
        this.draw();
        this.recoil *= Math.exp(-dt * 10);
        this.landing *= Math.exp(-dt * 12);
        const sprinting = active && (cameraActor.sprinting ?? (cameraActor.input.sprint && !cameraActor.input.slow && !cameraActor.input.crouch && !aiming && !cameraActor.input.fire && !cameraActor.reload && !cameraActor.inspect && !cameraActor.use && !cameraActor.search && cameraActor.stamina > 3));
        const traveled = this.cameraPosition ? distXZ(cameraActor.p, this.cameraPosition) : 0;
        this.cameraPosition = [...cameraActor.p];
        if (active && cameraActor.grounded && traveled > .0001 && traveled < 2) {
            this.stridePhase += traveled * (sprinting ? 5 : 6);
            this.strideAmount = Math.min(1, this.strideAmount + traveled * 2);
        } else this.strideAmount *= Math.exp(-dt * 6);
        this.sprint = lerp(this.sprint, sprinting && this.strideAmount > .01 ? 1 : 0, 1 - Math.exp(-dt * 10));
        // View-model shares the exact geometry tree with the workbench and remote player.
        if (gun && active && !this.scopeActive) {
            if (!this.bridge) this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
            this.dynamic = [];
            this.vp = multiply(perspective(fov, this.canvas.width / this.canvas.height, VIEWMODEL_NEAR), lookAt(eye, add(eye, direction(yaw, pitch))));
            const sway = view.bob ? Math.sin(this.stridePhase) * this.strideAmount * (cameraActor.input.slow || cameraActor.input.crouch ? .0025 : .007 + this.sprint * .008) * (1-this.aim*.85) : 0;
            const reloading = cameraActor.reload > 0;
            const cam = model(eye, [1, 1, 1], [pitch, yaw, 0]);
            const optic = gun.children.optic || gun.children.mount?.children.optic;
            const layout = weaponLayout(CATALOG[gun.def].shape);
            const aimHeight = weaponSightHeight(layout, !!optic, !!gun.children.mount?.children.optic);
            const pose:WeaponPose={reload:reloading?1-Math.max(0,cameraActor.reload-ahead)/(cameraActor.reloadDuration || 1):0,mode:cameraActor.reloadMode,shotAge:elapsed-cameraActor.lastShot,inspect:cameraActor.inspect?1-Math.max(0,cameraActor.inspect-ahead)/1.8:0,empty:cameraActor.reloadEmpty};
            const imported = !!this.bridge?.akmn.available(gun);
            const motion=weaponMotion(gun,pose), aim=(reloading || cameraActor.inspect)?0:this.aim;
            // Authored reload/inspect owns the body on this rig. Recoil, sway and
            // sprint stay in the existing controller, with no second body motion.
            if (imported) { motion.body=[0,0,0]; motion.rotation=[0,0,0]; }
            const viewOffset = viewWeaponOffset(gun);
            const placement=model([viewOffset[0]*(1-aim)+motion.body[0]+this.sprint*.035,viewOffset[1]*(1-aim)-aimHeight*aim+motion.body[1]+sway-this.sprint*.11-(view.bob?this.landing:0),viewOffset[2]+this.recoil+motion.body[2]+this.sprint*.06], [1,1,1],[motion.rotation[0]-.32*this.sprint,motion.rotation[1]+.08*this.sprint,motion.rotation[2]+.12*this.sprint]);
            if (imported) this.bridge!.akmn.show(multiply(cam, placement), pose, true, cameraActor.character);
            else {
                this.add(weaponModel(gun, '', 0, pose), multiply(cam, placement));
                this.add(handsModel(gun,pose,cameraActor.character.outfit,cameraActor.character.face,normalizeAppearance(cameraActor.character.appearance,cameraActor.character.faction,cameraActor.character.outfit)),multiply(cam,placement));
            }
            const flash = this.shotFlashes.get(cameraActor.id);
            if (flash) this.add(muzzleFlashModel(gun, this.effectTime-flash.born, flash.suppressed),multiply(cam,placement));
            if (this.bridge) this.bridge.camera.minZ = VIEWMODEL_NEAR;
            this.draw(false);
        }
        const ms = performance.now() - start;
        this.metrics.frames++;
        this.metrics.frameTimes.push(ms);
        if (this.metrics.frameTimes.length > 600)
            this.metrics.frameTimes.shift();
    }
    diagnostics() {
        const scene = this.bridge?.scene;
        return scene ? { camera: scene.activeCamera?.position.asArray(), active: scene.getActiveMeshes().length, models: [...this.bridge!.models.errors], meshes: scene.meshes.filter(m => m.isVisible).slice(0, 5).map(m => ({name:m.name,vertices:m.getTotalVertices(),bounds:[m.getBoundingInfo().boundingBox.minimumWorld.asArray(),m.getBoundingInfo().boundingBox.maximumWorld.asArray()]})) } : null;
    }
    private draw(includeStatic = true) {
        if (this.bridge) {
            this.bridge.setLights(this.flashPos, this.flashDir, this.flashOn);
            this.bridge.render(this.staticParts, this.dynamic, includeStatic);
            this.metrics.drawCalls += this.bridge.metrics.drawCalls;
            this.metrics.triangles += this.bridge.metrics.triangles;
            this.metrics.instances += this.bridge.metrics.instances;
            return;
        }
        const gl = this.gl, p = this.program;
        gl.useProgram(p);
        gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uViewProjection'), false, this.vp);
        gl.uniform3fv(gl.getUniformLocation(p, 'uEye'), this.eye);
        gl.uniform3fv(gl.getUniformLocation(p, 'uFog'), this.fog);
        gl.uniform1f(gl.getUniformLocation(p, 'uFogNear'), this.map ? 55 : 100);
        gl.uniform3fv(gl.getUniformLocation(p, 'uLightPos[0]'), this.flashPos.flat());
        gl.uniform3fv(gl.getUniformLocation(p, 'uLightDir[0]'), this.flashDir.flat());
        gl.uniform1fv(gl.getUniformLocation(p, 'uLightOn[0]'), this.flashOn);
        for (const [shape, b] of this.shapes) {
            gl.bindVertexArray(b.vao);
            const stat = this.staticBatches.get(shape);
            if (stat && includeStatic) {
                this.bindInstances(stat.buffer);
                gl.drawArraysInstanced(gl.TRIANGLES, 0, b.count, stat.count);
                this.metrics.drawCalls++;
                this.metrics.triangles += b.count / 3 * stat.count;
                this.metrics.instances += stat.count;
            }
            const draws = this.dynamic.filter(d => d.part.shape === shape);
            if (draws.length) {
                this.bindInstances(b.instances);
                const arr = this.data(draws);
                gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
                gl.drawArraysInstanced(gl.TRIANGLES, 0, b.count, draws.length);
                this.metrics.drawCalls++;
                this.metrics.triangles += b.count / 3 * draws.length;
                this.metrics.instances += draws.length;
            }
        }
        if (includeStatic && this.signs.length) {
            gl.useProgram(this.textProgram);
            gl.bindVertexArray(this.textVao);
            for (const s of this.signs) {
                if (distXZ(s.p, this.eye) > 110)
                    continue;
                gl.uniformMatrix4fv(gl.getUniformLocation(this.textProgram, 'uMatrix'), false, multiply(this.vp, model(s.p, [4.8, .75, 1], [0, s.yaw, 0])));
                gl.bindTexture(gl.TEXTURE_2D, s.texture);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                this.metrics.drawCalls++;
            }
        }
    }
    project(p: Vec3): {
        x: number;
        y: number;
        visible: boolean;
    } { const clip = transform(this.vp, p); return { x: (clip[0] + 1) / 2 * this.canvas.clientWidth, y: (1 - clip[1]) / 2 * this.canvas.clientHeight, visible: clip[2] > -1 && clip[2] < 1 && Math.abs(clip[0]) < 1 && Math.abs(clip[1]) < 1 }; }
    pickPreview(x: number, y: number): string {
        const rect=this.canvas.getBoundingClientRect();
        if(!rect.width || !rect.height)return '';
        const imported = this.bridge?.pickWeapon((x - rect.left) / rect.width, (y - rect.top) / rect.height);
        if (imported) return imported.slot;
        return pickGeometry(this.previewParts,this.eye,[0,-.04,-.13],43,rect.width/rect.height,(x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);
    }
    dispose() { if (this.bridge) { this.bridge.dispose(); return; } const gl = this.gl; for (const b of this.shapes.values()) {
        gl.deleteVertexArray(b.vao);
        gl.deleteBuffer(b.vertices);
        gl.deleteBuffer(b.instances);
    } for (const b of this.staticBatches.values())
        gl.deleteBuffer(b.buffer); for (const s of this.signs)
        gl.deleteTexture(s.texture); gl.deleteBuffer(this.textBuffer); gl.deleteVertexArray(this.textVao); gl.deleteProgram(this.program); gl.deleteProgram(this.textProgram); }
}
