"""Authored exterior stock/guard/mount/muzzle production, metres and game socket axes.
Run Blender background --factory-startup --python this_file -- [IDs | --all].
Each ID has an explicit silhouette specification; source photographs are references only.
"""
import bpy, math, json, hashlib, importlib.util, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/vladimir/Projects/raid-game')
OUT=ROOT/'public/assets/art-overhaul/attachments-secondary'
SRC=ROOT/'art/overhaul/secondary_attachment_sources'
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/'tools/art'/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
kit=load('secondary_kit','blender_meshkit.py');audit=load('secondary_audit','blender_asset_audit.py')
RECIPES=json.loads((ROOT/'art/overhaul/production/attachment-recipes.json').read_text())['modules']
RECIPES={k:v for k,v in RECIPES.items() if v['attachmentSlot'] in ('stock','handguard','mount','muzzle')}
MATS={}
def material(kind):
    if kind in MATS:return MATS[kind]
    colors={'polymer':(.115,.14,.137),'rubber':(.052,.064,.06),'steel':(.16,.183,.19),'wood':(.37,.19,.082),'laminate':(.28,.135,.057),'olive':(.18,.23,.105),'tan':(.31,.25,.17)}
    c=colors[kind];metal=.76 if kind=='steel'else 0;rough=.54 if kind in ('wood','laminate')else .83 if kind=='rubber'else .68
    m=kit.material('RAID_Secondary_Original_'+kind,c,'trim',rough,metal)
    size=256;im=bpy.data.images.new('RAID_secondary_'+kind+'_base',width=size,height=size);pix=[]
    for y in range(size):
        for x in range(size):
            u=x/size;v=y/size
            fine=math.sin(2*math.pi*89*u)*math.sin(2*math.pi*83*v)
            grain=math.sin(2*math.pi*(u*23+.7*math.sin(v*math.tau)+.17*math.sin(v*6*math.tau)))
            n=(.065*grain+.025*fine)if kind in ('wood','laminate')else(.035*fine+.012*grain)
            pix.extend([max(.005,min(.9,a*(1+n)))for a in c]+[1])
    im.pixels.foreach_set(pix);im.filepath_raw=str(OUT/(kind+'-base.png'));im.file_format='PNG';im.save();im.pack()
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.links.new(tex.outputs['Color'],m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    MATS[kind]=m;return m

def circle(r,n=12):return[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n))for i in range(n)]
def chamfer(w,h,y=0):
    a=w/2;b=h/2;c=min(w,h)*.18
    return[(-a+c,y-b),(a-c,y-b),(a,y-b+c),(a,y+b-c),(a-c,y+b),(-a+c,y+b),(-a,y+b-c),(-a,y-b+c)]
class Model:
    def __init__(self,ident,lod):self.id=ident;self.lod=lod;self.group=RECIPES[ident]['runtimeAssetGroupKeys'][0];self.objects=[]
    def add(self,o,mat='polymer',edge=0):
        if edge and self.lod==0:kit.bevel(o,edge,1)
        o.data.materials.append(material(mat));o['assetKey']=self.group;o['lod']=self.lod;o.matrix_world=kit.GAME_TO_BLENDER@o.matrix_basis;self.objects.append(o);return o
    def slab(self,label,outline,w,mat='polymer',x=0,edge=0):
        o=kit.extruded_profile(self.id+'_'+label,[(y,z)for z,y in outline],w,axis='X');o.location.x=x;return self.add(o,mat,edge)
    def frame(self,label,outer,inner,w,mat='polymer',x=0):
        o=kit.open_frame(self.id+'_'+label,[(y,z)for z,y in outer],[(y,z)for z,y in inner],w,axis='X');o.location.x=x;return self.add(o,mat,.0012 if RECIPES[self.id]['attachmentSlot']=='stock'else 0)
    def loft(self,label,sections,mat='polymer',axis='Z',loc=(0,0,0)):
        o=kit.loft(self.id+'_'+label,sorted(sections,key=lambda a:a[0]),axis=axis);o.location=loc;return self.add(o,mat)
    def box(self,label,center,size,mat='polymer',edge=0):
        x,y,z=center;w,h,l=size;return self.slab(label,[(z-l/2,y-h/2),(z+l/2,y-h/2),(z+l/2,y+h/2),(z-l/2,y+h/2)],w,mat,x,edge)
    def tube(self,label,z,length,r,mat='steel',inner=None,n=None,y=0):
        n=n or (12 if self.lod==0 else 8)
        o=kit.hollow_tube(self.id+'_'+label,r,inner or r*.67,length,n,axis='Z');o.location=(0,y,z);return self.add(o,mat)
    def pin(self,z,y,x=.048,r=.007,mat='steel'):
        if self.lod:return
        return self.loft('pin',[(x-.002,circle(r,8)),(x+.002,circle(r,8))],mat,axis='X',loc=(0,y,z))
    def bar(self,label,a,b,r,mat='steel',n=6):
        n=4 if self.lod else n
        direction=Vector(b)-Vector(a);o=kit.loft(self.id+'_'+label,[(-direction.length/2,circle(r,n)),(direction.length/2,circle(r,n))],axis='Z');o.rotation_euler=direction.to_track_quat('Z','Y').to_euler();o.location=(Vector(a)+Vector(b))/2;return self.add(o,mat)
    def rail(self,a,b,y=.052,w=.046,side=None):
        # Separate teeth retain the gaps in both LODs; all merge to a single draw mesh.
        count=(1 if side is not None else 2) if self.lod else max(2,round((b-a)/.023));step=(b-a)/count
        for i in range(count):
            z=a+(i+.5)*step
            cross=[(-w/2,y-.006),(w/2,y-.006),(w/2,y+.002),(w*.34,y+.006),(-w*.34,y+.006),(-w/2,y+.002)]
            o=kit.loft(self.id+'_rail_tooth',[(z-step*.31,cross),(z+step*.31,cross)],axis='Z')
            if side is not None:o.rotation_euler.z=side*math.pi/2
            self.add(o,'steel')

