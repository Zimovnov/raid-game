"""Original RAID GAME rigid character art. Run only after the global reference gate opens.

No bpy state, mesh or image is created on import. Blender background process only:
Blender --background art/overhaul/Blender_Initial_Scene.blend --python tools/art/build_character_overhaul.py -- --build
The existing source scene is read-only; all outputs have their own isolated scene.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import sys

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'public/assets/art-overhaul/characters'
SOURCE = ROOT / 'art/overhaul/character_sources'
JOINTS = ['torso','pelvis','head','upperL','upperR','foreL','foreR','thighL','thighR','shinL','shinR','footL','footR']
JACKETS = ['acu','afghanka','bdu','fleece','g4','gorka','kombat','m65','softshell','sumrak']
TROUSERS = ['acu','afghanka','bdu','g4','gorka','kombat','softshell','sumrak']
HEADWEAR = ['balaclava','bandana','boonie','fleece','patrol','watch']
GLOVES = ['coyote','fingerless','leather','olive']
BOOTS = ['desert','hiking','jungle','leather']
IDS = ['body'] + [f'face_{n:02}' for n in range(12)] + ['jacket_'+n for n in JACKETS] + ['trousers_'+n for n in TROUSERS] + ['head_'+n for n in HEADWEAR] + ['gloves_'+n for n in GLOVES] + ['boots_'+n for n in BOOTS]

# Authored proportional profiles: temple / zygoma / jaw / chin width, cranial
# height, jaw height, nasal projection, brow prominence and subtle asymmetry.
FACES = [
 (.112,.126,.105,.048,.141,-.128,.025,.006,0),
 (.102,.116,.083,.039,.150,-.142,.032,.004,0),
 (.119,.132,.119,.060,.130,-.126,.027,.011,0),
 (.116,.129,.102,.044,.132,-.119,.023,.003,0),
 (.104,.135,.081,.035,.142,-.133,.026,.005,0),
 (.110,.130,.112,.038,.140,-.130,.029,.005,0),
 (.098,.113,.080,.035,.151,-.145,.031,.003,0),
 (.113,.123,.107,.059,.139,-.125,.030,.012,0),
 (.109,.120,.087,.041,.137,-.127,.023,.007,0),
 (.104,.126,.090,.037,.145,-.139,.028,.010,0),
 (.120,.130,.121,.055,.149,-.131,.026,.005,0),
 (.112,.124,.108,.048,.140,-.126,.027,.006,.003),
]
# Flat front/back panels and oblique side facets, not circular limb cylinders.
SECTION = [(0,-1),(.60,-.98),(.91,-.66),(1,-.05),(.88,.69),(.48,.98),(0,1),(-.48,.98),(-.88,.69),(-1,-.05),(-.91,-.66),(-.60,-.98)]
LOW_SECTION = [(0,-1),(.95,-.65),(.85,.70),(0,1),(-.85,.70),(-.95,-.65)]


def layer_for(identifier):
    return 'headwear' if identifier.startswith('head_') else identifier.split('_')[0]


def check_gate():
    audit = json.loads((ROOT/'art/overhaul/reference-audit.json').read_text())
    if audit.get('modelingGate') != 'OPEN':
        raise RuntimeError('Global reference gate is closed. No target art may be created.')
    approvals = json.loads((ROOT/'art/overhaul/reference-approvals.json').read_text())
    for identifier in IDS:
        category = 'characters' if identifier == 'body' or identifier.startswith('face_') else 'apparel'
        brief = ROOT/f'art/overhaul/briefs/{category}/{identifier}.md'
        approval = approvals.get(category+'/'+identifier, {})
        if approval.get('status') != 'PASSED' or hashlib.sha256(brief.read_bytes()).hexdigest() != approval.get('briefSha256'):
            raise RuntimeError('Missing or stale approved brief: '+identifier)


class Artist:
    def __init__(self, identifier, lod, materials):
        self.identifier, self.layer, self.lod, self.materials = identifier, layer_for(identifier), lod, materials
        self.parts = []

    def mesh(self, name, joint, vertices, faces, mat='cloth', uv=None):
        import bpy
        import bmesh
        mesh = bpy.data.meshes.new(self.identifier+'_'+name)
        # Game X/Y/Z -> Blender X/-Z/Y, then glTF export restores game Y-up.
        mesh.from_pydata([(x,-z,y) for x,y,z in vertices],[],faces)
        if mesh.validate(verbose=False):
            raise ValueError('Invalid topology: '+name)
        bm=bmesh.new(); bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
        mesh.update()
        texture=mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            axis=max(range(3),key=lambda k:abs(poly.normal[k]))
            plane=[k for k in range(3) if k!=axis]
            for li in poly.loop_indices:
                vi=mesh.loops[li].vertex_index
                if uv:
                    texture.data[li].uv=uv(poly.index,vi)
                else:
                    co=mesh.vertices[vi].co
                    texture.data[li].uv=(co[plane[0]]/.45,co[plane[1]]/.45)
        obj=bpy.data.objects.new(mesh.name,mesh)
        bpy.context.scene.collection.objects.link(obj)
        material=self.materials[mat]
        obj.data.materials.append(material)
        obj['assetKey']=self.identifier+'_'+joint
        obj['lod']=self.lod; obj['raidLayer']=self.layer; obj['raidJoint']=joint
        obj['materialRole']=material['role']
        obj['originalArtwork']='RAID GAME; original authored geometry; no reference pixels'
        self.parts.append(obj)
        return obj

    def loft(self,name,joint,sections,mat='cloth',center=(0,0,0),detail=True,cap=True):
        # section: (height, half width, front depth, back depth, x offset, z offset)
        base=SECTION if self.lod==0 and detail else LOW_SECTION
        count=len(base); vertices=[]; distances=[]
        for row,section in enumerate(sections):
            y,w,front,back,*offsets=section
            dx,dz=(offsets+[0,0])[:2]
            ring=[]
            for n,(x,z) in enumerate(base):
                ring.append((center[0]+x*w+dx,center[1]+y,center[2]+z*(front if z<0 else back)+dz))
            vertices+=ring
            ds=[0]
            for n in range(count):
                a,b=ring[n],ring[(n+1)%count]
                ds.append(ds[-1]+math.dist((a[0],a[2]),(b[0],b[2])))
            distances.append(ds)
        faces=[]
        for row in range(len(sections)-1):
            for col in range(count):
                faces.append((row*count+col,row*count+(col+1)%count,(row+1)*count+(col+1)%count,(row+1)*count+col))
        side_count=len(faces)
        if cap: faces += [tuple(range(count-1,-1,-1)),tuple((len(sections)-1)*count+n for n in range(count))]
        def uv(poly,vi):
            row,col=divmod(vi,count)
            if poly<side_count:
                seam=poly%count==count-1 and col==0
                return (distances[row][-1 if seam else col]/.45,(sections[row][0]+center[1])/.45)
            point=vertices[vi]
            return (point[0]/.45,point[2]/.45)
        return self.mesh(name,joint,vertices,faces,mat,uv)

    def panel(self,name,joint,outline,depth,mat='cloth',center=(0,0,0),axis='z',angle=0):
        # Soft chamfered panels and pockets use explicitly cut polygon outlines.
        v=[]; count=len(outline)
        for d in [-depth/2,depth/2]:
            for a,b in outline:
                a,b=a*math.cos(angle)-b*math.sin(angle),a*math.sin(angle)+b*math.cos(angle)
                co=(a,b,d) if axis=='z' else (d,b,a) if axis=='x' else (a,d,b)
                v.append(tuple(co[k]+center[k] for k in range(3)))
        faces=[tuple(range(count-1,-1,-1)),tuple(range(count,count*2))]
        faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        return self.mesh(name,joint,v,faces,mat)

    def patch(self,name,joint,p,w,h,d=.008,mat='reinforce',angle=0,axis='z'):
        outline=[(-w*.44,-h/2),(w*.44,-h/2),(w/2,-h*.36),(w/2,h*.42),(w*.40,h/2),(-w*.40,h/2),(-w/2,h*.42),(-w/2,-h*.36)] if not self.lod else [(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]
        return self.panel(name,joint,outline,d,mat,p,axis,angle)

    def pocket(self,name,joint,p,w,h,d=.024,angle=0,axis='z',bellows=True):
        # Faceted bellows front tapers into the garment rather than a floating box.
        self.patch(name,joint,p,w,h,d,'cloth',angle,axis)
        front=list(p); front[2 if axis=='z' else 0]+=(-1 if (axis=='z' and p[2]<0) or (axis=='x' and p[0]<0) else 1)*(d/2+.003)
        front[1]+=h*.33
        self.patch(name+'_flap',joint,front,w*.99,h*.25,.006,'reinforce',angle,axis)
        if not self.lod and bellows:
            front[1]-=h*.43
            self.patch(name+'_pleat',joint,front,w*.055,h*.52,.003,'seam',angle,axis)

    def bar(self,name,joint,a,b,width=.003,mat='seam'):
        from mathutils import Vector
        start,end=Vector(a),Vector(b); direction=(end-start).normalized()
        basis=direction.cross(Vector((0,0,1)))
        if basis.length<.1: basis=direction.cross(Vector((1,0,0)))
        basis.normalize(); other=direction.cross(basis).normalized()
        verts=[tuple(p+basis*x*width/2+other*y*width/2) for p in [start,end] for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        return self.mesh(name,joint,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)


def body(a):
    a.loft('ribcage','torso',[(-.24,.151,.087,.083),(-.13,.155,.087,.086),(.02,.185,.107,.095),(.16,.207,.101,.09),(.22,.194,.075,.074),(.25,.096,.055,.055)],'skin')
    a.loft('pelvis','pelvis',[(-.065,.168,.091,.092),(.01,.181,.10,.10),(.065,.166,.086,.087)],'skin')
    a.loft('hidden_neck_core','head',[(-.21,.035,.029,.03),(-.15,.037,.031,.03)],'skin',center=(0,0,.01))
    for side in 'LR':
        a.loft('deltoid_'+side,'upper'+side,[(-.31,.051,.054,.056),(-.25,.054,.06,.061),(-.13,.065,.069,.072),(-.02,.070,.077,.078),(.009,.040,.053,.053)],'skin')
        a.loft('forearm_'+side,'fore'+side,[(-.27,.035,.038,.038),(-.20,.041,.045,.044),(-.07,.056,.058,.056),(.018,.05,.052,.052)],'skin')
        hand(a,side,'skin',bare=True)
        a.loft('thigh_'+side,'thigh'+side,[(-.35,.057,.061,.064),(-.27,.061,.067,.072),(-.12,.072,.073,.080),(.012,.079,.078,.086)],'skin')
        a.loft('calf_'+side,'shin'+side,[(-.325,.044,.048,.046),(-.24,.051,.05,.061),(-.12,.065,.058,.081),(-.02,.061,.067,.07),(.018,.060,.065,.069)],'skin')
        a.loft('foot_'+side,'foot'+side,[(-.085,.068,.164,.075),(-.055,.071,.17,.075),(-.015,.061,.123,.066),(.055,.047,.05,.05)],'skin')


def hand(a,side,material,bare=False,fingerless=False):
    joint='fore'+side; sign=-1 if side=='L' else 1
    first_part=len(a.parts)
    radius=.84 if bare else 1.05
    a.loft('palm_'+side,joint,[(-.323,.052*radius,.035*radius,.035*radius),(-.296,.058*radius,.043*radius,.037*radius),(-.267,.048*radius,.041*radius,.035*radius),(-.245,.036*radius,.038*radius,.034*radius)],material)
    for n in range(4):
        x=(-.040+n*.027)
        end=[-.350,-.358,-.354,-.344][n]
        covered_end=end+.011 if fingerless else end
        a.loft('finger_'+side+str(n),joint,[(covered_end,.010*radius,.013*radius,.011*radius,x,.024 if fingerless else .035),((end-.321)/2,.012*radius,.015*radius,.013*radius,x,.005),(-.318,.0125*radius,.018*radius,.015*radius,x,-.002)],material,detail=False)
        if fingerless:
            a.loft('tip_'+side+str(n),joint,[(end,.009,.010,.009,x,.036),(covered_end+.002,.010,.012,.011,x,.024)],'skin',detail=False)
    a.loft('thumb_'+side,joint,[(-.320,.014*radius,.019*radius,.017*radius,-sign*.062,-.030),(-.291,.018*radius,.021*radius,.021*radius,-sign*.068,-.008),(-.265,.017*radius,.025*radius,.023*radius,-sign*.049,.008)],material,detail=False)

    if bare:
        for obj in a.parts[first_part:]:
            for vertex in obj.data.vertices:
                vertex.co.z=-.289+(vertex.co.z+.289)*.92


def face(a,index):
    temple,cheek,jaw,chin,top,bottom,nose,brow,asym=FACES[index]
    # Explicit transverse planes: cranial vault, temples, orbit, zygoma, maxilla,
    # mandibular angle and chin. Eye region recedes between brow and cheek planes.
    sections=[(bottom,chin,.095,.042),(bottom+.022,jaw*.78,.109,.068),(-.075,jaw,.107,.082),(-.025,cheek,.105,.102),(.024,cheek*.94,.092,.111),(.060,temple,.109+brow,.115),(.105,temple,.098,.109),(top,.072,.064,.075),(top+.012,.024,.024,.03)]
    if a.lod: sections=[sections[n] for n in [0,1,2,3,4,5,7,8]]
    obj=a.loft('anatomical_head','head',sections,'skin')
    if asym:
        for vertex in obj.data.vertices:
            if vertex.co.x>0: vertex.co.z+=asym*(1-abs(vertex.co.z)/.2)
    a.loft('neck','head',[(-.237,.065,.056,.068),(-.19,.061,.057,.062),(-.125,.057,.052,.058),(-.105,.061,.044,.055)],'skin',center=(0,0,.009),detail=False)
    # Nasal bridge and alae have their own angular wedge, not an attached cube.
    a.mesh('nose','head',[(-.014,.040,-.105),(.014,.040,-.105),(-.019,-.023,-.106),(.019,-.023,-.106),(-.013,-.021,-.114-nose),(.013,-.021,-.114-nose),(0,.023,-.119),(0,-.031,-.119)],[(0,1,6),(0,6,4,2),(1,3,5,6),(6,5,4),(2,4,7),(7,4,5),(3,7,5),(2,7,3),(0,2,3,1)],'skin')
    for side in [-1,1]:
        x=side*.062
        # Opaque inset eye whites with muted irises: no transparent corneal layers.
        a.panel('eye_'+str(side),'head',[(-.022,0),(-.014,.006),(.013,.006),(.022,0),(.012,-.005),(-.013,-.005)],.003,'eye',(x,.032,-.101))
        a.patch('iris_'+str(side),'head',(x,.032,-.104),.010,.010,.003,'iris')
        a.bar('upper_lid_'+str(side),'head',(x-.023,.040,-.104),(x+.022,.038,-.104),.005,'skin')
        a.bar('brow_'+str(side),'head',(x-.025,.058,-.115-brow),(x+.021,.060,-.115-brow),.006+(index==7)*.002,'hair'+str(index%4))
        a.loft('ear_'+str(side),'head',[(-.044,.008,.014,.014),(-.023,.016,.022,.023),(.009,.015,.025,.023),(.028,.009,.018,.017)],'skin',center=(side*(min(cheek,.122)+.007),0,.011),detail=False)
        if not a.lod: a.patch('concha_'+str(side),'head',(side*(min(cheek,.122)+.012),-.006,-.013),.011,.027,.003,'lip')
    a.panel('lower_lip','head',[(-.026,0),(-.012,.002),(0,0),(.012,.002),(.026,0),(.012,-.005),(-.012,-.005)],.003,'lip',(asym,-.077,-.110))
    for sign in [-1,1]:a.bar('mouth_seam_'+str(sign),'head',(asym,-.077,-.113),(sign*.024+asym,-.074,-.112),.0016,'lip')
    # Hair cap has a varied, low side hairline and flattened crown; no hidden new UI.
    hair='hair'+str(index%4)
    hair_y=.105 if index in [1,6,9] else .089
    hair_mesh=a.loft('cropped_hair','head',[(hair_y,temple*1.03,.105,.120),(.110,temple*1.02,.104,.116),(top,.076,.069,.081),(top+(.009 if index in [2,7] else .023 if index in [3,10] else .017),.028,.030,.035)],hair)
    ring_count=len(SECTION if a.lod==0 else LOW_SECTION)
    for vertex in list(hair_mesh.data.vertices)[:ring_count]:
        back=max(0,-vertex.co.y)/.12
        side=max(0,abs(vertex.co.x)/temple-.60)
        vertex.co.z-=max(back*.066,side*.065)
    if index in [4,8,11]:
        for vertex in list(hair_mesh.data.vertices)[-ring_count:]:vertex.co.x+=.007
    if index in [2,4,6,9,11]:
        beard_polys=[p for p in obj.data.polygons if p.center.z<-.065 and p.center.y>.020]
        indices=sorted({i for p in beard_polys for i in p.vertices});lookup={v:i for i,v in enumerate(indices)}
        vertices=[]
        for i in indices:
            co=obj.data.vertices[i].co+obj.data.vertices[i].normal*.002
            vertices.append((co.x,co.z,-co.y))
        if vertices:a.mesh('short_beard','head',vertices,[tuple(lookup[i] for i in p.vertices) for p in beard_polys],hair)


def jacket(a,kind):
    combat=kind in ['g4','kombat']; loose=kind in ['gorka','sumrak','m65']
    width={'g4':.212,'kombat':.212,'fleece':.216,'acu':.221,'afghanka':.226,'bdu':.222,'m65':.229,'gorka':.228,'softshell':.222,'sumrak':.231}[kind]
    depth=.146 if loose else .134
    bottom={'m65':-.306,'sumrak':-.291,'afghanka':-.282,'bdu':-.273,'g4':-.25,'kombat':-.245}.get(kind,-.260)
    # Lower hems and shoulder saddle are shaped independently of chest cross-section.
    sections=[(bottom,width*.94,depth*.88,depth*.92),(bottom+.021,width*.98,depth*.92,depth*.96),(-.18,width*.93,depth*.93,depth*.94),(-.055,width*.94,depth*.96,depth*.94),(.09,width,depth,depth*.96),(.18,width*.99,depth*.95,depth*.92),(.233,width*1.08,depth*.73,depth*.80),(.255,.097,.065,.064)]
    if a.lod: sections=[sections[n] for n in [0,2,4,6,7]]
    a.loft('tailored_shell','torso',sections,'jersey' if combat else 'fleece' if kind=='fleece' else 'cloth')
    # Real open collar around the neck; no solid cylinder capping the neck hole.
    collar_h=.055 if kind in ['bdu','afghanka'] else .075
    collar= [(-.101,.015),(-.081,.044),(-.060,.049),(-.055,-.016),(-.087,-.042)]
    for sign in [-1,1]:
        outline=[(sign*x,y) for x,y in collar]
        a.panel('collar_leaf_'+str(sign),'torso',outline,.014,'cloth',(0,.265,-.070),angle=sign*(.20 if kind in ['bdu','afghanka','m65'] else -.10))
    # Back collar is a three-sided fabric rise with an open central neckline.
    a.patch('collar_back','torso',(0,.266,.066),.172,collar_h,.014,'cloth')
    if combat:
        a.bar('short_zip','torso',(0,.100,-depth-.005),(0,.288,-.081),.007,'zip')
        for sign in [-1,1]:
            a.bar('raglan_seam_'+str(sign),'torso',(sign*.065,.247,-.072),(sign*.171,.170,-.086),.0025,'seam')
    else:
        zip_end=-.024 if kind=='gorka' else bottom+.024
        a.patch('closure','torso',(0,(zip_end+.22)/2,-depth-.002),.034 if kind in ['m65','bdu','afghanka','sumrak'] else .014,.22-zip_end,.008,'reinforce')
        if kind in ['fleece','softshell','acu']:
            a.bar('zip_teeth','torso',(0,zip_end,-depth-.009),(0,.24,-depth*.91),.003,'zip')
    if kind in ['acu','afghanka','bdu','m65']:
        for sign in [-1,1]:
            angle=sign*.20 if kind=='acu' else 0
            a.pocket('chest_'+str(sign),'torso',(sign*.116,.085,-depth-.009),.119,.134,.019 if kind=='acu' else .028,angle)
            if kind!='acu': a.pocket('hip_'+str(sign),'torso',(sign*.118,bottom+.095,-depth*.92-.013),.137,.119,.030)
    elif kind=='gorka':
        a.patch('chest_yoke','torso',(0,.162,-depth*.91),.411,.133,.012,'reinforce')
        a.pocket('anorak_chest','torso',(0,.012,-depth-.015),.271,.102,.024)
        for sign in [-1,1]:
            a.patch('diagonal_hand_'+str(sign),'torso',(sign*.126,-.165,-depth*.95),.119,.027,.012,'reinforce',sign*.47)
    elif kind=='sumrak':
        a.pocket('smock_front_pouch','torso',(0,-.156,-depth-.014),.321,.145,.024)
    elif kind in ['fleece','softshell']:
        for sign in [-1,1]:
            a.patch('hand_welt_'+str(sign),'torso',(sign*.124,-.140,-depth*.95),.106,.014,.009,'zip',sign*.60)
    if kind in ['afghanka','m65']:
        for sign in [-1,1]: a.patch('epaulette_'+str(sign),'torso',(sign*.157,.244,0),.067,.139,.009,'reinforce',axis='y')
    # Hood stored behind the collar, open rim surrounds a folded interior cavity.
    # It belongs to torso, avoiding the unsupported cloth/skinning head-follow mode.
    if kind in ['gorka','sumrak','softshell']:
        size=.126 if kind=='softshell' else .145
        a.loft('folded_hood','torso',[(.182,.078,.036,.037),(.209,size*.88,.060,.058),(.254,size,.068,.064),(.302,size*.83,.055,.054)],'cloth',center=(0,0,.112),cap=False)
        a.patch('hood_lower_fold','torso',(0,.211,.172),size*1.70,.024,.009,'reinforce')
        if kind=='gorka': a.patch('hood_reinforcement','torso',(0,.274,.171),.145,.066,.006,'reinforce')
    # Upper back stays plain except where the particular brief confirms a yoke.
    if kind in ['gorka','softshell','m65','afghanka']:
        a.patch('rear_yoke','torso',(0,.183,depth*.92),width*1.76,.09,.009,'reinforce' if kind=='gorka' else 'cloth')
    if not a.lod:
        for sign in [-1,1]:
            a.bar('hem_fold_'+str(sign),'torso',(sign*.055,bottom+.022,-depth*.91),(sign*width*.80,bottom+.027,-depth*.75),.003,'seam')
            a.bar('waist_dart_'+str(sign),'torso',(sign*width*.78,-.185,-depth*.78),(sign*width*.90,-.104,-depth*.68),.004,'cloth')
    for side in 'LR':
        sign=-1 if side=='L' else 1; up='upper'+side; fore='fore'+side
        w=.085 if loose else .075
        a.loft('sleeve_upper_'+side,up,[(-.303,w*.82,.080,.080),(-.263,w*.91,.086,.086),(-.155,w,.093,.096),(-.058,w*1.04,.096,.101),(.036,w*.82,.076,.085)],'cloth')
        fore_sections=[(-.260,w*.77,.073,.071),(-.237,w*.88,.081,.076),(-.181,w*.88,.081,.081),(-.105,w*.91,.083,.087),(-.035,w,.088,.094),(.017,w*.90,.080,.083)]
        if a.lod: fore_sections=[fore_sections[n] for n in [0,1,3,5]]
        a.loft('sleeve_fore_'+side,fore,fore_sections,'cloth')
        a.loft('elbow_flex_overlap_'+side,fore,[(-.047,w*.93,.085,.092),(.012,w*1.02,.095,.100),(.050,w*.75,.067,.071),(.066,w*.42,.038,.041)],'cloth')
        a.loft('cuff_'+side,fore,[(-.261,w*.85,.078,.077),(-.226,w*.94,.086,.084)],'reinforce',detail=False)
        if kind in ['acu','g4','kombat','gorka','softshell']:
            a.pocket('bicep_'+side,up,(sign*(w+.005),-.088,0),.125,.104,.012 if combat else .021,axis='x',bellows=not combat)
        # Runtime patch plane lies at w+.023: keep this backing below its surface.
        a.patch('patch_backing_'+side,up,(sign*(w+.017),-.076,0),.077,.059,.006,'reinforce',axis='x')
        if kind in ['bdu','g4','kombat','gorka']:
            a.patch('elbow_'+side,fore,(0,-.026,.092),.128,.115,.012,'reinforce')
            if kind=='kombat' and not a.lod:
                for y in [-.057,-.022,.013]: a.patch('elbow_seam_'+side+str(y),fore,(0,y,.100),.110,.008,.003,'seam')
        if kind=='gorka': a.patch('outer_wedge_'+side,up,(sign*(w+.002),-.196,0),.133,.134,.008,'reinforce',axis='x')
        if not a.lod:
            for n in range(2 if combat else 3):
                y=-.075-n*.053
                a.bar('fore_fold_'+side+str(n),fore,(-w*.57,y+.007,-.074),(w*.62,y-.010,-.074),.0035,'cloth')
            a.patch('cuff_tab_'+side,fore,(sign*(w*.8),-.242,-.020),.065,.022,.006,'seam',axis='x')


def trousers(a,kind):
    loose=kind in ['afghanka','gorka','sumrak']
    w={'g4':.091,'kombat':.098,'softshell':.096,'acu':.100,'bdu':.100,'gorka':.108,'sumrak':.109,'afghanka':.106}[kind]
    a.loft('seat_waist','pelvis',[(-.079,.180,.116,.124),(-.030,.202,.123,.133),(.030,.202,.121,.129),(.082,.191,.114,.118)],'cloth')
    a.loft('waistband','pelvis',[(.050,.204,.124,.133),(.082,.201,.122,.129)],'reinforce',detail=False)
    a.patch('belt_buckle','pelvis',(0,.066,-.129),.042,.029,.009,'zip')
    if not a.lod:
        for x in [-.155,-.065,.065,.155]: a.patch('belt_loop_'+str(x),'pelvis',(x,.066,-.124),.013,.044,.005,'cloth')
        a.bar('fly','pelvis',(.013,-.060,-.122),(.013,.046,-.127),.004,'seam')
    for side in 'LR':
        sign=-1 if side=='L' else 1; thigh='thigh'+side; shin='shin'+side
        a.loft('thigh_panel_'+side,thigh,[(-.350,w*.81,.092,.092),(-.301,w*.88,.100,.103),(-.205,w,.107,.113),(-.110,w*1.02,.111,.118),(.022,w*.96,.112,.120)],'cloth')
        taper=.85 if loose else .71
        sections=[(-.315,w*taper,.080,.082),(-.282,w*(taper+.07),.086,.089),(-.236,w*.86,.089,.095),(-.150,w*.91,.095,.109),(-.067,w*.90,.101,.107),(.018,w*.83,.097,.094)]
        if a.lod: sections=[sections[n] for n in [0,2,3,5]]
        a.loft('shin_panel_'+side,shin,sections,'cloth')
        a.loft('knee_flex_overlap_'+side,shin,[(-.057,w*.88,.100,.105),(.008,w*.99,.108,.110),(.055,w*.81,.087,.083),(.077,w*.44,.045,.047)],'cloth')
        a.loft('ankle_cuff_'+side,shin,[(-.318,w*(taper+.06),.086,.088),(-.290,w*(taper+.12),.093,.095)],'reinforce',detail=False)
        if kind not in ['afghanka','softshell','sumrak']:
            a.pocket('cargo_'+side,thigh,(sign*(w+.010),-.172,0),.151,.158 if kind=='g4' else .184,.028,angle=sign*.13 if kind=='acu' else 0,axis='x')
        elif kind=='sumrak':
            a.pocket('simple_thigh_'+side,thigh,(sign*(w+.003),-.15,.015),.120,.116,.012,axis='x',bellows=False)
        else:
            a.bar('slash_pocket_'+side,thigh,(sign*w*.86,-.045,-.067),(sign*w*.94,-.123,-.035),.007,'seam')
        if kind in ['acu','kombat']:
            a.pocket('calf_pocket_'+side,shin,(sign*(w*.90+.006),-.175,.006),.094,.105,.016,axis='x',bellows=False)
        if kind in ['bdu','gorka','kombat','softshell','g4']:
            a.patch('knee_reinforcement_'+side,shin,(0,-.040,-.100),w*1.57,.151 if kind=='gorka' else .124,.013,'reinforce')
            if kind=='g4':
                a.patch('knee_insert_'+side,shin,(0,-.037,-.115),.115,.096,.024,'rubber')
                if not a.lod:
                    for y in [-.064,-.037,-.01]: a.patch('knee_rib_'+side+str(y),shin,(0,y,-.129),.084,.008,.004,'seam')
            elif kind=='kombat' and not a.lod:
                a.bar('knee_dart_'+side,shin,(-w*.72,-.062,-.113),(w*.72,-.048,-.113),.003,'seam')
        if kind=='gorka': a.patch('shin_guard_cloth_'+side,shin,(0,-.232,-.09),w*1.48,.100,.008,'reinforce')
        if kind in ['bdu','acu','g4','kombat','gorka']:
            a.pocket('rear_seat_'+side,'pelvis',(sign*.108,-.010,.131),.117,.079,.014,axis='z',bellows=False)
        if not a.lod:
            a.bar('inseam_'+side,thigh,(-sign*w*.70,-.029,.067),(-sign*w*.69,-.302,.055),.003,'seam')
            for n in range(3 if loose else 2):
                y=-.21-n*.037
                a.bar('lower_fold_'+side+str(n),shin,(-w*.64,y,-.080),(w*.60,y+.012,-.080),.003,'cloth')


def gloves(a,kind):
    mat='leather' if kind in ['leather','fingerless'] else 'glove_'+kind
    for side in 'LR':
        sign=-1 if side=='L' else 1; joint='fore'+side
        hand(a,side,mat,fingerless=kind=='fingerless')
        a.loft('wrist_binding_'+side,joint,[(-.267,.043,.041,.038),(-.244,.041,.040,.038)],mat,detail=False)
        a.patch('palm_reinforcement_'+side,joint,(0,-.291,.039),.080,.068,.006,'leather')
        a.patch('wrist_closure_'+side,joint,(0,-.252,-.041),.072,.018,.006,'rubber')
        if kind in ['coyote','olive']:
            for n in range(4):
                a.patch('knuckle_'+side+str(n),joint,(-.041+n*.027,-.316,-.045),.021,.026,.008,'rubber' if kind=='coyote' else 'reinforce')
        if not a.lod:
            a.bar('thumb_gusset_'+side,joint,(-sign*.034,-.265,-.041),(-sign*.054,-.308,-.041),.002,'seam')
            for x in [-.029,0,.029]: a.bar('dorsal_stitch_'+side+str(x),joint,(x,-.272,-.045),(x,-.306,-.045),.0015,'seam')


def boots(a,kind):
    top={'hiking':.097,'desert':.137,'jungle':.170,'leather':.167}[kind]
    mat='suede' if kind in ['desert','hiking'] else 'leather'
    for side in 'LR':
        joint='foot'+side; sign=-1 if side=='L' else 1
        # Foot perimeter extends through heel, arch, broad metatarsal and toe cap.
        a.loft('lug_sole_'+side,joint,[(-.117,.095,.204,.116),(-.105,.101,.208,.121),(-.083,.099,.205,.119)],'rubber',center=(0,0,-.02))
        a.loft('leather_vamp_'+side,joint,[(-.082,.097,.199,.114),(-.049,.093,.194,.111),(-.015,.083,.169,.106),(.024,.075,.102,.095),(.057,.074,.077,.088)],mat,center=(0,0,-.020))
        a.loft('ankle_shaft_'+side,joint,[(.014,.074,.080,.087),(.058,.078,.076,.089),(top-.022,.083,.082,.090),(top,.085,.085,.091)],'jungle_cloth' if kind=='jungle' else mat,center=(0,0,.014),cap=False)
        a.loft('ankle_collar_'+side,joint,[(top-.018,.087,.087,.092),(top+.008,.087,.087,.092)],'reinforce' if kind=='jungle' else 'rubber',center=(0,0,.014),detail=False,cap=False)
        a.patch('tongue_'+side,joint,(0,(top+.017)/2,-.076),.094,top-.016,.012,mat)
        a.patch('heel_counter_'+side,joint,(0,-.011,.108),.123,.098,.015,mat)
        # Toe bumper has a broad sculpted dome and separate protective edge.
        a.loft('toe_bumper_'+side,joint,[(-.078,.091,.064,.026),(-.046,.085,.061,.027),(-.025,.065,.041,.020)],'rubber' if kind=='hiking' else mat,center=(0,0,-.157),detail=False)
        rows=3 if a.lod else (6 if kind in ['jungle','leather'] else 5)
        for n in range(rows):
            y=.003+n*(top-.019)/max(1,rows-1)
            a.bar('lace_'+side+str(n),joint,(-.032,y,-.088),(.032,y+.009,-.088),.004,'lace')
            if not a.lod:
                for s in [-1,1]: a.patch('eyelet_'+side+str(n)+str(s),joint,(s*.039,y,-.086),.011,.010,.004,'zip')
        if kind in ['desert','hiking']:
            for s in [-1,1]:
                a.panel('side_overlay_'+side+str(s),joint,[(-.059,-.013),(-.034,.080),(.023,top-.026),(.065,.023),(.067,-.033)],.011,mat,(s*.077,0,.019),axis='x')
        if kind=='jungle':
            for z in [-.009,.018]: a.patch('drain_'+side+str(z),joint,(sign*.079,.006,z),.011,.009,.004,'zip',axis='x')
        if not a.lod:
            for n in range(5):
                for s in [-1,1]: a.patch('tread_'+side+str(n)+str(s),joint,(s*.067,-.119,-.178+n*.059),.050,.033,.009,'rubber',angle=s*.15,axis='y')


def headwear(a,kind):
    mat='knit' if kind=='watch' else 'fleece' if kind=='fleece' else 'cloth'
    if kind=='balaclava':
        # Delete only the front strip of the eye-height shell. The opening is real.
        obj=a.loft('elastic_shell','head',[(-.232,.074,.068,.078),(-.17,.080,.077,.084),(-.112,.117,.116,.108),(-.049,.149,.137,.129),(.008,.152,.135,.135),(.058,.148,.128,.133),(.099,.135,.116,.126),(.145,.099,.086,.094),(.165,.031,.032,.035)],'cloth')
        import bmesh
        bm=bmesh.new();bm.from_mesh(obj.data)
        remove=[]
        for f in bm.faces:
            c=f.calc_center_median()
            # Blender Y is -game Z, Blender Z is game Y.
            if .008<c.z<.058 and c.y>.065 and abs(c.x)<.09: remove.append(f)
        bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(obj.data);bm.free()
        a.bar('eye_upper_binding','head',(-.091,.058,-.125),(.091,.058,-.125),.004,'seam')
        a.bar('eye_lower_binding','head',(-.093,.008,-.132),(.093,.008,-.132),.004,'seam')
        a.mesh('nose_cloth','head',[(-.029,.007,-.133),(.029,.007,-.133),(-.032,-.044,-.137),(.032,-.044,-.137),(0,-.015,-.156)],[(0,1,4),(1,3,4),(3,2,4),(2,0,4),(0,2,3,1)],'cloth')
        return
    if kind=='patrol':
        sections=[(.077,.144,.129,.127),(.107,.147,.131,.130),(.167,.131,.117,.117),(.183,.111,.096,.101)]
    elif kind=='boonie':
        sections=[(.087,.145,.131,.129),(.126,.145,.132,.129),(.172,.129,.116,.114),(.185,.107,.096,.095)]
    elif kind=='bandana':
        sections=[(.079,.141,.123,.128),(.111,.137,.121,.125),(.150,.098,.086,.091),(.165,.031,.030,.035)]
    elif kind=='watch':
        sections=[(.058,.145,.132,.135),(.100,.149,.134,.137),(.149,.129,.116,.120),(.190,.078,.072,.075),(.203,.027,.027,.029)]
    else:
        sections=[(.059,.142,.129,.130),(.108,.140,.126,.129),(.150,.111,.100,.108),(.181,.059,.054,.059),(.186,.022,.023,.024)]
    a.loft('crown','head',sections,mat)
    if kind=='patrol':
        a.panel('curved_visor','head',[(-.128,.009),(-.133,-.053),(-.095,-.120),(0,-.140),(.095,-.120),(.133,-.053),(.128,.009)],.011,'cloth',(0,.089,-.103),axis='y')
        a.patch('rear_adjuster','head',(0,.102,.132),.105,.024,.007,'reinforce')
    elif kind=='boonie':
        ring=SECTION if not a.lod else LOW_SECTION; count=len(ring)
        vertices=[]
        for w,d,y in [(.146,.132,.091),(.199,.179,.080),(.219,.199,.059)]:
            vertices += [(x*w,y+.009*math.sin(n*2.4),z*d) for n,(x,z) in enumerate(ring)]
        faces=[]
        for row in range(2):
            for n in range(count): faces.append((row*count+n,row*count+(n+1)%count,(row+1)*count+(n+1)%count,(row+1)*count+n))
        brim=a.mesh('soft_brim','head',vertices,faces,'cloth')
        # Double-sided fabric only on the single thin brim sheet.
        brim.data.materials[0].use_backface_culling=False
        a.loft('crown_tape','head',[(.099,.147,.134,.132),(.125,.147,.134,.132)],'reinforce',detail=False,cap=False)
        for sign in [-1,1]: a.patch('vent_'+str(sign),'head',(sign*.146,.141,0),.014,.009,.003,'zip',axis='x')
    elif kind=='watch':
        a.loft('folded_cuff','head',[(.055,.147,.134,.136),(.097,.151,.138,.139)],'knit',detail=False,cap=False)
    elif kind=='bandana':
        a.patch('rear_knot','head',(.079,.079,.129),.062,.036,.032,'cloth',-.3)
        for sign in [-1,1]:
            a.panel('tie_tail_'+str(sign),'head',[(-.018,.038),(.018,.036),(.022,-.038),(.004,-.064),(-.017,-.037)],.006,'cloth',(.079+sign*.018,.035,.151),angle=sign*.29)
    if kind in ['bandana','fleece','watch'] or not a.lod:
        for sign in [-1,1]: a.bar('crown_seam_'+str(sign),'head',(sign*.087,.115,-.108),(sign*.027,.168,-.035),.002,'seam')


def create_materials():
    import bpy
    import numpy as np
    palette={
        'skin':((.72,.53,.39),'skin',.86), 'cloth':((.30,.34,.22),'fabric',.96),
        'reinforce':((.19,.22,.14),'trim',.95), 'seam':((.16,.18,.13),'trim',.96),
        'jersey':((.24,.27,.18),'trim',.98), 'fleece':((.25,.29,.20),'fabric',.99),
        'knit':((.22,.26,.17),'fabric',.99), 'zip':((.12,.13,.10),'trim',.57),
        'rubber':((.095,.105,.088),'trim',.91), 'leather':((.105,.098,.080),'trim',.78),
        'suede':((.43,.34,.22),'trim',.97), 'jungle_cloth':((.22,.27,.15),'trim',.96),
        'glove_coyote':((.44,.34,.22),'trim',.93), 'glove_olive':((.27,.31,.19),'trim',.94),
        'lace':((.17,.16,.12),'trim',.95), 'eye':((.47,.46,.40),'trim',.73),
        'iris':((.055,.064,.050),'trim',.62), 'lip':((.64,.45,.36),'trim',.89),
        'mouth':((.16,.105,.08),'trim',.95),
        'hair0':((.13,.12,.085),'trim',.95),'hair1':((.082,.068,.050),'trim',.95),
        'hair2':((.19,.17,.12),'trim',.95),'hair3':((.12,.095,.070),'trim',.95),
    }
    maps=SOURCE/'textures'; maps.mkdir(parents=True,exist_ok=True)
    result={}
    # Original mathematical material maps; source photographs never enter the pixel path.
    for name,(color,role,roughness) in palette.items():
        mat=bpy.data.materials.new('RAID_'+name); mat.use_nodes=True; mat['role']=role
        mat.diffuse_color=(*color,1)
        principled=mat.node_tree.nodes.get('Principled BSDF')
        principled.inputs['Base Color'].default_value=(*color,1)
        principled.inputs['Roughness'].default_value=roughness
        principled.inputs['Metallic'].default_value=0
        size=128; rng=np.random.default_rng(int.from_bytes(hashlib.sha256(name.encode()).digest()[:4],'little'))
        yy,xx=np.mgrid[0:size,0:size]
        noise=rng.random((size,size))-.5
        weave=np.sin(xx*math.tau/4)*np.sin(yy*math.tau/4)
        height=noise*.08+weave*(.09 if name in ['cloth','reinforce','jungle_cloth'] else .025)
        if name=='knit': height+=np.cos(xx*math.tau/8)*.15+np.sin((yy+xx%8)*math.tau/8)*.04
        # Fine local variation is multiplicative and neutral for runtime skin/fabric tint.
        base=np.ones((size,size,4),dtype=np.float32)
        strength=.035 if role=='skin' else .065
        for k in range(3): base[:,:,k]=(1+noise*strength+weave*strength*.20)*(1 if role in ['skin','fabric'] else color[k])
        base[:,:,:3]=np.clip(base[:,:,:3],0,1)
        normal=np.ones((size,size,4),dtype=np.float32)
        normal[:,:,0]=.5+(np.roll(height,1,1)-np.roll(height,-1,1))*.14
        normal[:,:,1]=.5+(np.roll(height,1,0)-np.roll(height,-1,0))*.14
        normal[:,:,2]=1
        orm=np.ones((size,size,4),dtype=np.float32); orm[:,:,1]=np.clip(roughness+noise*.06,0,1); orm[:,:,2]=0
        for kind,array in [('color',base),('normal',normal),('orm',orm)]:
            image=bpy.data.images.new('RAID_'+name+'_'+kind,width=size,height=size,alpha=True)
            image.colorspace_settings.name='sRGB' if kind=='color' else 'Non-Color'
            image.pixels.foreach_set(array.ravel()); image.update(); image.filepath_raw=str(maps/(name+'_'+kind+'.png'));image.file_format='PNG'
            image.save();image.pack()
            node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
            if kind=='color':
                # Trim has baked original color, skin/fabric uses neutral texture multiplier.
                mat.node_tree.links.new(node.outputs['Color'],principled.inputs['Base Color'])
                if role in ['skin','fabric']:
                    mix=mat.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1)
                    mat.node_tree.links.new(node.outputs['Color'],mix.inputs[1]);mat.node_tree.links.new(mix.outputs[0],principled.inputs['Base Color'])
                    # glTF supports a texture factor, not arbitrary shader math: the export
                    # hook below restores the standard texture + factor nodes for these.
                    mat.node_tree.links.new(node.outputs['Color'],principled.inputs['Base Color'])
                    principled.inputs['Base Color'].default_value=(*color,1)
            elif kind=='normal':
                normal_node=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=.45
                mat.node_tree.links.new(node.outputs['Color'],normal_node.inputs['Color']);mat.node_tree.links.new(normal_node.outputs[0],principled.inputs['Normal'])
            else:
                sep=mat.node_tree.nodes.new('ShaderNodeSeparateColor');mat.node_tree.links.new(node.outputs['Color'],sep.inputs[0]);mat.node_tree.links.new(sep.outputs['Green'],principled.inputs['Roughness']);mat.node_tree.links.new(sep.outputs['Blue'],principled.inputs['Metallic'])
        result[name]=mat
    return result


def merge_parts(parts):
    import bpy
    grouped={}
    for obj in parts:
        grouped.setdefault((obj['assetKey'],obj['lod'],obj.data.materials[0].name),[]).append(obj)
    merged=[]
    for key,objects in grouped.items():
        for obj in bpy.context.selected_objects: obj.select_set(False)
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        obj=objects[0];obj.name=key[0]+'_LOD'+str(key[1])+'_'+key[2]
        merged.append(obj)
    return merged


def export_layer(identifier,materials):
    import bpy
    objects=[]
    for lod in [0,1]:
        a=Artist(identifier,lod,materials)
        if identifier=='body': body(a)
        elif identifier.startswith('face_'): face(a,int(identifier[-2:]))
        elif identifier.startswith('jacket_'): jacket(a,identifier[7:])
        elif identifier.startswith('trousers_'): trousers(a,identifier[9:])
        elif identifier.startswith('gloves_'): gloves(a,identifier[7:])
        elif identifier.startswith('boots_'): boots(a,identifier[6:])
        elif identifier.startswith('head_'): headwear(a,identifier[5:])
        objects+=merge_parts(a.parts)
    for obj in bpy.context.selected_objects: obj.select_set(False)
    for obj in objects: obj.select_set(True)
    path=OUTPUT/(identifier+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
    # Store editable isolated source collections and originals with their true joint-local frames.
    collection=bpy.data.collections.new(identifier);bpy.context.scene.collection.children.link(collection)
    for obj in objects:
        for owner in list(obj.users_collection): owner.objects.unlink(obj)
        collection.objects.link(obj)
        obj.hide_render=True
    groups={}
    triangles={0:0,1:0}
    for obj in objects:
        group=groups.setdefault(obj['assetKey'],{'joint':obj['raidJoint'],'roles':set()})
        group['roles'].add(obj['materialRole']);obj.data.calc_loop_triangles();triangles[obj['lod']]+=len(obj.data.loop_triangles)
    for value in groups.values():value['roles']=sorted(value['roles'])
    return {'id':identifier,'assetId':'overhaul_character_'+identifier,'layer':layer_for(identifier),'url':'/assets/art-overhaul/characters/'+identifier+'.glb','groups':groups,'triangles':triangles,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def write_registry(entries):
    lines=["import type { CharacterLayer } from '../domain/types.js';","import type { ModelAssetDefinition } from './model-asset-types.js';",'',
      '/** Original authored rigid layers. Source and measured QA: art/overhaul/character_sources/. */',
      'export const CHARACTER_OVERRIDES: Record<string, { asset: string; layer: CharacterLayer }> = {']
    for row in entries:lines.append("    '"+row['id']+"': { asset: '"+row['assetId']+"', layer: '"+row['layer']+"' },")
    lines += ['};','','export const CHARACTER_ASSET_DEFINITIONS: Record<string, ModelAssetDefinition> = {']
    for row in entries:
        definition={'url':row['url'],'frame':'meters','groups':list(row['groups']),'character':{'layer':row['layer'],'groups':row['groups']}}
        lines.append('    '+json.dumps(row['assetId'])+': '+json.dumps(definition,separators=(',',':'))+',')
    lines+=['};','']
    (ROOT/'src/content/overhaul-character-assets.ts').write_text('\n'.join(lines))


def build(selected=None):
    check_gate()
    import bpy
    # This process is independent from the user's foreground Blender file.
    existing_manifest=None
    if selected and (SOURCE/'manifest.json').exists():
        existing_manifest=json.loads((SOURCE/'manifest.json').read_text())
        with bpy.data.libraries.load(str(SOURCE/'RAID_Character_Overhaul_Master.blend')) as (src,dst): dst.scenes=src.scenes
        scene=dst.scenes[0]
        for collection in list(scene.collection.children):
            if collection.name.split('.')[0] in selected:
                for obj in list(collection.objects): bpy.data.objects.remove(obj,do_unlink=True)
                bpy.data.collections.remove(collection)
    else: scene=bpy.data.scenes.new('RAID_Original_Character_Sources')
    bpy.context.window.scene=scene
    scene.unit_settings.system='METRIC'
    OUTPUT.mkdir(parents=True,exist_ok=True);SOURCE.mkdir(parents=True,exist_ok=True)
    materials=create_materials();entries=[]
    for identifier in (selected or IDS):
        print('CHARACTER_BUILD '+identifier,flush=True)
        entries.append(export_layer(identifier,materials))
    if existing_manifest:
        replacements={row['id']:row for row in entries}
        entries=[replacements.get(row['id'],row) for row in existing_manifest['layers']]
    bpy.data.libraries.write(str(SOURCE/'RAID_Character_Overhaul_Master.blend'),{scene},fake_user=True,compress=True)
    manifest={'schema':1,'scope':'Original authored geometry and procedural PBR; reference images remain private and are never embedded.','uvTileMetres':.45,'joints':JOINTS,'layers':entries,'limitations':['Rigid inherited 13-anchor rig: no per-finger bones, cloth physics or facial animation.','Hoods are stored behind the collar under the current torso anchor.'],'verification':{'structural':'NOT RUN','blenderVisual':'NOT RUN','browserRuntime':'NOT RUN','onlineRaid':'NOT RUN'}}
    (SOURCE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    write_registry(entries)
    print('CHARACTER_BUILD_COMPLETE '+str(len(entries)),flush=True)


def audit_all():
    import importlib.util
    spec=importlib.util.spec_from_file_location('raid_audit',ROOT/'tools/art/blender_asset_audit.py')
    audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
    manifest=json.loads((SOURCE/'manifest.json').read_text());reports=[]
    for entry in manifest['layers']:
        identifier=entry['id'];print('CHARACTER_AUDIT '+identifier,flush=True)
        reports.append(audit.audit_asset(OUTPUT/(identifier+'.glb'),SOURCE/'qa'/(identifier+'.json'),SOURCE/'qa/roundtrip'/(identifier+'.glb')))
    result={'status':'PASSED' if all(r['status']=='PASSED' for r in reports) else 'FAILED','count':len(reports),'errors':{Path(r['file']).stem:r['errors'] for r in reports if r['errors']},'scope':'Blender import and export/reimport: all mesh groups, both LOD, UVs, normals, geometry integrity.'}
    (SOURCE/'qa/structural-summary.json').write_text(json.dumps(result,indent=2)+'\n')
    manifest['verification']['structural']=result['status'];(SOURCE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(result),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--build',action='store_true');parser.add_argument('--audit',action='store_true');parser.add_argument('--only',nargs='*')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.build:build(args.only)
    if args.audit:audit_all()
