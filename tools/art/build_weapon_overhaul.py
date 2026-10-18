"""Original rigid weapon shells. Run in a separate Blender background process.

Artwork dimensions follow the project's stylized metre-frame sockets; these are
not manufacturing drawings. Only exterior surfaces are authored. The catalog
owns detachable furniture, magazines, muzzle devices and their animations.
"""
import bpy
import json
import math
import sys
import argparse
import hashlib
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/art'))
import blender_meshkit as K
from blender_asset_audit import audit_asset

SOURCE = ROOT / 'art/overhaul/weapon_sources'
RUNTIME = ROOT / 'public/assets/art-overhaul/weapons'
DATA = json.loads((SOURCE / 'layout-input.json').read_text())
PROTECTED = {'weapon_akm','weapon_ak74m','weapon_glock17','akmn'}


def create_atlas():
    """One original shared colour + ORM atlas, no photographic pixels."""
    import numpy as np
    size = 512
    y, x = np.mgrid[0:size, 0:size].astype(float)
    rng = np.random.default_rng(331074)
    grain = rng.normal(0, .012, (size,size))
    colors = np.zeros((size,size,4), dtype=np.float32)
    orm = np.ones((size,size,4), dtype=np.float32)
    palettes = [(0.21,.235,.255),(.125,.14,.13),(.39,.315,.21),(.29,.15,.075)]
    for tile,color in enumerate(palettes):
        col,row = tile%2,tile//2
        sl=(slice(row*256,(row+1)*256),slice(col*256,(col+1)*256))
        xx,yy=x[sl],y[sl]
        n=grain[sl]
        if tile==0:
            n=n*.55 + .007*np.sin(yy*.9) + .004*np.sin(xx*.07+yy*.7)
        if tile==1:
            n=n*.8 + .004*np.sin(xx*.8)*np.sin(yy*.8)
        if tile==3:
            n=.028*np.sin(xx*.23+2*np.sin(yy*.025)+.6*np.sin(xx*.055)) + grain[sl]*.3
        for c in range(3):colors[sl+(c,)]=np.maximum(.008,color[c]+n)
        colors[sl+(3,)]=1
        orm[sl+(0,)]=1
        orm[sl+(1,)]=np.clip([.43,.78,.64,.51][tile]+n*.7,0,1)
        orm[sl+(2,)]=[.70,.01,.32,0][tile]
    images=[]
    for name,pixels in [('weapon-surface-atlas',colors),('weapon-orm-atlas',orm)]:
        image=bpy.data.images.new(name,width=size,height=size,alpha=True)
        image.colorspace_settings.name='sRGB' if 'surface' in name else 'Non-Color'
        image.pixels.foreach_set(pixels.ravel())
        image.filepath_raw=str(SOURCE / (name+'.png'));image.file_format='PNG';image.save();image.pack()
        images.append(image)
    mat=K.material('RAID original weapon atlas',(.16,.18,.18),'weapon-multisurface',.55,.7)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get('Principled BSDF')
    base=nodes.new('ShaderNodeTexImage');base.image=images[0]
    packed=nodes.new('ShaderNodeTexImage');packed.image=images[1]
    separate=nodes.new('ShaderNodeSeparateColor');separate.mode='RGB'
    links.new(base.outputs['Color'],bsdf.inputs['Base Color'])
    links.new(packed.outputs['Color'],separate.inputs['Color'])
    links.new(separate.outputs['Green'],bsdf.inputs['Roughness'])
    links.new(separate.outputs['Blue'],bsdf.inputs['Metallic'])
    return mat


