exec(compile(open(__file__.replace('03_materials.py','common.py')).read(),__file__.replace('03_materials.py','common.py'),'exec'))
def noise(n,l,vector,scale,detail=3):
    q=n.new('ShaderNodeTexNoise');q.inputs['Scale'].default_value=scale;q.inputs['Detail'].default_value=detail;l.new(vector,q.inputs['Vector']);return q.outputs['Fac']
def ramp(n,l,value,a,b,lo=.2,hi=.8):
    q=n.new('ShaderNodeValToRGB');q.color_ramp.elements[0].position=lo;q.color_ramp.elements[0].color=(*a,1);q.color_ramp.elements[1].position=hi;q.color_ramp.elements[1].color=(*b,1);l.new(value,q.inputs[0]);return q.outputs[0]
for mat in (steel,edge,wood,poly,black):
    n=mat.node_tree.nodes;l=mat.node_tree.links;n.clear();out=n.new('ShaderNodeOutputMaterial');p=n.new('ShaderNodeBsdfPrincipled');l.new(p.outputs[0],out.inputs[0])
    g=n.new('ShaderNodeNewGeometry');pos=g.outputs['Position'];s=n.new('ShaderNodeVectorMath');s.operation='MULTIPLY';l.new(pos,s.inputs[0])
    if mat==wood:
        s.inputs[1].default_value=(95,2,95);f=noise(n,l,s.outputs[0],4.8,5)
        w=n.new('ShaderNodeTexWave');w.wave_type='BANDS';w.bands_direction='X';w.inputs['Scale'].default_value=2.8;w.inputs['Distortion'].default_value=8;w.inputs['Detail'].default_value=5;l.new(s.outputs[0],w.inputs[0])
        c=ramp(n,l,f,(.010,.0038,.0022),(.042,.015,.006),.18,.82);l.new(c,p.inputs['Base Color'])
        l.new(ramp(n,l,f,(.27,)*3,(.48,)*3),p.inputs['Roughness']);p.inputs['Metallic'].default_value=0
        p.inputs['Coat Weight'].default_value=.18;p.inputs['Coat Roughness'].default_value=.32;h=f;dist=.00014
    elif mat==poly:
        s.inputs[1].default_value=(1,1,1);f=noise(n,l,pos,1000,2)
        l.new(ramp(n,l,f,(.025,.005,.003),(.065,.017,.012)),p.inputs['Base Color']);p.inputs['Metallic'].default_value=0
        l.new(ramp(n,l,f,(.38,)*3,(.58,)*3),p.inputs['Roughness']);h=f;dist=.00007
    else:
        s.inputs[1].default_value=(4,3,5);f=noise(n,l,s.outputs[0],65,3)
        if mat==black:a,b,met=(.003,.004,.005),(.009,.012,.015),.15
        elif mat==edge:a,b,met=(.055,.064,.070),(.20,.22,.23),.9
        else:a,b,met=(.019,.024,.028),(.032,.039,.044),.65
        l.new(ramp(n,l,f,a,b),p.inputs['Base Color']);p.inputs['Metallic'].default_value=met
        l.new(ramp(n,l,f,(.36,)*3,(.47,)*3),p.inputs['Roughness']);h=noise(n,l,pos,2100,2);dist=.000025
    bump=n.new('ShaderNodeBump');bump.inputs['Distance'].default_value=dist;bump.inputs['Strength'].default_value=.35;l.new(h,bump.inputs['Height']);l.new(bump.outputs[0],p.inputs['Normal'])
# Checkering in tangent-space normal bake, no geometry lattice or painted lighting.
check=poly.copy();check.name='AKMN_CheckeredBakelite';n=check.node_tree.nodes;l=check.node_tree.links;p=n.get('Principled BSDF');g=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(g.outputs['Position'],sep.inputs[0])
waves=[]
for sign in (-1,1):
    mul=n.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=sign;l.new(sep.outputs['Z'],mul.inputs[0])
    add=n.new('ShaderNodeMath');add.operation='ADD';l.new(sep.outputs['Y'],add.inputs[0]);l.new(mul.outputs[0],add.inputs[1])
    freq=n.new('ShaderNodeMath');freq.operation='MULTIPLY';freq.inputs[1].default_value=3000;l.new(add.outputs[0],freq.inputs[0])
    sine=n.new('ShaderNodeMath');sine.operation='SINE';l.new(freq.outputs[0],sine.inputs[0]);waves.append(sine.outputs[0])
multiply=n.new('ShaderNodeMath');multiply.operation='MULTIPLY';l.new(waves[0],multiply.inputs[0]);l.new(waves[1],multiply.inputs[1])
b=n.new('ShaderNodeBump');b.inputs['Distance'].default_value=.0003;b.inputs['Strength'].default_value=.6;l.new(multiply.outputs[0],b.inputs['Height']);l.new(b.outputs[0],p.inputs['Normal'])
for o in source.objects:
    if o.get('checkering'):o.data.materials.clear();o.data.materials.append(check)
save('03_BeforeRig');render('03','perspective');render('03','rail')
result={'stage':'materials'}
