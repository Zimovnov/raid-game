import type { CharacterAssetBinding, CharacterJoint, CharacterLayer, Color, Part } from '../domain/types.js';
import { CHARACTER_MODEL_ASSETS } from '../content/character-model-assets.js';
import { MODEL_ASSETS } from '../content/model-assets.js';
import { validateCharacterAssetDefinition } from './character-asset-contract.js';

export interface RigidCharacterPart { joint: CharacterJoint; part: Part }
export interface CharacterLayerSelection {
    id: string;
    layer: CharacterLayer;
    skin: Color;
    fabric?: string;
    fabricColor: Color;
}
const invalid = new WeakSet<object>();

export function characterLayerForSlot(slot: string | undefined, gloved: boolean): CharacterLayer | null {
    if (!slot) return null;
    if (slot.startsWith('face:')) return 'face';
    if (slot.startsWith('jacket:')) return 'jacket';
    if (slot.startsWith('trousers:') || slot.startsWith('knee:') || slot === 'belt' || slot.startsWith('belt:')) return 'trousers';
    if (slot.startsWith('headwear:')) return 'headwear';
    if (slot.startsWith('boot:')) return 'boots';
    if (slot.startsWith('hand:') || slot.startsWith('glove:')) return gloved ? 'gloves' : 'body';
    return null;
}

/** Carriers draw once per joint group; every legacy piece shares the same atomic layer load. */
export function bindCharacterAssets(bound: readonly RigidCharacterPart[], selections: readonly CharacterLayerSelection[], gloved: boolean, visibleJoints?: readonly CharacterJoint[]): readonly RigidCharacterPart[] {
    if (!selections.some(selection => CHARACTER_MODEL_ASSETS[selection.id])) return bound;
    const result = bound.map(entry => ({ joint: entry.joint, part: { ...entry.part } }));
    for (const selection of selections) {
        const source = CHARACTER_MODEL_ASSETS[selection.id];
        if (!source || source.layer !== selection.layer) continue;
        const definition = MODEL_ASSETS[source.asset];
        if (!definition) continue;
        try {
            validateCharacterAssetDefinition(definition);
            if (definition.character?.layer !== selection.layer) throw Error('Character selection layer mismatch');
        } catch (error) {
            if (!invalid.has(definition)) { invalid.add(definition); console.error('Character asset registration failed:', selection.id, error); }
            continue;
        }
        const groups = Object.entries(definition.character!.groups).filter(([, group]) => !visibleJoints || visibleJoints.includes(group.joint));
        const binding = (group: string, first: boolean): CharacterAssetBinding => ({
            kind: 'character', assetId: source.asset, layer: selection.layer, group, first,
            transform: { p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0] },
            lodOrigin: [0, 0, 0],
            skin: [...selection.skin], fabric: selection.fabric, fabricColor: [...selection.fabricColor]
        });
        for (const entry of result) {
            if (characterLayerForSlot(entry.part.slot, gloved) !== selection.layer) continue;
            const group = groups.find(([, value]) => value.joint === entry.joint);
            if (group) entry.part.asset = binding(group[0], false);
        }
        for (const [group, metadata] of groups) result.push({ joint: metadata.joint, part: {
            shape: 'box', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], c: [...selection.fabricColor],
            assetOnly: true, asset: binding(group, true), slot: `character:${selection.layer}:${group}`
        } });
    }
    return result;
}
