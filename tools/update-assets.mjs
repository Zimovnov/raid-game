import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const path = 'public/asset-manifest.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));
for (const entry of manifest.assets) {
    entry.sha256 = createHash('sha256').update(await readFile(entry.path)).digest('hex');
}
await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
