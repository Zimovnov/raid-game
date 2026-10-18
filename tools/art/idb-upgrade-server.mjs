/** Isolated browser migration harness. No API, auth or production data. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
const [controlFile, publicDirectory] = process.argv.slice(2);
if (!controlFile || !publicDirectory) throw Error('Supply the static-root control file and public asset directory.');
const port = 18263;
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };
const resolve = (root, name) => { const file = path.resolve(root, '.' + name); return file.startsWith(path.resolve(root) + path.sep) ? file : null; };
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const name = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (name.includes('\\') || name.includes('\0')) { res.writeHead(400); res.end(); return; }
    const root = (await fs.readFile(controlFile, 'utf8')).trim();
    const names = name === '/' ? ['/index.html', '/web/index.html'] : [name];
    for (const directory of [root, publicDirectory]) for (const candidate of names) {
      const file = resolve(directory, candidate); if (!file) continue;
      let stat; try { stat = await fs.stat(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (!stat.isFile()) continue;
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      createReadStream(file).pipe(res); return;
    }
    res.writeHead(404); res.end('Not found');
  } catch { res.writeHead(500); res.end('Fixture server error'); }
});
server.listen(port, '127.0.0.1', () => console.log('IndexedDB migration fixture: http://127.0.0.1:' + port));
