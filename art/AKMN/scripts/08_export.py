exec(compile(open(__file__.replace('08_export.py','common.py')).read(),__file__.replace('08_export.py','common.py'),'exec'))
rig=bpy.data.objects['AKMN_Rig'];game=bpy.data.collections['AKMN_FP'];helpers=bpy.data.collections['AKMN_CONTACT_TEST']
rig.animation_data.action=None
for b in rig.pose.bones:b.location=(0,0,0);b.rotation_euler=(0,0,0)
rig.pose.bones['magazine_spare'].location=(-.18,-.06,-.32)
for o in helpers.objects:o.hide_render=True;o.hide_set(True)
def export(name,objects,animated=False):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.hide_set(False);o.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=P+'/exports/'+name+'.glb',export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=False,export_animations=animated,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_anim_slide_to_zero=True,export_force_sampling=True,export_frame_range=False,export_morph=False,export_tangents=True,export_extras=True,export_cameras=False,export_lights=False,export_def_bones=False)
save('08_BeforeExport')
export('AKMN_FP',list(game.objects),True)
export('AKMN_FP_ContactReview',list(game.objects)+list(helpers.objects),True)
export('AKMN_Magazine',[rig,bpy.data.objects['AKMN_Magazine_FP']],False)
stats={}
base=[bpy.data.objects['AKMN_Weapon_FP'],bpy.data.objects['AKMN_Magazine_FP']]
stats['FP']={'triangles':sum(len(o.data.polygons) for o in base),'materials':2}
for level,ratio in enumerate((.39,.17,.076)):
    lod=col('AKMN_WORLD_LOD'+str(level),root);remove_owned(lod);copies=[]
    for src in base:
        o=src.copy();o.data=src.data.copy();lod.objects.link(o);o.name=src.name.replace('_FP','_LOD'+str(level))
        for m in list(o.modifiers):o.modifiers.remove(m)
        bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
        m=o.modifiers.new('LOD silhouette simplification','DECIMATE');m.ratio=ratio;m.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=m.name)
        arm=o.modifiers.new('Rigid weights','ARMATURE');arm.object=rig;copies.append(o)
    export('AKMN_World_LOD'+str(level),[rig]+copies,False)
    stats['World_LOD'+str(level)]={'triangles':sum(len(o.data.polygons) for o in copies),'materials':2}
    for o in game.objects:
        if o.type=='MESH':o.hide_render=True
    for o in copies:o.hide_render=False
    render('LOD'+str(level),'perspective');render('LOD'+str(level),'left')
    for o in copies:o.hide_render=True;o.hide_set(True)
for o in game.objects:o.hide_render=False;o.hide_set(False)
bpy.data.objects['AKMN_Magazine_Spare'].hide_render=True;bpy.data.objects['AKMN_Magazine_Spare'].hide_set(True)
for o in helpers.objects:o.hide_render=True;o.hide_set(True)
open(P+'/geometry-stats.json','w').write(json.dumps(stats,indent=2))
render('final','left');render('final','right');render('final','perspective');render('final','rail');render('final','top');render('final','front')
# Write a self-contained asset-only project; existing user's scenes remain in memory
# and in the initial backup, without being bundled in this weapon's master.
bpy.data.libraries.write(P+'/AKMN_Master.blend',{scene},path_remap='RELATIVE',fake_user=True,compress=True)
result=stats