# Explicit family-specific stock dimensions and outlines, never inferred from an ID hash.
FIXED={
 '870_wood':('wood',.09,[(-.18,.025),(-.11,.032),(-.055,.004),(.04,.022),(.20,.035),(.23,.015),(.23,-.165),(.16,-.17),(-.045,-.091),(-.10,-.085),(-.13,-.047),(-.18,-.02)]),
 'sg_stock':('wood',.085,[(-.18,.03),(-.12,.024),(-.07,.006),(.07,.025),(.215,.025),(.235,-.018),(.22,-.16),(.15,-.151),(-.02,-.092),(-.09,-.078),(-.12,-.035),(-.18,-.018)]),
 'sg_rubber':('polymer',.091,[(-.18,.028),(-.105,.029),(-.06,.003),(.08,.028),(.22,.031),(.23,-.019),(.22,-.155),(.13,-.15),(-.04,-.082),(-.11,-.073),(-.135,-.03),(-.18,-.019)]),
 'mp5_stock':('polymer',.078,[(-.18,.035),(-.14,.054),(-.10,.057),(-.05,.03),(.10,.013),(.22,.008),(.23,-.034),(.22,-.166),(.17,-.159),(-.045,-.065),(-.125,-.024),(-.18,-.027)]),
 'rpk_stock':('polymer',.086,[(-.18,.025),(-.135,.036),(-.09,.035),(-.055,.007),(.065,.02),(.21,.026),(.23,.003),(.22,-.14),(.04,-.14),(-.028,-.078),(-.1,-.04),(-.18,-.025)]),
 'saiga_stock':('polymer',.078,[(-.18,.029),(-.125,.04),(-.09,.049),(.10,.037),(.22,.026),(.235,-.02),(.23,-.145),(.18,-.155),(-.075,-.063),(-.13,-.03),(-.18,-.024)]),
 'benelli_fixed':('polymer',.085,[(-.18,.029),(-.12,.03),(-.04,.017),(.15,.041),(.22,.026),(.235,-.155),(.18,-.16),(-.01,-.08),(-.04,-.095),(-.02,-.19),(-.08,-.195),(-.132,-.044),(-.18,-.025)]),
 'scar_stock':('tan',.096,[(-.18,.047),(-.12,.056),(-.085,.073),(.05,.069),(.13,.054),(.23,.049),(.245,-.135),(.20,-.148),(.115,-.12),(.085,-.07),(-.105,-.067),(-.16,-.033)]),
 'bren_stock':('polymer',.087,[(-.18,.043),(-.13,.055),(-.08,.072),(.14,.069),(.21,.051),(.23,-.135),(.19,-.148),(.13,-.105),(.055,-.061),(-.11,-.055),(-.15,-.037)]),
}
FRAME={
 'ar_stock':(.205,.075,.055,-.15,.045,'polymer'), 'ar_compact':(.145,.062,.043,-.13,.042,'polymer'),
 'ar_crane':(.225,.088,.065,-.15,.078,'polymer'),'ar_precision':(.235,.095,.070,-.155,.08,'polymer'),
 '870_tactical':(.24,.065,.045,-.145,.055,'polymer'),'benelli_stock':(.22,.055,.045,-.14,.055,'polymer'),
 'g36_stock':(.23,.06,.034,-.145,.037,'polymer'),'g36_adjust':(.23,.06,.034,-.145,.037,'polymer'),
 'scar_precision':(.255,.09,.064,-.16,.073,'tan'),'scorpion_stock':(.20,.061,.040,-.13,.048,'polymer'),
 'sks_synthetic':(.245,.07,.05,-.15,.06,'polymer'),'m14_chassis':(.245,.07,.035,-.14,.046,'steel'),
}
def stock(m):
    k=m.id
    if k in FIXED:
        mat,w,outline=FIXED[k];m.slab('sculpted_stock',outline,w,mat,edge=.003)
        # Broad panel inset stops before shoulder/neck; side edges carry the silhouette.
        if m.lod==0 and mat!='wood':
            for s in [-1,1]:m.slab('moulded_side_panel',[(-.025,-.035),(.15,-.012),(.18,-.102),(.045,-.092)],.0016,mat,x=s*(w/2+.0008))
        if k in ('bren_stock','scar_stock'):
            m.slab('separate_cheek',[(-.075,.067),(.12,.063),(.125,.086),(-.06,.094)],w*.97,mat)
            m.pin(-.14,.008,w/2+.002,.012,'rubber');m.pin(.1,-.04,w/2+.002,.008,'rubber')
        pad(m,.23,.026,-.16,w+.013,'steel'if mat=='wood'and k=='rpk_stock'else'rubber')
    elif k in FRAME:
        b,top,inner_top,bottom,w,mat=FRAME[k]
        outer=[(-.155,top-.022),(-.10,top),(b-.04,top),(b,top-.02),(b,bottom),(b-.045,bottom-.005),(-.11,-.035),(-.155,-.025)]
        inner=[(-.115,inner_top-.014),(-.085,inner_top),(b-.065,inner_top),(b-.032,inner_top-.018),(b-.032,bottom+.054),(b-.055,bottom+.049),(-.08,-.010),(-.115,-.007)]
        if k.startswith('ar_') or k in ('870_tactical','sks_synthetic'):
            m.loft('extension_sleeve',[(-.18,[(x,y+.022)for x,y in circle(.0215,10 if m.lod==0 else 6)]),(.08,[(x,y+.022)for x,y in circle(.0215,10 if m.lod==0 else 6)])],mat)
        m.frame('large_lightening_window',outer,inner,w,mat)
        if k in ('ar_precision','scar_precision','g36_adjust','benelli_stock','m14_chassis'):
            m.slab('raised_cheek',[(-.08,top-.005),(b-.045,top-.005),(b-.045,top+.038),(-.06,top+.042)],w+.02,mat)
            if m.lod==0:
                for z in [-.035,.10]:m.pin(z,top+.012,(w+.02)/2+.001,.009,'rubber')
        if k=='ar_crane':
            for side in [-1,1]:m.loft('storage_cheek', [(-.09,chamfer(.034,.046,.042)),(.18,chamfer(.034,.046,.042))],mat,loc=(side*.045,0,0))
        if k in ('870_tactical','benelli_stock','sks_synthetic'):
            m.slab('integrated_stock_grip',[(-.17,-.024),(-.10,-.03),(-.066,-.18),(-.085,-.195),(-.14,-.188),(-.185,-.078)],.057,mat,edge=.002)
        if k in ('ar_stock','ar_compact','ar_crane','870_tactical'):
            m.slab('length_latch',[(-.09,-.025),(.08,-.035),(.055,-.057),(-.06,-.047)],.043,mat)
        pad(m,b,top-.014,bottom,w+.025,'rubber')
        if k in ('m14_chassis','sks_synthetic'):long_foreend(m,-.97 if k=='m14_chassis'else-.90,mat)
    elif k in ('ar_wire','kedr_stock','mp5_retract','mpx_stock','val_stock','vityaz_stock'):
        b={'ar_wire':.19,'kedr_stock':.13,'mp5_retract':.22,'mpx_stock':.15,'val_stock':.23,'vityaz_stock':.21}[k]
        w=.064 if k=='mp5_retract'else .044;rad=.0055 if k in ('ar_wire','kedr_stock')else .009
        for s in [-1,1]:
            m.bar('upper_side_strut',(s*w/2,.028,-.18),(s*w/2,.028,b),rad)
            if k in ('val_stock','vityaz_stock'):
                m.bar('diagonal_lower_strut',(s*w/2,-.016,-.15),(s*w/2,-.12,b),rad)
        m.box('socket_block',(0,.01,-.16),(w+.02,.07,.044),'steel')
        if k in ('ar_wire','kedr_stock'):
            m.bar('heel',(0,.03,b),(0,-.12,b+.018),.009);m.bar('heel_width',(-.036,-.12,b+.018),(.036,-.12,b+.018),.009)
        else:pad(m,b,.05,-.14,w+.025,'rubber')
    elif k in ('mcx_stock','mcx_compact'):
        compact=k=='mcx_compact';b=.155 if compact else .235
        # Raised narrow beam with distinct three-window compact and two-window tall versions.
        n=3 if compact else 2;a=-.13;step=(b-.045-a)/n
        for i in range(n):
            z=a+i*step
            m.frame('upper_beam_window',[(z,.023),(z+step,.023),(z+step,.062),(z,.062)],[(z+.01,.033),(z+step-.01,.033),(z+step-.01,.052),(z+.01,.052)],.033,'steel')
        m.slab('rear_branch',[(b-.055,.057),(b,.053),(b+.015,-.14),(b-.023,-.143),(b-.036,-.03),(b-.075,.018)],.037,'steel')
        m.box('hinge',(0,.012,-.16),(.05,.083,.046),'steel');pad(m,b,.051,-.14,.061,'rubber')
        if not compact:m.slab('cheek_cap',[(-.06,.057),(.15,.057),(.13,.078),(-.04,.078)],.058,'rubber')
    elif k in ('aug_stock','aug_stock_padded'):
        # Body agent owns the central grip/trigger bow. This rear shell starts at root z=.275.
        m.slab('bullpup_rear_shell',[(-.112,.052),(.19,.052),(.222,.034),(.236,-.10),(.215,-.16),(.155,-.16),(.105,-.105),(-.112,-.056)],.092,'olive',edge=.004)
        pad(m,.226,.04,-.16,.094,'rubber',.026 if k.endswith('padded')else .012)
        for side in [-1,1]:m.slab('cheek_seam',[(-.10,.023),(.18,.023),(.182,.029),(-.10,.029)],.001,'olive',x=side*.047)
        m.pin(.16,-.065,.045,.006,'rubber')
    elif k in ('svd_stock','vss_stock','vss_poly','sv98_stock'):
        mat='laminate'if k in ('svd_stock','vss_stock')else'olive'if k=='sv98_stock'else'polymer';b=.25 if k=='svd_stock'else .23
        if k=='vss_poly':
            m.slab('precision_upper_beam',[(-.18,.025),(-.09,.063),(.20,.069),(.21,.015),(-.10,.004),(-.18,-.026)],.070,mat,edge=.002)
            m.slab('integral_contoured_grip',[(-.18,-.018),(-.115,-.012),(-.055,-.15),(-.068,-.186),(-.12,-.188),(-.17,-.087)],.065,mat,edge=.002)
            m.slab('adjustable_rear_column',[(.145,.05),(.225,.05),(.225,-.15),(.17,-.15),(.15,-.09)],.06,mat,edge=.0015)
            m.slab('lower_support',[(-.076,-.104),(.19,-.104),(.19,-.126),(-.067,-.126)],.034,mat)
            m.pin(.06,.080,.044,.010,'rubber');m.pin(.18,-.020,.032,.010,'rubber')
        elif k in ('vss_stock','sv98_stock'):
            # Two independently visible openings are a defining feature, not a single giant generic window.
            m.frame('forward_thumbhole',[(-.18,.025),(.015,.062),(.03,-.144),(-.09,-.155),(-.145,-.089)],
              [(-.105,-.005),(-.019,.022),(-.007,-.107),(-.066,-.115),(-.095,-.061)],.07,mat)
            m.frame('rear_open_stock',[(.015,.062),(.21,.061),(.23,-.15),(.03,-.144)],[(.048,.028),(.176,.025),(.185,-.113),(.054,-.112)],.07,mat)
        else:
            outer=[(-.18,.024),(-.11,.037),(.02,.072),(b-.025,.066),(b,.035),(b,-.15),(.16,-.16),(-.075,-.15),(-.13,-.095),(-.18,-.035)]
            inner=[(-.083,-.01),(-.045,.012),(.028,.036),(.15,.029),(.18,.008),(.17,-.098),(.12,-.11),(-.035,-.108),(-.058,-.066),(-.083,-.032)]
            m.frame('thumbhole_stock',outer,inner,.07,mat)
        m.slab('cheek_rest',[(-.015,.063),(.17,.063),(.18,.101),(.015,.108)],.085,mat,edge=.002)
        pad(m,b,.048,-.15,.088,'steel'if mat=='laminate'else'rubber')
        if k=='sv98_stock':long_foreend(m,-.88,mat)
    elif k in ('sks_stock','mosin_stock','m14_stock'):
        mat='wood';b=.24
        m.slab('traditional_butt',[(-.18,.016),(-.1,.025),(-.03,.058),(.17,.053),(.225,.028),(.24,-.143),(.18,-.16),(-.04,-.091),(-.105,-.099),(-.14,-.048),(-.18,-.023)],.073,mat,edge=.003)
        long_foreend(m,{'sks_stock':-.90,'mosin_stock':-1.16,'m14_stock':-.97}[k],mat)
        pad(m,b,.025,-.143,.078,'steel')
    else:raise ValueError('Missing stock '+k)
    if k not in ('aug_stock','aug_stock_padded'):
        mat='wood'if k in ('sks_stock','mosin_stock','m14_stock','sg_stock','870_wood')else 'laminate'if k in ('svd_stock','vss_stock')else'olive'if k=='sv98_stock'else 'steel'if k in ('val_stock','vityaz_stock','ar_wire','kedr_stock','mp5_retract','mpx_stock','mcx_stock','mcx_compact','m14_chassis')else'tan'if k.startswith('scar')else'polymer'
        m.loft('receiver_neck',[(-.19,chamfer(.045,.039)),(-.115,chamfer(.055,.05))],mat)

