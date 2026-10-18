import type { Item, Vec3 } from './types.js';
import { CATALOG } from '../content/catalog.js';
import { weaponLayout, weaponSightHeight } from '../content/weapon-layouts.js';
import { direction } from './util.js';
export const VIEW_WEAPON_OFFSET: Vec3 = [.25, -.28, -.69];
const GLOCK_VIEW_WEAPON_OFFSET: Vec3 = [.25, -.28, -.55];

/** Glock's compact slide stays closer to the camera without changing its mesh. */
export function viewWeaponOffset(gun: Item): Vec3 {
    return gun.def === 'weapon_glock17' ? GLOCK_VIEW_WEAPON_OFFSET : VIEW_WEAPON_OFFSET;
}
/** Uses the same steady view-model offset/anchors as Renderer, not a universal muzzle distance. */
export function muzzlePoint(gun:Item,eye:Vec3,yaw:number,pitch:number,aim:boolean):Vec3 {
    const shape=weaponLayout(CATALOG[gun.def].shape);
    const optic=gun.children.optic || gun.children.mount?.children.optic;
    const height=weaponSightHeight(shape,!!optic,!!gun.children.mount?.children.optic);
    const muzzle=gun.children.muzzle && CATALOG[gun.children.muzzle.def].shape;
    const extension=muzzle==='muzzle_suppressor'?.20:muzzle==='muzzle_short_can'?.13:0;
    const x=aim?0:VIEW_WEAPON_OFFSET[0],y=(aim?-height:VIEW_WEAPON_OFFSET[1])+shape.muzzle[1],length=-VIEW_WEAPON_OFFSET[2]-shape.muzzle[2]+extension;
    const forward=direction(yaw,pitch),right:Vec3=[Math.cos(yaw),0,-Math.sin(yaw)],up:Vec3=[Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)];
    return eye.map((n,i)=>n+forward[i]*length+right[i]*x+up[i]*y) as Vec3;
}
