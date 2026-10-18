import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';import {BUILD_HASH} from '../dist/src/content/version.js';
await mkdir('dist',{recursive:true});for(const file of ['index.html','style.css'])await cp(file,'dist/'+file);await cp('public','dist',{recursive:true});
await writeFile('dist/build-info.json',JSON.stringify({version:JSON.parse(await readFile('package.json','utf8')).version,hash:BUILD_HASH,builtAt:new Date().toISOString()},null,2));
console.log('Production files: dist/; build '+BUILD_HASH.slice(0,16));
