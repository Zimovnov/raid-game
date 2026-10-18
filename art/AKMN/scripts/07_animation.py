exec(compile(open(__file__.replace('07_animation.py','common.py')).read(),__file__.replace('07_animation.py','common.py'),'exec'))
rig=bpy.data.objects['AKMN_Rig'];rig.animation_data_clear()
for a in list(bpy.data.actions):
    if a.name.startswith('AKMN_FP_'):bpy.data.actions.remove(a)
def smooth(t):
    t=max(0,min(1,t));return t*t*t*(10+t*(-15+6*t))
def between(t,a,b):return smooth((t-a)/(b-a))
def lerp(a,b,t):return Vector(a).lerp(Vector(b),t)
def sequence(t,keys):
    for (a,va),(b,vb) in zip(keys,keys[1:]):
        if a<=t<=b:return lerp(va,vb,between(t,a,b))
    return Vector(keys[0][1] if t<keys[0][0] else keys[-1][1])
specs=[('Draw',.75,False),('Holster',.65,False),('Fire',.105,False),('DryFire',.28,False),('Reload_Tactical',2.9,False),('Reload_Empty',3.8,False),('Check_Mag',2.05,False),('Inspect',4.2,False),('Selector_Auto',.32,False),('Selector_Semi',.32,False)]
controls=['weapon_body','bolt_carrier','trigger','selector','mag_release','magazine','magazine_spare','hand_l','hand_r']
manifest={'authoringFPS':60,'units':'metres','axes':{'blender':'+Y forward,+Z up,+X right','gltf':'-Z forward,+Y up,+X right'},'bodyMotionOwner':'authored during reload/inspect/draw/holster; game during locomotion/ADS/recoil','clips':[],'procedural':{'AKMN_FP_Idle':'existing breathing controller','AKMN_FP_ADS_In':'existing aim blend, 0.24 s','AKMN_FP_ADS_Idle':'existing aim controller','AKMN_FP_ADS_Out':'existing aim blend, 0.24 s','AKMN_FP_Walk':'existing travelled-distance sway','AKMN_FP_Sprint_In':'existing sprint blend','AKMN_FP_Sprint_Loop':'existing sprint and stride controller','AKMN_FP_Sprint_Out':'existing sprint blend'},'poses':{'aimHeight':.088,'support':[-.03,-.032,-.186],'rightGrip':[.028,-.092,.107],'muzzle':[0,.013,-.480],'sprintEulerXYZ':[-.32,.08,.12]},'sockets':{b.name:{'positionBlender':list(b.head_local),'parent':b.parent.name if b.parent else None,'forwardLocal':'+Y'} for b in rig.data.bones if b.name.startswith('socket_')},'visibilityPolicy':'magazine_spare initially hidden; events change enabled mesh, never scale or Blender hide keys','stateAuthority':'all events visual notifications only; inventory, fire and reload commit remain simulation-owned'}
for short,duration,loop in specs:
    frames=round(duration*60);duration=frames/60
    action=bpy.data.actions.new('AKMN_FP_'+short);action.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=action
    for frame in range(frames+1):
        t=frame/frames
        for b in rig.pose.bones:b.location=(0,0,0);b.rotation_euler=(0,0,0);b.scale=(1,1,1)
        body=rig.pose.bones['weapon_body'];mag=rig.pose.bones['magazine'];new=rig.pose.bones['magazine_spare'];hand=rig.pose.bones['hand_l'];bolt=rig.pose.bones['bolt_carrier'];trigger=rig.pose.bones['trigger']
        new.location=(-.18,-.06,-.32)
        if short in ('Draw','Holster'):
            a=1-smooth(t) if short=='Draw' else smooth(t);body.location=(.025*a,-.08*a,-.22*a);body.rotation_euler=(.32*a,.15*a,-.08*a)
        elif short in ('Fire','DryFire'):
            p=math.sin(math.pi*t)**2;trigger.rotation_euler.x=-.20*p
            if short=='Fire':bolt.location.y=-.068*(between(t,0,.28)*(1-between(t,.28,.93)))
        elif short.startswith('Reload') or short=='Check_Mag':
            check=short=='Check_Mag';env=between(t,0,.13)*(1-between(t,.87,1));body.rotation_euler=(.12*env,-.30*env,.16*env);body.location=(-.025*env,-.025*env,.015*env)
            keys=[(0,(0,0,0)),(.20,(0,0,0)),(.28,(0,.017,-.029)),(.42,(-.14,-.025,-.21)),(.50,(-.18,-.06,-.32)),(1,(-.18,-.06,-.32))]
            if check:keys=[(0,(0,0,0)),(.20,(0,0,0)),(.32,(-.025,.012,-.06)),(.60,(-.025,.012,-.06)),(.77,(0,.017,-.029)),(.84,(0,0,0)),(1,(0,0,0))]
            mag.location=sequence(t,keys);mag.rotation_euler.x=-.35*between(t,.20,.28)*(1-between(t,.72,.84) if check else 1)
            if not check:
                new.location=sequence(t,[(0,(-.18,-.06,-.32)),(.50,(-.18,-.06,-.32)),(.64,(-.03,.018,-.085)),(.74,(0,.017,-.029)),(.81,(0,0,0)),(1,(0,0,0))]);new.rotation_euler.x=-.35*(1-between(t,.74,.81))
            rig.pose.bones['mag_release'].rotation_euler.x=-.25*between(t,.13,.2)*(1-between(t,.25,.32))
            active=mag if check or t<.50 else new
            target=active.location+Vector((-.025,.091,-.106))-hand.bone.head_local
            # Contact uses the magazine bone rotation, keeping palm fixed in its space.
            pivot=Vector((0,.102,-.023));local=Vector((-.025,.091,-.106))-pivot
            target=active.location+pivot+active.rotation_euler.to_matrix()@local-hand.bone.head_local
            contact=between(t,.06,.17)*(1-between(t,.82,.91));hand.location=target*contact;hand.rotation_euler.x=active.rotation_euler.x*contact
            if short=='Reload_Empty':
                rack=between(t,.865,.9)*(1-between(t,.915,.95));bolt.location.y=-.068*rack
                reach=between(t,.82,.86)*(1-between(t,.95,1));hand.location=lerp(hand.location,Vector((.047,.055-.068*rack,.041))-hand.bone.head_local,reach);hand.rotation_euler.y=-1.2*reach
        elif short=='Inspect':
            body.rotation_euler=sequence(t,[(0,(0,0,0)),(.23,(.05,-.85,.22)),(.42,(.05,-.85,.22)),(.66,(.12,.80,-.18)),(.82,(.12,.80,-.18)),(1,(0,0,0))]);body.location.z=.035*math.sin(math.pi*t)**2
        elif short.startswith('Selector'):
            rig.pose.bones['selector'].rotation_euler.x=.20*(smooth(t) if short.endswith('Semi') else 1-smooth(t))
        for name in controls:
            b=rig.pose.bones[name];b.keyframe_insert(data_path='location',frame=frame,group=name);b.keyframe_insert(data_path='rotation_euler',frame=frame,group=name)
    events=[]
    def event(name,t):
        frame=round(t*frames);events.append({'name':name,'frame':frame,'seconds':frame/60,'normalized':frame/frames});action.pose_markers.new(name).frame=frame
    if short.startswith('Reload'):
        for name,t in [('hand_contact',.17),('magazine_detach',.20),('magazine_old_hide',.47),('magazine_new_show',.50),('magazine_attach',.81),('reload_commit',.81),('weapon_ready',1)]:event(name,t)
        if short=='Reload_Empty':event('bolt_pull',.9);event('bolt_return',.95)
    elif short=='Check_Mag':
        for name,t in [('hand_contact',.17),('magazine_detach',.20),('magazine_attach',.84),('weapon_ready',1)]:event(name,t)
    else:event('weapon_ready',1)
    events.sort(key=lambda e:e['frame'])
    action.use_frame_range=True;action.frame_start=0;action.frame_end=frames
    track=rig.animation_data.nla_tracks.new();track.name=action.name;strip=track.strips.new(action.name,0,action);track.mute=True
    manifest['clips'].append({'name':action.name,'duration':duration,'fps':60,'loop':loop,'startState':'holstered' if short=='Draw' else 'ready_empty' if short=='Reload_Empty' else 'ready','endState':'holstered' if short=='Holster' else 'ready','sockets':list(manifest['sockets']),'animatedChannels':controls,'gameChannels':['world_root','camera_recoil','locomotion','ADS','ammo','fire_permission'],'events':events,'interruptWindows':[[0,.17],[.96,1]] if short.startswith('Reload') else [[0,1]],'interruptionPolicy':'reset visual pose/visibility from authoritative inventory; never commit ammo from clip'})
rig.animation_data.action=None
for b in rig.pose.bones:b.location=(0,0,0);b.rotation_euler=(0,0,0)
rig.pose.bones['magazine_spare'].location=(-.18,-.06,-.32)
bpy.data.objects['AKMN_Magazine_Spare'].hide_render=True;bpy.data.objects['AKMN_Magazine_Spare'].hide_set(True)
scene.frame_set(0);scene.frame_start=0;scene.frame_end=252
open(P+'/animation-manifest.json','w').write(json.dumps(manifest,indent=2,ensure_ascii=False))
save('07_Animated');render('07','perspective')
result={'clips':[x['name'] for x in manifest['clips']],'procedural':list(manifest['procedural'])}
