import type { Item } from '../domain/types.js';
import { createItem, createWeapon, calculateStats } from '../domain/items.js';
import { CATALOG } from './catalog.js';
import { setLoadedRounds, detachable, magazineCapacity, chamberRound } from '../domain/ammunition.js';

/** Soviet designs already supported by the shared weapon/model/ammunition catalog. */
export const SCAV_WEAPONS = ['weapon_akm', 'weapon_sks', 'weapon_pm', 'weapon_aks74u', 'weapon_mosin9130', 'weapon_tt', 'weapon_svd'] as const;
export function scavLoadout(index: number, variant = 0): { weapon: Item; supplies: Item[] } {
    const weapon=createWeapon(SCAV_WEAPONS[(index+variant)%SCAV_WEAPONS.length]);
    const capacity=calculateStats(weapon).capacity;
    setLoadedRounds(weapon,capacity);
    weapon.condition=58+(index*7+variant*3)%28;
    const supplies: Item[]=[];
    if(detachable(weapon)) for(let i=0;i<2;i++) {
        const magazine=createItem(weapon.children.magazine.def);
        magazine.rounds=magazineCapacity(magazine);supplies.push(magazine);
    } else supplies.push(createItem('ammo_'+CATALOG[weapon.def].ammo!,capacity*3));
    return {weapon,supplies};
}
export function scavReloadSeconds(weapon: Item): number {
    const stats=calculateStats(weapon);
    return detachable(weapon)?stats.reload:stats.reload*stats.capacity;
}
/** Transfer existing cartridges; empty magazines stay on the corpse and never mint ammo. */
export function reloadScav(weapon: Item, supplies: Item[]): boolean {
    if(detachable(weapon)) {
        const at=supplies.findIndex(i=>i.def===weapon.children.magazine.def&&i.rounds>0);
        if(at<0)return false;
        const next=supplies[at];supplies[at]=weapon.children.magazine;weapon.children.magazine=next;
    } else {
        const ammo=supplies.find(i=>i.def==='ammo_'+CATALOG[weapon.def].ammo&&i.qty>0);
        if(!ammo)return false;
        const count=Math.min(calculateStats(weapon).capacity-weapon.rounds-(weapon.chamber||0),ammo.qty);
        weapon.rounds+=count;ammo.qty-=count;
        if(!ammo.qty)supplies.splice(supplies.indexOf(ammo),1);
    }
    chamberRound(weapon);return true;
}
