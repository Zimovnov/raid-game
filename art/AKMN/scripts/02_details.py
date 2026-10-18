exec(compile(open(__file__.replace('02_details.py','common.py')).read(),__file__.replace('02_details.py','common.py'),'exec'))
# Rerun only this task's detail objects, leaving blockout and other scenes alone.
for o in list(source.objects):
    if o.get('detail_stage'):bpy.data.objects.remove(o,do_unlink=True)
before=set(source.objects)
for side in (-1,1):
    for y,z,r in [(-.126,.009,.0034),(-.114,-.021,.0025),(-.066,-.023,.003),(.020,-.021,.003),(.099,.010,.0036),(.112,.028,.0033),(.061,-.011,.0025)]:
        tube('Rivet'+str((side,y,z)),(side*.0163,y,z),(side*.0188,y,z),r,steel,vertices=20)
    path('ReceiverRolledEdge'+str(side),[(side*.0173,-.13,-.034),(side*.0173,.11,-.034)],.0009,steel,sides=6)
    path('CoverSideStamp'+str(side),[(side*.0184,-.113,.032),(side*.019,-.105,.034),(side*.019,.061,.034)],.0012,steel,sides=8)
    # Shallow depressed oval stamping visible ahead of trigger axis.
    cavity=box('DimpleCutter',(side*.018,.052,-.022),(.009,.021,.008),black,bevel=.003)
    cut(bpy.data.objects['AKMN_Receiver'],cavity)
    box('DimpleInterior'+str(side),(side*.0139,.052,-.022),(.0006,.017,.005),steel,bevel=.0015)
    for y in (.140,.169,.198,.225):
        box('HandguardVent'+str((side,y)),(side*.0178,y,.017),(.004,.016,.006),black,bevel=.001)
    for y,z in [(-.385,-.010),(-.385,-.072),(-.155,-.018)]:
        tube('FurnitureScrew'+str((side,y,z)),(side*.018,y,z),(side*.020,y,z),.0018,steel,vertices=16)
    # A separate normal-mapped checkering panel follows the grip rake.
    panel=profile('GripCheckering'+str(side),[(-.113,-.065),(-.092,-.071),(-.106,-.143),(-.131,-.137)],.0008,poly,x=side*.0142,bevel=.0007)
    panel['checkering']=True
for y,z,w,h in [(.121,-.003,.040,.052),(.25,-.001,.037,.043),(.129,.045,.029,.031),(.238,.044,.027,.030)]:
    loft('FurnitureFerrule'+str(y)+str(z),[(y-.002,z,w,h),(y+.002,z,w,h)],steel)
box('RearTrunnionTang',(0,-.166,.024),(.011,.045,.003),steel)
tube('TangScrew',(0,-.177,.025),(0,-.177,.027),.003,steel,vertices=24)
box('CoverLatch',(0,-.139,.052),(.011,.016,.009),steel,bevel=.001)
for y in (-.144,-.140,-.136):box('LatchSerration'+str(y),(0,y,.057),(.011,.0007,.001),edge,bevel=.0001)
# Right-side port and moving external carrier are intentionally visual-only.
cut(bpy.data.objects['AKMN_Receiver'],box('PortCutter',(.016,.048,.040),(.017,.076,.022),black,bevel=.003))
box('PortDarkInterior',(.009,.048,.038),(.001,.073,.021),black)
box('Carrier',(.014,.048,.040),(.010,.064,.014),steel,'bolt_carrier',.001)
tube('ChargingHandle',(.014,.052,.039),(.043,.055,.039),.0035,steel,'bolt_carrier',24)
box('HandleTab',(.043,.055,.040),(.011,.018,.005),steel,'bolt_carrier',.0014)
# Selector's origin will be the rear circular pivot, never the mesh centre.
profile('Selector',[(-.087,.009),(-.087,.021),(-.075,.025),(.080,.019),(.097,.010),(.094,.004),(.075,.005),(-.073,.013)],.003,steel,'selector',.0006,x=.0197)
tube('SelectorPivot',(.019,-.080,.018),(.022,-.080,.018),.007,steel,'selector',24)
box('SelectorThumb',(.025,.083,.012),(.014,.017,.005),steel,'selector',.0008)
for y in (.075,.079,.083,.087):box('SelectorGrip'+str(y),(.029,y,.015),(.006,.0007,.001),edge,'selector',.00015)
# Stepped left mounting rail based on reference 3; historical subvariant unconfirmed.
rail=profile('SideRailBase',[(-.102,-.016),(.039,-.016),(.052,-.007),(.037,.006),(-.080,.011),(-.110,.001)],.005,steel,x=-.0205,bevel=.0006)
profile('SideRailDovetail',[(-.089,-.010),(.036,-.010),(.036,.004),(-.075,.010),(-.089,.005)],.009,steel,x=-.0245,bevel=.0007)
for y in (-.063,.008):
    cut(bpy.data.objects['AKMN_SideRailDovetail'],box('RailRecess',(-.029,y,-.004),(.009,.030,.012),black,bevel=.003))
for y,z in [(-.099,-.004),(-.045,-.004),(.043,-.006)]:tube('RailFastener'+str(y),(-.029,y,z),(-.032,y,z),.003,steel,vertices=24)
path('RailUpperLip',[(-.031,-.081,.009),(-.031,.033,.003)],.0010,edge,sides=6)
# Sling loops preserve their negative space.
for y,z in [(-.365,-.090),(.250,-.020)]:
    path('SlingLoop'+str(y),[(-.020,y-.006,z),(-.031,y-.007,z-.004),(-.034,y-.005,z-.022),(-.030,y+.009,z-.024),(-.021,y+.011,z-.003),(-.020,y-.006,z)],.0014,steel,sides=8)
for side in (-1,1):
    for i in range(8):box('SightTick'+str((side,i)),(side*.0045,.074+i*.004,.086),(.002,.00045,.0002),edge,bevel=0)
for o in source.objects:
    if o not in before:o['detail_stage']=True
for f in bpy.data.objects['AKMN_DustCover'].data.polygons:
    if len(f.vertices)==4:f.use_smooth=True
save('02_Detail');render('02','perspective');render('02','right');render('02','rail')
result={'source_objects':len(source.objects),'stage':'detail'}
