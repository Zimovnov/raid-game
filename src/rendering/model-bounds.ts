import type { Part, Vec3 } from '../domain/types.js';
import type { ModelBounds } from '../content/model-asset-types.js';
import { MODEL_ASSETS } from '../content/model-assets.js';
import { assetInstanceMatrix, validModelBounds } from './asset-frame.js';
import { geometry } from './geometry.js';
import { identity, model, transform } from './math.js';

const primitives = new Map<Part['shape'], Float32Array>();
const grounded = new WeakMap<Part[], { signature: string; offset: number }>();

/** lootModel already grounds the fallback. Recalculate only when a GLB becomes visible. */
export function lootGroundOffset(parts: Part[], available: (id: string, group: string) => boolean): number {
    const candidates = parts.flatMap(part => {
        const binding = part.asset?.kind !== 'character' ? part.asset : undefined;
        const definition = binding && MODEL_ASSETS[binding.weapon];
        return binding?.first && definition?.frame === 'meters' && definition.groupBounds?.[binding.group] ? [binding] : [];
    });
    if (!candidates.length) return 0;
    const states = candidates.map(binding => available(binding.weapon, binding.group));
    if (!states.some(Boolean)) return 0;
    const signature = states.join(','), cached = grounded.get(parts);
    if (cached?.signature === signature) return cached.offset;
    const offset = -(presentationBounds(parts, available)?.min[1] || 0);
    grounded.set(parts, { signature, offset });
    return offset;
}

/** Bounds of the displayed assembly. Unloaded/failed assets retain their fallback. */
export function presentationBounds(parts: Part[], available: (id: string, group: string) => boolean): ModelBounds | null {
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    const include = (point: Vec3) => {
        for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]); }
    };
    for (const part of parts) {
        const binding = part.asset?.kind !== 'character' ? part.asset : undefined;
        const definition = binding && MODEL_ASSETS[binding.weapon];
        const bounds = definition?.frame === 'meters' ? definition.groupBounds?.[binding!.group] : undefined;
        if (binding && bounds && validModelBounds(bounds) && available(binding.weapon, binding.group)) {
            if (!binding.first) continue;
            const matrix = assetInstanceMatrix(part, identity(), definition!);
            for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) include(transform(matrix, [x, y, z]));
            continue;
        }
        if (part.assetOnly) continue;
        let vertices = primitives.get(part.shape);
        if (!vertices) { vertices = geometry(part.shape).vertices; primitives.set(part.shape, vertices); }
        const matrix = model(part.p, part.s, part.r);
        for (let at = 0; at < vertices.length; at += 6) include(transform(matrix, [vertices[at], vertices[at + 1], vertices[at + 2]]));
    }
    return Number.isFinite(min[0]) ? { min, max } : null;
}
