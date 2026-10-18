# Luna → Sol: Blender brief — Beretta M9A3

Target weapon_m9a3 from src/content/arsenal-expansion.ts uses base m9a3, m9_grip, m9_17; optional light is not in default build. Keep m9a3 layout from weapon-layouts.ts and pistol animation from weapon-animation.ts. Official Beretta gallery shows black M9A3; an additional official FDE image anchors the project sand finish. Use black frames for geometry and FDE frame for color/material cues.

## Пять критериев силуэта

1. Large open slide cut exposes barrel above the dust cover; keep the classic hammer-fired DA/SA layout, not a closed-slide striker silhouette.
2. High squared slide forward section with rear serrations and a slim extended barrel; front muzzle should remain distinct and readable.
3. Frame front forms a short integrated accessory rail with three clear slots; light remains an optional module.
4. Vertec-style reduced-circumference grip has separate grip panels and visible front/back checkering; do not use older round 92FS bulk.
5. Separate ambidextrous safety/decocker levers, slide stop, oversized mag release, trigger/guard, hammer and front/rear sights; all should read in low-poly profile.

## Geometry, UV, materials

Starter budget: 2.5–4k tris LOD0 active pistol, 0.9–1.6k LOD1. These are planning ranges pending in-game profiling. Keep open slide cut, hammer, rail and grip silhouette in LOD1; remove only hidden interiors and tiny serrations. One 1K atlas for frame/slide/grips; optional light separate asset/material.

Game finish: satin sand/FDE metal coating, not beige plastic; grip panels matte dark polymer; barrel and rails dark metal. Separate UV islands for slide and frame; give grip panels enough texel density for checkering. Model large checkering, put fine pattern into normal/roughness. Keep materials and normals stable under lighting.

## Integration and acceptance

Preserve current m9a3 layout/IK. Test idle, aim, slide movement, reload, hand clearance around hammer, optional light mounting, shadows and depth/material passes, LOD and FPS. Accept only if open-slide cut, hammer, rail and Vertec grip distinguish it from a generic Beretta/M9.

Sources.json records four exact official Beretta black M9A3 views (left/right profiles and both quarter views) plus a distinct official FDE product composition with close slide/frame/grip/rail detail. The FDE image is the exact material target; it is useful additional image evidence but does not pretend to be a new camera direction. The generic M9 Commons frame is excluded. Beretta redistribution rights are not established, so the external images remain private reference-only.
