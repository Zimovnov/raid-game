import bpy, json, os, bmesh
from mathutils import Vector
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4';s=bpy.context.scene
m=bpy.data.materials.get('G17_AtlasPBR') or bpy.data.materials.new('G17_AtlasPBR');m.use_nodes=True
n=m.node_tree.nodes;l=m.node_tree.links;n.clear()
out=n.new('ShaderNodeOutputMaterial');p=n.new('ShaderNodeBsdfPrincipled');l.new(p.outputs[0],out.inputs['Surface'])
for kind in ('BaseColor','Normal','ORM'):
 im=bpy.data.images['G17_'+kind]
 if im.packed_file:im.unpack(method='REMOVE')
 im.filepath=P+'/textures/G17_'+kind+'.png';im.reload();im.pack()
 q=n.new('ShaderNodeTexImage');q.name='G17_'+kind;q.label=kind;q.image=im;q.interpolation='Linear'
 if kind=='BaseColor':l.new(q.outputs['Color'],p.inputs['Base Color'])
 elif kind=='Normal':
  nor=n.new('ShaderNodeNormalMap');nor.space='TANGENT';l.new(q.outputs['Color'],nor.inputs['Color']);l.new(nor.outputs[0],p.inputs['Normal'])
 else:
  sep=n.new('ShaderNodeSeparateColor');sep.mode='RGB';l.new(q.outputs['Color'],sep.inputs[0]);l.new(sep.outputs['Green'],p.inputs['Roughness']);l.new(sep.outputs['Blue'],p.inputs['Metallic'])
  group=bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
  for socket,default in [('Occlusion',1),('Thickness',0),('Dispersion',0),('Iridescence Factor',0),('Iridescence Thickness Minimum',100)]:
   if socket not in [item.name for item in group.interface.items_tree]:
    item=group.interface.new_socket(name=socket,in_out='INPUT',socket_type='NodeSocketFloat');item.default_value=default
  gn=n.new('ShaderNodeGroup');gn.node_tree=group;l.new(sep.outputs['Red'],gn.inputs['Occlusion'])
objects=list(bpy.data.collections['GAME_LOD0'].objects);meshes=[o for o in objects if o.type=='MESH']
stats={'objects':len(meshes),'materials':1,'triangles':0,'vertices':0,'uv_outside_0_1':0,'degenerate_faces':0,'nonmanifold_edges':0}
coords=[]
for o in meshes:
 o.data.materials.clear();o.data.materials.append(m)
 for f in o.data.polygons:f.material_index=0
 stats['triangles']+=len(o.data.polygons);stats['vertices']+=len(o.data.vertices)
 stats['uv_outside_0_1']+=sum(not(-.00001<=p.uv.x<=1.00001 and -.00001<=p.uv.y<=1.00001) for p in o.data.uv_layers.active.data)
 bm=bmesh.new();bm.from_mesh(o.data);stats['degenerate_faces']+=sum(f.calc_area()<1e-14 for f in bm.faces);stats['nonmanifold_edges']+=sum(not e.is_manifold for e in bm.edges);bm.free()
 coords.extend(o.matrix_world@Vector(c) for c in o.bound_box)
stats['dimensions_m']=[max(v[i] for v in coords)-min(v[i] for v in coords) for i in range(3)]
open(P+'/validation.json','w').write(json.dumps(stats,indent=2))
# Optional visual-only slide pose, kept in the source file; exports start closed.
slide=bpy.data.objects['G17_Slide_LOD0'];closed=slide.location.copy();slide.location=closed;slide.keyframe_insert(data_path='location',frame=1)
slide.location.y-=.037;slide.keyframe_insert(data_path='location',frame=30);slide.location=closed
if slide.animation_data and slide.animation_data.action:slide.animation_data.action.name='slide_open_visual'
s.frame_start=1;s.frame_end=30;s.frame_set(1)
s.timeline_markers.clear();s.timeline_markers.new('closed',frame=1);s.timeline_markers.new('slide_open_visual',frame=30)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['G17_GAME_ROOT']
bpy.ops.export_scene.gltf(filepath=P+'/Glock17_Gen4_LOD0.glb',export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=False,export_animations=False,export_morph=False,export_tangents=True,export_extras=True,export_cameras=False,export_lights=False)
# Pack all local reference/mask images in the editable master.
for im in bpy.data.images:
 if im.source=='FILE' and im.filepath and os.path.isfile(bpy.path.abspath(im.filepath)):
  im.pack()
# Keep helpers/source out of view, leaving the exported closed assembly visible.
for name in ('SOURCE','HELPERS','REFERENCES'):
 for o in bpy.data.collections[name].objects:o.hide_set(True);o.hide_render=True
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  area.spaces.active.clip_start=.001;area.spaces.active.clip_end=100
  area.spaces.active.region_3d.view_distance=.35;area.spaces.active.region_3d.view_location=Vector((0,.09,-.04))
  area.spaces.active.shading.type='MATERIAL'
s['preview_stage']='final';s['preview_view']='front34';s['stage']='exported'
bpy.ops.wm.save_as_mainfile(filepath=P+'/Glock17_Gen4_Master.blend')
result=stats
