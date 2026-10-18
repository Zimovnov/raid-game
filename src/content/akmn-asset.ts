import type { Item } from '../domain/types.js';

/** Archived AKMN art variant retained for asset provenance only. */
export const AKMN_PRESENTATION = {
    offset: [0, .067, -.280] as const,
    muzzle: [0, .080, -.760] as const,
    aimHeight: .155
};
// Keep the authored rig URL tied to its bytes: asset responses are cached as immutable.
export const AKMN_ASSET_URL = '/assets/akmn/AKMN_FP_ContactReview.glb?v=d7c9f553df08';
export function usesAKMNAsset(gun: Item): boolean {
    // The old rig has a baked legacy texture. AKM now uses the common Field Kit
    // PBR asset like the other current weapon models.
    void gun;
    return false;
}
