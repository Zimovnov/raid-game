import type { Category, MapDef, Vec3 } from '../domain/types.js';
import { rgb, rng } from '../domain/util.js';
import { Builder } from './map-builder.js';

const wood = rgb('#8a8069'), steel = rgb('#67736b'), concrete = rgb('#8d9085');
const districts: Record<string, string[]> = {
    village: ['Лесопилка', 'Заброшенная ферма', 'Садоводство «Ручей»', 'Дом лесника', 'Старая школа', 'Насосная станция', 'Мастерская тракториста', 'Сельпо', 'Охотничий кордон', 'Пожарный пост', 'Пасека', 'Метеостанция'],
    park: ['Лесной кордон', 'Туристическая база', 'Старый питомник', 'Спасательная станция', 'Летний лагерь', 'Оранжерея', 'Склад лесничества', 'Санаторный корпус', 'Прокат лодок', 'Радиопост', 'Заброшенное кафе', 'Зимовье'],
    factory: ['Котельная', 'Железнодорожный склад', 'Ремонтный цех', 'Очистная станция', 'Автобаза', 'Лаборатория', 'Склад сырья', 'Силовая подстанция', 'Пожарная часть', 'Тарный двор', 'Столовая', 'Резервный холодильник'],
    city: ['Автосервис', 'Поликлиника', 'Гаражный кооператив', 'Почтовое отделение', 'Школьный двор', 'Электроподстанция', 'Автостанция', 'Коммунальный склад', 'Рынок', 'Дом связи', 'Стройплощадка', 'Старая типография'],
    mall: ['Садовый центр', 'Оптовая база', 'Автосервис', 'Склад доставки', 'Строительный магазин', 'Диспетчерская', 'Гипермаркет', 'Резервная подстанция', 'Автостанция', 'Транспортный терминал', 'Ресторанный двор', 'Мебельный склад']
};
const supplies: Category[] = ['hand_tools', 'medical', 'household', 'documents', 'food_drink', 'electronics', 'industrial', 'building_material'];

