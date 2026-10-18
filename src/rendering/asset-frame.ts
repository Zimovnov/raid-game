import type { AssetTransform, ModelAssetDefinition, ModelBounds } from '../content/model-asset-types.js';
import type { Part } from '../domain/types.js';
import { model, multiply, type Mat4 } from './math.js';

const validTransform = (value: AssetTransform): boolean => !!value &&
    [value.p, value.s, value.r].every(vector => Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite)) && value.s.every(n => n > 0);

export const validModelBounds = (value: ModelBounds): boolean => !!value &&
    [value.min, value.max].every(vector => Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite)) &&
    value.min.every((n, axis) => n <= value.max[axis]);

export function validateModelAssetFrame(definition: ModelAssetDefinition): void {
    if (definition.frame !== undefined && !['normalized', 'meters'].includes(definition.frame)) throw Error('Unknown model coordinate frame');
    if (definition.groupTransforms && definition.frame !== 'meters') throw Error('Group transforms require the metre coordinate frame');
    for (const [group, value] of Object.entries(definition.groupTransforms || {})) {
        if (!definition.groups.includes(group) || !validTransform(value)) throw Error('Invalid group transform: ' + group);
    }
    if (definition.groupBounds && definition.frame !== 'meters') throw Error('Group bounds require the metre coordinate frame');
    for (const [group, value] of Object.entries(definition.groupBounds || {})) {
        if (!definition.groups.includes(group) || !validModelBounds(value)) throw Error('Invalid group bounds: ' + group);
    }
}

/** Metre assets use the socket, never the size/orientation of a fallback primitive. */
export function assetInstanceMatrix(part: Part, parent: Mat4, definition: ModelAssetDefinition): Mat4 {
    if (definition.frame !== 'meters') return multiply(parent, model(part.p, part.s, part.r));
    const frame = part.asset?.transform;
    if (!frame || !validTransform(frame)) throw Error('Missing or invalid metre socket transform: ' + part.asset?.group);
    let matrix = multiply(parent, model(frame.p, frame.s, frame.r));
    const correction = definition.groupTransforms?.[part.asset!.group];
    if (correction) matrix = multiply(matrix, model(correction.p, correction.s, correction.r));
    return matrix;
}
