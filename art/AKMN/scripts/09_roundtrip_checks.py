import bpy, json, math, os
from mathutils import Vector
P=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene=bpy.data.scenes['AKMN_Roundtrip'];bpy.context.window.scene=scene
rig=next(o for o in scene.objects if o.type=='ARMATURE');meshes=[o for o in scene.objects if o.type=='MESH' and o.name.startswith('AKMN_')]
tracks={t.name:t.strips[0].action for t in rig.animation_data.nla_tracks}
for t in rig.animation_data.nla_tracks:t.mute=True
studio=bpy.data.scenes['AKMN_Studio'];scene.world=studio.world
for o in studio.objects:
    if o.type=='LIGHT' and o.name not in scene.objects:scene.collection.objects.link(o)
camera=bpy.data.objects.get('AKMN_RoundtripCamera')
if not camera:
    camera=bpy.data.objects.new('AKMN_RoundtripCamera',bpy.data.cameras.new('AKMN_RoundtripCamera'));scene.collection.objects.link(camera)
scene.camera=camera;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
def pose(name,t):
    rig.animation_data.action=tracks[name];rig.animation_data.action_slot=tracks[name].slots[0]
    start,end=tracks[name].frame_range;frame=start+(end-start)*t;scene.frame_set(math.floor(frame),subframe=frame%1)
    for o in meshes:
        if 'Magazine_Spare' in o.name:o.hide_render=not(name.startswith('AKMN_FP_Reload_') and t>=.50)
        elif 'Magazine_FP' in o.name:o.hide_render=name.startswith('AKMN_FP_Reload_') and t>=.47
def view(fps=False,ads=False):
    if fps:
        camera.data.type='PERSP';camera.data.lens_unit='FOV';camera.data.sensor_fit='VERTICAL';camera.data.angle=math.radians(78)
        camera.location=(0 if ads else -.25,-.970,.088 if ads else .213)
        camera.rotation_euler=(math.pi/2,0,0);camera.data.clip_start=.035
    else:
        camera.data.type='ORTHO';camera.data.ortho_scale=1.05;camera.location=(-1.05,.75,.45);camera.rotation_euler=(Vector((0,.025,-.055))-camera.location).to_track_quat('-Z','Y').to_euler()
def render(label):
    scene.render.filepath=P+'/previews/'+label+'.png';bpy.ops.render.render(write_still=True)
checks=[]
for name,a in tracks.items():
    samples=[]
    for t in (0,.17,.25,.5,.75,1):
        pose(name,t);root=rig.pose.bones['weapon_root'];samples.append({'t':t,'root_position':list(root.matrix.translation),'bolt':list(rig.pose.bones['bolt_carrier'].matrix.translation)})
    checks.append({'clip':name,'duration':float((a.frame_range[1]-a.frame_range[0])/scene.render.fps),'root_fixed':all(Vector(x['root_position']).length<1e-5 for x in samples),'samples':samples})
view();pose('AKMN_FP_Fire',0)
for o in meshes:
    if any(s in o.name for s in ('Test','Finger','Thumb')):o.hide_render=True
render('roundtrip_perspective')
for o in meshes:
    if any(s in o.name for s in ('Test','Finger','Thumb')):o.hide_render=False
view(True);pose('AKMN_FP_Fire',0);render('roundtrip_fp')
view(True,True);render('roundtrip_ads')
scene.render.resolution_x=2100;view(True,True);render('roundtrip_ads_21x9');scene.render.resolution_x=1600
for name in ('Reload_Tactical','Reload_Empty'):
    for t in (.17,.29,.64,.90):
        view(True);pose('AKMN_FP_'+name,t);render('roundtrip_'+name+'_'+str(round(t*100)))
open(P+'/roundtrip-checks.json','w').write(json.dumps({'scope':'Clean-scene GLB import, 10 clips sampled individually, root/sockets/materials and visual review. Test hands, not a production humanoid.','clips':checks,'sockets':[b.name for b in rig.data.bones if b.name.startswith('socket_')],'materials':list({m.name for o in meshes for m in o.data.materials}),'mesh_count':len(meshes)},indent=2))
pose('AKMN_FP_Fire',0);view(True)
bpy.data.libraries.write(P+'/checkpoints/09_Roundtrip.blend',{scene},path_remap='RELATIVE',fake_user=True,compress=True)
result={'clips':len(checks),'all_roots_fixed':all(c['root_fixed'] for c in checks)}
