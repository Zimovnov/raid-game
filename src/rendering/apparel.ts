import type { Character, CharacterJoint, Color, Equipment, Item, Part, Vec3 } from '../domain/types.js';
import { CATALOG } from '../content/catalog.js';
import { APPEARANCE_FIELDS, BACKPACKS, BOOTS, GLOVES, HEADWEAR, JACKETS, RIGS, TROUSERS, appearancePalette, camouflage, defaultAppearance, type Appearance, type Camouflage } from '../content/apparel.js';
import { rgb } from '../domain/util.js';
import { heldWeaponGripTargets, heldWeaponShoulders, thirdPersonBodyFrame, type HeldWeaponPresentation } from './held-weapon.js';
import { isPatchSelection } from '../domain/patches.js';
import { bindCharacterAssets, type CharacterLayerSelection } from './character-asset-binding.js';

type JointName = CharacterJoint;
interface Joint { p: Vec3; x: number; z: number; scaleY?: number }
interface BoundPart { joint: JointName; part: Part }
type Skeleton = Record<JointName, Joint>;
type VisibleEquipment = Pick<Equipment, 'armor' | 'helmet'>;
const seam = rgb('#464c3d'), hardware = rgb('#333a36'), skinTones = ['#b18e70', '#d2ae8a', '#b9947b', '#c5a18d', '#977457', '#d2b093'];
const scaleColor = (color: Color, amount: number): Color => color.map(v => Math.min(1, Math.max(0, v * amount))) as Color;
const choice = (list: readonly { id: string; shape: string }[], id: string): string => list.find(x => x.id === id)?.shape || list[0].shape;

function rotate(v: Vec3, x: number, z: number): Vec3 {
    const dx = v[0] * Math.cos(z) - v[1] * Math.sin(z), dy = v[0] * Math.sin(z) + v[1] * Math.cos(z);
    return [dx, dy * Math.cos(x) - v[2] * Math.sin(x), dy * Math.sin(x) + v[2] * Math.cos(x)];
}
function point(joint: Joint, local: Vec3): Vec3 {
    const v = rotate([local[0], local[1] * (joint.scaleY || 1), local[2]], joint.x, joint.z);
    return [joint.p[0] + v[0], joint.p[1] + v[1], joint.p[2] + v[2]];
}

/** A small two-segment skeleton: pockets, prints and straps use the same joint as their garment. */
export function characterJointPose(time = 0, moving = 0, crouch = false, presentation: HeldWeaponPresentation = {}): Skeleton {
    const speed = Number.isFinite(moving) ? Math.min(1.35, Math.max(0, moving)) : 0;
    const clock = Number.isFinite(time) ? time % (2 * Math.PI) : 0;
    const phase = clock * (crouch ? 6 : 8), step = Math.sin(phase), swing = step * speed * .42;
    const body = thirdPersonBodyFrame(time, moving, crouch), bob = body.bob, hipHeight = body.hip;
    const torso: Joint = { p: body.torso, x: body.tilt, z: 0 };
    const skeleton: Skeleton = {
        torso, pelvis: { p: [0, hipHeight, crouch ? .06 : 0], x: 0, z: 0 },
        head: { p: [0, (crouch ? 1.02 : 1.57) + bob, crouch ? -.085 : 0], x: 0, z: 0 },
        upperL: { p: point(torso, [-.28, .215, 0]), x: .65 + swing * .035, z: .06 },
        upperR: { p: point(torso, [.28, .215, 0]), x: .90 - swing * .025, z: -.05 },
        foreL: { p: [0, 0, 0], x: 1.51, z: .80 }, foreR: { p: [0, 0, 0], x: 1.58, z: -.16 },
        thighL: { p: [-.125, hipHeight, crouch ? .06 : 0], x: 0, z: 0 },
        thighR: { p: [.125, hipHeight, crouch ? .06 : 0], x: 0, z: 0 },
        shinL: { p: [0, 0, 0], x: 0, z: 0 }, shinR: { p: [0, 0, 0], x: 0, z: 0 },
        footL: { p: [0, 0, 0], x: 0, z: 0 }, footR: { p: [0, 0, 0], x: 0, z: 0 }
    };
    skeleton.foreL.p = point(skeleton.upperL, [0, -.285, 0]);
    skeleton.foreR.p = point(skeleton.upperR, [0, -.285, 0]);
    if (presentation.gun && !presentation.relaxed) {
        const targets = heldWeaponGripTargets(presentation.gun, presentation.weaponPose, crouch, presentation.pitch, time, moving);
        const shoulders = heldWeaponShoulders(time, moving, crouch);
        for (const side of ['L', 'R'] as const) {
            const shoulder = side === 'L' ? shoulders.left : shoulders.right, target = side === 'L' ? targets.left : targets.right;
            const delta = target.map((n, k) => n - shoulder[k]) as Vec3, distance = Math.max(.001, Math.hypot(...delta));
            const direction = delta.map(n => n / distance) as Vec3;
            const extra = Math.max(0, distance + .008 - .62), upperLength = .30 + extra * .48, foreLength = .32 + extra * .52;
            const along = (upperLength * upperLength - foreLength * foreLength + distance * distance) / (2 * distance);
            const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
            const pole: Vec3 = [side === 'L' ? -2 : 2, -.65, -.55];
            const dot = pole.reduce((sum, n, k) => sum + n * direction[k], 0);
            const normal = pole.map((n, k) => n - direction[k] * dot) as Vec3;
            const normalLength = Math.max(.001, Math.hypot(...normal));
            const elbow = shoulder.map((n, k) => n + direction[k] * along + normal[k] / normalLength * height) as Vec3;
            const orient = (a: Vec3, b: Vec3, baseLength: number): Joint => {
                const d = b.map((n, k) => n - a[k]) as Vec3, length = Math.max(.001, Math.hypot(...d));
                return { p: [...a] as Vec3, x: Math.atan2(-d[2], -d[1]), z: Math.asin(Math.max(-1, Math.min(1, d[0] / length))), scaleY: length / baseLength };
            };
            skeleton[`upper${side}`] = orient(shoulder, elbow, .285);
            skeleton[`fore${side}`] = orient(elbow, target, .289);
        }
    } else if (presentation.relaxed !== false) {
        // In the wardrobe, hands hang alongside the pockets instead of holding an invisible rifle.
        for (const side of ['L', 'R'] as const) {
            const sign = side === 'L' ? -1 : 1;
            skeleton[`upper${side}`].x = -.055 + sign * swing * .25;
            skeleton[`upper${side}`].z = sign * .115;
            skeleton[`fore${side}`] = { p: point(skeleton[`upper${side}`], [0, -.285, 0]), x: .09 + sign * swing * .35, z: sign * .07 };
        }
    }
    for (const side of ['L', 'R'] as const) {
        const sign = side === 'L' ? 1 : -1;
        const thigh = skeleton[`thigh${side}`], shin = skeleton[`shin${side}`];
        // Solve both leg segments toward a ground-relative foot target. A stance foot stays planted;
        // the opposite knee lifts, avoiding the old two-floating-feet / crouch-floor clipping cycle.
        const targetY = .13 + Math.max(0, Math.cos(phase) * sign) * speed * (crouch ? .038 : .065);
        const targetZ = -step * sign * speed * (crouch ? .083 : .22);
        const down = thigh.p[1] - targetY, forward = thigh.p[2] - targetZ;
        const distance = Math.min(.63999, Math.max(.02001, Math.hypot(down, forward)));
        const direction = Math.atan2(forward, down);
        const acos = (v: number) => Math.acos(Math.max(-1, Math.min(1, v)));
        thigh.x = direction + acos((.33 * .33 + distance * distance - .31 * .31) / (.66 * distance));
        shin.p = point(thigh, [0, -.33, 0]);
        shin.x = direction - acos((.31 * .31 + distance * distance - .33 * .33) / (.62 * distance));
        skeleton[`foot${side}`].p = point(shin, [0, -.31, 0]);
    }
    return skeleton;
}