def pad(m,z,top,bottom,w,mat,thick=.018):
    m.slab('shoulder_pad',[(z-.008,top),(z+thick,top-.006),(z+thick+.003,bottom+.012),(z+.003,bottom-.004)],w,mat,edge=.0015)
    if m.lod==0:
        for i in range(5):
            y=bottom+.023+(top-bottom-.04)*i/4
            m.box('pad_tread',(0,y,z+thick+.002),(w*.84,.004,.004),mat)

def long_foreend(m,front,mat):
    # Open external receiver cradle: side cheeks and forward channel, no hidden bedding.
    settings={'sks_stock':(.035,.101,-.015),'sks_synthetic':(.035,.105,-.015),'mosin_stock':(.040,.102,-.012),'sv98_stock':(.067,.115,.015),'m14_stock':(.026,.104,-.024),'m14_chassis':(.026,.111,-.024)}
    top,width,bottom=settings[m.id]
    m.loft('external_wrist_transition',[(-.205,chamfer(width,top-bottom,(top+bottom)/2)),(-.125,chamfer(.070,.052,.002))],mat)
    for side in [-1,1]:
        m.slab('receiver_cradle',[(-.59,top),(-.16,top),(-.14,top-.025),(-.27,bottom),(-.51,bottom),(-.59,top-.026)],.010,mat,x=side*(width/2-.005))
    # Fore-end outside is narrower; the barrel/action remain independently rendered.
    w=.078 if m.id=='mosin_stock'else .09 if m.id=='sv98_stock'else .084
    cross=[(-w/2,top),(-w/2,bottom+.01),(-w*.28,bottom),(w*.28,bottom),(w/2,bottom+.01),(w/2,top),(w/2-.010,top),(w/2-.010,bottom+.017),(w*.22,bottom+.012),(-w*.22,bottom+.012),(-w/2+.010,bottom+.017),(-w/2+.010,top)]
    if m.id.startswith('sks'):
        # Visible channel underneath the folded blade, not a reconstructed hidden assembly.
        for side in [-1,1]:
            cr=[(side*.012,bottom),(side*w/2,bottom+.008),(side*w/2,top),(side*(w/2-.012),top),(side*(w/2-.012),bottom+.018),(side*.012,bottom+.018)]
            m.loft('foreend_bayonet_clearance',[(front,cr),(-.55,cr)],mat)
    else:m.loft('forward_open_channel',[(front,[(x*.86,y)for x,y in cross]),(front+.04,cross),(-.55,cross)],mat)
    if m.id=='m14_chassis':
        for side in [-1,1]:
            for z in [-.86,-.74,-.62]:m.slab('chassis_panel_rib',[(z-.015,bottom),(z+.015,bottom),(z+.015,top),(z-.015,top)],.007,'steel',x=side*.048)
        m.rail(front+.02,-.58,y=-bottom+.006,side=2)
    # Mosin retaining bands belong to the body agent; never duplicate them here.
    if m.lod==0:m.pin(front+.09,bottom+.016,w/2+.002,.006,'steel'if mat=='wood'else'rubber')

