import json,struct,pathlib,hashlib
p=pathlib.Path(__file__).resolve().parents[1];data=(p/'Glock17_Gen4_LOD0.glb').read_bytes()
magic,version,length=struct.unpack_from('<4sII',data);jl,jt=struct.unpack_from('<II',data,12);g=json.loads(data[20:20+jl])
assert magic==b'glTF' and version==2 and length==len(data)
assert len(g['meshes'])==7 and len(g['materials'])==1
assert all('uri' not in im and 'bufferView' in im for im in g['images'])
m=g['materials'][0];assert 'occlusionTexture' in m and 'normalTexture' in m and 'metallicRoughnessTexture' in m['pbrMetallicRoughness']
assert len(g.get('animations',[]))==0
stats={'glb_bytes':len(data),'meshes':len(g['meshes']),'nodes':len(g['nodes']),'materials':len(g['materials']),'embedded_images':len(g['images']),'primitives':sum(len(x['primitives']) for x in g['meshes']),'vertices':sum(g['accessors'][pr['attributes']['POSITION']]['count'] for me in g['meshes'] for pr in me['primitives']),'triangles':sum(g['accessors'][pr['indices']]['count']//3 for me in g['meshes'] for pr in me['primitives']),'material':m,'nodes_detail':g['nodes']}
(p/'glb_validation.json').write_text(json.dumps(stats,indent=2));print(json.dumps({k:v for k,v in stats.items() if k not in ('material','nodes_detail')},indent=2))

blob=data[28+jl:]
for im in g['images']:
 v=g['bufferViews'][im['bufferView']];raw=blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
 external=(p/'textures'/(im['name']+'.png')).read_bytes()
 assert hashlib.sha256(raw).digest()==hashlib.sha256(external).digest(), 'Embedded atlas is stale: '+im['name']
print('PASSED: all three embedded PNGs byte-match the current atlas files')
