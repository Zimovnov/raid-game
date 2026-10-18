/** Reproducible renderer/content fingerprint; no Git repository is assumed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { MODEL_ASSETS } from '../../dist/src/content/model-assets.js';
import { FABRIC_ASSETS, FABRIC_NORMAL } from '../../dist/src/content/fabric-assets.js';
const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label || '')) throw Error('Usage: node tools/art/snapshot-benchmark-inputs.mjs baseline|overhaul');
const files = (await fs.readdir('src', { recursive: true })).filter(file => file.endsWith('.ts') || file.endsWith('.tsx')).map(file => path.join('src', file));
files.push('package-lock.json', 'tools/art/overhaul-review.html', ...new Set([...Object.values(MODEL_ASSETS).map(asset => asset.url), ...Object.values(FABRIC_ASSETS), FABRIC_NORMAL].map(url => 'public' + url.split('?')[0])));
const hashes = {};
for (const file of files.sort()) hashes[file] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
const report = { recordedAt: new Date().toISOString(), fingerprint: createHash('sha256').update(JSON.stringify(hashes)).digest('hex'), host: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, ramBytes: os.totalmem(), node: process.version }, files: hashes, scope: 'Source code, dependency lock, review fixture and registered weapon/fabric assets. Controlled browser performance is recorded separately.' };
const output = path.join('art/overhaul', label + '-benchmark-inputs.json');
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, fingerprint: report.fingerprint, files: files.length }));
