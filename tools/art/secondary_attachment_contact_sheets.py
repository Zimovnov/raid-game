"""Contact sheets of rendered original modules, never whole weapons or source photos."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'art/overhaul/secondary_attachment_sources';recipes=json.loads((ROOT/'art/overhaul/production/attachment-recipes.json').read_text())['modules']
manifest=json.loads((SRC/'manifest.json').read_text())
for slot in ('stock','handguard','mount','muzzle'):
    ids=sorted(k for k in manifest if recipes[k]['attachmentSlot']==slot)
    for page in range((len(ids)+11)//12):
        rows=ids[page*12:(page+1)*12];im=Image.new('RGB',(1920,1800),'#182028');draw=ImageDraw.Draw(im)
        for i,k in enumerate(rows):
            x=i%3*640;y=i//3*450;p=SRC/'renders'/(k+'-oblique.png')
            if not p.exists():raise FileNotFoundError(p)
            im.paste(Image.open(p).convert('RGB'),(x,y+30));v=manifest[k];draw.text((x+12,y+8),k+'   LOD0 '+str(v['triangles']['0'])+' / LOD1 '+str(v['triangles']['1']),fill='#e0e5e0')
        im.save(SRC/'renders'/('contact-'+slot+'-'+str(page)+'.jpg'),quality=94)
print('Contact sheets generated.')
