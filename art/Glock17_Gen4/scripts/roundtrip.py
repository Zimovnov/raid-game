import bpy,json
from mathutils import Vector
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4'
scene=bpy.data.scenes.get('G17_Roundtrip')
if scene:
 for o in list(scene.objects):
  if o.type=='MESH' or o.type=='EMPTY':bpy.data.objects.remove(o,do_unlink=True)
else:scene=bpy.data.scenes.new('G17_Roundtrip')
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
if 'STUDIO' not in scene.collection.children:scene.collection.children.link(bpy.data.collections['STUDIO'])
scene.camera=bpy.data.objects['G17_Camera'];scene.world=bpy.data.worlds['G17_StudioWorld']
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
bpy.ops.import_scene.gltf(filepath=P+'/Glock17_Gen4_LOD0.glb')
meshes=[o for o in scene.objects if o.type=='MESH']
for o in list(scene.objects):
 if o.type in ('MESH','EMPTY'):o.name='Roundtrip_'+o.name.replace('.001','')
coords=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
stats={'scene':scene.name,'mesh_count':len(meshes),'triangles':sum(len(o.data.polygons) for o in meshes),'dimensions_m':[max(v[i] for v in coords)-min(v[i] for v in coords) for i in range(3)],'materials':list(set(m.name for o in meshes for m in o.data.materials)),'hierarchy':{o.name:o.parent.name if o.parent else None for o in scene.objects if o.type in ('MESH','EMPTY')}}
assert stats['mesh_count']==7
assert stats['triangles']==24788
scene['preview_stage']='roundtrip'
open(P+'/roundtrip_validation.json','w').write(json.dumps(stats,indent=2))
result=stats
