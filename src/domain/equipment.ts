import type { Definition, Item } from './types.js';
import { CATALOG } from '../content/catalog.js';
import { clamp } from './util.js';

export function equipmentSlot(def: Definition): 'armor' | 'helmet' | undefined {
    if (def.category !== 'armor') return undefined;
    return def.equipmentSlot || (def.id === 'armor_light' ? 'armor' : def.id === 'helmet_light' ? 'helmet' : undefined);
}

/** Continuous condition-scaled absorption shared by simulation and inventory UI. */
export function armorAbsorption(item: Item | null | undefined): number {
    if (!item) return 0;
    const def = CATALOG[item.def], slot = def && equipmentSlot(def);
    if (!slot || !Number.isFinite(item.condition)) return 0;
    const base = def.protection ?? (slot === 'armor' ? .44 : .34);
    return clamp(base, 0, .8) * clamp(item.condition / 100, 0, 1);
}
