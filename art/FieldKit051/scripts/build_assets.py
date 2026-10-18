"""Original game meshes and seamless materials. Run via Blender MCP in a new scene.
References inform proportions/palette only; no reference pixels are redistributed.
"""
import bpy, bmesh, json, math, os, hashlib
import numpy as np
from mathutils import Matrix, Vector
from pathlib import Path
import os
ROOT=os.environ.get('RAID_PROJECT_ROOT', str(Path(__file__).resolve().parents[3]))
DATA=json.load(open(ROOT+'/art/FieldKit051/recipes.json'))
OUT=ROOT+'/public/assets/field-kit-051'
ONLY={name for name in os.environ.get('RAID_FIELDKIT_ONLY','').split(',') if name}
os.makedirs(OUT,exist_ok=True)
scene=bpy.data.scenes.new('RAID_FieldKit051')
bpy.context.window.scene=scene
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
materials={}
def image(name,pixels):
    h,w=pixels.shape[:2]
    im=bpy.data.images.new(name,w,h,alpha=True)
    im.pixels.foreach_set(pixels.astype(np.float32).ravel())
    im.filepath_raw=OUT+'/'+name+'.png'; im.file_format='PNG'; im.save()
    return im
n=512; y,x=np.mgrid[0:n,0:n]; rng=np.random.default_rng(510)
weave=(np.sin(x*np.pi/2)*np.sin(y*np.pi/2))*.018
noise=rng.normal(0,.005,(n,n))
# Shared fabric micro-normal, woven at a small physical scale by mesh UVs.
dx=np.cos(x*np.pi/2)*np.sin(y*np.pi/2)*.10;dy=np.sin(x*np.pi/2)*np.cos(y*np.pi/2)*.10
if not ONLY:
 image('fabric-normal',np.stack((.5+dx,.5+dy,np.ones_like(dx)*.985,np.ones_like(dx)),axis=-1))
