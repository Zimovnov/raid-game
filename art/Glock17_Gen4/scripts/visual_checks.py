import bpy, bmesh, os, json
from mathutils import Vector
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4';s=bpy.context.scene
meshes=[o for o in bpy.data.collections['GAME_LOD0'].objects if o.type=='MESH']
for o in meshes:o.data.name=o.name+'_Mesh'
# A source-only shape key moves the visible hood out of the open window.
# It is an illustrative pose, not a mechanical simulation, and is absent from the static GLB.
o=bpy.data.objects['G17_BarrelVisual_LOD0']
if not o.data.shape_keys:
 o.shape_key_add(name='Basis');key=o.shape_key_add(name='OpenHoodVisual')
 bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table();remaining=set(bm.verts)
 while remaining:
  start=remaining.pop();island={start};stack=[start]
  while stack:
   v=stack.pop()
   for e in v.link_edges:
    other=e.other_vert(v)
    if other in remaining:remaining.remove(other);island.add(other);stack.append(other)
  center=sum((o.matrix_world@v.co for v in island),Vector())/len(island)
  if center.y<.105:
   for v in island:key.data[v.index].co.z-=.016
 bm.free()
 key.value=0;key.keyframe_insert(data_path='value',frame=1);key.value=1;key.keyframe_insert(data_path='value',frame=30)
s.frame_set(30);s['preview_view']='rear34';s['preview_stage']='slide_open_visual'
exec(compile(open(P+'/scripts/render.py').read(),'render.py','exec'))
s.frame_set(1)
# UV checker uses identical final geometry/UV; no geometry change follows the bake.
checker=bpy.data.images.get('G17_UV_Checker') or bpy.data.images.new('G17_UV_Checker',1024,1024)
checker.generated_type='COLOR_GRID'
cm=bpy.data.materials.get('G17_CheckerMaterial') or bpy.data.materials.new('G17_CheckerMaterial');cm.use_nodes=True
cn=cm.node_tree.nodes;cp=next(n for n in cn if n.type=='BSDF_PRINCIPLED');ct=cn.get('Checker') or cn.new('ShaderNodeTexImage');ct.name='Checker';ct.image=checker;cm.node_tree.links.new(ct.outputs['Color'],cp.inputs['Base Color']);cp.inputs['Roughness'].default_value=.8
original=bpy.data.materials['G17_AtlasPBR']
for o in meshes:o.data.materials[0]=cm
s['preview_stage']='uv_checker';s['preview_view']='front34'
exec(compile(open(P+'/scripts/render.py').read(),'render.py','exec'))
for o in meshes:o.data.materials[0]=original
# Wireframe is a temporary material using the existing final triangles.
wm=bpy.data.materials.get('G17_WireMaterial') or bpy.data.materials.new('G17_WireMaterial');wm.use_nodes=True
wn=wm.node_tree.nodes;wl=wm.node_tree.links;wp=next(n for n in wn if n.type=='BSDF_PRINCIPLED')
wire=wn.new('ShaderNodeWireframe');wire.use_pixel_size=True;wire.inputs['Size'].default_value=.65
mix=wn.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.42,.45,.48,1);mix.inputs[2].default_value=(.012,.015,.02,1);wl.new(wire.outputs[0],mix.inputs[0]);wl.new(mix.outputs[0],wp.inputs['Base Color'])
for o in meshes:o.data.materials[0]=wm
s['preview_stage']='wireframe';s['preview_view']='rear34'
exec(compile(open(P+'/scripts/render.py').read(),'render.py','exec'))
for o in meshes:o.data.materials[0]=original
s['preview_stage']='final';s['preview_view']='front34';s.frame_set(1)
result={'checks':['open_pose','UV_checker','wireframe'],'default_frame':s.frame_current}
