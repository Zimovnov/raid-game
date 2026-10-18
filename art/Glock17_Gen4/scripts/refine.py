exec(compile(open('/Users/vladimir/Projects/raid-game/art/Glock17_Gen4/scripts/common.py').read(),'common.py','exec'))
# common helpers reset base materials: source material setup runs again after this stage.
root=bpy.data.objects['G17_ROOT'];slide=bpy.data.objects['G17_Slide'];frame=bpy.data.objects['G17_Frame']
for o in source.objects:o.hide_set(False);o.hide_render=False
# Curved external front shroud reconstructed from the primary front view.
profile=[(-12.75,9.68),(12.75,9.68),(12.75,-11),(11.2,-16.8),(7.5,-20.6),(3.5,-22.5),(0,-23.2),(-3.5,-22.5),(-7.5,-20.6),(-11.2,-16.8),(-12.75,-11)]
def xz(name,profile,ya,yb,material):
 n=len(profile);v=[(x*.001,y,z*.001) for y in (ya,yb) for x,z in profile]
 f=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 o=mesh(name,v,f,material)
 import bmesh
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free();return o
# front cavity in polymer leaves its lower perimeter, like the orthographic front sheet.
cut=xz('G17_FrontFrameSeat',[(x*1.015,z-.1) for x,z in profile],.181,.193,poly);boolean(frame,cut)
nose=finish(xz('G17_Nose',profile,.1841,.1861,steel),.00035,3);apply(nose)
for label,z,r in [('Upper',0,.0061),('Lower',-.0148,.0038)]:
 remove('G17_NoseCut_'+label);bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=.014,location=(0,.186,z),rotation=(math.pi/2,0,0));c=bpy.context.object;c.name='G17_NoseCut_'+label;link(c);boolean(nose,c)
nose.parent=slide;nose.matrix_parent_inverse=slide.matrix_world.inverted()
# A round inset at the lower opening remains external/cosmetic.
o=bpy.data.objects['G17_LowerRoundVisual'];o.location.y=.173
# Rounded upper corners on the slide's back plate.
cover=bpy.data.objects['G17_RearCover'];oldparent=cover.parent;oldname=cover.name
for child in list(cover.children):
 world=child.matrix_world.copy();child.parent=root;child.matrix_world=world
remove(oldname)
cover=finish(xz('G17_RearCover',[(-7.5,-9.3),(7.5,-9.3),(7.5,0),(6.2,2.6),(4,3.1),(-4,3.1),(-6.2,2.6),(-7.5,0)],-.00075,.0004,poly),.00045,3)
cover.parent=slide;cover.matrix_parent_inverse=slide.matrix_world.inverted()
# Visible extractor block on the right, near the rear edge of the port.
ext=cube('G17_Extractor',(.0128,.0665,.004),(.0009,.0107,.0051),steel,.0007);ext.parent=slide;ext.matrix_parent_inverse=slide.matrix_world.inverted()
# Magazine release has shallow ribs, joined to the fixed frame in LOD0.
for i in range(7):
 o=cube('G17_ReleaseRib_'+str(i),(-.0164,.045+i*.0011,-.042),(.00025,.00028,.006),black,.00006);o.rotation_euler.x=math.radians(-17);o.parent=root
scene['stage']='front_rear_refinement'
result={'refined':'front shroud, rounded backplate, extractor and release ribs'}
