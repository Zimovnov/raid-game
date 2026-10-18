import bpy,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_weapon_overhaul import Shell,DATA,create_atlas
scene=bpy.data.scenes.new('Weapon diagnostics');bpy.context.window.scene=scene
record=next(r for r in DATA if r['id']=='weapon_mpx')
objects=Shell(record,0,create_atlas()).build()
for obj in objects:
    obj.data.calc_loop_triangles()
    for tri in obj.data.loop_triangles:
        if tri.area<1e-12:print('DEGENERATE',obj.name,[tuple(obj.data.vertices[i].co) for i in tri.vertices],flush=True)
