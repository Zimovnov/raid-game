exec(compile(open(__file__.replace('05_bake.py','common.py')).read(),__file__.replace('05_bake.py','common.py'),'exec'))
category=globals().get('category','Weapon');kind=globals().get('kind','BaseColor')
o=bpy.data.objects['AKMN_'+category+'_FP'];size=2048 if category=='Weapon' else 1024
name='AKMN_'+category+'_'+kind
old=bpy.data.images.get(name)
if old:bpy.data.images.remove(old)
im=bpy.data.images.new(name,width=size,height=size,alpha=False)
im.colorspace_settings.name='sRGB' if kind=='BaseColor' else 'Non-Color'
scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.bake.margin=12;scene.render.bake.use_selected_to_active=False
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
restore=[]
for mat in o.data.materials:
    n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF');out=next(x for x in n if x.type=='OUTPUT_MATERIAL')
    t=n.new('ShaderNodeTexImage');t.image=im;n.active=t
    if kind!='Normal':
        emit=n.new('ShaderNodeEmission');previous=out.inputs['Surface'].links[0].from_socket;l.new(emit.outputs[0],out.inputs[0]);restore.append((mat,out,previous,emit))
        if kind=='BaseColor':
            inp=p.inputs['Base Color'];l.new(inp.links[0].from_socket,emit.inputs[0]) if inp.is_linked else setattr(emit.inputs[0],'default_value',inp.default_value)
        else:
            combine=n.new('ShaderNodeCombineColor');combine.mode='RGB'
            ao=n.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.002;ao.only_local=True;ao.samples=8;l.new(ao.outputs['AO'],combine.inputs['Red'])
            for chan,socket in [('Green','Roughness'),('Blue','Metallic')]:
                inp=p.inputs[socket]
                if inp.is_linked:l.new(inp.links[0].from_socket,combine.inputs[chan])
                else:combine.inputs[chan].default_value=inp.default_value
            l.new(combine.outputs[0],emit.inputs[0])
bpy.ops.object.bake(type='NORMAL' if kind=='Normal' else 'EMIT',normal_space='TANGENT')
im.filepath_raw=P+'/textures/'+name+'.png';im.file_format='PNG';im.save();im.pack()
for mat,out,previous,emit in restore:mat.node_tree.links.new(previous,out.inputs[0]);mat.node_tree.nodes.remove(emit)
result={'image':name,'size':size,'saved':os.path.isfile(im.filepath_raw)}
