import bpy, math, json, bmesh
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4'
s=bpy.context.scene;source=bpy.data.collections['SOURCE'];game=bpy.data.collections['GAME_LOD0']
# Source-only noise is evaluated on final game geometry and baked before replacing its shaders.
for o in list(game.objects):bpy.data.objects.remove(o,do_unlink=True)
root=bpy.data.objects.new('G17_GAME_ROOT',None);game.objects.link(root)
root['axes']='Blender +Y forward,+Z up; glTF -Z forward,+Y up; 1 unit = 1 meter'
root['origin']='Rear face of closed slide, bore-height centerline'
root['configuration']='Gen4,9x19,standard magazine,iron sights,closed'
deps=bpy.context.evaluated_depsgraph_get();mapping={}
for o in list(source.objects):
 if o.type!='MESH':continue
 me=bpy.data.meshes.new_from_object(o.evaluated_get(deps),depsgraph=deps)
 cp=bpy.data.objects.new(o.name+'_LOD0',me);game.objects.link(cp);cp.matrix_world=o.matrix_world.copy();mapping[o.name]=cp
 if o.name=='G17_Frame':
  bpy.ops.object.select_all(action='DESELECT');cp.select_set(True);bpy.context.view_layer.objects.active=cp
  dec=cp.modifiers.new('Silhouette LOD reduction','DECIMATE');dec.ratio=.016
  bpy.ops.object.modifier_apply(modifier=dec.name)
# Merge only rigid subassemblies. Five independently movable groups, two attached sights.
groups={
 'G17_Frame_LOD0':[n for n in mapping if n.startswith(('G17_Pin_','G17_Takedown_','G17_StopRidge_','G17_ReleaseRib_'))]+['G17_Frame','G17_MagRelease','G17_SlideStop','G17_LowerRoundVisual','G17_LowerInset'],
 'G17_Slide_LOD0':['G17_Slide','G17_RearCover','G17_Nose','G17_Extractor']+[n for n in mapping if n.startswith('G17_CoverRib_')],
 'G17_BarrelVisual_LOD0':['G17_BarrelVisual','G17_BarrelHood'],
 'G17_Trigger_LOD0':['G17_Trigger','G17_TriggerSafety'],
 'G17_Magazine_LOD0':['G17_Magazine','G17_MagBody'],
 'G17_FrontSight_LOD0':['G17_FrontSight','G17_FrontDot'],
 'G17_RearSight_LOD0':['G17_RearSight']+[n for n in mapping if n.startswith('G17_SightU_')]
}
for name,ns in groups.items():
 bpy.ops.object.select_all(action='DESELECT');ls=[mapping[n] for n in ns]
 for o in ls:o.select_set(True)
 bpy.context.view_layer.objects.active=ls[0]
 if len(ls)>1:bpy.ops.object.join()
 o=ls[0];o.name=name;o.parent=root;o.matrix_parent_inverse=root.matrix_world.inverted()
 # Remove boolean slivers only within each individual assembly, before UV/bake.
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.dissolve_degenerate(bm,dist=0.0000003,edges=list(bm.edges));bm.to_mesh(o.data);bm.free()
 # Stable normals and triangles precede UV baking.
 tri=o.modifiers.new('Final triangles','TRIANGULATE');tri.quad_method='FIXED';tri.ngon_method='BEAUTY';tri.keep_custom_normals=True
 bpy.ops.object.modifier_apply(modifier=tri.name)
for name in ('G17_FrontSight_LOD0','G17_RearSight_LOD0'):
 o=bpy.data.objects[name];m=o.matrix_world.copy();o.parent=bpy.data.objects['G17_Slide_LOD0'];o.matrix_world=m
# Atlas UVs are shared across the entire movable assembly without mirrored labels.
bpy.ops.object.select_all(action='DESELECT')
meshes=[o for o in game.objects if o.type=='MESH']
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(62),island_margin=.006,area_weight=.4,correct_aspect=True,scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
for o in source.objects:o.hide_render=True;o.hide_set(True)
# Standalone textured assembly is the only bake-visible geometry.
for o in game.objects:o.hide_render=False;o.hide_set(False)
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.bake.margin=12;s.render.bake.use_clear=False;s.render.bake.use_selected_to_active=False
stats={o.name:{'vertices':len(o.data.vertices),'triangles':len(o.data.polygons)} for o in meshes}
stats['total_triangles']=sum(len(o.data.polygons) for o in meshes)
open(P+'/geometry_stats.json','w').write(json.dumps(stats,indent=2))
s['stage']='uv_ready';bpy.ops.wm.save_as_mainfile(filepath=P+'/checkpoints/04_UV_Game.blend')
result=stats
