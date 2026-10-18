"""Review original GLB layers in an isolated background Blender scene."""
import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'art/overhaul/character_sources'
OUTPUT=ROOT/'public/assets/art-overhaul/characters'
G=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
POSES=json.loads((SOURCE/'qa/poses.json').read_text())
SCENE=bpy.data.scenes.new('RAID_Character_Review');bpy.context.window.scene=SCENE
CACHE={}

def tint(mat):
    # Match the live renderer palette using the same neutral texture multiplier.
    key=mat.name.split('.')[0].removeprefix('RAID_')
    color={'skin':(.67,.46,.32),'cloth':(.29,.34,.19),'fleece':(.26,.30,.20),'knit':(.22,.27,.17)}.get(key)
    fixed={'reinforce':(.19,.22,.14),'seam':(.16,.18,.13),'jersey':(.24,.27,.18),'zip':(.12,.13,.10),'rubber':(.095,.105,.088),'leather':(.105,.098,.080),'suede':(.43,.34,.22),'jungle_cloth':(.22,.27,.15),'glove_coyote':(.44,.34,.22),'glove_olive':(.27,.31,.19),'lace':(.17,.16,.12),'eye':(.47,.46,.40),'iris':(.055,.064,.05),'lip':(.64,.45,.36),'mouth':(.16,.105,.08),'hair0':(.13,.12,.085),'hair1':(.082,.068,.05),'hair2':(.19,.17,.12),'hair3':(.12,.095,.07)}
    mat.diffuse_color=(*(color or fixed.get(key,(.3,.3,.3))),1)
    if color:
        bsdf=mat.node_tree.nodes.get('Principled BSDF');socket=bsdf.inputs['Base Color']
        if socket.links:
            link=socket.links[0];source=link.from_socket
            mult=mat.node_tree.nodes.new('ShaderNodeMixRGB');mult.blend_type='MULTIPLY';mult.inputs[0].default_value=1;mult.inputs[2].default_value=(*color,1)
            mat.node_tree.links.new(source,mult.inputs[1]);mat.node_tree.links.new(mult.outputs[0],socket)
        else:socket.default_value=(*color,1)

def source(identifier):
    if identifier in CACHE:return CACHE[identifier]
    before=set(SCENE.objects);bpy.ops.import_scene.gltf(filepath=str(OUTPUT/(identifier+'.glb')))
    objects=[]
    for obj in set(SCENE.objects)-before:
        if obj.type=='MESH':
            owner=obj
            while owner and 'assetKey' not in owner: owner=owner.parent
            if owner:
                for key in ['assetKey','lod','raidLayer','raidJoint','materialRole']:obj[key]=owner[key]
                obj.matrix_world=obj.matrix_world.copy();obj.parent=None
                objects.append(obj)
                for mat in obj.data.materials:
                    if not mat.get('reviewTinted'):tint(mat);mat['reviewTinted']=True
        obj.hide_render=True
    CACHE[identifier]=objects
    return objects

def character(ids,position=(0,0,0),yaw=0,pose='idle',lod=0,head_only=False):
    created=[]
    for identifier in ids:
        for original in source(identifier):
            if original['lod']!=lod:continue
            obj=original.copy();obj.data=original.data;SCENE.collection.objects.link(obj);obj.hide_render=False
            joint=POSES[pose][original['raidJoint']]
            p=joint['p'].copy()
            if head_only:p=[0,0,0]
            matrix=Matrix.Translation(Vector(p))@Matrix.Rotation(joint['x'],4,'X')@Matrix.Rotation(joint['z'],4,'Z')@Matrix.Diagonal((1,joint.get('scaleY',1),1,1))
            stage=Matrix.Translation(Vector(position))@Matrix.Rotation(yaw,4,'Y')
            obj.matrix_world=G@stage@matrix@G.inverted()@original.matrix_world
            created.append(obj)
    return created

def camera(eye,target,scale,width,height):
    cam_data=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',cam_data);SCENE.collection.objects.link(cam)
    cam.location=G@Vector(eye);target=G@Vector(target);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO';cam_data.ortho_scale=scale;SCENE.camera=cam
    SCENE.render.resolution_x=width;SCENE.render.resolution_y=height;SCENE.render.resolution_percentage=100

def light(name,pos,energy,size):
    data=bpy.data.lights.new(name,'AREA');obj=bpy.data.objects.new(name,data);SCENE.collection.objects.link(obj);obj.location=G@Vector(pos);obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler();data.energy=energy;data.shape='DISK';data.size=size

