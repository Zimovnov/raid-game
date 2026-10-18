/** Private review derivatives stay with the external reference library. */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const [category, ...ids] = process.argv.slice(2);
if (!['weapons', 'attachments', 'apparel', 'characters', 'camouflage'].includes(category) || !ids.length || ids.some(id => !/^[a-z0-9_]+$/.test(id))) throw Error('Usage: node tools/art/reference-contact-sheet.mjs category id ...');
const root = path.join(os.homedir(), 'Downloads/RAID_GAME_Art_Overhaul_References');
const files = [];
for (const id of ids) {
  const folder = path.join(root, category, id);
  const index = JSON.parse(await fs.readFile(path.join(folder, 'sources.json'), 'utf8'));
  const references = Array.isArray(index) ? index : index.references || index.downloadedReferences || index.images || [];
  for (const reference of references) {
    const name = reference.local_file || reference.file || reference.filename;
    if (!name) throw Error('Reference has no local filename: ' + id);
    let file = path.isAbsolute(name) ? name : path.join(folder, name);
    try { await fs.access(file); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      file = path.join(root, category, name);
    }
    files.push({ id, name: path.basename(name), file });
  }
}
if (!files.length) throw Error('No reference images');
const tiles = [], escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const [i, { id, name, file }] of files.entries()) {
  const image = await sharp(file).resize(260, 165, { fit: 'contain', background: '#deded8' }).png().toBuffer();
  const left = i % 4 * 270, top = Math.floor(i / 4) * 195;
  tiles.push({ input: image, left, top: top + 25 });
  const label = escape(id.replace('weapon_', '') + ' ' + name.slice(0, 18));
  tiles.push({ input: Buffer.from('<svg width="270" height="24"><text x="4" y="17" font-size="12" fill="black">' + label + '</text></svg>'), left, top });
}
const output = path.join(root, '_review', category + '-' + ids.join('-') + '.jpg');
await fs.mkdir(path.dirname(output), { recursive: true });
await sharp({ create: { width: 1080, height: Math.ceil(files.length / 4) * 195, channels: 3, background: '#deded8' } }).composite(tiles).jpeg({ quality: 90 }).toFile(output);
console.log(JSON.stringify({ images: files.length, output }));
