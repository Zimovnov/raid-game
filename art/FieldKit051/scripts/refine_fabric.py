import bpy,numpy as np,json,math
from pathlib import Path
import os
ROOT=os.environ.get('RAID_PROJECT_ROOT', str(Path(__file__).resolve().parents[3]));OUT=ROOT+'/public/assets/field-kit-051'
camouflages=json.load(open(ROOT+'/art/FieldKit051/recipes.json'))['camouflages'];n=512
y,x=np.mgrid[0:n,0:n];fy,fx=np.meshgrid(np.fft.fftfreq(n)*n,np.fft.fftfreq(n)*n,indexing='ij')
for index,camo in enumerate(camouflages):
    random=np.random.default_rng(510+index);colors=np.array(camo['colors']);mask=np.zeros((n,n),dtype=int);pattern=camo['pattern']
    def field(scale):
        stretch=2.8 if pattern=='stripe' else 1
        filt=np.exp(-((fx/stretch)**2+(fy*stretch)**2)/(2*scale**2))
        values=np.fft.ifft2(np.fft.fft2(random.normal(size=(n,n)))*filt).real
        return values/max(1e-6,values.std())
    for c in range(1,len(colors)):
        f=field(3 if pattern not in ('digital','leaf') else 5)+field(16)*.22
        if pattern=='digital':f=np.repeat(np.repeat(f[::8,::8],8,0),8,1)
        threshold=.30 if c==1 else .70 if c==2 else 1.15
        if pattern=='snow':threshold+=.8
        mask[f>threshold]=c
    weave=np.sin(x*math.pi/2)*np.sin(y*math.pi/2)*.012+random.normal(0,.003,(n,n))
    rgb=colors[mask]*(1+weave[...,None]);pixels=np.concatenate((np.clip(rgb,0,1),np.ones((n,n,1))),axis=2).astype(np.float32)
    image=bpy.data.images.new('refined-'+camo['id'],n,n,alpha=True);image.pixels.foreach_set(pixels.ravel());image.filepath_raw=OUT+'/camo-'+camo['id']+'.png';image.file_format='PNG';image.save()
result={'refined':len(camouflages)}
