import http from 'node:http';
import {createHash} from 'node:crypto';
import {createReadStream,existsSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(base,'dist-web');const args=process.argv.slice(2);
if(!existsSync(path.join(root,'index.html'))){console.error('Не найдена готовая сборка dist-web. Выполните npm ci && npm run build.');process.exit(1);}
const host=args.includes('--lan')?'0.0.0.0':'127.0.0.1';
let port=Number(process.env.PORT || (args.find(x=>x.startsWith('--port='))?.split('=')[1]) || 8080);if(!Number.isInteger(port)||port<1024||port>65535){console.error('Некорректный порт');process.exit(1);}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.map':'application/json','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 let url;try{url=new URL(req.url,'http://localhost');}catch{res.writeHead(400);res.end();return;}
 if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({game:'REID',signal:true}));return;}
 let name;try{name=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end();return;}
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(name.includes('\0')||name.includes('\\')||!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const info=await stat(file);if(!info.isFile())throw Error('not file');res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('404: файл не найден');}
});
// Minimal bounded RFC6455 signaling relay. No game simulation or game-state packets here.
const peers=new Map();
function frame(data,opcode=1){const b=Buffer.from(data);let h;if(b.length<126)h=Buffer.from([128|opcode,b.length]);else if(b.length<=65535){h=Buffer.alloc(4);h[0]=128|opcode;h[1]=126;h.writeUInt16BE(b.length,2);}else{h=Buffer.alloc(10);h[0]=128|opcode;h[1]=127;h.writeBigUInt64BE(BigInt(b.length),2);}return Buffer.concat([h,b]);}
server.on('upgrade',(req,socket)=>{
 const u=new URL(req.url,'http://localhost'),id=u.searchParams.get('id'),key=req.headers['sec-websocket-key'];
 if(u.pathname!=='/peerjs'||!/^reid-[a-f0-9]{32}$/.test(id||'')||typeof key!=='string'||key.length>50||req.headers['sec-websocket-version']!=='13'||peers.size>=16){socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');return;}
 const accept=createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 const send=o=>{if(!socket.destroyed)socket.write(frame(JSON.stringify(o)));};
 if(peers.has(id)){send({type:'ID-TAKEN'});socket.end();return;}
 let buffer=Buffer.alloc(0),fragment=Buffer.alloc(0),rate=0,rateAt=Date.now();const state={socket,send,last:Date.now()};peers.set(id,state);send({type:'OPEN'});socket.setNoDelay(true);
 socket.on('data',chunk=>{
  buffer=Buffer.concat([buffer,chunk]);if(buffer.length>262144){socket.destroy();return;}
  while(buffer.length>=2){const first=buffer[0],masked=buffer[1]&128,opcode=first&15,fin=!!(first&128);let len=buffer[1]&127,off=2;
   if(!masked||(first&112)){socket.destroy();return;}if(len===126){if(buffer.length<4)return;len=buffer.readUInt16BE(2);off=4;}else if(len===127){if(buffer.length<10)return;const big=buffer.readBigUInt64BE(2);if(big>180000n){socket.destroy();return;}len=Number(big);off=10;}
   if(len>180000){socket.destroy();return;}if(buffer.length<off+4+len)return;const mask=buffer.subarray(off,off+4),data=Buffer.from(buffer.subarray(off+4,off+4+len));buffer=buffer.subarray(off+4+len);for(let i=0;i<len;i++)data[i]^=mask[i%4];
   if(opcode===8){socket.end(frame(Buffer.alloc(0),8));return;}if(opcode===9){socket.write(frame(data,10));continue;}if(opcode===10)continue;if(opcode!==0&&opcode!==1){socket.destroy();return;}
   fragment=Buffer.concat([fragment,data]);if(fragment.length>180000){socket.destroy();return;}if(!fin)continue;const text=fragment.toString('utf8');fragment=Buffer.alloc(0);
   if(Date.now()-rateAt>1000){rate=0;rateAt=Date.now();}if(++rate>80){socket.destroy();return;}
   try{const msg=JSON.parse(text);state.last=Date.now();if(msg.type==='HEARTBEAT')continue;if(!['OFFER','ANSWER','CANDIDATE','LEAVE'].includes(msg.type)||typeof msg.dst!=='string')continue;const dest=peers.get(msg.dst);if(dest)dest.send({type:msg.type,src:id,payload:msg.payload});else send({type:'EXPIRE',src:msg.dst});}catch{socket.destroy();return;}
  }
 });
 socket.on('error',()=>{});socket.on('close',()=>{if(peers.get(id)===state)peers.delete(id);});
});
const heartbeat=setInterval(()=>{for(const [id,p] of peers)if(Date.now()-p.last>40000){p.socket.destroy();peers.delete(id);}},10000);heartbeat.unref();
let attempts=0;server.on('error',err=>{if(err.code==='EADDRINUSE'&&++attempts<20){port++;server.listen(port,host);}else{console.error(err.message);process.exit(1);}});
server.listen(port,host,()=>{const url='http://localhost:'+port;console.log('\nРЕЙД — '+url+'\nОстановить: Ctrl+C'+(host==='0.0.0.0'?'\nLAN включён явно. Передайте другу адрес этого компьютера в локальной сети.':'')+'\n');if(args.includes('--open')){const program=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open';const a=process.platform==='win32'?['/c','start','',url]:[url];execFile(program,a,err=>{if(err)console.log('Откройте адрес вручную в браузере.');});}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const p of peers.values())p.socket.destroy();server.close(()=>process.exit(0));});
