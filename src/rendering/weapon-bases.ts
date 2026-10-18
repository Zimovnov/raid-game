import type { Color, Part, Vec3 } from '../domain/types.js';
import { rgb } from '../domain/util.js';
import { weaponLayout } from '../content/weapon-layouts.js';
import { arsenalWeaponBase } from './arsenal-models.js';
export { weaponLayout } from '../content/weapon-layouts.js';

/** Authored stylized receiver silhouettes. Coordinates are virtual art, not manufacturing dimensions. */
export function additionalWeaponBase(type: string): Part[] | null {
    const arsenal = arsenalWeaponBase(type);
    if (arsenal) return arsenal;
    if (!['aksu','ak103','hk416','vityaz','kedr','tt','glock','grach','sks','mosin','svd','sv98','mp153','saiga'].includes(type)) return null;
    const out: Part[] = [], dark=rgb('#252b2d'),metal=rgb('#596261'),black=rgb('#151a1a'),wood=rgb('#8b6142');
    const b=(p:Vec3,s:Vec3,c:Color=dark,r:Vec3=[0,0,0],slot?:string)=>out.push({shape:'box',p,s,c,r,slot});
    const cy=(p:Vec3,s:Vec3,c:Color=metal,r:Vec3=[Math.PI/2,0,0],slot?:string)=>out.push({shape:'cylinder',p,s,c,r,slot});
    const sight=(z:number,h=.105)=>{b([0,h,z],[.018,.05,.021],black);b([0,h-.018,z],[.058,.012,.03]);};
    const trigger=(z=.1)=>{b([0,-.105,z-.04],[.063,.065,.021]);b([0,-.136,z],[.065,.019,.10]);b([0,-.09,z+.04],[.064,.095,.025]);};
    if (['tt','glock','grach'].includes(type)) {
        const tt=type==='tt',glock=type==='glock',len=tt?.31:glock?.25:.28;
        b([0,.025,-.035],[glock?.087:.076,.082,len],glock?dark:metal,[0,0,0],'action');
        b([0,-.035,-.025],[.077,.05,len*.86]);
        cy([0,.024,-len/2-.047],[.023,.045,.023],black);
        if (glock) {b([0,-.15,.054],[.08,.18,.105],black,[-.24,0,0]);b([0,-.248,.072],[.09,.022,.113]);}
        if (!tt) b([0,-.052,-.115],[.074,.02,.08],black);
        for(let i=0;i<5;i++)b([.04,.026,.053+i*.012],[.006,.055,.005],black,[0,0,0],'action');
        sight(-len/2+.014,.079);sight(len/2-.06,.078);trigger(-.045);
    } else if(type==='kedr') {
        b([0,.025,-.018],[.067,.095,.23],metal);b([0,.085,-.022],[.08,.026,.2]);
        cy([0,.02,-.179],[.028,.13,.028]);b([0,-.051,-.072],[.075,.04,.14]);
        b([.05,.04,.044],[.048,.024,.025]);sight(-.105,.1);sight(.063,.103);trigger(.018);
    } else if(['sks','mosin','svd','sv98'].includes(type)) {
        const mosin=type==='mosin',svd=type==='svd',sniper=type==='sv98',end=weaponLayout(type).muzzle[2];
        cy([0,sniper?.06:.025,-.36],[sniper?.046:.026,Math.abs(end)*1.27,sniper?.046:.026]);
        cy([0,.034,.015],[svd?.069:.061,.32,.061]);
        b([0,-.005,.02],[.077,.075,svd?.39:.30],metal);
        if(!sniper){sight(end+.09,.105);sight(-.1,.099);}
        else {b([0,.10,.015],[.09,.028,.32]);for(let n=0;n<9;n++)b([0,.12,-.12+n*.032],[.10,.011,.012],black);}
        if(mosin||sniper){cy([.058,.045,.055],[.018,.10,.018],metal,[0,0,-1.12],'action');out.push({shape:'sphere',p:[.102,.01,.055],s:[.033,.033,.033],r:[0,0,0],c:dark,slot:'action'});}
        if(type==='sks'){b([0,-.095,-.03],[.08,.13,.17]);b([0,-.178,-.047],[.08,.027,.13]);cy([0,.095,-.30],[.038,.25,.038],dark);}
        if(svd){cy([0,.095,-.4],[.038,.47,.038],dark);b([.058,.033,-.052],[.06,.018,.03],black,[0,0,0],'action');}
        if(mosin){b([0,-.034,-.48],[.083,.042,.65],wood);for(const z of [-.6,-.8])b([0,-.028,z],[.095,.064,.027],dark);}
        trigger(.1);
    } else if(type==='mp153') {
        b([0,.0,.055],[.094,.12,.31],metal);cy([0,.024,-.49],[.039,.77,.039]);cy([0,-.047,-.405],[.047,.68,.047],dark);
        b([0,.049,-.45],[.011,.015,.75],black);b([.062,.025,.0],[.053,.025,.025],dark,[0,0,0],'action');trigger(.13);
    } else {
        const hk=type==='hk416',short=type==='aksu',smg=type==='vityaz',sg=type==='saiga';
        const len=hk?.38:short?.29:smg?.31:.36,end=weaponLayout(type).muzzle[2];
        b([0,.007,.023],[hk?.092:sg?.106:.085,.12,len],metal);
        b([0,.081,.026],[hk?.088:.081,hk?.05:.022,len*.88],black);
        cy([0,.024,(end-.10)/2],[sg?.044:.024,Math.abs(end+.10),sg?.044:.024]);
        cy([0,.098,short?-.225:smg?-.24:hk?-.4:-.33],[.032,short?.18:smg?.22:hk?.48:.4,.032]);
        if(hk){b([.06,.017,.07],[.037,.049,.083]);b([0,-.075,-.034],[.096,.095,.108]);for(let n=0;n<9;n++)b([0,.112,-.14+n*.039],[.095,.012,.016]);}
        else {b([.052,.01,.014],[.012,.02,.16]);b([.068,.04,-.04],[.068,.015,.022],black,[0,0,0],'action');}
        if(smg)b([0,-.1,-.081],[.08,.11,.076]);
        if(short){b([0,.138,.07],[.075,.025,.049]);sight(-.4,.141);}
        else{sight(end+.12,.13);sight(.08,.123);}
        if(type==='ak103'){cy([0,.027,end+.015],[.045,.09,.045],dark);b([-.06,-.007,.12],[.01,.052,.07]);}
        if(sg){b([0,.079,-.18],[.055,.03,.11]);b([0,-.08,-.067],[.10,.04,.14]);}
        trigger(.115);
    }
    return out;
}
