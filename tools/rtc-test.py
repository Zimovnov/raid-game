"""Real WebRTC between two independent Chromium processes. No HTTP navigation.
The test substitutes ONLY signaling delivery with an automation IPC bridge.
Production Session + Transport create their actual RTCPeerConnection/DataChannel,
validate messages and exchange gameplay packets. This does not validate PeerServer,
public hosting, NAT traversal, rendering, UI input or IndexedDB integration.
No browser policy or security setting is changed.
"""
from pathlib import Path
from collections import deque
import json,os,shutil,time,sys
ROOT=Path(__file__).resolve().parents[1]
report={'scope':__doc__.strip(),'status':'NOT RUN','checks':[]}
checks=report['checks']
def passed(name,**detail):checks.append({'test':name,'status':'PASS',**detail})
signals=deque()
bridgeTypes=[]
# Read only: record why this managed environment cannot expose UDP candidates.
try:
 policy=json.loads(Path('/etc/chromium/policies/managed/000_policy_merge.json').read_text())
 report['environmentPolicy']={k:policy[k] for k in ['WebRtcIPHandling','URLBlocklist'] if k in policy}
except (OSError,ValueError):pass
try:
 from playwright.sync_api import sync_playwright
 with sync_playwright() as pw:
  exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
  args={'headless':True}
  if exe:args['executable_path']=exe
  browsers=[pw.chromium.launch(**args),pw.chromium.launch(**args)]
  report['browserVersions']=[b.version for b in browsers]
  pages=[b.new_page() for b in browsers]
  for n,page in enumerate(pages):
   page.expose_function('deliverSignal',lambda msg,n=n:signals.append((n,msg)))
   page.add_script_tag(content=ROOT.joinpath('artifacts/isolated-test-bundle.js').read_text())
   page.evaluate('''(index)=>{
    const P=localModule('src/domain/profile.js');
    const I=localModule('src/domain/items.js');
    const {Session}=localModule('src/network/session.js');
    window.fixture={profile:P.newProfile({name:index?'Тест Гость':'Тест Хозяин',faction:index?'USEC':'BEAR',face:index,outfit:index}),snapshot:null,replies:[],errors:[],lost:[]};
    const f=fixture;
    if(!index)f.profile=P.applyBuild(f.profile,f.profile.gear.primary.id,I.presetOf(I.replacePreview(f.profile.gear.primary,'stock','ak_skeleton')));
    f.session=new Session(f.profile,{
     lobby:s=>f.lobby=s,
     snapshot:s=>{f.snapshot=s;const me=s.players.find(a=>a.id===f.profile.id);if(me?.result&&f.profile.pending)f.profile=P.applyResult(f.profile,me.result);},
     error:s=>f.errors.push(s),lost:s=>{f.lost.push(s);if(f.profile.pending)f.profile=P.recovery(f.profile);},
     prepare:async(id,map)=>{f.profile=P.prepareRaid(f.profile,id,map);return f.profile.pending.gear;},
     started:async()=>{f.profile=P.activateRaid(f.profile);},reply:r=>f.replies.push(r)
    });
    const t=f.session.transport;
    // Intentional fixture seam: PeerServer signaling only, never gameplay packets.
    t.open=async()=>{t.config={iceServers:[],signalUrl:'fixture:ipc'};t.diagnostics.signaling='test IPC bridge';};
    t.signal=packet=>window.deliverSignal(JSON.parse(JSON.stringify({...packet,src:t.id})));
    f.timer=setInterval(()=>f.session.tick(),33);
    window.fixtureState=()=>({lobby:f.lobby,snapshot:f.snapshot,profile:f.profile,connected:f.session.connected,replies:f.replies,errors:f.errors,lost:f.lost,diag:t.diagnostics,peers:[...t.links.values()].map(l=>({state:l.pc.connectionState,channel:l.channel?.readyState,received:t.diagnostics.received,sent:t.diagnostics.sent}))});
   }''',n)
  ids=[p.evaluate('fixture.session.transport.id') for p in pages]
  def pump(duration=.1):
   deadline=time.monotonic()+duration
   while time.monotonic()<deadline:
    for p in pages:p.wait_for_timeout(8)
    while signals:
     source,msg=signals.popleft();bridgeTypes.append(msg.get('type'))
     if msg.get('dst') in ids:
      target=ids.index(msg['dst']);pages[target].evaluate('(msg)=>fixture.session.transport.handleSignal(msg)',msg)
  def wait(expression,idx=0,timeout=15):
   end=time.monotonic()+timeout
   while time.monotonic()<end:
    pump(.05)
    if pages[idx].evaluate(expression):return
   report['peerStates']=[p.evaluate('[...fixture.session.transport.links.values()].map(l=>({state:l.pc.connectionState,ice:l.pc.iceConnectionState,gathering:l.pc.iceGatheringState,signal:l.pc.signalingState,local:l.pc.localDescription?.type,remote:l.pc.remoteDescription?.type,candidateLines:(l.pc.localDescription?.sdp.match(/a=candidate:/g)||[]).length,channel:l.channel?.readyState}))') for p in pages]
   raise AssertionError('Timed out: '+expression+'; diagnostics='+json.dumps([p.evaluate('({diag:fixture.session.transport.diagnostics,errors:fixture.errors})') for p in pages],ensure_ascii=False))
  code=pages[0].evaluate('fixture.session.create()')
  pages[1].evaluate('(code)=>fixture.session.join(code)',code)
  wait('fixture.session.connected',1)
  wait('fixture.lobby.members.length===2')
  for p in pages:
   links=p.evaluate('fixtureState().peers');assert len(links)==1 and links[0]['channel']=='open' and links[0]['state']=='connected',links
  passed('Two independent Chromium processes: genuine RTCDataChannel opens, Session lobby has two members')
  # Ready + asynchronous prepare/start, profiles have independent identities.
  for p in pages:p.evaluate('fixture.session.ready(true)')
  wait('fixture.lobby.members.every(m=>m.ready)')
  pages[0].evaluate('fixture.session.start()')
  wait('fixture.snapshot?.players.length===2',1)
  assert pages[0].evaluate('fixture.snapshot.raidId')==pages[1].evaluate('fixture.snapshot.raidId')
  assert pages[1].evaluate('fixture.snapshot.players[0].gear.primary.children.stock.def')=='ak_skeleton'
  passed('Ready/load gate, common raid ID and customized host weapon reach the guest')
  # Guest INPUT actually crosses WebRTC and advances authoritative host simulation.
  before=pages[0].evaluate('fixture.session.world.players.get(fixture.lobby.members[1].id).p.slice()')
  pages[1].evaluate('''()=>{const {noInput}=localModule('src/domain/util.js');fixture.inputTimer=setInterval(()=>fixture.session.input({...noInput(),seq:(fixture.seq=(fixture.seq||0)+1),right:1}),35);}''')
  pump(.6)
  pages[1].evaluate('clearInterval(fixture.inputTimer)')
  after=pages[0].evaluate('fixture.session.world.players.get(fixture.lobby.members[1].id).p.slice()')
  assert sum((a-b)**2 for a,b in zip(before,after))>.2,(before,after)
  passed('Guest INPUT over DataChannel changes the authoritative player position')
  # Concurrent action fixture puts both actors by one object. This is NOT UI-driven navigation.
  info=pages[0].evaluate('''()=>{const {createItem}=localModule('src/domain/items.js'),{uid,noInput}=localModule('src/domain/util.js');const w=fixture.session.world;for(const b of w.bots)b.nextThink=1e9;const at=w.map.spawn[0];for(const a of w.players.values()){a.p=[...at];a.input=noInput();}const item=createItem('loot_electronics_02');w.containers.push({id:'rtc-single-loot',name:'Фикстура',p:[at[0],at[1]+.85,at[2]-1],items:[item],revision:0,loose:true});return {id:item.id,request:uid()};}''')
  req={'type':'take','target':'rtc-single-loot','item':info['id'],'revision':0}
  pages[1].evaluate('(r)=>fixture.session.action(r)',dict(req,id='race-guest'))
  pages[0].evaluate('(r)=>fixture.session.action(r)',dict(req,id='race-host'))
  wait('fixture.replies.some(r=>r.id==="race-guest")',1)
  amount=pages[0].evaluate('(id)=>[...fixture.session.world.players.values()].flatMap(a=>a.gear.bag).filter(i=>i.id===id).length',info['id'])
  assert amount==1
  pages[1].evaluate('(r)=>fixture.session.action(r)',dict(req,id='race-guest'));pump(.2)
  assert pages[0].evaluate('(id)=>[...fixture.session.world.players.values()].flatMap(a=>a.gear.bag).filter(i=>i.id===id).length',info['id'])==1
  passed('Concurrent take plus replay: exactly one instance across both backpacks; fixture positions, real action channel')
  # Native channel closure; same live session reconnects over new ICE/DataChannel.
  pages[1].evaluate('fixture.session.transport.remove(fixture.session.hostPeer,true)')
  wait('!fixture.session.connected',1,5)
  wait('fixture.session.connected',1,20)
  wait('fixture.snapshot?.players.length===2',1)
  assert pages[0].evaluate('fixture.session.world.players.size')==2
  passed('Guest real channel close/reconnect: same identity, two players, no clone')
  # Separate terminal results: guest dies; host continues and extracts.
  pages[0].evaluate('''()=>{const w=fixture.session.world,guest=w.players.get(fixture.lobby.members[1].id);w.finish(guest,'dead');}''')
  wait('fixture.profile.pending===null',1)
  assert pages[0].evaluate('fixture.session.world.players.get(fixture.profile.id).status')=='active'
  assert pages[1].evaluate('fixture.profile.gear.primary===null')
  passed('Guest death is applied once to guest profile while host remains active (in-memory persistence hooks)')
  pages[0].evaluate('''()=>{const w=fixture.session.world,a=w.players.get(fixture.profile.id);a.p=[...w.map.exits[0].p];a.input=localModule('src/domain/util.js').noInput();for(let n=0;n<245;n++)w.step();}''')
  wait('fixture.profile.pending===null')
  assert pages[0].evaluate('fixture.profile.stats.extracted')==1
  before=pages[0].evaluate('fixture.profile.applied.length');pump(.3)
  assert pages[0].evaluate('fixture.profile.applied.length')==before
  passed('Host extraction timer succeeds independently; repeated snapshots do not duplicate results')
  for p in pages:
   assert p.evaluate('fixture.session.transport.diagnostics.received')>0
   assert p.evaluate('fixture.session.transport.diagnostics.sent')>0
   p.evaluate('clearInterval(fixture.timer);fixture.session.close()')
  for b in browsers:b.close()
  report['status']='PASS'
except Exception as exc:
 text=str(exc);no_candidates=report.get('peerStates') and all(l['candidateLines']==0 and l['gathering']=='complete' for p in report['peerStates'] for l in p)
 managed_udp=no_candidates and report.get('environmentPolicy',{}).get('WebRtcIPHandling')=='disable_non_proxied_udp'
 report['status']='BLOCKED' if managed_udp or any(s in text for s in ['ERR_BLOCKED','NotAllowed','Executable','BrowserType.launch','RTCPeerConnection is not defined','No module named']) else 'FAIL';report['error']=text
report['signalingPackets']={t:bridgeTypes.count(t) for t in set(bridgeTypes)}
try:
 report['peerStates']=[p.evaluate('[...fixture.session.transport.links.values()].map(l=>({state:l.pc.connectionState,ice:l.pc.iceConnectionState,gathering:l.pc.iceGatheringState,signal:l.pc.signalingState,local:l.pc.localDescription?.type,remote:l.pc.remoteDescription?.type,channel:l.channel?.readyState}))') for p in pages]
except Exception:pass
ROOT.joinpath('artifacts/rtc-test.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
sys.exit(0 if report['status']=='PASS' else 2 if report['status']=='BLOCKED' else 1)
