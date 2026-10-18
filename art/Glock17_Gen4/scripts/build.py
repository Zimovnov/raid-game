import bpy, math, os, json
from mathutils import Vector
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4'
S=.186/634

def collection(name,parent):
    c=bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in parent.children: parent.children.link(c)
    return c
if bpy.context.scene.name != 'G17_Asset':
    scene=bpy.data.scenes.get('G17_Asset') or bpy.data.scenes.new('G17_Asset')
    bpy.context.window.scene=scene
scene=bpy.context.scene
scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
rootcol=collection('G17_GEN4',scene.collection)
source=collection('SOURCE',rootcol); refs=collection('REFERENCES',rootcol)
helpers=collection('HELPERS',rootcol); game=collection('GAME_LOD0',rootcol); studio=collection('STUDIO',rootcol)
refs.hide_render=True; refs.hide_select=True; helpers.hide_render=True

def remove(name):
    o=bpy.data.objects.get(name)
    if o: bpy.data.objects.remove(o,do_unlink=True)
def link(o,c=source):
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o); return o

def mat(name,col,metal=0,rough=.6):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*col,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    m.diffuse_color=(*col,1); return m
poly=mat('G17_Polymer',(.041,.046,.048),0,.72)
steel=mat('G17_NitridedSteel',(.068,.077,.083),.82,.38)
barrelmat=mat('G17_BarrelSteel',(.083,.091,.096),.88,.33)
black=mat('G17_Recess',(.009,.011,.013),.15,.7)
white=mat('G17_SightPaint',(.82,.85,.79),0,.55)
clay=mat('G17_Clay',(.4,.42,.44),0,.7)

def mesh(name,v,f,m=poly):
    remove(name); me=bpy.data.meshes.new(name+'_Mesh');me.from_pydata(v,[],f);me.update()
    o=bpy.data.objects.new(name,me);source.objects.link(o)
    o.data.materials.append(m)
    return o

def finish(o,width=.0006,segments=3):
    if width:
        mod=o.modifiers.new('Edge radii','BEVEL');mod.width=width;mod.segments=segments
    n=o.modifiers.new('Area weighted normals','WEIGHTED_NORMAL');n.keep_sharp=True;n.weight=40
    return o

def cube(name,loc,size,m=poly,bevel=.0006):
    remove(name);bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;link(o);o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(m);return finish(o,bevel)

def yz(name,points,width,m=poly,bevel=.0006):
    # Points are ordered as seen on the main right-hand reference.
    ps=[((u-394)*S,(115-v)*S) for u,v in points]; n=len(ps)
    vs=[(x,y,z) for x in (-width/2,width/2) for y,z in ps]
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=mesh(name,vs,fs,m)
    import bmesh
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
    return finish(o,bevel)

def apply(o):
    bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)

def boolean(o,cutter):
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Cut '+cutter.name,'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    # Evaluate cutters before the difference, retaining editable copies in HELPERS.
    bpy.ops.object.modifier_apply(modifier=mod.name)
    link(cutter,helpers);cutter.hide_render=True;cutter.hide_set(True)