# width, height, length, vents per side, material, top rail, side/bottom rails, exterior family
GUARDS={
 '870_pump':(.102,.083,.24,0,'wood',False,False,'pump'),
 '870_pump_rail':(.103,.094,.255,0,'polymer',False,True,'pump_rail'),
 'sg_pump':(.105,.086,.265,0,'wood',False,False,'pump'),
 'mp153_guard':(.112,.090,.31,0,'polymer',False,False,'smooth'),
 'benelli_guard':(.094,.078,.28,0,'polymer',False,False,'split'),
 'benelli_rail':(.102,.093,.315,4,'steel',True,True,'quad'),
 'ar_poly':(.101,.099,.29,4,'polymer',False,False,'roundvent'),
 'ar_short':(.091,.088,.23,3,'polymer',False,False,'roundvent'),
 'ar_long':(.089,.088,.385,5,'polymer',False,False,'mlok'),
 'ar_octagonal':(.080,.082,.385,5,'steel',True,False,'octagon'),
 'aug_rail':(.084,.098,.355,3,'steel',True,False,'aug'),
 'bren_guard':(.088,.092,.26,3,'steel',True,False,'bren'),
 'bren_guard_long':(.088,.092,.365,5,'steel',True,False,'bren'),
 'g36_guard':(.105,.106,.265,4,'polymer',False,False,'g36'),
 'g36_rail':(.101,.099,.285,3,'steel',True,True,'quad'),
 'hk416_guard':(.088,.092,.36,5,'steel',True,False,'hkey'),
 'hk416_short':(.088,.092,.27,3,'steel',True,False,'hkey'),
 'm14_guard':(.069,.052,.31,0,'wood',False,False,'upper'),
 'mcx_guard':(.090,.091,.39,5,'steel',True,False,'mcx'),
 'mcx_guard_short':(.090,.091,.255,3,'steel',True,False,'mcx'),
 'mp5_guard':(.105,.086,.22,0,'polymer',False,False,'wide'),
 'mp5_rail':(.094,.093,.23,3,'steel',False,True,'quad'),
 'mpx_guard':(.084,.082,.20,3,'steel',True,False,'keymod'),
 'mpx_guard_long':(.084,.082,.31,5,'steel',True,False,'keymod'),
 'rpk_guard':(.108,.102,.30,0,'polymer',False,False,'akpair'),
 'rpk_rail':(.111,.10,.32,5,'steel',False,True,'zenit'),
 'saiga_guard':(.121,.105,.29,0,'polymer',False,False,'akpair_smooth'),
 'saiga_rail':(.122,.106,.31,4,'steel',True,True,'saiga'),
 'scar_guard':(.102,.080,.255,3,'steel',False,True,'scar'),
 'scar_guard_long':(.102,.085,.385,5,'steel',False,False,'scar'),
 'scorpion_guard':(.108,.112,.225,3,'polymer',True,False,'scorpion'),
 'scorpion_guard_long':(.096,.104,.345,5,'steel',True,False,'scorpion'),
 'svd_guard':(.088,.095,.36,6,'laminate',False,False,'svd'),
 'val_guard':(.086,.070,.20,0,'polymer',False,False,'val'),
 'val_rail':(.093,.092,.088,0,'steel',False,True,'collar'),
 'vityaz_guard':(.101,.091,.205,0,'polymer',False,False,'akpair'),
 'vityaz_rail':(.105,.088,.21,4,'steel',False,True,'zenit'),
}
def guard(m):
    k=m.id
    if k=='aug_guard':
        m.box('hinge_yoke',(0,.01,.015),(.075,.044,.059),'steel',.002)
        m.loft('folding_grip',[(-.16,chamfer(.050,.048,.025)),(-.13,chamfer(.061,.057,.017)),(.004,chamfer(.061,.054))],'polymer',axis='Y')
        m.pin(.015,.012,.04,.015);return
    w,h,L,n,mat,toprail,siderails,family=GUARDS[k]
    a=.13-L;b=.13
    if family=='collar':a=-.044;b=.044
    half=w/2;lo=-h*.62;hi=h*.38
    # Open U-channel with authored octagonal/radiused outside; never fill barrel clearance.
    cross=[(-half,hi),(-half,lo*.53),(-half*.69,lo),(half*.69,lo),(half,lo*.53),(half,hi),(half-.009,hi),(half-.009,lo*.48),(half*.60,lo+.012),(-half*.60,lo+.012),(-half+.009,lo*.48),(-half+.009,hi)]
    if family in ('pump','pump_rail','split','smooth','wide','val','akpair','akpair_smooth'):
        count=8 if m.lod==0 else 6
        angles=[math.radians(150+i*240/count)for i in range(count+1)]
        cross=[(math.cos(t)*half,math.sin(t)*h*.62)for t in angles]+[(math.cos(t)*(half-.009),math.sin(t)*(h*.62-.010))for t in reversed(angles)]
    if family=='upper':
        cross=[(-half,-.014),(-half*.8,.025),(-half*.35,.039),(half*.35,.039),(half*.8,.025),(half,-.014),(half-.008,-.014),(half*.66,.019),(half*.30,.03),(-half*.30,.03),(-half*.66,.019),(-half+.008,-.014)]
    if not n:
        if family=='collar':m.tube('three_rail_collar',0,L,.045,mat,inner=.036)
        else:
            section=[(a,[(x*.78,y*.88)for x,y in cross]),(a+.025,cross),(b-.022,[(x*.94,y)for x,y in cross]),(b,[(x*.84,y*.88)for x,y in cross])]
            m.loft('contoured_open_shell',section,mat)
        if family in ('pump','pump_rail','split','akpair'):
            count=13 if family=='pump'else 9 if family=='pump_rail'else 7
            if m.lod:count=4
            for i in range(count):
                z=a+.038+(L-.076)*(i+.5)/count
                rib=[(x*1.032,y*1.05)for x,y in cross]
                m.loft('transverse_grasp_rib',[(z-.003,rib),(z+.003,rib)],mat)
        if family.startswith('akpair'):
            m.loft('separate_gas_cover',[(a+.015,chamfer(w*.64,h*.31,h*.55)),(b-.015,chamfer(w*.64,h*.31,h*.55))],mat)
        if family in ('val','wide','smooth') and m.lod==0:
            for s in [-1,1]:m.slab('side_grip_flute',[(a+.03,lo*.35),(b-.035,lo*.35),(b-.037,lo*.35+.008),(a+.035,lo*.35+.008)],.0015,mat,x=s*(half+.001))
    else:
        # Large openings are genuine geometry at both LODs. LOD1 keeps fewer, larger windows.
        count=n if m.lod==0 else 2;step=(L-.026)/count
        rows=2 if family=='svd'and m.lod==0 else 1
        for s in [-1,1]:
            for row in range(rows):
                y0=lo*.61+row*h*.35
                opening_height=h*.14 if family=='svd' else h*.16 if family in ('bren','mcx','hkey','keymod','octagon','g36','roundvent','mlok','scorpion') else h*.26
                y1=y0+opening_height
                for i in range(count):
                    z=a+.013+i*step
                    outer=[(z,y0-.009),(z+step,y0-.009),(z+step,y1+.010),(z,y1+.010)]
                    inner=[(z+.007,y0),(z+step-.007,y0),(z+step-.007,y1),(z+.007,y1)]
                    if m.lod==0 and family in ('bren','mcx','scorpion','keymod','hkey','octagon'):
                        c=.004;za=z+.007;zb=z+step-.007
                        outer=[(z,y0-.009),(z+step,y0-.009),(z+step,y0),(z+step,y1+.010),(z,y1+.010),(z,y1)]
                        inner=[(za+c,y0),(zb-c,y0),(zb,y0+c),(zb,y1-c),(za,y1),(za,y0+c)]
                    m.frame('vent_window',outer,inner,.007,mat,x=s*(half-.0035))
            # Continuous shell panels terminate each real window; no floating rail or unintended extra slots.
            y_top=lo*.61+(rows-1)*h*.35+opening_height+.010
            y_bottom=lo*.61-.009
            if y_top<hi:m.slab('upper_shell_wall',[(a,y_top),(b,y_top),(b,hi),(a,hi)],.007,mat,x=s*(half-.0035))
            m.slab('lower_shell_wall',[(a,lo*.53),(b,lo*.53),(b,y_bottom),(a,y_bottom)],.007,mat,x=s*(half-.0035))
            heel=[(s*half,lo*.53),(s*half*.69,lo),(s*half*.62,lo+.007),(s*(half-.007),lo*.53)]
            m.loft('lower_beveled_facet',[(a,heel),(b,heel)],mat)
            # Chamfered shoulder and heel connect windows to the hollow centre.
            m.loft('sloping_shoulder',[(a,[(s*(half-.008),hi-.005),(s*half,hi-.005),(s*half*.69,hi+.019),(s*half*.62,hi+.013)]),(b,[(s*(half-.008),hi-.005),(s*half,hi-.005),(s*half*.69,hi+.019),(s*half*.62,hi+.013)])],mat)
        m.box('bottom_spine',(0,lo+.005,(a+b)/2),(w*.72,.012,L),mat)
        # Front/back opening rims are shallow, not a closed sleeve behind the vents.
        for z in ([a+.005,b-.005] if m.lod==0 else [a+.005]):m.loft('open_end_lip',[(z-.005,cross),(z+.005,cross)],mat)
        if family in ('roundvent','g36'):
            for i in range(4 if m.lod==0 else 2):
                z=a+.03+(L-.06)*(i+.5)/(4 if m.lod==0 else 2)
                m.box('lower_grip_rib',(0,lo-.002,z),(w*.76,.008,.009),mat)
        if family=='svd':
            m.box('half_shell_seam',(0,-.011,(a+b)/2),(w*.87,.008,L),'laminate')
    if toprail:m.rail(a+.008,b-.008,hi+.021)
    if siderails:
        reach=.055 if family=='collar'else min(L*.73,.23)
        mid=(a+b)/2
        for side in [-1,1]:m.rail(mid-reach/2,mid+reach/2,half+.006,side=side)
        m.rail(mid-reach/2,mid+reach/2,-lo+.004,side=2)
    if family=='scar':
        # Native rear step, unlike the continuous-height AR/MCX rail shell.
        for s in [-1,1]:m.slab('rear_raised_ear',[(b-.06,hi),(b,hi),(b,hi+.038),(b-.044,hi+.038)],.009,mat,x=s*(half-.007))
    if family=='aug':m.box('upper_rear_extension',(0,hi+.018,b+.075),(.043,.016,.16),'steel')
    if m.lod==0 and mat!='wood'and mat!='laminate':
        for z in [a+.025,b-.025]:m.pin(z,0,half+.002,.005,'steel')

