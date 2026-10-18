"""Render socket-local modules only, separate from assembled gameplay QA."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'art/overhaul/secondary_attachment_sources';OUT=SRC/'renders';OUT.mkdir(exist_ok=True)
manifest=json.loads((SRC/'manifest.json').read_text());args=sys.argv[sys.argv.index('--')+1:]if '--'in sys.argv else []
selected_lod=1 if '--lod1'in args else 0;ids=[a for a in args if a!='--lod1']or list(manifest)
for ident in ids:
    with bpy.data.libraries.load(str(SRC/(ident+'.blend')),link=False)as(data,loaded):loaded.scenes=data.scenes
    scene=loaded.scenes[0];previous=bpy.context.window.scene;bpy.context.window.scene=scene
    objects=[o for o in scene.objects if o.type=='MESH']
    for o in objects:o.hide_render=o.get('lod')!=selected_lod
    scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=640;scene.render.resolution_y=420;scene.render.resolution_percentage=100
    if hasattr(scene,'eevee') and hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=16
    scene.world=bpy.data.worlds.new('Secondary neutral world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.14,.17,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
    scene.view_settings.view_transform='AgX'
    vs=[o.matrix_world@v.co for o in objects if o.get('lod')==selected_lod for v in o.data.vertices]
    lo=Vector([min(v[k]for v in vs)for k in range(3)]);hi=Vector([max(v[k]for v in vs)for k in range(3)]);center=(lo+hi)/2
    extent=hi-lo;camera=bpy.data.objects.new('Inspection_camera',bpy.data.cameras.new('Inspection_camera'));scene.collection.objects.link(camera);scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=max(extent.y*1.25,extent.z*1.8,extent.x*2,.10)
    for i,(loc,power,size)in enumerate([((1,-1,2),190,2),((-1,0,1),160,2),((0,2,1.5),220,2)]):
        light=bpy.data.objects.new('Softbox'+str(i),bpy.data.lights.new('Softbox'+str(i),'AREA'));scene.collection.objects.link(light);light.location=center+Vector(loc);light.data.energy=power;light.data.size=size;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    for name,off in [('oblique',(2.7,-1.3,1.25)),('side',(3,0,.10))]:
        camera.location=center+Vector(off);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(ident+('-lod1'if selected_lod else'')+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
    bpy.context.window.scene=previous;bpy.data.scenes.remove(scene);bpy.data.orphans_purge(do_recursive=True)
    print('SECONDARY_RENDERED',ident,flush=True)
