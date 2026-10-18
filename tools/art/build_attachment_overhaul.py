"""Original socket-local exterior meshes. No side effects until build(ids)."""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Matrix
ROOT=Path('/Users/vladimir/Projects/raid-game')
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'tools/art'/file)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
kit=module('raid_attachment_meshkit','blender_meshkit.py')
audit=module('raid_attachment_audit','blender_asset_audit.py')
OUT=ROOT/'public/assets/art-overhaul/attachments'
SOURCE=ROOT/'art/overhaul/attachment_sources'
MATERIALS={}

def material(kind):
    if kind in MATERIALS:return MATERIALS[kind]
    color,rough,metal={'polymer':((.14,.165,.16),.76,0),'steel':((.23,.26,.27),.52,.82),'rubber':((.085,.095,.09),.94,0),'wood':((.48,.30,.17),.62,0),'inset':((.055,.07,.065),.8,0),'window':((.13,.18,.16),.48,0),'sand':((.49,.40,.27),.81,0),'lens':((.68,.75,.69),.22,.25)}[kind]
    mat=kit.material('RAID_Original_Attachment_'+kind,color,'trim',rough,metal)
    if kind not in ('inset','lens'):
        size=256;image=bpy.data.images.new('RAID_Original_'+kind+'_Grain',width=size,height=size)
        pixels=[]
        for y in range(size):
            for x in range(size):
                u=x/size;v=y/size
                grain=math.sin(2*math.pi*(u*43+math.sin(v*2*math.pi)*.6+math.sin(v*8*math.pi)*.19))
                fine=math.sin(2*math.pi*u*93)*math.sin(2*math.pi*v*91)
                change=(.11*grain+.035*fine)if kind=='wood'else(.028*fine+.012*grain)
                pixels.extend([max(.005,min(.9,c*(1+change)))for c in color]+[1])
        image.pixels.foreach_set(pixels);image.filepath_raw=str(OUT/(kind+'-grain.png'));image.file_format='PNG';image.save();image.pack()
        nodes=mat.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=image
        mat.node_tree.links.new(tex.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])
    MATERIALS[kind]=mat;return mat

def finish(obj,kind,lod,group,bevel=0):
    if bevel:kit.bevel(obj,bevel,1)
    obj.data.materials.append(material(kind));obj['assetKey']=group;obj['lod']=lod
    obj.matrix_world=kit.GAME_TO_BLENDER@obj.matrix_basis
    return obj

def loft(name,sections,**kwargs):
    return kit.loft(name,sorted(sections,key=lambda item:item[0]),**kwargs)

def ring(width,depth,center=0):
    x=width/2;z=depth/2;c=min(width,depth)*.16
    return[(-x+c,-z+center),(x-c,-z+center),(x,-z+c+center),(x,z-c+center),(x-c,z+center),(-x+c,z+center),(-x,z-c+center),(-x,-z+c+center)]

def curve_mag(ident,lod):
    group='magazine__'+ident;objects=[]
    pistol=ident.startswith('glock')
    if pistol:
        # Measured protected Glock insertion, not the old oversized Part proxy.
        top=.178;bottom=.070 if ident=='glock_17'else-.065
        width=.035;depth=.041
        count=5 if lod==0 else 3
        sections=[]
        for i in range(count):
            t=i/(count-1);y=top+(bottom-top)*t;z=-.029+.046*min(1,t*(.134/(top-bottom)))
            # The long variant continues the lower body's lean; mouth stays fixed.
            if ident=='glock_33' and y<.044:z=.017+(.044-y)*.26
            w=width*(.88 if i==0 else 1)
            sections.append((y,ring(w,depth,z)))
        objects.append(finish(loft(ident+'_shell_'+str(lod),sections,axis='Y'), 'polymer',lod,group))
        by,bz=sections[-1][0],sections[-1][1][0][1]+depth/2
        objects.append(finish(loft(ident+'_base_'+str(lod),[(by+.003,ring(.0405,.049,bz)),(by-.007,ring(.0405,.049,bz)),(by-.010,ring(.037,.046,bz))],axis='Y'),'polymer',lod,group))
        if lod==0:
            # Witness dimples are exterior insets, no cartridge/internal model.
            rows=4 if ident=='glock_17'else 9
            for i in range(rows):
                t=(i+1)/(rows+1);y=top-.02+(bottom-top+.028)*t;z=-.029+(top-y)*.345
                for side in [-1,1]:
                    o=kit.extruded_profile(ident+'_witness',[(y-.0018,z-.0015),(y+.0018,z-.0015),(y+.0018,z+.0015),(y-.0018,z+.0015)],.0005,axis='X');o.location.x=side*.01765
                    objects.append(finish(o,'inset',lod,group))
    else:
        capacity=45 if ident.endswith('_45')else 20 if ident.endswith('_20')else 30
        length={20:.205,30:.26,45:.35}[capacity];curve=.083 if ident.startswith('ak762')else.048
        top=.118;segments=8 if lod==0 else 4
        sections=[]
        for i in range(segments):
            t=i/(segments-1);sections.append((top-length*t,ring(.064*(.90 if i==0 else 1),.092,-curve*t*t)))
        sections.append((top+.065,ring(.054,.086)))
        objects.append(finish(loft(ident+'_curved_shell_'+str(lod),sections,axis='Y'),'polymer'if'545'in ident else'steel',lod,group))
        bottom=top-length;z=-curve
        objects.append(finish(loft(ident+'_floorplate_'+str(lod),[(bottom+.007,ring(.069,.099,z)),(bottom-.005,ring(.069,.099,z)),(bottom-.008,ring(.065,.095,z))],axis='Y'),'steel',lod,group))
        # The upper collar preserves the family's common well insertion.
        objects.append(finish(loft(ident+'_lip_'+str(lod),[(top-.012,ring(.066,.094)),(top-.004,ring(.066,.094))],axis='Y'),'steel',lod,group))
        if lod==0:
            for side in [-1,1]:
                for ridge in [-.027,0,.027]:
                    points=[]
                    for i in range(segments):
                        t=i/(segments-1);y=top-.025-(length-.045)*t;z=-curve*t*t+ridge
                        points.append((y,ring(.004,.009,z)))
                    o=loft(ident+'_side_rib',points,axis='Y');o.location.x=side*.033
                    objects.append(finish(o,'polymer'if'545'in ident else'steel',lod,group))
            if 'window' in ident:
                for side in [-1,1]:
                    outline=[]
                    for t in [.18,.40,.65,.83]:outline.append((top-length*t,-curve*t*t-.010))
                    for t in [.83,.65,.40,.18]:outline.append((top-length*t,-curve*t*t+.010))
                    o=kit.extruded_profile(ident+'_dark_witness_window',outline,.001,axis='X');o.location.x=side*.0353
                    objects.append(finish(o,'window',lod,group))
    return objects

