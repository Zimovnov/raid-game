import { MODEL_ASSETS, MODULE_MODEL_ASSETS } from '../content/model-assets.js';
import { modelPresentation } from '../content/model-presentation.js';
import { getNode } from '../domain/items.js';
import { weaponMotion, type WeaponPose } from './weapon-animation.js';
import { geometry } from './geometry.js';
import { model, transform } from './math.js';
import { lootGeometry } from './loot-geometry.js';
import { additionalWeaponBase, weaponLayout } from './weapon-bases.js';
import type { Character, Color, Equipment, Item, MapDef, Part, Vec3 } from '../domain/types.js';
import { CATALOG } from '../content/catalog.js';
import { characterAppearanceModel, equipmentAppearanceModel } from './apparel.js';
import { arsenalModuleModel } from './arsenal-models.js';
import type { HeldWeaponPresentation } from './held-weapon.js';
import type { AssetTransform } from '../content/model-asset-types.js';
import { rgb, rng } from '../domain/util.js';
const dark = rgb('#262d2c'), metal = rgb('#515b5b'), black = rgb('#161d1d'), wood = rgb('#85603e');
const part = (shape: Part['shape'], p: Vec3, s: Vec3, c: Color = dark, r: Vec3 = [0, 0, 0], slot?: string): Part => ({ shape, p, s, c, r, slot });
export function weaponModel(gun: Item, selected = '', explode = 0, pose: WeaponPose = {}, usePresentation = true): Part[] {
    // The renderer must use the same installed tree as inventory and simulation.
    const presentation = usePresentation ? modelPresentation(gun) : gun;
    const list: Part[] = [], d = CATALOG[presentation.def], type = d.shape;
    const box = (p: Vec3, s: Vec3, c = dark, r: Vec3 = [0, 0, 0], slot = '') => list.push(part('box', p, s, c, r, slot));
    const cyl = (p: Vec3, s: Vec3, c = dark, r: Vec3 = [Math.PI / 2, 0, 0], slot = '') => list.push(part('cylinder', p, s, c, r, slot));
    const motion = weaponMotion(gun, pose);
    const socketFrames = new Map<string, AssetTransform>([
        ['body', { p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0] }],
        ['action', { p: [0, 0, motion.bolt], s: [1, 1, 1], r: [0, 0, 0] }]
    ]);
    const layout = weaponLayout(type), custom = additionalWeaponBase(type);
    if (custom) list.push(...custom);
    else if (type === 'pm') {
        box([0, .02, 0], [.085, .082, .25], metal, [0,0,0], 'action');
        box([0, -.05, .015], [.07, .055, .21]);
        cyl([0, .024, -.145], [.034, .09, .034], black);
        box([0, .07, .095], [.055, .02, .022]);
        box([0, .07, -.1], [.012, .025, .016]);
        box([0, -.11, -.045], [.07, .035, .025]);
    }
    else {
        const shotgun = type === 'shotgun', mp5 = type === 'mp5', ak = type === 'ak' || type === 'akm';
        box([0, 0, .035], [mp5 ? .075 : .092, .115, shotgun ? .25 : .34], metal);
        if (ak) {
            box([0, .072, .075], [.09, .022, .26], black);
            box([.049, -.006, .02], [.014, .022, .17], black);
            box([.066, .027, -.02], [.065, .017, .02], dark, [0,0,0], 'action');
        }
        if (type === 'ar') {
            box([0, .081, .025], [.08, .035, .34]);
            box([.059, 0, .03], [.025, .05, .075], dark, [0,0,0], 'action');
            box([0, -.08, -.02], [.09, .09, .11]);
        }
        if (mp5)
            cyl([0, .016, -.17], [.067, .33, .067], dark);
        cyl([0, .022, shotgun ? -.49 : mp5 ? -.32 : -.46], [shotgun ? .039 : .024, shotgun ? .75 : mp5 ? .4 : .65, shotgun ? .039 : .024], metal);
        if (shotgun)
            cyl([0, -.048, -.4], [.045, .65, .045]);
        else {
            box([0, .098, -.53], [.025, .11, .033]);
            box([0, .148, -.53], [.06, .025, .03]);
            box([0, .112, .07], [.055, .022, .035]);
        }
        box([0, -.11, .102], [.072, .06, .028]);
        box([0, -.139, .049], [.068, .02, .115]);
        box([0, -.095, .005], [.068, .07, .02]);
    }
    function module(i: Item, path: string, parent?: Vec3) {
        const m = CATALOG[i.def], shape = m.shape;
        let p: Vec3 = [0, 0, 0];
        const slot = path.split('.').pop()!;
        p = [...(layout.anchors[slot] || [0, 0, 0])];
        if (slot === 'optic' && parent) p = [parent[0], parent[1] + .07, parent[2] - .015];
        const reload = pose.reload || 0;
        if (slot === 'magazine' && reload > 0 && (pose.mode === 'swap' || pose.mode === 'range')) {
            p = p.map((v,k) => v + motion.magazine[k]) as Vec3;
        }
        if (slot === 'handguard' || (path.startsWith('handguard.') && slot !== 'optic')) p[2] += motion.pump;
        if (explode) {
            p = [p[0] + (slot === 'light' ? .25 : slot === 'laser' ? -.25 : 0) * explode, p[1] + (slot === 'optic' || slot === 'mount' ? .22 : slot === 'magazine' || slot === 'pistolgrip' || slot === 'grip' ? -.22 : 0) * explode, p[2] + (slot === 'stock' ? .22 : slot === 'muzzle' ? -.22 : 0) * explode];
        }
        // Canonical positive zero makes the completed reload frame identical to rest.
        socketFrames.set(path, { p: [...p], s: [1, 1, 1], r: [slot === 'magazine' ? motion.magazineAngle + 0 : 0, 0, 0] });
        const start = list.length, c = m.color;
        const b = (o: Vec3, s: Vec3, co = c, r: Vec3 = [0, 0, 0]) => box([p[0] + o[0], p[1] + o[1], p[2] + o[2]], s, co, r, path);
        const cy = (o: Vec3, s: Vec3, co = c, r: Vec3 = [Math.PI / 2, 0, 0]) => cyl([p[0] + o[0], p[1] + o[1], p[2] + o[2]], s, co, r, path);
        const extra = arsenalModuleModel(shape, c);
        if (extra) for (const q of extra) list.push({ ...q, p: q.p.map((v, k) => v + p[k]) as Vec3, slot: path });
        else if (shape.startsWith('stock')) {
            if (['stock_sks_wood','stock_sks_poly','stock_mosin_wood','stock_sv98'].includes(shape)) {
                const precision = shape === 'stock_sv98';
                b([0,-.055,.03],[precision ? .12 : .093,.16,.42],c,[-.15,0,0]);
                b([0,-.072,-.32],[.093,.09,precision ? .67 : .7]);
                b([0,-.03,.25],[.112,.23,.035],black);
                if (precision) {b([0,.075,.064],[.13,.055,.25]);b([0,-.11,-.10],[.07,.16,.09],c,[-.25,0,0]);b([0,-.10,-.7],[.1,.03,.09]);}
                if (shape === 'stock_mosin_wood') b([0,-.048,-.79],[.067,.056,.47]);
            }
            else if (['stock_wire','stock_wire_kedr','stock_wire_ar','stock_triangle','stock_cheek','stock_retract','stock_svd_wood'].includes(shape)) {
                const len = shape === 'stock_wire_kedr' ? .24 : .34;
                b([0,.053,0],[.028,.028,len]);
                if(shape === 'stock_retract') {b([.038,.03,0],[.014,.02,len]);b([-.038,.03,0],[.014,.02,len]);}
                else b([0,-.053,0],[.029,.027,len],c,[shape === 'stock_triangle' || shape === 'stock_svd_wood' ? .36 : .13,0,0]);
                b([0,-.025,len/2],[.073,.20,.031],black);
                if(shape === 'stock_cheek' || shape === 'stock_svd_wood')b([0,.072,.026],[.10,.042,.19]);
                if(shape === 'stock_svd_wood')b([0,-.077,-.14],[.075,.16,.065],c,[-.21,0,0]);
            }
            else if (shape === 'stock_crane') {cy([0,.035,-.06],[.04,.31,.04],metal);b([0,-.025,.04],[.1,.17,.26]);for(const x of [-.046,.046])cy([x,.07,.025],[.035,.26,.035]);b([0,-.025,.195],[.125,.24,.03],black);}
            else if (shape === 'stock_padded') {b([0,-.03,.045],[.11,.15,.35],c,[-.17,0,0]);b([0,-.035,.24],[.13,.24,.065],black);for(let n=0;n<5;n++)b([0,-.11+n*.04,.276],[.135,.019,.013],black);}
            else if (shape === 'stock_skeleton') {
                b([0, .05, 0], [.04, .035, .34]);
                b([0, -.055, 0], [.04, .035, .34], c, [.17, 0, 0]);
                b([0, -.015, .17], [.06, .19, .03]);
            }
            else if (shape === 'stock_precision') {
                cy([0, .04, -.05], [.045, .27, .045], metal);
                b([0, 0, .035], [.085, .14, .31]);
                b([0, .095, .055], [.09, .03, .19]);
                b([0, -.11, .055], [.075, .08, .085]);
                b([0, 0, .215], [.1, .23, .03], black);
            }
            else if (shape === 'stock_telescopic' || shape === 'stock_compact') {
                cy([0, .032, -.07], [.036, .3, .036], metal);
                b([0, 0, .025], [.082, .13, shape === 'stock_compact' ? .19 : .26]);
                b([0, -.02, .16], [.1, .22, .03], black);
                b([0, -.055, -.06], [.07, .04, .11]);
            }
            else {
                b([0, -.04, .02], [.085, .15, .33], c, [-.12, 0, 0]);
                b([0, -.024, .19], [.105, .22, .025], black);
            }
        }
        else if (shape.startsWith('guard') || shape === 'pump_wood') {
            const len = shape.includes('mini') ? .18 : shape === 'guard_416' ? .48 : shape === 'guard_416_short' ? .29 : shape.includes('svd') ? .39 : shape === 'guard_mp153' ? .36 : shape === 'guard_long' ? .44 : shape === 'guard_short' ? .23 : type === 'mp5' ? .21 : .28;
            if (shape === 'guard_round' || shape === 'guard_octagon')
                cy([0, 0, 0], [.12, len, .12]);
            else
                b([0, 0, 0], [.115, .115, len]);
            if (shape.includes('rail') || ['guard_long','guard_short','guard_416','guard_416_short','guard_vent','guard_octagon'].includes(shape)) {
                for (let z = -len / 2; z < len / 2; z += .038) {
                    b([0, .065, z], [.13, .012, .018], metal);
                    b([.06, 0, z], [.012, .055, .022], black);
                    b([-.06, 0, z], [.012, .055, .022], black);
                }
            }
            else
                for (let z = -len / 2 + .015; z < len / 2; z += .037)
                    b([0, -.06, z], [.115, .009, .008], black);
        }
        else if (shape.startsWith('grip')) {
            const width = shape === 'grip_grach' ? .085 : shape === 'grip_kedr' ? .054 : .065;
            b([0, -.035, 0], [width, shape === 'grip_tt' ? .16 : .19, shape === 'grip_kedr' ? .07 : .095], c, [shape === 'grip_vertical' ? 0 : -.22, 0, 0]);
            if (shape === 'grip_palm') b([0,-.145,0],[.1,.031,.11]);
            if (shape === 'grip_wrap' || shape === 'grip_tt') for(let y=-.1;y<.04;y+=.025)b([0,y,-.048],[width+.006,.013,.012],black);

            if (shape === 'grip_ergo' || shape === 'grip_rubber')
                for (let y = -.105; y < .02; y += .027)
                    b([0, y, -.05], [.068, .012, .009], black);
        }
        else if (shape.startsWith('mount')) {
            b([0, .015, 0], [.10, .025, .25], metal);
            if (shape === 'mount_side') {
                b([-.069, -.06, .03], [.028, .145, .11]);
                b([-.03, .012, .03], [.085, .022, .1]);
            }
            else {
                b([-.045, -.02, 0], [.014, .04, .19]);
                b([.045, -.02, 0], [.014, .04, .19]);
            }
        }
        else if (shape.startsWith('optic')) {
            b([0, .002, 0], [.073, .035, .12], black);
            if (['optic_scope','optic_long','optic_tube','optic_prism'].includes(shape)) {
                const length = shape === 'optic_long' ? .43 : shape === 'optic_tube' ? .15 : shape === 'optic_prism' ? .2 : .285;
                if(shape === 'optic_prism') b([0,.07,0],[.095,.08,.17]);
                cy([0, .07, 0], [.074, length, .074]);
                cy([0, .07, -(shape === 'optic_long' ? .23 : shape === 'optic_tube' ? .09 : .155)], [.082, .035, .082], metal);
                cy([0, .07, .14], [.068, .018, .068], rgb('#245854'));
                b([0, .115, 0], [.033, .06, .04]);
            }
            else {
                const size = shape === 'optic_holo' ? .1 : .065;
                b([-.04, .06, -.015], [.012, size, .08]);
                b([.04, .06, -.015], [.012, size, .08]);
                b([0, .06 + size / 2, -.015], [.092, .012, .08]);
                b([0, .034, -.05], [.058, .022, .011], rgb('#246363'));
            }
        }
        else if (shape.startsWith('fore')) {
            if (shape === 'fore_bail') { b([0,0,0],[.065,.02,.13]);b([0,-.09,0],[.052,.02,.12]);for(const z of [-.052,.052])b([0,-.045,z],[.055,.10,.02]); }
            else if(shape === 'fore_stub') {cy([0,-.055,0],[.07,.11,.07],c,[0,0,0]);b([0,-.115,0],[.08,.018,.08]);}
            else if (shape === 'fore_angled') {
                b([0, -.045, .015], [.06, .07, .16], c, [-.3, 0, 0]);
                b([0, -.07, .07], [.06, .095, .035]);
            }
            else if (shape === 'fore_stop')
                b([0, -.02, 0], [.055, .055, .065]);
            else {
                b([0, -.07, 0], [.055, .18, .065]);
                b([0, -.153, 0], [.072, .015, .075]);
            }
        }
        else if (shape.startsWith('light')) {
            if(shape === 'light_pistol')b([0,0,.006],[.07,.047,.09]);
            cy([0, 0, 0], [.045, shape === 'light_pistol' ? .10 : .16, .045], metal);
            if(shape === 'light_wide')cy([0,0,-.07],[.077,.054,.077],metal);
            cy([0, 0, -.088], [.05, .016, .05], rgb('#f8e8be'));
        }
        else if (shape.startsWith('laser')) {
            b([0, 0, 0], [shape === 'laser_dual' ? .09 : .055, .045, .085]);
            if(shape === 'laser_dual')cy([.03,0,-.052],[.012,.014,.012],rgb('#fa5746'));
            cy([0, 0, -.052], [.01, .014, .01], rgb('#fa5746'));
        }
        else if (shape.startsWith('mag')) {
            if (shape === 'mag_drum') {
                cy([0, -.005, 0], [.21, .12, .21], c, [0, 0, Math.PI / 2]);
                b([0, .11, 0], [.078, .14, .065]);
            }
            else if (['mag_pistol','mag_tt','mag_glock','mag_glock_long','mag_grach','mag_kedr_short','mag_kedr_long'].includes(shape)) {
                const len = shape.includes('long') ? .27 : shape === 'mag_kedr_short' ? .20 : shape === 'mag_grach' ? .17 : .13;
                b([0, -.04, 0], [shape.includes('glock') ? .06 : .055, len, .075], c, [-.2, 0, 0]);
                b([0, -.04-len/2, .012], [.068, .015, .1], black);
            }
            else {
                const len = ['mag_svd','mag_sv98','mag_ak_short','mag_ar_short','mag_smg_short','mag_shotgun_short'].includes(shape) ? .145 : shape === 'mag_shotgun' ? .31 : shape === 'mag_long' ? .33 : shape === 'mag_smg' ? .29 : .24, curve = shape === 'mag_banana' || shape === 'mag_ak_short' ? .8 : shape === 'mag_curved' || shape === 'mag_long' ? .38 : .05;
                for (let n = 0; n < 5; n++) {
                    const y = .09 - n * len / 5, z = -curve * (n / 5) ** 2 * .15;
                    b([0, y, z], [shape.includes('shotgun') ? .087 : .065, len / 5 + .008, shape.includes('smg') ? .06 : shape.includes('shotgun') ? .13 : .095], c, [curve * n / 5, 0, 0]);
                    b([.034, y, z], [.007, len / 5 * .8, .055], black, [curve * n / 5, 0, 0]);
                }
            }
        }
        else if (shape === 'muzzle_suppressor' || shape === 'muzzle_short_can') {
            cy([0, 0, -.065], [.06, shape === 'muzzle_short_can' ? .14 : .23, .06]);
            cy([0, 0, -.186], [.04, .006, .04], black);
        }
        else if (shape === 'muzzle_cone') { list.push(part('cone',[p[0],p[1],p[2]-.02],[.057,.1,.057],c,[Math.PI/2,0,0],path)); }
        else if (shape === 'muzzle_brake' || shape === 'muzzle_ported') {
            cy([0, 0, -.01], [shape === 'muzzle_ported' ? .05 : .038, shape === 'muzzle_ported' ? .14 : .088, .038]);
            if(shape === 'muzzle_ported')for(const z of [-.055,.006])b([0,0,z],[.065,.056,.026]);
            for (let z = -.03; z < .03; z += .025)
                b([.022, 0, z], [.01, .04, .012], black);
        }
        if (shape === 'stock_solid_short' || shape === 'mount_short') for (let n = start; n < list.length; n++) {
            list[n].p[2] = p[2] + (list[n].p[2] - p[2]) * .73; list[n].s[2] *= .73;
        }
        if (shape === 'mount_sks') b([0,.017,.03],[.12,.037,.29],metal);
        if (shape.startsWith('guard') && (shape.includes('416') || shape === 'guard_vent' || shape.includes('svd'))) {
            for (const x of [-.059,.059]) for (let z=-.12;z<.13;z+=.045) b([x,.025,z],[.009,.037,.026],black);
        }
        if (slot === 'magazine' && motion.magazineAngle) for (let n=start;n<list.length;n++) {
            const q=list[n],dy=q.p[1]-p[1],dz=q.p[2]-p[2],a=motion.magazineAngle;
            q.p[1]=p[1]+dy*Math.cos(a)-dz*Math.sin(a);q.p[2]=p[2]+dy*Math.sin(a)+dz*Math.cos(a);q.r[0]+=a;
        }
        if (path === selected)
            for (let n = start; n < list.length; n++) {
                list[n].c = list[n].c.map((v, k) => v * .55 + [.67, .82, .52][k] * .45) as Color;
                list[n].emissive = .1;
            }
        for (const [id, child] of Object.entries(i.children))
            module(child, path + '.' + id, p);
    }
    for (const [slot, i] of Object.entries(presentation.children))
        module(i, slot);
    for (const q of list) if (q.slot === 'action') q.p[2] += motion.bolt;
    // AKM and AK-74M are two gameplay platforms sharing one authored body.
    // Referencing the common id also keeps one GLB container in the renderer.
    const assetId = presentation.def === 'weapon_akm' || presentation.def === 'weapon_ak74m' ? 'weapon_ak_common' : presentation.def;
    const resolveAsset = (path: string) => {
        const item = path === 'body' || path === 'action' ? undefined : getNode(presentation, path);
        const independent = item && MODULE_MODEL_ASSETS[item.def];
        if (independent) return { id: independent.asset, group: independent.group, independent: true };
        const group = path === 'body' || path === 'action' ? path : path.replaceAll('.', '_') + '__' + item?.def;
        return MODEL_ASSETS[assetId]?.groups.includes(group) ? { id: assetId, group, independent: false } : undefined;
    };
    {
        const seen = new Set<string>();
        for (const part of list) {
            const path = part.slot || 'body';
            const source = resolveAsset(path);
            if (!source) continue;
            const key = path + '/' + source.id + '/' + source.group;
            part.asset = { weapon: source.id, group: source.group, first: !seen.has(key) };
            if (source.independent || MODEL_ASSETS[source.id]?.frame === 'meters') part.asset.transform = socketFrames.get(path);
            seen.add(key);
        }
        for (const [path, transform] of socketFrames) {
            const source = resolveAsset(path);
            if (!source || (!source.independent && MODEL_ASSETS[source.id]?.frame !== 'meters')) continue;
            const key = path + '/' + source.id + '/' + source.group;
            if (seen.has(key)) continue;
            // Some old platforms have no separate action primitive. Its authored
            // group must still animate without inventing visible fallback geometry.
            list.push({ ...part('box', [0, 0, 0], [1, 1, 1], dark, [0, 0, 0], path), assetOnly: true, asset: { weapon: source.id, group: source.group, first: true, transform } });
            seen.add(key);
        }
    }
    return list;
}

