import type { Item } from '../domain/types.js';

/** Retained for callers of the former fixed-assembly presentation API. */
export function hasFixedModelPresentation(_gun: Item): boolean { return false; }

/** Rendering, icons and export recipes share the authoritative installed tree. */
export function modelPresentation(gun: Item): Item {
    return gun;
}
