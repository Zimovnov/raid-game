exec(compile(open('/Users/vladimir/Projects/raid-game/art/Glock17_Gen4/scripts/common.py').read(),'common.py','exec'))
root=bpy.data.objects['G17_ROOT']; slide=bpy.data.objects['G17_Slide']
# Fuse the three molded masses while retaining editable profiles.
parts=[bpy.data.objects[n] for n in ('G17_FrameUpper','G17_GripLoft','G17_GuardProfile')]
for o in parts:
    copy=o.copy();copy.data=o.data.copy();helpers.objects.link(copy);copy.name=o.name+'_Construction';copy.hide_render=True;copy.hide_set(True)
    apply(o)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();frame=parts[0];frame.name='G17_Frame'
rem=frame.modifiers.new('Continuous molded polymer','REMESH');rem.mode='VOXEL';rem.voxel_size=.00052;rem.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=rem.name)
sm=frame.modifiers.new('Molded transition smoothing','SMOOTH');sm.factor=.65;sm.iterations=4
bpy.ops.object.modifier_apply(modifier=sm.name)
# Recessed rail channel, with a transverse interruption near the nose.
for side in (-1,1):
    c=cube('G17_RailCut'+str(side),(side*.0145,.160,-.0176),(.003,.052,.003),poly,.00035);apply(c);boolean(frame,c)
c=cube('G17_RailSlot',(0,.162,-.024),(.034,.0032,.004),poly,.00015);apply(c);boolean(frame,c)
# Real opening through the top and right wall; left wall remains intact.
apply(slide)
c=cube('G17_WindowCut',(.004,.086,.008),(.020,.029,.016),steel,.0015);apply(c);boolean(slide,c)
# Seven rear serrations per side, matching the primary sheet; no front cuts.
for side in (-1,1):
    for i in range(7):
        c=cube('G17_SerrationCut_'+str(side)+'_'+str(i),(side*.0129,.0105+i*.00496,-.0005),(.0015,.00235,.0187),steel,.00016);apply(c);boolean(slide,c)
finish(slide,.00012,2)

def cylinder(name,loc,radius,depth,m=steel,axis='Y',vertices=48):
    remove(name);bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;link(o)
    if axis=='Y':o.rotation_euler[0]=math.pi/2
    elif axis=='X':o.rotation_euler[1]=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return finish(o,.00016,2)
# Cosmetic, blind cavities only. No internal functional mechanism.
for name,z,r in [('Muzzle',0,.0061),('Lower',-.0148,.0038)]:
    c=cylinder('G17_'+name+'Aperture',(0,.185,z),r,.018,black)
    apply(c);boolean(slide,c)
barrel=cylinder('G17_BarrelVisual',(0,.142,0),.00585,.091,barrelmat)
apply(barrel)
c=cylinder('G17_BoreVisualCut',(0,.187,0),.00455,.018,black);apply(c);boolean(barrel,c)
cap=cylinder('G17_BoreShadow',(0,.178,0),.0045,.0005,black);apply(cap)
# Combine blind shadow with barrel to retain movement hierarchy.
bpy.ops.object.select_all(action='DESELECT');barrel.select_set(True);cap.select_set(True);bpy.context.view_layer.objects.active=barrel;bpy.ops.object.join()
hood=cube('G17_BarrelHood',(0,.086,.0038),(.0159,.0275,.0111),barrelmat,.00065);hood.parent=barrel
rod=cylinder('G17_LowerRoundVisual',(0,.173,-.0148),.00335,.025,black)
end=cylinder('G17_LowerInset',(0,.186,-.0148),.00165,.0005,steel)
# Rear cover and its fine horizontal exterior ribs.
cover=yz('G17_RearCover',[(395,111),(397,104),(406,101),(450,101),(460,108),(460,141),(395,141)],.014,poly,.0005)
# Replace profile oriented for rear-facing plane with a correctly located cover.
remove(cover.name)
cover=cube('G17_RearCover',(0,-.00025,-.0032),(.015,.0011,.0125),poly,.001)
for i in range(5):
    o=cube('G17_CoverRib_'+str(i),(0,-.00085,-.006+i*.0012),(.014,.00025,.00028),black,.00008);o.parent=cover