def slab(name,outline,width,kind,lod,group,x=0,edge=0):
    obj=kit.extruded_profile(name,[(y,z)for z,y in outline],width,axis='X');obj.location.x=x
    return finish(obj,kind,lod,group,edge if lod==0 else 0)

def stock(ident,lod):
    group='stock__'+ident;objects=[]
    wire=ident=='aksu_stock';skeleton=ident in ['ak_skeleton','ak_cheek','ak12_stock','ak12_cheek']
    if wire:
        outer=[[-.15,.052],[.205,.052],[.205,-.145]];inner=[[-.085,.031],[.177,.031],[.177,-.101]]
        o=kit.open_frame(ident+'_triangular_frame',[(y,z)for z,y in outer],[(y,z)for z,y in inner],.026,axis='X');objects.append(finish(o,'steel',lod,group,.0012 if lod==0 else 0))
    elif skeleton:
        outer=[[-.155,.045],[-.10,.064],[.15,.064],[.205,.035],[.205,-.13],[.15,-.15],[-.10,-.045],[-.155,-.032]]
        inner=[[-.115,.020],[-.075,.034],[.125,.034],[.173,.014],[.173,-.087],[.14,-.107],[-.07,-.019],[-.115,-.010]]
        if ident.startswith('ak12'):
            outer[0][1]=.055;outer[1][1]=.075;inner[1][1]=.037
        o=kit.open_frame(ident+'_open_stock',[(y,z)for z,y in outer],[(y,z)for z,y in inner],.072 if ident.startswith('ak12')else.045,axis='X');objects.append(finish(o,'polymer'if ident.startswith('ak12')else'steel',lod,group,.002 if lod==0 else 0))
        if ident in ['ak_cheek','ak12_cheek']:
            objects.append(slab(ident+'_raised_cheek',[[-.075,.055],[.135,.055],[.15,.11],[-.06,.12],[-.09,.09]],.092,'polymer',lod,group,edge=.002))
        if lod==0:
            for z in [-.07,.04]:objects.append(slab(ident+'_cheek_support',[[z-.008,.02],[z+.008,.02],[z+.008,.074],[z-.008,.074]],.05,'steel',lod,group))
    else:
        outline=[[-.185,.025],[-.13,.038],[-.085,.058],[.16,.072],[.205,.044],[.213,-.145],[.16,-.152],[-.06,-.075],[-.14,-.030],[-.185,-.020]]
        objects.append(slab(ident+'_tapered_stock',outline,.084,'wood'if'wood'in ident else 'polymer',lod,group,edge=.0025))
        if lod==0 and'wood'not in ident:
            for side in [-1,1]:objects.append(slab(ident+'_recess_panel',[[-.055,.027],[.14,.038],[.16,-.095],[-.045,-.048]],.0012,'inset',lod,group,x=side*.0432))
    # The narrow neck reaches the receiver while the broad shoulder remains separate.
    objects.append(slab(ident+'_receiver_neck',[[-.19,-.018],[-.11,-.025],[-.11,.025],[-.19,.022]],.051,'steel'if wire else 'polymer',lod,group,edge=.001))
    objects.append(slab(ident+'_buttpad',[[.19,.054],[.227,.045],[.229,-.146],[.194,-.156]],.074 if wire else.097,'steel'if wire else 'rubber',lod,group,edge=.0015))
    if lod==0:
        for y in [-.115,-.08,-.045,-.01,.025]:objects.append(slab(ident+'_pad_tread',[[.226,y-.004],[.232,y-.004],[.232,y+.004],[.226,y+.004]],.08,'rubber',lod,group))
        # Exterior sling lug: actual open eye, no hidden mechanism.
        outer=[[-.008,-.010],[.008,-.010],[.008,.010],[-.008,.010]];inner=[[-.004,-.005],[.004,-.005],[.004,.005],[-.004,.005]]
        o=kit.open_frame(ident+'_sling_eye',outer,inner,.007,axis='X');o.location=(.045,-.065,.12);objects.append(finish(o,'steel',lod,group))
    return objects

