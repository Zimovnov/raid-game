import fs from 'node:fs';
const target = 'public/asset-manifest.json';
const manifest = JSON.parse(fs.readFileSync(target));
manifest.date = '2026-10-18';
const generators = {weapons:'build_weapon_overhaul.py', attachments:'build_attachment_overhaul.py', 'attachments-secondary':'build_secondary_attachments.py', characters:'build_character_overhaul.py', fabrics:'build_camouflage_overhaul.py'};
for (const [category, generator] of Object.entries(generators)) {
    for (const file of fs.readdirSync('public/assets/art-overhaul/' + category).filter(file => /\.(glb|png)$/.test(file))) {
        const path = 'public/assets/art-overhaul/' + category + '/' + file;
        const entry = {id:'art-overhaul/' + category + '/' + file, path, author:'RAID GAME — original project artwork, Codex', license:'MIT (original project artwork)', sourceUrl:null, sourceScript:'tools/art/' + generator, modified:false, description:'Original authored game geometry or procedural texture. Private research photographs and third-party print topology are not redistributed.'};
        const index = manifest.assets.findIndex(asset => asset.path === path);
        if (index < 0) manifest.assets.push(entry); else manifest.assets[index] = entry;
    }
}
fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n');
console.log('Provenance entries:', manifest.assets.length);
