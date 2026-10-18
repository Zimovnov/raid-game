# weapon_akm — Luna → Sol Blender brief (base mesh excluded)

## Scope and fixed game target

The base weapon `weapon_akm` is expressly excluded from this overhaul: keep its existing base geometry and asset key untouched. Do not replace it with the museum specimen. The project default build in `src/content/weapons.ts` is fixed as `stock=ak_wood_stock`, `handguard=ak_wood`, `pistolgrip=ak_grip`, `magazine=ak762_30`, `muzzle=ak_brake`. The actual child assets to revise are these catalog modules only: `ak_wood_stock`, `ak_wood`, `ak_grip`, `ak762_30`, `ak_brake`, and the preset-only alternate `ak_skeleton`, `ak762_20`, `ak_palm`. Do not invent new IDs or remap shared keys. `ak_stock` is another shared catalog module and is eligible only if assigned to an AKM-family build by current catalog data; verify consumer list before changing it. Optic/mount `ak_mount` may be reused only in its already-supported slot and transform; it is not part of the default build.

Reference target: Armémuseum/DigitaltMuseum object AM.016072, a Polish-made 1971 AKM-family museum/training specimen with fixed wood stock and handguard, molded grip and curved 30-round magazine. Five actual photographs show opposing profiles, front and rear obliques, and a receiver-marking close-up. Use them for fit context and wood/metal partition only. They do not document catalog aftermarket modules, exact interface surfaces or hidden geometry. Do not transfer museum serials, visible national marks or real markings into the game asset.

## Five visual anchors for module work

1. **Stock:** default `ak_wood_stock` forms a straight, full-length fixed shoulder stock, broad at the butt and tapered through a shallow comb into the receiver tang; preserve the upper line and buttplate silhouette. Use dark reddish-brown worn wood, restrained longitudinal grain, separate dark buttplate. No folding joint on this module. `ak_skeleton` reads as an open angular frame from both sides, with compact shoulder pad and clear negative space; do not turn it into a solid block.
2. **Handguard:** `ak_wood` is a two-part warm wood envelope: lower handguard long and gently tapered, upper gas-tube cover shorter and raised, with visible split at gas block. Keep barrel axis and fore-end aligned to existing base transforms. No rail segments; those belong to explicit rail modules.
3. **Pistol grip:** `ak_grip` is a steeply raked narrow grip with subtle waist, rounded lower toe and restrained side checkering. Dark brown polymer/bakelite response must differ from stock wood. `ak_palm` has the catalog-specific palm shelf and fuller lower contour, clears trigger guard and hands; do not merge it with trigger geometry.
4. **Magazine:** `ak762_30` retains pronounced forward curve and broader lower body of a 7.62x39 30-round magazine; `ak762_20` is visibly shorter with proportionally reduced curvature. Separate steel body/floorplate regions; use a few broad pressed ribs, not dense tiny grooves. Top seats at existing virtual magwell transform—do not alter receiver/base mesh.
5. **Muzzle:** `ak_brake` is a compact dark steel muzzle device with readable cylindrical attachment body and a small number of asymmetric port facets. Match only existing socket/axis. Do not lengthen barrel or claim exact real-world compatibility; retain the game module's virtual mount contract.

## Geometry, UV and material constraints

Keep an angular, believable low-poly style: controlled planar facets and modest silhouette chamfers; avoid bevel-every-edge smoothing and microdetail sculpting. Reuse existing child asset groups and mounting transforms. Make each module independently replaceable, without base edits. At close view, retain explicit buttplate and wood/pad boundary, broad grip checkering via shallow geometry or roughness/normal, magazine rib breaks and muzzle-opening silhouette. No floating parts, inverted normals, non-manifold seams, z-fighting or intersections with receiver/hand/trigger guard.

Unwrap each independent module without pinched seams. Align wood grain to stock/handguard long axis; keep scale consistent across wood pieces. Metal UVs may share existing metal atlas/material if renderer contract allows. Prefer shared materials over one per component; no new 4K texture for a small module. Wood: satin with subtle grain and worn edges; blackened steel: near-matte with restrained edge highlights; polymer/bakelite: slightly rougher, less specular. Avoid logos, serials, flags and text decals. No AO seam baking that darkens joints.

## LOD and runtime targets

Follow the current per-asset weapon budget and export conventions before export. LOD0 retains silhouette-critical parts. LOD1 may remove tiny screws, shallow stamp details and secondary ribs but preserves fixed-stock outline, handguard split, grip rake, magazine curve/length and muzzle profile. Avoid separate meshes for non-silhouette details that do not change material response. Report triangles, material slots, texture dimensions and compressed GLB bytes per module; preserve current GLB names/registry mapping.

No new moving animation is authorized. Stock stays fixed; magazine participates only in existing reload component animation; brake and handguard stay static. Verify reload insertion, ADS, sprint/weapon switch and sibling attachment combinations with existing IK and render passes; no custom rig or new skeletal engine.

## Luna → Sol → Review acceptance

**Luna brief:** use fixed catalog IDs and default above; retain base weapon. For interface surfaces not visible in the references, match the current socket transform; do not invent a new mount. **Sol execution:** replace child GLB meshes only, preserve asset keys/transforms, provide left/right/three-quarter screenshots and closeups, with per-module tris/material/texture/byte stats. **Review:** compare against the five museum views for fit context and the explicit design anchors; test default and `ak-skeleton + ak762_20 + ak_palm` preset in runtime, including ADS, reload, IK hands, GLB load/fallback and render passes. Confirm no change to excluded base AKM geometry or registry identity. Any overlap, mismatched module ID, unexplained mount change or silhouette loss fails review.

## Evidence and gaps

Images and source metadata: `/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_akm/`. Private reference-only. Photographs cover assembled Polish AKM from two sides and two obliques plus receiver detail; they do not provide underside, end-on or separate module views. They do not prove aftermarket mod geometry/materials; the explicit design decisions above are game-art direction. Do not report otherwise.