def rails(ident,lod,group,length,top=.080):
    out=[];count=round(length/.027)
    for i in range(count):
        z=-length/2+(i+.5)*length/count
        cross=[(-.043,top),(.043,top),(.043,top+.008),(.034,top+.014),(-.034,top+.014),(-.043,top+.008)]
        o=loft(ident+'_rail_tooth',[(z-.008,cross),(z+.008,cross)],axis='Z');out.append(finish(o,'steel',lod,group))
    return out

def guard(ident,lod):
    group='handguard__'+ident;out=[]
    length=.18 if ident.startswith('aksu')else.43 if ident=='ak12_guard_long'else.31 if ident.startswith('ak12')else.28
    wood=ident in ['ak_wood','aksu_guard'];vent=ident in ['ak_vent','ak_rail','aksu_rail','ak12_guard','ak12_guard_long']
    if not vent:
        sections=[(-length/2,ring(.092,.062,-.023)),(-length*.32,ring(.113,.074,-.026)),(length*.32,ring(.105,.071,-.024)),(length/2,ring(.089,.060,-.020))]
        out.append(finish(loft(ident+'_lower_palm_shell',sections,axis='Z'),'wood'if wood else 'polymer',lod,group))
        upper=[(-length*.46,ring(.063,.037,.052)),(-length*.30,ring(.075,.040,.054)),(length*.30,ring(.073,.040,.054)),(length*.46,ring(.061,.035,.051))]
        out.append(finish(loft(ident+'_upper_gas_cover',upper,axis='Z'),'wood'if wood else 'polymer',lod,group))
        if lod==0:
            for i in range(5 if wood else 7):
                z=-length*.36+i*length*.72/(4 if wood else 6)
                out.append(slab(ident+'_grip_ridge',[[z-.003,-.054],[z+.003,-.054],[z+.003,-.065],[z-.003,-.065]],.100,'wood'if wood else 'polymer',lod,group))
    else:
        windows=4 if length>.35 else 3
        for side in [-1,1]:
            for i in range(windows):
                a=-length/2+i*length/windows;b=a+length/windows
                outer=[(a,-.058),(b,-.058),(b,.022),(a,.022)]
                inner=[(a+.010,-.038),(b-.010,-.038),(b-.010,.004),(a+.010,.004)]
                o=kit.open_frame(ident+'_vent_wall',[(y,z)for z,y in outer],[(y,z)for z,y in inner],.006,axis='X');o.location.x=side*.0505;out.append(finish(o,'steel',lod,group,.0008 if lod==0 else 0))
        out.append(finish(loft(ident+'_bottom_bridge',[(-length/2,ring(.102,.012,-.055)),(length/2,ring(.102,.012,-.055))],axis='Z'),'steel',lod,group))
        out.append(finish(loft(ident+'_upper_cover',[(-length*.45,ring(.069,.027,.051)),(length*.45,ring(.069,.027,.051))],axis='Z'),'polymer'if ident.startswith('ak12')else'steel',lod,group))
        if ident!='ak_vent':out+=rails(ident,lod,group,length*.90,.072)
    for z in [-length/2,length/2]:
        outer=ring(.112,.133,.0065);inner=[(x/math.hypot(x,y-.016)*.018,.016+(y-.016)/math.hypot(x,y-.016)*.018)for x,y in outer]
        o=kit.open_frame(ident+'_retaining_band',outer,inner,.006,axis='Z');o.location.z=z;out.append(finish(o,'steel',lod,group))
    return out

def grip(ident,lod):
    group='pistolgrip__'+ident
    outlines={
      'ak_grip':[[-.039,.069],[.026,.065],[.043,-.115],[.028,-.139],[-.018,-.141],[-.051,-.052]],
      'ak_ergo':[[-.041,.068],[.023,.067],[.030,.026],[.055,-.070],[.047,-.123],[.019,-.143],[-.019,-.136],[-.045,-.068],[-.050,-.027]],
      'ak_palm':[[-.043,.069],[.029,.067],[.040,.014],[.065,-.063],[.063,-.119],[.039,-.151],[-.014,-.149],[-.043,-.081],[-.049,-.025]]}
    width=.070 if ident=='ak_palm'else.064;out=[slab(ident+'_contoured_grip',outlines[ident],width,'polymer',lod,group,edge=.002)]
    if lod==0:
        for side in [-1,1]:out.append(slab(ident+'_grip_panel',[[-.033,.02],[.018,.02],[.039,-.105],[.023,-.12],[-.011,-.12],[-.032,-.06]],.001,'inset',lod,group,x=side*(width/2+.001)))
        for i in range(4):
            y=-.026-i*.024;z=-.035+i*.005
            out.append(slab(ident+'_front_grasp_ridge',[[z-.009,y-.003],[z+.006,y-.003],[z+.006,y+.003],[z-.009,y+.003]],width*.90,'polymer',lod,group))
    return out

def mount(ident,lod):
    group='mount__'+ident;short=ident=='aksu_mount';length=.125 if short else.235
    out=[slab(ident+'_top_deck',[[-length/2,.038],[length/2,.038],[length/2,.058],[-length/2,.058]],.091,'steel',lod,group,edge=.001)]
    if short:
        for x in [-.040,.040]:out.append(slab(ident+'_cover_saddle',[[-.045,-.005],[.045,-.005],[.045,.039],[-.045,.039]],.012,'steel',lod,group,x=x,edge=.001))
    else:
        out.append(slab(ident+'_side_plate',[[-.060,-.127],[.082,-.127],[.091,-.100],[.073,.038],[-.071,.038],[-.074,-.075]],.018,'steel',lod,group,x=-.068,edge=.0015))
        out.append(slab(ident+'_cross_arm',[[-.05,.020],[.075,.020],[.075,.042],[-.05,.042]],.084,'steel',lod,group,x=-.028))
        if lod==0:out.append(slab(ident+'_external_lever',[[-.062,-.100],[.028,-.101],[.044,-.088],[-.059,-.085]],.010,'steel',lod,group,x=-.084))
    out+=rails(ident,lod,group,length,.044)
    return out

