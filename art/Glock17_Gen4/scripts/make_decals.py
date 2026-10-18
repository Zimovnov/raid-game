from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'textures'
font='/System/Library/Fonts/Supplemental/Arial Narrow.ttf'
def textfit(d,xy,t,h,w=None):
 f=ImageFont.truetype(font,h); d.text(xy,t,font=f,fill=255,stroke_width=0)
def logo(d,x,y,scale):
 d.rounded_rectangle((x,y,x+scale,y+scale*.87),radius=scale*.18,outline=255,width=max(2,int(scale*.055)))
 textfit(d,(x+scale*.08,y+scale*.15),'GLOCK',int(scale*.36))
 d.rectangle((x+scale*.1,y+scale*.62,x+scale*.70,y+scale*.70),fill=255)
for side in ('left','right'):
 im=Image.new('L',(2048,256));d=ImageDraw.Draw(im)
 if side=='left':
  logo(d,110,72,90);textfit(d,(302,75),'17',70);textfit(d,(370,105),'Gen4',35);textfit(d,(532,100),'AUSTRIA',42);textfit(d,(921,109),'9x19',43)
 else:
  textfit(d,(887,183),'PHP 333',34);logo(d,566,145,52)
 # UV horizontal coordinate on the left runs from rear to muzzle; display is mirrored geometrically by side view.
 if side=='left':im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 im.save(P/f'source_slide_{side}_marks.png')
import math
# Original masks, recreated from the layout; no reference pixels are used as game textures.
W,H=2048,1400
for side in ('left','right'):
 height=Image.new('L',(W,H));marks=Image.new('L',(W,H));d=ImageDraw.Draw(height);dm=ImageDraw.Draw(marks)
 def uv(u,v):return ((u-325)/735*W,(v-50)/490*H)
 mask=Image.new('L',(W,H));md=ImageDraw.Draw(mask)
 md.polygon([uv(u,v) for u,v in [(480,261),(563,279),(509,452),(401,451)]],fill=255)
 for r in range(44):
  for c in range(27):
   u=420+c*5.2-r*1.8;v=245+r*5.0+c*1.8
   x,y=uv(u,v)
   if 0<x<W and 0<y<H and mask.getpixel((int(x),int(y))):
    pts=[uv(u+a,v+b) for a,b in [(-1.45,-1.45),(1.45,-1.45),(1.45,1.45),(-1.45,1.45)]]
    d.polygon(pts,fill=215)
 # Side moulded label plate and small readable stamp; unresolvable fine text omitted.
 if side=='right':
  x,y=uv(491,170);textfit(dm,(x,y),'MADE IN AUSTRIA',23);textfit(dm,(x,y+24),'GLOCK  G. SMYRNA GA.',20)
  x,y=uv(767,169);textfit(dm,(x,y),'MBS',25)
 else:
  # Mirrored texture coordinates ensure readable text on the left surface.
  x,y=uv(450,414);logo(dm,x,y,70)
  marks=marks.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 height.save(P/f'source_frame_{side}_height.png');marks.save(P/f'source_frame_{side}_marks.png')
