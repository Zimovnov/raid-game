from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
P=Path(__file__).resolve().parents[1];pr=P/'previews'
f=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
views=['left','right','front','rear','top','front34','rear34','fps']
canvas=Image.new('RGB',(1600,660),(33,36,39));d=ImageDraw.Draw(canvas)
for i,name in enumerate(views):
 im=Image.open(pr/f'final_{name}.png');im.thumbnail((400,300));x=i%4*400;y=i//4*330
 canvas.paste(im,(x,y+35));d.text((x+15,y+10),name,font=f,fill='white')
# Reuse bottom half for comparison pairs at a common physical scale.
canvas.save(pr/'all_views.jpg',quality=95)
comparison=Image.new('RGB',(1600,1160),(34,35,36));d=ImageDraw.Draw(comparison)
for i,name in enumerate(['right','left']):
 ref=Image.open(P/'references'/f'ortho_{name}.png').convert('RGB')
 model=Image.open(pr/f'final_{name}.png').convert('RGB').resize((819,614),Image.Resampling.LANCZOS)
 # Camera calibration: 186 mm slide = 634 px in the primary sheet.
 # Right/left share scale; positions are aligned by slide endpoints and top.
 box=(23,72,758,562) if name=='right' else (62,72,797,562)
 model=model.crop(box)
 y=40+i*555
 comparison.paste(ref,(30,y));comparison.paste(model,(830,y));d.text((30,y-30),f'{name} / supplied reference',font=f,fill='white');d.text((830,y-30),'model / same slide-length scale',font=f,fill='white')
comparison.save(pr/'profile_comparison.jpg',quality=96)
front=Image.new('RGB',(1400,600),(34,35,36));d=ImageDraw.Draw(front)
for i,name in enumerate(['front','rear']):
 ref=Image.open(P/'references'/f'ortho_{name}.png').convert('RGB')
 model=Image.open(pr/f'final_{name}.png').convert('RGB');model=model.resize((698,524),Image.Resampling.LANCZOS).crop((269,10,429,500))
 x=i*700;front.paste(ref,(x+60,60));front.paste(model,(x+340,60));d.text((x+40,15),name+' / reference and model',font=f,fill='white')
front.save(pr/'front_rear_comparison.jpg',quality=96)