def circular(radius,count=12):return[(math.cos(i*2*math.pi/count)*radius,math.sin(i*2*math.pi/count)*radius)for i in range(count)]
def muzzle(ident,lod):
    group='muzzle__'+ident;out=[];segments=16 if lod==0 else 8
    can='suppressor'in ident or ident.endswith('_can');cone=ident=='aksu_muzzle'
    length=.27 if can else.095 if cone else.13 if ident=='ak12_brake'else.105
    radius=.032 if can else.027 if cone else.024
    if can or cone:
        rfront=radius if can else.029;rback=radius if can else.018
        rings=[(.018,circular(rback*.76,segments)),(.006,circular(rback,segments)),(-length+.008,circular(rfront,segments)),(-length,circular(rfront*.93,segments))]
        if can:rings.insert(2,(-.035,circular(radius,segments)))
        out.append(finish(loft(ident+'_exterior_shell',rings,axis='Z'),'steel',lod,group))
        # Thin visible rim and a shallow dark recess, not reconstructed internals.
        o=kit.open_frame(ident+'_front_rim',circular(rfront*.94,segments),circular(rfront*.35,segments),.002,axis='Z');o.location.z=-length-.001;out.append(finish(o,'steel',lod,group))
        o=loft(ident+'_dark_aperture',[(-length-.0008,circular(rfront*.36,segments)),(-length+.0002,circular(rfront*.36,segments))],axis='Z');out.append(finish(o,'inset',lod,group))
        if lod==0 and can:
            for z in [-.017,-.023,-.029]:out.append(finish(loft(ident+'_collar_grip_band',[(z-.001,circular(radius*1.04,segments)),(z+.001,circular(radius*1.04,segments))],axis='Z'),'steel',lod,group))
    else:
        ports=3 if ident=='ak12_brake'else 2
        for i in range(ports+1):
            z=.012-i*(length/ports)
            o=kit.open_frame(ident+'_external_port_ring',circular(radius,segments),circular(radius*.55,segments),.012,axis='Z');o.location.z=z;out.append(finish(o,'steel',lod,group))
        for y in [-radius*.80,radius*.80]:
            out.append(finish(loft(ident+'_port_bridge',[(-length+.006,ring(.025,.009,y)),(.014,ring(.025,.009,y))],axis='Z'),'steel',lod,group))
        out.append(finish(loft(ident+'_rear_collar',[(.010,circular(radius*.82,segments)),(.030,circular(radius*.82,segments))],axis='Z'),'steel',lod,group))
    return out

# Independent exterior dimensions/curvature; capacity variants share only their mouth.
MAGAZINES={
'ar556_20':(.066,.092,.180,.205,.008,'steel','stanag'),
'ar556_30':(.066,.092,.180,.300,.035,'steel','stanag'),
'ar556_60':(.066,.092,.180,.32,0,'polymer','drum'),
'aug_30':(.069,.095,.170,.280,.033,'window','waffle'),
'aug_42':(.069,.095,.170,.370,.045,'window','waffle'),
'g36_20':(.071,.100,.170,.235,.025,'window','linked'),
'g36_30':(.071,.100,.170,.310,.036,'window','linked'),
'grach_18':(.051,.069,.105,.205,-.028,'steel','pistol'),
'kedr_20':(.047,.061,.180,.300,-.012,'steel','stick'),
'kedr_30':(.047,.061,.180,.390,-.016,'steel','stick'),
'm14_10':(.073,.114,.140,.210,.012,'steel','stamped'),
'm14_20':(.073,.114,.140,.285,.019,'steel','stamped'),
'm17_17':(.050,.070,.105,.205,-.030,'steel','pistol'),
'm17_21':(.050,.070,.105,.245,-.030,'steel','pistol_extended'),
'm9_17':(.048,.067,.105,.205,-.025,'steel','pistol'),
'm9_20':(.048,.067,.105,.240,-.025,'steel','pistol_extended'),
'mp5_15':(.049,.065,.180,.235,.022,'steel','smooth'),
'mp5_30':(.049,.065,.180,.350,.057,'steel','smooth'),
'mpx_20':(.054,.071,.175,.245,.025,'polymer','reinforced'),
'mpx_30':(.054,.071,.175,.335,.041,'polymer','reinforced'),
'pm_8':(.039,.059,.100,.195,-.025,'steel','pistol'),
'saiga_5':(.087,.129,.180,.260,.020,'steel','stamped'),
'saiga_8':(.087,.129,.180,.375,.041,'polymer','reinforced'),
'scorpion_20':(.052,.070,.175,.255,.039,'polymer','windowed'),
'scorpion_30':(.052,.070,.175,.345,.055,'polymer','windowed'),
'sv98_10':(.077,.112,.140,.215,.008,'polymer','waffle'),
'svd_10':(.077,.116,.140,.225,.046,'steel','x_rib'),
'tt_8':(.039,.060,.100,.200,-.030,'steel','pistol'),
'val_10':(.068,.105,.160,.215,.023,'steel','stamped'),
'val_20':(.068,.105,.160,.280,.038,'polymer','reinforced'),
'val_30':(.068,.105,.160,.360,.060,'polymer','reinforced'),
'vityaz_30':(.049,.066,.180,.365,.033,'polymer','smooth'),
}