/** The old playable core and all its stable quest/loot IDs stay in place. */
export function expandMap(map: MapDef): MapDef {
    if (map.id === 'range') return map;
    const [w, d] = map.size, rural = map.id === 'village' || map.id === 'park';
    // Only the four original boundary slabs move; authored walls and fences remain.
    map.boxes = map.boxes.filter(b => !['b0', 'b1', 'b2', 'b3'].includes(b.id));
    map.size = [w * 4, d * 4];
    map.duration = rural ? 3000 : 2400;
    map.fog = rgb('#b8c8cb');
    if (rural) map.ground = rgb('#85846a');
    if(map.id==='village') for(const box of map.boxes)
        if(box.kind==='wall' && box.s[1]<4) box.kind='timber-wall';
    const b = new Builder(map.id, map.name, map.subtitle, map.theme, map.size, map.ground, map.fog);
    b.m = map;
    b.n = 10000;
    b.boundary();
    for (const boundary of map.boxes.slice(-4)) {
        boundary.kind = rural ? 'timber-wall' : 'wall';
        boundary.p[1] = rural ? 1.15 : 2;
        boundary.s[1] = rural ? 2.3 : 4;
        if (rural) boundary.color = wood;
    }
    const road = (x: number, z: number, sx: number, sz: number) => b.box([x, .018, z], [sx, .035, sz], rgb(rural ? '#9c947b' : '#5e625d'), rural ? 'dirt' : 'road', false);
    // Cross and perimeter road: every district has two approaches and a forest/yard flank.
    road(0, 0, 9, d * 3.8); road(0, 0, w * 3.8, 9);
    for (const sign of [-1, 1]) { road(sign * w * 1.62, 0, 8, d * 3.3); road(0, sign * d * 1.62, w * 3.3, 8); }
    const sites = [[-1.2,-1.2],[0,-1.2],[1.2,-1.2],[-1.2,0],[1.2,0],[-1.2,1.2],[0,1.2],[1.2,1.2],[-.72,-.72],[.72,-.72],[-.72,.72],[.72,.72]];
    sites.forEach(([xx, zz], i) => {
        const x = Math.round(xx * w), z = Math.round(zz * d), name = districts[map.id][i];
        // Keep the district yard off the connecting road axis.
        const bx = x + (x === 0 ? 21 : 0), bz = z + (z === 0 ? 21 : 0);
        road(bx, bz + 13, 54, 5);
        if (x !== 0) road(x / 2, bz + 13, Math.abs(x), 4);
        else road(12, bz + 13, 24, 4);
        const wallColor = rural ? rgb(['#887d62','#89907a','#747f7c'][i % 3]) : rgb(['#9b8870','#8b7062','#8b9387'][i % 3]);
        b.room(bx, bz - 3, 22, 16, name.toUpperCase(), wallColor, 'nsew', rural ? 3.4 : 4.6);
        if (rural) {
            for (const wall of map.boxes.slice(-13)) if (wall.kind === 'wall') wall.kind = 'timber-wall';
            b.box([bx, 4.3, bz - 3], [23, 1.8, 17], rgb('#67685b'), 'gable', false);
            b.box([bx + 8, 5, bz - 6], [.7, 3.2, .7], rgb('#807764'), 'chimney');
        }
        const outbuildingStart=map.boxes.length;
        b.room(bx - 19, bz + 2, 10, 12, rural ? 'САРАЙ' : 'СКЛАД', wood, 'ns', 3.1);
        b.room(bx + 20, bz + 1, 12, 14, rural ? 'МАСТЕРСКА' : 'СЛУЖЕБНЫЙ ПОСТ', steel, 'nsw', 3.5);
        if(rural) for(const wall of map.boxes.slice(outbuildingStart)) if(wall.kind==='wall') wall.kind='timber-wall';
        // Framed windows, corner posts and a porch tie the modular walls into buildings.
        for(const side of [-1,1]) for(const wx of [-7,7]) {
            b.box([bx+wx,1.9,bz-3+side*8.25],[2.1,1.6,.12],wood,'window-frame',false);
            b.box([bx+wx,1.9,bz-3+side*8.33],[1.8,1.34,.035],rgb('#354645'),'window',false);
            b.box([bx+wx,1.9,bz-3+side*8.36],[.075,1.4,.04],wood,'window-frame',false);
            b.box([bx+wx,1.9,bz-3+side*8.36],[1.9,.075,.04],wood,'window-frame',false);
            b.box([bx+wx,1.12,bz-3+side*8.4],[2.25,.12,.35],wood,'window-frame',false);
        }
        if(rural) {
            b.box([bx,.05,bz+6.8],[5,.1,3.4],wood,'boardwalk',false);
            b.box([bx,2.95,bz+6.8],[5.4,.16,3.8],wood,'roof');
            for(const side of [-1,1]) b.box([bx+side*2.35,1.45,bz+8.2],[.15,2.9,.15],wood,'pole');
        }
        b.door([bx, 1.33, bz + 5], 'x', name + ': дверь', i % 3 !== 0);
        b.poi('district-' + i, name, [bx, 0, bz]);
        // Furniture leaves the crossing passages and loot approaches clear.
        for (const side of [-1, 1]) {
            b.box([bx + side * 7, .48, bz - 8], [4, .96, 1.5], wood, 'counter');
            b.box([bx + side * 7, .9, bz + 2], [3, 1.8, .7], steel, 'cabinet');
            b.box([bx + side * 9, .7, bz + 18], [3.5, 1.4, 1.4], concrete, 'road-barrier');
        }
        for (const [lx,lz,c,label] of [
            [-7,-5,supplies[i % supplies.length],'Запас'],[7,-5,'food_drink','Провизия'],[-6,0,'household','Личные вещи'],[6,0,'documents','Документы'],
            [-19,-1,'hand_tools','Инструменты'],[20,-2,'electronics','Оборудование'],[-19,5,'building_material','Материалы'],[20,5,i % 3 === 0 ? 'weapon' : 'medical',i % 3 === 0 ? 'Оружейный тайник' : 'Аптечный запас']
        ] as [number,number,Category,string][]) b.loot(bx + lx, bz + lz, c, name + ' / ' + label);
        b.m.bots.push([bx, 0, bz - 3]);
        if (i % 2 === 0) b.m.bots.push([bx + 17, 0, bz + 13]);
        if (rural) {
            for (const side of [-1,1]) {
                b.box([bx + side * 29, .85, bz], [.18, 1.7, 30], wood, 'fence');
                b.box([bx + side * 19, .85, bz + 19], [18, 1.7, .18], wood, 'fence');
            }
            for (let n=0;n<4;n++) b.box([bx-25+n*.6,.5,bz-9],[.48,1,4.5],wood,'timber-stack');
        } else {
            b.box([bx-16,1,bz+17],[2.5,2,4.5],steel,'car');
            b.box([bx-16,2.2,bz+17],[2, .9, 2.025],steel,'collision-only');
            b.box([bx+20,.65,bz+18],[3,1.3,2],wood,'pallet');
        }
        // District-specific silhouettes and interior work areas establish purpose.
        if(i%4===0) {
            for(let row=0;row<3;row++) for(let n=0;n<3-row;n++)
                b.box([bx+33+n*.75, .4+row*.65, bz-12],[.65,.65,8],wood,'log');
        } else if(i%4===1) {
            for(const side of [-1,1]) {
                b.box([bx+side*7,.55,bz-1],[2.8,1.1,1],rgb('#a5a99a'),'workbench');
                b.box([bx+side*7,1.15,bz-1],[2.8,.1,1.1],steel,'detail',false);
            }
        } else if(i%4===2) {
            b.box([bx+34,1.25,bz-12],[5,2.5,3],steel,'tank');
            b.box([bx+34,2.7,bz-12],[1,.4,1],steel,'barrel',false);
        } else {
            for(const side of [-1,1])b.box([bx+34+side*1.6,5,bz-13],[.18,10,.18],steel,'pole');
            b.box([bx+34,9.5,bz-13],[4,.2,.2],steel,'detail',false);
            b.box([bx+34,10.2,bz-13],[.2,2,.2],steel,'antenna',false);
        }
        if(i===4 || i===7) {
            const tx=bx+39,tz=bz+22;
            b.deck(tx,tz,5,5,3.4);b.stairs(tx,tz-8,3.4,11,0,3.4);
            for(const side of [-1,1]) b.box([tx+side*2.4,4.05,tz],[.12,1.3,5],steel,'guard-bar');
            b.box([tx,4.05,tz+2.4],[5,1.3,.12],steel,'guard-bar');
            b.loot(tx+1.4,tz+1,'documents',name+' / Наблюдательный журнал',3.4);
            b.poi('lookout-'+i,'Наблюдательная площадка: '+name,[tx,3.4,tz]);
        }
        // Utility poles are landmarks along the district approach.
        b.box([bx+28,4,bz+13],[.23,8,.23],wood,'pole');
        b.box([bx+28,7.3,bz+13],[3.1,.16,.16],wood,'detail',false);
    });
    const exits: [string,string,Vec3][] = [
        ['outer-north','Северный кордон',[0,0,-d*1.84]],['outer-south','Южный КПП',[0,0,d*1.84]],
        ['outer-west',rural?'Западная лесная тропа':'Западный транспортный узел',[-w*1.84,0,0]],
        ['outer-east',rural?'Восточная просека':'Восточные ворота',[w*1.84,0,0]]
    ];
    for (const [id,name,p] of exits) b.exit(id,name,p);
    for (const [i,side] of [-1,1].entries()) {
        const id = 'outer-service-' + i, p: Vec3 = [side*w*1.65,0,-side*d*1.65];
        const control: Vec3 = [side*w*1.62+3,1.3,-side*d*1.2];
        map.activators!.push({id,name:i?'Пульт восточной эвакуации':'Пульт западной эвакуации',p:control});
        b.box([control[0],.7,control[2]],[.8,1.4,.6],steel,'cabinet');
        // Interaction point sits on the face, outside the cabinet collider.
        control[2] += .34;
        b.exit(id,i?'Резервный восточный выход':'Резервный западный выход',p);
        map.exits.at(-1)!.requires=id;
        map.signs.push({text:'ПУЛЬТ / РЕЗЕРВНЫЙ ВЫХОД',p:[control[0],2.3,control[2]],yaw:0});
    }
    const random = rng(601 + map.id.length * 37 + w);
    const occupied = map.boxes.filter(o => o.solid || ['road','dirt','path','walk','floor'].includes(o.kind));
    const clear = (x:number,z:number,margin:number) => !occupied.some(o => Math.abs(o.p[0]-x)<o.s[0]/2+margin && Math.abs(o.p[2]-z)<o.s[2]/2+margin)
        && ![...map.spawn,...map.bots,...map.exits.map(e=>e.p)].some(p=>Math.hypot(p[0]-x,p[2]-z)<6);
    for(let i=0;i<(rural?2600:600);i++) {
        const x=(random()-.5)*w*3.9,z=(random()-.5)*d*3.9;
        // Existing authored core keeps its original collision and route guarantees.
        if(Math.abs(x)<w*.52 && Math.abs(z)<d*.52 || !clear(x,z,3))continue;
        b.tree(x,z,i%6===0?1:0);
        const trunk=map.boxes.at(-2)!, crown=map.boxes.at(-1)!;
        const height=9+random()*9;
        trunk.s[1]=height*.65;trunk.p[1]=trunk.s[1]/2;
        crown.p[1]=height*.78;crown.s=[4+random()*3,height*.46,4+random()*3];
    }
    if(rural) for(let i=0;i<13000;i++) {
        const x=(random()-.5)*w*3.85,z=(random()-.5)*d*3.85;
        if(!clear(x,z,.6))continue;
        b.box([x,.32+random()*.12,z],[1.8,.7+random()*.3,1],rgb('#a6b17e'),'grass',false,[0,random()*Math.PI,0]);
    }
    map.subtitle = `${map.size[0]} × ${map.size[1]} м · 12 новых районов · ${map.exits.length} выходов · ${Math.round(map.duration/60)} мин`;
    return map;
}
