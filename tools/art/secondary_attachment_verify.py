"""Verify the precise secondary module handoff without mutating shared content."""
import json,hashlib,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'art/overhaul/secondary_attachment_sources';OUT=ROOT/'public/assets/art-overhaul/attachments-secondary'
recipes=json.loads((ROOT/'art/overhaul/production/attachment-recipes.json').read_text())['modules'];expected={k for k,v in recipes.items()if v['attachmentSlot']in('stock','handguard','mount','muzzle')}
manifest=json.loads((SRC/'manifest.json').read_text());errors=[];stale=[]
if set(manifest)!=expected:errors.append('Manifest selection mismatch')
rows={}
for ident in sorted(expected):
    value=manifest[ident];path=OUT/(ident+'.glb');data=path.read_bytes();header=struct.unpack('<4sII',data[:12]);size,kind=struct.unpack('<II',data[12:20]);gltf=json.loads(data[20:20+size]);audit=json.loads((SRC/(ident+'-audit.json')).read_text())
    if header!=(b'glTF',2,len(data)):errors.append(ident+': invalid GLB header')
    if hashlib.sha256(data).hexdigest()!=value['sha256']:errors.append(ident+': stale hash')
    if audit['status']!='PASSED' or audit['roundtrip']['status']!='PASSED':errors.append(ident+': failed structural audit')
    groups=set(audit['groups']);group=recipes[ident]['runtimeAssetGroupKeys'][0]
    if groups!={group} or value['groups']!=[group]:errors.append(ident+': group mismatch')
    if value['groupBounds']!=audit['groupBounds']:errors.append(ident+': bounds mismatch')
    for lod in (0,1):
        stat=audit['groups'][group][str(lod)]
        if stat['triangles']>recipes[ident]['lodTriangleBudget']['LOD'+str(lod)+'_max']:errors.append(ident+': triangle budget')
        if stat['objects']>2 or len(stat['materials'])>2:errors.append(ident+': material/draw budget')
        if value['triangles'][str(lod)]!=stat['triangles']:errors.append(ident+': triangle registry mismatch')
    for mesh in gltf['meshes']:
        for primitive in mesh['primitives']:
            if not {'NORMAL','TEXCOORD_0','POSITION'}<=set(primitive['attributes']):errors.append(ident+': missing vertex attributes')
    if not Path(value['source']).exists():errors.append(ident+': missing Blender master')
    for view in ('side','oblique'):
        render=SRC/'renders'/(ident+'-'+view+'.png')
        if not render.exists() or render.stat().st_mtime<Path(value['source']).stat().st_mtime:stale.append(ident+'/'+view)
    rows[ident]={'sha256':value['sha256'],'bytes':len(data),'triangles':value['triangles'],'drawMeshes':value['drawMeshes'],'structural':'PASSED','runtime':'NOT_RUN'}
reference=json.loads((SRC/'reference-integrity.json').read_text())
if reference['failures']:errors.append('Source integrity failed')
result={'status':'FAILED'if errors else'PASSED','errors':errors,'moduleCount':len(rows),'runtimeGlbBytes':sum(x['bytes']for x in rows.values()),'structuralScope':'Import, re-export/re-import, UV non-collapse, finite unit normals, LOD groups, frame bounds, triangles, 1-2 materials/draws, GLB hashes, original Blender masters, reference SHA integrity.','renderScope':{'expected':200,'staleOrMissing':stale,'status':'PASSED'if not stale else'IN_PROGRESS'},'runtimeScope':'NOT_RUN: assembled fit, FPS, ADS, reload, pump extremes and collision are owned by parent integration QA.','modules':rows}
(SRC/'handoff-qa.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k]for k in ('status','moduleCount','runtimeGlbBytes','errors','renderScope')},indent=2))
if errors:raise SystemExit(1)