def exterior_magazine(ident,lod):
    w,d,top,length,bend,kind,style=MAGAZINES[ident];group='magazine__'+ident;out=[]
    if style=='drum':
        # Original exterior drum shell, transverse axis; no feed mechanism.
        o=loft(ident+'_round_housing',[(-.060,circular(.099,20 if lod==0 else 12)),(.060,circular(.099,20 if lod==0 else 12))],axis='X');o.location.y=-.030;out.append(finish(o,'polymer',lod,group))
        for side in [-1,1]:
            o=loft(ident+'_outer_end_panel',[(side*.061,circular(.087,20 if lod==0 else 12)),(side*.063,circular(.079,20 if lod==0 else 12))],axis='X');o.location.y=-.030;out.append(finish(o,'polymer',lod,group))
        out.append(finish(loft(ident+'_feed_tower',[(.025,ring(w,d)),(top,ring(w*.87,d*.90))],axis='Y'),'polymer',lod,group))
        return out
    count=7 if lod==0 else 4;sections=[]
    for i in range(count):
        t=i/(count-1);z=-bend*t*t
        if style.startswith('pistol'):z=.018-t*bend
        sections.append((top-length*t,ring(w*(.88 if i==0 else 1),d,z)))
    out.append(finish(loft(ident+'_individual_shell',sections,axis='Y'),kind,lod,group))
    bottom=top-length;z=-bend if not style.startswith('pistol')else.018-bend
    footdepth=.026 if style=='pistol_extended'else.011
    out.append(finish(loft(ident+'_floorplate',[(bottom+.003,ring(w*1.10,d*1.08,z)),(bottom-footdepth,ring(w*1.10,d*1.08,z)),(bottom-footdepth-.003,ring(w*1.02,d*1.02,z))],axis='Y'),'polymer'if style.startswith('pistol')else kind,lod,group))
    if lod==0:
        if style in ['stanag','stamped','reinforced','waffle','windowed','linked']:
            ridges=3 if style!='waffle'else 4
            for side in [-1,1]:
                for j in range(ridges):
                    dz=(j-(ridges-1)/2)*d*.21;rs=[]
                    for i in range(count):
                        t=i/(count-1);y=top-.024-(length-.045)*t;zz=-bend*t*t+dz
                        rs.append((y,ring(.0035,.008,zz)))
                    o=loft(ident+'_external_stiffening_rib',rs,axis='Y');o.location.x=side*(w/2+.001);out.append(finish(o,kind,lod,group))
                if style in ['waffle','reinforced']:
                    for j in range(4):
                        t=(j+1)/5;y=top-length*t;zz=-bend*t*t
                        outline=[(zz-d*.44,y-.002),(zz+d*.44,y-.002),(zz+d*.44,y+.002),(zz-d*.44,y+.002)]
                        out.append(slab(ident+'_cross_rib',outline,.003,kind,lod,group,x=side*(w/2+.0015)))
        if style.startswith('pistol')or style=='stick':
            for side in [-1,1]:
                for j in range(5):
                    t=(j+1)/6;y=top-.015-(length-.03)*t;zz=.018-t*bend if style.startswith('pistol')else-bend*t*t
                    out.append(slab(ident+'_witness_inset',[(zz-.002,y-.002),(zz+.002,y-.002),(zz+.002,y+.002),(zz-.002,y+.002)],.0007,'inset',lod,group,x=side*(w/2+.0004)))
        if style=='linked':
            for side in [-1,1]:
                for y in [top-.065,top-.115]:out.append(slab(ident+'_coupling_lug',[[-.018,y-.005],[.005,y-.005],[.005,y+.005],[-.018,y+.005]],.012,'polymer',lod,group,x=side*(w/2+.005)))
        if style in ['x_rib','windowed']:
            for side in [-1,1]:
                a=top-.045;b=bottom+.035
                for sign in [-1,1]:out.append(slab(ident+'_diagonal_panel_rib',[[sign*d*.35,a],[sign*d*.35+.006,a],[-sign*d*.30+.006,b],[-sign*d*.30,b]],.002,kind,lod,group,x=side*(w/2+.001)))
    return out


GRIPS={
'ar_grip':(.064,.142,.030,'polymer','straight'),
'ar_ergo':(.068,.142,.047,'rubber','ergo'),
'ar_wrapped':(.066,.142,.035,'polymer','wrap'),
'bren_grip':(.071,.137,.042,'polymer','ergo'),
'g36_grip':(.070,.151,.021,'polymer','vertical'),
'grach_grip':(.082,.139,.039,'polymer','ergo'),
'kedr_grip':(.054,.137,.018,'polymer','vertical'),
'm17_grip':(.071,.140,.046,'sand','palm'),
'm17_grip_slim':(.062,.140,.039,'sand','slim'),
'm9_grip':(.069,.135,.040,'sand','panel'),
'm9_rubber':(.076,.135,.043,'rubber','ergo'),
'pm_grip':(.062,.132,.041,'wood','palm'),
'pm_rubber':(.068,.135,.047,'rubber','ergo'),
'scorpion_grip':(.066,.148,.033,'polymer','angled'),
'tt_grip':(.061,.147,.028,'polymer','panel'),
'val_ergo':(.072,.144,.049,'rubber','ergo'),
'val_grip':(.065,.140,.033,'polymer','straight'),
}

