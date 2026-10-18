import {readdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const hash=createHash('sha256');
async function scan(dir){for(const ent of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(ent.name==='.DS_Store'||ent.name.startsWith('._'))continue;const file=dir+'/'+ent.name;if(file==='src/content/version.ts')continue;if(ent.isDirectory())await scan(file);else{hash.update(file);hash.update(await readFile(file));}}}
await scan('src');await scan('public');for(const file of ['index.html','style.css'])hash.update(await readFile(file));
const value=hash.digest('hex');await writeFile('src/content/version.ts',`// Generated from the complete source/content bundle before compilation.\nexport const BUILD_HASH = '${value}';\n`);