const glyphs: Record<string, string[]> = {
    'П': ['11111', '10001', '10001', '10001', '10001', '10001', '10001'],
    'Е': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'Л': ['00111', '01001', '01001', '01001', '01001', '01001', '10001'],
    'Ь': ['10000', '10000', '10000', '11110', '10001', '10001', '11110'],
    'М': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'Н': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'И': ['10001', '10011', '10011', '10101', '11001', '11001', '10001']
};

/** Original mesh lettering, no font dependency or texture loading. Front faces local -Z. */
export function pelmeniLettering(width = .365): Part[] {
    const text = 'ПЕЛЬМЕНИ', safeWidth = Number.isFinite(width) ? width : .365;
    const cell = Math.max(.001, Math.min(.02, safeWidth / (text.length * 6 - 1))), result: Part[] = [];
    const total = (text.length * 6 - 1) * cell;
    for (let g = 0; g < text.length; g++) {
        const glyph = glyphs[text[g]];
        for (let row = 0; row < glyph.length; row++) {
            let column = 0;
            while (column < 5) {
                if (glyph[row][column] !== '1') { column++; continue; }
                const start = column;
                while (column < 5 && glyph[row][column] === '1') column++;
                result.push({ shape: 'box', p: [total / 2 - (g * 6 + (start + column) / 2) * cell, (3 - row) * cell, 0], s: [(column - start) * cell * .98, cell * .93, .003], r: [0, 0, 0], c: rgb('#98362d'), slot: `pelmeni:${g}:${row}` });
            }
        }
    }
    return result;
}

