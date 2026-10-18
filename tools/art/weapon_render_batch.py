"""Read exported master scenes and render external silhouette/PBR review views."""
import bpy
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/art'))
from build_weapon_overhaul import render_views, SOURCE
records=json.loads((SOURCE/'layout-input.json').read_text())
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for record in records:
    if ids and record['id'] not in ids:continue
    source=SOURCE/(record['id']+'.blend')
    with bpy.data.libraries.load(str(source),link=False) as (data,loaded):loaded.scenes=data.scenes
    scene=loaded.scenes[0];previous=bpy.context.window.scene;bpy.context.window.scene=scene
    objects=[o for o in scene.objects if o.type=='MESH' and o.get('assetKey') in ('body','action')]
    render_views(objects,record)
    bpy.context.window.scene=previous;bpy.data.scenes.remove(scene)
    bpy.data.orphans_purge(do_recursive=True)
    print('REVIEW_RENDERED '+record['id'],flush=True)