def exterior_grip(ident,lod):
    w,bottom,lean,kind,style=GRIPS[ident];group='pistolgrip__'+ident
    # Per-item profiles keep the top contact, waist and lower palm volume distinct.
    top=.070;front=-.040
    outline=[[-.032,top],[.028,top-.006],[.027,top-.035],[lean+.022,-bottom*.60],[lean+.015,-bottom+.012],[lean-.003,-bottom],[-.014,-bottom+.004],[front,-.050],[front-.004,.008]]
    if style=='vertical':outline=[[-.034,top],[.031,top],[.032,-bottom+.007],[.019,-bottom],[-.025,-bottom],[-.038,-.042]]
    if style=='slim':outline[3][0]-=.012;outline[4][0]-=.010
    if style=='palm':outline[3][0]+=.012;outline[4][0]+=.008
    out=[slab(ident+'_item_profile',outline,w,kind,lod,group,edge=.0025)]
    for side in [-1,1]:
        panel=[[-.027,.030],[.020,.029],[lean+.006,-bottom+.027],[lean-.014,-bottom+.016],[-.024,-.057]]
        out.append(slab(ident+'_molded_panel',panel,.0014,'inset'if kind!='wood'else'wood',lod,group,x=side*(w/2+.0007)))
    if lod==0:
        if style in ['ergo','palm']:
            for i in range(3):
                y=-.025-i*.031;z=front+.003+i*.004
                out.append(slab(ident+'_finger_land',[[z-.008,y-.006],[z+.010,y-.006],[z+.010,y+.006],[z-.008,y+.006]],w*.95,kind,lod,group,edge=.001))
        if style=='wrap':
            for i in range(5):
                y=.005-i*.025;z=.005+lean*(.070-y)/(.070+bottom)
                out.append(finish(loft(ident+'_fabric_tape_band',[(y-.005,ring(w*1.035,.085,z)),(y+.005,ring(w*1.035,.085,z))],axis='Y'),'rubber',lod,group))
        if style=='panel':
            for side in [-1,1]:
                for y in [.038,-bottom+.034]:
                    o=loft(ident+'_visible_panel_screw',[(-.001,circular(.004,8)),(.001,circular(.004,8))],axis='X');o.location=(side*(w/2+.002),y,.006+lean*(.070-y)/(.070+bottom));out.append(finish(o,'steel',lod,group))
    return out

OPTICS={'red_dot':'open','holo':'holo','pistol_dot':'closed','dot_tube':'tube','prism2':'prism2','scope3_compact':'prism3','scope4':'scope4','scope6':'scope6'}

def optic(ident,lod):
    style=OPTICS[ident];group='optic__'+ident;out=[];axis=.060
    w=.050 if style=='closed'else.066 if style=='open'else.080
    length={'open':.070,'closed':.066,'holo':.118,'tube':.135,'prism2':.180,'prism3':.220,'scope4':.300,'scope6':.425}[style]
    out.append(finish(loft(ident+'_foot',[(-length*.31,ring(w,.028,.002)),(length*.31,ring(w,.028,.002))],axis='Z'),'steel',lod,group))
    if style in ['open','closed','holo']:
        fw=.065 if style=='open'else.045 if style=='closed'else.080
        outer=[(-fw/2,axis-.044),(fw/2,axis-.044),(fw/2,axis+.024),(fw*.35,axis+.035),(-fw*.35,axis+.035),(-fw/2,axis+.024)]
        inner=[(-fw/2+.007,axis-.025),(fw/2-.007,axis-.025),(fw/2-.007,axis+.020),(fw*.30,axis+.028),(-fw*.30,axis+.028),(-fw/2+.007,axis+.020)]
        o=kit.open_frame(ident+'_window_housing',outer,inner,.052 if style=='closed'else.016,axis='Z');o.location.z=0 if style=='closed'else-.010;out.append(finish(o,'steel',lod,group,.0006 if lod==0 else 0))
        if style=='closed':
            for z in [-.026,.026]:
                o=kit.open_frame(ident+'_enclosed_window_rim',outer,inner,.006,axis='Z');o.location.z=z;out.append(finish(o,'steel',lod,group))
        if style=='holo':
            out.append(finish(loft(ident+'_forward_battery_box',[(-.063,ring(.070,.040,.020)),(-.022,ring(.070,.040,.020))],axis='Z'),'steel',lod,group))
        if style=='open':out.append(slab(ident+'_side_battery_tray',[[-.022,.015],[.024,.015],[.024,.040],[-.022,.040]],.014,'steel',lod,group,x=.038))
    else:
        radius=.029 if style=='tube'else.034 if style.startswith('prism')else.021
        out.append(slab(ident+'_lower_pedestal',[[-length*.23,.012],[length*.23,.012],[length*.23,.037],[-length*.23,.037]],.043,'steel',lod,group))
        o=kit.hollow_tube(ident+'_open_optical_body',radius,radius-.006,length,12 if lod==0 else 8,axis='Z');o.location.y=axis;out.append(finish(o,'steel',lod,group))
        if style.startswith('prism'):
            out.append(slab(ident+'_prism_lower_wedge',[[-length*.32,.022],[length*.32,.022],[length*.29,.046],[-length*.20,.044]],.060,'steel',lod,group,edge=.0015))
        if style.startswith('scope'):
            for z,rl in [(-length*.43,.039),(length*.40,.032)]:
                o=kit.hollow_tube(ident+'_bell_housing',rl,rl-.006,.068 if z<0 else.047,16 if lod==0 else 8,axis='Z');o.location=(0,axis,z);out.append(finish(o,'steel',lod,group))
            for z in [-length*.17,length*.13]:
                o=kit.hollow_tube(ident+'_external_mount_ring',radius+.007,radius+.001,.016,12 if lod==0 else 8,axis='Z');o.location=(0,axis,z);out.append(finish(o,'steel',lod,group))
                out.append(slab(ident+'_ring_mount_leg',[[z-.013,.010],[z+.013,.010],[z+.013,.043],[z-.013,.043]],.047,'steel',lod,group))
        # External controls are displaced above/alongside the clear aim axis.
        o=loft(ident+'_elevation_turret',[(axis+radius*.7,circular(.015,12 if lod==0 else 8)),(axis+radius+.022,circular(.015,12 if lod==0 else 8))],axis='Y');out.append(finish(o,'steel',lod,group))
    if lod==0:
        for side in [-1,1]:out.append(slab(ident+'_base_clamp',[[length*-.25,-.012],[length*.25,-.012],[length*.25,.005],[length*-.25,.005]],.008,'steel',lod,group,x=side*w*.52))
    return out