function outfitParts(face: number, appearance: Appearance, equipment?: VisibleEquipment): BoundPart[] {
    const result: BoundPart[] = [], skin = rgb(skinTones[face % skinTones.length]);
    const jacket = choice(JACKETS, appearance.jacket), trousers = choice(TROUSERS, appearance.trousers), rig = choice(RIGS, appearance.rig), backpack = choice(BACKPACKS, appearance.backpack);
    const gloves = choice(GLOVES, appearance.gloves), boots = choice(BOOTS, appearance.boots), headwear = choice(HEADWEAR, appearance.headwear);
    const upper = camouflage(appearance.jacketCamo), lower = camouflage(appearance.trouserCamo), load = camouflage(appearance.rigCamo), packCamo = camouflage(appearance.backpackCamo);
    const colors = appearancePalette({ faction: 'BEAR', outfit: 0, appearance });
    const combat = jacket === 'g4' || jacket === 'kombat', loose = ['gorka', 'sumrak', 'm65'].includes(jacket);
    const chestWidth = loose ? .46 : combat ? .425 : .44, chestDepth = loose ? .295 : .27;
    const armor = equipment?.armor && CATALOG[equipment.armor.def], helmet = equipment?.helmet && CATALOG[equipment.helmet.def];
    const armored = !!armor, front = -chestDepth / 2;

    const add = (joint: JointName, slot: string, p: Vec3, s: Vec3, c: Color, angle = 0, shape: Part['shape'] = 'box') =>
        result.push({ joint, part: { shape, p, s, r: [0, 0, angle], c, slot, legacyOnly: slot.includes(':camo:') } });
    const box = (joint: JointName, slot: string, p: Vec3, s: Vec3, color: Color, angle = 0) => add(joint, slot, p, s, color, angle);
    const fabric = (joint: JointName, slot: string, p: Vec3, s: Vec3, pattern: Camouflage, detail = 1) => {
        box(joint, slot, p, s, pattern.colors[0]);
        const original = camouflage(pattern.id);
        if (pattern.pattern === original.pattern && pattern.colors.length === original.colors.length) { result[result.length - 1].part.fabric = pattern.id; result[result.length - 1].part.fabricSize = [...s]; }
        if (pattern.pattern === 'solid') return;
        // Thin, in-bounds patches are attached to each flat face, including the sides and back.
        // The same marks persist through animation: no time-dependent noise or shimmering print.
        const rows = detail === 2 ? 4 : detail === 0 ? 1 : 2;
        const seed = [...slot].reduce((a, ch) => a + ch.charCodeAt(0), 0);
        for (const faceSide of [-1, 1]) {
            for (let n = 0; n < rows; n++) {
                const col = (seed + n * 11 + (faceSide === 1 ? 4 : 0)) % (pattern.colors.length - 1) + 1;
                const digital = pattern.pattern === 'digital', stripe = pattern.pattern === 'stripe';
                const w = s[0] * (stripe ? .61 : digital ? .27 : .38), h = s[1] * (stripe ? .12 : digital ? .17 : .22);
                const x = ((seed + n * 7 + (faceSide === 1 ? 2 : 0)) % 7 / 6 - .5) * (s[0] - w) * .88;
                const y = ((n + .5) / rows - .5) * s[1] * .80;
                const mark = `${slot}:camo:${faceSide}:${n}`;
                box(joint, mark, [p[0] + x, p[1] + y, p[2] + faceSide * (s[2] / 2 + .0009)], [w, h, .0025], pattern.colors[col]);
                if (digital || pattern.pattern === 'leaf')
                    box(joint, `${mark}:step`, [p[0] + x + w * .22, p[1] + y + h * .58, p[2] + faceSide * (s[2] / 2 + .0011)], [w * .46, h * .52, .0027], pattern.colors[col]);
            }
        }
        for (const side of [-1, 1])
            box(joint, `${slot}:camo:side:${side}`, [p[0] + side * (s[0] / 2 + .001), p[1] + s[1] * .12, p[2] - s[2] * .1], [.003, s[1] * .24, s[2] * .48], pattern.colors[1]);
    };
    const strap = (joint: JointName, slot: string, p: Vec3, s: Vec3, color = load.colors[0], angle = 0) => box(joint, slot, p, s, scaleColor(color, .84), angle);
    const pouch = (joint: JointName, slot: string, p: Vec3, s: Vec3, camo: Camouflage, flap = true) => {
        fabric(joint, slot, p, s, camo, 0);
        if (flap) box(joint, `${slot}:flap`, [p[0], p[1] + s[1] * .35, p[2] - s[2] / 2 - .005], [s[0] * .92, s[1] * .25, .009], scaleColor(camo.colors[0], .83));
        box(joint, `${slot}:closure`, [p[0], p[1] + s[1] * .22, p[2] - s[2] / 2 - .010], [.017, .024, .009], hardware);
    };

    // Pelvis and articulated legs: thigh and calf hems overlap the joint without changing collider size.
    fabric('pelvis', 'trousers:waist', [0, .017, 0], [.405, .15, .255], lower);
    box('pelvis', 'belt', [0, .064, -.003], [.416, .035, .266], rgb('#494835'));
    box('pelvis', 'belt:buckle', [0, .064, -.142], [.052, .038, .012], hardware);
    const trouserWidth = ['gorka', 'sumrak', 'afghanka'].includes(trousers) ? .21 : trousers === 'g4' ? .185 : .198;
    for (const side of ['L', 'R'] as const) {
        const sign = side === 'L' ? -1 : 1, thigh = `thigh${side}` as JointName, shin = `shin${side}` as JointName, foot = `foot${side}` as JointName;
        fabric(thigh, `trousers:thigh:${side}`, [0, -.17, 0], [trouserWidth, .35, .225], lower, 2);
        fabric(shin, `trousers:shin:${side}`, [0, -.155, 0], [trouserWidth * .91, .327, .204], lower, 1);
        box(shin, `trousers:hem:${side}`, [0, -.275, -.004], [trouserWidth * .96, .06, .214], scaleColor(lower.colors[0], .89));
        const cargoWide = trousers === 'sumrak' ? .032 : .045;
        box(thigh, `trousers:cargo:${side}`, [sign * (trouserWidth / 2 + .013), -.17, -.009], [cargoWide, trousers === 'g4' ? .14 : .19, .157], lower.colors[0]);
        box(thigh, `trousers:cargoflap:${side}`, [sign * (trouserWidth / 2 + .020), -.095, -.012], [cargoWide + .006, .038, .16], scaleColor(lower.colors[0], .79));
        if (['g4', 'kombat'].includes(trousers)) {
            box(shin, `knee:${side}:pad`, [0, -.024, -.115], [.142, .132, .035], rgb('#716c52'));
            box(shin, `knee:${side}:ridge`, [0, -.024, -.136], [.104, .039, .01], scaleColor(rgb('#716c52'), .78));
        } else if (trousers === 'gorka') {
            box(shin, `knee:${side}:cloth`, [0, -.056, -.105], [.17, .155, .012], scaleColor(lower.colors[0], .71));
        }
        if (['acu', 'kombat'].includes(trousers)) box(shin, `trousers:calfpocket:${side}`, [sign * .098, -.168, -.018], [.028, .098, .11], scaleColor(lower.colors[0], .86));
        const bootColor = colors.boots, high = boots !== 'hiking';
        box(foot, `boot:${side}:sole`, [0, -.097, -.038], [.205, .035, .322], rgb('#282c28'));
        box(foot, `boot:${side}:toe`, [0, -.047, -.081], [.197, .093, .25], bootColor);
        box(foot, `boot:${side}:shaft`, [0, high ? .035 : .010, .025], [.183, high ? .205 : .15, .188], boots === 'jungle' ? rgb('#566043') : bootColor);
        box(foot, `boot:${side}:heel`, [0, -.06, .080], [.20, .10, .079], bootColor);
        for (let n = 0; n < 3; n++) box(foot, `boot:${side}:lace:${n}`, [0, -.025 + n * .035, -.078], [.091, .01, .008], scaleColor(bootColor, .6));
    }

    // Upper body, field tailoring and under-armor shirt construction.
    const bodyPattern = combat || jacket === 'fleece' ? { ...upper, colors: [colors.torso], pattern: 'solid' as const } : upper;
    fabric('torso', 'jacket:body', [0, 0, 0], [chestWidth, .515, chestDepth], bodyPattern, 2);
    box('torso', 'jacket:hem', [0, -.255, 0], [chestWidth + .012, jacket === 'm65' ? .115 : .043, chestDepth + .007], upper.colors[0]);
    const neckHeight = jacket === 'bdu' || jacket === 'afghanka' ? .035 : .075;
    for (const x of [-.086, .086]) box('torso', 'jacket:collar', [x, .29, -.003], [.067, neckHeight, .19], upper.colors[0]);
    if (!combat) {
        box('torso', 'jacket:placket', [0, -.005, front - .006], [.028, .49, .012], scaleColor(upper.colors[0], .76));
        for (const x of [-.127, .127]) {
            const angle = jacket === 'acu' ? (x < 0 ? -.22 : .22) : 0;
            box('torso', 'jacket:chestpocket', [x, .092, front - .014], [.125, .128, .022], upper.colors[0], angle);
            box('torso', 'jacket:pocketflap', [x, .145, front - .030], [.13, .029, .017], scaleColor(upper.colors[0], .79), angle);
            if (['m65', 'bdu', 'gorka', 'afghanka', 'sumrak'].includes(jacket)) pouch('torso', 'jacket:lowerpocket', [x, -.16, front - .022], [.135, .112, .035], upper);
        }
    } else box('torso', 'jacket:neckzip', [0, .21, front - .008], [.014, .18, .008], seam);
    if (jacket === 'afghanka' || jacket === 'm65') for (const x of [-.185, .185]) box('torso', 'jacket:epaulette', [x, .264, 0], [.083, .009, .18], scaleColor(upper.colors[0], .76));
    if (['gorka', 'sumrak', 'softshell'].includes(jacket)) {
        box('torso', 'jacket:foldedhood', [0, .256, .127], [.269, .139, .142], scaleColor(upper.colors[0], .79));
        box('torso', 'jacket:hoodfold', [0, .265, .206], [.225, .026, .016], scaleColor(upper.colors[0], .65));
    }

    for (const side of ['L', 'R'] as const) {
        const sign = side === 'L' ? -1 : 1, upperJoint = `upper${side}` as JointName, fore = `fore${side}` as JointName;
        const sleeveWidth = loose ? .171 : .151;
        fabric(upperJoint, `jacket:upper:${side}`, [0, -.135, 0], [sleeveWidth, .29, .19], upper);
        fabric(fore, `jacket:fore:${side}`, [0, -.122, 0], [sleeveWidth * .95, .265, .173], upper);
        box(upperJoint, `jacket:shoulderpocket:${side}`, [sign * (sleeveWidth / 2 + .008), -.078, 0], [.026, .107, .139], scaleColor(upper.colors[0], .91));
        box(upperJoint, `jacket:shoulderpatch:${side}`, [sign * (sleeveWidth / 2 + .023), -.076, 0], [.008, .055, .074], scaleColor(upper.colors[0], .72));
        box(fore, `jacket:cuff:${side}`, [0, -.238, 0], [sleeveWidth, .042, .175], scaleColor(upper.colors[0], .81));
        if (['gorka', 'kombat', 'g4'].includes(jacket)) box(fore, `jacket:elbow:${side}`, [0, -.015, .096], [.136, .118, .02], scaleColor(upper.colors[0], .66));
        const handColor = gloves === 'none' ? skin : colors.gloves;
        // The palm center is the terminal joint target used by the held-weapon IK.
        box(fore, `hand:${side}`, [0, -.289, 0], [.119, .107, .102], handColor);
        if (gloves === 'none' || gloves === 'fingerless') box(fore, `hand:${side}:fingers`, [0, -.33, -.008], [.113, .038, .077], skin);
        if (['coyote', 'olive'].includes(gloves)) box(fore, `glove:${side}:knuckles`, [0, -.284, -.059], [.099, .04, .022], scaleColor(handColor, .72));
        box(fore, `hand:${side}:thumb`, [-sign * .06, -.278, .002], [.032, .066, .055], handColor);
    }

    // Face remains intact in the crouch. Soft hats yield to equipped helmets; a balaclava fits below one.
    const headWidth = [.264, .274, .283, .268, .292, .255, .277, .267, .289, .27, .28, .266][face];
    add('head', 'face:head', [0, 0, 0], [headWidth, .272, .235], skin, 0, face % 3 === 2 ? 'sphere' : 'box');
    box('head', 'face:neck', [0, -.171, .007], [.13, .13, .13], skin);
    box('head', 'face:nose', [0, -.005, -.132], [.039, .055, .032], skin);
    for (const x of [-.068, .068]) {
        box('head', 'face:eye', [x, .035, -.123], [.043, .012, .009], rgb('#292e2c'));
        box('head', 'face:brow', [x, .056, -.124], [.049, .01, .009], rgb('#454033'));
    }
    for (const sign of [-1, 1]) box('head', 'face:ear', [sign * (headWidth / 2 + .008), -.006, .003], [.024, .063, .053], scaleColor(skin, .91));
    box('head', 'face:mouth', [0, -.079, -.12], [.057, .009, .009], scaleColor(skin, .67));
    if (face % 3 !== 1) box('head', 'face:beard', [0, -.096, -.113], [.204, .07, .022], rgb(face % 4 === 0 ? '#68604c' : '#494333'));
    if (headwear === 'balaclava') {
        const mask = rgb('#41483b');
        box('head', 'headwear:masktop', [0, .104, .005], [headWidth + .013, .069, .251], mask);
        box('head', 'headwear:maskjaw', [0, -.091, -.015], [headWidth + .014, .098, .262], mask);
        for (const sign of [-1, 1]) box('head', 'headwear:maskside', [sign * .115, .016, -.108], [.038, .117, .039], mask);
        box('head', 'headwear:masknose', [0, -.006, -.15], [.053, .062, .029], mask);
        box('head', 'headwear:maskneck', [0, -.18, .006], [.156, .125, .162], mask);
    }
    if (!helmet) {
        if (headwear === 'none') box('head', 'face:hair', [0, .12, .008], [headWidth + .007, .037, .233], rgb(face % 4 === 0 ? '#78705b' : '#464132'));
        if (headwear === 'patrol' || headwear === 'boonie') {
            fabric('head', 'headwear:crown', [0, .135, .007], [headWidth + .037, .098, .273], upper);
            if (headwear === 'patrol') box('head', 'headwear:peak', [0, .104, -.147], [.236, .017, .135], upper.colors[0]);
            else {
                add('head', 'headwear:brim', [0, .09, .006], [.43, .018, .39], upper.colors[0], 0, 'cylinder');
                box('head', 'headwear:band', [0, .13, -.139], [.244, .026, .018], scaleColor(upper.colors[0], .63));
            }
        }
        if (headwear === 'watch' || headwear === 'fleece') {
            add('head', 'headwear:cap', [0, .111, .004], [headWidth + .027, .158, .265], scaleColor(upper.colors[0], .60), 0, 'sphere');
            if (headwear === 'watch') box('head', 'headwear:fold', [0, .086, .009], [headWidth + .033, .046, .269], scaleColor(upper.colors[0], .66));
        }
        if (headwear === 'bandana') {
            box('head', 'headwear:bandana', [0, .112, .006], [headWidth + .018, .072, .25], upper.colors[0]);
            box('head', 'headwear:knot', [.097, .067, .145], [.08, .05, .078], scaleColor(upper.colors[0], .76));
            box('head', 'headwear:tail', [.115, .012, .147], [.049, .10, .035], upper.colors[0], -.2);
        }
    }

    if (armor) {
        const shape = armor.shape, compact = ['armor_jpc', 'armor_spc', 'armor_lv119'].includes(shape), soft = shape === 'armor_paca';
        const soviet = ['armor_6b2', 'armor_6b3', 'armor_6b5'].includes(shape), heavy = ['armor_6b13', 'armor_6b23', 'armor_6b45', 'armor_iba', 'armor_iotv', 'armor_pasgt'].includes(shape);
        const armorCamo = soft || soviet || shape === 'armor_pasgt' ? { ...load, colors: [armor.color], pattern: 'solid' as const } : load;
        const dimensions: Record<string, [number, number, number]> = {
            armor_6b2: [.414, .465, .038], armor_6b3: [.441, .49, .059], armor_6b5: [.43, .484, .051],
            armor_6b13: [.451, .493, .059], armor_6b23: [.428, .51, .059], armor_6b45: [.401, .477, .063],
            armor_paca: [.397, .39, .03], armor_pasgt: [.467, .491, .048], armor_iba: [.445, .488, .059], armor_iotv: [.478, .53, .065],
            armor_jpc: [.315, .40, .055], armor_avs: [.373, .455, .065], armor_lv119: [.322, .414, .051], armor_spc: [.307, .395, .046]
        };
        const [w, h, d] = dimensions[shape] || [.438, .50, .055];
        fabric('torso', 'armor:front', [0, .005, front - d / 2 - .008], [w, h, d], armorCamo, 1);
        fabric('torso', 'armor:back', [0, .005, -front + d / 2 + .008], [w, h, d], armorCamo, 1);
        for (const x of [-.168, .168]) strap('torso', 'armor:shoulder', [x, .268, 0], [compact ? .046 : .088, .028, chestDepth + .11], armorCamo.colors[0]);
        for (const side of [-1, 1]) fabric('torso', 'armor:side', [side * (chestWidth / 2 + .02), -.054, 0], [.055, compact ? .14 : .30, chestDepth + .03], armorCamo, 0);
        if (heavy) {
            for (const side of [-1, 1]) box('torso', 'armor:collar', [side * .09, .284, -.004], [.055, .083, .22], armorCamo.colors[0]);
            if (shape !== 'armor_6b13' && shape !== 'armor_pasgt') box('pelvis', 'armor:groin', [0, -.037, -.165], [.232, .20, .03], armorCamo.colors[0]);
        }
        if (soviet) {
            for (const x of [-.164, -.055, .055, .164]) box('torso', 'armor:sewnpanel', [x, -.015, front - .064], [.097, .268, .012], scaleColor(armorCamo.colors[0], .83));
            if (shape === 'armor_6b3') for (const x of [-.145, .145]) pouch('torso', 'armor:integralpocket', [x, -.145, front - .093], [.105, .138, .05], armorCamo);
            if (shape === 'armor_6b5') for (const x of [-.16, -.053, .053, .16]) pouch('torso', 'armor:integralpocket', [x, -.122, front - .085], [.084, .169, .044], armorCamo);
        }
        if (shape === 'armor_jpc' || shape === 'armor_spc') for (const side of [-1, 1]) for (const y of [-.096, -.037, .022]) strap('torso', 'armor:openband', [side * .247, y, 0], [.014, .023, chestDepth + .066], armorCamo.colors[0]);
        if (shape === 'armor_avs') for (const side of [-1, 1]) box('torso', 'armor:avsharness', [side * .247, -.014, .036], [.048, .238, .208], scaleColor(armorCamo.colors[0], .84));
        if (!soviet && !soft && shape !== 'armor_lv119') for (let row = 0; row < (compact ? 3 : 4); row++) box('torso', 'armor:webbing', [0, .15 - row * .066, front - d - .011], [w * .89, .018, .009], scaleColor(armorCamo.colors[0], .71));
        if (shape === 'armor_lv119') box('torso', 'armor:loopfield', [0, .139, front - d - .012], [.243, .091, .009], scaleColor(armorCamo.colors[0], .76));
        if (shape === 'armor_spc') for (const x of [-.099, -.033, .033, .099]) box('torso', 'armor:airlite_opening', [x, -.164, front - d - .011], [.025, .019, .009], scaleColor(armorCamo.colors[0], .49));
        if (shape === 'armor_iba' || shape === 'armor_pasgt') box('torso', 'armor:frontclosure', [.022, .005, front - d - .018], [.048, h * .91, .022], scaleColor(armorCamo.colors[0], .80));
        if (shape === 'armor_6b45') for (const x of [-.17, .17]) box('torso', 'armor:releasebuckle', [x, .156, front - d - .028], [.049, .048, .024], hardware);
        if (shape === 'armor_iotv') for (const side of [-1, 1]) box('torso', 'armor:shoulderpad', [side * .20, .267, .013], [.102, .051, .256], armorCamo.colors[0]);
    }

    if (helmet) {
        const shape = helmet.shape, steel = shape === 'helmet_ssh68', fast = shape === 'helmet_fast';
        const color = steel ? helmet.color : load.colors[0];
        const dome: Record<string, [number, number, number]> = {
            helmet_ssh68: [.347, .229, .316], helmet_6b7: [.356, .200, .333], helmet_6b47: [.342, .191, .322],
            helmet_pasgt: [.369, .205, .341], helmet_mich: [.345, .183, .313], helmet_ach: [.337, .186, .308], helmet_fast: [.337, .18, .306]
        };
        const domeSize: Vec3 = dome[shape] || [headWidth + .085, .195, .316];
        // Dome and separate side/rear panels leave the face open; no solid sphere through the face.
        add('head', 'helmet:dome', [0, .133, .014], domeSize, color, 0, 'sphere');
        box('head', 'helmet:rear', [0, .057, .14], [headWidth + .04, .127, .068], color);
        for (const side of [-1, 1]) {
            if (!fast) box('head', 'helmet:side', [side * (headWidth / 2 + .025), .061, .038], [.061, steel ? .105 : .135, .186], color);
            box('head', 'helmet:chinstrap', [side * .116, -.064, .062], [.018, .186, .022], hardware);
            if (fast) {
                box('head', 'helmet:rail', [side * (headWidth / 2 + .035), .10, .052], [.027, .033, .151], hardware);
                box('head', 'helmet:earpro', [side * (headWidth / 2 + .049), -.014, .018], [.073, .127, .094], scaleColor(color, .7));
            }
        }
        box('head', 'helmet:chin', [0, -.151, .001], [.216, .018, .024], hardware);
        if (steel || shape === 'helmet_pasgt') box('head', 'helmet:rim', [0, .085, -.14], [headWidth + .051, .016, .076], color);
        if (['helmet_fast', 'helmet_6b47', 'helmet_ach'].includes(shape)) box('head', 'helmet:shroud', [0, .13, -.157], [.071, .072, .017], hardware);
        if (shape === 'helmet_6b47') for (const side of [-1, 1]) box('head', 'helmet:sideplate', [side * .174, .105, .035], [.014, .048, .086], scaleColor(color, .69));
        if (!steel && load.pattern !== 'solid') for (const side of [-1, 1]) box('head', 'helmet:coverpatch', [side * .088, .217, .023], [.055, .012, .099], load.colors[1]);
    }

    // Rigs sit ahead of the real armor. Belt systems leave the upper chest exposed.
    const rigZ = front - (armored ? .10 : .030);
    if (rig === 'buyanov') {
        const white = rgb('#dce0cb'), fold = rgb('#b9c6b7');
        box('torso', 'rig:buyanov:bag', [0, -.067, rigZ - .024], [.445, .332, .055], white);
        box('torso', 'rig:buyanov:base', [0, -.236, rigZ - .023], [.435, .018, .062], fold);
        for (const side of [-1, 1]) {
            // Two open handles. The negative space is real, rather than a painted U.
            box('torso', 'rig:buyanov:handle_outer', [side * .198, .159, rigZ - .012], [.034, .193, .021], white);
            box('torso', 'rig:buyanov:handle_inner', [side * .131, .159, rigZ - .012], [.025, .193, .019], white);
            box('torso', 'rig:buyanov:handle_top', [side * .165, .258, rigZ - .013], [.10, .023, .025], white);
            strap('torso', 'rig:buyanov:over_shoulder', [side * .177, .267, -.018], [.075, .016, chestDepth + .205], white);
            box('torso', 'rig:buyanov:side_seam', [side * .215, -.065, rigZ - .056], [.015, .328, .010], fold);
            box('torso', 'rig:buyanov:diagonal_fold', [side * .155, -.177, rigZ - .057], [.011, .135, .005], fold, side * .32);
        }
        // Keep the product name below the gun-holding forearms, so the front label remains legible.
        box('torso', 'rig:buyanov:label', [0, -.162, rigZ - .058], [.410, .10, .009], rgb('#edeacb'));
        for (const part of pelmeniLettering()) result.push({ joint: 'torso', part: { ...part, p: [part.p[0], part.p[1] - .162, rigZ - .063] } });
        // Small dumpling silhouettes beneath the red wordmark.
        for (const x of [-.085, 0, .085]) {
            add('torso', 'rig:buyanov:dumpling', [x, -.221, rigZ - .058], [.062, .021, .012], rgb('#c7b68e'), 0, 'sphere');
            box('torso', 'rig:buyanov:dumpling_fold', [x, -.222, rigZ - .066], [.038, .004, .003], rgb('#a39574'));
        }
    } else if (rig !== 'none') {
        const beltRig = ['smersh', 'smersh_pkm', 'alice'].includes(rig);
        for (const x of [-.177, .177]) {
            strap('torso', 'rig:shoulder', [x, .269, -.002], [.043, .020, chestDepth + (armored ? .21 : .10)]);
            strap('torso', 'rig:strap', [x, beltRig ? -.013 : .168, rigZ - .002], [.038, beltRig ? .52 : .193, .017]);
            box('torso', 'rig:buckle', [x, beltRig ? -.14 : .134, rigZ - .017], [.043, .035, .024], hardware);
            strap('torso', 'rig:rearstrap', [x, -.013, -front + .065], [.038, .51, .017]);
        }
        if (beltRig) {
            strap('pelvis', 'rig:belt', [0, .042, 0], [.49, .079, .328]);
            const pkm = rig === 'smersh_pkm';
            for (const side of [-1, 1]) {
                pouch('pelvis', 'rig:lowpouch', [side * .261, -.003, -.146], [pkm ? .165 : .134, pkm ? .218 : .201, .147], load);
                if (rig === 'alice') add('pelvis', 'rig:canteen', [side * .255, .013, .125], [.117, .184, .125], load.colors[0], 0, 'cylinder');
                else pouch('pelvis', 'rig:sidepouch', [side * .26, -.035, .074], [.118, .135, .14], load);
            }
            if (backpack === 'none') pouch('pelvis', 'rig:buttpack', [0, -.045, .209], [.292, .18, .161], load);
        } else {
            const split = rig === '34alpha', compact = ['mk6', 'sso_d3'].includes(rig), w = compact ? .346 : .446;
            if (split) for (const side of [-1, 1]) fabric('torso', 'rig:splitpanel', [side * .128, -.035, rigZ], [.203, .251, .035], load, 1);
            else fabric('torso', 'rig:panel', [0, -.022, rigZ], [w, rig === 'ana_alpha' ? .30 : .225, .035], load, 1);
            const count = rig === 'taps' ? 6 : rig === 'ana_alpha' || split ? 4 : 3, spacing = (w - .04) / count;
            for (let n = 0; n < count; n++) {
                let x = (n - (count - 1) / 2) * spacing;
                if (split) x += x < 0 ? -.018 : .018;
                pouch('torso', `rig:magpouch:${n}`, [x, -.027, rigZ - .067], [spacing * .88, rig === 'ana_alpha' || rig === 'canvas' ? .202 : .16, .082], load, rig !== 'mk6');
                if (rig === 'mk6') {
                    box('torso', `rig:retention:${n}`, [x, .06, rigZ - .108], [.012, .024, .014], hardware);
                    box('torso', `rig:lip:${n}`, [x, .062, rigZ - .054], [.063, .011, .038], scaleColor(load.colors[0], .64));
                }
            }
            if (split) for (const y of [-.09, .077]) box('torso', 'rig:splitbuckle', [0, y, rigZ - .092], [.047, .027, .028], hardware);
            if (rig === 'sso_d3' || rig === 'ana_alpha') for (const side of [-1, 1]) pouch('torso', 'rig:utilitypouch', [side * (w / 2 + .023), -.071, rigZ - .043], [.09, .133, .11], load);
            if (rig === 'mk6' || rig === 'sso_d3') pouch('torso', 'rig:dangler', [0, -.225, rigZ - .019], [.214, .11, .064], load);
        }
    }

    // Pack bodies and their harness use the torso transform, so crouching cannot leave a floating pack.
    if (backpack !== 'none') {
        const large = backpack === 'sso_ataka', simple = backpack === 'veshmeshok', small = backpack === 'sso_map';
        const width = simple ? .337 : large ? .37 : small ? .285 : .35;
        const height = large ? .60 : backpack === 'rd54' ? .31 : small ? .36 : .435;
        const depth = large ? .225 : simple ? .19 : .169;
        const z = chestDepth / 2 + (armored ? .075 : .024) + depth / 2;
        fabric('torso', 'pack:body', [0, large ? -.005 : -.018, z], [width, height, depth], packCamo, 2);
        for (const x of [-.145, .145]) {
            strap('torso', 'pack:shoulder', [x, .27, .025], [.051, .025, chestDepth + .103], packCamo.colors[0]);
            strap('torso', 'pack:frontstrap', [x, .06, front - .016], [.041, .408, .021], packCamo.colors[0]);
        }
        if (simple) {
            box('torso', 'pack:neck', [0, .231, z], [.16, .066, .145], scaleColor(packCamo.colors[0], .88));
            box('torso', 'pack:cinch', [0, .237, z], [.17, .018, .155], rgb('#787456'));
        } else {
            box('torso', 'pack:lid', [0, height / 2 - .015, z + .014], [width + .019, .074, depth + .046], scaleColor(packCamo.colors[0], .89));
            const rearZ = z + depth / 2;
            box('torso', 'pack:backpocket', [0, -.091, rearZ + .027], [width * .78, height * .42, .064], packCamo.colors[0]);
            if (backpack === 'alice') for (const side of [-1, 1]) box('torso', 'pack:alicepocket', [side * .135, -.087, rearZ + .064], [.089, .182, .083], packCamo.colors[0]);
            if (large || backpack === 'rd54') for (const side of [-1, 1]) fabric('torso', 'pack:sidepocket', [side * (width / 2 + .038), -.057, z], [.082, large ? .36 : .231, depth * .88], packCamo, 0);
            for (const x of [-width * .30, width * .30]) strap('torso', 'pack:compression', [x, -.017, rearZ + .067], [.021, height * .80, .009], packCamo.colors[0]);
            if (['assault', 'sso_map', 'sso_ataka'].includes(backpack)) for (let row = 0; row < 3; row++) box('torso', 'pack:webbing', [0, .073 - row * .062, rearZ + .064], [width * .88, .018, .014], scaleColor(packCamo.colors[0], .67));
            if (backpack === 'alice') for (const x of [-.136, .136]) box('torso', 'pack:frame', [x, -.08, z - depth / 2 - .012], [.024, height + .12, .028], hardware);
        }
    }
    return result;
}

