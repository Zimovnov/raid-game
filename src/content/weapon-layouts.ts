import type { Vec3 } from '../domain/types.js';
// Shared virtual model anchors for rendering and authoritative obstruction checks.
export interface WeaponLayout { anchors: Record<string, Vec3>; support: Vec3; aimHeight: number; opticAimHeight: number; mountedOpticAimHeight: number; muzzle: Vec3; }
const standard: WeaponLayout = {anchors:{stock:[0,-.018,.38],handguard:[0,.007,-.285],pistolgrip:[0,-.15,.14],magazine:[0,-.23,-.054],muzzle:[0,.023,-.76],mount:[0,.11,0],optic:[0,.16,-.02],grip:[0,-.14,-.32],light:[.115,.015,-.34],laser:[-.102,.027,-.32]},support:[-.07,-.11,-.23],aimHeight:.155,opticAimHeight:.22,mountedOpticAimHeight:.24,muzzle:[0,.023,-.76]};
function layout(over: Partial<WeaponLayout>, anchors: Record<string,Vec3> = {}): WeaponLayout { return {...standard,...over,anchors:{...standard.anchors,...over.anchors,...anchors}}; }
const pistol = (muzzle: number, aimHeight: number) => layout({support:[-.042,-.19,.065],aimHeight,muzzle:[0,.03,muzzle]}, {pistolgrip:[0,-.14,.058],magazine:[0,-.18,.058],light:[0,-.075,-.09]});
const layouts: Record<string,WeaponLayout> = {
    pm:pistol(-.19,.08), tt:pistol(-.235,.083), glock:layout({...pistol(-.195,.074),muzzle:[0,.05315,-.195]}), grach:pistol(-.217,.084),
    ak:standard,akm:standard,
    aksu:layout({muzzle:[0,.022,-.49],support:[-.064,-.11,-.2]}, {handguard:[0,.008,-.225],muzzle:[0,.022,-.49],stock:[0,-.02,.32]}),
    ak103:layout({muzzle:[0,.028,-.8]}, {muzzle:[0,.028,-.8]}),
    hk416:layout({muzzle:[0,.025,-.83],support:[-.07,-.12,-.32]}, {handguard:[0,.02,-.35],muzzle:[0,.025,-.83]}),
    vityaz:layout({muzzle:[0,.023,-.55],support:[-.06,-.10,-.21]}, {handguard:[0,.005,-.23],muzzle:[0,.023,-.55],magazine:[0,-.24,-.085],stock:[0,-.02,.34]}),
    kedr:layout({muzzle:[0,.022,-.235],support:[-.04,-.08,-.12],aimHeight:.105},{stock:[0,.025,.25],pistolgrip:[0,-.14,.07],magazine:[0,-.23,.065]}),
    sks:layout({muzzle:[0,.03,-.88],support:[-.06,-.09,-.37],aimHeight:.107},{stock:[0,-.045,.34],mount:[0,.085,.015]}),
    mosin:layout({muzzle:[0,.031,-1.03],support:[-.06,-.1,-.4],aimHeight:.105},{stock:[0,-.05,.36]}),
    svd:layout({muzzle:[0,.025,-1.01],support:[-.07,-.12,-.39],aimHeight:.135},{stock:[0,-.045,.35],handguard:[0,.008,-.41],magazine:[0,-.18,-.01],mount:[0,.10,.015]}),
    sv98:layout({muzzle:[0,.06,-.99],support:[-.07,-.12,-.38],aimHeight:.145},{stock:[0,-.075,.37],magazine:[0,-.18,-.07],optic:[0,.14,.015]}),
    mp153:layout({muzzle:[0,.022,-.87],support:[-.07,-.11,-.34],aimHeight:.06},{handguard:[0,-.035,-.35],stock:[0,-.02,.39]}),
    shotgun:layout({muzzle:[0,.022,-.88],aimHeight:.055}),
    saiga:layout({muzzle:[0,.022,-.66],support:[-.07,-.14,-.29]}, {handguard:[0,.006,-.29],magazine:[0,-.25,-.055],stock:[0,-.02,.36]}),
    mp5:layout({muzzle:[0,.023,-.53]},{muzzle:[0,.023,-.53]}),
    ak12:layout({muzzle:[0,.025,-.79],support:[-.065,-.12,-.28]}, {handguard:[0,.01,-.31],stock:[0,-.01,.37],muzzle:[0,.025,-.79]}),
    rpk74:layout({muzzle:[0,.024,-1.09],support:[-.07,-.12,-.35]}, {handguard:[0,.006,-.34],stock:[0,-.02,.41],muzzle:[0,.024,-1.09]}),
    asval:layout({muzzle:[0,.03,-.80],support:[-.064,-.11,-.22],aimHeight:.14}, {stock:[0,-.008,.35],handguard:[0,.008,-.205],pistolgrip:[0,-.15,.13],magazine:[0,-.19,-.06],mount:[0,.10,.0]}),
    vss:layout({muzzle:[0,.03,-.86],support:[-.064,-.11,-.225],aimHeight:.14}, {stock:[0,-.012,.35],handguard:[0,.008,-.215],pistolgrip:[0,-.13,.15],magazine:[0,-.18,-.06],mount:[0,.10,.0]}),
    g36:layout({muzzle:[0,.022,-.71],support:[-.066,-.12,-.27],aimHeight:.174,opticAimHeight:.27}, {stock:[0,.02,.37],handguard:[0,-.005,-.28],pistolgrip:[0,-.15,.09],magazine:[0,-.205,-.075],optic:[0,.20,-.01],muzzle:[0,.022,-.71]}),
    scar:layout({muzzle:[0,.032,-.77],support:[-.073,-.12,-.27],aimHeight:.17}, {stock:[0,.025,.41],handguard:[0,.023,-.29],pistolgrip:[0,-.145,.105],magazine:[0,-.22,-.065],muzzle:[0,.032,-.77]}),
    aug:layout({muzzle:[0,.034,-.56],support:[-.045,-.16,-.19],aimHeight:.155}, {stock:[0,-.008,.385],handguard:[0,-.075,-.20],pistolgrip:[0,-.13,-.025],magazine:[0,-.19,.225],optic:[0,.16,-.055],muzzle:[0,.034,-.56],grip:[0,-.17,-.20],light:[.095,-.012,-.25],laser:[-.093,.012,-.25]}),
    mcx:layout({muzzle:[0,.03,-.83],support:[-.065,-.12,-.31]}, {stock:[0,.0,.37],handguard:[0,.015,-.37],pistolgrip:[0,-.15,.125],magazine:[0,-.22,-.055],muzzle:[0,.03,-.83]}),
    bren:layout({muzzle:[0,.027,-.72],support:[-.066,-.12,-.255],aimHeight:.16}, {stock:[0,.013,.38],handguard:[0,.012,-.26],pistolgrip:[0,-.145,.1],magazine:[0,-.218,-.055],muzzle:[0,.027,-.72]}),
    scorpion:layout({muzzle:[0,.026,-.43],support:[-.06,-.11,-.19],aimHeight:.135}, {stock:[0,-.012,.31],handguard:[0,.008,-.21],pistolgrip:[0,-.155,.082],magazine:[0,-.218,-.077],muzzle:[0,.026,-.43],light:[.085,.015,-.22],laser:[-.087,.02,-.21],grip:[0,-.115,-.22]}),
    mpx:layout({muzzle:[0,.027,-.49],support:[-.06,-.11,-.19],aimHeight:.14}, {stock:[0,.018,.29],handguard:[0,.016,-.235],pistolgrip:[0,-.15,.085],magazine:[0,-.22,-.06],muzzle:[0,.027,-.49],grip:[0,-.13,-.22],light:[.095,.008,-.22],laser:[-.09,.022,-.22]}),
    m9a3:pistol(-.242,.082),
    m17:layout({support:[-.042,-.19,.063],aimHeight:.088,mountedOpticAimHeight:.138,muzzle:[0,.032,-.211]}, {pistolgrip:[0,-.14,.061],magazine:[0,-.18,.06],light:[0,-.075,-.09],mount:[0,.075,.044]}),
    rem870:layout({muzzle:[0,.025,-.85],support:[-.065,-.10,-.32],aimHeight:.074}, {stock:[0,-.015,.37],handguard:[0,-.036,-.34],pistolgrip:[0,-.115,.16],mount:[0,.077,.018]}),
    benelli:layout({muzzle:[0,.027,-.89],support:[-.063,-.105,-.35],aimHeight:.11}, {stock:[0,-.014,.39],handguard:[0,-.022,-.355],pistolgrip:[0,-.135,.14],optic:[0,.135,.045]}),
    m14:layout({muzzle:[0,.035,-.98],support:[-.07,-.085,-.38],aimHeight:.12}, {stock:[0,-.036,.365],handguard:[0,.035,-.335],pistolgrip:[0,-.12,.145],magazine:[0,-.18,-.032],mount:[0,.10,.005],muzzle:[0,.035,-.98]})
};
export const weaponLayout = (shape: string): WeaponLayout => layouts[shape] || standard;
export const weaponSightHeight = (layout: WeaponLayout, optic: boolean, mounted = false): number => optic ? mounted ? layout.mountedOpticAimHeight : layout.opticAimHeight : layout.aimHeight;

