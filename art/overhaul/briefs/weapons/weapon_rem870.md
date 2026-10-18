# weapon_rem870 — Blender brief (frozen target)

**Target:** catalog `Remington 870` default build `stock 870_wood + handguard 870_pump`; `mount sg` stays empty by default. Model an older 870 Express short riot configuration as the project visual archetype: 18.5-inch IC barrel, 37.5-inch overall silhouette, shortened 12.75-inch LOP wood stock, matching wood pump forend, black steel receiver and flush-looking tubular magazine. Preserve the catalog 6-shell gameplay capacity as a game property; the source article does not identify its exact tube capacity as a manufacturing spec. Do not inherit the RIAC Super Magnum’s 27-inch vent-rib barrel, laminate furniture or 3.5-inch chamber. Do not model the source article’s shortened/reworked stock as a brand/logo replica; it defines the chosen visual proportions only.

## Silhouette anchors

1. Long straight 18.5-inch barrel and parallel magazine tube, both clearly narrower than the receiver.
2. Compact rectangular receiver with softened/slanted upper rear shoulder; receiver remains the central mass, not a featureless box.
3. Ribbed wooden pump is a separate fore-end group with visible travel clearance along the magazine tube.
4. Fixed wood buttstock has a clear comb, narrow neck and flared butt; target LOP is intentionally short relative to standard sporting 870.
5. Trigger guard, pistol grip transition and pump/stock wood-to-steel boundaries remain readable from first-person side/quarter views.

## Geometry, materials, UV and LOD

Use flat-shaded low-poly planes with chamfers only at silhouette-catching edges. Keep barrel and magazine axes parallel; model the receiver’s ejection-port/bolt region and trigger guard as distinct readable masses without inventing hidden internal details. Pump stays independent for the existing pump action; stock remains a catalog module. Barrel, receiver and tube use dark parkerized/blued steel with distinct roughness; wood is warm medium walnut with subtle directional grain, not orange lacquer; trigger guard and small controls use dark metal. Avoid aftermarket rails, side saddle, optic, shell extension, ribs and muzzle devices unless added as separately cataloged mods. 

UV: maintain consistent grain direction along stock and forend; seam on underside/inboard faces. Share the project’s existing material atlas where compatible; do not add a unique texture set for each wooden module. LOD0 preserves receiver outline, pump ribs as broad grouped grooves, stock comb/butt silhouette and tube/barrel separation. LOD1 removes fine ribs/screw heads and narrows chamfers, while keeping pump travel, trigger guard and stock outline. Record final tris/material slots/texture bytes against active asset budgets at export; do not invent a new numeric budget here.

## Mounting and animation

Use existing `weapon_rem870` layout and module socket transforms only. Pump/forend must follow the existing pump action pivot; bolt/receiver and stock stay rigid. Keep ADS alignment, hands, recoil, reload shell interactions, muzzle transform, ejection point and all render passes unchanged. Do not add a new skeleton or receiver-action system. Verify the fully assembled default and empty `mount sg` in first-person and inspection views.

## Reference evidence and gaps

Private references are indexed in `/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_rem870/sources.json`. Counted compositions: `oldexpress_01.jpg`, `oldexpress_02.jpg`, `oldexpress_03.jpg`, plus auction `riac_01.jpg`, `riac_02.jpg`, `riac_04.jpg`. The first three show the chosen 18.5-inch wooden Express archetype in separate full-object compositions; RIAC provides additional receiver/opposite-side/rear geometry but is a different 2015 Super Magnum and must not control barrel or furniture proportions. The Rem870.com article explicitly says older Express, 18.5-inch IC barrel, 37.5-inch overall, and 12.75-inch shortened LOP: https://www.rem870.com/2013/06/13/remington-870-old-school-riot-gun-project/. The RIAC auction identifies its separate lot as 2015 Super Magnum, 27-inch vent-rib barrel, laminate stock: https://www.rockislandauction.com/detail/5033/1290/remington-model-870-super-magnum-slide-action-shotgun. Rights are not cleared for redistribution; local files are reference-only and never runtime/public.

## Luna → Sol → Review

**Luna:** use the exact catalog modules and frozen visual target above; retain source differences explicitly. **Sol:** model/export the body and existing `870_wood` / `870_pump` groups in Blender; report LOD tris, UV/texture use and materials. **Review:** confirm barrel/body ratio, 18.5-inch art target, wood continuity, pump separation/travel, default socket assembly, ADS/reload/recoil, render passes and first-person hand clearance. Mark art approximation separately from verified source facts.
