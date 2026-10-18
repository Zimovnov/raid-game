import type { Item, Vec3 } from '../domain/types.js';
import { CATALOG } from '../content/catalog.js';
import { model, multiply, transform, type Mat4 } from './math.js';
import { weaponMotion, type WeaponPose } from './weapon-animation.js';

export interface HeldWeaponPresentation {
    gun?: Item;
    weaponPose?: WeaponPose;
    pitch?: number;
    relaxed?: boolean;
}

export function thirdPersonBodyFrame(time = 0, moving = 0, crouch = false): { torso: Vec3; tilt: number; hip: number; bob: number } {
    const speed = Number.isFinite(moving) ? Math.min(1.35, Math.max(0, moving)) : 0;
    const clock = Number.isFinite(time) ? time % (2 * Math.PI) : 0;
    const bob = crouch ? 0 : -speed * (.02 + Math.abs(Math.sin(clock * 8)) * .035);
    return { torso: [0, (crouch ? .66 : 1.06) + bob, crouch ? -.035 : 0], tilt: crouch ? -.12 : 0, hip: crouch ? .40 : .77 + bob, bob };
}

export function heldWeaponShoulders(time = 0, moving = 0, crouch = false): { left: Vec3; right: Vec3 } {
    const body = thirdPersonBodyFrame(time, moving, crouch), matrix = model(body.torso, [1, 1, 1], [body.tilt, 0, 0]);
    // Raising both arms brings the shoulder joints forward around the rib cage.
    // The small protraction keeps a support arm from cutting across the chest at steep pitches.
    return { left: transform(matrix, [-.28, .215, -.075]), right: transform(matrix, [.28, .215, -.075]) };
}

export function normalizedWeaponPose(pose: WeaponPose = {}): WeaponPose {
    const progress = (n: number | undefined) => typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
    return { reload: progress(pose.reload), inspect: progress(pose.inspect), shotAge: typeof pose.shotAge === 'number' && Number.isFinite(pose.shotAge) ? Math.max(0, pose.shotAge) : 100, mode: typeof pose.mode === 'string' ? pose.mode : '', empty: pose.empty === true };
}

/** One presentation transform is shared by the held mesh, both hands and muzzle flash.
 * These authored third-person scales fit the existing stylized weapon recipes to the character;
 * they do not change first-person models, authoritative ballistics or weapon stats. */
export function heldWeaponMatrix(gun: Item, pose: WeaponPose = {}, crouch = false, pitch = 0, time = 0, moving = 0): Mat4 {
    const safePose = normalizedWeaponPose(pose), motion = weaponMotion(gun, safePose), idle = weaponMotion(gun);
    const angle = Number.isFinite(pitch) ? Math.max(-1.48, Math.min(1.48, pitch)) : 0;
    const pistol = ['pm', 'tt', 'glock', 'grach', 'm9a3', 'm17'].includes(CATALOG[gun.def].shape), scale = pistol ? .90 : .70;
    const body = thirdPersonBodyFrame(time, moving, crouch), shoulders = heldWeaponShoulders(time, moving, crouch);
    const middle: Vec3 = idle.left.map((n, k) => (n + idle.right[k]) / 2) as Vec3;
    const basis = model([0, 0, 0], [scale, scale, scale], [angle, 0, 0]);
    const centered = transform(basis, middle);
    const matrix = multiply(basis, model(motion.body, [1, 1, 1], motion.rotation));
    // A pistol is held slightly farther out. Long guns remain close to the shoulder and in front
    // of the vest; a bullpup keeps the actual support/reload hand assignments, even when they cross.
    const desired: Vec3 = [pistol ? .045 : .105, body.torso[1] + .12, pistol ? -.435 : -.38];
    const translation: Vec3 = desired.map((n, k) => n - centered[k]) as Vec3;
    const leftLocal = transform(matrix, motion.left), rightLocal = transform(matrix, motion.right);
    const targets = [[leftLocal, shoulders.left], [rightLocal, shoulders.right]] as const;
    // Project the *whole weapon*, never an individual grip, into the intersection of both reach
    // volumes. Reload body motion therefore cannot tear a hand off the rendered magazine/handle.
    const reach = .641, frontLimit = crouch ? -.235 : -.20;
    for (let iteration = 0; iteration < 18; iteration++) {
        for (const [local, shoulder] of targets) {
            const delta = local.map((n, k) => n + translation[k] - shoulder[k]) as Vec3;
            const distance = Math.hypot(...delta);
            if (distance > reach) for (let k = 0; k < 3; k++) translation[k] -= delta[k] * (1 - reach / distance);
        }
        translation[2] = Math.min(translation[2], frontLimit - Math.max(leftLocal[2], rightLocal[2]));
    }
    matrix[12] += translation[0]; matrix[13] += translation[1]; matrix[14] += translation[2];
    return matrix;
}

export function heldWeaponGripTargets(gun: Item, pose: WeaponPose = {}, crouch = false, pitch = 0, time = 0, moving = 0): { left: Vec3; right: Vec3; matrix: Mat4 } {
    const motion = weaponMotion(gun, normalizedWeaponPose(pose)), matrix = heldWeaponMatrix(gun, pose, crouch, pitch, time, moving);
    return { left: transform(matrix, motion.left), right: transform(matrix, motion.right), matrix };
}
