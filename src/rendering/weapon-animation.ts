import type { CharacterJoint, Color, Item, ModelSocketTransform, Part, Vec3 } from '../domain/types.js';
import { CATALOG } from '../content/catalog.js';
import { detachable } from '../domain/ammunition.js';
import { weaponLayout } from '../content/weapon-layouts.js';
import { clamp, lerp, rgb } from '../domain/util.js';
import { AKMN_PRESENTATION, usesAKMNAsset } from '../content/akmn-asset.js';
import { appearancePalette, camouflage, type Appearance } from '../content/apparel.js';
import { model, transform } from './math.js';
import { CHARACTER_MODEL_ASSETS } from '../content/character-model-assets.js';
import { bindCharacterAssets, type RigidCharacterPart } from './character-asset-binding.js';

export interface WeaponPose { reload?: number; mode?: string; shotAge?: number; inspect?: number; empty?: boolean; }
export interface AnimationProfile {
    style: 'rock' | 'straight' | 'pistol' | 'tube' | 'top' | 'bolt' | 'bullpup';
    reach: number; roll: number; lift: number; bolt: number; cycle: number;
    pump?: number; handle?: Vec3; chargingHand?: 'left' | 'right';
}
/** Authored game animation profiles, not real firearm training or assembly instructions. */
export const ANIMATIONS: Record<string, AnimationProfile> = {
    weapon_ak74m:{style:'rock',reach:.25,roll:-.32,lift:.12,bolt:.065,cycle:.14},
    weapon_akm:{style:'rock',reach:.28,roll:-.39,lift:.10,bolt:.07,cycle:.15},
    weapon_aks74u:{style:'rock',reach:.22,roll:-.28,lift:.15,bolt:.06,cycle:.13},
    weapon_ak103:{style:'rock',reach:.27,roll:-.36,lift:.11,bolt:.068,cycle:.15},
    weapon_m4a1:{style:'straight',reach:.24,roll:-.26,lift:.12,bolt:.045,cycle:.12},
    weapon_hk416a5:{style:'straight',reach:.25,roll:-.31,lift:.10,bolt:.05,cycle:.115},
    weapon_pp1901:{style:'rock',reach:.23,roll:-.32,lift:.14,bolt:.052,cycle:.12},
    weapon_pp91:{style:'pistol',reach:.20,roll:-.35,lift:.16,bolt:.035,cycle:.10},
    weapon_mp5:{style:'straight',reach:.29,roll:-.40,lift:.15,bolt:.06,cycle:.12},
    weapon_pm:{style:'pistol',reach:.18,roll:-.23,lift:.06,bolt:.041,cycle:.13},
    weapon_tt:{style:'pistol',reach:.20,roll:-.27,lift:.08,bolt:.047,cycle:.15},
    weapon_glock17:{style:'pistol',reach:.23,roll:-.21,lift:.06,bolt:.04,cycle:.12},
    weapon_mp443:{style:'pistol',reach:.22,roll:-.30,lift:.07,bolt:.048,cycle:.14},
    weapon_sks:{style:'top',reach:.19,roll:-.25,lift:.13,bolt:.07,cycle:.15},
    weapon_mosin9130:{style:'top',reach:.21,roll:-.39,lift:.14,bolt:.10,cycle:.72},
    weapon_svd:{style:'rock',reach:.26,roll:-.38,lift:.10,bolt:.08,cycle:.16},
    weapon_sv98:{style:'bolt',reach:.23,roll:-.36,lift:.11,bolt:.10,cycle:.68},
    weapon_mp133:{style:'tube',reach:.20,roll:.40,lift:.18,bolt:.11,cycle:.50,pump:.11},
    weapon_mp153:{style:'tube',reach:.18,roll:.33,lift:.16,bolt:.06,cycle:.16},
    weapon_saiga12k:{style:'rock',reach:.32,roll:-.44,lift:.10,bolt:.075,cycle:.16},
    weapon_ak12:{style:'rock',reach:.265,roll:-.34,lift:.11,bolt:.065,cycle:.135,handle:[.075,.054,-.015]},
    weapon_rpk74m:{style:'rock',reach:.35,roll:-.43,lift:.09,bolt:.075,cycle:.15,handle:[.073,.054,-.02]},
    weapon_asval:{style:'rock',reach:.22,roll:-.30,lift:.15,bolt:.057,cycle:.11,handle:[.07,.065,-.055]},
    weapon_vss:{style:'rock',reach:.19,roll:-.35,lift:.12,bolt:.057,cycle:.125,handle:[.07,.065,-.055]},
    weapon_g36k:{style:'straight',reach:.27,roll:-.33,lift:.105,bolt:.042,cycle:.125,handle:[-.05,.15,-.025]},
    weapon_scarl:{style:'straight',reach:.26,roll:-.27,lift:.10,bolt:.062,cycle:.14,handle:[-.085,.07,-.10]},
    weapon_auga3:{style:'bullpup',reach:.26,roll:.27,lift:.12,bolt:.05,cycle:.13,handle:[-.09,.10,-.15]},
    weapon_mcxspearlt:{style:'straight',reach:.25,roll:-.29,lift:.13,bolt:.043,cycle:.12,handle:[-.015,.12,.18]},
    weapon_bren2:{style:'straight',reach:.23,roll:-.35,lift:.135,bolt:.049,cycle:.13,handle:[-.082,.07,-.085]},
    weapon_scorpion:{style:'straight',reach:.245,roll:-.39,lift:.16,bolt:.035,cycle:.10,handle:[-.075,.10,-.085]},
    weapon_mpx:{style:'straight',reach:.22,roll:-.24,lift:.14,bolt:.037,cycle:.11,handle:[-.012,.10,.135]},
    weapon_m9a3:{style:'pistol',reach:.21,roll:-.28,lift:.08,bolt:.047,cycle:.14,handle:[-.043,.08,.035]},
    weapon_m17:{style:'pistol',reach:.195,roll:-.24,lift:.07,bolt:.044,cycle:.125,handle:[-.048,.08,.031]},
    weapon_rem870:{style:'tube',reach:.205,roll:.36,lift:.17,bolt:.096,cycle:.49,pump:.12,handle:[-.05,-.11,-.32]},
    weapon_benellim4:{style:'tube',reach:.19,roll:.31,lift:.16,bolt:.062,cycle:.16,handle:[.079,.037,.022],chargingHand:'right'},
    weapon_m14:{style:'rock',reach:.26,roll:-.42,lift:.105,bolt:.078,cycle:.17,handle:[.073,.043,.025],chargingHand:'right'}
};
export const animationProfile = (gun: Item) => ANIMATIONS[gun.def] || ANIMATIONS.weapon_ak74m;
const smooth = (t: number) => { t=clamp(t,0,1); return t*t*(3-2*t); };
const pulse = (t:number) => t<=0 || t>=1 ? 0 : Math.sin(t*Math.PI);
const between = (t:number,a:number,b:number) => smooth((t-a)/(b-a));
const mix = (a:Vec3,b:Vec3,t:number):Vec3 => a.map((n,i)=>lerp(n,b[i],t)) as Vec3;
export interface Motion { magazine: Vec3; magazineAngle: number; left: Vec3; right: Vec3; body: Vec3; rotation: Vec3; bolt: number; pump: number; round: boolean; }
export function weaponMotion(gun: Item, pose: WeaponPose = {}): Motion {
    const profile = animationProfile(gun), layout = weaponLayout(CATALOG[gun.def].shape);
    const t=clamp(pose.reload || 0,0,1), inspect=clamp(pose.inspect || 0,0,1);
    const envelope = between(t,0,.12)*(1-between(t,.87,1));
    const isSwap = pose.mode === 'swap' || (pose.mode === 'range' && detachable(gun));
    const out = between(t,.16,.39)*(1-between(t,.58,.82));
    const rock = profile.style === 'rock', bullpup = profile.style === 'bullpup';
    const magazine:Vec3 = isSwap ? [(bullpup?-.11:-.14)*out,-profile.reach*out,(bullpup?.10:rock?.08:.025)*out] : [0,0,0];
    // The preserved Glock mesh has a shorter grip than the historical box recipe.
    // Contact targets follow its measured runtime mesh, while attachment matrices
    // remain stable for the GLB normalization and magazine animation.
    const importedGlock = gun.def === 'weapon_glock17';
    const mag: Vec3 = importedGlock ? [0,-.066,.05] : layout.anchors.magazine || [0,-.18,.05];
    const support: Vec3 = importedGlock ? [-.036,-.079,.045] : layout.support;
    let left:Vec3 = [...support];
    let right:Vec3 = importedGlock ? [.042,-.062,.052] : [layout.anchors.pistolgrip[0]+.055,layout.anchors.pistolgrip[1]-.015,layout.anchors.pistolgrip[2]];
    if (isSwap) left=mix(left,[mag[0]+magazine[0]-.06,mag[1]+magazine[1]-.025,mag[2]+magazine[2]],envelope);
    const loading = pose.mode === 'rounds' || pose.mode === 'pack' || (!isSwap && pose.mode === 'range');
    if (loading) {
        const top=profile.style==='top', point:Vec3=top?[-.055,.12,.01]:[-.045,-.17,.07];
        const approach:Vec3=[-.21,-.32,.22];
        left=mix(support,mix(approach,point,between(t,.10,.40)*(1-between(t,.7,.95))),envelope);
    }
    const rack = pose.mode==='charge' ? pulse(t) : pose.empty && isSwap ? pulse(between(t,.82,1)) : 0;
    if (rack > 0) {
        const handle = profile.handle || [-.025,.10,.08];
        const reach:Vec3 = [handle[0],handle[1],handle[2]+profile.bolt*rack];
        if (profile.chargingHand === 'right') right=mix(right,reach,rack);
        else left=mix(left,reach,rack);
    }
    const age=Math.max(0,pose.shotAge ?? 100), cycle=age<profile.cycle?Math.sin(age/profile.cycle*Math.PI):0;
    const pump=profile.pump || 0;
    if(pump && !t) left[2]+=cycle*pump;
    const inspection=pulse(inspect);
    return {
        magazine,magazineAngle:isSwap ? (bullpup?.15*out:rock?-.42*out:profile.style==='pistol'?.08*out:0) : 0,left,right,
        body:[-.055*envelope,(profile.lift+.07)*envelope,-.32*envelope-.04*inspection],
        rotation:[.16*envelope,.48*envelope+.45*inspection,profile.roll*envelope+.62*inspection],
        bolt:Math.max(cycle,rack)*profile.bolt,pump:cycle*pump,
        round:loading && t>.3 && t<.73
    };
}