def mount(m):
    k=m.id
    if k=='m17_mount':
        m.box('low_optic_plate',(0,.046,0),(.061,.022,.068),'steel',.002)
        for z in [-.030,.030]:m.box('perimeter_lip',(0,.057,z),(.061,.004,.006),'steel')
        for x in [-.019,.019]:m.pin(0,.048,x,.004)
        return
    L={'m14_mount':.25,'mp5_mount':.17,'saiga_mount':.25,'sg_mount':.19,'sks_mount':.285,'svd_mount':.24,'val_mount':.18,'vityaz_mount':.15}[k]
    m.box('longitudinal_deck',(0,.039,0),(.055,.021,L),'steel');m.rail(-L/2,L/2,.052,.073)
    if k=='sg_mount':
        for z in [-L*.34,L*.34]:m.box('receiver_contact',(0,.017,z),(.039,.022,.025),'steel')
    elif k=='mp5_mount':
        for z in [-.060,.060]:
            for x in [-.038,.038]:m.box('claw_foot',(x,.006,z),(.018,.062,.031),'steel',.001)
    elif k=='sks_mount':
        m.slab('rear_scout_base',[(.055,-.028),(.14,-.028),(.142,.039),(.06,.039)],.042,'steel')
        m.box('front_support',(0,.011,-.108),(.04,.037,.025),'steel')
    else:
        h=.094 if k=='svd_mount'else .075;left=-.061 if k=='m14_mount'else-.055
        a=-L*.35;b=L*.39
        outer=[(a,-h),(b,-h),(b+.012,-h*.65),(b,.033),(a-.014,.033),(a-.018,-h*.6)]
        inner=[(a+.017,-h+.018),(b-.025,-h+.018),(b-.015,-h*.6),(b-.025,.014),(a+.004,.014),(a+.001,-h*.5)]
        m.frame('side_bridge_opening',outer,inner,.015,'steel',x=left)
        m.box('cross_arm',(left*.5,.024,0),(.075,.017,L*.66),'steel')
        m.box('side_clamp',(left,-h+.004,.006),(.026,.025,L*.47),'steel')
        if m.lod==0:
            m.slab('external_lock_lever',[(a+.012,-h),(b-.012,-h),(b-.002,-h+.012),(a+.012,-h+.012)],.008,'steel',x=left-.019)
            m.pin(0,-h+.018,left-.018,.012)

