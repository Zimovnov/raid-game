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

