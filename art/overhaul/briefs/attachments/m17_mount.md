# m17_mount — M17 slide optic platform

## Fixed authored shape

Create a low, compact plate/platform sitting on the top rear of the M17 slide. The body is a short rectangular deck with softened perimeter bevels, shallow side skirts and small raised fore/aft lips that make its outline readable above the slide serrations. Keep its upper surface broad and simple so the game’s compact pistol-dot attachment can sit visibly on top; do not sculpt an ACRO-shaped branded footprint or assert universal optic compatibility. It is a game mount with a single catalog optic slot (`pistol-optic`), not a real adapter part.

Use `fcd1_detached_top_oblique` for overall plate length, width and top silhouette; `fcd2_installed_left` and `fcd3_installed_right_rear` for low height and the way the platform sits above the slide; `fcd5_bare_plate_on_slide` for the plate’s exterior relationship to the slide; `fcd6_bare_left_edge`, `fcd7_bare_right_edge` and `fcd8_bare_front_oblique` for the visible edge profile and differing front/rear outline. These are photographs of a branded FCD OPF-M17 ACRO product, not the authored object. Use only the low plate silhouette/scale as a visual archetype. Do not reproduce brand marks, the exact screw pattern, optic brand, or claim FCD compatibility.

## Game construction and materials

- The bottom surface is explicitly an artist approximation: use a neutral, shallow contact plane against the protected M17 slide asset. Do not infer or model hidden locking, screw or manufacturing geometry from these photos.
- Material: matte dark coated metal with subtle edge highlights. Keep serrations of the slide visible around the plate; avoid logo or text.
- UV: top deck and side skirt are separate islands with uniform texel density; bevels and narrow end lips must not stretch the texture. The underside can use a simple dark material, since it is not exposed in the game camera.
- LOD0 preserves the low profile, deck perimeter and end lips. LOD1 may merge micro bevels but must leave clear separation between platform and slide.
- Attach the module to the game-defined optic mount point and keep it fixed during aim/fire/reload. The optic remains its own inventory/equipment entity; do not bake its volume into the plate.

## Evidence limits

Seven distinct manufacturer views cover the detached top-oblique view, installed left/rear angles, and exposed front/side edges. No independent underside photo exists. Hidden contact geometry remains a nonfunctional visual approximation fitted only to the protected game model. All photographs are private reference-only, not public or runtime assets.
