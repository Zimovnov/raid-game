import type { Vec3 } from '../domain/types.js';
export type Mat4 = Float32Array;
export const identity = (): Mat4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function multiply(a: Mat4, b: Mat4): Mat4 { const out = new Float32Array(16); for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
        out[c * 4 + r] = a[r] * b[c * 4] + a[r + 4] * b[c * 4 + 1] + a[r + 8] * b[c * 4 + 2] + a[r + 12] * b[c * 4 + 3]; return out; }
export function model(p: Vec3 = [0, 0, 0], s: Vec3 = [1, 1, 1], r: Vec3 = [0, 0, 0]): Mat4 {
    const [x, y, z] = r, cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    const out = identity();
    out[0] = (cy * cz + sy * sx * sz) * s[0];
    out[1] = cx * sz * s[0];
    out[2] = (-sy * cz + cy * sx * sz) * s[0];
    out[4] = (-cy * sz + sy * sx * cz) * s[1];
    out[5] = cx * cz * s[1];
    out[6] = (sy * sz + cy * sx * cz) * s[1];
    out[8] = sy * cx * s[2];
    out[9] = -sx * s[2];
    out[10] = cy * cx * s[2];
    out[12] = p[0];
    out[13] = p[1];
    out[14] = p[2];
    return out;
}
// The world needs more distant depth precision; close hands keep their own projection.
export const WORLD_NEAR = .12, VIEWMODEL_NEAR = .035;
export function perspective(fov: number, aspect: number, near = VIEWMODEL_NEAR, far = 240): Mat4 { const f = 1 / Math.tan(fov * Math.PI / 360), nf = 1 / (near - far); return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]); }
export function lookAt(eye: Vec3, target: Vec3): Mat4 {
    let z: Vec3 = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]];
    let l = Math.hypot(...z) || 1;
    z = z.map(n => n / l) as Vec3;
    let x: Vec3 = [z[2], 0, -z[0]];
    l = Math.hypot(...x) || 1;
    x = x.map(n => n / l) as Vec3;
    const y: Vec3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1]);
}
export function transform(m: Mat4, p: Vec3): Vec3 { const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w, (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w]; }
