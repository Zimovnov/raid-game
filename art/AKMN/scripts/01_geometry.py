exec(compile(open(__file__.replace('01_geometry.py','common.py')).read(),__file__.replace('01_geometry.py','common.py'),'exec'))
remove_owned(source)
# External artistic shell only; no functional manufacturing internals.
profile('Receiver',[(-.145,-.037),(.119,-.037),(.122,.042),(.09,.056),(-.124,.052),(-.145,.027)],.033)
loft('Buttstock',[(-.397,-.042,.038,.107),(-.388,-.04,.042,.106),(-.31,-.022,.035,.085),(-.25,-.009,.030,.067),(-.223,-.014,.027,.044),(-.186,-.009,.027,.046),(-.143,-.004,.028,.05)])
loft('Buttplate',[(-.4,-.042,.040,.109),(-.396,-.042,.040,.109)],steel)
loft('LowerHandguard',[(.113,-.008,.037,.053),(.125,-.01,.046,.059),(.150,-.006,.043,.047),(.222,-.005,.041,.044),(.247,-.004,.033,.039),(.252,-.004,.032,.038)])
loft('UpperHandguard',[(.127,.043,.026,.028),(.136,.044,.033,.031),(.230,.045,.029,.028),(.238,.044,.025,.026)])
# Cover uses a domed, open-bottom shell section, not a cylinder.
vs=[];ys=[-.14,-.128,-.105,.065,.084]
section=[(-.018,.030),(-.018,.043),(-.016,.055),(-.010,.066),(0,.070),(.010,.066),(.016,.055),(.018,.043),(.018,.030)]
for k,y in enumerate(ys):
    scale=.70 if k==0 else .9 if k==4 else 1
    vs.extend((x,y,.030+(z-.030)*scale) for x,z in section)
fs=[tuple(range(8,-1,-1)),tuple(range(36,45))]+[(i*9+j,i*9+j+1,(i+1)*9+j+1,(i+1)*9+j) for i in range(4) for j in range(8)]+[(i*9,(i+1)*9,(i+1)*9+8,i*9+8) for i in range(4)]
mesh('DustCover',vs,fs,steel,bevel=.0007)
for y in (-.09,-.028,.038):path('CoverRib'+str(y),[(x*1.02,y,z+.0007) for x,z in section[1:-1]],.0013,steel,sides=8)
tube('Barrel',(0,.215,.013),(0,.463,.013),.0087)
tube('GasTube',(0,.237,.045),(0,.320,.045),.010)
tube('GasBlockCollar',(0,.302,.013),(0,.324,.013),.013)
profile('GasBlock',[(.304,.014),(.324,.014),(.326,.025),(.31,.054),(.298,.054),(.298,.040)],.021)
tube('CleaningRod',(0,.247,-.012),(0,.453,-.012),.0018,edge,vertices=20)
profile('Grip',[(-.119,-.032),(-.070,-.033),(-.075,-.051),(-.087,-.070),(-.100,-.150),(-.112,-.158),(-.144,-.151),(-.143,-.137),(-.117,-.066)],.027,poly,bevel=.003)
# Magazine: curved annular strip, cross section rotates continuously.
def magshape(name,width,depth,mat,bone='magazine',start=0,end=1):
    vs=[];n=25
    for i in range(n):
        t=start+(end-start)*i/(n-1);a=t*.72
        y=.072+.28*(1-math.cos(a));z=-.018-.28*math.sin(a)
        for x,d in [(-width/2,-depth/2),(width/2,-depth/2),(width/2,depth/2),(-width/2,depth/2)]:vs.append((x,y+d*math.cos(a),z+d*math.sin(a)))
    fs=[(3,2,1,0),tuple(range((n-1)*4,n*4))]+[(i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j) for i in range(n-1) for j in range(4)]
    return mesh(name,vs,fs,mat,bone,.0012)
magshape('MagazineShell',.026,.064,steel)
magshape('MagazineFloorplate',.030,.070,steel,start=.975,end=1.018)
box('MagazineTop',(0,.072,-.018),(.022,.059,.006),black,'magazine')
for side in (-1,1):
    for n in range(4):
        d=-.023+n*.015
        pts=[]
        for i in range(22):
            t=.08+.83*i/21;a=t*.72
            pts.append((side*.014,.072+.28*(1-math.cos(a))+d*math.cos(a),-.018-.28*math.sin(a)+d*math.sin(a)))
        path('MagazineFlute'+str(side)+str(n),pts,.0016,steel,'magazine',8)
    for d in (-.032,.032):
        pts=[]
        for i in range(25):
            a=i/24*.72;pts.append((side*.0125,.072+.28*(1-math.cos(a))+d*math.cos(a),-.018-.28*math.sin(a)+d*math.sin(a)))
        path('MagazineSeam'+str(side)+str(d),pts,.0010,edge,'magazine',6)
# Open trigger guard, trigger and release are distinct rigid parts.
path('TriggerGuard',[(0,-.093,-.040),(0,-.094,-.068),(0,-.086,-.075),(0,-.035,-.075),(0,-.025,-.065),(0,-.021,-.037)],.003,steel,sides=8)
path('Trigger',[(0,-.055,-.039),(0,-.057,-.050),(0,-.053,-.061),(0,-.047,-.064)],.0023,steel,'trigger',10)
profile('MagazineRelease',[(-.025,-.038),(-.013,-.039),(-.018,-.061),(-.029,-.068),(-.032,-.06)],.012,steel,'mag_release')
profile('RearSightBase',[(.075,.033),(.127,.033),(.125,.076),(.089,.082),(.076,.072)],.027)
box('RearSightLeaf',(0,.093,.083),(.014,.055,.005),steel)
for side in (-1,1):box('RearNotchEar'+str(side),(side*.006,-.0+.067,.088),(.008,.006,.013),steel,bevel=.0003)
box('RearNotchBridge',(0,.067,.081),(.021,.006,.0025),steel)
box('SightSlider',(0,.101,.086),(.025,.009,.006),steel)
# Front sight has a real open triangular support and an open protecting hood.
tube('FrontSightCollar',(0,.437,.013),(0,.451,.013),.0125)
for side in (-1,1):
    profile('FrontSightLeg'+str(side),[(.436,.017),(.450,.019),(.440,.075),(.434,.077)],.004,steel,x=side*.008)
box('FrontSightBridge',(0,.437,.069),(.024,.011,.008))
path('FrontHood',[(.012*math.cos(a),.437,.090+.012*math.sin(a)) for a in [math.radians(35+i*290/28) for i in range(29)]],.0020,steel,sides=10)
tube('FrontPost',(0,.437,.073),(0,.437,.088),.00115,steel,vertices=16)
# Slant muzzle, annular front face and short dark recess.
vs=[];n=40
for y,r,slant in [(.458,.010,0),(.477,.010,.003),(.477,.0046,.003),(.469,.0046,0)]:
    vs.extend((math.cos(a)*r,y+math.sin(a)*slant,.013+math.sin(a)*r) for a in [i*2*math.pi/n for i in range(n)])
fs=[(j,(j+1)%n,n+(j+1)%n,n+j) for j in range(n)]+[(n+j,n+(j+1)%n,2*n+(j+1)%n,2*n+j) for j in range(n)]+[(2*n+j,2*n+(j+1)%n,3*n+(j+1)%n,3*n+j) for j in range(n)]
mesh('SlantMuzzle',vs,fs,steel,bevel=.0002)
tube('MuzzleRecess',(0,.468,.013),(0,.469,.013),.0045,black)
setup_studio();save('01_Blocking')
result={'source_objects':len(source.objects),'stage':'blocking'}