SCENE.render.engine='BLENDER_WORKBENCH'
SCENE.display.shading.light='STUDIO';SCENE.display.shading.color_type='MATERIAL';SCENE.display.shading.show_shadows=True;SCENE.display.shading.show_cavity=True;SCENE.display.shading.cavity_type='BOTH';SCENE.display.shading.background_type='WORLD';SCENE.display.shading.show_specular_highlight=True
SCENE.world=bpy.data.worlds.new('Review studio');SCENE.world.use_nodes=True;SCENE.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.24,.20,1);SCENE.world.node_tree.nodes['Background'].inputs[1].default_value=.55
SCENE.view_settings.view_transform='AgX'
light('Key',(-4,6,-6),1700,5);light('Fill',(5,3,-3),1000,4);light('Rim',(0,4,5),1400,3)

mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'single'
if mode=='single':
    character(['body','face_00','jacket_g4','trousers_g4','boots_desert','gloves_olive'],yaw=.3)
    camera((1.3,1.4,-4),(0,.89,0),2.07,1000,1100)
elif mode.startswith('faces'):
    yaw={'faces':0,'faces-profile':1.57,'faces-quarter':.65,'faces-rear':3.14}[mode]
    for n in range(12):character([f'face_{n:02}'],((n%6)*.43,(1-n//6)*.48,0),yaw,head_only=True)
    camera((1.075,.22,-5),(1.075,.22,0),2.70,2200,900)
elif mode.startswith('headwear'):
    ids=['balaclava','bandana','boonie','fleece','patrol','watch']
    yaw={'headwear':0,'headwear-profile':1.57,'headwear-quarter':.65,'headwear-rear':3.14}[mode]
    for n,identifier in enumerate(ids):character(['face_00','head_'+identifier],((n%3)*.60,(1-n//3)*.54,0),yaw,head_only=True)
    camera((.60,.29,-5),(.60,.29,0),1.86,1500,1000)
elif mode.startswith('jackets'):
    ids=['acu','afghanka','bdu','fleece','g4','gorka','kombat','m65','softshell','sumrak']
    yaw={'jackets':0,'jackets-back':3.14,'jackets-side':1.57,'jackets-quarter':.65}[mode]
    for n,identifier in enumerate(ids):character(['body','face_00','jacket_'+identifier,'trousers_bdu','boots_leather'],((n%5)*.95,(1-n//5)*1.95,0),yaw)
    camera((1.9,1.82,-8),(1.9,1.82,0),4.9,2400,1900)
elif mode.startswith('trousers'):
    ids=['acu','afghanka','bdu','g4','gorka','kombat','softshell','sumrak']
    yaw={'trousers':0,'trousers-back':3.14,'trousers-side':1.57,'trousers-quarter':.65}[mode]
    for n,identifier in enumerate(ids):character(['trousers_'+identifier,'boots_leather'],((n%4)*.68,(1-n//4)*.99,0),yaw)
    camera((1.02,.85,-5),(1.02,.85,0),2.9,1900,1450)
elif mode=='poses':
    for n,pose in enumerate(POSES):character(['body','face_02','jacket_bdu','trousers_bdu','boots_jungle','gloves_fingerless'],((n%3)*1.0,(1-n//3)*1.9,0),.4,pose)
    camera((1,1.80,-5),(1,1.80,0),4.20,1800,2100)
elif mode in ['boots','gloves']:
    ids=['desert','hiking','jungle','leather'] if mode=='boots' else ['coyote','fingerless','leather','olive']
    for n,identifier in enumerate(ids):
        for row,yaw in enumerate([0,1.57,3.14,.65]):
            original_pose=POSES['idle']
            for joint in original_pose:
                if joint.startswith('foot'):original_pose[joint]={'p':[(-1 if joint.endswith('L') else 1)*.13,0,0],'x':0,'z':0}
                if joint.startswith('fore'):original_pose[joint]={'p':[(-1 if joint.endswith('L') else 1)*.085,.30,0],'x':0,'z':0}
            character([mode+'_'+identifier],(n*.64,(3-row)*.5,0),yaw)
    camera((.96,.74,-5),(.96,.74,0),2.62,1800,1400)
else:raise ValueError(mode)
SCENE.render.image_settings.file_format='PNG';SCENE.render.filepath=str(SOURCE/'qa'/(mode+'.png'))
bpy.ops.render.render(write_still=True)
print('CHARACTER_RENDER '+SCENE.render.filepath,flush=True)