/** Brief authored muzzle geometry; it changes appearance only, never the hit result. */
export function muzzleFlashModel(gun: Item, shotAge: number, suppressed = false): Part[] {
    const lifetime = suppressed ? .04 : .075;
    if (!Number.isFinite(shotAge) || shotAge < 0 || shotAge >= lifetime) return [];
    const layout = weaponLayout(CATALOG[gun.def].shape);
    const muzzle = gun.children.muzzle && CATALOG[gun.children.muzzle.def].shape;
    const extension = muzzle === 'muzzle_suppressor' ? .20 : muzzle === 'muzzle_short_can' ? .13 : 0;
    const size = (suppressed ? .28 : 1) * (1 - shotAge / lifetime * .45);
    const muzzleAnchor = usesAKMNAsset(gun) ? AKMN_PRESENTATION.muzzle : layout.muzzle;
    const p: Vec3 = [muzzleAnchor[0], muzzleAnchor[1], muzzleAnchor[2] - extension - .055 * size];
    return [
        { shape: 'sphere', p, s: [.085 * size, .065 * size, .15 * size], r: [0, 0, 0], c: [1, .58, .19], emissive: 1.3 },
        { shape: 'cone', p: [p[0], p[1], p[2] - .09 * size], s: [.11 * size, .19 * size, .045 * size], r: [-Math.PI / 2, 0, .3], c: [1, .86, .48], emissive: 1.6 }
    ];
}
function segment(a: Vec3,b: Vec3,radius:number,c:Color): Part {
    const d=b.map((v,i)=>v-a[i]) as Vec3, length=Math.max(.001,Math.hypot(...d));
    return {shape:'box',p:mix(a,b,.5),s:[radius,radius,length],r:[-Math.asin(clamp(d[1]/length,-1,1)),Math.atan2(d[0],d[2]),0],c};
}
/** Explicit two-segment arms, cuffs, palms and fingers. Coordinates share weapon anchors. */
export function handsModel(gun:Item,pose:WeaponPose={},outfit=0,face=0,appearance?:Appearance):Part[] {
    const m=weaponMotion(gun,pose),skin=rgb(['#b18e70','#d2ae8a','#b9947b','#c5a18d','#977457','#d2b093'][face%6]);
    const palette=appearancePalette({faction:'BEAR',outfit,appearance}), cloth=palette.sleeve;
    const glove=palette.appearance.gloves==='gloves_none'?skin:palette.gloves;
    const fingers=['gloves_none','gloves_fingerless'].includes(palette.appearance.gloves)?skin:glove;
    const camo=camouflage(palette.appearance.jacketCamo);
    const list:Part[]=[];
    const authored = !!(CHARACTER_MODEL_ASSETS.body || CHARACTER_MODEL_ASSETS[palette.appearance.jacket] || CHARACTER_MODEL_ASSETS[palette.appearance.gloves]);
    const bound: RigidCharacterPart[] = [], frames = new Map<CharacterJoint, ModelSocketTransform>();
    const record = (start: number, joint: CharacterJoint, layer: 'jacket' | 'hand') => {
        if (!authored) return;
        for (let i = start; i < list.length; i++) { list[i].slot = `${layer}:fp:${joint}:${i - start}`; bound.push({ joint, part: list[i] }); }
    };
    const jointFrame = (a: Vec3, b: Vec3, baseLength: number): ModelSocketTransform => {
        const d = b.map((n, k) => n - a[k]) as Vec3, length = Math.max(.001, Math.hypot(...d));
        return { p: [...a], s: [1, length / baseLength, 1], r: [Math.atan2(-d[2], -d[1]), 0, Math.asin(clamp(d[0] / length, -1, 1))] };
    };
    const sleeve=(a:Vec3,b:Vec3,radius:number,seed:number)=>{
        const arm=segment(a,b,radius,cloth); arm.fabric=camo.id; arm.fabricSize=[radius,radius,.32]; list.push(arm);
        if(camo.colors.length<2) return;
        const matrix=model(arm.p,[1,1,1],arm.r);
        // Marks use the arm's local frame so reloads never leave floating camouflage.
        for(let n=0;n<10;n++){
            const top=n%2===0, width=radius*(camo.pattern==='digital'?.36:.65);
            const local:Vec3=[top?((n%3)-1)*radius*.19:radius*.507,top?radius*.507:((n%3)-1)*radius*.19,(n/10-.45)*arm.s[2]];
            list.push({legacyOnly:true,shape:'box',p:transform(matrix,local),s:top?[width,.002,arm.s[2]*.14]:[.002,width,arm.s[2]*.14],r:[...arm.r],c:camo.colors[1+(n+seed)%(camo.colors.length-1)]});
        }
    };
    for(const [side,wrist] of [[1,m.right],[-1,m.left]] as const) {
        const elbow:Vec3=[side*.25,-.32,.35],shoulder:Vec3=[side*.31,-.45,.65];
        const upper: CharacterJoint = side === 1 ? 'upperR' : 'upperL', fore: CharacterJoint = side === 1 ? 'foreR' : 'foreL';
        let start = list.length;
        sleeve(shoulder,elbow,.13,side===1?0:3); record(start, upper, 'jacket'); start = list.length;
        sleeve(elbow,wrist,.10,side===1?2:1); record(start, fore, 'jacket'); start = list.length;
        list.push({shape:'box',p:[...wrist],s:[.084,.065,.12],r:[-.12,side*.08,0],c:glove});
        list.push({shape:'box',p:[wrist[0],wrist[1]-.025,wrist[2]+.075],s:[.09,.045,.04],r:[0,0,0],c:skin});
        for(let n=0;n<4;n++)list.push({shape:'box',p:[wrist[0]-side*.032,wrist[1]-.026,wrist[2]-.037+n*.023],s:[.043,.032,.019],r:[0,0,side*.2],c:fingers});
        list.push({shape:'box',p:[wrist[0]-side*.045,wrist[1]+.022,wrist[2]+.022],s:[.026,.033,.065],r:[-.35,side*.4,0],c:fingers});
        record(start, fore, 'hand');
        if (authored) { frames.set(upper, jointFrame(shoulder, elbow, .285)); frames.set(fore, jointFrame(elbow, wrist, .289)); }
    }
    const round: Part[] = m.round ? [{shape:'cylinder',p:[m.left[0]+.04,m.left[1]+.015,m.left[2]-.025],s:[.023,.065,.023],r:[Math.PI/2,0,.3],c:rgb('#c2a369')}] : [];
    if (!authored) return [...list, ...round];
    const parts = bindCharacterAssets(bound, [
        { id: 'body', layer: 'body', skin, fabricColor: skin },
        { id: palette.appearance.jacket, layer: 'jacket', skin, fabric: camo.id, fabricColor: cloth },
        { id: palette.appearance.gloves, layer: 'gloves', skin, fabricColor: palette.gloves }
    ], palette.appearance.gloves !== 'gloves_none', ['upperL', 'upperR', 'foreL', 'foreR']);
    return [...parts.map(({ joint, part }) => part.asset?.kind === 'character' ? { ...part, asset: { ...part.asset, transform: frames.get(joint)! } } : part), ...round];
}
