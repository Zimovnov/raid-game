import bpy
from mathutils import Matrix
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4'
# All component vertices/transforms were authored in shared assembly space.
# Parent inverses preserve that space while allowing later assembly motion.
objs=list(bpy.data.collections['SOURCE'].objects)
def depth(o):return 0 if o.parent is None else 1+depth(o.parent)
for o in sorted(objs,key=depth):
    if o.parent:
        bpy.context.view_layer.update()
        o.matrix_parent_inverse=o.parent.matrix_world.inverted()
bpy.context.view_layer.update()
# Flat source faces remain flat; the molded frame uses smooth shading.
for p in bpy.data.objects['G17_Frame'].data.polygons:p.use_smooth=True
bpy.context.scene['preview_view']='front34';bpy.context.scene['preview_stage']='detail'
result={'hierarchy_corrected':len(objs)}
