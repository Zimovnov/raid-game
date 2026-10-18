"""DOM-only verification of actual UI templates. No rendering, storage or RTC mocks.
This deliberately does not claim an end-to-end game test.
"""
from pathlib import Path
import json, os, shutil, sys
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'artifacts/ui-test.json'
checks=[]
try:
 from playwright.sync_api import sync_playwright
 with sync_playwright() as pw:
  executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
  kwargs={'headless':True}
  if executable: kwargs['executable_path']=executable
  browser=pw.chromium.launch(**kwargs)
  page=browser.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content('<style>'+ROOT.joinpath('style.css').read_text()+'</style><canvas id="scene"></canvas><main id="app"></main><div id="toast"></div>')
  page.add_script_tag(content=ROOT.joinpath('artifacts/isolated-test-bundle.js').read_text())
  page.evaluate('''() => {
   const {newProfile}=localModule('src/domain/profile.js');
   const {DEFAULT_SETTINGS}=localModule('src/persistence/store.js');
   const {World}=localModule('src/simulation/world.js');const {MAPS}=localModule('src/content/maps.js');
   const p=newProfile({name:'Михаил Соколов',faction:'BEAR',face:0,outfit:0});
   const world=new World(MAPS.factory,'dom-fixture');world.addPlayer(p.id,p.character,p.gear);
   window.vm={page:'main',profile:p,character:p.character,settings:structuredClone(DEFAULT_SETTINGS),selected:'',
    preview:p.gear.primary,original:p.gear.primary,slot:'stock',trader:0,mapId:'factory',search:'',
    lobby:null,host:false,code:'',network:'',connected:false,result:null,saving:false,
    snapshot:world.snapshot(),overlay:'',containerId:'',pendingNav:'',isRange:false,bind:''};
   window.renderFixture=(name)=>{vm.page=name;document.querySelector('#app').innerHTML=localModule('src/ui/views.js').screen(vm);};
  }''')
  pages=['main','character','wardrobe','stash','gunsmith','traders','quests','maps','lobby','settings','about','raid']
  for width,height in [(1280,720),(1920,1080),(2560,1440),(3440,1440)]:
   page.set_viewport_size({'width':width,'height':height})
   for name in pages:
    page.evaluate('(name)=>renderFixture(name)',name)
    info=page.evaluate('''() => ({text:document.querySelector('#app').innerText.length,
      buttons:document.querySelectorAll('button').length,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
      visibleHeadings:[...document.querySelectorAll('h1,h2')].map(x=>x.textContent),
      emptyButtons:[...document.querySelectorAll('button')].filter(x=>!x.textContent.trim()&&!x.getAttribute('aria-label')).length})''')
    ok=info['text']>50 and not info['horizontalOverflow'] and info['emptyButtons']==0
    checks.append({'test':name,'viewport':[width,height],'status':'PASS' if ok else 'FAIL',**info})
  # Actual templates use escaping; malformed names cannot inject executable tags.
  safe=page.evaluate('''() => {vm.character.name='<img src=x onerror=alert(1)>';renderFixture('character');return !document.querySelector('img[onerror]')&&document.querySelector('#character-name').value===vm.character.name;}''')
  checks.append({'test':'HTML escaping in character field','status':'PASS' if safe else 'FAIL'})
  page.evaluate("vm.character.name='Михаил Соколов';renderFixture('maps')")
  map_count=page.locator('[data-act="map"]').count()
  checks.append({'test':'five distinct map selection controls','status':'PASS' if map_count==5 else 'FAIL','count':map_count})
  page.evaluate("renderFixture('gunsmith')")
  checks.append({'test':'actual weapon slot/module controls','status':'PASS' if page.locator('[data-act="slot"]').count()>=6 and page.locator('[data-act="module"]').count()>=2 else 'FAIL'})
  capabilities=page.evaluate('''() => ({webgl2:!!document.createElement('canvas').getContext('webgl2'),
    rtc:typeof RTCPeerConnection!=='undefined',indexedDB:typeof indexedDB!=='undefined',userAgent:navigator.userAgent})''')
  checks.append({'test':'DOM JavaScript errors','status':'PASS' if not errors else 'FAIL','errors':errors})
  browser.close()
  report={'scope':'DOM templates only, isolated local trusted source. No game controller/renderer/IndexedDB/WebRTC integration was executed.',
    'status':'PASS' if all(x['status']=='PASS' for x in checks) else 'FAIL','checks':checks,'capabilities':capabilities}
except Exception as exc:
 report={'scope':'DOM templates only','status':'BLOCKED','error':str(exc),'checks':checks}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='checks'},ensure_ascii=False,indent=2))
print('Checks:',len(checks),'Passed:',sum(c['status']=='PASS' for c in checks))
sys.exit(0 if report['status']=='PASS' else 2 if report['status']=='BLOCKED' else 1)