FOREGRIPS=['fore_angled','fore_bail','fore_slim','fore_stop','fore_stub','fore_vertical']
def foregrip(ident,lod):
    group='grip__'+ident;out=[]
    out.append(finish(loft(ident+'_rail_clamp',[(-.045,ring(.064,.025,.0775)),(.045,ring(.064,.025,.0775))],axis='Z'),'steel',lod,group))
    if ident in ['fore_vertical','fore_stub']:
        length=.170 if ident=='fore_vertical'else.095
        out.append(finish(loft(ident+'_faceted_handle',[(.065,ring(.047,.055)),(.025,ring(.054,.064)),(.065-length,ring(.049,.060))],axis='Y'),'polymer',lod,group))
        out.append(finish(loft(ident+'_flared_base',[(.065-length,ring(.057,.067)),(.056-length,ring(.057,.067))],axis='Y'),'polymer',lod,group))
        if lod==0:
            for y in [.03-i*length*.12 for i in range(6)]:out.append(finish(loft(ident+'_grip_texture_band',[(y-.002,ring(.055,.065)),(y+.002,ring(.055,.065))],axis='Y'),'polymer',lod,group))
    elif ident=='fore_bail':
        outer=[[-.065,.059],[.088,.059],[.088,-.092],[-.035,-.092]];inner=[[-.039,.036],[.063,.036],[.063,-.063],[-.021,-.063]]
        o=kit.open_frame(ident+'_open_angled_bail',[(y,z)for z,y in outer],[(y,z)for z,y in inner],.052,axis='X');out.append(finish(o,'polymer',lod,group,.002 if lod==0 else 0))
    elif ident=='fore_stop':out.append(slab(ident+'_forward_stop',[[-.040,.065],[.028,.065],[.031,.024],[.014,-.012],[-.005,-.014],[-.019,.033]],.048,'polymer',lod,group,edge=.002))
    else:
        small=ident=='fore_slim';outline=[[-.065,.060],[.080,.060],[.081,.022],[.040,-.051 if small else-.085],[.010,-.068 if small else-.095],[-.052,.019]]
        out.append(slab(ident+'_inclined_palm_profile',outline,.044 if small else.058,'polymer',lod,group,edge=.002))
    return out

LIGHTS=['flashlight','light_compact','pistol_light','wide_light']
LASERS=['laser','laser_dual']
def illuminator(ident,lod):
    laser=ident in LASERS;pistol=ident=='pistol_light';group=('laser__'if laser else'light__')+ident;out=[]
    if laser:
        w=.084 if ident=='laser_dual'else.057;length=.106 if ident=='laser_dual'else.083
        out.append(finish(loft(ident+'_asymmetric_emitter_housing',[(-length/2,ring(w,.042)),(length*.30,ring(w,.047)),(length/2,ring(w*.82,.041))],axis='Z'),'polymer',lod,group))
        for x in [-.020,.020]if ident=='laser_dual'else[0]:
            o=kit.hollow_tube(ident+'_external_emitter_rim',.008,.004,.009,12 if lod==0 else 8,axis='Z');o.location=(x,.004,-length/2-.003);out.append(finish(o,'steel',lod,group))
        out.append(slab(ident+'_rail_arm',[[-.025,-.025],[.025,-.025],[.025,-.004],[-.025,-.004]],.060,'steel',lod,group,x=.027))
    else:
        length=.108 if pistol else.117 if ident=='light_compact'else.172
        radius=.020 if pistol else.022
        o=loft(ident+'_battery_tube',[(-length*.40,circular(radius,12 if lod==0 else 8)),(length*.38,circular(radius,12 if lod==0 else 8))],axis='Z');o.location.y=-.010 if pistol else 0;out.append(finish(o,'steel',lod,group))
        head=.035 if ident=='wide_light'else.026 if not pistol else.023
        o=kit.hollow_tube(ident+'_bezel',head,head*.74,.029,16 if lod==0 else 8,axis='Z');o.location=(0,-.010 if pistol else 0,-length*.45);out.append(finish(o,'steel',lod,group))
        o=loft(ident+'_reflector',[( -length*.45+.003,circular(head*.72,16 if lod==0 else 8)),(-length*.45+.004,circular(head*.72,16 if lod==0 else 8))],axis='Z');o.location.y=-.010 if pistol else 0;out.append(finish(o,'lens',lod,group))
        if pistol:out.append(finish(loft(ident+'_pistol_rail_saddle',[(-.031,ring(.063,.026,.040)),(.036,ring(.063,.026,.040))],axis='Z'),'steel',lod,group))
        else:out.append(slab(ident+'_inboard_rail_arm',[[-.038,-.023],[.038,-.023],[.038,.003],[-.038,.003]],.068,'steel',lod,group,x=-.028))
        if lod==0:
            for z in [-.025,-.013,.0,.013,.026]:
                o=loft(ident+'_grip_ring',[(z-.002,circular(radius*1.07,12)),(z+.002,circular(radius*1.07,12))],axis='Z');out.append(finish(o,'steel',lod,group))
    return out


