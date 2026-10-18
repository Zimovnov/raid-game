"""Fresh offline install + launcher path/port test; Linux/Node, not Windows/macOS UI."""
from pathlib import Path
import json,shutil,subprocess,socket,tempfile,urllib.request,time
ROOT=Path(__file__).resolve().parents[1];report={'scope':'Linux: clean offline install, Node launcher in a path containing Cyrillic/spaces and busy port','checks':[]}
with tempfile.TemporaryDirectory(prefix='Рейд проверка ') as temp:
 target=Path(temp)/'проект игры'
 shutil.copytree(ROOT,target,ignore=shutil.ignore_patterns('node_modules','artifacts','__pycache__'))
 result=subprocess.run(['npm','ci','--offline','--ignore-scripts','--no-audit','--no-fund'],cwd=target,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=20)
 assert result.returncode==0,result.stdout
 report['checks'].append({'test':'fresh npm ci --offline using only vendored lockfile','status':'PASS','exit':result.returncode,'output':result.stdout})
 assert (target/'node_modules/typescript/bin/tsc').is_file()
 result=subprocess.run(['node','tools/runtime-check.mjs'],cwd=target,capture_output=True,text=True,timeout=5);assert result.returncode==0
 report['checks'].append({'test':'Node minimum version check on '+subprocess.check_output(['node','--version'],text=True).strip(),'status':'PASS'})
 blocker=socket.socket();blocker.bind(('127.0.0.1',18340));blocker.listen()
 server=subprocess.Popen(['node','tools/serve.mjs','--port=18340'],cwd=target,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 try:
  ready=False
  for _ in range(60):
   try:
    with urllib.request.urlopen('http://127.0.0.1:18341/health',timeout=.5) as response:
     assert json.load(response)['game']=='REID';ready=True;break
   except OSError:time.sleep(.1)
  assert ready,'Launcher failed to choose next free port'
  with urllib.request.urlopen('http://127.0.0.1:18341/src/main.js') as response:assert response.status==200
  report['checks'].append({'test':'launcher accepts Cyrillic/spaces and selects next free port','status':'PASS','occupied':18340,'selected':18341})
 finally:
  server.terminate();server.wait(timeout=5);blocker.close()
report['status']='PASS';(ROOT/'artifacts/packaging-test.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
