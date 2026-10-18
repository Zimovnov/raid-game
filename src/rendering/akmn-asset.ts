import { FABRIC_ASSETS } from '../content/fabric-assets.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { appearancePalette } from '../content/apparel.js';
import type { Character } from '../domain/types.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { Item } from '../domain/types.js';
import { AKMN_ASSET_URL, AKMN_PRESENTATION, usesAKMNAsset } from '../content/akmn-asset.js';
import { AnimationEventCursor, type VisualAnimationEvent } from './animation-events.js';
import type { WeaponPose } from './weapon-animation.js';
import type { Mat4 } from './math.js';

interface Clip { name: string; duration: number; events: VisualAnimationEvent[] }
interface Manifest { clips: Clip[] }
interface Rest { node: TransformNode; position: Vector3; rotation: Quaternion; scale: Vector3 }

/** One local view/workbench instance; world instances use the supplied separate LODs.
 * Sampling follows simulation progress so pause, low FPS and cancellation cannot
 * complete a reload or create an extra shot. The game owns all authoritative state.
 */
export class AKMNAsset {
    private container: AssetContainer | null = null;
    private root: TransformNode;
    private rest: Rest[] = [];
    private clips = new Map<string, Clip>();
    private active: AnimationGroup | null = null;
    private cursor = new AnimationEventCursor();
    private disposed = false;
    private requested = false;
    private firstPerson = false;
    private visible = false;
    private playback = 0;
    private previousTime = -1;
    private fabrics = new Map<string, Texture>();
    loadError = '';
    visualEvents: VisualAnimationEvent[] = [];

    constructor(private scene: Scene) {
        this.root = new TransformNode('AKMN_Presentation', scene);
        this.root.setEnabled(false);
    }
    private async load() {
        this.requested = true;
        try {
            await import('@babylonjs/loaders/glTF/index.js');
            const [container, response] = await Promise.all([
                LoadAssetContainerAsync(AKMN_ASSET_URL, this.scene),
                fetch('/assets/akmn/animation-manifest.json')
            ]);
            if (!response.ok) { container.dispose(); throw Error('AKMN manifest HTTP ' + response.status); }
            const manifest = await response.json() as Manifest;
            if (this.disposed) { container.dispose(); return; }
            container.addAllToScene();
            for (const node of container.rootNodes) node.parent = this.root;
            for (const group of container.animationGroups) group.stop();
            this.rest = container.transformNodes.map(node => ({ node, position: node.position.clone(), rotation: node.rotationQuaternion?.clone() || Quaternion.FromEulerVector(node.rotation), scale: node.scaling.clone() }));
            this.container = container;
            this.clips = new Map(manifest.clips.map(clip => [clip.name, clip]));
            for (const mesh of container.meshes) mesh.alwaysSelectAsActiveMesh = true;
            this.root.setEnabled(false);
        } catch (error) {
            this.loadError = error instanceof Error ? error.message : String(error);
            console.error('AKMN asset load failed:', this.loadError);
        }
    }
    available(gun: Item): boolean {
        if (!usesAKMNAsset(gun)) return false;
        if (!this.requested) void this.load();
        return !!this.container;
    }
    begin() { this.visible = false; this.root.setEnabled(false); }
    private resetPose() {
        this.active?.stop(); this.active = null;
        for (const rest of this.rest) {
            rest.node.position.copyFrom(rest.position);
            rest.node.rotationQuaternion = rest.rotation.clone();
            rest.node.scaling.copyFrom(rest.scale);
        }
    }
    show(parent: Mat4, pose: WeaponPose, firstPerson: boolean, character?: Character) {
        if (!this.container) return;
        this.visible = true; this.firstPerson = firstPerson;
        if (character) {
            const palette = appearancePalette(character);
            for (const material of this.container.materials) {
                if (!(material instanceof PBRMaterial) || material.name !== 'AKMN_TestSleeve') continue;
                const id = palette.appearance.jacketCamo;
                let texture = this.fabrics.get(id);
                if (!texture) { texture = new Texture(FABRIC_ASSETS[id], this.scene); this.fabrics.set(id, texture); }
                material.albedoTexture = texture; material.albedoColor = Color3.White(); material.roughness = .94; material.metallic = 0;
            }
            for (const mesh of this.container.meshes) if (mesh.name.startsWith('AKMN_TestSleeve') && !mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
                const positions = mesh.getVerticesData(VertexBuffer.PositionKind) || [], uvs: number[] = [];
                for (let i = 0; i < positions.length; i += 3) uvs.push(positions[i] / .45, positions[i + 2] / .45);
                mesh.setVerticesData(VertexBuffer.UVKind, uvs);
            }
        }
        const matrix = Matrix.FromArray(parent);
        matrix.decompose(this.root.scaling, this.root.rotationQuaternion ||= Quaternion.Identity(), this.root.position);
        this.root.position.addInPlace(Vector3.TransformNormal(Vector3.FromArray(AKMN_PRESENTATION.offset), matrix));
        let name = '', progress = 0;
        if ((pose.reload || 0) > 0 && (pose.mode === 'swap' || pose.mode === 'range')) {
            name = 'AKMN_FP_Reload_' + (pose.empty ? 'Empty' : 'Tactical'); progress = pose.reload!;
        } else if ((pose.inspect || 0) > 0) { name = 'AKMN_FP_Inspect'; progress = pose.inspect!; }
        else if ((pose.shotAge ?? 100) < .105) { name = 'AKMN_FP_Fire'; progress = (pose.shotAge || 0) / .1; }
        const clip = this.clips.get(name), group = this.container.animationGroups.find(value => value.name === name) || null;
        const seconds = clip ? Math.max(0, Math.min(1, progress)) * clip.duration : 0;
        if (group !== this.active || seconds < this.previousTime) {
            this.resetPose(); this.playback++; this.cursor.reset();
            if (group) { group.start(false); group.pause(); this.active = group; }
        }
        this.previousTime = seconds;
        if (group && clip) group.goToFrame(group.from + (group.to - group.from) * Math.min(1, progress));
        this.visualEvents = clip ? this.cursor.advance(name + ':' + this.playback, seconds, clip.events) : [];
        // State derived from absolute progress also restores correctly after seeks.
        const swap = name.includes('Reload_');
        for (const mesh of this.container.meshes) {
            if (mesh.name === 'AKMN_Magazine_FP') mesh.setEnabled(!swap || progress < .47);
            if (mesh.name === 'AKMN_Magazine_Spare') mesh.setEnabled(swap && progress >= .50);
            if (mesh.name.startsWith('AKMN_Test') || mesh.name.startsWith('AKMN_Finger') || mesh.name.startsWith('AKMN_Thumb')) mesh.setEnabled(firstPerson);
        }
        if (pose.mode === 'charge' && (pose.reload || 0) > 0) {
            const carrier = this.rest.find(value => value.node.name === 'bolt_carrier');
            if (carrier) carrier.node.position.z = carrier.position.z + .068 * Math.sin(Math.PI * pose.reload!);
        }
    }
    renderPass(includeStatic: boolean) { this.root.setEnabled(this.visible && (this.firstPerson ? !includeStatic : includeStatic)); }
    dispose() { this.disposed = true; this.container?.dispose(); for (const texture of this.fabrics.values()) texture.dispose(); this.fabrics.clear(); this.root.dispose(); }
}
