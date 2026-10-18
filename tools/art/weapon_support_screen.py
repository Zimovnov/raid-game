"""Conservative exterior support screening; overlaps are not a visual proof."""
import bpy,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/art'))
from build_weapon_overhaul import Shell,DATA,create_atlas,SOURCE
results=[]
for record in DATA:
    previous=bpy.context.window.scene;scene=bpy.data.scenes.new('Support screen');bpy.context.window.scene=scene
    objects=Shell(record,0,create_atlas()).build()
    bpy.context.view_layer.update()
    groups={}
    for group in ('body','action'):
        members=[obj for obj in objects if obj['assetKey']==group]
        bounds=[]
        for obj in members:
            points=[obj.matrix_world@v.co for v in obj.data.vertices]
            bounds.append(([min(p[k] for p in points) for k in range(3)],[max(p[k] for p in points) for k in range(3)]))
        adjacent={i:set() for i in range(len(members))}
        for i,(lo,hi) in enumerate(bounds):
            for j,(lo2,hi2) in enumerate(bounds[:i]):
                if all(lo[k]<=hi2[k]+.0015 and lo2[k]<=hi[k]+.0015 for k in range(3)):
                    adjacent[i].add(j);adjacent[j].add(i)
        unseen=set(adjacent);components=[]
        while unseen:
            seed=next(iter(unseen));pending=[seed];component=set()
            while pending:
                i=pending.pop()
                if i in component:continue
                component.add(i);pending.extend(adjacent[i]-component)
            unseen-=component;components.append([members[i].name for i in sorted(component)])
        components.sort(key=len,reverse=True)
        groups[group]={'components':len(components),'detachedCandidates':components[1:]}
    results.append({'id':record['id'],'groups':groups})
    bpy.context.window.scene=previous;bpy.data.scenes.remove(scene);bpy.data.orphans_purge(do_recursive=True)
output={'scope':'Authoring AABB connectivity screen at 1.5mm tolerance. This can find separated parts but cannot prove actual surface contact; visual assembled review is still required. Action is screened separately from body; it may contain separate controlled parts.','assets':results}
(SOURCE/'support-screen.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps([r for r in results if any(g['components']>1 for g in r['groups'].values())],indent=2),flush=True)
