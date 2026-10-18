# weapon_scorpion — Luna brief for Blender

**Task type:** rebuild from verified visual source; no base-model exclusion applies. **Reference gate:** five distinct official CZ images are available: three full-object profiles/oblique views plus two separate detail compositions for rail/receiver and stock/control geometry. This meets the project rule for combined silhouette-and-part coverage; it is not five orthographic whole-object views. Strict muzzle-end, butt-end and underside remain explicit gaps.

## Product/source identity

Target the in-game CZ SCORPION EVO 3 A1 family silhouette. CZ's official product page describes a polymer receiver/trigger housing/forend/stock/magazine system, foldable adjustable stock, upper and forend Picatinny mounting, ambidextrous controls, laterally adjustable charging handle, and flared magazine well. Freeze the catalog default: `weapon_scorpion` has `scorpion_stock`, `scorpion_guard` (short/default), `scorpion_grip`, `scorpion_30`; no optic or `scorpion_can` is installed. Use the official CZ EVO 3 A1 full-size product set as the matching target. Keep `scorpion_guard_long`, `scorpion_20` and `scorpion_can` as distinct optional modules; do not bake these into the base. Official page: https://www.czfirearms.com/en-us/mle-products/submachine-guns/cz-scorpion-evo-3-a1

## Five silhouette anchors

1. Compact, straight-line SMG proportion: short barrel and compact receiver/handguard with the full top rail as an unbroken strong silhouette.
2. Large monolithic polymer receiver and trigger-housing mass; do not replace it with a thin AR-like upper/lower split.
3. Distinctive steep pistol grip and oversized trigger guard integrated with the lower housing; preserve magazine well angle and flare.
4. Curved box magazine; show a translucent/polymer body edge/window only if the target subvariant visibly has it. Do not import the S1 magazine design without evidence.
5. Folding/adjustable buttstock has a clear hinge, narrow support arms and broad butt pad; keep folded/extended states aligned with receiver axis.

## Geometry, materials and attachment design

Use low-poly planar surfaces with silhouette-weighted bevels: receiver corner breaks, handguard/rail edges, sights, grip and butt pad must read at game distance. Keep rail slots spaced consistently and shallow; do not model every tooth as a high-poly repeated cylinder. Polymer should be dark charcoal, rough and slightly varied between receiver, grip and stock; steel controls/barrel/sights are darker semi-metallic with restrained edge wear. CZ describes polymer for receiver/trigger housing/forend/stock/magazines and corrosion-resistant metal finish; roughness should separate those surfaces. Avoid prominent logos or legible proprietary engraving in the game asset.

For modular grouping use the existing registry's weapon base assetKey groups, not one monolithic mesh: core receiver/handguard/barrel, stock, magazine, sights, muzzle device, and optional optic/rail attachments only when corresponding in-game mods exist. Preserve attachment pivots and current receiver/barrel/stock alignment; do not add unsupported mounts. At LOD1 collapse rail teeth and small controls, retaining stock, grip, magazine and barrel proportions.

## Animation and integration

Expose only moving groups already supported by weapon runtime: magazine out/in, bolt/charging handle action if current weapon animation contract supports it, stock folding only if represented by actual game customization, and trigger as a small visible movement. Keep rigid groups/pivots and first-person ADS alignment on the existing weapon path; this brief implies no new procedural animation state. Check muzzle, ejection and hand clearance in existing reload/ADS poses.

## References and known gaps

Local files and exact source URLs/SHA256 are listed in `/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_scorpion/sources.json`. Gate-counted images: `cz_a1_20071.png` left profile; `cz_a1_20073.png` opposite profile; `cz_a1_20081.png` rear-side 3/4; existing `official_01.png` rail/receiver detail; existing `official_02.png` stock/control detail. The three extra Armádní noviny files are explicitly marked as unverified replica/context and do not count. All external images are copyrighted/private reference-only and stay outside runtime/public. Strict muzzle-end, stock-end and underside views remain gaps; do not infer them from accessory crops.

## Acceptance

- One unmistakable compact Scorpion profile with correct receiver-to-stock and grip-to-magazine proportions in side, front, rear and 3/4 checks.
- Polymer and metal read as distinct materials without baked-in shiny noise; silhouette and rail remain clean at game distance.
- Magazine insertion, stock hinge (if supported) and first-person ADS/reload alignment remain valid; no clipping with supported attachments.
- Geometry stays inside per-weapon LOD budgets from the active asset pipeline; LOD1 retains recognition. Record actual count at export rather than inventing a target.
- Check final work in runtime; detail crops alone are insufficient. No modeling occurs until reference gap is closed or art lead explicitly accepts the limited evidence.
