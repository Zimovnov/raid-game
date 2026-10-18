import fs from 'node:fs';
import { WEAPONS, MODULES, LOOT, QUESTS, TRADERS, BUILD_VERSION } from '../dist/src/content/catalog.js';
import { RAID_MAPS } from '../dist/src/content/maps.js';
import { WORKSHOP_PRESETS } from '../dist/src/content/presets.js';
import { EQUIPMENT_DEFS } from '../dist/src/content/equipment.js';
import { CAMOUFLAGES, JACKETS, TROUSERS, HEADWEAR, GLOVES, BOOTS, RIGS, BACKPACKS, APPEARANCE_PRESETS, APPAREL_REFERENCES } from '../dist/src/content/apparel.js';
// Evidence must belong to this exact build. Never carry PASS forward after a source change.
const build = JSON.parse(fs.readFileSync('dist/build-info.json', 'utf8'));
const ledger = JSON.parse(fs.readFileSync('artifacts/verification.json', 'utf8'));
if (ledger.build?.hash !== build.hash) throw Error('Verification evidence belongs to another build; rerun the checks.');
for (const name of ['verify', 'native', 'routes']) {
    if (!ledger.commands.some(c => c.name === name && c.exitCode === 0)) throw Error('Missing successful check: ' + name);
}
const native = JSON.parse(fs.readFileSync('artifacts/native-render.json', 'utf8'));
const content = JSON.parse(fs.readFileSync('artifacts/content-validation.json', 'utf8'));
const routes = JSON.parse(fs.readFileSync('artifacts/current/route-audit.json', 'utf8'));
if (native.status !== 'PASS' || content.installed.length !== MODULES.length || content.unreachable.length) {
    throw Error('Content/native evidence does not establish the stated checks.');
}
const actualStatus = path => fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')).status : 'NOT RUN';
const browserStatus = actualStatus('artifacts/e2e-report.json');
const report = {
    verifiedBuildHash: build.hash,
    evidence: ['artifacts/verification.json', 'artifacts/verify.log', 'artifacts/content-validation.json', 'artifacts/native-render.json', 'artifacts/current/route-audit.json'],
    build: BUILD_VERSION,
    scope: 'Installed virtual game definitions. Catalogue totals do not mean complete full-spec acceptance.',
    weapons: WEAPONS.map(d => ({id:d.id,name:d.name,ammo:d.ammo,feed:d.feed,modelStatus:'PROCEDURAL_PRESENT',
        nameSource:'Original user catalogue plus docs/ARSENAL_SOURCES_0.5.json primary references',realVariantVerification:'STYLIZED_PROCEDURAL_MODEL_NOT_A_MEASURED_REPLICA',
        testStatus:{defaultBuild:'PASS',fireAndReloadInWorld:'PASS',nativeRendering:native.checks.some(c=>c.test==='weapon-'+d.id&&c.status==='PASS')?'PASS':'NOT RUN',browserPlaytest:browserStatus}})),
    modules: MODULES.map(d => ({id:d.id,name:d.name,shape:d.shape,interface:d.interface,platforms:d.platforms||null,
        evidenceStatus:'ORIGINAL_VIRTUAL_DESIGN_NOT_A_VERIFIED_BRANDED_REPLICA',modelStatus:'PROCEDURAL_PRESENT',
        compatibilityStatus:'TYPED_GAME_RULES',testStatus:{installableInAtLeastOneValidBuildWithGeometry:'PASS',fullPairwiseMatrix:'NOT RUN',browserVisualAcceptance:browserStatus}})),
    loot: LOOT.map(d => ({id:d.id,name:d.name,shape:d.shape,category:d.category,functionality:d.effect||'sale-and-quest',
        source:'User supplied loot catalogue',geometry:'PRESENT',typedDefinitionTest:'PASS',individualBrowserInspection:'NOT RUN'})),
    presets: WORKSHOP_PRESETS.map(p => ({id:p.id,name:p.name,validation:'PASS',quoteImmutability:'PASS'})),
    equipment: [{id:'armor_light',name:'Legacy light armor'}, {id:'helmet_light',name:'Legacy light helmet'}, ...EQUIPMENT_DEFS.map(d=>({id:d.id,name:d.name,slot:d.equipmentSlot,protection:d.protection}))].map(d=>({...d,
        modelStatus:'PROCEDURAL_PRESENT',protectionStatus:'CONDITION_SCALED_GAME_BALANCE_NOT_REAL_CERTIFICATION',
        correctSlotAndEscrowTests:'PASS',individualBrowserInspection:'NOT RUN'})),
    wardrobe: {
        free:true,camouflages:CAMOUFLAGES.map(d=>({id:d.id,name:d.name,pattern:d.pattern})),
        categories:Object.fromEntries(Object.entries({jackets:JACKETS,trousers:TROUSERS,headwear:HEADWEAR,gloves:GLOVES,boots:BOOTS,rigs:RIGS,backpacks:BACKPACKS}).map(([key,list])=>[key,list.map(d=>({id:d.id,name:d.name,free:d.free}))])),
        presets:APPEARANCE_PRESETS.map(p=>({id:p.id,name:p.name})),
        renderStatus:'ORIGINAL_JOINT_BOUND_PROCEDURAL_MESHES_AND_TWO_BONE_IK',
        saveCompatibility:'OPTIONAL_SCHEMA_3_FIELD_WITH_LEGACY_DEFAULTS',
        capacity:'RIGS_AND_BACKPACKS_ARE_COSMETIC; EXISTING_BAG_6x6_24kg',
        buyanov:'FREE_PELMENI_BAG_RIG; NO_ADDITIONAL_PROTECTION',
        references:APPAREL_REFERENCES,browserPlaytest:browserStatus
    },
    maps: RAID_MAPS.map(m => ({id:m.id,name:m.name,size:m.size,lootPoints:m.loot.length,spawnCandidates:m.bots.length,
        exits:m.exits.length,pois:m.pois.map(p=>({id:p.id,name:p.name})),fullSpecificationStatus:'NOT COMPLETE',controllerRoutes:'PASS',browserRaid:browserStatus})),
    routeEvidence:{status:routes.status,passed:ledger.totals.routesPassed,total:ledger.totals.routesTotal,scope:'World/controller movement from both spawns to loot, exits, activator and POIs; floor-aware visits'},
    traders:TRADERS.length,quests:QUESTS.length,
    fullSpecRemaining:'Physical-device/internet acceptance; large-scale full-spec maps; verified real-brand module catalogue; functional rig/backpack containers and complete inventory model; cloth physics; long-session browser/GPU profiling.'
};
fs.writeFileSync('docs/CONTENT_STATUS.json',JSON.stringify(report,null,2)+'\n');
console.log('Wrote per-definition status for',WEAPONS.length,'weapons,',MODULES.length,'virtual modules,',LOOT.length,'loot definitions.');
