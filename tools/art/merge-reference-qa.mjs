/** Merge independently owned review ledgers; never infer approval from counts. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
const folder = path.resolve('art/overhaul');
const library = path.join(os.homedir(), 'Downloads/RAID_GAME_Art_Overhaul_References');
const sha = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const approvals = JSON.parse(await fs.readFile(path.join(folder, 'reference-approvals.json'), 'utf8'));
const applied = [], skipped = [];
for (const file of ['reference-qa-weapons.json', 'reference-qa-attachments.json', 'reference-qa-apparel-characters-camouflage.json', 'reference-qa-attachments-ak.json', 'reference-qa-attachments-director.json', 'reference-qa-attachments-secondary.json']) {
  let ledger;
  try { ledger = JSON.parse(await fs.readFile(path.join(folder, file), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const decisions = ledger.decisions || (ledger.weapons ? Object.fromEntries(Object.entries(ledger.weapons).map(([id, entry]) => ['weapons/' + id, entry])) : ledger);
  for (const [key, entry] of Object.entries(decisions)) {
    if (!/^(weapons|attachments|apparel|characters|camouflage)\/[a-z0-9_]+$/.test(key)) continue;
    if (entry.status !== 'PASSED') {
      if (approvals[key]?.ledger === file) delete approvals[key];
      continue;
    }
    const [category, id] = key.split('/');
    const sourceHash = await sha(path.join(library, category, id, 'sources.json'));
    const briefHash = await sha(path.join(folder, 'briefs', category, id + '.md'));
    if (entry.sourceIndexSha256 !== sourceHash || entry.briefSha256 !== briefHash || !entry.views || !entry.evidence || !entry.reviewers?.length) {
      skipped.push({ key, reason: 'Stale hashes or incomplete review evidence' }); continue;
    }
    approvals[key] = { ...entry, reviewers: entry.reviewers.filter(name => !/not yet assigned/i.test(name)), ledger: file, note: 'Per-object source/brief review only; full modeling gate remains the separate reference audit.' };
    applied.push(key);
  }
}
await fs.writeFile(path.join(folder, 'reference-approvals.json'), JSON.stringify(approvals, null, 2) + '\n');
console.log(JSON.stringify({ applied, skipped }, null, 2));
