import type { Color, Definition, Part, Vec3 } from '../domain/types.js';
import { hash } from '../domain/util.js';

// Independent, deliberately low-poly inventory/world objects. All dimensions are
// virtual art coordinates, not construction or manufacturing instructions.
export function lootGeometry(d: Definition): Part[] {
    const parts: Part[] = [], c=d.color, metal:Color=[.54,.57,.57], dark:Color=[.12,.15,.16], paper:Color=[.82,.80,.68], green:Color=[.18,.39,.28], gold:Color=[.73,.57,.24];
    const add=(shape:Part['shape'],p:Vec3,s:Vec3,color:Color=c,r:Vec3=[0,0,0])=>parts.push({shape,p,s,c:color,r});
    const b=(p:Vec3,s:Vec3,color:Color=c,r:Vec3=[0,0,0])=>add('box',p,s,color,r);
    const cy=(p:Vec3,s:Vec3,color:Color=c,r:Vec3=[0,0,0])=>add('cylinder',p,s,color,r);
    const ball=(p:Vec3,s:Vec3,color:Color=c)=>add('sphere',p,s,color);
    const ring=(x:number,z:number,r:number,color:Color=c,y=.025)=>{for(let n=0;n<12;n++){const t=n*Math.PI/6;b([x+Math.cos(t)*r,y,z+Math.sin(t)*r],[r*.53,.018,.024],color,[0,-t,0]);}};
    const label=(y:number,sx=.12,sz=.09)=>{b([0,y,0],[sx,.004,sz],paper);const code=hash(d.id);for(let j=0;j<5;j++)b([-.4*sx+j*sx*.2,y+.004,0],[.009,.004,sz*(.25+((code>>j)&3)*.13)],dark);};
    const fan=(x:number,z:number,r=.075,y=.07)=>{cy([x,y,z],[r*2,.016,r*2],dark);for(let k=0;k<5;k++){const t=k*Math.PI*.4;b([x+Math.cos(t)*r*.4,y+.01,z+Math.sin(t)*r*.4],[r,.008,.026],metal,[0,-t+.35,0]);}cy([x,y+.017,z],[r*.44,.012,r*.44],metal);};
    const handle=(x=0,y=.23,z=0,w=.12)=>{b([x-w/2,y-.025,z],[.018,.07,.028],dark);b([x+w/2,y-.025,z],[.018,.07,.028],dark);b([x,y+.018,z],[w,.02,.028],dark);};
    const s=d.shape;
    if (['bottle','glue','foam','tube','thermos','candle'].includes(s)) {
        const h=s==='thermos'?.35:s==='candle'?.18:.27,r=s==='tube'?.085:.13;
        cy([0,h/2,0],[r,h,r]);cy([0,h+.018,0],[r*.45,.04,r*.45],s==='candle'?dark:metal);
        if(s==='candle')b([0,h+.045,0],[.009,.025,.009],dark);
        else {cy([0,h*.5,0],[r+.004,h*.24,r+.004],paper);b([0,h*.5,-r/2-.004],[r*.42,h*.1,.008],c);}
        if(s==='foam')b([.08,h+.03,0],[.18,.014,.014],paper);
    } else if (['can','tin','jar','bandage','roll','rope','cable','belt','bearing','labels'].includes(s)) {
        const h=s==='jar'?.24:s==='bandage'?.09:s==='belt'?.025:.14;
        if(['rope','cable','belt','bearing','roll','labels'].includes(s)){for(let k=0;k<3;k++)ring(0,0,.05+k*.023,c,.02+k*.006);if(s==='rope'||s==='cable')b([.09,.018,.085],[.17,.019,.019],c,[0,-.6,0]);}
        else {cy([0,h/2,0],[.17,h,.17]);cy([0,h+.004,0],[.174,.009,.174],metal);if(s!=='bandage')label(h+.011,.1,.075);else b([0,h/2,-.087],[.065,h*.55,.007],paper);}
    } else if (['screwdriver','file','solder','thermometer','probe','pen'].includes(s)) {
        const length=s==='pen'?.24:.36;
        cy([0,.03,0],[.018,length,.018],metal,[Math.PI/2,0,0]);
        cy([0,.03,.11],[s==='pen'?.027:.055,length*.38,s==='pen'?.027:.055],c,[Math.PI/2,0,0]);
        if(s==='solder'){b([.034,.045,.10],[.05,.02,.025],dark);b([0,.03,-.17],[.022,.022,.04],gold);}
        if(s==='file')b([0,.03,-.08],[.04,.014,.22],metal);
        if(s==='thermometer'){b([0,.035,.06],[.045,.021,.11],paper);b([0,.05,.05],[.028,.006,.045],dark);}
        if(s==='screwdriver'){b([0,.03,-.17],[.032,.006,.04],metal);if(d.id.endsWith('_02'))b([0,.03,-.17],[.006,.032,.04],metal);}
    } else if (['pliers','cutters','scissors','wrench','openwrench','ratchet','clamp','caliper','multitool','hexkeys'].includes(s)) {
        if(['pliers','cutters','scissors'].includes(s)){
            for(const x of [-1,1]){b([x*.023,.024,.035],[.025,.035,.22],metal,[0,x*.15,0]);b([x*.038,.026,.12],[.037,.042,.13],c,[0,x*.15,0]);b([x*.025,.024,-.09],[.03,.035,s==='cutters'?.07:.13],metal,[0,-x*.17,0]);if(s==='scissors')ring(x*.038,.16,.028,c,.029);}
            cy([0,.048,0],[.025,.013,.025],dark);
        }else if(s==='hexkeys'){for(let k=0;k<6;k++){b([-.065+k*.025,.02,0],[.012,.012,.14+k*.025],metal);b([-.051+k*.025,.02,-.07-k*.0125],[.04,.012,.012],metal);}}
        else if(s==='multitool'){for(const x of [-.029,.029])b([x,.028,0],[.04,.045,.2],metal);b([.07,.024,-.06],[.025,.018,.16],metal,[0,-.7,0]);}
        else {b([0,.025,.015],[.034,.032,.28],metal);b([-.045,.025,-.13],[.036,.032,.08],metal);b([0,.025,-.10],[.10,.032,.028],metal);b([.038,.025,-.13],[.025,.032,.08],metal);
            if(s==='clamp'){b([.048,.024,.13],[.12,.03,.033],metal);b([.10,.024,.06],[.013,.018,.22],dark);}
            if(s==='ratchet')cy([0,.043,-.13],[.07,.026,.07],metal);
            if(s==='caliper'){b([.045,.035,.03],[.13,.027,.021],metal);b([0,.045,.04],[.057,.016,.07],dark);}
        }
    } else if(['hammer','mallet','brush','roller','saw','hacksaw','level','tape'].includes(s)){
        if(s==='tape'){b([0,.06,0],[.15,.12,.13]);b([.13,.015,0],[.23,.012,.06],paper);for(let i=0;i<7;i++)b([.05+i*.025,.023,0],[.003,.004,.032],dark);}
        else if(s==='level'){b([0,.055,0],[.42,.1,.055]);for(const x of [-.13,0,.13]){b([x,.11,0],[.055,.008,.04],dark);cy([x,.115,0],[.02,.028,.02],green,[0,0,Math.PI/2]);}}
        else if(s==='saw'||s==='hacksaw'){b([0,.028,-.04],[.08,.026,.33],metal);b([0,.032,.17],[.10,.04,.10],c);for(let z=-.19;z<.1;z+=.027)b([.047,.027,z],[.025,.015,.016],metal,[0,.7,0]);if(s==='hacksaw'){b([-.08,.04,-.03],[.02,.02,.34],c);b([-.04,.04,-.195],[.1,.02,.02],c);}}
        else {b([0,.032,.04],[.04,.04,.27],c);b([0,.037,-.105],[s==='brush'?.14:.20,s==='mallet'?.08:.045,s==='brush'?.12:.055],s==='mallet'?dark:metal);if(s==='brush')for(let k=0;k<7;k++)b([-.06+k*.02,.027,-.20],[.016,.025,.1],paper);if(s==='roller')cy([0,.05,-.10],[.08,.25,.08],paper,[0,0,Math.PI/2]);}
    } else if(['gpu','board','ram','cpu','memory','usb'].includes(s)) {
        if(s==='gpu'){b([0,.04,0],[.44,.055,.22],dark);fan(-.115,0);fan(.115,0);b([0,.015,.122],[.23,.012,.028],gold);b([.235,.043,0],[.014,.085,.25],metal);}
        else {const x=s==='ram'?.31:s==='cpu'?.14:s==='usb'?.08:s==='memory'?.07:.24,z=s==='ram'?.07:s==='usb'?.18:.14;b([0,.018,0],[x,.021,z],green);for(let k=0;k<(s==='ram'?6:2);k++)b([-.36*x+k*x/(s==='ram'?7:3),.038,0],[s==='ram'?.03:x*.27,.017,z*.52],s==='cpu'?metal:dark);b([0,.018,z*.5],[x*.7,.02,.017],gold);if(s==='usb')b([0,.02,-.115],[.06,.025,.05],metal);}
    } else if(['fan','psu','charger','powerbank','ssd','hdd','router','switch','relay','contactor','breaker','terminal'].includes(s)){
        const flat=['ssd','hdd','powerbank'].includes(s), y=flat?.055:s==='fan'?.035:.12;
        b([0,y/2,0],[s==='switch'?.32:.22,y,.20],s==='fan'?dark:c);
        if(['fan','psu'].includes(s))fan(0,0,.085,y+.009);
        else if(s==='hdd'){cy([.015,y+.009,0],[.135,.012,.135],metal);b([-.04,y+.025,0],[.12,.015,.018],metal,[0,.6,0]);}
        else label(y+.003);
        if(s==='router')for(const x of [-.085,.085])cy([x,.19,.078],[.018,.3,.018],dark,[.18,0,0]);
        for(let j=0;j<(s==='switch'?8:3);j++)b([-.075+j*.022,.03,-.102],[.013,.016,.008],dark);
    } else if(['camera','webcam','lens','exposure'].includes(s)){
        if(s==='lens'){cy([0,.10,0],[.15,.2,.15],dark);cy([0,.205,0],[.157,.012,.157],green);for(const y of [.04,.12])cy([0,y,0],[.16,.025,.16],metal);}
        else {b([0,.09,0],[s==='webcam'?.17:.28,.16,.11],dark);cy([0,.10,-.08],[.11,.1,.11],metal,[Math.PI/2,0,0]);cy([0,.10,-.137],[.08,.013,.08],green,[Math.PI/2,0,0]);b([.065,.18,.0],[.045,.025,.034],c);if(s==='camera')b([0,.185,.025],[.11,.035,.06],dark);}
    } else if(['radio','meter','gauge','compass','cuff'].includes(s)){
        if(s==='compass'||s==='gauge'){cy([0,.036,0],[.20,.065,.20],metal);cy([0,.075,0],[.18,.012,.18],paper);b([0,.086,0],[.018,.006,.13],c,[0,.7,0]);if(s==='compass')ring(0,.12,.025,metal,.028);else cy([0,.025,.13],[.035,.08,.035],metal,[Math.PI/2,0,0]);}
        else {b([0,.1,0],[.15,.20,.085]);b([0,.145,-.046],[.11,.065,.008],paper);for(let y=.045;y<.105;y+=.02)b([0,y,-.047],[.1,.006,.006],dark);if(s==='radio')cy([-.052,.31,0],[.016,.24,.016],dark);else if(s==='cuff')cy([.15,.075,0],[.14,.12,.14],dark,[Math.PI/2,0,0]);else for(const x of [-.06,.06])b([x,.017,.11],[.015,.018,.22],x<0?c:dark);}
    } else if(['ring','chain','coin','wristwatch','pocketwatch','brooch','statuette','spoon','vinyl','cassette','dumpling','mold'].includes(s)){
        if(s==='ring'){ring(0,0,.07,c);if(d.id.endsWith('_02'))ball([0,.057,-.063],[.04,.035,.04],paper);}
        else if(s==='chain'){for(let k=0;k<10;k++){const t=k*Math.PI/5;ring(Math.cos(t)*.105,Math.sin(t)*.105,.018,c,.012);}}
        else if(s==='coin'){cy([0,.012,0],[.15,.023,.15]);cy([0,.026,0],[.1,.006,.1],gold);}
        else if(s==='wristwatch'||s==='pocketwatch'){cy([0,.034,0],[.10,.035,.10],metal);cy([0,.055,0],[.086,.008,.086],paper);b([0,.065,0],[.009,.008,.065],dark,[0,.7,0]);if(s==='wristwatch')for(const z of [-.10,.10])b([0,.015,z],[.07,.025,.12],dark);else ring(.055,.065,.022,gold,.02);}
        else if(s==='brooch'){ball([0,.035,0],[.13,.045,.095],c);for(const x of [-.06,.06])ball([x,.039,0],[.025,.025,.025],gold);}
        else if(s==='statuette'){cy([0,.018,0],[.15,.035,.14],metal);add('cone',[0,.115,0],[.13,.2,.09]);ball([0,.265,0],[.065,.065,.065]);b([.07,.165,0],[.12,.024,.03],c,[0,0,-.5]);}
        else if(s==='spoon'){cy([0,.02,.06],[.018,.20,.018],metal,[Math.PI/2,0,0]);ball([0,.022,-.085],[.075,.024,.09],metal);}
        else if(s==='vinyl'){b([0,.014,0],[.31,.018,.31],c);cy([.045,.03,0],[.285,.01,.285],dark);cy([.045,.039,0],[.087,.005,.087],gold);}
        else if(s==='cassette'){b([0,.026,0],[.22,.05,.14],dark);for(const x of [-.056,.056])cy([x,.055,0],[.055,.008,.055],paper);b([0,.055,.052],[.15,.008,.025],c);}
        else if(s==='dumpling'){ball([0,.075,0],[.29,.13,.19],gold);for(let j=0;j<6;j++)ball([-.12+j*.048,.12,0],[.04,.04,.17],gold);}
        else {cy([0,.02,0],[.29,.025,.29],metal);for(const x of [-.08,0,.08])for(const z of [-.08,0,.08])cy([x,.036,z],[.045,.009,.045],dark);}
    } else if(['motor','gearbox','valve','filter','grille','extension','lamp','canister','plug','fuse','nuts','bolts','washers','brackets','ties','batteries'].includes(s)){
        if(s==='motor'||s==='gearbox'){cy([0,.15,0],[.26,.32,.26],metal,[Math.PI/2,0,0]);b([0,.023,0],[.30,.045,.24],dark);cy([0,.15,-.23],[.037,.15,.037],metal,[Math.PI/2,0,0]);for(let j=0;j<5;j++)b([0,.287,-.1+j*.05],[.18,.027,.012],c);}
        else if(s==='valve'){cy([0,.05,0],[.065,.23,.065],metal,[Math.PI/2,0,0]);cy([0,.13,0],[.025,.17,.025],metal);ring(0,0,.095,c,.22);}
        else if(s==='filter'){cy([0,.13,0],[.14,.26,.14],paper);for(let k=0;k<8;k++){const t=k*Math.PI/4;b([Math.cos(t)*.07,.13,Math.sin(t)*.07],[.015,.26,.016],metal);}cy([0,.265,0],[.17,.018,.17],metal);}
        else if(s==='grille'){b([0,.02,0],[.3,.035,.26],metal);for(let j=0;j<8;j++)b([0,.04,-.11+j*.03],[.25,.008,.013],dark);}
        else if(s==='canister'){b([0,.16,0],[.22,.31,.14]);handle(0,.36,0);cy([-.068,.335,0],[.053,.05,.053],dark);b([0,.16,-.075],[.13,.11,.008],paper);}
        else if(s==='lamp'){cy([0,.025,0],[.13,.04,.13],dark);ball([0,.10,0],[.12,.15,.12],c);}
        else if(s==='extension'){b([0,.04,0],[.13,.065,.28],paper);for(const z of [-.085,0,.085])cy([0,.079,z],[.07,.009,.07],dark);ring(.1,.12,.055,dark);}
        else if(s==='plug'){cy([0,.06,0],[.10,.12,.10],c);cy([0,.018,.10],[.031,.17,.031],dark,[Math.PI/2,0,0]);for(const x of [-.025,.025])cy([x,.145,0],[.016,.08,.016],metal);b([0,.118,-.041],[.025,.055,.02],metal);}
        else {const count=s==='fuse'?4:5;for(let k=0;k<count;k++){const x=(k%3-1)*.07,z=(Math.floor(k/3)-.5)*.1;
            if(s==='batteries'||s==='fuse'||s==='bolts'){cy([x,.065,z],[s==='bolts'?.02:.035,.12,s==='bolts'?.02:.035],s==='batteries'?gold:metal);cy([x,.131,z],[.025,.014,.025],metal);}
            else if(s==='nuts'||s==='washers')ring(x,z,.024,metal);
            else {b([x,.025,z],[.035,.027,s==='ties'?.24:.08],metal);if(s==='brackets')b([x,.055,z-.03],[.04,.075,.025],metal);}}
        }
    } else if(['medkit','toolcase','cooler','jewelrybox','musicbox'].includes(s)){
        b([0,.09,0],[.29,.17,.22]);b([0,.184,0],[.30,.023,.23],s==='toolcase'?dark:c);handle(0,.235,0,.12);for(const x of [-.09,.09])b([x,.165,-.12],[.028,.052,.018],metal);
        if(s==='medkit'){b([0,.204,0],[.05,.012,.15],paper);b([0,.205,0],[.17,.013,.045],paper);}
        if(s==='jewelrybox'||s==='musicbox'){b([0,.205,0],[.2,.016,.14],gold);cy([.166,.1,0],[.022,.06,.022],metal,[0,0,Math.PI/2]);}
    } else if(['mug','pot'].includes(s)){
        const r=s==='pot'?.25:.12,h=s==='pot'?.15:.16;cy([0,h/2,0],[r,h,r]);cy([0,h+.004,0],[r*.85,.01,r*.85],dark);for(const x of s==='pot'?[-r/2,r/2]:[r/2+.025]){b([x,.095,0],[.025,.10,.019],metal);b([x-Math.sign(x)*.02,.055,0],[.065,.018,.02],metal);b([x-Math.sign(x)*.02,.135,0],[.065,.018,.02],metal);}
    } else if(['sack','packet','carton','tea','foodbox'].includes(s)){
        const big=d.size[0]*d.size[1]>3,h=big?.35:s==='carton'?.30:.20,w=big?.30:.17;
        b([0,h/2,0],[w,h,.11]);b([0,h+.009,0],[w*.88,.019,.1],paper,[0,0,.08]);b([0,h*.55,-.058],[w*.75,h*.35,.008],paper);b([0,h*.55,-.064],[w*.4,h*.12,.006],c);
        if(s==='carton')cy([.04,h+.02,0],[.026,.022,.026],paper);
    } else if(['book','notebook','album','folder','photos','pass','flatpack','chocolate','blanket','towel','plywood','splint','mask','gloves','coldpack','soap','sponge','thread','needles','buttons','matches','lighter'].includes(s)){
        const small=['pass','soap','sponge','lighter','matches'].includes(s), w=small?.12:s==='plywood'?.43:.24,z=s==='splint'?.4:small?.09:.30,h=['book','notebook','album','soap','sponge'].includes(s)?.055:.023;
        b([0,h/2,0],[w,h,z]);
        if(['book','notebook','album'].includes(s)){b([.006,h/2,0],[w-.019,h*.7,z-.022],paper);b([0,h,0],[w,.009,z],c);label(h+.008,w*.7,z*.42);}
        else if(s==='mask'){for(const x of [-w/2,w/2])ring(x,0,.043,paper,.01);for(let k=0;k<3;k++)b([0,h+.005,-.08+k*.07],[w*.9,.008,.007],paper);}
        else if(s==='chocolate'){for(let x=-.08;x<.09;x+=.05)for(let z=-.11;z<.12;z+=.05)b([x,h+.01,z],[.04,.015,.04],dark);}
        else if(s==='thread'){for(let x=-.07;x<.08;x+=.07)cy([x,.057,0],[.042,.1,.042],c);}
        else label(h+.005,w*.7,z*.6);
    } else {
        // Packaging is meaningful for small fasteners/medical supplies; not used
        // for graphics cards, valuables, tools or other recognizable equipment.
        b([0,.065,0],[.19,.13,.17]);label(.134);
    }
    return parts;
}