# Separate sights, with visible notch and white U.
remove('G17_FrontSight');remove('G17_RearSight')
front=yz('G17_FrontSight',[(991,84),(997,73),(1009,73),(1014,84)],.0038,poly,.00024)
rear=yz('G17_RearSight',[(422,83),(427,69),(439,69),(445,83)],.0175,poly,.00025)
c=cube('G17_NotchCut',(0,.011,.0129),(.0037,.02,.0042),poly,.00005);apply(c);boolean(rear,c)
for name,x,z,w,h in [('Left',-.0033,.0119,.0012,.004),('Right',.0033,.0119,.0012,.004),('Base',0,.00995,.0077,.0011)]:
    o=cube('G17_SightU_'+name,(x,.00805,z),(w,.00013,h),white,.00010);o.parent=rear
pt=cylinder('G17_FrontDot',(0,.1760,.0115),.0011,.00016,white);pt.parent=front
# Trigger outline and center safety, deliberately external only.
trigger=yz('G17_Trigger',[(629,218),(648,222),(649,240),(657,256),(670,269),(689,277),(680,281),(665,277),(650,263),(638,244)],.0068,poly,.00065)
safety=yz('G17_TriggerSafety',[(645,233),(648,244),(659,261),(674,274),(682,277),(675,280),(660,270),(648,252),(642,239)],.0022,black,.0002);safety.parent=trigger
# Asymmetric left controls.
release=cube('G17_MagRelease',(-.0152,.049,-.042),(.0021,.010,.0073),poly,.00045);release.rotation_euler.x=math.radians(-17)
stop=cube('G17_SlideStop',(-.0157,.052,-.013),(.002,.010,.0058),steel,.0004)
for i in range(4):
    o=cube('G17_StopRidge_'+str(i),(-.0168,.052,-.015+i*.0012),(.00022,.009,.00035),steel,.00008);o.parent=stop
for side in (-1,1):
    lock=cube('G17_Takedown_'+str(side),(side*.0147,.096,-.018),(.0014,.0024,.0073),steel,.0002);lock.rotation_euler.x=math.radians(-16)
    for n,u,v,r in [('Trigger',665,186,.0016),('Lock',659,162,.00105),('Backstrap',464,239,.0011)]:
        o=cylinder('G17_Pin_'+n+'_'+str(side),(side*.0146,(u-394)*S,(115-v)*S),r,.0007,steel,'X',32)
# Magazine's hidden section is intentionally approximate, suitable for pose preview only.
mag=bpy.data.objects['G17_Magazine']
body=yz('G17_MagBody',[(411,481),(501,481),(575,269),(491,255)],.021,black,.0012);body.parent=mag
# Small recess in backstrap, visible on primary rear view.
c=cylinder('G17_LanyardVisualCut',(0,-.010,-.101),.00125,.012,black);apply(c);boolean(frame,c)
# Hierarchy preserves movable assemblies.
for o in source.objects:
    if o==root:continue
    if o.parent is None:o.parent=root
for o in (front,rear,cover):o.parent=slide
slide['closed_y']=slide.location.y;slide['open_visual_offset_m']=-.037
root['stage']='detailed_geometry'
# Source portraits on orthographic planes, uniformly scaled, excluded from export/render.
for name in ('right','left','front','rear'):
    remove('G17_Reference_'+name)
    im=bpy.data.images.load(P+'/references/ortho_'+name+'.png',check_existing=True)
    o=bpy.data.objects.new('G17_Reference_'+name,None);refs.objects.link(o);o.empty_display_type='IMAGE';o.data=im;o.empty_display_size=im.size[0]*S;o.color[3]=.35;o.hide_render=True;o.hide_select=True
    if name in ('right','left'):
        o.location=(.035 if name=='right' else -.035,.087,-.052);o.rotation_euler=(math.pi/2,0,math.pi/2 if name=='right' else -math.pi/2)
    else:o.location=(0,.23 if name=='front' else -.06,-.052);o.rotation_euler=(math.pi/2,0,0)
    o.hide_set(True)
scene['preview_stage']='detail';scene['preview_view']='front34'
bpy.ops.wm.save_as_mainfile(filepath=P+'/checkpoints/02_Detail.blend')
result={'source_meshes':len([o for o in source.objects if o.type=='MESH']),'frame_vertices':len(frame.data.vertices)}
