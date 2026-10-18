#!/usr/bin/env python3
"""Original, deterministic toroidal fabric art. No reference pixels are loaded.

Run with bundled Python (Pillow+numpy). Registry publication is opt-in and atomic.
Pattern shares are calibrated on independently composed family-specific score
fields; printed color is separate from the physically scaled shared weave.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art/overhaul/camouflage_sources'
OUT = ROOT / 'public/assets/art-overhaul/fabrics'
N = 1024
MM = 450.0
PX = N / MM
TILE_METERS = .45
VERSION = 1
NAMES = {
    "atacs_au": "A-TACS AU · интерпретация",
    "atacs_fg": "A-TACS FG · интерпретация",
    "atacs_ix": "A-TACS iX · интерпретация",
    "amcu": "AMCU · интерпретация",
    "bme": "BME · интерпретация",
    "cadpat_mt": "CADPAT MT · интерпретация",
    "cadpat_tw": "CADPAT TW · интерпретация",
    "flecktarn": "Flecktarn · интерпретация",
    "jsdf_type_ii": "JSDF Type II · интерпретация",
    "m05_snow": "M05 Snow · интерпретация",
    "m05_winter": "M05 Winter · интерпретация",
    "m05_woodland": "M05 Woodland · интерпретация",
    "m90": "M90 · интерпретация",
    "m90k": "M90K · интерпретация",
    "marpat_desert": "MARPAT Desert · интерпретация",
    "marpat_woodland": "MARPAT Woodland · интерпретация",
    "mm14": "MM-14 · интерпретация",
    "multicam_alpine": "MultiCam Alpine · интерпретация",
    "multicam_arid": "MultiCam Arid · интерпретация",
    "multicam_black": "MultiCam Black · интерпретация",
    "nfp_green": "NFP Green · интерпретация",
    "ocp": "OCP · интерпретация",
    "pixelado_boscoso": "Pixelado Boscoso · интерпретация",
    "singapore_digital": "Singapore Digital · интерпретация",
    "tropentarn": "Tropentarn · интерпретация",
    "uk_mtp": "UK MTP · интерпретация",
    "vegetato": "Vegetato · интерпретация",
    "vegetato_desert": "Vegetato Desert · интерпретация",
    "woodlatpat": "WoodLatPat · интерпретация"
}
FAMILY_TEXT = {
'organic':'Нерегулярные острова и мелкие разрывы', 'digital':'Ступенчатые кластеры разных размеров',
'micro-mosaic':'Мелкие пятна на широких цветовых полях', 'stripe':'Изогнутые прерывистые полосы',
'leaf':'Угловатые листья и ветви', 'splinter':'Разнонаправленные угловатые фрагменты',
'blurred':'Мягкие облака с небольшими контрастными островками',
'snow':'Светлое поле с серыми ветвями и островками', 'arid':'Песочные и охристые острова',
'tropical':'Плотная зелёная листва с тёмными разрывами', 'solid':'Однотонная матовая ткань',
}

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def seed_for(text): return int.from_bytes(hashlib.sha256(text.encode()).digest()[:8], 'little')
def rgb(s): return tuple(bytes.fromhex(s.lstrip('#')))
def write_json(path, value): path.write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')
def atomic_write(path, text):
    tmp=path.with_suffix(path.suffix+'.tmp'); tmp.write_text(text); os.replace(tmp,path)

def periodic_blur(a, radius):
    if radius <= 0: return a.copy()
    pad = max(4, int(math.ceil(radius*4)))
    im=Image.fromarray(np.pad(a, ((pad,pad),(pad,pad)), mode='wrap').astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(radius)))[pad:-pad,pad:-pad].astype(np.float32)

def mip(im, size):
    # Repeated neighbours participate in the downsampling filter, including corners.
    big=Image.new(im.mode,(N*3,N*3))
    for x in range(3):
        for y in range(3): big.paste(im,(x*N,y*N))
    return big.resize((size*3,size*3),Image.Resampling.LANCZOS).crop((size,size,2*size,2*size))

def wrapped_polygon(draw, points, value):
    xs,ys=zip(*points)
    for dx in (-N,0,N):
        for dy in (-N,0,N):
            if max(xs)+dx < 0 or min(xs)+dx >= N or max(ys)+dy < 0 or min(ys)+dy >= N: continue
            draw.polygon([(x+dx,y+dy) for x,y in points],fill=int(value))

def centers(rng, count, min_dist):
    # Best-candidate blue-noise placement on a torus prevents obvious stamp rows.
    result=[]
    for _ in range(count):
        candidates=rng.random((7,2))*N
        if result:
            delta=np.abs(candidates[:,None,:]-np.array(result)[None,:,:]); delta=np.minimum(delta,N-delta)
            dist=np.min(np.sum(delta*delta,axis=2),axis=1)
            choice=np.argmax(dist)
            result.append(candidates[choice])
        else: result.append(candidates[0])
    return result

def cloud(rng, size=N, low=2, high=7, terms=16):
    y,x=np.mgrid[:size,:size].astype(np.float32); x*=2*np.pi/size; y*=2*np.pi/size
    a=np.zeros((size,size),np.float32)
    for _ in range(terms):
        fx=int(rng.integers(low,high+1)); fy=int(rng.integers(-high,high+1))
        a+=rng.uniform(.4,1)*np.sin(x*fx+y*fy+rng.uniform(0,2*np.pi))
    return (a-a.mean())/max(float(a.std()),1e-5)

def organic_field(rng, lo, hi, style='organic'):
    im=Image.new('L',(N,N),35); draw=ImageDraw.Draw(im)
    typical=(lo+hi)*.5*PX
    count=max(22,min(650,int(N*N/(typical*typical)*1.8)))
    for i,(cx,cy) in enumerate(centers(rng,count,typical*.35)):
        size=rng.uniform(lo,hi)*PX
        if i%4==0: size*=.43
        ang=rng.uniform(0,2*np.pi); aspect=rng.uniform(.5,1.4)
        phases=rng.uniform(0,2*np.pi,3); pts=[]
        for t in np.linspace(0,2*np.pi,32,endpoint=False):
            rad=.5*size*(1+.22*np.sin(t*3+phases[0])+.14*np.sin(t*5+phases[1])+.08*np.sin(t*8+phases[2]))
            u=math.cos(t)*rad; v=math.sin(t)*rad*aspect
            pts.append((cx+u*math.cos(ang)-v*math.sin(ang),cy+u*math.sin(ang)+v*math.cos(ang)))
        wrapped_polygon(draw,pts,rng.integers(85,256))
    a=np.asarray(im,dtype=np.float32)
    # Integer-frequency toroidal displacement breaks the stamped outlines.
    y,x=np.mgrid[:N,:N]
    wx=cloud(rng,low=1,high=3,terms=5)*max(2,typical*.045)
    wy=cloud(rng,low=1,high=3,terms=5)*max(2,typical*.045)
    a=a[(y+wy).astype(int)%N,(x+wx).astype(int)%N]
    radius={'organic':1.8,'arid':2.6,'tropical':1.1,'blurred':8.0}.get(style,2)
    a=periodic_blur(a,radius)
    return a+cloud(rng,low=2,high=6)*18+cloud(rng,low=10,high=20,terms=8)*4

def digital_field(rng, lo, hi):
    # Whole-cell decisions; broad masses are perturbed by local omissions/runs.
    cells=int(np.clip(round(MM/max(lo,3)),48,128))
    macro=cloud(rng,size=cells,low=2,high=6)
    meso=cloud(rng,size=cells,low=8,high=16)
    a=macro*.75+meso*.38+rng.normal(0,.19,(cells,cells))
    for _ in range(cells*2):
        x,y=rng.integers(0,cells,2); run=int(rng.integers(2,5))
        a[y,(x+np.arange(run))%cells]+=rng.uniform(-.9,.9)
    ix=(np.arange(N)*cells//N).astype(int)
    return a[ix[:,None],ix[None,:]]*45+120

def stripe_field(rng, lo, hi):
    im=Image.new('L',(N,N),24); draw=ImageDraw.Draw(im)
    for cx,cy in centers(rng,48,60):
        length=rng.uniform(hi*1.3,hi*3)*PX; width=rng.uniform(lo,hi*.55)*PX
        angle=rng.normal(0,.24); phase=rng.uniform(0,6.28)
        ts=np.linspace(-1,1,28); upper=[]; lower=[]
        for t in ts:
            spine=.23*width*math.sin(t*3+phase)+.14*width*math.sin(t*7-phase)
            half=width*.5*(1-t*t)**.6*(.72+.28*math.sin(t*5+phase)**2)
            for out,side in ((upper,1),(lower,-1)):
                u=t*length/2; v=spine+side*half
                out.append((cx+u*math.cos(angle)-v*math.sin(angle),cy+u*math.sin(angle)+v*math.cos(angle)))
        wrapped_polygon(draw,upper+lower[::-1],rng.integers(80,255))
    return periodic_blur(np.asarray(im),1.1)+cloud(rng,low=2,high=4)*12

def leaf_field(rng,lo,hi,snow=False):
    im=Image.new('L',(N,N),20); draw=ImageDraw.Draw(im)
    count=max(30,int(13000/(lo+hi))) if not snow else 27
    for cx,cy in centers(rng,count,50):
        length=rng.uniform(lo,hi)*PX*1.4; angle=rng.uniform(0,6.28)
        ex,ey=math.cos(angle),math.sin(angle); nx,ny=-ey,ex
        width=length*.045
        pts=[(cx+ex*u+nx*v,cy+ey*u+ny*v) for u,v in ((-length*.5,-width), (length*.5,0),(-length*.45,width))]
        value=rng.integers(100,240); wrapped_polygon(draw,pts,value)
        for side in (-1,1):
            for j in range(int(rng.integers(2,5))):
                u=rng.uniform(-.4,.3)*length; leaf=rng.uniform(.16,.39)*length
                coords=[(u,0),(u+leaf*.15,side*leaf*.25),(u+leaf*.8,side*leaf),(u+leaf*.65,side*leaf*.2),(u+leaf*.7,0)]
                pts=[(cx+ex*a+nx*b,cy+ey*a+ny*b) for a,b in coords]
                wrapped_polygon(draw,pts,value+rng.integers(-15,16))
    return periodic_blur(np.asarray(im),1.4 if snow else .7)+cloud(rng,low=2,high=6)*11

def splinter_field(rng,lo,hi):
    im=Image.new('L',(N,N),20); draw=ImageDraw.Draw(im)
    count=int(N*N/(((lo+hi)/2*PX)**2)*2)
    for cx,cy in centers(rng,count,40):
        r=rng.uniform(lo,hi)*PX*.65; angle=rng.uniform(0,6.28)
        local=[(-r,-r*.3),(-r*.15,-r*.55),(r*.8,-r*.12),(r*.25,r*.17),(r*.6,r*.45),(-r*.4,r*.25)]
        pts=[(cx+x*math.cos(angle)-y*math.sin(angle),cy+x*math.sin(angle)+y*math.cos(angle)) for x,y in local]
        wrapped_polygon(draw,pts,rng.integers(65,256))
    return np.asarray(im,dtype=np.float32)+cloud(rng,low=2,high=5)*7

def mosaic_field(rng,lo,hi,round_flecks=False):
    im=Image.new('L',(N,N),30); draw=ImageDraw.Draw(im)
    count=int(np.clip(N*N/(((lo+hi)*.5*PX)**2)*1.8,700,4800))
    broad=cloud(rng,low=2,high=7)
    for _ in range(count):
        cx,cy=rng.uniform(0,N,2); r=rng.uniform(lo,hi)*PX*.5
        k=12 if round_flecks else int(rng.integers(4,7))
        a=rng.uniform(0,6.28); pts=[]
        for t in np.linspace(0,6.28,k,endpoint=False):
            radius=r*rng.uniform(.65,1.1)
            pts.append((cx+math.cos(t+a)*radius,cy+math.sin(t+a)*radius*.75))
        val=np.clip(120+broad[int(cy),int(cx)]*34+rng.uniform(-55,55),40,255)
        wrapped_polygon(draw,pts,val)
    return periodic_blur(np.asarray(im),.65 if round_flecks else .3)+broad*28

def field(rng,recipe):
    f=recipe['family']; lo,hi=recipe['spotMm']
    if f=='digital': return digital_field(rng,lo,hi)
    if f=='stripe': return stripe_field(rng,lo,hi)
    if f=='leaf': return leaf_field(rng,lo,hi)
    if f=='splinter' or recipe['id']=='m90k': return splinter_field(rng,lo,hi)
    if f=='micro-mosaic': return mosaic_field(rng,lo,hi,recipe['id']=='flecktarn')
    if f=='snow': return leaf_field(rng,lo,hi,True)*.65+organic_field(rng,lo,hi)*.35
    return organic_field(rng,lo,hi,f)

def make_print(recipe):
    rng=np.random.default_rng(seed_for(recipe['id']))
    labels=np.zeros((N,N),np.uint8); available=np.ones((N,N),bool)
    if recipe['family']=='solid': return labels
    # Each foreground color uses independently drawn shapes. Quantile thresholds
    # calibrate visible printed area without converting color bands into contours.
    for index in range(len(recipe['palette'])-1,0,-1):
        a=field(rng,recipe)
        count=round(N*N*recipe['sharePct'][index]/100)
        values=a[available]; threshold=np.partition(values,values.size-count)[values.size-count]
        mask=available & (a>threshold)
        # Digital plateaus must remain complete cells. Equal-value runs can cause
        # sub-percent share differences and are reported rather than pixel-noised.
        if abs(int(mask.sum())-count) > N*N*.012: mask=available & (a>=threshold)
        labels[mask]=index; available[mask]=False
    return labels

def weave():
    y,x=np.mgrid[:N,:N].astype(np.float32)/N
    # Diagonal yarns resolve at native scale in 2D (400 cycles per axis),
    # 450/sqrt(400^2+400^2)=0.7955 mm perpendicular line spacing.
    twill=np.sin(2*np.pi*400*(x+y))*.7+np.sin(2*np.pi*400*(x-y))*.35
    ripstop=(np.cos(2*np.pi*72*x)**16+np.cos(2*np.pi*72*y)**16)*.18
    height=twill+ripstop
    tone=height*1.35
    dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*.012
    dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*.012
    normal=np.stack((-dx,-dy,np.ones_like(dx)),axis=2)
    normal/=np.linalg.norm(normal,axis=2,keepdims=True)
    return tone,np.round((normal*.5+.5)*255).astype(np.uint8)

def seam_metrics(arr):
    a=arr.astype(np.float32)
    if a.ndim==2: a=a[:,:,None]
    result={}
    for axis,key in ((0,'v'),(1,'u')):
        d=np.abs(np.roll(a,-1,axis=axis)-a).mean(axis=2)
        line=d[-1,:] if axis==0 else d[:,-1]
        internal=d.mean(axis=1-axis)
        p95=float(np.percentile(internal,95))
        # Printed edges may naturally cross the join. Compare statistics with
        # interior cuts rather than wrongly forcing identical opposing texels.
        result[key]={'joinMean':round(float(line.mean()),4),'interiorCutP95':round(p95,4),
                     'pass':bool(float(line.mean())<=max(2.5,p95*1.75))}
    return result

def application_preview(im,recipe):
    # Metric flat-pattern proof, explicitly not a runtime/pose screenshot.
    canvas=Image.new('RGB',(1180,810),'#252a2b'); d=ImageDraw.Draw(canvas)
    d.text((20,12),recipe['id']+' | METRIC PANEL STUDY | 0.45 m tile',fill='white')
    scale=750 # display pixels per metre; every panel uses this same value
    panels=[('torso',.44,.59,22,60),('sleeve',.18,.59,385,60),('thigh / shin',.22,.90,560,60),
            ('pocket flap',.16,.09,785,60),('cuff',.20,.07,785,175),('elbow / fold',.22,.25,785,280),('knee',.22,.20,785,520)]
    tex=np.asarray(im); specs=[]
    for name,w,h,cx,cy in panels:
        W,H=round(w*scale),round(h*scale); rng=np.random.default_rng(seed_for(recipe['id']+name))
        ox,oy=rng.integers(0,N,2); y,x=np.mgrid[:H,:W]
        # Offset each island but preserve exactly the same metres/UV scale.
        u=(x/scale/TILE_METERS*N+ox).astype(int)%N
        v=(y/scale/TILE_METERS*N+oy).astype(int)%N
        patch=tex[v,u].astype(np.float32)
        if 'fold' in name or name=='knee':
            light=.87+.11*np.cos(x/W*math.pi*5)
            patch*=light[:,:,None]
        canvas.paste(Image.fromarray(np.clip(patch,0,255).astype(np.uint8)),(cx,cy))
        d.text((cx,cy+H+6),f'{name}: {w:.2f} x {h:.2f} m',fill='#d5d9d7')
        specs.append({'panel':name,'meters':[w,h],'uvSize':[w/TILE_METERS,h/TILE_METERS],'offsetTexels':[int(ox),int(oy)],'texelsPerMeter':N/TILE_METERS})
    d.text((20,760),'Flat panel scale proof only. Garment UVs / poses / runtime filtering require integration QA.',fill='#d5d9d7')
    canvas.save(SRC/'applications'/f'{recipe["id"]}.png')
    return specs

def contact_sheets(recipes):
    for start in range(0,len(recipes),12):
        batch=recipes[start:start+12]; sheet=Image.new('RGB',(4*286,3*310+42),'#252a2b'); d=ImageDraw.Draw(sheet)
        d.text((16,12),'ORIGINAL FABRIC TILES | 450 mm square | 1024 source / 512 mip | ART QA',fill='white')
        for i,r in enumerate(batch):
            x=(i%4)*286+12;y=(i//4)*310+42
            tile=Image.open(SRC/'previews'/f'{r["id"]}.png').resize((262,262),Image.Resampling.LANCZOS)
            sheet.paste(tile,(x,y));d.text((x,y+268),r['id']+' / '+r['family'],fill='white')
        sheet.save(SRC/f'contact-{start//12+1}.png')
    families=['solid','digital','stripe','leaf','organic','micro-mosaic','splinter','blurred','snow','arid','tropical']
    picks=[next(r for r in recipes if r['family']==f) for f in families]
    sheet=Image.new('RGB',(4*286,3*320),'#252a2b');d=ImageDraw.Draw(sheet)
    for i,r in enumerate(picks):
        x=i%4*286+12;y=i//4*320+12
        tile=Image.open(OUT/f'camo-{r["id"]}.png'); small=mip(tile,128)
        repeated=Image.new('RGB',(256,256))
        for dx in (0,128):
            for dy in (0,128):repeated.paste(small,(dx,dy))
        sheet.paste(repeated,(x,y));d.text((x,y+265),r['id']+' | 2 x 2 repeat',fill='white')
    sheet.save(SRC/'family-repeat-review.png')

def make_definitions(recipes):
    defs=[]
    fallback={'organic':'woodland','micro-mosaic':'woodland','splinter':'woodland','blurred':'woodland','tropical':'woodland'}
    for r in recipes:
        if r['current']: continue
        desc=FAMILY_TEXT[r['family']]+'. Оригинальная игровая расцветка; название не означает штатную выдачу.'
        defs.append('    { id: '+json.dumps(r['id'])+', name: '+json.dumps(NAMES[r['id']],ensure_ascii=False)+', pattern: '+json.dumps(fallback.get(r['family'],r['family']))+', colors: '+json.dumps([p[0] for p in r['palette']])+'.map(rgb), description: '+json.dumps(desc,ensure_ascii=False)+' }')
    text="// Generated original game fabrics; stable IDs preserve research correspondence.\nimport type { Camouflage } from './apparel.js';\nimport { rgb } from '../domain/util.js';\n\nexport const OVERHAUL_CAMOUFLAGES: Camouflage[] = [\n"+',\n'.join(defs)+'\n];\n'
    text+='\n// Existing 20 palette entries already match the approved recipes exactly.\nexport const OVERHAUL_CAMOUFLAGE_PALETTE_UPDATES: Record<string, Camouflage[\'colors\']> = {};\n'
    return text

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--publish',action='store_true'); args=ap.parse_args()
    assert json.loads((ROOT/'art/overhaul/reference-audit.json').read_text())['modelingGate']=='OPEN'
    recipes=json.loads((ROOT/'art/overhaul/production/camouflage-recipes.json').read_text())['recipes']
    assert len(recipes)==49 and sum(r['current'] for r in recipes)==20
    assert sum(r['family']=='solid' for r in recipes)==8
    for r in recipes:
        assert sum(r['sharePct'])==100 and [p[1] for p in r['palette']]==r['sharePct']
        assert (r['spotMm'] is None)==(r['family']=='solid')
    for p in (SRC,OUT,SRC/'previews',SRC/'applications',SRC/'labels'):p.mkdir(parents=True,exist_ok=True)
    tone,normal=weave(); Image.fromarray(normal).save(OUT/'fabric-normal.png')
    records=[]; registry={}; masks=[]; errors=[]
    for r in recipes:
        labels=make_print(r); palette=np.array([rgb(p[0]) for p in r['palette']],np.float32)
        color=palette[labels]
        if r['family'] in ('blurred','snow','arid'):
            radius={'blurred':1.5,'snow':.7,'arid':.65}[r['family']]
            color=np.stack([periodic_blur(color[:,:,c],radius) for c in range(3)],axis=2)
        arr=np.clip(np.round(color+tone[:,:,None]),0,255).astype(np.uint8)
        im=Image.fromarray(arr); path=OUT/f'camo-{r["id"]}.png'; im.save(path,optimize=True)
        preview=mip(im,512);preview.save(SRC/'previews'/f'{r["id"]}.png',optimize=True)
        label_im=Image.fromarray(labels);label_im.save(SRC/'labels'/f'{r["id"]}.png')
        areas=[round(float((labels==i).mean()*100),3) for i in range(len(palette))]
        nearest=np.argmin(np.sum((arr[:,:,None,:].astype(np.float32)-palette[None,None,:,:])**2,axis=3),axis=2)
        rendered_areas=[round(float((nearest==i).mean()*100),3) for i in range(len(palette))]
        area_error=max(abs(a-b) for a,b in zip(rendered_areas,r['sharePct']))
        seams={'native':seam_metrics(arr),'mip512':seam_metrics(np.asarray(preview))}
        # Filter phase invariance: shifting a periodic tile before a 2x mip must
        # produce the same pixels as shifting the mip afterwards, including join.
        shift=np.roll(np.roll(arr,256,axis=0),256,axis=1)
        filtered_shift=np.asarray(mip(Image.fromarray(shift),512))
        expected=np.roll(np.roll(np.asarray(preview),128,axis=0),128,axis=1)
        phase_error=int(np.max(np.abs(filtered_shift.astype(int)-expected.astype(int))))
        issues=[]
        if area_error>2:issues.append('printed color area > 2 percentage points from recipe')
        if not all(v['pass'] for m in seams.values() for v in m.values()):issues.append('edge jump exceeds interior-cut range')
        if phase_error>1:issues.append('periodic mip phase mismatch')
        if r['family']=='solid' and np.std(arr.astype(float)-palette[0])>2:issues.append('solid excessive variation')
        if issues:errors.append({'id':r['id'],'errors':issues})
        digest=sha(path); registry[r['id']]=f'/assets/art-overhaul/fabrics/{path.name}?v={digest[:12]}'
        specs=application_preview(im,r)
        rec={'id':r['id'],'family':r['family'],'seed':seed_for(r['id']),'sha256':digest,'bytes':path.stat().st_size,
             'tileMeters':TILE_METERS,'resolution':[N,N],'preview':[512,512],'spotMm':r['spotMm'],
             'palette':r['palette'],'authoredAreaPct':areas,'renderedNearestPaletteAreaPct':rendered_areas,
             'areaMaxErrorPercentagePoints':round(area_error,4),'seams':seams,'mipPhaseMaxError':phase_error,
             'panels':specs,'status':'FAILED' if issues else 'PASSED','errors':issues}
        records.append(rec); masks.append((r['id'],np.asarray(label_im.resize((64,64),Image.Resampling.NEAREST))))
        print(r['id'],r['family'],rec['status'],f'areaError={area_error:.3f}',flush=True)
    # Detect identical pattern topology independently of palette differences.
    duplicate=[]
    for i,(aid,a) in enumerate(masks):
        if recipes[i]['family']=='solid':continue
        for j in range(i):
            if recipes[j]['family']=='solid':continue
            bid,b=masks[j]
            if np.array_equal(a,b):duplicate.append([aid,bid])
    if duplicate:errors.append({'duplicateTopology':duplicate})
    registry_text='// Original project fabric textures. Generated by tools/art/build_camouflage_overhaul.py.\nexport const FABRIC_ASSETS: Record<string, string> = '+json.dumps(registry,indent=2)+';\n'
    registry_text+=f'export const FABRIC_NORMAL = "/assets/art-overhaul/fabrics/fabric-normal.png?v={sha(OUT/"fabric-normal.png")[:12]}";\n'
    registry_text+='export const FABRIC_TILE_METERS = 0.45;\n'
    (SRC/'fabric-assets.staged.ts').write_text(registry_text)
    (SRC/'overhaul-camouflages.staged.ts').write_text(make_definitions(recipes))
    contact_sheets(recipes)
    report={'schemaVersion':VERSION,'status':'FAILED' if errors else 'PASSED','scope':'texture production + offline metric panel QA; runtime acceptance NOT RUN',
            'provenance':'Original deterministic artwork; recipes only; no source photo pixels or traced print topology.',
            'count':49,'newDefinitions':29,'solidCount':8,'patternCount':41,'tileMeters':TILE_METERS,
            'yarnSpacingMm':MM/math.sqrt(400**2+400**2),'weaveAmplitudeMaxSrgb':round(float(np.abs(tone).max()),3),
            'normalSeams':seam_metrics(normal),'uniquePixelHashes':len(set(r['sha256'] for r in records)),
            'duplicateTopology':duplicate,'runtimeBytes':sum(r['bytes'] for r in records)+(OUT/'fabric-normal.png').stat().st_size,
            'errors':errors,'recipesSha256':sha(ROOT/'art/overhaul/production/camouflage-recipes.json'),'records':records}
    write_json(SRC/'production-report.json',report)
    if errors:raise SystemExit('Production QA FAILED: '+json.dumps(errors))
    if args.publish:
        atomic_write(ROOT/'src/content/overhaul-camouflages.ts',make_definitions(recipes))
        atomic_write(ROOT/'src/content/fabric-assets.ts',registry_text)
    print('PASSED:49, publication='+str(args.publish),flush=True)

if __name__=='__main__':main()
