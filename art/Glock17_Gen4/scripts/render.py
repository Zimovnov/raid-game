import bpy, os
from mathutils import Vector
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4'
scene=bpy.context.scene;cam=scene.camera
views={'right':((.6,.093,-.05),(0,.093,-.05)), 'left':((-.6,.093,-.05),(0,.093,-.05)), 'front':((0,.65,-.05),(0,.09,-.05)), 'rear':((0,-.55,-.05),(0,.09,-.05)), 'top':((0,.093,.55),(0,.093,-.05)), 'front34':((-.34,.43,.22),(0,.09,-.042)), 'rear34':((.32,-.32,.18),(0,.077,-.044)), 'fps':((.025,-.29,.087),(0,.12,.003))}
view=scene.get('preview_view','right');stage=scene.get('preview_stage','block')
cam.location, target=views[view];cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.24
if view in ('front','rear'):cam.data.ortho_scale=.205
if view=='top':cam.data.ortho_scale=.31
if view=='fps':cam.data.type='PERSP';cam.data.lens=52
if stage=='block':
    scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='SINGLE';scene.display.shading.single_color=(.55,.55,.55);scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.background_type='WORLD';scene.world.color=(.12,.12,.12)
else:scene.render.engine='BLENDER_EEVEE'
if view in ('front34','rear34'):cam.data.ortho_scale=.275
scene.render.filepath=P+'/previews/'+stage+'_'+view+'.png'
bpy.ops.render.render(write_still=True)
result={'image':scene.render.filepath}
