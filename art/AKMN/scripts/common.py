import bpy, math, os, json, bmesh
from mathutils import Vector
P=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def col(name,parent):
    c=bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in parent.children: parent.children.link(c)
    return c
scene=bpy.data.scenes.get('AKMN_Studio') or bpy.data.scenes.new('AKMN_Studio')
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.fps=60
root=col('AKMN_ASSET',scene.collection)
source=col('AKMN_SOURCE',root);studio=col('AKMN_STUDIO',root)
def remove_owned(c):
    for o in list(c.objects): bpy.data.objects.remove(o,do_unlink=True)
def link(o,c=source):
    for old in list(o.users_collection):old.objects.unlink(o)
    c.objects.link(o);return o
def material(name,color,metal,rough):
    m=bpy.data.materials.get('AKMN_'+name) or bpy.data.materials.new('AKMN_'+name)
    m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    m.diffuse_color=(*color,1);return m
steel=material('CoatedSteel',(.055,.064,.070),.78,.38)
edge=material('BareSteel',(.13,.145,.15),.92,.32)
wood=material('Walnut',(.13,.042,.018),0,.36)
poly=material('Bakelite',(.07,.015,.012),0,.48)
black=material('Recess',(.006,.008,.009),.3,.65)
def finish(o,bevel=.0005,segments=3):
    if bevel:
        m=o.modifiers.new('Small manufactured edge radius','BEVEL');m.width=bevel;m.segments=segments
    m=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');m.keep_sharp=True
    return o
def mesh(name,vs,fs,mat=steel,bone='weapon_body',bevel=.0005):
    me=bpy.data.meshes.new('AKMN_'+name);me.from_pydata(vs,[],fs);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new('AKMN_'+name,me);source.objects.link(o);me.materials.append(mat);o['rigid_bone']=bone
    return finish(o,bevel)
def box(name,loc,size,mat=steel,bone='weapon_body',bevel=.0005):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=link(bpy.context.object);o.name='AKMN_'+name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);o['rigid_bone']=bone
    return finish(o,bevel)
def profile(name,points,width,mat=steel,bone='weapon_body',bevel=.0007,x=0):
    n=len(points);vs=[(x+side*width/2,y,z) for side in (-1,1) for y,z in points]
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,mat,bone,bevel)
def tube(name,a,b,r,mat=steel,bone='weapon_body',vertices=32):
    d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2)
    o=link(bpy.context.object);o.name='AKMN_'+name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);o['rigid_bone']=bone
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return finish(o,.00025,2)
def path(name,points,r,mat=steel,bone='weapon_body',sides=8):
    vs=[]
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        q=tangent.to_track_quat('Z','Y')
        vs.extend(Vector(p)+q@Vector((math.cos(j*2*math.pi/sides)*r,math.sin(j*2*math.pi/sides)*r,0)) for j in range(sides))
    fs=[tuple(range(sides-1,-1,-1)),tuple(range(len(vs)-sides,len(vs)))]+[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(len(points)-1) for j in range(sides)]
    o=mesh(name,vs,fs,mat,bone,0)
    for f in o.data.polygons:f.use_smooth=True
    return o
def loft(name,rings,mat=wood,bone='weapon_body',sides=16):
    # y, z centre, width, height; rounded rectangle sections preserve flat sides.
    vs=[]
    for y,z,w,h in rings:
        for j in range(sides):
            a=j*2*math.pi/sides;cx=math.cos(a);sz=math.sin(a)
            vs.append((math.copysign(abs(cx)**.48,cx)*w/2,y,z+math.copysign(abs(sz)**.48,sz)*h/2))
    fs=[tuple(range(sides-1,-1,-1)),tuple(range(len(vs)-sides,len(vs)))]+[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(len(rings)-1) for j in range(sides)]
    o=mesh(name,vs,fs,mat,bone,.001)
    for f in o.data.polygons:f.use_smooth=True
    return o
def apply(o):
    bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
    for m in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=m.name)
def cut(o,cutter):
    apply(cutter);bpy.context.view_layer.objects.active=o
    m=o.modifiers.new('Visible opening','BOOLEAN');m.operation='DIFFERENCE';m.object=cutter
    bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(cutter,do_unlink=True)
def aim(o,at):o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
def setup_studio():
    remove_owned(studio)
    world=bpy.data.worlds.get('AKMN_World') or bpy.data.worlds.new('AKMN_World');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.19,.22,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45;scene.world=world
    for name,loc,power,size,color in [('Key',(-.6,.1,1.0),70,1.2,(1,.94,.86)),('Fill',(.8,-.4,.5),55,.9,(.78,.88,1)),('Rim',(-.2,.6,.3),45,.7,(1,1,1))]:
        data=bpy.data.lights.new('AKMN_'+name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
        o=bpy.data.objects.new('AKMN_'+name,data);studio.objects.link(o);o.location=loc;aim(o,(0,0,0))
    data=bpy.data.cameras.new('AKMN_Camera');o=bpy.data.objects.new('AKMN_Camera',data);studio.objects.link(o);scene.camera=o
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
def view(kind):
    cam=scene.camera;cam.data.type='ORTHO';cam.data.ortho_scale=1.02;target=(0,.025,-.055)
    poses={'left':(-1.5,.025,.05),'right':(1.5,.025,.05),'top':(0,.025,1.5),'front':(0,1.5,.03),'perspective':(-1.05,.75,.45),'rear34':(.85,-1,.43),'rail':(-.5,-.16,.17)}
    cam.location=poses.get(kind,poses['perspective'])
    if kind=='rail':target=(-.025,-.02,.01);cam.data.ortho_scale=.38
    aim(cam,target)
def render(stage,kind):
    view(kind);scene.render.filepath=P+'/previews/'+stage+'_'+kind+'.png';bpy.ops.render.render(write_still=True)
def save(stage):bpy.ops.wm.save_as_mainfile(filepath=P+'/checkpoints/'+stage+'.blend',copy=True)
