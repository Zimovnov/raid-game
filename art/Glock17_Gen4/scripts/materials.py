import bpy, math
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4'
def setup(mat):
 n=mat.node_tree.nodes;l=mat.node_tree.links
 p=next(x for x in n if x.type=='BSDF_PRINCIPLED')
 for x in list(n):
  if x.type not in ('BSDF_PRINCIPLED','OUTPUT_MATERIAL'):n.remove(x)
 return n,l,p

def mathnode(n,l,op,a,b=0):
 q=n.new('ShaderNodeMath');q.operation=op
 for i,v in enumerate((a,b)):
  if isinstance(v,(float,int)):q.inputs[i].default_value=v
  else:l.new(v,q.inputs[i])
 return q.outputs[0]
def image(n,l,file,uv):
 q=n.new('ShaderNodeTexImage');q.image=bpy.data.images.load(P+'/textures/'+file,check_existing=True);q.image.colorspace_settings.name='Non-Color';q.extension='CLIP';l.new(uv,q.inputs['Vector']);return q.outputs['Color']
def coord(n,l,y0,yr,z0,zr,flip=False):
 g=n.new('ShaderNodeNewGeometry');s=n.new('ShaderNodeSeparateXYZ');l.new(g.outputs['Position'],s.inputs[0])
 y=mathnode(n,l,'DIVIDE',mathnode(n,l,'SUBTRACT',s.outputs['Y'],y0),yr)
 if flip:y=mathnode(n,l,'SUBTRACT',1,y)
 z=mathnode(n,l,'DIVIDE',mathnode(n,l,'SUBTRACT',s.outputs['Z'],z0),zr)
 c=n.new('ShaderNodeCombineXYZ');l.new(y,c.inputs['X']);l.new(z,c.inputs['Y'])
 sn=n.new('ShaderNodeSeparateXYZ');l.new(g.outputs['Normal'],sn.inputs[0])
 return c.outputs[0],s,sn

def micro(n,l,p,scale,dist,rough,base,metal):
 noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=2
 geo=n.new('ShaderNodeNewGeometry');l.new(geo.outputs['Position'],noise.inputs['Vector'])
 b=n.new('ShaderNodeBump');b.inputs['Distance'].default_value=dist;b.inputs['Strength'].default_value=.35;l.new(noise.outputs['Fac'],b.inputs['Height']);l.new(b.outputs[0],p.inputs['Normal'])
 r=mathnode(n,l,'ADD',mathnode(n,l,'MULTIPLY',noise.outputs['Fac'],.12),rough-.06);l.new(r,p.inputs['Roughness'])
 p.inputs['Base Color'].default_value=(*base,1);p.inputs['Metallic'].default_value=metal
 return b
