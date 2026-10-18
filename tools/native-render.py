"""Linux-only independent GLES3 smoke test of actual shaders/mesh data using Mesa EGL.
Does not load the browser application. No managed Chromium policies are changed.
Requires system libEGL and Pillow (only for artifact PNGs).
"""
from pathlib import Path
import ctypes as C,json,sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'artifacts/native-fixtures';report={'scope':'Native GLES3 shader/geometry smoke; NOT browser WebGL2 renderer/integration. Overview diagnostic fixtures disable fog; ordinary views keep game fog.'}
checks=[]
try:
 E=C.CDLL('libEGL.so.1');E.eglGetProcAddress.argtypes=[C.c_char_p];E.eglGetProcAddress.restype=C.c_void_p
 def proc(name,ret,args):
  address=E.eglGetProcAddress(name.encode())
  if not address:raise RuntimeError('Missing GL function '+name)
  return C.CFUNCTYPE(ret,*args)(address)
 V=C.c_void_p;I=C.c_int;U=C.c_uint;F=C.c_float;S=C.c_char_p;B=C.c_ubyte
 getdisplay=proc('eglGetPlatformDisplayEXT',V,[U,V,C.POINTER(I)])
 display=getdisplay(0x31DD,None,None)
 def egl(name,ret,args):
  f=getattr(E,name);f.restype=ret;f.argtypes=args;return f
 a,b=I(),I();assert egl('eglInitialize',U,[V,C.POINTER(I),C.POINTER(I)])(display,C.byref(a),C.byref(b))
 assert egl('eglBindAPI',U,[U])(0x30A0)
 attrs=(I*15)(0x3033,1,0x3040,0x40,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3038);config=V();num=I()
 assert egl('eglChooseConfig',U,[V,C.POINTER(I),C.POINTER(V),I,C.POINTER(I)])(display,attrs,C.byref(config),1,C.byref(num)) and num.value
 data=json.loads((D/'manifest.json').read_text());W,H=data['width'],data['height']
 surface=egl('eglCreatePbufferSurface',V,[V,V,C.POINTER(I)])(display,config,(I*5)(0x3057,W,0x3056,H,0x3038));assert surface
 ctx=egl('eglCreateContext',V,[V,V,V,C.POINTER(I)])(display,config,None,(I*3)(0x3098,3,0x3038));assert ctx
 assert egl('eglMakeCurrent',U,[V,V,V,V])(display,surface,surface,ctx)
 getstring=proc('glGetString',S,[U]);report['renderer']=getstring(0x1F01).decode();report['version']=getstring(0x1F02).decode()
 createShader=proc('glCreateShader',U,[U]);source=proc('glShaderSource',None,[U,I,C.POINTER(S),C.POINTER(I)]);compile=proc('glCompileShader',None,[U]);shaderiv=proc('glGetShaderiv',None,[U,U,C.POINTER(I)]);shaderlog=proc('glGetShaderInfoLog',None,[U,I,C.POINTER(I),S])
 program=proc('glCreateProgram',U,[])();attach=proc('glAttachShader',None,[U,U])
 for name,kind in [('vertex',0x8B31),('fragment',0x8B30)]:
  shader=createShader(kind);text=(D/(name+'.glsl')).read_bytes();source(shader,1,(S*1)(text),None);compile(shader);ok=I();shaderiv(shader,0x8B81,C.byref(ok))
  if not ok.value:
   log=C.create_string_buffer(4096);shaderlog(shader,4096,None,log);raise RuntimeError(log.value.decode())
  attach(program,shader);checks.append({'test':name+' shader compilation','status':'PASS'})
 proc('glLinkProgram',None,[U])(program);ok=I();proc('glGetProgramiv',None,[U,U,C.POINTER(I)])(program,0x8B82,C.byref(ok));assert ok.value,'Shader link failed'
 proc('glUseProgram',None,[U])(program)
 uniform=proc('glGetUniformLocation',I,[U,S]);u1=proc('glUniform1f',None,[I,F]);u3=proc('glUniform3fv',None,[I,I,C.POINTER(F)]);uarr=proc('glUniform1fv',None,[I,I,C.POINTER(F)]);umat=proc('glUniformMatrix4fv',None,[I,I,B,C.POINTER(F)])
 genvao=proc('glGenVertexArrays',None,[I,C.POINTER(U)]);bindvao=proc('glBindVertexArray',None,[U]);genbuf=proc('glGenBuffers',None,[I,C.POINTER(U)]);bindbuf=proc('glBindBuffer',None,[U,U]);bufferdata=proc('glBufferData',None,[U,C.c_ssize_t,V,U]);enableattr=proc('glEnableVertexAttribArray',None,[U]);attrib=proc('glVertexAttribPointer',None,[U,I,U,B,I,V]);divisor=proc('glVertexAttribDivisor',None,[U,U]);draw=proc('glDrawArraysInstanced',None,[U,I,I,I]);geterror=proc('glGetError',U,[])
 clearcolor=proc('glClearColor',None,[F,F,F,F]);clear=proc('glClear',None,[U]);proc('glViewport',None,[I,I,I,I])(0,0,W,H);proc('glEnable',None,[U])(0x0B71)
 buffers={}
 for shape in ['box','cylinder','sphere','cone','wedge']:
  vao=U();genvao(1,C.byref(vao));bindvao(vao);vbo=U();genbuf(1,C.byref(vbo));bindbuf(0x8892,vbo);vertices=(D/(shape+'.bin')).read_bytes();buf=C.create_string_buffer(vertices);bufferdata(0x8892,len(vertices),buf,0x88E4)
  for location,offset in [(0,0),(1,12)]:enableattr(location);attrib(location,3,0x1406,0,24,V(offset))
  ibo=U();genbuf(1,C.byref(ibo));bindbuf(0x8892,ibo)
  for location in range(2,7):enableattr(location);attrib(location,4,0x1406,0,80,V((location-2)*16));divisor(location,1)
  buffers[shape]=(vao,ibo,len(vertices)//24)
 u3(uniform(program,b'uLightPos'),2,(F*6)(0,0,0,0,0,0));u3(uniform(program,b'uLightDir'),2,(F*6)(0,0,-1,0,0,-1));uarr(uniform(program,b'uLightOn'),2,(F*2)(0,0));u1(uniform(program,b'uFogNear'),55)
 for fixture in data['fixtures']:
  u1(uniform(program,b'uFogNear'),fixture.get('fogNear',55));clearcolor(*fixture['fog'],1);clear(0x4000|0x0100);u3(uniform(program,b'uEye'),1,(F*3)(*fixture['eye']));u3(uniform(program,b'uFog'),1,(F*3)(*fixture['fog']));umat(uniform(program,b'uViewProjection'),1,0,(F*16)(*fixture['vp']))
  instances=0
  for shape,info in fixture['files'].items():
   vao,ibo,n=buffers[shape];bindvao(vao);bindbuf(0x8892,ibo);raw=(D/info['file']).read_bytes();buf=C.create_string_buffer(raw);bufferdata(0x8892,len(raw),buf,0x88E4);draw(4,0,n,info['count']);instances+=info['count']
  proc('glFinish',None,[])();error=geterror();pixels=(B*(W*H*4))();proc('glReadPixels',None,[I,I,I,I,U,U,V])(0,0,W,H,0x1908,0x1401,pixels)
  image=Image.frombytes('RGBA',(W,H),bytes(pixels)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB');image.save(ROOT/'artifacts'/('native-'+fixture['name']+'.png'))
  colors=len(image.resize((120,75)).getcolors(9000) or []);ok=error==0 and colors>15
  checks.append({'test':fixture['name'],'status':'PASS' if ok else 'FAIL','glError':error,'instances':instances,'sampleColors':colors})
 report['status']='PASS' if all(x['status']=='PASS' for x in checks) else 'FAIL'
except Exception as exc:report.update(status='BLOCKED',error=str(exc))
report['checks']=checks;(ROOT/'artifacts/native-render.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(0 if report['status']=='PASS' else 2 if report['status']=='BLOCKED' else 1)
