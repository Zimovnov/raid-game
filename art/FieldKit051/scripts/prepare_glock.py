"""Separate runtime copy; source Glock meshes, UVs and atlas stay unchanged."""
import bpy,json,hashlib
from mathutils import Matrix,Vector
from pathlib import Path
import os
ROOT=os.environ.get('RAID_PROJECT_ROOT', str(Path(__file__).resolve().parents[3]));OUT=ROOT+'/public/assets/field-kit-051'
scene=bpy.data.scenes.new('Glock051_Runtime');bpy.context.window.scene=scene
# Explicit context avoids exporting objects selected in another scene.
with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
    bpy.ops.import_scene.gltf(filepath=ROOT+'/art/Glock17_Gen4/Glock17_Gen4_LOD0.glb')
    imported=list(scene.objects)
    bounds=[o.matrix_world@Vector(v) for o in imported if o.type=='MESH' for v in o.bound_box]
    print('BOUNDS',[(min(v[i] for v in bounds),max(v[i] for v in bounds)) for i in range(3)])
result={'objects':[(o.name,o.type) for o in imported], 'bounds':[(min(v[i] for v in bounds),max(v[i] for v in bounds)) for i in range(3)]}
import numpy as np
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
recipe=json.load(open(ROOT+'/art/FieldKit051/recipes.json'))['weapons']['weapon_glock17']
placement=C@Matrix.Translation(Vector((0,.05315,.08625)))@Matrix.Diagonal((1.5,1.5,1.5,1))@C.inverted()
exports=[]
with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
    for source in imported:
        if source.type!='MESH':continue
        key='action' if any(s in source.name for s in ('Slide','FrontSight','RearSight')) else 'magazine__glock_17' if 'Magazine' in source.name else 'body'
        rest=Matrix(np.array(recipe['groups'][key]['firstMatrix']).reshape((4,4),order='F').tolist())
        inv=C@rest.inverted()@C.inverted()
        world=source.matrix_world.copy()
        for lod in (0,1):
            mesh=source.data.copy();mesh.transform(inv@placement@world)
            obj=bpy.data.objects.new('Glock051_L'+str(lod)+'_'+source.name,mesh);scene.collection.objects.link(obj)
            obj['assetKey']=key;obj['lod']=lod;exports.append(obj)
            if lod:
                bpy.context.view_layer.objects.active=obj;obj.select_set(True)
                dec=obj.modifiers.new('Distance LOD','DECIMATE');dec.ratio=.32
                bpy.ops.object.modifier_apply(modifier=dec.name);obj.select_set(False)
    for o in scene.objects:o.select_set(False)
    for o in exports:o.select_set(True)
    path=OUT+'/weapon_glock17.glb'
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/art/FieldKit051/Glock051_Runtime.blend')
reg=json.load(open(OUT+'/registry.json'))
reg['weapon_glock17']={'url':'/assets/field-kit-051/weapon_glock17.glb?v='+hashlib.sha256(open(path,'rb').read()).hexdigest()[:12],'groups':['body','action','magazine__glock_17']}
json.dump(reg,open(OUT+'/registry.json','w'),indent=2)
result={'groups':reg['weapon_glock17']['groups'],'meshes':len(exports),'sourceUnchanged':True}
