import type { MapDef, Vec3, Color, Category, Box } from '../domain/types.js';
import { rgb } from '../domain/util.js';
const brick = rgb(0x936755), concrete = rgb(0x91928b), steel = rgb(0x55676a), wood = rgb(0x847454);
export class Builder {
    m: MapDef;
    n = 0;
    constructor(id: string, name: string, subtitle: string, theme: string, size: [
        number,
        number
    ], ground: Color, fog: Color) { this.m = { id, name, subtitle, theme, size, ground, fog, duration: id === 'factory' ? 600 : 720, boxes: [], surfaces: [], doors: [], loot: [], spawn: [], bots: [], exits: [], pois: [], signs: [] }; }
    box(p: Vec3, s: Vec3, color: Color, kind = 'box', solid = true, rotation?: Vec3): Box { const b = { id: 'b' + this.n++, p, s, color, kind, solid, rotation }; this.m.boxes.push(b); return b; }
    room(x: number, z: number, w: number, d: number, label: string, color = brick, open = 'ns', h = 4.6, roof = true) {
        this.box([x, -.06, z], [w, .12, d], rgb(0x797e76), 'floor', false);
        const wall = (side: string, p: Vec3, len: number, axis: 'x' | 'z') => {
            if (!open.includes(side)) {
                this.box(p, axis === 'x' ? [len, h, .45] : [.45, h, len], color, 'wall');
                return;
            }
            const gap = 3.4, l = (len - gap) / 2;
            for (const s of [-1, 1]) {
                const pp: [
                    number,
                    number,
                    number
                ] = [...p];
                pp[axis === 'x' ? 0 : 2] += s * (gap / 2 + l / 2);
                this.box(pp, axis === 'x' ? [l, h, .45] : [.45, h, l], color, 'wall');
            }
            const top: [
                number,
                number,
                number
            ] = [...p];
            top[1] = 2.8 + (h - 2.8) / 2;
            this.box(top, axis === 'x' ? [gap, h - 2.8, .45] : [.45, h - 2.8, gap], color, 'wall');
        };
        wall('n', [x, h / 2, z - d / 2], w, 'x');
        wall('s', [x, h / 2, z + d / 2], w, 'x');
        wall('w', [x - w / 2, h / 2, z], d, 'z');
        wall('e', [x + w / 2, h / 2, z], d, 'z');
        if (roof)
            this.box([x, h + .12, z], [w + .5, .24, d + .5], rgb(0x555b5b), 'roof', true);
        this.m.signs.push({ text: label, p: [x, 3.25, z + d / 2 + .28], yaw: 0 });
    }
    door(p: Vec3, axis: 'x' | 'z', name = 'Служебная дверь', open = false) { this.m.doors.push({ id: 'door' + this.n++, p, s: axis === 'x' ? [3.2, 2.65, .24] : [.24, 2.65, 3.2], open, axis, name }); }
    loot(x: number, z: number, category: Category, name: string, y = 0, loose = false) { this.m.loot.push({ id: 'loot' + this.m.loot.length, p: [x, y + .85, z], category, name, loose }); if (!loose)
        this.box([x, y + .33, z], [1.3, .65, .9], category === 'medical' ? rgb(0xa0a795) : wood, 'crate', true);
    else
        this.box([x, y + .38, z], [1.15, .72, .8], wood, 'table', true); }
    poi(id: string, name: string, p: Vec3) { this.m.pois.push({ id, name, p }); }
    exit(id: string, name: string, p: Vec3) { this.m.exits.push({ id, name, p, radius: 3, seconds: 8 }); this.m.signs.push({ text: 'ВЫХОД / ' + name, p: [p[0], 2.6, p[2] - 1.5], yaw: 0 }); this.box([p[0] - 2.3, 1.3, p[2] - 1.5], [.16, 2.6, .16], steel); this.box([p[0] + 2.3, 1.3, p[2] - 1.5], [.16, 2.6, .16], steel); }
    boundary() { const [w, d] = this.m.size; this.box([0, 2, -d / 2], [w, 4, .5], concrete, 'wall'); this.box([0, 2, d / 2], [w, 4, .5], concrete, 'wall'); this.box([-w / 2, 2, 0], [.5, 4, d], concrete, 'wall'); this.box([w / 2, 2, 0], [.5, 4, d], concrete, 'wall'); }
    tree(x: number, z: number, variant = 0) { this.box([x, 2.4, z], [.55, 4.8, .55], rgb(variant ? 0xb3b5a5 : 0x65573e), 'trunk'); this.box([x, 5.8, z], [4.5, 4.8, 4.5], rgb(variant ? 0x5a7252 : 0x455b49), 'tree', false); }
    stairs(x: number, z: number, w: number, d: number, y: number, rise: number) {
        this.m.surfaces.push({ x, z, w, d, y, rise });
        this.box([x, y + rise / 2, z], [w, Math.abs(rise), d], concrete, 'ramp', false, [0, rise < 0 ? Math.PI : 0, 0]);
        for (let i = 0; i < 14; i++) {
            const zz = z - d / 2 + (i + .5) / 14 * d, yy = y + rise * (i + .5) / 14;
            this.box([x, yy + .025, zz], [w, .05, .08], rgb(0xa7aaa1), 'step', false);
        }
    }
    deck(x: number, z: number, w: number, d: number, y: number) { this.m.surfaces.push({ x, z, w, d, y }); this.box([x, y - .13, z], [w, .26, d], concrete, 'floor', true); }
}