def muzzle(m):
    k=m.id;n=10 if m.lod==0 else 6
    if m.lod==1 and k in ('ar_brake','aug_muzzle','bren_muzzle','g36_muzzle','m14_muzzle','mcx_muzzle','scar_brake'):
        # Explicit far geometry avoids collapse spikes on the small disconnected port walls.
        if k=='m14_muzzle':
            L=.14;r=.018
            m.loft('low_rear_collar',[(-.01,circle(r,4)),(.021,circle(r,4))],'steel')
            o=kit.open_frame(k+'_low_front_rim',circle(r,4),circle(r*.55,4),.010,axis='Z');o.location.z=-L;m.add(o,'steel')
            for ang in [math.pi/4+i*math.pi/2 for i in range(4)]:
                x=r*.78*math.cos(ang);y=r*.78*math.sin(ang);m.box('low_flash_slot_spine',(x,y,-L/2),(.008,.008,L-.008),'steel')
            m.box('low_front_sight',(0,.041,-.025),(.025,.057,.030),'steel')
        elif k=='bren_muzzle':
            L=.084;r=.023
            m.loft('low_prong_base',[(-.031,circle(r,6)),(.021,circle(r*.78,6))],'steel')
            for ang in [math.pi/2+i*math.tau/3 for i in range(3)]:
                x=math.cos(ang)*r*.78;y=math.sin(ang)*r*.78
                m.bar('low_flash_prong',(x,y,-.026),(x,y,-L),.008,'steel')
            o=kit.open_frame(k+'_low_front_rim',circle(r*.92,4),circle(r*.42,4),.006,axis='Z');o.location.z=-L;m.add(o,'steel')
        else:
            L,r={'ar_brake':(.092,.021),'aug_muzzle':(.078,.024),'g36_muzzle':(.095,.021),'mcx_muzzle':(.087,.023),'scar_brake':(.10,.026)}[k]
            outer=[(-L,-r*.85),(.006,-r*.85),(.006,r*.85),(-L,r*.85)]
            inner=[(-L+.012,-r*.42),(-.006,-r*.42),(-.006,r*.42),(-L+.012,r*.42)]
            for side in (-1,1):m.frame('low_port_side',outer,inner,.004,'steel',x=side*(r-.002))
            for sign in (-1,1):m.box('low_upper_lower_bridge',(0,sign*r*.76,-L/2), (r*2,.007,L),'steel')
            m.box('low_rear_collar',(0,0,.014),(r*1.60,r*1.60,.020),'steel')
        return
    cans={'ar_suppressor':(.254,.031),'ar_compact_can':(.165,.031),'g36_can':(.215,.029),'mcx_can':(.188,.033),'mpx_can':(.145,.033),'scorpion_can':(.158,.034),'smg_suppressor':(.162,.032),'vityaz_can':(.139,.034)}
    if k in cans:
        L,r=cans[k];m.loft('stepped_exterior_can',[(-L,circle(r*.91,n)),(-L+.009,circle(r,n)),(-.040,circle(r,n)),(-.031,circle(r*.93,n)),(.010,circle(r*.93,n)),(.021,circle(r*.70,n))],'steel')
        m.tube('front_crown',-L-.001,.004,r*.92,'steel',inner=r*.32,n=n)
        m.loft('shallow_dark_front_recess',[(-L-.001,circle(r*.33,n)),(-L+.002,circle(r*.33,n))],'rubber')
        if m.lod==0:
            for z in ([-.01,-.018,-.027]if k in ('ar_suppressor','ar_compact_can','mcx_can')else[-L*.28,-L*.32]):m.tube('raised_seam_band',z,.002,r*1.017,'steel',inner=r*.98,n=n)
            if k.startswith('ar_'):m.box('external_collar_latch',(.023,.013,-.014),(.014,.013,.031),'steel')
        return
    if k=='m14_muzzle':
        L=.14;r=.018;m.tube('rear_collar',.005,.028,r,'steel',inner=.011,n=n)
        m.tube('front_ring',-L,.014,r,'steel',inner=.011,n=n)
        for ang in [math.pi/4+i*math.pi/2 for i in range(4)]:
            x=r*.80*math.cos(ang);y=r*.80*math.sin(ang);m.box('flash_slot_spine',(x,y,-L/2),(.008,.008,L-.015),'steel')
        m.box('front_sight_block',(0,.031,-.025),(.025,.039,.035),'steel')
        for x in [-.015,.015]:m.box('sight_protecting_ear',(x,.057,-.025),(.006,.027,.018),'steel')
        m.box('sight_post',(0,.054,-.025),(.006,.022,.008),'steel');m.box('exterior_lug',(0,-.029,-.015),(.026,.020,.024),'steel');return
    L,r,ports={'ar_brake':(.092,.021,2),'aug_muzzle':(.078,.024,2),'bren_muzzle':(.084,.023,3),'g36_muzzle':(.095,.021,2),'mcx_muzzle':(.087,.023,2),'scar_brake':(.10,.026,2)}[k]
    m.tube('rear_mount_collar',.008,.026,r*.81,'steel',inner=r*.49,n=n)
    if k=='bren_muzzle':
        m.tube('rear_prong_base',-.022,.032,r,'steel',inner=r*.58,n=12 if m.lod==0 else 6)
        for ang in [math.pi/2+i*math.tau/3 for i in range(3)]:
            p=(math.cos(ang)*r*.78,math.sin(ang)*r*.78)
            m.bar('longitudinal_flash_prong',(p[0],p[1],-.027),(p[0],p[1],-L),.008,'steel',n=5)
    else:
        for i in range(ports+1):
            z=-.008-i*(L-.008)/ports
            if k=='scar_brake':
                o=kit.open_frame(k+'_rectangular_port_ring',chamfer(r*2.18,r*1.68),chamfer(r*1.10,r*.82),.010,axis='Z');o.location.z=z;m.add(o,'steel')
            else:m.tube('port_wall_ring',z,.010,r,'steel',inner=r*.52,n=n)
        for sign in [-1,1]:m.box('upper_lower_port_bridge',(0,sign*r*.79,-L/2),(.023,.009,L),'steel')
    m.tube('front_aperture_rim',-L-.003,.006,r*.92,'steel',inner=r*.42,n=n)

