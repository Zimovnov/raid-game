import { environmentTexture, foliageSurface } from './environment-textures.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { FABRIC_ASSETS, FABRIC_NORMAL } from '../content/fabric-assets.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { ModelAssets } from './model-assets.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { SpotLight } from '@babylonjs/core/Lights/spotLight.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import type { Color, MapDef, Part, Shape, SurfaceTexture, Vec3 } from '../domain/types.js';
import { geometry } from './geometry.js';
import { model, multiply, transform, type Mat4 } from './math.js';
import { AKMNAsset } from './akmn-asset.js';
import { isPatchId } from '../domain/patches.js';
import '@babylonjs/core/Culling/ray.js';

export interface ScenePart { part: Part; parent: Mat4 }
interface Batch { mesh: Mesh; vertices: number; static: boolean; foliage: boolean; count: number }
const vec = (point: Vec3) => new Vector3(point[0], point[1], point[2]);
const color = (value: Color) => new Color3(value[0], value[1], value[2]);

export class BabylonBridge {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: FreeCamera;
  readonly akmn: AKMNAsset;
  readonly models: ModelAssets;
  private batches = new Map<string, Batch>();
  private signs: Mesh[] = [];
  private surfaces = new Map<string, Texture>();
  private materials = new Map<string, PBRMaterial>();
  private staticSource: Part[] | null = null;
  private sun: DirectionalLight;
  private shadows: ShadowGenerator;
  private skyDome: Mesh;
  private highQuality = true;
  private flashlights: SpotLight[] = [];
  private pixelRatio = 0;
  private fabrics = new Map<string, Texture>();
  private fabricNormal: Texture | null = null;
  private patchSource: ((id: string) => Promise<Blob | null>) | null = null;
  private patchTextures = new Map<string, Texture>();
  private patchRequests = new Map<string, symbol>();
  private patchRetryAt = new Map<string, number>();
  private disposed = false;
  metrics = { drawCalls: 0, triangles: 0, instances: 0, textures: 0 };