for index,camo in enumerate(DATA['camouflages'] if not ONLY else []):
    random=np.random.default_rng(510+index); pattern=camo['pattern']; colors=np.array(camo['colors']); masks=np.zeros((n,n),dtype=int)
    # Periodic fields produce tileable irregular islands instead of repeating rectangular patches.
    fx=x if pattern!='digital' else (x//8)*8;fy=y if pattern!='digital' else (y//8)*8
    if len(colors)>1:
        field=np.zeros((n,n))
        for k in range(1,22):
            a,b=random.integers(1,12,2); phase=random.random()*math.tau
            if pattern=='stripe': b=max(1,b//3);a*=2
            field+=np.sin((fx*a+fy*b)*math.tau/n+phase)/math.sqrt(k)
        thresholds=np.quantile(field,[i/len(colors) for i in range(1,len(colors))])
        masks=np.digitize(field,thresholds)
        if pattern=='snow': masks=np.where(field>np.quantile(field,.77),masks,0)
    rgb=colors[masks]*(1+weave[...,None]+noise[...,None])
    image('camo-'+camo['id'],np.concatenate((np.clip(rgb,0,1),np.ones((n,n,1))),axis=2))
# Neutral shared surface tile, with subtle machining/grain and sparse scuffs.
for kind in ('metal','polymer','wood'):
    value=np.ones((n,n))*.92+noise*2
    if kind=='metal':value+=.012*np.sin(y*2)+.012*np.sin(x*.7+y*.03)
    if kind=='polymer':value+=rng.uniform(-.028,.028,(n,n))
    if kind=='wood':value=.80+.15*np.sin(y*.10+np.sin(x*.022)*2)**2+.04*np.sin(y*.31+x*.009)
    im=bpy.data.images.load(OUT+'/surface-'+kind+'.png') if ONLY else image('surface-'+kind,np.stack((value,value,value,np.ones_like(value)),axis=-1))
    mat=bpy.data.materials.new('FK051_'+kind);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Metallic'].default_value=.78 if kind=='metal' else 0;bs.inputs['Roughness'].default_value=.49 if kind=='metal' else .82
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
    mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    materials[kind]=mat

def matrix(values):return Matrix(np.array(values).reshape((4,4),order='F').tolist())
def part_matrix(p):
    xx,yy,zz=p['r'];cx,sx=math.cos(xx),math.sin(xx);cy,sy=math.cos(yy),math.sin(yy);cz,sz=math.cos(zz),math.sin(zz)
    rot=Matrix(((cy*cz+sy*sx*sz,-cy*sz+sy*sx*cz,sy*cx,0),(cx*sz,cx*cz,-sx,0),(-sy*cz+cy*sx*sz,sy*sz+cy*sx*cz,cy*cx,0),(0,0,0,1)))
    return Matrix.Translation(Vector(p['p']))@rot@Matrix.Diagonal(Vector(p['s']+[1]))

def build_group(name,group,lod):
    verts=[];faces=[];colors=[];kinds=[]
    for p in group['parts']:
        arr=DATA['shapes'][p['shape']];m=C@part_matrix(p)
        c=p['c'];wood=c[0]>c[2]*1.5 and c[0]>c[1]*1.17
        kind='wood' if wood else 'polymer' if sum(c)<.65 else 'metal'
        for j in range(0,len(arr),18):
            start=len(verts)
            for t in range(3):verts.append(m@Vector(arr[j+t*6:j+t*6+3]))
            faces.append((start,start+1,start+2));colors.append(c);kinds.append(kind)
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    for mat in materials.values():mesh.materials.append(mat)
    attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for poly,c,kind in zip(mesh.polygons,colors,kinds):
        poly.material_index=list(materials).index(kind)
        for loop in poly.loop_indices:attr.data[loop].color=(*c,1)
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    # Weld triangle boundaries, dissolve coplanar edges and bevel only visible profile edges.
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.dissolve_limit(bm,angle_limit=.01,verts=list(bm.verts),edges=list(bm.edges),delimit={'MATERIAL','NORMAL'})
    bm.to_mesh(mesh);bm.free()
    if lod==0:
        mod=obj.modifiers.new('Machined edge radii','BEVEL');mod.width=.0013;mod.segments=2;mod.limit_method='ANGLE';mod.angle_limit=.55
        bpy.ops.object.modifier_apply(modifier=mod.name)
    uv=mesh.uv_layers.new(name='SurfaceUV')
    for poly in mesh.polygons:
        axis=max(range(3),key=lambda a:abs(poly.normal[a]));axes=[i for i in range(3) if i!=axis]
        for li in poly.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v[axes[0]]*5,v[axes[1]]*5)
    # Normalize by the first presentation primitive: its runtime matrix supplies pose/scale.
    inv=C@matrix(group['firstMatrix']).inverted()@C.inverted()
    mesh.transform(inv);mesh.update();obj.select_set(False)
    obj['assetKey']=name.split('__L'+str(lod)+'_',1)[1];obj['lod']=lod
    return obj

manifest=json.load(open(OUT+'/registry.json')) if ONLY else {}
metrics=json.load(open(ROOT+'/art/FieldKit051/metrics.json')) if ONLY else {}
for weapon,recipe in DATA['weapons'].items():
    if weapon=='weapon_glock17' or (ONLY and weapon not in ONLY):continue
    objects=[]
    for key,group in recipe['groups'].items():
        for lod in (0,1):objects.append(build_group(weapon+'__L'+str(lod)+'_'+key,group,lod))
    for o in bpy.context.selected_objects:o.select_set(False)
    for o in objects:o.select_set(True)
    path=OUT+'/'+weapon+'.glb'
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_vertex_color='ACTIVE',export_animations=False,export_cameras=False,export_lights=False)
    meshtris={}
    for o in objects:o.data.calc_loop_triangles();meshtris[o.name]=len(o.data.loop_triangles)
    metrics[weapon]={'bytes':os.path.getsize(path),'triangles':meshtris}
    manifest[weapon]={'url':'/assets/field-kit-051/'+weapon+'.glb?v='+hashlib.sha256(open(path,'rb').read()).hexdigest()[:12],'groups':list(recipe['groups'])}
    for o in objects:o.hide_set(True);o.select_set(False)
    print('FIELDKIT_EXPORTED',weapon,os.path.getsize(path))
json.dump(manifest,open(OUT+'/registry.json','w'),indent=2)
json.dump(metrics,open(ROOT+'/art/FieldKit051/metrics.json','w'),indent=2)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/art/FieldKit051/'+('AK74M_AKM_Runtime.blend' if ONLY else 'FieldKit051.blend'))
result={'weapons':len(manifest),'camouflages':len(DATA['camouflages']),'output':OUT}
