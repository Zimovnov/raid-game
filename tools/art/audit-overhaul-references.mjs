/** Filesystem/provenance audit only. Human visual review remains a separate gate. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../../dist/src/content/catalog.js';
import { JACKETS, TROUSERS, HEADWEAR, GLOVES, BOOTS } from '../../dist/src/content/apparel.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (process.argv.slice(2).some(argument => argument.startsWith('-'))) {
  if (process.argv.length === 3 && ['--help', '-h'].includes(process.argv[2])) {
    console.log('Usage: node tools/art/audit-overhaul-references.mjs [absolute-reference-library-directory]');
    process.exit(0);
  }
  throw Error('Unknown audit option; use --help. No report was written.');
}
const library = process.argv[2] || path.join(os.homedir(), 'Downloads/RAID_GAME_Art_Overhaul_References');
for (const category of ['weapons', 'attachments', 'apparel', 'characters', 'camouflage']) {
  if (!(await fs.stat(path.join(library, category))).isDirectory()) throw Error('Invalid reference category directory: ' + category);
}
const read = async file => {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) return { parseError: file + ': ' + error.message };
    throw error;
  }
};
const camouflageCoverage = await read(path.join(library, 'camouflage/coverage.json'));
if (!Array.isArray(camouflageCoverage?.entries) || camouflageCoverage.entries.length < 49 || new Set(camouflageCoverage.entries.map(item => item.id)).size !== camouflageCoverage.entries.length) throw Error('Incomplete camouflage coverage manifest; no report was written.');
const categories = {
  weapons: [...Object.values(CATALOG).filter(item => item.category === 'weapon').map(item => item.id), 'akmn'],
  attachments: Object.values(CATALOG).filter(item => item.category === 'module').map(item => item.id),
  apparel: [...JACKETS, ...TROUSERS, ...HEADWEAR, ...GLOVES, ...BOOTS].filter(item => !item.id.endsWith('_none')).map(item => item.id),
  characters: [...Array.from({ length: 12 }, (_, i) => 'face_' + String(i).padStart(2, '0')), 'body'],
  camouflage: (camouflageCoverage?.entries || []).map(item => item.id)
};
const approvals = await read(path.join(root, 'art/overhaul/reference-approvals.json')) || {};
const fingerprint = async file => { try { return createHash('sha256').update(await fs.readFile(file)).digest('hex'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const objects = [];
for (const [category, ids] of Object.entries(categories)) for (const id of ids) {
  const folder = path.join(library, category, id), source = await read(path.join(folder, 'sources.json'));
  const records = Array.isArray(source) ? source : source?.references || source?.downloadedReferences || source?.images || [];
  const hashes = new Set(), issues = source?.parseError ? [source.parseError] : [], files = [];
  for (const entry of records) {
    const name = entry.local_file || entry.file || entry.filename;
    if (!name) { issues.push('Reference has no local filename'); continue; }
    let file = path.isAbsolute(name) ? name : path.join(folder, name);
    try { await fs.access(file); } catch { file = path.join(library, category, name); }
    try {
      const bytes = await fs.readFile(file), hash = createHash('sha256').update(bytes).digest('hex');
      if (entry.sha256 && hash !== entry.sha256) issues.push('SHA mismatch: ' + name);
      if (hashes.has(hash)) issues.push('Duplicate image bytes: ' + name);
      hashes.add(hash); files.push(file);
      if (!(entry.source_page || entry.sourcePage || entry.pageURL || entry.url)) issues.push('Missing source page: ' + name);
    } catch (error) { if (error.code === 'ENOENT') issues.push('Missing image: ' + name); else throw error; }
  }
  const brief = path.join(root, 'art/overhaul/briefs', category, id + '.md');
  let hasBrief = false; try { hasBrief = (await fs.stat(brief)).size > 0; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const approval = approvals[category + '/' + id], sourceIndexSha256 = await fingerprint(path.join(folder, 'sources.json')), briefSha256 = await fingerprint(brief);
  const approved = approval?.status === 'PASSED' && approval.sourceIndexSha256 === sourceIndexSha256 && approval.briefSha256 === briefSha256;
  objects.push({ category, id, uniqueImages: hashes.size, hasBrief, sourceIndexSha256, briefSha256, approved, approvalStale: approval?.status === 'PASSED' && !approved, ready: hashes.size >= 5 && !issues.length && hasBrief && approved, issues, files });
}
const summary = Object.fromEntries(Object.keys(categories).map(category => {
  const list = objects.filter(item => item.category === category);
  return [category, { expected: list.length, fiveImagesPresent: list.filter(item => item.uniqueImages >= 5).length, withBrief: list.filter(item => item.hasBrief).length, approved: list.filter(item => item.approved).length, ready: list.filter(item => item.ready).length }];
}));
const report = { generatedAt: new Date().toISOString(), library, modelingGate: objects.every(item => item.ready) && objects.length === 333 ? 'OPEN' : 'CLOSED', note: 'Unique bytes do not establish correct subject, useful viewpoints, modern use, or absence of crops/mirrors. Approvals require an explicit visual/source/brief review.', summary, objects };
await fs.writeFile(path.join(root, 'art/overhaul/reference-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ modelingGate: report.modelingGate, summary }, null, 2));
