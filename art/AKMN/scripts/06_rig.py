exec(compile(open(__file__.replace('06_rig.py','common.py')).read(),__file__.replace('06_rig.py','common.py'),'exec'))
game=col('AKMN_FP',root);helpers=col('AKMN_CONTACT_TEST',root);remove_owned(helpers)
for o in list(game.objects):
    if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
for category in ('Weapon','Magazine'):
    m=material(category+'Atlas',(.04,.04,.04),.6,.4);n=m.node_tree.nodes;l=m.node_tree.links;n.clear();out=n.new('ShaderNodeOutputMaterial');p=n.new('ShaderNodeBsdfPrincipled');l.new(p.outputs[0],out.inputs[0])
    for kind in ('BaseColor','Normal','ORM'):
        im=bpy.data.images['AKMN_'+category+'_'+kind];t=n.new('ShaderNodeTexImage');t.image=im
        if kind=='BaseColor':l.new(t.outputs['Color'],p.inputs['Base Color'])
        elif kind=='Normal':
            q=n.new('ShaderNodeNormalMap');l.new(t.outputs['Color'],q.inputs['Color']);l.new(q.outputs[0],p.inputs['Normal'])
        else:
            sep=n.new('ShaderNodeSeparateColor');l.new(t.outputs['Color'],sep.inputs[0]);l.new(sep.outputs['Green'],p.inputs['Roughness']);l.new(sep.outputs['Blue'],p.inputs['Metallic'])
            group=bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
            if 'Occlusion' not in [i.name for i in group.interface.items_tree]:group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
            g=n.new('ShaderNodeGroup');g.node_tree=group;l.new(sep.outputs['Red'],g.inputs['Occlusion'])
    obj=bpy.data.objects['AKMN_'+category+'_FP'];obj.data.materials.clear();obj.data.materials.append(m)
    for f in obj.data.polygons:f.material_index=0
arm=bpy.data.armatures.new('AKMN_RigidRig');rig=bpy.data.objects.new('AKMN_Rig',arm);game.objects.link(rig);rig.show_in_front=True
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
definitions={'weapon_root':((0,0,0),None),'weapon_body':((0,0,0),'weapon_root'),'bolt_carrier':((.015,.05,.04),'weapon_body'),'trigger':((0,-.055,-.039),'weapon_body'),'selector':((.02,-.08,.018),'weapon_body'),'mag_release':((0,-.022,-.043),'weapon_body'),'magazine':((0,.102,-.023),'weapon_body'),'magazine_spare':((0,.102,-.023),'weapon_body'),'hand_r':((.028,-.107,-.092),'weapon_body'),'hand_l':((-.030,.186,-.032),'weapon_body')}
sockets={'socket_muzzle':((0,.480,.013),'weapon_body'),'socket_ejection':((.022,.044,.040),'bolt_carrier'),'socket_grip_r':((.028,-.107,-.092),'weapon_body'),'socket_grip_l':((-.030,.186,-.032),'weapon_body'),'socket_magazine':((0,.102,-.023),'weapon_body'),'socket_magazine_grip':((-.025,.091,-.106),'magazine'),'socket_aim':((0,.067,.088),'weapon_body'),'socket_optic':((-.032,-.030,.006),'weapon_body')}
definitions.update(sockets)
for name,(pos,parent) in definitions.items():
    b=arm.edit_bones.new(name);b.head=pos;b.tail=Vector(pos)+Vector((0,.025,0))
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for o in game.objects:
    if o.type=='MESH':
        o.parent=rig;m=o.modifiers.new('Rigid weights','ARMATURE');m.object=rig
spare=bpy.data.objects['AKMN_Magazine_FP'].copy();spare.data=spare.data.copy();game.objects.link(spare);spare.name='AKMN_Magazine_Spare';spare.vertex_groups['magazine'].name='magazine_spare'
spare['visibility_event_control']=True
# Test hands are separate from the deliverable weapon geometry and use the same
# contact-space controls; these are not a claimed production character skeleton.
glove=material('TestGlove',(.025,.034,.029),0,.85);cloth=material('TestSleeve',(.060,.072,.041),0,.93)
start=set(source.objects)
for side,name,origin in [(1,'hand_r',Vector(definitions['hand_r'][0])),(-1,'hand_l',Vector(definitions['hand_l'][0]))]:
    palm=box('TestPalm'+name,origin,(.032,.057,.027),glove,name,.008)
    if side==1:
        palm.rotation_euler.x=.28
        for i in range(4):
            z=-.062-i*.019
            path('FingerR'+str(i),[(.032,-.094,z),(.018,-.088,z-.005),(0,-.085,z-.008),(-.018,-.10,z-.010)],.007,glove,name,10)
        path('ThumbR',[(.036,-.125,-.08),(.025,-.133,-.052),(.004,-.126,-.053)],.008,glove,name,10)
        a=(.03,-.125,-.11);b=(.12,-.26,-.20)
    else:
        for i in range(4):
            y=.164+i*.016
            path('FingerL'+str(i),[(-.032,y,-.031),(-.020,y,-.037),(.008,y,-.036),(.024,y,-.021)],.0064,glove,name,10)
        path('ThumbL',[(-.036,.211,-.028),(-.025,.22,-.011),(-.018,.213,.007)],.007,glove,name,10)
        a=(-.034,.16,-.045);b=(-.16,-.06,-.18)
    tube('TestSleeve'+name,a,b,.026,cloth,name,20)
for o in list(source.objects):
    if o not in start:
        apply(o);group=o.vertex_groups.new(name=o['rigid_bone']);group.add(list(range(len(o.data.vertices))),1,'REPLACE');link(o,helpers);o.parent=rig;m=o.modifiers.new('Contact test rig','ARMATURE');m.object=rig
for b in rig.pose.bones:b.rotation_mode='XYZ'
# Socket axes: local +Y forward in Blender; glTF conversion gives -Z forward.
scene['axis_convention']='metres, Blender +Y forward +Z up +X right; glTF -Z forward +Y up'
rig['contact_rig']='Test hands only; project procedural hands have no skeleton'
save('06_Rig')
result={'bones':len(arm.bones),'rig':rig.name}