remove('G17_ROOT');root=bpy.data.objects.new('G17_ROOT',None);source.objects.link(root)
root['origin']='Rear slide face on bore-height centerline; meters; Blender +Y forward +Z up; glTF -Z forward +Y up.'
root['reference_priority']='image-1, image-3 volume/open, image-2 surface; 9x19'
root['stage']='major_forms'
# Large masses, traced from reference 1 without nonuniform image scaling.
slide=cube('G17_Slide',(0,.093, (115-116)*S),(.0255,.186,68*S),steel,.0009)
frame=yz('G17_FrameUpper',[(394,151),(1028,151),(1028,187),(1024,197),(786,203),(757,204),(630,214),(608,247),(580,290),(550,287),(535,253),(488,243),(453,213),(433,191),(397,180),(390,169)],.029,poly,.0016)
# Shaped loft: each section changes width, front and back, including Gen4 finger grooves.
sections=[(182,428,629,12.6),(198,439,629,14.0),(218,448,622,14.5),(242,448,614,14.7),(260,440,605,14.8),(278,431,598,14.9),(296,422,592,15.0),(313,413,585,15.0),(330,403,580,14.9),(341,397,587,14.8),(351,391,580,14.7),(367,382,567,14.5),(383,373,561,14.3),(395,367,566,14.2),(407,362,558,14.1),(425,356,548,13.9),(444,351,536,13.8),(461,350,538,13.7),(474,352,538,13.5),(483,374,528,12.9),(489,397,513,12.0)]
v=[];f=[];N=32
for px,back,front,half in sections:
    yc=((back+front)/2-394)*S;ry=(front-back)/2*S
    for i in range(N):
        a=2*math.pi*i/N;co=math.cos(a);si=math.sin(a)
        v.append((half*.001*math.copysign(abs(co)**.48,co),yc+ry*math.copysign(abs(si)**.58,si),(115-px)*S))
for j in range(len(sections)-1):
    for i in range(N): a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
f += [tuple(range(N-1,-1,-1)),tuple((len(sections)-1)*N+i for i in range(N))]
grip=mesh('G17_GripLoft',v,f)
# Annular guard with deliberate outer and inner profiles, not a torus.
outer=[(623,204),(741,202),(773,211),(784,227),(777,265),(782,296),(749,301),(649,302),(620,290),(592,292),(600,255),(609,224)]
inner=[(634,217),(736,216),(754,228),(759,241),(758,263),(751,278),(733,286),(650,287),(633,279),(625,270),(624,250),(625,232)]
v=[]
for x in (-.0068,.0068):
    for pts in (outer,inner):v.extend((x,(u-394)*S,(115-z)*S) for u,z in pts)
n=len(outer);f=[]
for i in range(n):
    j=(i+1)%n
    f.extend([(i,j,j+n,i+n),(i+2*n,i+3*n,j+3*n,j+2*n),(i,i+2*n,j+2*n,j),(i+n,j+n,j+3*n,i+3*n)])
guard=finish(mesh('G17_GuardProfile',v,f),.0011)
mag=yz('G17_Magazine',[(396,489),(514,489),(514,510),(505,516),(374,516),(374,509),(384,500)],.0265,poly,.0009)
# neutral blockout sights to check total height and alignment.
front=cube('G17_FrontSight',(0,.178,.0109),(.0038,.006,.0041),poly,.0003)
rear=cube('G17_RearSight',(0,.011,.0112),(.018,.007,.005),poly,.00035)
for o in list(source.objects):
    if o!=root:o.parent=root
# Studio camera and lighting remain isolated from the original untouched scene.
remove('G17_Camera');camd=bpy.data.cameras.new('G17_Camera');cam=bpy.data.objects.new('G17_Camera',camd);studio.objects.link(cam);scene.camera=cam
camd.type='ORTHO';camd.ortho_scale=.24;camd.clip_start=.001;camd.clip_end=10
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.world=bpy.data.worlds.new('G17_StudioWorld') if not bpy.data.worlds.get('G17_StudioWorld') else bpy.data.worlds['G17_StudioWorld']
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.15,.17,.19,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55
for name,loc,power,size in [('Key',(-.3,.15,.35),18,.35),('Fill',(.25,.05,.15),10,.3),('Rim',(.1,-.3,.2),16,.25)]:
    remove('G17_'+name);ld=bpy.data.lights.new('G17_'+name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size
    o=bpy.data.objects.new('G17_'+name,ld);studio.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,.08,-.03))-o.location).to_track_quat('-Z','Y').to_euler()
scene.view_settings.view_transform='AgX'
scene['asset_output']=P
bpy.ops.wm.save_as_mainfile(filepath=P+'/checkpoints/01_MajorForms.blend')
result={'stage':'major_forms','objects':len(source.objects)}
