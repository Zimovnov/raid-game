import type { Equipment, Item } from './types.js';
import { CATALOG } from '../content/catalog.js';
import { check } from './util.js';

/** Gameplay ammunition only; not a real-world weapon assembly specification. */
export function isMagazine(item: Item): boolean {
    const d = CATALOG[item.def];
    return d?.category === 'module' && !!d.ammo && !!d.interface?.endsWith('-mag');
}
export function magazineCapacity(item: Item): number {
    return isMagazine(item) ? CATALOG[item.def].mods?.capacity || 0 : 0;
}
export function detachable(gun: Item): boolean { return CATALOG[gun.def]?.feed === 'detachable'; }
export function loadedRounds(gun: Item | null | undefined): number {
    if (!gun) return 0;
    return feedRounds(gun) + (gun.chamber || 0);
}
export function feedRounds(gun: Item): number { return detachable(gun) ? gun.children.magazine?.rounds || 0 : gun.rounds; }
/** Move, never mint, a round from the feed into the distinct chamber. */
export function chamberRound(gun: Item): boolean {
    if (gun.chamber === 1) return true;
    const holder = detachable(gun) ? gun.children.magazine : gun;
    if (!holder || holder.rounds < 1) return false;
    holder.rounds--; gun.chamber = 1; return true;
}
export function discharge(gun: Item): boolean {
    if (!chamberRound(gun)) return false;
    gun.chamber = 0; chamberRound(gun); return true;
}
/** Set total for initial fixtures/range; gameplay swaps never call this on a detached magazine. */
export function setLoadedRounds(gun: Item, count: number): void {
    const holder = detachable(gun) ? gun.children.magazine : gun;
    check(holder, 'Магазин не установлен');
    const capacity = detachable(gun) ? magazineCapacity(holder) : CATALOG[gun.def].stats?.capacity || 0;
    check(Number.isSafeInteger(count) && count >= 0 && count <= capacity + 1, 'Боекомплект не помещается');
    gun.chamber = count > 0 ? 1 : 0;
    holder.rounds = Math.max(0, count - (gun.chamber || 0));
    if (detachable(gun)) gun.rounds = 0;
}
export function compatibleMagazine(gun: Item, magazine: Item): boolean {
    const g = CATALOG[gun.def], m = CATALOG[magazine.def];
    return detachable(gun) && isMagazine(magazine) && g.slots?.find(s => s.id === 'magazine')?.accepts === m.interface
        && m.ammo === g.ammo && (!m.platforms || m.platforms.includes(gun.def));
}
export function reserveMagazines(gear: Equipment, gun: Item): Item[] {
    return gear.bag.filter(i => compatibleMagazine(gun, i) && i.rounds > 0)
        .sort((a, b) => b.rounds - a.rounds || a.id.localeCompare(b.id));
}
export function availableRounds(gear: Equipment, gun: Item): number {
    return detachable(gun) ? reserveMagazines(gear, gun).reduce((n, i) => n + i.rounds, 0)
        : gear.bag.filter(i => CATALOG[i.def].category === 'ammo' && CATALOG[i.def].ammo === CATALOG[gun.def].ammo).reduce((n, i) => n + i.qty, 0);
}
export function magazineInGear(gear: Equipment, id: string): Item | undefined {
    return gear.bag.find(i => i.id === id && isMagazine(i))
        || [gear.primary, gear.secondary].find(g => g?.children.magazine?.id === id)?.children.magazine;
}
/** Proposal only: caller checks carrying capacity before committing both sides. */
export function proposeMagazineSwap(gear: Equipment, gun: Item, id: string): { next: Item; bag: Item[] } {
    const next = gear.bag.find(i => i.id === id);
    check(next && compatibleMagazine(gun, next) && next.rounds > 0, 'Нет подходящего заряженного магазина');
    const old = gun.children.magazine;
    return { next, bag: gear.bag.filter(i => i.id !== id).concat(old ? [old] : []) };
}
