import fs from 'node:fs';
import sharp from 'sharp';
const dir='artifacts/overhaul-assembled-review';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('-left.png')).sort();
for(let page=0;page<Math.ceil(files.length/9);page++){
 const layers=[];
 for(let i=0;i<9;i++){const file=files[page*9+i];if(!file)continue;layers.push({input:await sharp(dir+'/'+file).resize(512,288).png().toBuffer(),left:i%3*512,top:Math.floor(i/3)*288});}
 await sharp({create:{width:1536,height:864,channels:3,background:'#a9b6b9'}}).composite(layers).png().toFile(dir+'/sheet-'+page+'.png');
}
console.log('Reviewed assemblies:',files.length);
