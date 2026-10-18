import fs from 'node:fs';
import sharp from 'sharp';
const qa=JSON.parse(fs.readFileSync('art/overhaul/reference-qa-weapons.json')).weapons;
const ids=JSON.parse(fs.readFileSync('art/overhaul/weapon_sources/layout-input.json')).map(x=>x.id);
for(let page=0;page<4;page++){
  const layers=[];
  for(let i=0;i<9;i++){
    const id=ids[page*9+i];if(!id)continue;
    const file=qa[id]?.evidence?.countedImages?.[0];if(!file)continue;
    const folder='/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/'+id+'/';
    const path=fs.existsSync(folder+file)?folder+file:folder+'images/'+file;
    const b=await sharp(path).resize(510,220,{fit:'contain',background:'#e4e4e4'}).png().toBuffer();
    layers.push({input:b,left:(i%3)*520,top:Math.floor(i/3)*250});
    layers.push({input:Buffer.from(`<svg width="510" height="25"><rect width="510" height="25" fill="white"/><text x="4" y="18" font-size="16">${id}</text></svg>`),left:(i%3)*520,top:Math.floor(i/3)*250+220});
  }
  await sharp({create:{width:1560,height:750,channels:3,background:'#bbb'}}).composite(layers).png().toFile('/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/_review/weapon-production-'+page+'.png');
}