  constructor(readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { disableWebGL2Support: false, preserveDrawingBuffer: false, stencil: false }, true);
    if (this.engine.webGLVersion < 2) throw Error('Для игры требуется WebGL2');
    this.scene = new Scene(this.engine);
    this.scene.useRightHandedSystem = true;
    this.akmn = new AKMNAsset(this.scene);
    this.models = new ModelAssets(this.scene, id => this.fabricTextures(id), mesh => {
      mesh.receiveShadows = true;
      this.shadows.addShadowCaster(mesh, false);
      mesh.onDisposeObservable.addOnce(() => this.shadows.removeShadowCaster(mesh, false));
    });
    this.scene.ambientColor = new Color3(.48, .51, .46);
    this.camera = new FreeCamera('camera', Vector3.Zero(), this.scene);
    this.camera.minZ = .035;
    this.camera.maxZ = 1000;
    this.scene.activeCamera = this.camera;
    const sky = new HemisphericLight('sky', new Vector3(-.5, 1, .35), this.scene);
    sky.intensity = .85;
    sky.groundColor = new Color3(.22, .25, .23);
    const sun = new DirectionalLight('sun', new Vector3(.5, -.9, -.35), this.scene);
    sun.intensity = 2.7;
    sun.diffuse = new Color3(1,.94,.82);
    sun.autoUpdateExtends = false;
    sun.orthoLeft=-85;sun.orthoRight=85;sun.orthoTop=85;sun.orthoBottom=-85;
    sun.shadowMinZ=1;sun.shadowMaxZ=300;
    this.sun=sun;
    this.shadows=new ShadowGenerator(2048,sun);
    this.shadows.usePercentageCloserFiltering=true;
    this.shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;
    this.shadows.bias=.001;this.shadows.normalBias=.08;
    this.scene.imageProcessingConfiguration.toneMappingEnabled=true;
    this.scene.imageProcessingConfiguration.toneMappingType=1;
    this.scene.imageProcessingConfiguration.exposure=1.15;
    this.scene.imageProcessingConfiguration.contrast=1.12;
    this.skyDome=MeshBuilder.CreateSphere('daylight-sky',{diameter:1400,segments:16},this.scene);
    const skyMaterial=new ShaderMaterial('daylight-sky-material',this.scene,{
      vertexSource:'precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;varying vec3 direction;void main(){direction=position;gl_Position=worldViewProjection*vec4(position,1.);}',
      fragmentSource:'precision highp float;varying vec3 direction;void main(){vec3 d=normalize(direction);float h=max(d.y,0.);vec3 c=mix(vec3(.72,.80,.81),vec3(.18,.42,.67),pow(h,.45));float sun=pow(max(dot(d,normalize(vec3(-.5,.9,.35))),0.),600.);float haze=pow(max(dot(d,normalize(vec3(-.5,.9,.35))),0.),12.);c+=vec3(1.,.85,.6)*sun*.8+vec3(.1,.07,.02)*haze;gl_FragColor=vec4(c,1.);}'
    },{attributes:['position'],uniforms:['worldViewProjection']});
    skyMaterial.backFaceCulling=false;skyMaterial.disableDepthWrite=true;
    this.skyDome.material=skyMaterial;this.skyDome.isPickable=false;
    this.skyDome.infiniteDistance=true;
    for (let i = 0; i < 2; i++) {
      const light = new SpotLight('flashlight-' + i, Vector3.Zero(), new Vector3(0, 0, -1), 1.02, 5, this.scene);
      light.diffuse = new Color3(1, .9, .7);
      light.intensity = 0;
      light.range = 42;
      this.flashlights.push(light);
    }
  }

  setPatchSource(source: (id: string) => Promise<Blob | null>) { this.patchSource = source; }

  /** Test the meshes the player actually sees, including thin-instance transforms. */
  pickWeapon(x: number, y: number): { hit: boolean; slot: string } {
    // Babylon converts CSS coordinates to render pixels internally.
    const scale = this.engine.getHardwareScalingLevel();
    const ray = this.scene.createPickingRay(x * this.engine.getRenderWidth() * scale, y * this.engine.getRenderHeight() * scale, null, this.camera);
    const hit = this.scene.pickWithRay(ray, mesh => mesh.isVisible && !!(mesh.metadata?.raidAsset || mesh.metadata?.raidSlots));
    if (!hit?.hit || !hit.pickedMesh) return { hit: false, slot: '' };
    const metadata = hit.pickedMesh.metadata;
    const path = metadata.raidSlots ? metadata.raidSlots[hit.thinInstanceIndex] || '' : String(metadata.raidGroup).split('__')[0].replaceAll('_', '.');
    return { hit: true, slot: path === 'body' || path === 'action' ? '' : path };
  }

  private requestPatch(id: string, material: PBRMaterial) {
    if (!this.patchSource || !isPatchId(id) || this.patchRequests.has(id) || performance.now() < (this.patchRetryAt.get(id) || 0)) return;
    const request = Symbol(id);
    this.patchRequests.set(id, request);
    material.alpha = 0;
    void this.patchSource(id).then(blob => {
      if (this.disposed || this.patchRequests.get(id) !== request) return;
      if (!blob || this.disposed) { this.patchRequests.delete(id); this.patchRetryAt.set(id, performance.now() + 5000); return; }
      const url = URL.createObjectURL(blob);
      const texture = new Texture(url, this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE,
        () => { URL.revokeObjectURL(url); if (!this.disposed && this.patchRequests.get(id) === request) material.alpha = 1; },
        () => {
          URL.revokeObjectURL(url);
          if (this.patchRequests.get(id) !== request) return;
          texture.dispose(); this.patchTextures.delete(id); this.patchRequests.delete(id);
          this.patchRetryAt.set(id, performance.now() + 5000);
        });
      texture.hasAlpha = true;
      material.albedoTexture = texture;
      material.useAlphaFromAlbedoTexture = true;
      this.patchTextures.set(id, texture);
      if (this.patchTextures.size > 64) {
        const oldest = this.patchTextures.keys().next().value;
        if (oldest && oldest !== id) this.clearPatch(oldest);
      }
    }).catch(() => {
      if (this.disposed || this.patchRequests.get(id) !== request) return;
      // A peer may have left the room before the HTTP request completed.
      // Keep its fabric mount visible and permit a later authorized retry.
      this.patchRequests.delete(id);
      this.patchRetryAt.set(id, performance.now() + 5000);
    });
  }

  clearPatch(id: string) {
    for (const [key, batch] of this.batches) if (key.includes(id)) { batch.mesh.dispose(); this.batches.delete(key); }
    for (const [key, material] of this.materials) if (key.includes(id)) { material.dispose(); this.materials.delete(key); }
    this.patchTextures.get(id)?.dispose(); this.patchTextures.delete(id); this.patchRequests.delete(id); this.patchRetryAt.delete(id);
  }

  setMap(map: MapDef | null) {
    // Every sign owns its DynamicTexture; changing maps must release its GPU image.
    for (const sign of this.signs) { sign.material?.dispose(false, true); sign.dispose(); }
    this.signs = [];
    for (const sign of map?.signs || []) {
      const texture = new DynamicTexture('sign-' + sign.text, { width: 1024, height: 160 }, this.scene, false);
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      ctx.fillStyle = sign.text.startsWith('ВЫХОД') ? '#476247' : '#35433e';
      ctx.fillRect(0, 0, 1024, 160);
      ctx.strokeStyle = '#b0b59b'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 1012, 148);
      ctx.fillStyle = '#eeead8'; ctx.font = 'bold 49px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sign.text, 512, 82, 965);
      texture.update();
      const material = new PBRMaterial('sign-material-' + sign.text, this.scene);
      material.albedoTexture = texture;
      material.metallic = 0; material.roughness = .85;
      material.backFaceCulling = false;
      const plane = MeshBuilder.CreatePlane('sign-' + sign.text, { width: 4.8, height: .75 }, this.scene);
      plane.position = vec(sign.p);
      plane.rotation.y = sign.yaw;
      plane.material = material;
      this.signs.push(plane);
    }
    this.metrics.textures = this.signs.length;
  }

  begin(eye: Vec3, target: Vec3, fov: number, fog: Color, quality: 'low' | 'high', near = .035) {
    this.akmn.begin();
    this.highQuality=quality==='high';
    this.sun.position=new Vector3(eye[0]-60,eye[1]+108,eye[2]+42);
    this.skyDome.position=vec(eye);
    const ratio = Math.min(devicePixelRatio || 1, quality === 'low' ? 1 : 1.4);
    if (this.pixelRatio !== ratio || this.engine.getRenderWidth() !== Math.round(this.canvas.clientWidth * ratio) || this.engine.getRenderHeight() !== Math.round(this.canvas.clientHeight * ratio)) {
      this.pixelRatio = ratio;
      this.engine.setHardwareScalingLevel(1 / ratio);
      this.engine.resize();
    }
    this.camera.position = vec(eye);
    this.camera.setTarget(vec(target));
    this.camera.minZ = near;
    this.camera.fov = fov * Math.PI / 180;
    this.scene.clearColor = new Color4(fog[0], fog[1], fog[2], 1);
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = color(fog);
    this.scene.fogStart = quality==='high'?130:90;
    this.scene.fogEnd = quality==='high'?350:220;
  }

  setLights(positions: Vec3[], directions: Vec3[], active: number[]) {
    this.flashlights.forEach((light, index) => {
      light.position = vec(positions[index]);
      light.direction = vec(directions[index]);
      light.intensity = active[index] ? 3 : 0;
    });
  }

  private fabricTextures(id: string) {
    if (!FABRIC_ASSETS[id]) throw Error('Unknown fabric texture: ' + id);
    let texture = this.fabrics.get(id);
    if (!texture) {
      texture = new Texture(FABRIC_ASSETS[id], this.scene);
      texture.anisotropicFilteringLevel = 4;
      this.fabrics.set(id, texture);
    }
    this.fabricNormal ||= new Texture(FABRIC_NORMAL, this.scene);
    return { color: texture, normal: this.fabricNormal };
  }

  private getBatch(part: Part, cell = ''): Batch {
    const tiled = part.surface && !foliageSurface(part.surface) && part.surface !== 'bark';
    // Unit metres repeat textures across architecture; vegetation keeps atlas UVs.
    const uvSize = tiled ? part.s.map(v=>Math.max(.25,Math.round(v*2)/2)) : [1,1,1];
    const materialKey = [part.shape, part.surface || '', ...uvSize,  ...part.c.map(value => value.toFixed(3)), part.material || 0, part.emissive || 0, part.fabric || '',part.patch || '', ...(part.fabric ? (part.fabricSize || part.s).map(v => v.toFixed(3)) : [])].join(':');
    const appearanceKey=[...part.c.map(v=>v.toFixed(3)),part.material||0,part.emissive||0,part.surface||'',part.fabric||'',part.patch||''].join(':');
    const key=cell?'static:'+cell+':'+appearanceKey:'dynamic:'+materialKey;
    const cached = this.batches.get(key);
    if (cached) {
      if (part.patch && !this.patchTextures.has(part.patch) && cached.mesh.material instanceof PBRMaterial) this.requestPatch(part.patch, cached.mesh.material);
      return cached;
    }
    const primitive = geometry(part.shape as Shape);
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
    for (let i = 0; i < primitive.vertices.length; i += 6) {
      positions.push(primitive.vertices[i], primitive.vertices[i + 1], primitive.vertices[i + 2]);
      normals.push(primitive.vertices[i + 3], primitive.vertices[i + 4], primitive.vertices[i + 5]);
      if (part.patch) uvs.push(primitive.vertices[i] + .5, primitive.vertices[i + 1] + .5);
      else if (part.fabric || part.surface) {
        const normal = Array.from(primitive.vertices.slice(i + 3, i + 6));
        const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
        const axes = axis===0 ? [2,1] : axis===1 ? [0,2] : [0,1];
        if(foliageSurface(part.surface)) uvs.push(primitive.vertices[i]+.5,primitive.vertices[i+1]+.5);
        else uvs.push(...axes.map(k => (primitive.vertices[i + k] + .5) * (part.fabric ? (part.fabricSize || part.s)[k]/.45 : uvSize[k]/2)));
      }
    }
    const mesh = new Mesh('batch-' + key, this.scene);
    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    if (uvs.length) data.uvs = uvs;
    // Procedural geometry is already an ordered triangle list. Indices count vertices,
    // whereas positions contains three numeric coordinates per vertex.
    data.indices = Array.from({ length: positions.length / 3 }, (_, index) => index);
    data.applyToMesh(mesh, true);
    let material = this.materials.get(appearanceKey);
    if(!material) {
    material = new PBRMaterial('surface-' + materialKey, this.scene);
    material.albedoColor = color(part.c);
    material.metallic = part.material === 3 ? 0 : part.material === 4 ? .05 : .18;
    material.roughness = part.material === 3 ? .85 : part.material === 1 || part.material === 2 ? .93 : .7;
    if (part.emissive) material.emissiveColor = color(part.c).scale(part.emissive);
    if (part.patch) {
      material.albedoColor = Color3.White(); material.metallic = 0; material.roughness = .94;
      material.backFaceCulling = false; material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      this.requestPatch(part.patch, material);
    }
    if (part.fabric) {
      const textures = this.fabricTextures(part.fabric);
      material.albedoColor = Color3.White(); material.albedoTexture = textures.color;
      material.bumpTexture = textures.normal; material.metallic = 0; material.roughness = .94;
    }
    if(part.surface) {
      const imported: Partial<Record<SurfaceTexture,string>>={wood:'weathered_plank_siding',soil:'forest_floor',bark:'bark_brown_02'};
      const source=imported[part.surface];
      const load=(suffix:string)=>{
        const key=part.surface+'-'+suffix;
        let t=this.surfaces.get(key);
        if(!t){t=new Texture('/assets/frontier-060/'+source+'_'+suffix+'.jpg',this.scene);t.anisotropicFilteringLevel=8;this.surfaces.set(key,t);}
        return t;
      };
      let texture=this.surfaces.get(part.surface);
      if(!texture){texture=source?load('diff'):environmentTexture(part.surface,this.scene);this.surfaces.set(part.surface,texture);}
      if(source){
        material.albedoColor=new Color3(.88,.88,.84);
        material.bumpTexture=load('normal');material.bumpTexture.level=.6;
        material.metallicTexture=load('rough');material.metallicTexture.gammaSpace=false;
        material.useRoughnessFromMetallicTextureGreen=true;material.useRoughnessFromMetallicTextureAlpha=false;
        material.useMetallnessFromMetallicTextureBlue=false;
      }
      material.albedoTexture=texture;material.metallic=part.surface==='metal'?.25:0;material.roughness=.92;
      if(foliageSurface(part.surface)) {
        material.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHATEST;
        material.useAlphaFromAlbedoTexture=true;material.alphaCutOff=.35;
        material.twoSidedLighting=true;
        material.emissiveColor=color(part.c).scale(.06);
      }
    }
    material.backFaceCulling = false;
    this.materials.set(appearanceKey,material);
    }
    mesh.receiveShadows=true;
    if(part.surface!=='grass' && part.s[1]>.15)this.shadows.addShadowCaster(mesh);
    mesh.material = material;
    mesh.thinInstanceEnablePicking = true;
    mesh.thinInstanceCount = 0;
    const batch = { mesh, vertices: primitive.count, static: !!cell, foliage:part.surface==='grass', count:0 };
    this.batches.set(key, batch);
    return batch;
  }

  render(staticParts: Part[], dynamic: ScenePart[], includeStatic: boolean) {
    this.akmn.renderPass(includeStatic);
    this.models.beginPass();
    const groups = new Map<Batch, number[]>();
    const slots = new Map<Batch, string[]>();
    const add = (part: Part, parent: Mat4) => {
      if (part.legacyOnly || this.models.add(part, parent, includeStatic)) return;
      if (part.assetOnly) return;
      const batch = this.getBatch(part);
      const matrices = groups.get(batch) || [];
      matrices.push(...multiply(parent, model(part.p, part.s, part.r)));
      groups.set(batch, matrices);
      const paths = slots.get(batch) || []; paths.push(part.slot || ''); slots.set(batch, paths);
    };
    if(this.staticSource!==staticParts) {
      for(const [key,batch] of this.batches) if(batch.static){this.shadows.removeShadowCaster(batch.mesh);batch.mesh.dispose();this.batches.delete(key);}
      const staticGroups=new Map<Batch,{positions:number[];normals:number[];uvs:number[];count:number}>();
      const primitives=new Map<Shape,ReturnType<typeof geometry>>();
      for(const part of staticParts) {
        if(part.legacyOnly || part.assetOnly)continue;
        const cell=Math.floor(part.p[0]/64)+','+Math.floor(part.p[2]/64);
        const batch=this.getBatch(part,cell), data=staticGroups.get(batch)||{positions:[],normals:[],uvs:[],count:0};
        let primitive=primitives.get(part.shape);
        if(!primitive){primitive=geometry(part.shape);primitives.set(part.shape,primitive);}
        const matrix=model(part.p,part.s,part.r), rotation=model([0,0,0],[1,1,1],part.r);
        for(let i=0;i<primitive.vertices.length;i+=6) {
          const v=primitive.vertices;
          data.positions.push(...transform(matrix,[v[i],v[i+1],v[i+2]]));
          const n=transform(rotation,[v[i+3]/part.s[0],v[i+4]/part.s[1],v[i+5]/part.s[2]]),length=Math.hypot(...n);
          data.normals.push(n[0]/length,n[1]/length,n[2]/length);
          const normal=[v[i+3],v[i+4],v[i+5]],axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
          const axes=axis===0?[2,1]:axis===1?[0,2]:[0,1];
          if(foliageSurface(part.surface))data.uvs.push(v[i]+.5,v[i+1]+.5);
          else data.uvs.push(...axes.map(k=>(v[i+k]+.5)*part.s[k]/(part.surface==='wood'?1.6:2.1)));
        }
        data.count++;staticGroups.set(batch,data);
      }
      for(const [batch,data] of staticGroups){
        const vertex=new VertexData();vertex.positions=data.positions;vertex.normals=data.normals;vertex.uvs=data.uvs;
        vertex.indices=Array.from({length:data.positions.length/3},(_,i)=>i);vertex.applyToMesh(batch.mesh,false);
        batch.vertices=data.positions.length/3;batch.count=data.count;
        batch.mesh.freezeWorldMatrix();
      }
      this.staticSource=staticParts;
    }
    for (const draw of dynamic) add(draw.part, draw.parent);
    this.metrics.drawCalls = 0; this.metrics.instances = 0; this.metrics.triangles = 0;
    for (const batch of this.batches.values()) {
      if(batch.static) {
        const bounds=batch.mesh.getBoundingInfo().boundingSphere;
        const distance=Vector3.Distance(this.camera.position,bounds.centerWorld)-bounds.radiusWorld;
        batch.mesh.isVisible=includeStatic && distance<(batch.foliage?(this.highQuality?85:45):this.scene.fogEnd);
        if(batch.mesh.isVisible){this.metrics.drawCalls++;this.metrics.instances+=batch.count;this.metrics.triangles+=batch.vertices/3;}
        continue;
      }
      const matrices = groups.get(batch) || [];
      batch.mesh.metadata = { raidSlots: slots.get(batch) || [] };
      batch.mesh.receiveShadows=includeStatic;
      batch.mesh.isVisible = matrices.length > 0;
      batch.mesh.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16, true);
      batch.mesh.thinInstanceCount = matrices.length / 16;
      if (matrices.length) { this.metrics.drawCalls++; this.metrics.instances += matrices.length / 16; this.metrics.triangles += batch.vertices / 3 * matrices.length / 16; }
    }
    const imported = this.models.finishPass();
    this.metrics.drawCalls += imported.drawCalls; this.metrics.instances += imported.instances; this.metrics.triangles += imported.triangles;
    for (const sign of this.signs) sign.isVisible = includeStatic && Vector3.Distance(sign.position,this.camera.position)<130;
    this.skyDome.isVisible=includeStatic;
    this.scene.shadowsEnabled=this.highQuality;
    this.scene.renderTargetsEnabled=includeStatic && this.highQuality;
    this.scene.autoClear = includeStatic;
    this.scene.autoClearDepthAndStencil = true;
    this.scene.render();
  }

  dispose() { this.disposed = true; for (const texture of this.patchTextures.values()) texture.dispose(); this.patchTextures.clear(); this.models.dispose(); this.akmn.dispose(); this.scene.dispose(); this.engine.dispose(); }
}
