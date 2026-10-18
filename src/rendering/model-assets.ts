import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { Node } from '@babylonjs/core/node.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture.js';
import type { CharacterAssetBinding, CharacterMaterialRole, Part } from '../domain/types.js';
import { MODEL_ASSETS } from '../content/model-assets.js';
import type { Mat4 } from './math.js';
import { assetInstanceMatrix, validateModelAssetFrame } from './asset-frame.js';
import { transform } from './math.js';
import { validateCharacterAssetDefinition, validateCharacterMeshMetadata } from './character-asset-contract.js';

interface Variant { groups: Map<string, Mesh[]>; materials: PBRMaterial[]; frame: number }
interface Loaded { container: AssetContainer; groups: Map<string, Mesh[]>; variants: Map<string, Variant> }
/** Mesh geometry is shared; each draw contributes its own simulation-driven matrix.
 * No mutable skeleton/pose is shared between local, dropped and remote weapons.
 */
export class ModelAssets {
    private loaded = new Map<string, Loaded>();
    private requested = new Set<string>();
    private matrices = new Map<Mesh, number[]>();
    private slots = new Map<Mesh, string[]>();
    private disposed = false;
    private frame = 0;
    readonly errors = new Map<string, string>();
    constructor(private scene: Scene, private fabricTextures?: (id: string) => { color: BaseTexture; normal: BaseTexture }, private meshAdded?: (mesh: Mesh) => void) {}
    private async load(id: string) {
        this.requested.add(id);
        let container: AssetContainer | undefined;
        try {
            const definition = MODEL_ASSETS[id];
            if (!definition) throw Error('Unknown model asset: ' + id);
            validateModelAssetFrame(definition);
            validateCharacterAssetDefinition(definition);
            await import('@babylonjs/loaders/glTF/index.js');
            container = await LoadAssetContainerAsync(MODEL_ASSETS[id].url, this.scene);
            if (this.disposed) { container.dispose(); return; }
            const groups = new Map<string, Mesh[]>();
            container.addAllToScene();
            for (const mesh of container.meshes) {
                if (!(mesh instanceof Mesh) || !mesh.getTotalVertices()) continue;
                let node: Node | null = mesh;
                let extras: Record<string, unknown> = {};
                while (node) {
                    extras = { ...node.metadata?.gltf?.extras, ...extras };
                    if (extras.assetKey) break;
                    node = node.parent;
                }
                if (typeof extras.assetKey !== 'string' || (extras.lod !== 0 && extras.lod !== 1)) {
                    container.dispose(); throw Error('Invalid model group: ' + mesh.name);
                }
                validateCharacterMeshMetadata(definition, extras, !!mesh.skeleton);
                if (definition.character && !(mesh.material instanceof PBRMaterial)) { container.dispose(); throw Error('Character mesh requires PBR material: ' + mesh.name); }
                if (definition.character && (!mesh.isVerticesDataPresent('normal') || !mesh.isVerticesDataPresent('uv'))) throw Error('Character mesh requires normals and UV: ' + mesh.name);
                const world = mesh.computeWorldMatrix(true).clone();
                mesh.parent = null;
                mesh.position.setAll(0); mesh.scaling.setAll(1); mesh.rotation.setAll(0); mesh.rotationQuaternion = Quaternion.Identity();
                mesh.bakeTransformIntoVertices(world);
                mesh.alwaysSelectAsActiveMesh = true;
                mesh.thinInstanceEnablePicking = true;
                mesh.metadata = { ...mesh.metadata, raidAsset: id, raidGroup: extras.assetKey, raidMaterialRole: extras.materialRole };
                mesh.isVisible = false;
                const key = extras.lod + ':' + extras.assetKey;
                groups.set(key, [...(groups.get(key) || []), mesh]);
            }
            for (const group of MODEL_ASSETS[id].groups) for (const lod of [0, 1]) {
                if (!groups.has(lod + ':' + group)) { container.dispose(); throw Error('Missing model group: ' + group); }
                if (definition.character) for (const role of definition.character.groups[group].roles) {
                    if (!groups.get(lod + ':' + group)!.some(mesh => mesh.metadata.raidMaterialRole === role)) { container.dispose(); throw Error('Missing character material role: ' + group + ':' + role); }
                }
            }
            this.loaded.set(id, { container, groups, variants: new Map() });
            if (!definition.character) for (const meshes of groups.values()) for (const mesh of meshes) this.meshAdded?.(mesh);
        } catch (error) {
            container?.dispose();
            const message = error instanceof Error ? error.message : String(error);
            this.errors.set(id, message);
            console.error('Model load failed:', id, message);
        }
    }
    beginPass() { this.frame++; this.matrices.clear(); this.slots.clear(); }
    hasGroup(id: string, group: string): boolean {
        const groups = this.loaded.get(id)?.groups;
        return !!groups?.has('0:' + group) && groups.has('1:' + group);
    }
    private characterVariant(id: string, loaded: Loaded, binding: CharacterAssetBinding): Variant {
        const roles = new Set(Object.values(MODEL_ASSETS[id].character!.groups).flatMap(group => group.roles));
        const key = JSON.stringify([roles.has('skin') ? binding.skin : null, roles.has('fabric') ? [binding.fabric, binding.fabricColor] : null]);
        let variant = loaded.variants.get(key);
        if (variant) { variant.frame = this.frame; return variant; }
        if (![binding.skin, binding.fabricColor].every(color => color.length === 3 && color.every(value => Number.isFinite(value) && value >= 0 && value <= 1))) throw Error('Invalid character material colors');
        const textures = roles.has('fabric') && binding.fabric && this.fabricTextures ? this.fabricTextures(binding.fabric) : null;
        const materials = new Map<string, PBRMaterial>(), groups = new Map<string, Mesh[]>();
        for (const [group, meshes] of loaded.groups) groups.set(group, meshes.map(source => {
            const mesh = source.clone('character-' + id + '-' + group, null, true)!;
            mesh.metadata = { ...source.metadata };
            mesh.isVisible = false;
            mesh.alwaysSelectAsActiveMesh = true; mesh.thinInstanceEnablePicking = true;
            this.meshAdded?.(mesh);
            const role: CharacterMaterialRole = source.metadata.raidMaterialRole;
            if (role !== 'trim') {
                const original = source.material as PBRMaterial, materialKey = original.uniqueId + ':' + role;
                let material = materials.get(materialKey);
                if (!material) {
                    material = original.clone('character-material-' + id + '-' + materialKey)!;
                    const tint = role === 'skin' ? binding.skin : binding.fabricColor;
                    material.albedoColor = new Color3(...tint); material.metallic = 0;
                    if (role === 'fabric') {
                        material.roughness = .94;
                        if (textures) {
                            material.albedoColor = Color3.White(); material.albedoTexture = textures.color; material.bumpTexture = textures.normal;
                        }
                    }
                    materials.set(materialKey, material);
                }
                mesh.material = material;
            }
            return mesh;
        }));
        variant = { groups, materials: [...materials.values()], frame: this.frame };
        loaded.variants.set(key, variant);
        return variant;
    }
    add(part: Part, parent: Mat4, world: boolean): boolean {
        if (!part.asset) return false;
        const character = part.asset.kind === 'character' ? part.asset : null;
        const weapon = part.asset.kind === 'character' ? part.asset.assetId : part.asset.weapon;
        const { group, first } = part.asset;
        if (!this.requested.has(weapon)) void this.load(weapon);
        const loaded = this.loaded.get(weapon);
        if (!loaded) return false;
        if (!!character !== !!MODEL_ASSETS[weapon].character || (character && MODEL_ASSETS[weapon].character?.layer !== character.layer)) {
            this.errors.set(weapon, 'Character layer mismatch'); return false;
        }
        if (!loaded.groups.has('0:' + group) || !loaded.groups.has('1:' + group)) {
            this.errors.set(weapon, 'Missing requested model group: ' + group);
            return false;
        }
        if (!first && MODEL_ASSETS[weapon].frame !== 'meters') return true;
        let matrix: Mat4;
        try { matrix = assetInstanceMatrix(part, parent, MODEL_ASSETS[weapon]); }
        catch (error) {
            this.errors.set(weapon, error instanceof Error ? error.message : String(error));
            return false;
        }
        let groups = loaded.groups;
        if (character) {
            try { groups = this.characterVariant(weapon, loaded, character).groups; }
            catch (error) { this.errors.set(weapon, error instanceof Error ? error.message : String(error)); return false; }
        }
        if (!first) return true;
        const origin = character ? transform(parent, character.lodOrigin) : [matrix[12], matrix[13], matrix[14]];
        const distance = Vector3.Distance(this.scene.activeCamera!.position, new Vector3(...origin));
        const meshes = groups.get((world && distance > (character ? 18 : 12) ? '1:' : '0:') + group)!;
        for (const mesh of meshes) {
            const values = this.matrices.get(mesh) || [];
            values.push(...matrix); this.matrices.set(mesh, values);
            const paths = this.slots.get(mesh) || [];
            paths.push(part.slot || ''); this.slots.set(mesh, paths);
        }
        return true;
    }
    finishPass() {
        const metrics = { drawCalls: 0, instances: 0, triangles: 0 };
        for (const loaded of this.loaded.values()) {
        for (const [key, variant] of loaded.variants) if (variant.frame < this.frame - 120 && loaded.variants.size > 16) {
            for (const meshes of variant.groups.values()) for (const mesh of meshes) mesh.dispose();
            for (const material of variant.materials) material.dispose();
            loaded.variants.delete(key);
        }
        for (const groups of [loaded.groups, ...[...loaded.variants.values()].map(variant => variant.groups)]) for (const meshes of groups.values()) for (const mesh of meshes) {
            const values = this.matrices.get(mesh) || [];
            // Unused attachment variants are already hidden. Clearing them every
            // frame makes Babylon recompute thousands of unchanged mesh bounds.
            if (!values.length && !mesh.isVisible) continue;
            mesh.isVisible = values.length > 0;
            mesh.metadata = { ...mesh.metadata, raidSlots: this.slots.get(mesh) || [] };
            mesh.thinInstanceSetBuffer('matrix', values.length ? new Float32Array(values) : null, 16, true);
            mesh.thinInstanceCount = values.length / 16;
            if (values.length) { metrics.drawCalls++; metrics.instances += values.length / 16; metrics.triangles += mesh.getTotalIndices() / 3 * values.length / 16; }
        }
        }
        return metrics;
    }
    dispose() {
        this.disposed = true;
        for (const item of this.loaded.values()) {
            for (const variant of item.variants.values()) {
                for (const meshes of variant.groups.values()) for (const mesh of meshes) mesh.dispose();
                for (const material of variant.materials) material.dispose();
            }
            item.container.dispose();
        }
        this.loaded.clear();
    }
}
