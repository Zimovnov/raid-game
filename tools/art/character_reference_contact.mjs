import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = '/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References';
for (const [category, prefix] of [['apparel','jacket'],['apparel','trousers'],['apparel','head'],['apparel','boots'],['apparel','gloves'],['characters','face']]) {
    const folders = (await fs.readdir(path.join(root, category))).filter(name => name.startsWith(prefix)).sort();
    const composite = [];
    for (const [i, id] of folders.entries()) {
        const source = JSON.parse(await fs.readFile(path.join(root, category, id, 'sources.json'), 'utf8'));
        const reference = source.images[0];
        if (reference) composite.push({ input: await sharp(path.join(root, category, id, reference.file)).resize(230, 280, {fit:'inside'}).png().toBuffer(), left: i*240, top: 26 });
        composite.push({ input: Buffer.from('<svg width="240" height="26"><text x="4" y="18" font-size="15">'+id+'</text></svg>'), left: i*240, top: 0 });
    }
    await sharp({create:{width:240*folders.length,height:320,channels:3,background:'#eeeeee'}}).composite(composite).jpeg().toFile(path.join(root, '_character_artist_'+prefix+'.jpg'));
}
