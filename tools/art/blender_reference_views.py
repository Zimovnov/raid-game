"""Render supplied source geometry read-only in an isolated Blender scene.
These are project-asset fit references, not real-world photographs or new models.
"""
import bpy
import json
import hashlib
from pathlib import Path
from mathutils import Vector


def render_reference_views(filepath, output):
    filepath=Path(filepath).resolve()
    output=Path(output).resolve()
    output.mkdir(parents=True,exist_ok=True)
    source_hash=hashlib.sha256(filepath.read_bytes()).hexdigest()
    original_scene=bpy.context.window.scene
    original_path=bpy.data.filepath
    kinds=('objects','meshes','materials','images','actions','collections','cameras','lights','worlds')
    before={kind:set(getattr(bpy.data,kind)) for kind in kinds}
    scene=bpy.data.scenes.new('RAID_ReadOnly_Reference_Temporary')
    bpy.context.window.scene=scene
    try:
        with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
            bpy.ops.import_scene.gltf(filepath=str(filepath))
        meshes=[obj for obj in scene.objects if obj.type=='MESH']
        if not meshes: raise ValueError('No mesh in supplied reference')
        scene.view_layers[0].update()
        # Only rendered polygon vertices define the frame. Some source files
        # contain loose helper vertices which enlarge object bounding boxes.
        points=[obj.matrix_world@obj.data.vertices[index].co for obj in meshes
                for index in {index for face in obj.data.polygons for index in face.vertices}]
        if not points: raise ValueError('No visible polygon geometry in supplied reference')
        minimum=Vector([min(v[k] for v in points) for k in range(3)])
        maximum=Vector([max(v[k] for v in points) for k in range(3)])
        centre=(minimum+maximum)/2
        span=maximum-minimum
        radius=max(span)*2.5
        scene.render.engine='BLENDER_EEVEE'
        scene.render.resolution_x=1200
        scene.render.resolution_y=800
        scene.render.resolution_percentage=100
        scene.render.image_settings.file_format='PNG'
        scene.render.film_transparent=False
        world=bpy.data.worlds.new('Reference_Neutral_World')
        world.use_nodes=True
        world.node_tree.nodes['Background'].inputs['Color'].default_value=(.18,.18,.18,1)
        world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
        scene.world=world
        camera_data=bpy.data.cameras.new('Reference_Orthographic_Camera')
        camera=bpy.data.objects.new('Reference_Orthographic_Camera',camera_data)
        scene.collection.objects.link(camera)
        camera_data.type='ORTHO'
        camera_data.clip_start=max(.0001,max(span)/1000)
        camera_data.clip_end=max(10,radius*10)
        scene.camera=camera
        for index,direction in enumerate([(1,-1,1),(-1,1,1),(1,1,-1),(-1,-1,-1)]):
            data=bpy.data.lights.new('Reference_Softbox_'+str(index),'AREA')
            data.energy=(320 if index==0 else 160)*max(span)**2
            data.shape='DISK'
            data.size=radius
            light=bpy.data.objects.new(data.name,data)
            scene.collection.objects.link(light)
            light.location=centre+Vector(direction).normalized()*radius
            light.rotation_euler=(centre-light.location).to_track_quat('-Z','Y').to_euler()
        views=[]
        for index,(label,direction) in enumerate([('axis_x_negative',(-1,0,0)),('axis_x_positive',(1,0,0)),('axis_y_negative',(0,-1,0)),('axis_y_positive',(0,1,0)),('axis_z_positive',(0,0,1)),('axis_z_negative',(0,0,-1))]):
            camera.location=centre+Vector(direction)*radius
            camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
            rotation=camera.rotation_euler.to_matrix().transposed()
            projected=[rotation@(p-centre) for p in points]
            width=max(p.x for p in projected)-min(p.x for p in projected)
            height=max(p.y for p in projected)-min(p.y for p in projected)
            camera_data.ortho_scale=max(width,height*1.5)*1.2
            name=f'{index+1:02d}_{label}.png'
            scene.render.filepath=str(output/name)
            with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
                bpy.ops.render.render(write_still=True)
            views.append({'file':name,'source_page':str(filepath),'source_sha256':source_hash,'sha256':hashlib.sha256((output/name).read_bytes()).hexdigest(),'role':'Project-provided source asset fit reference, orthographic '+label,'camera_position':list(camera.location),'ortho_scale':camera_data.ortho_scale,'rights':'Project-provided existing asset, private fit study only; original asset license remains applicable. Not a real-world photo.'})
        if source_hash!=hashlib.sha256(filepath.read_bytes()).hexdigest():raise ValueError('Source file changed unexpectedly')
        report={'status':'RENDERED_AWAITING_VISUAL_REVIEW','source':str(filepath),'source_sha256':source_hash,'blender':bpy.app.version_string,'mesh_objects':len(meshes),'bounds':{'min':list(minimum),'max':list(maximum)},'views':views,'scope':'Read-only source geometry/material render. No target modeling, manufacturing measurements, real-world authenticity or runtime acceptance claim.'}
        (output/'sources.json').write_text(json.dumps(report,indent=2)+'\n')
        return report
    finally:
        bpy.context.window.scene=original_scene
        for obj in list(set(bpy.data.objects)-before['objects']):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.scenes.remove(scene)
        for kind in kinds[1:]:
            collection=getattr(bpy.data,kind)
            for block in list(set(collection)-before[kind]):
                if block.users==0:collection.remove(block)
        if bpy.data.filepath!=original_path:raise RuntimeError('Unexpected master filepath change')
