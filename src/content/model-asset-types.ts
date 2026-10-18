import type { CharacterJoint, CharacterLayer, CharacterMaterialRole, Vec3 } from '../domain/types.js';

export interface AssetTransform { p: Vec3; s: Vec3; r: Vec3 }
export interface ModelBounds { min: Vec3; max: Vec3 }
export interface ModelAssetDefinition {
    url: string;
    groups: string[];
    /** Omitted for existing GLBs normalized against their procedural first part. */
    frame?: 'normalized' | 'meters';
    /** Explicit local art corrections, composed after the simulation's socket frame. */
    groupTransforms?: Record<string, AssetTransform>;
    /** LOD0 polygon bounds before socket/art transforms, in game metre axes. */
    groupBounds?: Record<string, ModelBounds>;
    /** Rigid, joint-local character geometry; the existing game rig owns its pose. */
    character?: {
        layer: CharacterLayer;
        groups: Record<string, { joint: CharacterJoint; roles: CharacterMaterialRole[] }>;
    };
}
