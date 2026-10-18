import type { MapDef, Vec3, Box, Door, Surface } from '../domain/types.js';
import { clamp, distXZ, norm, sub } from '../domain/util.js';
export type Obstacle = Pick<Box, 'p' | 's'> & { id?: string };
/** Same hinge/leaf shape is consumed by rendering, character collision and navigation. */
export function doorObstacle(d: Door): Obstacle {
    if (!d.open) return {id:d.id, p:[...d.p], s:[...d.s]};
    const w = d.axis === 'x' ? d.s[0] : d.s[2];
    return {id:d.id, p: d.axis === 'x' ? [d.p[0]-w/2,d.p[1],d.p[2]+w/2] : [d.p[0]+w/2,d.p[1],d.p[2]-w/2], s:[d.s[2],d.s[1],d.s[0]]};
}
export function rayBox(origin: Vec3, dir: Vec3, box: Obstacle, max = 200): number | null {
    let near = 0, far = max;
    for (let a = 0; a < 3; a++) {
        const lo = box.p[a] - box.s[a] / 2, hi = box.p[a] + box.s[a] / 2;
        if (Math.abs(dir[a]) < 1e-8) {
            if (origin[a] < lo || origin[a] > hi)
                return null;
        }
        else {
            let t1 = (lo - origin[a]) / dir[a], t2 = (hi - origin[a]) / dir[a];
            if (t1 > t2)
                [t1, t2] = [t2, t1];
            near = Math.max(near, t1);
            far = Math.min(far, t2);
            if (near > far)
                return null;
        }
    }
    return near <= max ? near : null;
}
export function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number, max: number): number | null {
    const q = sub(o, c), dd = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    if (![...o, ...d, ...c, r, max].every(Number.isFinite) || dd < 1e-12 || r <= 0 || max <= 0) return null;
    const offset = q[0] ** 2 + q[1] ** 2 + q[2] ** 2 - r * r;
    // Overlapping actors still intercept a ray. A negative entry root is not a miss.
    if (offset <= 0) return 0;
    const b = q[0] * d[0] + q[1] * d[1] + q[2] * d[2], discriminant = b * b - dd * offset;
    if (discriminant < 0) return null;
    const t = (-b - Math.sqrt(discriminant)) / dd;
    return t >= 0 && t < max ? t : null;
}
/** Ray/convex-wedge intersection includes the solid sides and base of a ramp.
 * Testing only its inclined top let horizontal shots pass straight through stairs.
 */
