import fs from 'node:fs/promises';
import { CATALOG } from '../../dist/src/content/catalog.js';
import { MODEL_ASSETS } from '../../dist/src/content/model-assets.js';
import { createWeapon } from '../../dist/src/domain/items.js';
import { weaponModel } from '../../dist/src/rendering/models.js';
import { model } from '../../dist/src/rendering/math.js';
const weapons = {};
for (const item of Object.values(CATALOG).filter(item => item.category === 'weapon')) {
  weapons[item.id] = { name: item.name, groups: weaponModel(createWeapon(item.id, false)).filter(part => part.asset?.first).map(part => ({ asset: part.asset.weapon, group: part.asset.group, url: MODEL_ASSETS[part.asset.weapon].url.split('?')[0], matrix: Array.from(model(part.p, part.s, part.r)) })) };
}
await fs.writeFile('art/overhaul/runtime-review-recipes.json', JSON.stringify({ generatedAt: new Date().toISOString(), weapons }, null, 2) + '\n');
console.log('Exported current default assemblies:', Object.keys(weapons).length);