def create_module(ident,lod):
    if ident in GRIPS:return exterior_grip(ident,lod)
    if ident in OPTICS:return optic(ident,lod)
    if ident in FOREGRIPS:return foregrip(ident,lod)
    if ident in LIGHTS or ident in LASERS:return illuminator(ident,lod)
    if ident in MAGAZINES:return exterior_magazine(ident,lod)
    if ident.startswith(('glock_','ak545_','ak762_')):return curve_mag(ident,lod)
    if ident in ['aksu_stock','ak_stock','ak_wood_stock','ak_cheek','ak_skeleton','ak12_stock','ak12_cheek']:return stock(ident,lod)
    if ident in ['aksu_guard','aksu_rail','ak_poly','ak_wood','ak_vent','ak_rail','ak12_guard','ak12_guard_long']:return guard(ident,lod)
    if ident in ['ak_grip','ak_ergo','ak_palm']:return grip(ident,lod)
    if ident in ['ak_mount','aksu_mount']:return mount(ident,lod)
    if ident in ['aksu_muzzle','ak_brake','ak_ported','ak_suppressor','ak12_brake','ak12_can']:return muzzle(ident,lod)
    raise ValueError('No authored recipe: '+ident)


def merge_draw_meshes(objects):
    result=[];buckets={}
    for obj in objects:buckets.setdefault((obj['lod'],obj.data.materials[0].name),[]).append(obj)
    for key,rows in buckets.items():
        for obj in bpy.context.selected_objects:obj.select_set(False)
        for obj in rows:obj.select_set(True)
        bpy.context.view_layer.objects.active=rows[0]
        if len(rows)>1:bpy.ops.object.join()
        result.append(rows[0])
    return result

def build(ids):
    OUT.mkdir(parents=True,exist_ok=True);SOURCE.mkdir(parents=True,exist_ok=True)
    manifest_path=SOURCE/'manifest.json';manifest=json.loads(manifest_path.read_text())if manifest_path.exists()else{}
    original_scene=bpy.context.window.scene;original_file=bpy.data.filepath
    try:
        for ident in ids:
            scene=bpy.data.scenes.new('RAID_Attachment_'+ident);bpy.context.window.scene=scene
            scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
            objects=[]
            try:
                for lod in [0,1]:objects+=create_module(ident,lod)
                bpy.context.view_layer.update()
                objects=merge_draw_meshes(objects)
                bpy.context.view_layer.update()
                glb=OUT/(ident+'.glb');blend=SOURCE/(ident+'.blend')
                kit.export_asset(objects,glb,blend)
                checked=audit.audit_asset(glb,SOURCE/(ident+'-audit.json'),SOURCE/(ident+'-roundtrip.glb'))
                if checked['status']!='PASSED':raise ValueError(str(checked['errors']))
                digest=hashlib.sha256(glb.read_bytes()).hexdigest();group=objects[0]['assetKey']
                manifest[ident]={'url':'/assets/art-overhaul/attachments/'+ident+'.glb?v='+digest[:12],'groups':[group],'frame':'meters','groupBounds':checked['groupBounds'],'source':str(blend),'sha256':digest,'triangles':{lod:checked['groups'][group][lod]['triangles']for lod in ['0','1']},'status':'STRUCTURAL_PASS_AWAITING_VISUAL_FIT'}
                manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
            finally:
                bpy.context.window.scene=original_scene
                for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
                bpy.data.scenes.remove(scene)
        write_registry(manifest)
        return {ident:manifest[ident]for ident in ids}
    finally:
        bpy.context.window.scene=original_scene
        if bpy.data.filepath!=original_file:raise RuntimeError('User master path changed')


def write_registry(manifest):
    definitions={};overrides={}
    for ident,value in manifest.items():
        asset='overhaul_module_'+ident
        definitions[asset]={key:value[key]for key in ['url','groups','frame','groupBounds']}
        overrides[ident]={'asset':asset,'group':value['groups'][0]}
    text="// Original Blender module assets; generated by the attachment production pipeline.\nimport type { ModelAssetDefinition } from './model-asset-types.js';\nexport const ATTACHMENT_ASSET_DEFINITIONS: Record<string, ModelAssetDefinition> = "+json.dumps(definitions,indent=2)+";\nexport const ATTACHMENT_OVERRIDES: Record<string, { asset: string; group: string }> = "+json.dumps(overrides,indent=2)+";\n"
    (ROOT/'src/content/overhaul-attachment-assets.ts').write_text(text)