const outfitCache = new Map<string, BoundPart[]>();

/** Drop-in third-person replacement. Omitted equipment means no armor, not a cosmetic armor grant. */
export function characterAppearanceModel(character: Character, time = 0, moving = 0, dead = false, crouch = false, equipment?: VisibleEquipment, presentation: HeldWeaponPresentation = {}): Part[] {
    const palette = appearancePalette(character), { appearance } = palette;
    const face = Number.isSafeInteger(character.face) ? Math.max(0, Math.min(11, character.face)) : 0;
    const key = JSON.stringify([face, ...APPEARANCE_FIELDS.map(field => appearance[field]), equipment?.armor?.def || '', equipment?.helmet?.def || '']);
    let bound = outfitCache.get(key);
    if (!bound) {
        bound = outfitParts(face, appearance, equipment);
        if (outfitCache.size >= 64) outfitCache.delete(outfitCache.keys().next().value!);
        outfitCache.set(key, bound);
    }
    const skeleton = characterJointPose(dead ? 0 : time, dead ? 0 : moving, dead ? false : crouch, dead ? { relaxed: true } : presentation);
    const patchParts: BoundPart[] = [];
    if (isPatchSelection(character.patches)) for (const side of ['L', 'R'] as const) {
        const id = character.patches[side === 'L' ? 'leftShoulder' : 'rightShoulder'];
        const mount = bound.find(entry => entry.part.slot === `jacket:shoulderpatch:${side}`);
        if (id && mount) patchParts.push({ joint: mount.joint, part: { ...mount.part, shape: 'plane', patch: id, c: [1, 1, 1], slot: `patch:${side}`, p: [mount.part.p[0] + (side === 'L' ? -1 : 1) * .005, mount.part.p[1], mount.part.p[2]], s: [.05, .05, .001], r: [0, side === 'L' ? -Math.PI / 2 : Math.PI / 2, 0] } });
    }
    const skin = rgb(skinTones[face % skinTones.length]);
    const selections: CharacterLayerSelection[] = [
        { id: 'body', layer: 'body', skin, fabricColor: skin },
        { id: 'face_' + String(face).padStart(2, '0'), layer: 'face', skin, fabricColor: skin },
        { id: appearance.jacket, layer: 'jacket', skin, fabric: appearance.jacketCamo, fabricColor: palette.sleeve },
        { id: appearance.trousers, layer: 'trousers', skin, fabric: appearance.trouserCamo, fabricColor: palette.trousers },
        { id: appearance.gloves, layer: 'gloves', skin, fabricColor: palette.gloves },
        { id: appearance.boots, layer: 'boots', skin, fabricColor: palette.boots }
    ];
    // A helmet suppresses the same soft headwear layer in both fallback and authored geometry.
    if (bound.some(entry => entry.part.slot?.startsWith('headwear:'))) selections.push({ id: appearance.headwear, layer: 'headwear', skin, fabric: appearance.jacketCamo, fabricColor: palette.sleeve });
    return [...bindCharacterAssets(bound, selections, appearance.gloves !== 'gloves_none'), ...patchParts].map(({ joint, part }) => {
        const transform = skeleton[joint];
        let p = point(transform, part.p);
        let rotation: Vec3 = [transform.x, part.r[1], transform.z + part.r[2]];
        if (dead) {
            // A true rigid rotation is applied to every body part and every piece of equipment.
            p = [p[0], .40 - p[2], p[1] - .75];
            rotation = [rotation[0] + Math.PI / 2, rotation[1], rotation[2]];
        }
        const origin = skeleton.torso.p;
        const asset = part.asset?.kind === 'character' ? { ...part.asset, lodOrigin: dead ? [origin[0], .40 - origin[2], origin[1] - .75] as Vec3 : [...origin] as Vec3, transform: {
            p: dead ? [transform.p[0], .40 - transform.p[2], transform.p[1] - .75] as Vec3 : [...transform.p] as Vec3,
            s: [1, transform.scaleY || 1, 1] as Vec3, r: [transform.x + (dead ? Math.PI / 2 : 0), 0, transform.z] as Vec3
        } } : part.asset;
        return { ...part, p, r: rotation, s: [part.s[0], part.s[1] * (transform.scaleY || 1), part.s[2]], c: [...part.c] as Color, ...(asset ? { asset } : {}) };
    });
}

/** The same armor/helmet geometry is used in the world and the inventory, centered for item previews. */
export function equipmentAppearanceModel(item: Item): Part[] {
    const definition = CATALOG[item.def];
    if (!definition || definition.category !== 'armor') return [];
    const isHelmet = definition.shape.startsWith('helmet');
    const selection = defaultAppearance('BEAR');
    const equipment: VisibleEquipment = { armor: isHelmet ? null : item, helmet: isHelmet ? item : null };
    const character: Character = { name: 'Снаряжение', faction: 'BEAR', face: 0, outfit: 0, appearance: selection };
    const center = isHelmet ? 1.57 : 1.06;
    return characterAppearanceModel(character, 0, 0, false, false, equipment)
        .filter(p => p.slot?.startsWith(isHelmet ? 'helmet:' : 'armor:'))
        .map(p => ({ ...p, p: [p.p[0], p.p[1] - center, p.p[2]] as Vec3 }));
}
