"""Aggregate exported weapon audits without granting visual/runtime acceptance."""
import hashlib
import json
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'art/overhaul/weapon_sources'
RUNTIME=ROOT/'public/assets/art-overhaul/weapons'
records=json.loads((SOURCE/'layout-input.json').read_text())
registry=(ROOT/'src/content/overhaul-weapon-assets.ts').read_text().splitlines()
results=[]
for record in records:
    ident=record['id'];path=RUNTIME/(ident+'.glb');errors=[]
    report=json.loads((SOURCE/(ident+'-audit.json')).read_text())
    raw=path.read_bytes();length,kind=struct.unpack_from('<II',raw,12)
    prefix='    '+ident+': '
    line=next((line for line in registry if line.startswith(prefix)),None)
    if line is None:errors.append('Missing registry entry')
    else:
        definition=json.loads(line[len(prefix):].rstrip(','))
        expected_url='/assets/art-overhaul/weapons/'+ident+'.glb?v='+hashlib.sha256(raw).hexdigest()[:12]
        if definition['url']!=expected_url:errors.append('Stale or non-versioned registry URL')
        if definition.get('frame')!='meters':errors.append('Wrong registry frame')
        if definition.get('groups')!=['body','action']:errors.append('Wrong registry groups')
        if definition.get('groupBounds')!=report['groupBounds']:errors.append('Registry bounds differ from actual import audit')
    gltf=json.loads(raw[20:20+length].rstrip(b'\x00 '))
    if set(report['groups'])!={'body','action'}:errors.append('Unexpected or missing runtime group')
    if report['status']!='PASSED':errors+=report['errors']
    triangles={str(lod):sum(group[str(lod)]['triangles'] for group in report['groups'].values()) for lod in (0,1)}
    if triangles['1']>triangles['0']*.6:errors.append('LOD1 reduction less than 40%')
    if triangles['0']>9000:errors.append('Body/action exceeds 9000 triangle budget')
    for key,lods in report['groups'].items():
        for side in ('min','max'):
            for axis in range(3):
                if abs(lods['0']['boundsGame'][side][axis]-lods['1']['boundsGame'][side][axis])>.007:
                    errors.append('LOD bounds changed: '+key+'/'+side+'/'+str(axis))
    bounds=report['groups']['body']['0']['boundsGame']
    if abs(bounds['min'][2]-record['layout']['muzzle'][2])>.004:errors.append('Muzzle longitudinal origin mismatch')
    if len(gltf.get('materials',[]))!=1:errors.append('Expected one shared atlas material')
    if len(gltf.get('meshes',[]))!=4:errors.append('Expected two groups times two LOD meshes')
    if gltf.get('animations'):errors.append('Asset must not own runtime animation')
    images=gltf.get('images',[])
    if any('uri' in image for image in images):errors.append('Unpacked or external image in GLB')
    renderFiles=[SOURCE/'renders'/(ident+'-'+view+'.png') for view in ['oblique','right','left','top']]
    brief=ROOT/'art/overhaul/briefs/weapons'/(ident+'.md')
    results.append({'id':ident,'shape':record['shape'],'structuralStatus':'FAILED' if errors else 'PASSED','errors':errors,'triangles':triangles,'glbBytes':len(raw),'glbSha256':hashlib.sha256(raw).hexdigest(),'sourceBlend':str((SOURCE/(ident+'.blend')).relative_to(ROOT)),'briefSha256':hashlib.sha256(brief.read_bytes()).hexdigest(),'groupBounds':report['groupBounds'],'materialCount':len(gltf.get('materials',[])),'embeddedImages':len(images),'renderViewsPresent':sum(p.exists() for p in renderFiles),'renderViewsNewerThanAsset':sum(p.exists() and p.stat().st_mtime>=path.stat().st_mtime for p in renderFiles),'runtimeStatus':'NOT RUN','artAcceptance':'PENDING_ASSEMBLED_REVIEW'})
output={'status':'PASSED' if all(r['structuralStatus']=='PASSED' for r in results) else 'FAILED','scope':'33 original body/action exterior shells only. Structural checks are not assembled art, IK, ADS, FPS or gameplay acceptance. Detachable modules are a separate production package.','platformCount':len(results),'runtimeGLBBytes':sum(r['glbBytes'] for r in results),'assets':results}
(SOURCE/'production-report.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps({'status':output['status'],'count':len(results),'bytes':output['runtimeGLBBytes'],'errors':{r['id']:r['errors'] for r in results if r['errors']}},indent=2))
raise SystemExit(0 if output['status']=='PASSED' else 1)