export function characterModel(c: Character, time = 0, moving = 0, dead = false, crouch = false, equipment?: Pick<Equipment, 'armor' | 'helmet'>, presentation: HeldWeaponPresentation = {}): Part[] {
    return characterAppearanceModel(c, time, moving, dead, crouch, equipment, presentation);
}
function rawLootModel(item: Item): Part[] {
    const d = CATALOG[item.def];
    if (d.category === 'armor') return equipmentAppearanceModel(item);
    if (d.category === 'weapon')
        return weaponModel(item).map(p => ({ ...p, s: p.s.map(v => v * .8) as Vec3, p: p.p.map(v => v * .8) as Vec3,
            asset: p.asset?.transform ? { ...p.asset, transform: { ...p.asset.transform, p: p.asset.transform.p.map(v => v * .8) as Vec3, s: p.asset.transform.s.map(v => v * .8) as Vec3 } } : p.asset }));
    if (d.category === 'module') {
        const key = d.interface?.endsWith('-stock') ? 'stock' : d.interface?.endsWith('-handguard') ? 'handguard' : d.interface?.endsWith('-mag') ? 'magazine' : d.interface?.endsWith('-mount') ? 'mount' : d.interface?.endsWith('-muzzle') ? 'muzzle' : d.interface === 'rail-optic' ? 'optic' : d.interface === 'rail-grip' ? 'grip' : d.shape.startsWith('light') ? 'light' : d.shape.startsWith('laser') ? 'laser' : 'pistolgrip';
        const parts = weaponModel({id:'icon',def:'weapon_ak74m',qty:1,condition:100,rounds:0,children:{[key]:item}}).filter(p=>p.slot===key);
        const anchor=weaponLayout('ak').anchors[key] || [0,0,0];
        return parts.map(p=>({...p,p:p.p.map((v,k)=>v-anchor[k]) as Vec3,
            ...(p.asset?.transform?{asset:{...p.asset,transform:{...p.asset.transform,p:p.asset.transform.p.map((v,k)=>v-anchor[k]) as Vec3}}}:{})}));
    }
    return lootGeometry(d);
}

