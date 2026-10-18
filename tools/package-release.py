"""Create a release from an explicit source allowlist; never package live profiles or references."""
from pathlib import Path
import argparse,hashlib,json,shutil,zipfile
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--stage',required=True);p.add_argument('--archive');args=p.parse_args()
stage=Path(args.stage).resolve()
if stage==ROOT or ROOT in stage.parents:raise SystemExit('Stage must be outside the working project')
stage.mkdir(parents=True,exist_ok=True)
ignore=shutil.ignore_patterns('node_modules','.data','.env','.env.*','server.env','references','previews','__pycache__','.DS_Store','*.blend1','*.woff','*.woff2','*.ttf','*.otf','*.sqlite','*.sqlite-*')
for name in ['src','server','public','tests','tools','vendor','web','deploy','docs','dist','dist-web']:
 shutil.copytree(ROOT/name,stage/name,ignore=ignore,dirs_exist_ok=True)
for item in ROOT.iterdir():
 if item.is_file() and not item.name.startswith('.') and item.suffix.lower() in ['.md','.json','.ts','.html','.css','.txt','.sh','.cmd','.command']:
  shutil.copy2(item,stage/item.name)
shutil.copy2(ROOT/'LICENSE',stage/'LICENSE')
shutil.copytree(ROOT/'art/FieldKit051',stage/'art/FieldKit051',ignore=ignore,dirs_exist_ok=True)
(stage/'art/Glock17_Gen4').mkdir(parents=True,exist_ok=True)
for name in ['Glock17_Gen4_LOD0.glb','asset-manifest.json','roundtrip_validation.json']:
 shutil.copy2(ROOT/'art/Glock17_Gen4'/name,stage/'art/Glock17_Gen4'/name)
# Keep existing AKMN authoring records and original runtime model; private/reference images stay local.
for name in ['animation-manifest.json','geometry-stats.json','roundtrip-checks.json']:
 src=ROOT/'art/AKMN'/name
 if src.exists():
  (stage/'art/AKMN').mkdir(parents=True,exist_ok=True);shutil.copy2(src,stage/'art/AKMN'/name)
for name in ['051','current']:
 shutil.copytree(ROOT/'artifacts'/name,stage/'artifacts'/name,dirs_exist_ok=True)
shutil.copy2(ROOT/'artifacts/verify.log',stage/'artifacts/verify.log')
manifest={}
for file in sorted(stage.rglob('*')):
 if not file.is_file() or file.name=='RELEASE_FILES.json' or 'node_modules' in file.parts:continue
 manifest[str(file.relative_to(stage))]=hashlib.sha256(file.read_bytes()).hexdigest()
(stage/'RELEASE_FILES.json').write_text(json.dumps(manifest,indent=2)+'\n')
if args.archive:
 archive=Path(args.archive)
 if archive.exists():raise SystemExit('Refusing to overwrite an existing release archive')
 archive.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for name in list(manifest)+['RELEASE_FILES.json']:z.write(stage/name,stage.name+'/'+name)
 with zipfile.ZipFile(archive) as z:
  bad=z.testzip()
  if bad:raise SystemExit('ZIP CRC failure: '+bad)
 print(json.dumps({'archive':str(archive),'files':len(manifest)+1,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
else:print(json.dumps({'stage':str(stage),'files':len(manifest)+1}))