poly=bpy.data.materials['G17_Polymer'];n,l,p=setup(poly);micro(n,l,p,6500,.00004,.72,(.023,.027,.029),0)
# A unique frame material permits precise stipple boundaries without affecting every polymer part.
frame=bpy.data.objects['G17_Frame'];fm=bpy.data.materials.get('G17_FrameMolded') or poly.copy();fm.name='G17_FrameMolded';frame.data.materials[0]=fm
n,l,p=setup(fm);fine=micro(n,l,p,6500,.000045,.74,(.023,.027,.029),0)
uv,s,sn=coord(n,l,(325-394)*(.186/634),735*(.186/634),(115-540)*(.186/634),490*(.186/634))
h=image(n,l,'source_frame_right_height.png',uv)
side=mathnode(n,l,'GREATER_THAN',mathnode(n,l,'ABSOLUTE',sn.outputs['X']),.65)
h=mathnode(n,l,'MULTIPLY',h,side)
b=n.new('ShaderNodeBump');b.inputs['Distance'].default_value=.00020;b.inputs['Strength'].default_value=.85;l.new(h,b.inputs['Height']);l.new(fine.outputs[0],b.inputs['Normal']);l.new(b.outputs[0],p.inputs['Normal'])
# Backstrap/frontstrap carry a smaller square pattern confined below the thumb saddle.
geo=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(geo.outputs['Position'],sep.inputs[0])
a=mathnode(n,l,'PINGPONG',mathnode(n,l,'MULTIPLY',sep.outputs['X'],700),1)
c=mathnode(n,l,'PINGPONG',mathnode(n,l,'MULTIPLY',sep.outputs['Z'],700),1)
gr=mathnode(n,l,'MULTIPLY',mathnode(n,l,'GREATER_THAN',a,.45),mathnode(n,l,'GREATER_THAN',c,.45))
mask=mathnode(n,l,'MULTIPLY',mathnode(n,l,'LESS_THAN',sep.outputs['Z'],-.043),mathnode(n,l,'GREATER_THAN',sep.outputs['Z'],-.101))
mask=mathnode(n,l,'MULTIPLY',mask,mathnode(n,l,'LESS_THAN',mathnode(n,l,'ABSOLUTE',sn.outputs['X']),.55))
mask=mathnode(n,l,'MULTIPLY',mask,mathnode(n,l,'LESS_THAN',sep.outputs['Y'],.067))
backuv=n.new('ShaderNodeCombineXYZ')
l.new(mathnode(n,l,'DIVIDE',mathnode(n,l,'ADD',sep.outputs['X'],.016),.032),backuv.inputs['X'])
l.new(mathnode(n,l,'DIVIDE',mathnode(n,l,'ADD',sep.outputs['Z'],.12),.12),backuv.inputs['Y'])
grid=image(n,l,'source_strap_height.png',backuv.outputs[0])
h2=mathnode(n,l,'ADD',h,mathnode(n,l,'MULTIPLY',grid,mask));l.new(h2,b.inputs['Height'])
# Recessed factory words on the right side of the frame.
marks=image(n,l,'source_frame_right_marks.png',uv)
marks=mathnode(n,l,'MULTIPLY',marks,mathnode(n,l,'GREATER_THAN',sn.outputs['X'],.75))
mix=n.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.023,.027,.029,1);mix.inputs[2].default_value=(.009,.011,.013,1);l.new(marks,mix.inputs[0]);l.new(mix.outputs[0],p.inputs['Base Color'])
steel=bpy.data.materials['G17_NitridedSteel'];n,l,p=setup(steel);micro(n,l,p,17000,.000009,.39,(.065,.073,.08),.82)
sm=bpy.data.materials.get('G17_SlideMarked') or steel.copy();sm.name='G17_SlideMarked';bpy.data.objects['G17_Slide'].data.materials[0]=sm
n,l,p=setup(sm);fine=micro(n,l,p,17000,.000009,.39,(.065,.073,.08),.82)
uv,s,sn=coord(n,l,0,.186,(115-150)*(.186/634),68*(.186/634))
left=image(n,l,'source_slide_left_marks.png',uv);right=image(n,l,'source_slide_right_marks.png',uv)
lt=mathnode(n,l,'MULTIPLY',left,mathnode(n,l,'LESS_THAN',sn.outputs['X'],-.85));rt=mathnode(n,l,'MULTIPLY',right,mathnode(n,l,'GREATER_THAN',sn.outputs['X'],.85));mark=mathnode(n,l,'ADD',lt,rt)
mix=n.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[1].default_value=(.065,.073,.08,1);mix.inputs[2].default_value=(.016,.02,.023,1);l.new(mark,mix.inputs[0]);l.new(mix.outputs[0],p.inputs['Base Color'])
b=n.new('ShaderNodeBump');b.invert=True;b.inputs['Distance'].default_value=.000045;l.new(mark,b.inputs['Height']);l.new(fine.outputs[0],b.inputs['Normal']);l.new(b.outputs[0],p.inputs['Normal'])
# No lighting or view-dependent color in any color texture.
bpy.context.scene['preview_stage']='pbr';bpy.context.scene['preview_view']='front34'
bpy.ops.wm.save_as_mainfile(filepath=P+'/checkpoints/03_Materials.blend')
result={'materials':'procedural source with original masks'}
