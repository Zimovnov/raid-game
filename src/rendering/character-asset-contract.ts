import type { CharacterJoint, CharacterLayer, CharacterMaterialRole } from '../domain/types.js';
import type { ModelAssetDefinition } from '../content/model-asset-types.js';

export const CHARACTER_LAYER_JOINTS: Record<CharacterLayer, readonly CharacterJoint[]> = {
    body: ['torso', 'pelvis', 'head', 'upperL', 'upperR', 'foreL', 'foreR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'],
    face: ['head'], jacket: ['torso', 'upperL', 'upperR', 'foreL', 'foreR'],
    trousers: ['pelvis', 'thighL', 'thighR', 'shinL', 'shinR'],
    headwear: ['head'], gloves: ['foreL', 'foreR'], boots: ['footL', 'footR']
};
const roles: readonly CharacterMaterialRole[] = ['skin', 'fabric', 'trim'];

/** An incomplete layer must never suppress half of the procedural outfit. */
export function validateCharacterAssetDefinition(definition: ModelAssetDefinition): void {
    const character = definition.character;
    if (!character) return;
    const joints = CHARACTER_LAYER_JOINTS[character.layer];
    if (!joints || definition.frame !== 'meters') throw Error('Invalid character layer or coordinate frame');
    const groups = Object.entries(character.groups);
    if (new Set(definition.groups).size !== definition.groups.length || groups.length !== definition.groups.length || !groups.length) throw Error('Incomplete character group manifest');
    for (const [name, group] of groups) {
        if (!definition.groups.includes(name) || !joints.includes(group.joint) || !group.roles.length || new Set(group.roles).size !== group.roles.length || group.roles.some(role => !roles.includes(role))) throw Error('Invalid character rigid group: ' + name);
    }
    for (const joint of joints) if (!groups.some(([, group]) => group.joint === joint)) throw Error('Missing character joint: ' + joint);
}

export function validateCharacterMeshMetadata(definition: ModelAssetDefinition, extras: Record<string, unknown>, skinned: boolean): void {
    if (!definition.character) return;
    const group = definition.character.groups[String(extras.assetKey)];
    if (!group || skinned || extras.raidLayer !== definition.character.layer || extras.raidJoint !== group.joint || !group.roles.includes(extras.materialRole as CharacterMaterialRole)) throw Error('Invalid character mesh metadata: ' + String(extras.assetKey));
}