export function rayRamp(o: Vec3, d: Vec3, s: Surface, max = 200): number | null {
    if (!s.rise || s.w <= 0 || s.d <= 0 || max < 0) return null;
    const slope = s.rise / s.d, xmin = s.x - s.w / 2, xmax = s.x + s.w / 2;
    const zmin = s.z - s.d / 2, zmax = s.z + s.d / 2, base = Math.min(s.y, s.y + s.rise);
    // Each plane describes nx*x + ny*y + nz*z <= limit.
    const planes = [[-1, 0, 0, -xmin], [1, 0, 0, xmax], [0, 0, -1, -zmin], [0, 0, 1, zmax],
        [0, -1, 0, -base], [0, 1, -slope, s.y - slope * zmin]];
    let near = 0, far = max;
    for (const [nx, ny, nz, limit] of planes) {
        const distance = limit - nx * o[0] - ny * o[1] - nz * o[2], speed = nx * d[0] + ny * d[1] + nz * d[2];
        if (Math.abs(speed) < 1e-9) {
            if (distance < -1e-9) return null;
        } else {
            const hit = distance / speed;
            if (speed < 0) near = Math.max(near, hit);
            else far = Math.min(far, hit);
            if (near > far + 1e-9) return null;
        }
    }
    return near <= max && far >= 0 ? near : null;
}
export class Collision {
    readonly solids: Box[];
    doors: Door[];
    private cells = new Map<string, Box[]>();
    private readonly cellSize = 8;
    constructor(readonly map: MapDef) {
        this.solids = map.boxes.filter(b => b.solid);
        this.doors = map.doors.map(d => ({ ...d }));
        for (const box of this.solids) {
            for (let x = Math.floor((box.p[0]-box.s[0]/2)/8); x <= Math.floor((box.p[0]+box.s[0]/2)/8); x++)
                for (let z = Math.floor((box.p[2]-box.s[2]/2)/8); z <= Math.floor((box.p[2]+box.s[2]/2)/8); z++) {
                    const key = x+','+z, list = this.cells.get(key) || [];
                    list.push(box); this.cells.set(key,list);
                }
        }
    }
    private nearby(x: number, z: number, radius: number): Box[] {
        const xmin=Math.floor((x-radius)/this.cellSize), xmax=Math.floor((x+radius)/this.cellSize);
        const zmin=Math.floor((z-radius)/this.cellSize), zmax=Math.floor((z+radius)/this.cellSize);
        if(xmin===xmax && zmin===zmax) return this.cells.get(xmin+','+zmin) || [];
        const found=new Set<Box>();
        for(let xx=xmin;xx<=xmax;xx++) for(let zz=zmin;zz<=zmax;zz++)
            for(const box of this.cells.get(xx+','+zz) || []) found.add(box);
        return [...found];
    }
    /** Empty flat terrain needs no ten-sample capsule sweep for each graph edge. */
    clearGroundEdge(a: Vec3, b: Vec3): boolean {
        if(a[1]!==0 || b[1]!==0)return false;
        const x=(a[0]+b[0])/2,z=(a[2]+b[2])/2,r=Math.hypot(a[0]-b[0],a[2]-b[2])/2+.4;
        if(this.map.surfaces.some(s=>Math.abs(s.x-x)<s.w/2+r&&Math.abs(s.z-z)<s.d/2+r))return false;
        if(this.doors.some(d=>Math.abs(d.p[0]-x)<Math.max(d.s[0],d.s[2])+r&&Math.abs(d.p[2]-z)<Math.max(d.s[0],d.s[2])+r))return false;
        return !this.nearby(x,z,r).some(o=>o.p[1]-o.s[1]/2<1.74 && o.p[1]+o.s[1]/2>.02
            && Math.abs(o.p[0]-x)<o.s[0]/2+r && Math.abs(o.p[2]-z)<o.s[2]/2+r);
    }
    obstacles(ignoreDoors = false): Obstacle[] { return [...this.solids, ...this.doors.map(d => doorObstacle(ignoreDoors ? {...d, open:true} : d))]; }
    free(p: Vec3, r = .33, h = 1.72, ignoreDoors = false): boolean {
        if (!p.every(Number.isFinite) || Math.abs(p[0])+r > this.map.size[0]/2 || Math.abs(p[2])+r > this.map.size[1]/2) return false;
        // Stair ramps occupy a wedge, not an invisible walk-through volume beneath the slope.
        for (const s of this.map.surfaces) {
            if (!s.rise)
                continue;
            const x = clamp(p[0], s.x - s.w / 2, s.x + s.w / 2), z = clamp(p[2], s.z - s.d / 2, s.z + s.d / 2);
            if ((x - p[0]) ** 2 + (z - p[2]) ** 2 >= r * r)
                continue;
            const top = s.y + s.rise * clamp((z - s.z + s.d / 2) / s.d, 0, 1), base = Math.min(s.y, s.y + s.rise);
            if (p[1] < top - .075 && p[1] + h > base + .02)
                return false;
        }
        for (const b of [...this.nearby(p[0],p[2],r), ...this.doors.map(d => doorObstacle(ignoreDoors ? {...d, open:true} : d))]) {
            if (p[1] + h <= b.p[1] - b.s[1] / 2 + .02 || p[1] >= b.p[1] + b.s[1] / 2 - .02)
                continue;
            const x = clamp(p[0], b.p[0] - b.s[0] / 2, b.p[0] + b.s[0] / 2), z = clamp(p[2], b.p[2] - b.s[2] / 2, b.p[2] + b.s[2] / 2);
            if ((x - p[0]) ** 2 + (z - p[2]) ** 2 < r * r)
                return false;
        }
        return true;
    }
    levels(x: number, z: number, margin = 0): number[] {
        const values = [0];
        for (const s of this.map.surfaces)
            if (Math.abs(x-s.x) <= s.w/2+.001+margin && Math.abs(z-s.z) <= s.d/2+.001+margin)
                values.push(s.y+(s.rise || 0)*clamp((z-s.z+s.d/2)/s.d,0,1));
        // Solid boxes support landing. Without this, jumping onto crates fell into their collider.
        for (const b of this.nearby(x,z,margin+.001))
            if (Math.hypot(Math.max(0,Math.abs(x-b.p[0])-b.s[0]/2),Math.max(0,Math.abs(z-b.p[2])-b.s[2]/2)) <= margin+.001)
                values.push(b.p[1]+b.s[1]/2);
        return values;
    }
    floor(p: Vec3, step = .34): number { return Math.max(0, ...this.levels(p[0],p[2],.38).filter(y => y <= p[1]+step)); }
    move(p: Vec3, dx: number, dz: number, r = .33, h = 1.72, ignoreDoors = false): Vec3 {
        const out: [
            number,
            number,
            number
        ] = [...p], n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15));
        for (let j = 0; j < n; j++)
            for (const axis of [0, 2]) {
                const trial: [
                    number,
                    number,
                    number
                ] = [...out];
                trial[axis] += (axis === 0 ? dx : dz) / n;
                const floor = this.floor(trial, .34);
                if (floor > trial[1] && floor - trial[1] <= .34)
                    trial[1] = floor;
                if (this.free(trial, r, h, ignoreDoors)) {
                    out[axis] = trial[axis];
                    out[1] = trial[1];
                }
            }
        return out;
    }
    ray(o: Vec3, d: Vec3, max = 200, ignoreId = ''): {
        t: number;
        box?: Obstacle;
    } {
        let t = max, box: Obstacle | undefined;
        for (const b of this.obstacles()) {
            if ('id' in b && b.id === ignoreId)
                continue;
            const hit = rayBox(o, d, b, t);
            if (hit !== null && hit < t) {
                t = hit;
                box = b;
            }
        }
        // Floors and ramps also occlude rays, including the open terrain.
        if (d[1] < -.0001) {
            const ground = -o[1] / d[1];
            if (ground >= 0 && ground < t)
                t = ground;
        }
        for (const s of this.map.surfaces) {
            if (s.rise) {
                const hit = rayRamp(o, d, s, t);
                if (hit !== null && hit < t) t = hit;
                continue;
            }
            const slope = (s.rise || 0) / s.d, den = d[1] - slope * d[2];
            if (Math.abs(den) < 1e-7)
                continue;
            const k = (s.y + slope * (o[2] - s.z + s.d / 2) - o[1]) / den;
            if (k >= .001 && k < t) {
                const x = o[0] + d[0] * k, z = o[2] + d[2] * k;
                if (Math.abs(x - s.x) <= s.w / 2 && Math.abs(z - s.z) <= s.d / 2)
                    t = k;
            }
        }
        return { t, box };
    }
    visible(a: Vec3, b: Vec3, ignoreId = ''): boolean { const d = sub(b, a), len = Math.hypot(...d); return this.ray(a, norm(d), len, ignoreId).t >= len - .08; }
}
interface Node {
    key: string;
    p: Vec3;
    neighbors: string[];
}
/** Layered, height-aware navigation over the same collision geometry as the player. */
export class Navigation {
    nodes = new Map<string, Node>();
    private list: Node[] = [];
    private nearestCells = new Map<string, Node[]>();
    private nodeOrder = new Map<string, number>();
    private step = 2;
    constructor(readonly collision: Collision) {
        const m = collision.map;
        for (let x = -m.size[0] / 2 + 2; x < m.size[0] / 2 - 1; x += this.step)
            for (let z = -m.size[1] / 2 + 2; z < m.size[1] / 2 - 1; z += this.step) {
                const levels = [...new Set(collision.levels(x, z).map(v => Math.round(v * 100) / 100))];
                for (const y of levels)
                    if (collision.free([x, y, z], .36, 1.72, true)) {
                        const key = `${x},${z},${y}`, n = { key, p: [x, y, z] as Vec3, neighbors: [] };
                        this.nodes.set(key, n);
                        this.nodeOrder.set(key, this.list.length);
                        this.list.push(n);
                        const cell = Math.floor(x / 8) + ',' + Math.floor(z / 8);
                        const bucket = this.nearestCells.get(cell) || [];
                        bucket.push(n); this.nearestCells.set(cell, bucket);
                    }
            }
        const byXZ = new Map<string, Node[]>();
        for (const n of this.list) {
            const k = n.p[0] + ',' + n.p[2];
            byXZ.set(k, [...(byXZ.get(k) || []), n]);
        }
        for (const n of this.list)
            for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [-2, 2], [2, -2], [2, 2]])
                for (const b of byXZ.get((n.p[0] + dx) + ',' + (n.p[2] + dz)) || []) {
                    if (Math.abs(n.p[1] - b.p[1]) > .86)
                        continue;
                    let clear = true;
                    if (collision.clearGroundEdge(n.p,b.p)) { n.neighbors.push(b.key); continue; }
                    if (Math.abs(n.p[1] - b.p[1]) > .01) {
                        let p: Vec3 = [...n.p];
                        for (let t = 0; t < 12; t++) {
                            p = collision.move(p, dx / 12, dz / 12, .36, 1.72, true);
                            p[1] = collision.floor(p, .34);
                        }
                        clear = distXZ(p, b.p) < .04 && Math.abs(p[1] - b.p[1]) < .08;
                    } else {
                        // Equal-height endpoints may straddle empty space beside raised props.
                        // A free capsule must also have support; otherwise the actor falls off.
                        for (let t = .1; t < 1; t += .1) {
                            const p: Vec3 = [n.p[0] + dx * t, n.p[1], n.p[2] + dz * t];
                            if (!collision.free(p, .36, 1.72, true) || Math.abs(collision.floor(p, .34) - p[1]) > .08) {
                                clear = false;
                                break;
                            }
                        }
                    }
                    if (clear)
                        n.neighbors.push(b.key);
                }
    }
    closest(p: Vec3): Node | undefined {
        let best: Node | undefined, distance = Infinity;
        const consider = (n: Node) => {
            const cost = distXZ(n.p, p) + Math.abs(n.p[1] - p[1]) * 5;
            if (cost < distance || (cost === distance && best && this.nodeOrder.get(n.key)! < this.nodeOrder.get(best.key)!)) {
                best = n; distance = cost;
            }
        };
        const size = this.collision.map.size;
        if (!p.every(Number.isFinite) || Math.abs(p[0]) > size[0] / 2 || Math.abs(p[2]) > size[1] / 2) {
            for (const n of this.list) consider(n);
            return best;
        }
        const cx = Math.floor(p[0] / 8), cz = Math.floor(p[2] / 8);
        for (let radius = 0; radius <= Math.ceil(Math.max(...size) / 8) + 1; radius++) {
            for (let x = cx - radius; x <= cx + radius; x++)
                for (let z = cz - radius; z <= cz + radius; z++) {
                    if (radius && Math.abs(x - cx) < radius && Math.abs(z - cz) < radius) continue;
                    for (const n of this.nearestCells.get(x + ',' + z) || []) consider(n);
                }
            // Height only adds cost: no node outside this square can beat this bound.
            const outside = Math.min(p[0] - (cx - radius) * 8, (cx + radius + 1) * 8 - p[0],
                p[2] - (cz - radius) * 8, (cz + radius + 1) * 8 - p[2]);
            if (distance < outside) return best;
        }
        return best;
    }
    path(start: Vec3, end: Vec3): Vec3[] {
        const a = this.closest(start), b = this.closest(end);
        if (!a || !b)
            return [];
        const open: { key: string; score: number }[] = [], previous = new Map<string, string>();
        const g = new Map([[a.key, 0]]), closed = new Set<string>();
        const push = (key: string, score: number) => {
            let i=open.length; open.push({key,score});
            while(i>0) { const parent=(i-1)>>1; if(open[parent].score<=score)break; open[i]=open[parent];i=parent; }
            open[i]={key,score};
        };
        const pop = () => {
            const first=open[0], tail=open.pop()!;
            if(open.length) {let i=0;while(i*2+1<open.length){let child=i*2+1;if(child+1<open.length&&open[child+1].score<open[child].score)child++;if(open[child].score>=tail.score)break;open[i]=open[child];i=child;}open[i]=tail;}
            return first.key;
        };
        push(a.key,distXZ(a.p,b.p));
        while(open.length) {
            let best=pop();
            if(closed.has(best))continue;
            if(best===b.key) {
                const out:Vec3[]=[b.p];
                while(previous.has(best)){best=previous.get(best)!;out.push(this.nodes.get(best)!.p);}
                return out.reverse().slice(1);
            }
            closed.add(best);
            const n=this.nodes.get(best)!;
            for(const key of n.neighbors) {
                if(closed.has(key))continue;
                const next=this.nodes.get(key)!, cost=g.get(best)!+distXZ(n.p,next.p)+Math.abs(n.p[1]-next.p[1]);
                if(cost<(g.get(key)??Infinity)){previous.set(key,best);g.set(key,cost);push(key,cost+distXZ(next.p,b.p));}
            }
        }
        return [];
    }
    reachable(a: Vec3, b: Vec3): boolean { return this.closest(a)?.key === this.closest(b)?.key || this.path(a, b).length > 0; }
}
