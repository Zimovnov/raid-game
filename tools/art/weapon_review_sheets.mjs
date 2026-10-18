import fs from 'node:fs';
import sharp from 'sharp';
const source='art/overhaul/weapon_sources/';
const records=JSON.parse(fs.readFileSync(source+'layout-input.json'));
for(let page=0;page<4;page++){
  const layers=[];
  for(let i=0;i<9;i++){
    const record=records[page*9+i];if(!record)continue;
    const path=source+'renders/'+record.id+'-oblique.png';if(!fs.existsSync(path))continue;
    const image=await sharp(path).resize(500,312).png().toBuffer();
    const left=i%3*510,top=Math.floor(i/3)*342;
    layers.push({input:image,left,top});
    layers.push({input:Buffer.from(`<svg width="500" height="25"><rect width="500" height="25" fill="#eee"/><text x="4" y="18" font-size="16">${record.id} — BODY/ACTION QA</text></svg>`),left,top:top+312});
  }
  await sharp({create:{width:1530,height:1026,channels:3,background:'#aaa'}}).composite(layers).png().toFile(source+'body-only-review-sheet-'+page+'.png');
}