def merge(objects):
    buckets={};result=[]
    for o in objects:buckets.setdefault((o['assetKey'],o['lod'],o.data.materials[0].name),[]).append(o)
    for key,rows in buckets.items():
        for o in bpy.context.selected_objects:o.select_set(False)
        for o in rows:o.select_set(True)
        bpy.context.view_layer.objects.active=rows[0]
        if len(rows)>1:bpy.ops.object.join()
        rows[0].name=key[0]+'_LOD'+str(key[1])+'_'+key[2];result.append(rows[0])
    return result

def enforce_budgets(objects,ident):
    # Keep every authored component and material; reduce triangulation only after silhouette modelling.
    # LODs are separate authored geometry first, then bounded by the approved per-item budgets.
    for lod in (0,1):
        rows=[o for o in objects if o['lod']==lod]
        counts=[]
        for o in rows:o.data.calc_loop_triangles();counts.append(len(o.data.loop_triangles))
        total=sum(counts);budget=RECIPES[ident]['lodTriangleBudget']['LOD'+str(lod)+'_max']
        if total<=budget:continue
        for o,count in zip(rows,counts):
            bpy.context.view_layer.objects.active=o
            o.select_set(True)
            dec=o.modifiers.new('Approved_LOD_triangle_budget','DECIMATE');dec.ratio=max(.08,(budget-8)/total);dec.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=dec.name);o.select_set(False)
            kit.planar_uv(o)
    return objects

