# weapon_mp153 — Blender brief (frozen catalog target)

## Target build

Use the current catalog default `stock sg_rubber + handguard mp153_guard`. Art target: black synthetic-stock Baikal MP-153, long 28-inch-class ventilated-rib barrel, bead sight, black matching synthetic fore-end, under-barrel tubular magazine and unadorned receiver. Exact reference listing identifies a 12 gauge, 3.5-inch chamber, 28-inch vent-rib barrel and black synthetic furniture. The game does not encode chamber/barrel length. Treat the 28-inch barrel as a frozen art proportion choice and retain catalog capacity/rules unchanged. The `sg_rubber` key is a game module name; do not assert the photo proves a factory “rubber stock” formulation. Keep any optics/rails absent unless a catalog module is equipped.

## Silhouette and geometry decisions

- A long, narrow barrel with ventilated rib forms a clean top line; a separate parallel tubular magazine ends beneath it, with visible gap/support bands.
- Receiver is a compact round-edged metal block with a clearly cut ejection port and bolt/charging handle mass; it should read as a gas-operated semiautomatic, not a pump shotgun or boxy tactical receiver.
- The synthetic fore-end is a long, tapered rounded shell around the tube, with a recessed side panel and subtle texture. It remains a fixed part in the current game contract; do not add a pump animation.
- The black synthetic buttstock has a gently sloped comb, curved shoulder pad, narrow neck and molded grip transition; separate it from the receiver with a visible seam. The game `sg_rubber` surface should be matte, not glossy.
- Trigger guard, safety/button and front bead are readable but low-profile. Do not make screw heads, stamps or serials oversized; no fabricated legible branding.

## Materials, UV, LOD and render

Use low-poly planar shading with bevels only on the receiver’s catching edges, sight bead and butt/fore-end silhouette. Satin black steel receiver/barrel (higher metal response, moderate roughness) must read differently from charcoal black polymer (low metallic, higher roughness). Vent rib is a thin raised strip with repeating short slots/crossbars that survive LOD0; simplify the tiny slots at LOD1 but retain the top silhouette. UV seams go on undersides and inside receiver faces; keep long rib/barrel UV distortion low. Reuse existing weapon material atlas/materials. LOD0 retains barrel–tube separation, rib, front sight, receiver/ejection-port mass, synthetic furniture contours and trigger guard. LOD1 removes minor screws/knurling and reduces bevel segments. Record actual tris, material slots and texture bytes at export; no fabricated budget numbers.

## Existing action/integration

Preserve the existing MP-153 tube-action/semiautomatic presentation, current layout/ADS, recoil and shell reload contract. The fore-end does not translate as a pump. Keep body/receiver rigid; stock and guard remain current catalog modules. Verify muzzle/ejection transform, first-person hand pose, reload-shell clearance, ADS, IK and all render passes. Do not introduce new skeleton/socket behavior for this model.

## References

Six exact-model auction images are stored in `/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_mp153/` and fully indexed with direct URLs/SHA in `sources.json`: `auction_mp153_01.jpg` opposite full profile, `02` second opposite profile, `03` receiver/furniture seam, `04` vent rib/barrel/choke, `05` ejection-port/action and `06` stock/trigger/receiver. The listing is titled “Baikal MP-153 Semi Auto Shotgun 12Ga 3.5-inch Chamber 28-inch Vent Rib Barrel Black Synthetic Stock”; its source page now returns HTTP 410, though original CDN image bytes downloaded and hashes verified. The six compositions show different areas and are not mirrors/crops. Earlier WeaponLand images are supplemental only: that gallery mixes wood stock, uncertain versions and unrelated frames. Rights for all retained photos are reference-only; none go to public/runtime.

## Luna → Sol → Review

**Luna:** follow the frozen target above and disregard mixed-family images for furniture. **Sol:** Blender body plus current `sg_rubber` and `mp153_guard` module groups, tuned material separation, LOD and UV. **Review:** compare two full profiles and the four distinct details; validate semiauto silhouette, tube/vent-rib spacing, matte synthetic furniture, ADS/reload/IK/hand clearance, muzzle/ejection and render passes. Report actual exported tris/materials/texture sizes. Keep art approximations separate from source-backed listing facts.
