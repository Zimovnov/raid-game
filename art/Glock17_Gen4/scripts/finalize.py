import bpy, os,json
from mathutils import Vector
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4'
bpy.context.window.scene=bpy.data.scenes['G17_Asset'];s=bpy.context.scene;s.frame_set(1)
s['preview_stage']='final';s['preview_view']='front34'
exec(compile(open(P+'/scripts/render.py').read(),'render.py','exec'))
# Collection switches make the editable source easy to reveal without changing the export copy.
source=bpy.data.collections['SOURCE']
for o in source.objects:o.hide_set(False);o.hide_render=False
source.hide_viewport=True;source.hide_render=True
bpy.ops.object.select_all(action='DESELECT')
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  v=area.spaces.active;v.region_3d.view_location=Vector((0,.085,-.045));v.region_3d.view_distance=.34
  v.region_3d.view_rotation=s.camera.rotation_euler.to_quaternion();v.region_3d.view_perspective='ORTHO';v.clip_start=.001;v.overlay.show_overlays=False;v.shading.type='MATERIAL'
for im in bpy.data.images:
 if im.source=='FILE' and im.filepath:
  path=bpy.path.abspath(im.filepath)
  if os.path.isfile(path):
   if not im.packed_file:im.pack()
   if path.startswith(P+'/'):im.filepath='//'+os.path.relpath(path,P)
s['asset_output']=P;s['stage']='verified_closed_master';s['verification']='GLB roundtrip and textures verified; game runtime NOT RUN'
bpy.ops.wm.save_as_mainfile(filepath=P+'/Glock17_Gen4_Master.blend')
result={'file':bpy.data.filepath,'frame':s.frame_current,'source_toggle':'SOURCE viewport/render collection switches'}
