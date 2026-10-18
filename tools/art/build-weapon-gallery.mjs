import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MODEL_ASSETS} from '../../dist/src/content/model-assets.js';
import {CATALOG,BUILD_VERSION} from '../../dist/src/content/catalog.js';
const source='artifacts/overhaul-assembled-review';
const target='/Users/vladimir/Downloads/RAID_GAME_Final_Weapon_Photos';
const views={left:'Слева',right:'Справа',oblique:'Три четверти',top:'Сверху',front:'Спереди',rear:'Сзади'};
const weapons=Object.values(CATALOG).filter(item=>item.category==='weapon');
const records=[],stale=[];
for(const weapon of weapons){
 const images=[];
 for(const [angle,label] of Object.entries(views)){
  const name=weapon.id+'-'+angle,report=JSON.parse(await fs.readFile(source+'/'+name+'.json','utf8'));
  if(!report.ready||report.errors.length||report.weapon!==weapon.id||report.angle!==angle)throw Error('Incomplete frame: '+name);
  if(report.bindings.some(binding=>binding.url!==MODEL_ASSETS[binding.id].url))stale.push({weapon:weapon.id,angle});
  const bytes=await fs.readFile(source+'/'+name+'.png');
  if(bytes.readUInt32BE(16)!==1280||bytes.readUInt32BE(20)!==720)throw Error('Wrong dimensions: '+name);
  images.push({angle,label,file:angle+'.png',sha256:createHash('sha256').update(bytes).digest('hex'),report});
 }
 records.push({id:weapon.id,name:weapon.name,images});
}
await fs.mkdir(target,{recursive:true});
if(stale.length){await fs.writeFile(source+'/stale-frames.json',JSON.stringify(stale,null,2));throw Error('Stale source hashes: '+JSON.stringify(stale));}
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for(const weapon of records){
 const dir=target+'/'+weapon.id;await fs.mkdir(dir,{recursive:true});
 for(const image of weapon.images)await fs.copyFile(source+'/'+weapon.id+'-'+image.angle+'.png',dir+'/'+image.file);
 await fs.writeFile(dir+'/metadata.json',JSON.stringify({build:BUILD_VERSION,weapon:weapon.id,name:weapon.name,scope:'Actual assembled runtime model, studio lighting. Whole overhaul/gameplay acceptance is incomplete.',images:weapon.images},null,2)+'\n');
}
await fs.writeFile(target+'/index.html',`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>RAID GAME — модели оружия</title><style>body{margin:32px;background:#101616;color:#e2e7e3;font:16px system-ui}h1{margin-bottom:8px}p{color:#aab8b2}input{padding:12px;width:min(420px,85%);font:inherit;margin:16px 0}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}article{background:#1b2422;border:1px solid #36473f;border-radius:8px;overflow:hidden}img{width:100%;display:block}h2{font-size:18px;margin:16px}nav{display:flex;flex-wrap:wrap;gap:12px;padding:0 16px 20px}a{color:#b7d5a6}article[hidden]{display:none}</style><h1>RAID GAME — модели оружия</h1><p>36 штатных сборок · 216 PNG 1280×720 · ${esc(BUILD_VERSION)}<br>Настоящий игровой рендерер, студийный свет. Итог текущего этапа; полная проверка всех модификаций ещё не завершена.</p><label>Найти оружие <input id="search" type="search" placeholder="Например, АК или Glock"></label><main>${records.map(w=>`<article data-name="${esc(w.name.toLowerCase())}"><a href="${w.id}/oblique.png"><img loading="lazy" src="${w.id}/oblique.png" alt="${esc(w.name)} — три четверти"></a><h2>${esc(w.name)}</h2><nav>${w.images.map(i=>`<a href="${w.id}/${i.file}">${i.label}</a>`).join('')}</nav></article>`).join('')}</main><script>document.getElementById('search').oninput=e=>document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.name.includes(e.target.value.toLowerCase()));</script></html>`);
await fs.writeFile(target+'/README_RU.txt',`RAID GAME — фотографии моделей текущего этапа\nСборка: ${BUILD_VERSION}\n36 оружий, 216 PNG: слева, справа, три четверти, сверху, спереди, сзади.\nОткройте index.html для просмотра. Каждый ID имеет отдельную папку и metadata.json с составом сборки и SHA файлов.\nЭто полные штатные сборки через настоящий игровой рендерер со студийным освещением, а не фото реальных прототипов и не сгенерированные иллюстрации.\nБазы AKM, AK-74M и Glock сохранены по поручению пользователя. AKMN runtime не включался.\nПолная визуальная проверка всех 202 модулей во всех совместимых сборках, анимации и сравнительный FPS остаются незавершёнными; эти кадры сами по себе их не подтверждают.\n`);
console.log(JSON.stringify({status:'PASSED',weapons:records.length,images:records.length*6,build:BUILD_VERSION,path:target}));
