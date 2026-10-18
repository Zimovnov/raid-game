# weapon_hk416a5 — Blender production brief

**Locked target:** 14.5-inch HK416 A5 body/barrel proportions, fitted with the game catalog default build: `ar_crane` stock, `hk416_guard` handguard, `ar_grip`, `ar556_30` magazine, `ar_brake` muzzle. The catalog does not specify barrel length; 14.5 inches is the explicit art target selected from the official A5 line.

## Form decisions

1. Preserve the AR receiver axis and proportions, but give the A5 lower its recognizable beveled magwell, ambidextrous controls, enlarged winter trigger guard and extended rear receiver-extension/castle-nut transition. No logos or legible brand engravings are needed.
2. Keep the upper rail continuous across upper and handguard, without a visible height step. The gas block/front sight assembly belongs to the barrel, not the handguard. Use the catalog `hk416_guard` free-float rail silhouette and its existing vent/slot pattern; do not substitute an A8/MR223 front end or add unregistered rail modules.
3. Freeze the barrel length at the official 14.5-inch configuration. Keep the long-carbine relationship between muzzle, gas block, handguard end and receiver; do not borrow 11/12.5-inch or 16.5/20-inch proportions.
4. Use the current `ar_crane` stock as the default modular stock even though H&K and Dutch-service references show HK slimline/other field stocks. Stock cheek line and receiver-extension interface must match the project module. Keep buffer/castle-nut geometry in the group that the existing registry assigns; do not duplicate it across body and stock.
5. Default build has a 30-round AR-pattern box magazine, `ar_grip`, and `ar_brake`. Do not bake optics, suppressor, laser/light, foregrip, sling, or drum magazine into the body. These appear in field context but are not catalog defaults.

## Geometry, UV and materials

Build crisp manufactured planes: flat receiver faces; small, even bevels on receiver edges and rail corners; open trigger guard; readable magazine curvature and floorplate. Model controls as discrete low-poly shapes where visible in first person, but avoid tiny fastener noise or invented panel cuts. Maintain separate `body` and `action` groups plus current socketed module asset keys. Do not combine handguard, stock, grip, mag, muzzle or optics into one baked mesh.

Reuse shared black hard-anodized metal and black polymer materials from the weapon set. Keep receiver/handguard near-black with subtle roughness separation; stock, grip and magazine read as polymer rather than painted metal. Add restrained handling wear only at contact edges; avoid noisy grunge, shiny edge streaks, and all copied markings.

Place UV seams under the handguard, receiver underside and stock interior. Keep long rail/barrel/handguard islands straight and unstretched; maintain sibling-rifle texel scale. Avoid tiny text or baked rail ticks that shimmer at LOD1. Prefer existing project materials/atlases over per-weapon texture sets.

## Runtime integration and animation

Keep existing group contracts, `weaponLayout`, socket transforms and `weaponMotion`. Body uses the project weapon frame; only supported `action` geometry follows existing bolt/charging motion; catalog modules attach by their authored sockets. Keep muzzle transform aligned with `ar_brake` and the shared firing layout. Preserve IK, ADS alignment, reload clearance, recoil and all current weapon render passes. No new skeleton and no second ammunition state. Verify the magazine clears the magwell during the current reload animation and the hands do not clip through guard, grip or handguard.

## Reference evidence and limits

Private research folder: `/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_hk416a5/`. Five counted compositions: `01_199966063.png` and `02_199966064.png` are opposite Dutch-service A5-LB profiles from Commons; they appear as clean product illustrations/renders and do not specify the exact barrel length. `hk_official_03.png` is H&K’s 14.5-inch A5 manufacturer profile. `20240527har0002.jpg` is a Dutch Ministry of Defence photo of an isolated full HK416 A5 in BSB service; `20240527har0032-header.jpg` is a distinct full-rifle 3/4 photo. The five H&K official profile files are five barrel configurations from one side, so only `hk_official_03.png` is the chosen length anchor. `20240527har0011.jpg` repeats the isolated floor pose in a wider equipment crop and is excluded as a duplicate shot. `20240527har0028.jpg` is substantially occluded by an operator and is supplemental. Full URLs, author, image hashes and rights notes are in `sources.json`; manufacturer details and source variants are in `official-sources.json`. External images remain private visual references and must not enter runtime/public assets.

Field photos show one real A5 platform setup with field accessories/stock that differ from catalog defaults. Use these photos for real surface depth, perspective and receiver/handguard junctions, not to change the project’s chosen modular assembly. Exact underside/hidden internals and exact target-specific stock/handguard subvariant are not established by this set.

## LOD and acceptance

- LOD0 target: **30–38k triangles for the active rifle assembly**, excluding inactive duplicate LOD geometry and optional optic/laser/suppressor. Spend geometry on receiver, rail profile, controls, stock outline, sights and magazine. This is a budget target to measure against the existing baseline, not a performance guarantee.
- LOD1 target: **8–12k triangles**, preserving muzzle/barrel length, receiver/control block, handguard outline, stock and magazine. Remove tiny rail teeth/fasteners first; retain continuous rail silhouette and material boundaries.
- Acceptance: part IDs unchanged; side and 3/4 silhouette coherent; top rail continuous; no floating modules or visible gaps; UVs free of stretching/texture swimming; correct muzzle/mag socket alignment; ADS/IK/reload/recoil and all existing render passes intact. Inspect loaded GLB in game. Record actual triangles, draw calls, material slots, GLB bytes and FPS delta in the fixed review scene.
