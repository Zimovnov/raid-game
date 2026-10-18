"""Read-only GLB inspection in a separate scene. Run through Blender MCP.
No target geometry, UVs, materials, source files or runtime files are modified.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector


def audit_asset(filepath, report_path=None, roundtrip_path=None):
    previous = bpy.context.window.scene
    before = {kind: set(getattr(bpy.data, kind)) for kind in ('objects', 'meshes', 'materials', 'images', 'actions', 'collections')}
    scene = bpy.data.scenes.new('RAID_Asset_Audit_Temporary')
    bpy.context.window.scene = scene
    errors = []
    try:
        bpy.ops.import_scene.gltf(filepath=str(filepath))
        groups = {}
        bounds = []
        for obj in scene.objects:
            if obj.type != 'MESH':
                continue
            owner = obj
            while owner and 'assetKey' not in owner:
                owner = owner.parent
            if not owner or owner.get('lod') not in (0, 1):
                errors.append('Missing assetKey / lod: ' + obj.name)
                continue
            key = str(owner['assetKey'])
            lod = int(owner['lod'])
            group = groups.setdefault(key, {}).setdefault(str(lod), {'triangles': 0, 'vertices': 0, 'objects': 0, 'materials': set(), 'uvLayers': set(), 'degenerateTriangles': 0, 'collapsedUVTriangles': 0, 'invalidNormals': 0, 'boundsGame': {'min': [math.inf]*3, 'max': [-math.inf]*3}})
            mesh = obj.data
            mesh.calc_loop_triangles()
            # Only polygon vertices participate: loose authoring helpers must not
            # move a dropped item off the floor. Inverse of GAME_TO_BLENDER.
            for index in {index for polygon in mesh.polygons for index in polygon.vertices}:
                point = obj.matrix_world @ mesh.vertices[index].co
                game = (point.x, point.z, -point.y)
                for axis in range(3):
                    group['boundsGame']['min'][axis] = min(group['boundsGame']['min'][axis], game[axis])
                    group['boundsGame']['max'][axis] = max(group['boundsGame']['max'][axis], game[axis])
            group['objects'] += 1
            group['vertices'] += len(mesh.vertices)
            group['triangles'] += len(mesh.loop_triangles)
            group['materials'].update(material.name for material in mesh.materials if material)
            group['uvLayers'].update(layer.name for layer in mesh.uv_layers)
            if not mesh.uv_layers:
                errors.append('Missing UV: ' + obj.name)
            if any(not math.isfinite(value) for vertex in mesh.vertices for value in vertex.co):
                errors.append('Non-finite vertex: ' + obj.name)
            for normal in mesh.corner_normals:
                if any(not math.isfinite(value) for value in normal.vector) or normal.vector.length < .99:
                    group['invalidNormals'] += 1
            uv = mesh.uv_layers.active
            for triangle in mesh.loop_triangles:
                if triangle.area < 1e-12:
                    group['degenerateTriangles'] += 1
                if uv:
                    points = [uv.data[index].uv for index in triangle.loops]
                    if any(not math.isfinite(value) for point in points for value in point):
                        errors.append('Non-finite UV: ' + obj.name)
                    area = abs((points[1].x-points[0].x)*(points[2].y-points[0].y) - (points[2].x-points[0].x)*(points[1].y-points[0].y))
                    if area < 1e-12:
                        group['collapsedUVTriangles'] += 1
            bounds.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
        if not groups:
            errors.append('No valid asset groups')
        for name, lods in groups.items():
            if set(lods) != {'0', '1'}:
                errors.append('Missing LOD pair: ' + name)
            for lod, group in lods.items():
                if not all(math.isfinite(n) for side in group['boundsGame'].values() for n in side):
                    errors.append('Empty polygon bounds: ' + name + '/LOD' + lod)
                    group['boundsGame'] = None
                for field in ('materials', 'uvLayers'):
                    group[field] = sorted(group[field])
                for field in ('degenerateTriangles', 'collapsedUVTriangles', 'invalidNormals'):
                    if group[field]:
                        errors.append(f'{name}/LOD{lod}: {field}={group[field]}')
        images = [{'name': image.name, 'size': list(image.size), 'packed': bool(image.packed_file), 'source': image.source} for image in set(bpy.data.images) - before['images']]
        roundtrip = None
        if roundtrip_path:
            if Path(roundtrip_path).resolve() == Path(filepath).resolve():
                raise ValueError('Roundtrip must use a separate output file')
            Path(roundtrip_path).parent.mkdir(parents=True, exist_ok=True)
            for obj in scene.objects:
                obj.select_set(True)
            bpy.ops.export_scene.gltf(filepath=str(roundtrip_path), export_format='GLB', use_selection=True, use_active_scene=True, export_extras=True, export_cameras=False, export_lights=False, export_animations=False)
            checked = audit_asset(roundtrip_path)
            roundtrip = {'file': str(roundtrip_path), 'status': checked['status'], 'groupsMatch': set(groups) == set(checked['groups']), 'errors': checked['errors']}
            for key, lods in groups.items():
                for lod, group in lods.items():
                    if group['triangles'] != checked['groups'].get(key, {}).get(lod, {}).get('triangles'):
                        roundtrip['errors'].append(f'Changed triangle count: {key}/LOD{lod}')
            if not roundtrip['groupsMatch'] or roundtrip['errors']:
                errors.append('Roundtrip changed or invalidated asset groups')
                roundtrip['status'] = 'FAILED'
        report = {
            'file': str(filepath), 'blenderVersion': bpy.app.version_string,
            'status': 'FAILED' if errors else 'PASSED', 'errors': sorted(set(errors)),
            'groups': groups, 'images': images, 'roundtrip': roundtrip,
            'groupBounds': {name: lods['0']['boundsGame'] for name, lods in groups.items() if '0' in lods},
            'rawImportedBounds': {'min': [min(v[k] for v in bounds) for k in range(3)], 'max': [max(v[k] for v in bounds) for k in range(3)]} if bounds else None,
            'scope': 'Structural import only. Bounds are unassembled normalized groups. This does not verify runtime scale, art quality, animation, frame time or online gameplay.'
        }
        if report_path:
            Path(report_path).parent.mkdir(parents=True, exist_ok=True)
            Path(report_path).write_text(json.dumps(report, indent=2) + '\n')
        return report
    finally:
        bpy.context.window.scene = previous
        bpy.data.scenes.remove(scene)
        for kind in ('objects', 'meshes', 'materials', 'images', 'actions', 'collections'):
            collection = getattr(bpy.data, kind)
            for data in set(collection) - before[kind]:
                collection.remove(data)
