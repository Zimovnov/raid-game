import type { Shape, Vec3 } from '../domain/types.js';
export interface Geometry {
    vertices: Float32Array;
    count: number;
}
export function geometry(shape: Shape): Geometry {
    const a: number[] = [];
    function tri(p: Vec3, q: Vec3, r: Vec3) {
        const u = q.map((v,i)=>v-p[i]), v = r.map((v,i)=>v-p[i]);
        let normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
        const length = Math.hypot(...normal);
        if (length < 1e-10) return; // Sphere poles and wedge seam are not triangles.
        // All primitives are convex. Orient the face away from an interior point;
        // the former box/sphere recipes had inward normals and inverted lighting.
        const centre = shape === 'wedge' ? [0,-.25,0] : [0,0,0];
        const outward = normal.reduce((sum,n,i)=>sum+n*((p[i]+q[i]+r[i])/3-centre[i]),0);
        if (outward < 0) { [q,r] = [r,q]; normal = normal.map(n=>-n); }
        normal = normal.map(n=>n/length);
        for (const point of [p,q,r]) a.push(...point,...normal);
    }
    function quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3) { tri(a, b, c); tri(a, c, d); }
    if (shape === 'plane') {
        quad([-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]);
    }
    else if (shape === 'box' || shape === 'wedge') {
        const p: Vec3[] = [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5], [-.5, shape === 'wedge' ? -.5 : .5, -.5], [.5, shape === 'wedge' ? -.5 : .5, -.5], [.5, .5, .5], [-.5, .5, .5]];
        for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]])
            quad(p[f[0]], p[f[1]], p[f[2]], p[f[3]]);
    }
    else if (shape === 'cylinder' || shape === 'cone') {
        for (let i = 0; i < 12; i++) {
            const t = i * Math.PI / 6, u = (i + 1) * Math.PI / 6, p: Vec3 = [Math.cos(t) * .5, -.5, Math.sin(t) * .5], q: Vec3 = [Math.cos(u) * .5, -.5, Math.sin(u) * .5];
            tri([0, -.5, 0], p, q);
            if (shape === 'cone')
                tri(p, [0, .5, 0], q);
            else {
                const r: Vec3 = [p[0], .5, p[2]], s: Vec3 = [q[0], .5, q[2]];
                quad(p, r, s, q);
                tri([0, .5, 0], s, r);
            }
        }
    }
    else {
        const point = (i: number, j: number): Vec3 => { const t = i * Math.PI / 8, u = j * Math.PI / 6; return [Math.sin(t) * Math.cos(u) * .5, Math.cos(t) * .5, Math.sin(t) * Math.sin(u) * .5]; };
        for (let i = 0; i < 8; i++)
            for (let j = 0; j < 12; j++)
                quad(point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1));
    }
    return { vertices: new Float32Array(a), count: a.length / 6 };
}