class Shell:
    def __init__(self, record, lod, material):
        self.record=record;self.shape=record['shape'];self.layout=record['layout'];self.lod=lod
        self.mat=material;self.parts=[];self.group='body'
        self.width=.084

    def add(self,obj,role=0,bevel=0):
        if bevel and self.lod==0:K.bevel(obj,bevel,1)
        obj['assetKey']=self.group;obj['lod']=self.lod;obj['surfaceTile']=role
        obj.data.materials.append(self.mat)
        self.parts.append(obj)
        return obj

    def profile(self,name,points,width,role=0,x=0,bevel=.001):
        # Authored side profiles are (forward/back Z, height Y).
        obj=K.extruded_profile(name,[(h,z) for z,h in points],width,'X')
        obj.data.transform(Matrix.Translation((x,0,0)))
        return self.add(obj,role,bevel)

    def slab(self,name,p,s,role=0,bevel=.001):
        x,y,z=p;w,h,l=s
        return self.profile(name,[(z-l/2,y-h/2),(z+l/2,y-h/2),(z+l/2,y+h/2),(z-l/2,y+h/2)],w,role,x,bevel)

    def loft(self,name,sections,role=0):
        return self.add(K.loft(name,sections,'Z',True),role)

    def tube(self,name,z0,z1,y,r0,r1=None,role=0,x=0,segments=None):
        n=segments or (12 if self.lod==0 else 8)
        r1=r0 if r1 is None else r1
        return self.loft(name,[(z,[(x+r*math.cos(i*math.tau/n),y+r*math.sin(i*math.tau/n)) for i in range(n)]) for z,r in [(z0,r0),(z1,r1)]],role)

    def muzzle(self,z,y,r):
        # Visible external crown only. No internal mechanism or rifling.
        obj=K.hollow_tube('open barrel crown',r,r*.64,.008,16 if self.lod==0 else 8,'Z')
        obj.data.transform(Matrix.Translation((0,y,z+.004)))
        return self.add(obj,0)

    def frame(self,name,outer,inner,width,role=0,x=0):
        obj=K.open_frame(name,[(h,z) for z,h in outer],[(h,z) for z,h in inner],width,'X')
        obj.data.transform(Matrix.Translation((x,0,0)))
        return self.add(obj,role,.0007)

    def pin(self,name,x,y,z,r=.006,length=.008,role=0):
        n=10 if self.lod==0 else 6
        rings=[(a,[(y+r*math.cos(i*math.tau/n),z+r*math.sin(i*math.tau/n)) for i in range(n)]) for a in [x-length/2,x+length/2]]
        return self.add(K.loft(name,rings,'X',True),role)

    def port(self,obj,z,y,length,height,side=1):
        # A real exterior recess, rather than a black rectangle on a solid wall.
        cut=K.extruded_profile('temporary ejection aperture',[(y-height/2,z-length/2),(y-height/2,z+length/2),(y+height/2,z+length/2),(y+height/2,z-length/2)],.08,'X')
        cut.location.x=side*.054
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new('External ejection aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cut,do_unlink=True)
        K.planar_uv(obj)

    def trigger(self,z=.075,top=-.048,width=.038,large=False):
        length=.115 if large else .095;h=.078 if large else .068
        outer=[(z-length*.55,top),(z+length*.47,top),(z+length*.56,top-h*.68),(z+length*.35,top-h),(z-length*.38,top-h),(z-length*.58,top-h*.7)]
        inner=[(z-length*.40,top-.009),(z+length*.32,top-.009),(z+length*.40,top-h*.65),(z+length*.24,top-h+.009),(z-length*.27,top-h+.009),(z-length*.43,top-h*.65)]
        self.frame('open trigger guard',outer,inner,width)
        self.profile('curved trigger',[(z+.008,top-.004),(z+.019,top-.009),(z+.009,top-.038),(z-.009,top-.048),(z-.013,top-.042),(z+.001,top-.032)],.012,0,bevel=.0006)

    def rail(self,z0,z1,y,width=.058):
        self.slab('top rail spine',(0,y-.006,(z0+z1)/2),(width*.69,.018,z1-z0),0)
        step=.022 if self.lod==0 else .044
        for i in range(max(1,int((z1-z0)/step))):
            z=z0+.009+i*step
            self.profile('rail transverse tooth',[(z-.005,y),(z+.005,y),(z+.006,y+.009),(z-.006,y+.009)],width,0,bevel=0)

    def sights(self,front,rear,aim,hood=False,triangular=False):
        bore=self.layout['muzzle'][1]
        self.tube('front sight barrel saddle',front-.016,front+.016,bore,.023)
        if triangular:
            self.frame('A-frame front sight',[(front-.045,bore),(front+.055,bore),(front,aim-.016)],[(front-.024,bore+.018),(front+.029,bore+.018),(front,aim-.042)],.027)
        else:
            self.profile('front sight pedestal',[(front-.019,bore),(front+.02,bore),(front+.012,aim-.019),(front-.01,aim-.019)],.032)
        self.slab('front sight blade',(0,aim-.012,front),(.008,.024,.009),0,.0004)
        self.slab('front sight ear bridge',(0,aim-.026,front),(.057,.009,.026),0,.0006)
        for x in [-.022,.022]:
            self.profile('front protective ear',[(front-.014,aim-.027),(front+.015,aim-.027),(front+.01,aim+.013),(front-.009,aim+.007)],.007,0,x)
        if hood:
            obj=K.hollow_tube('front sight hood',.025,.021,.018,12 if self.lod==0 else 8,'Z');obj.data.transform(Matrix.Translation((0,aim-.001,front)))
            self.add(obj)
        self.slab('rear sight pedestal',(0,aim-.025,rear),(.062,.022,.038))
        self.profile('rear sight anchored riser',[(rear-.02,bore+.009),(rear+.02,bore+.009),(rear+.014,aim-.025),(rear-.014,aim-.025)],.039)
        for x in [-.017,.017]:self.slab('rear notch ear',(x,aim-.007,rear),(.022,.025,.012))

    def controls(self,width=None,z=.10):
        w=width or self.width
        rear_pin=min(.175,self.layout['anchors']['stock'][2]-.15)
        if self.lod==0:
            for x in [-w/2-.003,w/2+.003]:
                for zz,yy in [(z,.001),(-.10,-.021),(rear_pin,-.015)]:
                    if self.shape=='kedr' and yy==-.021:yy=.005
                    self.pin('recessed receiver pin',x,yy,zz,.005,.004)
                self.pin('selector pivot',x,-.029,z-.025,.009,.005)
                self.profile('selector thumb lever',[(z-.026,-.024),(z+.013,-.041),(z+.015,-.050),(z-.027,-.037)],.005,0,x)

    def action_handle(self,z=-.025,y=.037,side=1):
        self.group='action'
        self.slab('visible bolt face',(side*.038,y,z),(.015,.027,.092),0,.001)
        self.pin('charging stem',side*.058,y,z-.018,.008,.04)
        self.profile('charging handle grip',[(z-.035,y-.009),(z-.005,y-.009),(z,y+.004),(z-.029,y+.009)],.029,0,side*.081)
        self.group='body'

    def magwell(self,z,top=-.035,bottom=-.135,width=.082,depth=.107,role=0):
        # Open socket; detachable magazine carries all magazine geometry.
        for x in [-width/2+.006,width/2-.006]:
            self.profile('magwell side wall',[(z-depth*.52,top),(z+depth*.46,top),(z+depth*.57,bottom+.006),(z-depth*.6,bottom)],.012,role,x)
        for zz in [z-depth*.5,z+depth*.5]:
            self.slab('magwell end bridge',(0,(top+bottom)/2,zz),(width,.5*(top-bottom),.012),role)

    def barrel(self,r=.014,start=-.12):
        end=self.layout['muzzle'][2];y=self.layout['muzzle'][1]
        self.tube('stepped external barrel',end+.008,start,y,r,r*1.45)
        self.muzzle(end,y,r)
        self.tube('barrel shoulder',start-.055,start+.012,y,r*1.7)

    def ak(self):
        s=self.shape;L=self.layout;a=L['anchors'];end=L['muzzle'][2];bore=L['muzzle'][1]
        w=.102 if s=='saiga' else .087 if s=='rpk74' else .081;self.width=w
        rear=a['stock'][2]-.13;front=a['handguard'][2]+.11
        shell=self.profile('stamped receiver stepped shell',[(front,-.058),(rear-.018,-.062),(rear,-.032),(rear,.052),(rear-.038,.069),(front+.027,.06),(front,.024)],w)
        self.port(shell,-.017,.035,.112,.033)
        # Eight-sided cover arch, not a rectangular cap.
        ring=[(-w*.49,.043),(-w*.49,.065),(-w*.33,.092),(0,.102),(w*.33,.092),(w*.49,.065),(w*.49,.043),(0,.043)]
        self.loft('folded steel dust cover',[(front+.025,ring),(rear-.035,ring)])
        for x in [-w*.51,w*.51]:
            self.profile('stamping reinforcement',[(front+.027,-.032),(front+.105,-.032),(front+.115,-.009),(front+.035,-.008)],.004,0,x)
            if self.lod==0:
                for z in [front+.015,front+.053,rear-.025]:self.pin('receiver rivet',x, -.023,z,.006,.006)
        self.profile('AK safety selector',[(.145,.027),(-.047,-.028),(-.057,-.039),(-.03,-.044),(.16,.014)],.006,0,w/2+.001)
        self.pin('selector axis',w/2+.002,.023,.147,.011,.008)
        self.slab('rear trunnion',(0,-.01,rear-.008),(w*.94,.087,.042))
        self.barrel(.021 if s=='saiga' else .016 if s=='rpk74' else .013,front)
        gasfront=end+(.09 if s=='aksu' else .21)
        self.tube('gas tube exterior',gasfront,front+.03,bore+.055,.016)
        self.profile('angled gas block',[(gasfront-.018,bore-.009),(gasfront+.025,bore-.01),(gasfront+.06,bore+.067),(gasfront+.008,bore+.074)],.042)
        self.sights(end+.065 if s=='aksu' else end+.10,.11,L['aimHeight'],False)
        if s in ('ak12','saiga'):
            if s=='ak12':self.rail(front+.02,rear-.025,.108,.064)
        if s not in ('aksu','vityaz'):
            self.tube('visible cleaning rod',end+.035,front-.08,bore-.026,.003,segments=8)
        if s=='rpk74':
            self.pin('bipod cross clamp',0,bore-.009,end+.13,.016,.082)
            for x in [-.035,.035]:
                self.profile('folded bipod leg',[(end+.13,bore-.016),(end+.41,bore-.041),(end+.40,bore-.055),(end+.12,bore-.029)],.011,0,x)
                self.pin('bipod hinge',x,bore-.009,end+.13,.013,.012)
        if s in ('vityaz','saiga'):
            self.magwell(a['magazine'][2],-.045,-.135,w,.095)
        self.trigger(.08,-.055,.035)
        self.action_handle(-.026,.047)

    def ar(self):
        s=self.shape;L=self.layout;a=L['anchors'];front=a['handguard'][2]+.13;rear=a['stock'][2]-.13
        compact=s=='mpx';w=.088 if s=='hk416' else .08;self.width=w
        ring=[(-w*.33,-.018),(w*.33,-.018),(w*.50,.003),(w*.50,.060),(w*.30,.093),(-w*.30,.093),(-w*.50,.060),(-w*.50,.003)]
        rear_ring=[(x*.86,y-.004) for x,y in ring]
        upper=self.loft('forged upper octagonal receiver',[(front,ring),(rear-.035,ring),(rear,rear_ring)])
        self.port(upper,.005,.048,.126 if not compact else .095,.036)
        self.profile('sculpted lower receiver',[(front+.015,-.012),(rear-.018,-.012),(rear,.004),(rear-.015,-.058),(rear-.043,-.084),(.07,-.076),(.025,-.051),(front+.015,-.067)],w*.92)
        self.magwell(a['magazine'][2],-.028,-.135,.09,.12)
        for x in [-.046,.046]:
            self.profile('magazine well raised fence',[(a['magazine'][2]-.06,-.04),(a['magazine'][2]+.065,-.04),(a['magazine'][2]+.067,-.048),(a['magazine'][2]-.062,-.048)],.005,0,x)
        self.profile('magazine release fence',[(.005,-.018),(.061,-.018),(.065,-.032),(.007,-.035)],.009,0,.047)
        self.pin('magazine release button',.054,-.027,.024,.009,.006)
        self.trigger(.077,-.057,.035,True)
        self.rail(front,rear-.012,.105,.071)
        self.barrel(.015,front-.035)
        self.tube('barrel locking collar',front-.04,front+.025,L['muzzle'][1],.041)
        self.slab('ejection port lower door',(w/2+.004,.024,.008),(.006,.024,.123),0,.001)
        self.profile('case deflector',[(.076,.022),(.109,.029),(.094,.062),(.078,.061)],.029,0,w/2+.008)
        if s in ('ar','hk416'):
            self.profile('forward assist boss',[(.112,.015),(.147,.016),(.174,.047),(.149,.067)],.027,0,w/2+.01)
            self.pin('assist control',w/2+.025,.04,.151,.013,.013)
            self.tube('buffer interface ring',rear-.01,rear+.055,.025,.036)
        else:
            self.profile('folding interface plate',[(rear-.01,-.045),(rear+.008,-.045),(rear+.008,.092),(rear-.01,.092)],.082)
        self.controls(w)
        self.sights(L['muzzle'][2]+.15 if s=='ar' else a['handguard'][2]-.12,.145,L['aimHeight'],triangular=s=='ar')
        self.group='action'
        self.slab('visible bolt exterior',(w/2-.013,.05,.015),(.018,.024,.104),0,.001)
        self.profile('rear charging handle',[(rear-.058,.075),(rear+.007,.075),(rear+.01,.092),(rear-.056,.092)],.042)
        self.slab('charging handle transverse latch',(0,.085,rear+.005),(.123,.018,.017),0,.001)
        self.group='body'

    def modern(self):
        s=self.shape;L=self.layout;a=L['anchors'];front=a['handguard'][2]+.11;rear=a['stock'][2]-.13
        w={'g36':.096,'scar':.093,'bren':.088,'scorpion':.092}[s];self.width=w
        role=1 if s in ('g36','scorpion') else 0
        outlines={
            'g36':[(front,-.043),(-.077,-.093),(.055,-.075),(.142,-.045),(rear,-.025),(rear,.071),(.16,.098),(front+.025,.079)],
            'scar':[(front,-.023),(.13,-.025),(rear,-.005),(rear,.104),(rear-.021,.121),(front+.016,.121),(front,.091)],
            'bren':[(front,-.035),(.105,-.034),(rear,-.017),(rear,.088),(rear-.033,.111),(front+.008,.104),(front,.072)],
            'scorpion':[(front,-.047),(-.096,-.074),(.049,-.065),(.12,-.041),(rear,-.014),(rear,.091),(rear-.027,.102),(front+.016,.089)]}
        upper=self.profile(s+' authored receiver shell',outlines[s],w,role,.0,.002)
        self.port(upper,-.005,.04,.132,.039)
        self.magwell(a['magazine'][2],-.044,-.136,w,.105,role)
        self.profile('lower receiver and grip bridge',[(front+.029,-.016),(.079,-.02),(.18,-.015),(.196,-.065),(.119,-.087),(.065,-.071),(front+.029,-.085)],w*.88,1)
        self.trigger(.078,-.060,.036,True)
        self.barrel(.015,front)
        if s=='g36':
            self.frame('G36 carrying bridge open silhouette',[(-.18,.099),(.201,.099),(.188,.164),(-.14,.164)],[(-.153,.118),(.166,.118),(.159,.144),(-.124,.144)],.053,1)
            self.sights(-.15,.167,L['aimHeight'])
        else:
            self.rail(front,rear-.01,.128 if s=='scar' else .113,.069)
            self.sights(a['handguard'][2]-.12,.145,L['aimHeight'])
        for side in [-1,1]:
            x=side*(w/2+.003)
            self.profile('receiver recessed strengthening panel',[(front+.041,.003),(.13,.003),(.152,.021),(.14,.028),(front+.041,.028)],.004,role,x)
            for z in [front+.035,.15]:self.pin('body cross screw',x,-.014,z,.009,.006)
        self.controls(w)
        self.action_handle(-.07,.057,-1 if s in ('bren','scar','scorpion') else 1)

    def compact(self):
        s=self.shape;L=self.layout;a=L['anchors'];rear=a['stock'][2]-.12
        if s=='mp5':
            self.width=.077
            self.tube('pressed rounded MP5 receiver',-.175,rear,.028,.04)
            lower=self.profile('MP5 trigger housing',[(-.14,-.008),(.195,-.008),(.18,-.07),(.118,-.091),(.034,-.063),(-.14,-.074)],.072,1)
            self.magwell(a['magazine'][2],-.029,-.14,.073,.088)
            self.trigger(.076,-.055,.034,True)
            self.tube('cocking tube',L['muzzle'][2]+.11,-.12,.069,.016)
            self.barrel(.014,-.13)
            self.sights(L['muzzle'][2]+.095,.137,L['aimHeight'],True)
            # Weld beads remain broad, legible exterior ribs.
            for x in [-.034,.034]:self.slab('pressed receiver lower seam',(x,-.008,.022),(.008,.009,.27),0,.0006)
            self.controls(.068)
            self.action_handle(-.27,.071,-1)
        else:
            self.width=.065
            upper=self.profile('Kedr shallow stamped shell',[(-.143,-.018),(.13,-.018),(.13,.058),(.095,.075),(-.132,.075),(-.151,.047)],.065)
            self.port(upper,-.033,.039,.068,.026)
            self.profile('Kedr upper cover seam',[(-.142,.074),(.128,.074),(.125,.084),(-.131,.088)],.07)
            self.barrel(.014,-.10)
            self.sights(-.123,.09,L['aimHeight'])
            self.trigger(-.023,-.026,.031)
            self.profile('grip seat frame',[(.021,-.016),(.107,-.016),(.119,-.073),(.03,-.076)],.061)
            self.controls(.055,.075)
            self.action_handle(.018,.041,-1)

    def pistol(self):
        s=self.shape;L=self.layout;end=L['muzzle'][2];bore=L['muzzle'][1]
        w={'pm':.065,'tt':.063,'grach':.075,'m9a3':.073,'m17':.078}[s]
        rear={'pm':.105,'tt':.103,'grach':.112,'m9a3':.119,'m17':.111}[s]
        top=L['aimHeight']-.018;bottom=bore-.039;front=end+.009
        poly=1 if s=='m17' else 0;finish=2 if s=='m17' else 0
        self.profile('pistol dust-cover frame',[(front+.012,bottom-.002),(.055,bottom-.002),(rear-.004,bottom+.008),(rear+.005,bottom-.014),(.105,-.067),(.015,-.056),(front+.02,-.043)],w*.92,poly)
        # Grip tang/strap belongs to the frame; separate grip panels are modules.
        self.profile('backstrap frame',[(.075,-.043),(.113,-.05),(.154,-.243),(.135,-.254),(.11,-.224)],w*.64,poly)
        self.profile('front grip strap',[(.016,-.045),(.037,-.055),(.077,-.24),(.06,-.244),(.028,-.18)],w*.66,poly)
        self.trigger(-.042,-.032,w*.49, s in ('grach','m9a3','m17'))
        self.tube('fixed barrel exterior',end+.008,front+.12,bore,.015 if s=='m9a3' else .013)
        self.muzzle(end,bore,.015 if s=='m9a3' else .013)
        self.group='action'
        if s=='m9a3':
            # Open-top slide: two visible rails, bridge at rear and front.
            for side in [-1,1]:
                self.profile('M9 open slide side',[(front,bottom),(.105,bottom),(.119,top-.014),(.11,top),(-.07,top),(-.098,top-.021),(front,top-.022)],.014,finish,side*(w/2-.007))
            self.slab('M9 rear slide bridge',(0,(top+bottom)/2,.072),(w,top-bottom,.082),finish,.002)
            self.slab('M9 nose bridge',(0,bore-.022,front+.017),(w,.028,.035),finish,.002)
            self.slab('M9 front sight bridge',(0,top-.011,front+.017),(w,.022,.035),finish,.001)
        else:
            profile=[(front,bottom),(rear,bottom),(rear+.004,top-.014),(rear-.013,top),(front+.016,top),(front-.001,top-.016)]
            slide=self.profile(s+' chamfered slide',profile,w,finish,0,.002)
            self.port(slide,-.047,bore+.009,.071,.026)
        count=8 if self.lod==0 else 4
        for side in [-1,1]:
            for n in range(count):
                z=rear-.08+n*.007*(1 if self.lod==0 else 2)
                self.profile('rear slide serration',[(z,bottom+.009),(z+.003,bottom+.009),(z+.004,top-.009),(z+.001,top-.009)],.002,0,side*(w/2+.0007),0)
            if s=='m17':
                for n in range(count//2):
                    z=front+.035+n*.009
                    self.profile('front slide serration',[(z,bottom+.008),(z+.003,bottom+.008),(z+.006,top-.008),(z+.003,top-.008)],.002,0,side*(w/2+.0007),0)
        self.slab('pistol front sight blade',(0,top+.009,front+.027),(.008,.018,.012),0,.0005)
        for x in [-.016,.016]:self.slab('pistol rear sight notch',(x,top+.007,rear-.023),(.019,.018,.014),0,.0005)
        if s in ('pm','m9a3'):
            self.pin('slide safety pivot',-w/2-.003,bore+.008,rear-.033,.011,.006)
            self.profile('slide safety lever',[(rear-.034,bore+.005),(rear-.008,bore-.006),(rear-.004,bore+.001),(rear-.031,bore+.014)],.006,0,-w/2-.008)
        self.group='body'
        if s!='m17':
            self.profile('external hammer spur',[(rear-.003,-.04),(rear+.024,bottom+.022),(rear+.031,bottom+.048),(rear+.016,bottom+.054),(rear+.006,bottom+.036)],.024)
        self.profile('slide stop lever',[(.021,-.023),(.079,-.023),(.083,-.012),(.047,-.012),(.037,-.016),(.02,-.016)],.005,0,-w*.46-.001)
        self.pin('frame disassembly pin',-w*.46-.001,-.018,.018,.008,.005)
        if s in ('m17','m9a3','grach'):
            for z in [front+.04,front+.064,front+.088]:self.slab('underbarrel accessory rail',(0,-.045,z),(w*.83,.009,.01),poly,0)

    def traditional(self):
        s=self.shape;L=self.layout;a=L['anchors'];rear=a['stock'][2]-.12
        y=L['muzzle'][1];end=L['muzzle'][2]
        w=.084 if s=='sv98' else .076
        self.width=w
        shell=self.profile('machined receiver side profile',[(-.19,-.025),(.17,-.025),(rear,.0),(rear,.045),(.17,.062),(-.16,.068),(-.19,.043)],w)
        self.port(shell,.015,.039,.145 if s!='svd' else .12,.036)
        self.barrel(.022 if s=='sv98' else .014,-.135)
        self.trigger(.10,-.036,.034)
        self.slab('trigger housing receiver junction',(0,-.029,.105),(.034,.026,.065),0,.001)
        # Replaceable stock modules own the continuous wooden/polymer bedding.
        if s in ('sks','svd','m14'):
            self.tube('gas system exterior',end+.17,-.135,y+.043,.016)
            self.profile('gas block',[ (end+.12,y-.006),(end+.20,y-.006),(end+.22,y+.065),(end+.16,y+.069)],.035)
        if s=='mosin':
            for z in [-.73,-.48]:
                band=K.hollow_tube('fore-stock retaining band',.046,.041,.018,12 if self.lod==0 else 8,'Z')
                band.data.transform(Matrix.Translation((0,-.025,z)))
                self.add(band)
        if s=='sks':
            self.profile('folded bayonet exterior',[(end+.18,-.053),(-.25,-.068),(-.22,-.082),(-.30,-.089)],.013)
            self.tube('bayonet exterior hinge saddle',end+.165,end+.195,y,.024)
            self.profile('folded bayonet hinge support',[(end+.163,y),(end+.199,y),(end+.198,-.062),(end+.18,-.071),(end+.165,-.057)],.021)
        if s=='sv98':self.rail(-.16,.18,.112,.074)
        else:self.sights(end+.07,.11,L['aimHeight'],s in ('mosin','sks'))
        if s=='svd':
            self.magwell(a['magazine'][2],-.025,-.092,.079,.119)
            self.profile('SVD side rail plate',[(.18,-.012),(-.06,-.012),(-.072,.015),(.18,.015)],.009,0,-.045)
        elif s not in ('mosin',):self.magwell(a['magazine'][2],-.020,-.091,.083,.103)
        self.group='action'
        self.tube('visible bolt body',-.043,.135,.046,.026)
        if s in ('mosin','sv98'):
            self.pin('bolt handle transverse stem',.062,.043,.087,.008,.078)
            self.pin('faceted bolt knob',.102,.032,.087,.019,.029)
        else:
            self.pin('charging handle stem',.062,.038,-.004,.007,.080)
            self.profile('charging handle terminal',[(-.024,.029),(.009,.029),(.014,.044),(-.018,.048)],.025,0,.083)
        self.group='body'
        self.controls(w,.142)

    def shotgun(self):
        s=self.shape;L=self.layout;a=L['anchors'];rear=a['stock'][2]-.13;end=L['muzzle'][2];y=L['muzzle'][1]
        w=.093;self.width=w
        outline=[(-.16,-.06),(rear-.021,-.06),(rear,-.04),(rear,.021),(rear-.04,.065),(-.13,.065),(-.16,.039)]
        rec=self.profile(s+' sloped receiver',outline,w,0,0,.003)
        self.port(rec,-.003,.018,.13,.043)
        self.barrel(.021,-.14)
        tube_end=end+(.04 if s=='benelli' else .18)
        self.tube('fixed magazine tube exterior',tube_end,-.13,y-.068,.023)
        self.tube('magazine tube front cap',tube_end-.012,tube_end+.015,y-.068,.026)
        self.trigger(.105,-.053,.037)
        if s=='benelli':
            self.rail(-.10,.18,.086,.065)
            self.sights(end+.08,.135,L['aimHeight'],True)
            for x in [-.029,.029]:self.tube('external twin operating housing',-.55,-.24,y-.035,.008,x=x)
        else:
            self.slab('vent rib spine',(0,y+.027,(end-.13)/2),(.012,.009,abs(end+.13)))
            for n in range(6):self.slab('vent rib post',(0,y+.021,end+.05+n*(abs(end)-.22)/6),(.012,.014,.012),0,0)
            self.slab('front bead',(0,L['aimHeight'],end+.034),(.008,.009,.009),0,.001)
            self.slab('front bead rib seat',(0,(y+.027+L['aimHeight'])/2,end+.034),(.006,L['aimHeight']-y-.027,.008),0,0)
        self.group='action'
        self.slab('shotgun visible bolt face',(.037,.02,-.009),(.016,.029,.112),0,.002)
        if s in ('mp153','benelli'):
            self.pin('bolt charging handle',.059,.021,-.005,.009,.046)
        self.group='body'
        self.controls(w,.14)

    def val(self):
        L=self.layout;rear=L['anchors']['stock'][2]-.13;end=L['muzzle'][2];y=L['muzzle'][1]
        rec=self.profile('compact VAL receiver',[(-.12,-.056),(rear,-.056),(rear,.051),(rear-.024,.079),(-.103,.079),(-.12,.047)],.079)
        self.port(rec,-.012,.035,.10,.031)
        self.tube('rounded receiver top cover',-.104,rear-.023,.048,.035)
        self.tube('integral suppressor receiver neck',-.21,-.09,y,.021)
        self.tube('integral suppressor outer body',end+.016,-.19,y,.045,.045)
        self.tube('integral suppressor rear shoulder',-.26,-.17,y,.048,.032)
        self.muzzle(end,y,.044)
        self.tube('integral suppressor end ring',end+.008,end+.027,y,.047)
        self.sights(end+.071,.13,L['aimHeight'])
        self.trigger(.076,-.053,.033)
        self.magwell(L['anchors']['magazine'][2],-.04,-.095,.077,.103)
        self.profile('side optic dovetail exterior',[(-.05,-.007),(.18,-.007),(.18,.02),(-.05,.02)],.009,0,-.045)
        self.controls(.079)
        self.action_handle(-.006,.045)

    def aug(self):
        L=self.layout;end=L['muzzle'][2]
        # Upper mechanism cover and trigger housing join the separate stock shell.
        shell=self.profile('AUG monolithic forward polymer housing',[(-.20,-.035),(-.13,-.064),(.27,-.064),(.275,.047),(.19,.071),(-.14,.082),(-.20,.053)],.092,1,0,.003)
        self.port(shell,.16,.037,.088,.034)
        self.profile('AUG forward neck',[(-.196,-.04),(-.11,-.048),(-.09,-.10),(-.124,-.14),(-.163,-.115)],.066,1)
        self.frame('AUG large trigger loop',[(-.15,-.053),(.023,-.053),(.083,-.22),(-.066,-.245)],[(-.12,-.079),(.004,-.079),(.052,-.195),(-.05,-.213)],.042,1)
        self.profile('AUG integral pistol grip',[(-.008,-.064),(.047,-.071),(.081,-.217),(.049,-.239),(.017,-.213)],.065,1)
        self.profile('AUG trigger blade',[(-.044,-.07),(-.03,-.073),(-.038,-.112),(-.054,-.13),(-.059,-.123)],.012)
        self.magwell(.225,-.052,-.106,.083,.11,1)
        self.barrel(.016,-.16)
        self.profile('AUG A3 raised rail receiver',[(-.25,.081),(.118,.081),(.13,.123),(.103,.137),(-.21,.137),(-.25,.116)],.058)
        self.rail(-.25,.12,.145,.065)
        self.sights(-.20,.09,L['aimHeight'])
        self.pin('AUG barrel release control',-.055,.025,-.176,.012,.015)
        self.action_handle(-.13,.065,-1)

    def build(self):
        s=self.shape
        if s in ('aksu','ak103','ak12','rpk74','vityaz','saiga'):self.ak()
        elif s in ('ar','hk416','mcx','mpx'):self.ar()
        elif s in ('g36','scar','bren','scorpion'):self.modern()
        elif s in ('kedr','mp5'):self.compact()
        elif s in ('pm','tt','grach','m9a3','m17'):self.pistol()
        elif s in ('sks','mosin','svd','sv98','m14'):self.traditional()
        elif s in ('shotgun','mp153','rem870','benelli'):self.shotgun()
        elif s in ('asval','vss'):self.val()
        elif s=='aug':self.aug()
        else:raise ValueError('Unimplemented platform '+s)
        for obj in self.parts:
            role=int(obj['surfaceTile']);uv=obj.data.uv_layers.active
            # Per-face physical projection; retain a positive UV area for every
            # triangle. Each face fits inside one padded original atlas tile.
            for face in obj.data.polygons:
                points=[uv.data[i].uv.copy() for i in face.loop_indices]
                mn=[min(p[k] for p in points) for k in range(2)]
                mx=[max(p[k] for p in points) for k in range(2)]
                span=max(mx[0]-mn[0],mx[1]-mn[1],.35)
                for i,p in zip(face.loop_indices,points):
                    uv.data[i].uv=((role%2)*.5+.012+(p.x-mn[0])/span*.476,(role//2)*.5+.012+(p.y-mn[1])/span*.476)
            obj.data.transform(K.GAME_TO_BLENDER)
        return self.parts


def merge_groups(objects):
    """Two objects per LOD, one atlas material: predictable renderer batching."""
    out=[]
    grouped={(lod,group):[x for x in objects if x['lod']==lod and x['assetKey']==group] for lod in (0,1) for group in ('body','action')}
    for lod in (0,1):
        for group in ('body','action'):
            members=grouped[(lod,group)]
            for obj in bpy.context.selected_objects:obj.select_set(False)
            for obj in members:obj.select_set(True)
            bpy.context.view_layer.objects.active=members[0]
            bpy.ops.object.join()
            obj=bpy.context.object;obj.name=group+'_LOD'+str(lod);obj['lod']=lod;obj['assetKey']=group
            out.append(obj)
    return out


def render_views(objects,record):
    scene=bpy.context.scene
    for obj in objects:obj.hide_render=obj['lod']==1
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1120;scene.render.resolution_y=700;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Weapon review neutral world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.19,.22,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    scene.view_settings.view_transform='AgX'
    camera=bpy.data.objects.new('QA camera',bpy.data.cameras.new('QA camera'));scene.collection.objects.link(camera);scene.camera=camera
    camera.data.type='ORTHO';camera.data.lens=45
    vertices=[obj.matrix_world@v.co for obj in objects if obj['lod']==0 for v in obj.data.vertices]
    lo=Vector([min(v[k] for v in vertices) for k in range(3)]);hi=Vector([max(v[k] for v in vertices) for k in range(3)]);center=(lo+hi)/2
    length=max(hi.y-lo.y,.4)
    camera.data.ortho_scale=max(length*1.35,(hi.z-lo.z)*2.1)
    for i,(loc,power,size) in enumerate([((2,-1,3),130,3),((-2,1,2),100,2),((0,3,3),180,2)]):
        light=bpy.data.objects.new('QA softbox '+str(i),bpy.data.lights.new('QA softbox '+str(i),'AREA'));scene.collection.objects.link(light);light.location=loc;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    folder=SOURCE/'renders';folder.mkdir(exist_ok=True)
    views={'oblique':Vector((2.5,-1.8,1.2)),'right':Vector((3,0,.12)),'left':Vector((-3,0,.12)),'top':Vector((.01,0,3))}
    for name,offset in views.items():
        camera.location=center+offset;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(folder/(record['id']+'-'+name+'.png'))
        bpy.ops.render.render(write_still=True)
    for obj in objects:obj.hide_render=False


def make_manifest():
    reports=[]
    for record in DATA:
        path=SOURCE/(record['id']+'-audit.json')
        if path.exists():reports.append((record,json.loads(path.read_text())))
    text="import type { ModelAssetDefinition } from './model-asset-types.js';\n\n// Generated by tools/art/build_weapon_overhaul.py; audited metre-frame bounds.\nexport const WEAPON_ASSET_DEFINITIONS: Record<string, ModelAssetDefinition> = {\n"
    for record,report in reports:
        if report['status']!='PASSED':raise ValueError('Cannot register failed asset '+record['id'])
        digest=hashlib.sha256((RUNTIME/(record['id']+'.glb')).read_bytes()).hexdigest()[:12]
        definition={'url':'/assets/art-overhaul/weapons/'+record['id']+'.glb?v='+digest,'groups':['body','action'],'frame':'meters','groupBounds':report['groupBounds']}
        text+='    '+record['id']+': '+json.dumps(definition,separators=(',',':'))+',\n'
    text+='};\n';(ROOT/'src/content/overhaul-weapon-assets.ts').write_text(text)
    return len(reports)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--ids',nargs='*');parser.add_argument('--no-render',action='store_true');parser.add_argument('--manifest-only',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.manifest_only:make_manifest();return
    audit=json.loads((ROOT/'art/overhaul/reference-audit.json').read_text())
    if audit.get('modelingGate')!='OPEN':raise RuntimeError('Reference gate is not OPEN')
    SOURCE.mkdir(parents=True,exist_ok=True);RUNTIME.mkdir(parents=True,exist_ok=True)
    selected=[r for r in DATA if not args.ids or r['id'] in args.ids]
    for record in selected:
        if record['id'] in PROTECTED:raise ValueError('Protected platform')
        # A new dedicated scene; never save or mutate the input starter scene.
        scene=bpy.data.scenes.new(record['id']);bpy.context.window.scene=scene
        scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
        mat=create_atlas()
        parts=[]
        for lod in (0,1):parts.extend(Shell(record,lod,mat).build())
        objects=merge_groups(parts)
        glb=RUNTIME/(record['id']+'.glb');blend=SOURCE/(record['id']+'.blend')
        K.export_asset(objects,glb,blend)
        report=audit_asset(glb,SOURCE/(record['id']+'-audit.json'),SOURCE/'roundtrip'/(record['id']+'.glb'))
        if report['status']!='PASSED':raise RuntimeError(record['id']+': '+str(report['errors']))
        if not args.no_render:render_views(objects,record)
        print('WEAPON_COMPLETE '+record['id']+' '+str(glb.stat().st_size)+' bytes',flush=True)
        bpy.context.window.scene=bpy.data.scenes[0]
        bpy.data.scenes.remove(scene)
        bpy.data.orphans_purge(do_recursive=True)
        make_manifest()

if __name__=='__main__':main()
