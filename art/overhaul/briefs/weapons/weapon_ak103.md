# weapon_ak103 — Luna Blender brief

## Frozen catalog build

Target is the current `weapon_ak103` default: `ak_stock + ak_poly + ak_grip + ak762_30 + ak_brake`. Build a 7.62×39 AK-103 family rifle with the catalog’s extended solid black polymer stock, black polymer ribbed handguard/grip, curved 30-round 7.62 magazine and AK-pattern muzzle brake. Do not add optics, lights, vertical grips or grenade launcher to the default. The stock module is the current solid/fixed catalog module: do not add a fold hinge or fold animation. That is a conscious catalog-compatible approximation, not a claim that the production AK-103 universally has a fixed stock. Use museum examples for receiver family shape and front/rear joins; do not transfer accessory geometry or variant-specific serials.

## Silhouette and form decisions

- Preserve the AK-derived long-stroke profile: stock/receiver/handguard/barrel axis remain one near-straight line; barrel and gas tube are parallel, with a distinct front sight/gas block and a slanted AK-103 brake.
- The stamped receiver is the major center mass: show the upper cover seam, selector lever, receiver bulge/rivets as broad polygon planes; avoid a smooth rounded box. Do not copy AKM or AK-74M receiver details wholesale.
- Handguard is black polymer with the 100-series rib pattern; maintain its slight narrowing and separate gas-tube cover. The front sight block, gas block, cleaning rod and handguard must not merge into one silhouette.
- Stock is the catalog’s black solid polymer form with visible cheek contour and buttplate edge; keep it extended, with no folding animation. Pistol grip is a separate swept polymer mass.
- The 7.62×39 30-round magazine has a deeper curve/broader body than a 5.45 magazine; keep it distinct from the rifle’s receiver width and preserve the flared lower toe. Brake is the short, slanted AK100 pattern, not the AK-74M brake.

## Geometry, materials, UV and LOD

Use deliberately planar low-poly surfaces and silhouette-catching chamfers only. Model the brake slots, sight ears, selector profile, stock butt and magazine curve as authored geometry; put tiny stamps/knurling in roughness/normal detail only where supported. Receiver is dark parkerized steel with controlled metallic response, polymer stock/handguard/grip/magazine are low-sheen charcoal with slightly different roughness; avoid uniform glossy black. UV seams belong under the receiver/stock and inner handguard faces; keep long grain-free polymer surfaces free of visible stretch. Reuse existing project weapon materials/atlases. LOD0 retains full silhouette, receiver edges, brake, sight blocks and magazine curve; LOD1 removes small rivets/teeth and reduces chamfers without changing the outline. Record exported tris/material slots/texture bytes; do not invent an unverified numerical budget.

## Asset groups and animation

Keep existing catalog groups: body/action, `stock__ak_stock`, `handguard__ak_poly`, `pistolgrip__ak_grip`, `magazine__ak762_30`, `muzzle__ak_brake`. No new socket or skeleton. Preserve ADS, recoil, reload and first-person IK; verify mag insertion, sight alignment, ejection/muzzle transforms and render passes. No fold animation because catalog stock is the solid module.

## Reference audit

Local images and provenance are indexed in `/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_ak103/sources.json`. Counted: `museum_ak103_cover.jpg` (physical full-object diagonal with accessories), `museum_ak103_muzzle_02.jpeg` (front assembly/cleaning rod), `museum_ak103_foldedstock_01.jpeg` (stock/receiver join), `context_ak103_02.jpg` and `context_ak103_06.jpg` (distinct field contexts named AK103; exact subtype not verified), plus `06_31022402.jpg` only as supplementary partial full-object display frame. The museum gallery also has a separate folded-stock joint photo, retained as variant context. Photos with accessories are not the default kit. Exact manufacturer production subrevision and a single photographed catalog-equivalent build remain unknown; muzzle-end-on/top-down views are missing. These are reference-only and never runtime/public.

## Luna → Sol → Review

**Luna:** use the frozen build and silhouette decisions above; treat uncertain field images as family context only. **Sol:** author the Blender body plus existing module asset groups, UVs/materials and LODs without changing runtime contracts. **Review:** check profile/3-quarter against counted sources, 7.62 magazine curve, stock/interface joins, brake and front sight; run ADS/reload/recoil/IK and render-pass checks, and report actual exported geometry/texture counts. Mark catalog approximation separately from verified source facts.
