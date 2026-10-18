"""Original mesh construction helpers for the art overhaul.
Importing this module creates no scene, target asset, material or image.
Coordinates are Blender metres (Z up); game transforms are converted by GAME_TO_BLENDER.
"""
import bpy
import bmesh
import math
from mathutils import Matrix, Vector
from mathutils.geometry import tessellate_polygon

GAME_TO_BLENDER = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))


def _mesh(name, vertices, faces):
    if not vertices or not faces:
        raise ValueError('Empty mesh: ' + name)
    if any(not math.isfinite(n) for vertex in vertices for n in vertex):
        raise ValueError('Non-finite vertex: ' + name)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    if mesh.validate(verbose=False):
        bpy.data.meshes.remove(mesh)
        raise ValueError('Invalid input topology: ' + name)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _axes(axis):
    index = 'XYZ'.index(axis)
    return index, [n for n in range(3) if n != index]


def _position(axis, depth, point):
    index, plane = _axes(axis)
    co = [0,0,0]
    co[index] = depth
    co[plane[0]], co[plane[1]] = point
    return co


def planar_uv(obj, tile_metres=.45):
    """Dominant-face projection for rigid details; lofts use continuous strip UVs."""
    if tile_metres <= 0:
        raise ValueError('UV scale must be positive')
    mesh = obj.data
    uv = mesh.uv_layers.get('UVMap') or mesh.uv_layers.new(name='UVMap')
    for face in mesh.polygons:
        axis = max(range(3), key=lambda k: abs(face.normal[k]))
        axes = [k for k in range(3) if k != axis]
        for index in face.loop_indices:
            point = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = (point[axes[0]]/tile_metres, point[axes[1]]/tile_metres)
    return obj


def loft(name, sections, axis='Y', cap=True, tile_metres=.45):
    """Sweep matching, explicitly authored polygon rings. No generated item silhouette."""
    if len(sections) < 2 or tile_metres <= 0:
        raise ValueError('Loft needs at least two sections and a positive UV scale')
    count = len(sections[0][1])
    if count < 3 or any(len(ring) != count for _,ring in sections):
        raise ValueError('Loft rings must have the same vertex count (>=3)')
    if any(sections[i+1][0] <= sections[i][0] for i in range(len(sections)-1)):
        raise ValueError('Section positions must increase')
    vertices = [_position(axis, depth, point) for depth,ring in sections for point in ring]
    faces = []
    for row in range(len(sections)-1):
        for column in range(count):
            next_column = (column+1)%count
            faces.append((row*count+column,row*count+next_column,(row+1)*count+next_column,(row+1)*count+column))
    side_count = len(faces)
    if cap:
        faces += [tuple(range(count-1,-1,-1)), tuple((len(sections)-1)*count+k for k in range(count))]
    obj = _mesh(name, vertices, faces)
    uv = obj.data.uv_layers.new(name='UVMap')
    distances = []
    for _,ring in sections:
        lengths = [0.0]
        for i in range(count):
            a,b = Vector(ring[i]),Vector(ring[(i+1)%count])
            lengths.append(lengths[-1]+(b-a).length)
        distances.append(lengths)
    for face in obj.data.polygons:
        for loop_index in face.loop_indices:
            vertex = obj.data.loops[loop_index].vertex_index
            row,column = divmod(vertex,count)
            if face.index < side_count:
                # Duplicate seam UV only on the final side face, never seam geometry.
                seam = face.index % count == count-1 and column == 0
                u = distances[row][-1] if seam else distances[row][column]
                uv.data[loop_index].uv = (u/tile_metres,(sections[row][0]-sections[0][0])/tile_metres)
            else:
                point = sections[row][1][column]
                uv.data[loop_index].uv = (point[0]/tile_metres,point[1]/tile_metres)
    return obj


def extruded_profile(name, outline, depth, axis='X', tile_metres=.45):
    """Concave side silhouettes, for original stocks, grips, pockets and panels."""
    if depth <= 0 or len(outline) < 3:
        raise ValueError('Invalid profile/depth')
    count = len(outline)
    vertices = [_position(axis, side*depth/2, point) for side in (-1,1) for point in outline]
    faces = [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    points = [Vector((a,b,0)) for a,b in outline]
    triangles = tessellate_polygon([points])
    for indices in triangles:
        faces += [tuple(reversed(indices)),tuple(i+count for i in indices)]
    return planar_uv(_mesh(name,vertices,faces),tile_metres)


def open_frame(name, outer, inner, depth, axis='X', tile_metres=.45):
    """Watertight open frames. Windows/guards have real openings, not black decals."""
    if len(outer) != len(inner) or len(outer) < 3 or depth <= 0:
        raise ValueError('Frame loops need equal point counts and positive depth')
    count = len(outer)
    vertices = [_position(axis, side*depth/2, point) for side in (-1,1) for ring in (outer,inner) for point in ring]
    faces=[]
    for i in range(count):
        j=(i+1)%count
        faces += [(i,j,count+j,count+i),(2*count+i,3*count+i,3*count+j,2*count+j),
                  (i,2*count+i,2*count+j,j),(count+i,count+j,3*count+j,3*count+i)]
    return planar_uv(_mesh(name,vertices,faces),tile_metres)


def hollow_tube(name, outer, inner, length, segments=12, axis='Y'):
    if not 0 < inner < outer or length <= 0 or segments < 6:
        raise ValueError('Invalid visible tube dimensions')
    rings = [[(radius*math.cos(k*math.tau/segments),radius*math.sin(k*math.tau/segments)) for k in range(segments)] for radius in (outer,inner)]
    return open_frame(name,rings[0],rings[1],length,axis)


def bevel(obj, width=.001, segments=1, tile_metres=.45):
    """Bevel rigid details and project the new faces at the requested UV scale.

    Blender's interpolated bevel UVs can collapse along an existing island edge.
    This helper deliberately uses rigid face projection; do not apply it to a
    garment loft whose continuous strip mapping needs to be retained.
    """
    if width <= 0 or segments not in (1,2) or tile_metres <= 0:
        raise ValueError('Use small, restrained bevels')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier=obj.modifiers.new('Authored silhouette bevel','BEVEL')
    modifier.width=width
    modifier.segments=segments
    modifier.limit_method='ANGLE'
    modifier.angle_limit=.55
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    return planar_uv(obj, tile_metres)


def material(name, color, role, roughness=.8, metallic=0):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    mat['role']=role
    node=mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value=(*color,1)
    node.inputs['Roughness'].default_value=roughness
    node.inputs['Metallic'].default_value=metallic
    mat.diffuse_color=(*color,1)
    return mat


def export_asset(objects, glb_path, blend_path=None):
    """Only explicitly selected target objects enter runtime GLB."""
    if not objects:
        raise ValueError('No objects to export')
    groups={}
    for obj in objects:
        if obj.type != 'MESH' or not obj.data.uv_layers or obj.get('lod') not in (0,1) or not obj.get('assetKey'):
            raise ValueError('Missing mesh/UV/assetKey/LOD contract: '+obj.name)
        groups.setdefault(obj['assetKey'],set()).add(obj['lod'])
    if any(lods != {0,1} for lods in groups.values()):
        raise ValueError('Every runtime group requires LOD0 and LOD1')
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(glb_path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
    if blend_path:
        # Write only the dedicated asset scene and its dependencies, without
        # renaming/saving the user's currently open master file.
        bpy.data.libraries.write(str(blend_path),{bpy.context.scene},fake_user=True,compress=True)