const lootCache = new Map<string,Part[]>();
const meshCache = new Map<string,Float32Array>();
export function lootModel(item:Item):Part[] {
    const key=JSON.stringify([item.def,Object.entries(item.children).map(([k,v])=>[k,v.def,v.children])]);
    const cached=lootCache.get(key); if(cached) return cached;
    const parts=rawLootModel(item); let bottom=Infinity;
    for(const p of parts){
        if(p.assetOnly)continue;
        let vertices=meshCache.get(p.shape);if(!vertices){vertices=geometry(p.shape).vertices;meshCache.set(p.shape,vertices);}
        const matrix=model(p.p,p.s,p.r);
        for(let i=0;i<vertices.length;i+=6)bottom=Math.min(bottom,transform(matrix,[vertices[i],vertices[i+1],vertices[i+2]])[1]);
    }
    const lift=Number.isFinite(bottom)?-bottom:0;
    const grounded=parts.map(p=>({...p,p:[p.p[0],p.p[1]+lift,p.p[2]] as Vec3,
        asset:p.asset?.transform?{...p.asset,transform:{...p.asset.transform,p:[p.asset.transform.p[0],p.asset.transform.p[1]+lift,p.asset.transform.p[2]] as Vec3}}:p.asset}));
    if(lootCache.size>=256)lootCache.delete(lootCache.keys().next().value!);lootCache.set(key,grounded);return grounded;
}
export function mapModel(map: MapDef): Part[] {
    const parts: Part[] = [part('box', [0, -.14, 0], [...map.size.slice(0, 1), .28, map.size[1]] as Vec3, map.ground)];
    parts[0].surface = ['park','village'].includes(map.id) ? 'soil' : 'asphalt';
    const random = rng(606);
    parts[0].material = ['park','village'].includes(map.id) ? 6 : 4;
    for (const b of map.boxes) {
        if (b.kind === 'collision-only') continue;
        if(b.kind==='grass') {
            parts.push({...part('plane',b.p,b.s,b.color,b.rotation),surface:'grass',babylonOnly:true});
            continue;
        }
        if (b.kind === 'tree') {
            parts.push({...part('cone',b.p,b.s,b.color),legacyOnly:true});
            const broad=b.color[0]>.3, layers=broad?3:5;
            for(let layer=0;layer<layers;layer++) for(let face=0;face<3;face++) {
                const t=layer/layers, width=b.s[0]*(broad?1.25:1.35-t*.83);
                parts.push({...part('plane',[b.p[0],b.p[1]-b.s[1]*.33+t*b.s[1]*.72,b.p[2]],
                    [width,b.s[1]*(broad?.64:.48),1],[.85,.9,.78],[0,face*Math.PI/3+layer*.71,0]),surface:broad?'leaves':'pine',babylonOnly:true});
            }
            continue;
        }
        if(b.kind==='log') {
            parts.push({...part('cylinder',b.p,[b.s[0],b.s[2],b.s[1]],b.color,[Math.PI/2,0,0]),surface:'bark'});
            continue;
        }
        if (b.kind === 'gable') {
            for(const side of [-1,1]) parts.push({...part('wedge',[b.p[0],b.p[1],b.p[2]+side*b.s[2]/4],[b.s[0],b.s[1],b.s[2]/2],b.color,[0,side===1?Math.PI:0,0]),surface:'wood'});
            continue;
        }
        let shape: Part['shape'] = 'box';
        if (b.kind === 'trunk' || b.kind === 'barrel' || b.kind === 'pipe' || b.kind === 'pole' || b.kind === 'log' || b.kind === 'tank')
            shape = 'cylinder';
        if (b.kind === 'canopy' || b.kind === 'tree')
            shape = 'cone';
        if (b.kind === 'ramp')
            shape = 'wedge';
        const material = b.kind==='wall' ? (b.color[0]>b.color[1]*1.08 ? 1:2) : ['crate','pallet','bench','fence','table'].includes(b.kind)?3:['road','walk'].includes(b.kind)?4:b.kind==='tile'?5:['floor','ramp'].includes(b.kind)?2:0;
        const surface = b.kind === 'trunk' ? 'bark' : ['timber-wall','fence','timber-stack','boardwalk','crate','pallet','bench','table','counter','window-frame','log'].includes(b.kind) ? 'wood'
            : ['dirt','path','soil'].includes(b.kind) ? 'soil' : ['road','walk'].includes(b.kind) ? 'asphalt'
            : b.kind === 'wall' ? (material===1?'brick':'concrete') : ['floor','ramp','road-barrier'].includes(b.kind) ? 'concrete'
            : ['container','roof','cabinet'].includes(b.kind) ? 'metal' : undefined;
        parts.push({...part(shape,b.p,b.s,b.color,b.rotation || [0,0,0]),material,surface});
        if(b.kind==='trunk') {
            for(let n=0;n<5;n++) {
                const angle=random()*Math.PI*2, radius=1+random()*3;
                const p:Vec3=[b.p[0]+Math.cos(angle)*radius,.38,b.p[2]+Math.sin(angle)*radius];
                parts.push({...part('plane',p,[1.6,.76,1],[.83,.87,.7],[0,angle,0]),surface:'grass',babylonOnly:true});
            }
        }
        if (b.kind === 'machine') {
            parts.push(part('cylinder', [b.p[0], b.p[1] + b.s[1] / 2 + .2, b.p[2]], [b.s[0] * .6, .4, b.s[2] * .6], metal));
            parts.push(part('box', [b.p[0], b.p[1], b.p[2] + b.s[2] / 2 + .02], [b.s[0] * .7, .35, .06], dark));
        }
        if (b.kind === 'crate' || b.kind === 'pallet') {
            for (const x of [-.32, .32])
                parts.push(part('box', [b.p[0] + b.s[0] * x, b.p[1] + .01, b.p[2]], [.07, b.s[1] + .04, b.s[2] + .04], wood));
        }
        if (b.kind === 'car' || b.kind === 'truck') {
            const s = b.s;
            parts.push(part('box', [b.p[0], b.p[1] + s[1] * .6, b.p[2]], [s[0] * .8, s[1] * .45, s[2] * .45], rgb('#435b62')));
            for (const x of [-1, 1])
                for (const z of [-1, 1])
                    parts.push(part('cylinder', [b.p[0] + x * s[0] * .48, .4, b.p[2] + z * s[2] * .31], [.7, .25, .7], black, [0, 0, Math.PI / 2]));
        }
    }
    return parts;
}