def registry(manifest):
    definitions={};overrides={}
    for k,v in sorted(manifest.items()):
        asset='overhaul_secondary_module_'+k;definitions[asset]={p:v[p]for p in ('url','groups','frame','groupBounds')};overrides[k]={'asset':asset,'group':v['groups'][0]}
    (ROOT/'src/content/overhaul-secondary-attachment-assets.ts').write_text("// Original authored socket-local Blender assets. Generated by build_secondary_attachments.py.\nimport type { ModelAssetDefinition } from './model-asset-types.js';\nexport const SECONDARY_ATTACHMENT_ASSET_DEFINITIONS: Record<string, ModelAssetDefinition> = "+json.dumps(definitions,indent=2)+";\nexport const SECONDARY_ATTACHMENT_OVERRIDES: Record<string, { asset: string; group: string }> = "+json.dumps(overrides,indent=2)+";\n")

def build(ids):
    OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
    path=SRC/'manifest.json';manifest=json.loads(path.read_text())if path.exists()else{}
    original=bpy.context.window.scene
    for ident in ids:
        if ident not in RECIPES:raise ValueError('Unowned ID '+ident)
        scene=bpy.data.scenes.new('Secondary_'+ident);bpy.context.window.scene=scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
        try:
            objects=[]
            for lod in [0,1]:
                m=Model(ident,lod);{'stock':stock,'handguard':guard,'mount':mount,'muzzle':muzzle}[RECIPES[ident]['attachmentSlot']](m);objects+=m.objects
            bpy.context.view_layer.update();objects=merge(objects);objects=enforce_budgets(objects,ident);bpy.context.view_layer.update()
            glb=OUT/(ident+'.glb');blend=SRC/(ident+'.blend');kit.export_asset(objects,glb,blend)
            report=audit.audit_asset(glb,SRC/(ident+'-audit.json'),SRC/(ident+'-roundtrip.glb'))
            if report['status']!='PASSED':raise ValueError(ident+': '+str(report['errors']))
            digest=hashlib.sha256(glb.read_bytes()).hexdigest();group=RECIPES[ident]['runtimeAssetGroupKeys'][0]
            manifest[ident]={'url':'/assets/art-overhaul/attachments-secondary/'+ident+'.glb?v='+digest[:12],'groups':[group],'frame':'meters','groupBounds':report['groupBounds'],'source':str(blend),'sha256':digest,'triangles':{lod:report['groups'][group][lod]['triangles']for lod in ['0','1']},'materials':report['groups'][group]['0']['materials'],'drawMeshes':{lod:report['groups'][group][lod]['objects']for lod in ['0','1']},'referenceIndex':RECIPES[ident]['referencePackage']['sourceIndex'],'briefSHA256':hashlib.sha256(RECIPES[ident]['approvedLunaBrief'].encode()).hexdigest(),'referenceFrames':[{'file':f['file'],'sha256':f['sha256'],'role':f.get('role'),'sourcePage':f.get('sourcePage')}for f in RECIPES[ident]['referencePackage']['frames'] if f.get('role')!='contrast_only'],'provenance':'Original exterior meshes and procedural PBR textures. Photographs reference-only; no pixels or marks embedded.','status':'STRUCTURAL_PASS_AWAITING_ASSEMBLED_RUNTIME_FIT','structuralQA':'PASSED','runtimeQA':'NOT_RUN'}
            path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n');registry(manifest)
            print('SECONDARY_DONE',ident,manifest[ident]['triangles'],flush=True)
        finally:
            bpy.context.window.scene=original
            for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
            bpy.data.scenes.remove(scene)
    return manifest
if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:]if '--'in sys.argv else[]
    if args:build(list(RECIPES)if args==['--all']else args)
