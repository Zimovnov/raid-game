"""Real-browser smoke test: UI, 3D, saving, live WebRTC two-context raid start.
No fake transport, injected game state, teleport or browser-policy changes.
Exit 0 PASS, 1 FAIL, 2 BLOCKED/missing browser. Optional: pip install -r requirements-dev.txt.
"""
from pathlib import Path
import json, os, re, shutil, subprocess, sys, time
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'artifacts/e2e-report.json'
REPORT.parent.mkdir(exist_ok=True)
server=None
checks=[]
report={'scope':'Real Chromium + two isolated profiles + actual WebRTC DataChannel, loopback signaling. This is not a physical-device or cross-NAT test.'}

def record(name):
 checks.append({'test':name,'status':'PASS'})

def click(page,act,ident=None):
 selector=f'[data-act="{act}"]'+(f'[data-id="{ident}"]' if ident else '')
 page.locator(selector).first.click()

def diagnostics(page):
 return page.evaluate('window.__REID_DIAGNOSTICS()')

try:
 from playwright.sync_api import sync_playwright
 server=subprocess.Popen(['node','tools/serve.mjs','--port=18300'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 address=None
 deadline=time.monotonic()+10
 while time.monotonic()<deadline:
  line=server.stdout.readline()
  match=re.search(r'http://localhost:\d+',line)
  if match:
   address=match.group(0);break
  if server.poll() is not None: raise RuntimeError('Static server exited before listening: '+line)
 if not address: raise RuntimeError('Server did not report a listening address')
 with sync_playwright() as pw:
  executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
  kwargs={'headless':os.environ.get('HEADED')!='1'}
  if executable:kwargs['executable_path']=executable
  browser=pw.chromium.launch(**kwargs)
  report['browser']=browser.version
  contexts=[browser.new_context(viewport={'width':1440,'height':900}) for _ in range(2)]
  pages=[context.new_page() for context in contexts]
  errors=[]
  for page in pages:page.on('pageerror',lambda error:errors.append(str(error)))
  for idx,page in enumerate(pages):
   page.goto(address+'/?signal=local',wait_until='networkidle',timeout=20000)
   page.wait_for_timeout(800)
   if page.locator('body').inner_text().startswith('Игра не запустилась'):
    raise RuntimeError('BLOCKED_CAPABILITY: '+page.locator('body').inner_text())
   page.wait_for_function('typeof window.__REID_DIAGNOSTICS === "function"',timeout=10000)
   click(page,'nav','character')
   page.locator('#character-name').fill(['Тестер Хозяин','Тестер Гость'][idx])
   click(page,'create-character')
   page.wait_for_function('window.__REID_DIAGNOSTICS().page === "stash"',timeout=10000)
   assert diagnostics(page)['profile']['cash']==50000
  record('Create and save two independent browser profiles')
  host,guest=pages
  click(host,'nav','gunsmith')
  previous=diagnostics(host)['profile']['gear']['primary']['children']['stock']['def']
  mods=host.locator('[data-act="module"]').evaluate_all('(xs)=>xs.filter(x=>!x.disabled).map(x=>x.dataset.id)')
  candidate=next((x for x in mods if x not in [previous,'none']),None)
  if not candidate:raise AssertionError('No alternative compatible stock')
  click(host,'module',candidate);click(host,'apply-build')
  host.wait_for_function('(def)=>window.__REID_DIAGNOSTICS().profile.gear.primary.children.stock.def===def',arg=candidate)
  record('Apply a paid real weapon-module change via UI')
  host.screenshot(path=str(ROOT/'artifacts/browser-gunsmith.png'))
  host.reload(wait_until='networkidle');host.wait_for_function('typeof window.__REID_DIAGNOSTICS === "function"')
  assert diagnostics(host)['profile']['gear']['primary']['children']['stock']['def']==candidate
  record('IndexedDB weapon build survives full page reload')
  click(host,'nav','lobby');click(host,'create-room')
  host.wait_for_selector('#invite-code',timeout=15000)
  code=host.locator('#invite-code').input_value()
  click(guest,'nav','lobby');guest.locator('#join-code').fill(code);click(guest,'join-room')
  guest.wait_for_function('window.__REID_DIAGNOSTICS().network.state === "connected"',timeout=20000)
  record('Actual WebRTC DataChannel connects independent browser contexts')
  click(host,'ready');click(guest,'ready')
  host.locator('[data-act="start-room"]').wait_for(state='visible')
  host.wait_for_timeout(300);click(host,'start-room')
  for page in pages:page.wait_for_function('window.__REID_DIAGNOSTICS().page === "raid"',timeout=20000)
  hs,gs=diagnostics(host)['snapshot'],diagnostics(guest)['snapshot']
  assert hs['raidId']==gs['raidId'] and len(hs['players'])==len(gs['players'])==2
  assert [(c['id'],[i['id'] for i in c['items']]) for c in hs['containers']]==[(c['id'],[i['id'] for i in c['items']]) for c in gs['containers']]
  assert hs['players'][0]['gear']['primary']['children']['stock']['def']==candidate
  record('Shared start, host-authoritative loot, matching customized equipment')
  click(host,'resume');host.mouse.move(700,450);host.keyboard.down('KeyW');host.wait_for_timeout(800);host.keyboard.up('KeyW')
  host.mouse.down();host.wait_for_timeout(180);host.mouse.up();host.keyboard.press('Escape')
  host.wait_for_timeout(300)
  now=diagnostics(host)['snapshot'];assert now['tick']>hs['tick']
  me=next(p for p in now['players'] if p['id']==diagnostics(host)['profile']['id']);before=next(p for p in hs['players'] if p['id']==me['id'])
  assert sum((me['p'][i]-before['p'][i])**2 for i in [0,2])>.25,'Keyboard input did not move the player'
  assert me['gear']['primary']['children']['magazine']['rounds']<before['gear']['primary']['children']['magazine']['rounds'],'Mouse input did not fire'
  peer_state=diagnostics(guest)['snapshot']
  assert peer_state['raidId']==now['raidId'] and len(peer_state['players'])==2
  record('Raid progresses with genuine keyboard/mouse input and shared snapshots')
  host.screenshot(path=str(ROOT/'artifacts/browser-raid.png'))
  assert not errors,errors
  record('No browser page errors during exercised smoke path')
  report['status']='PASS'
  for context in contexts:context.close()
  browser.close()
except Exception as exc:
 text=str(exc)
 blocked=any(word in text for word in ['ERR_BLOCKED_BY_ADMINISTRATOR','BLOCKED_CAPABILITY','Executable doesn\'t exist','No module named','BrowserType.launch'])
 report.update(status='BLOCKED' if blocked else 'FAIL',error=text)
finally:
 if server:
  server.terminate()
  try:server.wait(timeout=4)
  except subprocess.TimeoutExpired:server.kill()
 report['checks']=checks
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
 sys.exit(0 if report['status']=='PASS' else 2 if report['status']=='BLOCKED' else 1)
