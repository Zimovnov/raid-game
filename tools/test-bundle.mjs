// Isolated browser fixture for local source testing; never part of production dist.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const files=[];function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(p.endsWith('.ts'))files.push(p);}}scan('src');
let out=`window.__modules={};const cache={};window.localModule=function load(key,from='src/root.js'){let p=key.startsWith('.')?from.split('/').slice(0,-1).concat(key.split('/')):key.split('/');const v=[];for(const s of p){if(s==='..')v.pop();else if(s!=='.'&&s!=='')v.push(s);}key=v.join('/');if(cache[key])return cache[key].exports;const module={exports:{}};cache[key]=module;__modules[key](module,module.exports,q=>load(q,key));return module.exports;};\n`;
for(const file of files){if(file.endsWith('/main.ts'))continue;const source=fs.readFileSync(file,'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;out+=`__modules[${JSON.stringify(file.replace('.ts','.js'))}]=function(module,exports,require){\n${js}\n};\n`;}
fs.writeFileSync('artifacts/isolated-test-bundle.js',out);
