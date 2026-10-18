import bpy, os
P='/Users/vladimir/Projects/raid-game/art/Glock17_Gen4'
s=bpy.context.scene;kind=s.get('bake_kind','BaseColor');size=2048
s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.bake_type='NORMAL'
s.render.bake.use_selected_to_active=False;s.render.bake.use_clear=False;s.render.bake.margin=10
meshes=[o for o in bpy.data.collections['GAME_LOD0'].objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
name='G17_'+kind
im=bpy.data.images.get(name) or bpy.data.images.new(name,width=size,height=size,alpha=False)
im.colorspace_settings.name='sRGB' if kind=='BaseColor' else 'Non-Color'
im.generated_color=(.5,.5,1,1) if kind=='Normal' else (0,0,0,1)
materials=set(m for o in meshes for m in o.data.materials if m)
restore=[]
for m in materials:
 n=m.node_tree.nodes;l=m.node_tree.links
 tex=n.get('G17_BakeTarget') or n.new('ShaderNodeTexImage');tex.name='G17_BakeTarget';tex.image=im
 for q in n:q.select=False
 tex.select=True;n.active=tex
 if kind=='ORM':
  p=next(q for q in n if q.type=='BSDF_PRINCIPLED');out=next(q for q in n if q.type=='OUTPUT_MATERIAL')
  restore.append((m,[(e.from_socket,e.to_socket) for e in list(l) if e.to_node==out]))
  for e in list(l):
   if e.to_node==out:l.remove(e)
  comb=n.new('ShaderNodeCombineColor');comb.name='G17_BakeORMCombine';comb.mode='RGB'
  ao=n.new('ShaderNodeAmbientOcclusion');ao.name='G17_BakeAO';ao.inputs['Distance'].default_value=.002;ao.only_local=True;ao.samples=8;l.new(ao.outputs['AO'],comb.inputs['Red'])
  for dest,key in [('Green','Roughness'),('Blue','Metallic')]:
   sock=p.inputs[key]
   if sock.is_linked:l.new(sock.links[0].from_socket,comb.inputs[dest])
   else:comb.inputs[dest].default_value=sock.default_value
  em=n.new('ShaderNodeEmission');em.name='G17_BakeEmission';l.new(comb.outputs[0],em.inputs['Color']);l.new(em.outputs[0],out.inputs['Surface'])
try:
 if kind=='BaseColor':bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'})
 elif kind=='Normal':bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT',normal_r='POS_X',normal_g='POS_Y',normal_b='POS_Z')
 else:bpy.ops.object.bake(type='EMIT')
 im.filepath_raw=P+'/textures/'+name+'.png';im.file_format='PNG';im.save()
finally:
 for m,links in restore:
  for name in ('G17_BakeORMCombine','G17_BakeAO','G17_BakeEmission'):
   q=m.node_tree.nodes.get(name)
   if q:m.node_tree.nodes.remove(q)
  for a,b in links:m.node_tree.links.new(a,b)
s['baked_'+kind]=True
bpy.ops.wm.save_as_mainfile(filepath=P+'/checkpoints/05_Baked.blend')
result={'baked':kind,'file':im.filepath_raw,'size':list(im.size)}
