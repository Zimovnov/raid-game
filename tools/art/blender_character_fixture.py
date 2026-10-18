"""Neutral rigid-anchor loader fixture. These frames are not character/apparel art."""
import bpy
import importlib.util
import json
from pathlib import Path
from mathutils import Matrix


def create_fixture(project_root):
    root = Path(project_root)
    spec = importlib.util.spec_from_file_location('raid_character_fixture_meshkit', root / 'tools/art/blender_meshkit.py')
    kit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(kit)
    output = root / 'artifacts/overhaul-character-fixture'
    output.mkdir(parents=True, exist_ok=True)
    previous = bpy.context.window.scene
    scene = bpy.data.scenes.new('RAID_Neutral_Character_Loader_Fixture')
    bpy.context.window.scene = scene
    scene.unit_settings.system = 'METRIC'
    objects = []
    try:
        fabric = kit.material('Fixture_Fabric', (.55, .55, .55), 'fabric', .94)
        trim = kit.material('Fixture_Trim', (.12, .16, .18), 'trim', .7)
        for joint in ['torso', 'upperL', 'upperR', 'foreL', 'foreR']:
            for lod in [0, 1]:
                frame = kit.open_frame('Neutral_Frame_' + joint + '_' + str(lod), [(-.055, -.055), (.055, -.055), (.055, .055), (-.055, .055)], [(-.038, -.038), (.038, -.038), (.038, .038), (-.038, .038)], .024, axis='Z')
                if lod == 0:
                    kit.bevel(frame, .0015)
                marker = kit.extruded_profile('Neutral_Marker_' + joint + '_' + str(lod), [(-.014, -.012), (.014, -.012), (0, .016)], .018, axis='Z')
                offset = 0 if joint == 'torso' else -.15
                for obj, role, material in [(frame, 'fabric', fabric), (marker, 'trim', trim)]:
                    obj.matrix_world = kit.GAME_TO_BLENDER @ Matrix.Translation((0, offset, 0))
                    obj.data.materials.append(material)
                    obj['assetKey'] = 'probe_' + joint
                    obj['lod'] = lod
                    obj['raidLayer'] = 'jacket'
                    obj['raidJoint'] = joint
                    obj['materialRole'] = role
                    objects.append(obj)
        kit.export_asset(objects, output / 'rigid-layer.glb', output / 'Rigid_Layer_Loader_Fixture.blend')
        # Deliberately invalid files test rejection of a whole layer, never runtime fallback art.
        for obj in objects:
            obj.select_set(not (obj['assetKey'] == 'probe_foreR' and obj['lod'] == 1))
        bpy.ops.export_scene.gltf(filepath=str(output / 'missing-lod.glb'), export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True, export_extras=True, export_cameras=False, export_lights=False, export_animations=False)
        for obj in objects:
            obj.select_set(True)
            if obj['assetKey'] == 'probe_foreR':
                obj['raidJoint'] = 'head'
        bpy.ops.export_scene.gltf(filepath=str(output / 'wrong-joint.glb'), export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True, export_extras=True, export_cameras=False, export_lights=False, export_animations=False)
        for obj in objects:
            if obj['assetKey'] == 'probe_foreR':
                obj['raidJoint'] = 'foreR'
        report = {'scope': 'Neutral engineering fixture only; not target art.', 'objects': len(objects), 'joints': 5, 'roles': ['fabric', 'trim'], 'lods': [0, 1], 'files': [str(output / name) for name in ['rigid-layer.glb', 'missing-lod.glb', 'wrong-joint.glb', 'Rigid_Layer_Loader_Fixture.blend']]}
        (output / 'manifest.json').write_text(json.dumps(report, indent=2))
        return report
    finally:
        bpy.context.window.scene = previous
