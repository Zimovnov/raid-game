exec(compile(open(__file__.replace('04_prepare.py','common.py')).read(),__file__.replace('04_prepare.py','common.py'),'exec'))
game=col('AKMN_FP',root);remove_owned(game)
for category in ('Weapon','Magazine'):
    copies=[]
    for src in list(source.objects):
        if (src.get('rigid_bone')=='magazine') != (category=='Magazine'):continue
        o=src.copy();o.data=src.data.copy();game.objects.link(o);o.hide_render=False;o.hide_set(False)
        for mod in o.modifiers:
            if mod.type=='BEVEL':mod.segments=2
        apply(o)
        group=o.vertex_groups.new(name=src.get('rigid_bone','weapon_body'));group.add(list(range(len(o.data.vertices))),1,'REPLACE');copies.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in copies:o.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();o=bpy.context.object;o.name='AKMN_'+category+'_FP'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    tri=o.modifiers.new('Frozen triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(65),island_margin=.012,area_weight=1,correct_aspect=True,scale_to_bounds=True);bpy.ops.object.mode_set(mode='OBJECT')
    o['texture_set']=category
for o in source.objects:o.hide_render=True;o.hide_set(True)
save('04_UV_Triangulated')
result={o.name:len(o.data.polygons) for o in game.objects}
