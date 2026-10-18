/** Triage only: similar images require manual subject/view review before approval. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const audit = JSON.parse(await fs.readFile(path.join(root, 'art/overhaul/reference-audit.json'), 'utf8'));
const cache = new Map();
const contentCache = new Map();
const errors = [];
const hash = pixels => {
  let result = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) result = (result << 1n) | BigInt(pixels[y * 9 + x] > pixels[y * 9 + x + 1]);
  return result;
};
const distance = (a, b) => {
  let bits = a ^ b, count = 0;
  while (bits) { count++; bits &= bits - 1n; }
  return count;
};
async function fingerprint(file) {
  if (cache.has(file)) return cache.get(file);
  const pending = (async () => {
    const bytes = await fs.readFile(file);
    const key = createHash('sha256').update(bytes).digest('hex');
    if (contentCache.has(key)) return contentCache.get(key);
    const work = (async () => {
    // Decode once, and share the fingerprint for copied references across IDs.
    const preview = await sharp(bytes, { limitInputPixels: 100_000_000 }).rotate().flatten({ background: '#ddd' }).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    const source = sharp(preview);
    const samples = [];
    // Background trimming is a heuristic, not proof of a crop or a repeated view.
    for (const trimmed of [false, true]) for (const mirrored of [false, true]) {
      let image = source.clone();
      if (trimmed) image = image.trim({ threshold: 15 });
      if (mirrored) image = image.flop();
      const pixels = await image.resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
      samples.push({ hash: hash(pixels), trimmed, mirrored });
    }
    return samples;
    })();
    contentCache.set(key, work);
    return work;
  })().catch(error => { errors.push({ file, error: error.message }); return null; });
  cache.set(file, pending);
  return pending;
}

const packages = [];
for (const item of audit.objects) {
  const files = [...new Set(item.files)];
  const samples = await Promise.all(files.map(fingerprint));
  const pairs = [];
  for (let a = 0; a < files.length; a++) for (let b = a + 1; b < files.length; b++) {
    if (!samples[a] || !samples[b]) continue;
    let closest = null;
    for (const left of samples[a]) for (const right of samples[b]) {
      const bits = distance(left.hash, right.hash);
      if (!closest || bits < closest.hammingBits) closest = { hammingBits: bits, leftTrimmed: left.trimmed, rightTrimmed: right.trimmed, mirroredComparison: left.mirrored !== right.mirrored };
    }
    if (closest.hammingBits <= 4) pairs.push({ files: [files[a], files[b]], ...closest });
  }
  if (pairs.length) packages.push({ category: item.category, id: item.id, pairs: pairs.sort((a, b) => a.hammingBits - b.hammingBits) });
}
const report = {
  generatedAt: new Date().toISOString(), sourceAuditAt: audit.generatedAt,
  scope: 'Manual-review candidates only. No approval or source index is changed. A close hash can represent distinct symmetric sides; a distant hash does not prove uniqueness.',
  method: '64-bit horizontal difference hash; decoded once at max512px, original/trimmed and reflected comparison, threshold <=4 bits. Background trimming and mirror comparison are heuristics.',
  reviewCriteria: 'Exclude resize/recompression/mirror/crop/background replacement of one shot from the five independent references. Count new visible sides or independently photographed details. Verify side-specific controls before rejecting a symmetric pair.',
  packages, errors,
};
const output = path.join(root, 'art/overhaul/similar-reference-candidates.json');
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ packages: packages.length, pairs: packages.reduce((sum, item) => sum + item.pairs.length, 0), images: cache.size, errors: errors.length, output }, null, 2));
