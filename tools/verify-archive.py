"""Verify a delivered archive contains a coherent built project and no private runtime clutter."""
from pathlib import Path
import json,sys,zipfile,hashlib,re
archive=Path(sys.argv[1]).resolve()
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None,'ZIP CRC failure'
 names=z.namelist()
 forbidden=[name for name in names if any(part in ['node_modules','.git','__pycache__'] or part=='.env' or part.startswith('.env.') for part in Path(name).parts) or Path(name).suffix.lower() in ['.woff','.woff2','.ttf','.otf']]
 assert not forbidden,forbidden
 required=['README_RU.md','IMPLEMENTATION_STATUS.md','TEST_REPORT.md','KNOWN_LIMITATIONS.md','package.json','package-lock.json','src/main.ts','dist/index.html','dist/src/main.js','dist/asset-manifest.json','dist/network-config.json','START_MAC.command','START_WINDOWS.cmd','tools/serve.mjs','vendor/typescript-5.8.3.tgz']
 for name in required:assert 'raid-game/'+name in names,name
 for name in names:
  if name.startswith('raid-game/dist/src/') and name.endswith('.js'):
   text=z.read(name).decode()
   for target in re.findall(r'''(?:from\s*|import\s*)["'](\.[^"']+)["']''',text):
    import posixpath
    resolved=posixpath.normpath(posixpath.join(posixpath.dirname(name),target))
    assert resolved in names,(name,target)
 report={'status':'PASS','archive':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':len(names),'checked':'ZIP CRC, required source/build/launcher files, all static relative module imports, no node_modules/.env/.git/font files'}
 print(json.dumps(report,ensure_ascii=False,indent=2))
