import type { Color, Part, Vec3 } from '../domain/types.js';
import { rgb } from '../domain/util.js';
import { weaponLayout } from '../content/weapon-layouts.js';

// Original low-poly meshes. Units are art-space coordinates, never manufacturing data.
const black = rgb('#171d1c'), steel = rgb('#58605c'), dark = rgb('#333b36'), sand = rgb('#a99772');
function recipe() {
    const parts: Part[] = [];
    const box = (p: Vec3, s: Vec3, c: Color = dark, r: Vec3 = [0, 0, 0], slot?: string) => parts.push({ shape: 'box', p, s, c, r, slot });
    const cylinder = (p: Vec3, s: Vec3, c: Color = steel, r: Vec3 = [Math.PI / 2, 0, 0], slot?: string) => parts.push({ shape: 'cylinder', p, s, c, r, slot });
    const rail = (from: number, to: number, y: number, width = .09) => { for (let z = from; z < to; z += .032) box([0, y, z], [width, .014, .015], black); };
    const sight = (z: number, height: number) => { box([0, height - .027, z], [.052, .020, .043], black); box([-.026, height, z], [.012, .045, .023], black); box([.026, height, z], [.012, .045, .023], black); box([0, height - .002, z], [.009, .03, .014], steel); };
    const trigger = (z: number) => { box([0, -.11, z], [.059, .016, .098], black); box([0, -.075, z - .042], [.054, .066, .018]); box([0, -.075, z + .04], [.054, .055, .021]); box([0, -.071, z], [.013, .044, .014], steel, [-.30, 0, 0]); };
    return { parts, box, cylinder, rail, sight, trigger };
}

export function arsenalWeaponBase(type: string): Part[] | null {
    if (!['ak12', 'rpk74', 'asval', 'vss', 'g36', 'scar', 'aug', 'mcx', 'bren', 'scorpion', 'mpx', 'm9a3', 'm17', 'rem870', 'benelli', 'm14'].includes(type)) return null;
    const { parts, box: b, cylinder: cy, rail, sight, trigger } = recipe(), end = weaponLayout(type).muzzle[2];
    if (type === 'm9a3' || type === 'm17') {
        const beretta = type === 'm9a3', c = beretta ? sand : rgb('#9b885f'), length = beretta ? .325 : .285;
        b([0, -.033, -.034], [.084, .055, length * .88], c);
        if (beretta) {
            for (const x of [-.036, .036]) b([x, .028, -.046], [.019, .080, length], c, [0, 0, 0], 'action');
            b([0, .032, .078], [.085, .077, .093], c, [0, 0, 0], 'action');
            cy([0, .024, -.074], [.033, .323, .033], black);
            b([0, .070, .124], [.026, .042, .036], black, [.27, 0, 0]);
        } else {
            b([0, .026, -.033], [.092, .084, length], c, [0, 0, 0], 'action');
            b([0, .070, .055], [.075, .013, .065], black, [0, 0, 0], 'action');
            cy([0, .03, -.184], [.027, .055, .027], black);
            b([.049, -.012, .064], [.009, .032, .063], black);
        }
        for (const x of [-.046, .046]) for (let n = 0; n < 5; n++) {
            b([x, .031, .044 + n * .012], [.006, .058, .006], black, [.12, 0, 0], 'action');
            if (!beretta) b([x, .031, -.146 + n * .011], [.006, .058, .005], black, [.12, 0, 0], 'action');
        }
        for (let z = -.11; z < -.045; z += .025) b([0, -.067, z], [.075, .012, .012], black);
        sight(-length / 2 + .008, .084); sight(.089, .084); trigger(-.041);
    } else if (type === 'asval' || type === 'vss') {
        b([0, .006, .015], [.081, .106, .30], steel);
        b([0, .071, .009], [.076, .026, .28], black);
        const nose = -.175, length = nose - end;
        cy([0, .030, (nose + end) / 2], [.097, length, .097], dark);
        cy([0, .030, end + .004], [.079, .016, .079], black);
        cy([0, .030, -.30], [.105, .030, .105], steel);
        b([.055, .036, -.062], [.069, .021, .027], black, [0, 0, 0], 'action');
        b([-.047, .009, .017], [.013, .046, .14], dark);
        sight(end + .14, .138); sight(-.115, .138); trigger(.071);
    } else if (type === 'aug') {
        const olive = rgb('#666b48');
        b([0, .039, -.02], [.115, .13, .38], steel);
        b([0, -.014, .12], [.145, .13, .35], olive);
        b([0, -.075, .218], [.105, .098, .14], black);
        b([0, -.172, -.020], [.086, .206, .10], olive, [-.10, 0, 0]);
        b([0, -.236, -.075], [.09, .025, .17], olive);
        b([0, -.143, -.15], [.09, .20, .026], olive, [.20, 0, 0]);
        cy([0, .034, -.35], [.035, .43, .035]);
        b([0, .116, -.059], [.09, .041, .30], black); rail(-.20, .09, .144);
        b([-.075, .081, -.148], [.075, .028, .06], black, [0, 0, 0], 'action');
        b([.078, .031, .15], [.008, .044, .098], black);
        sight(-.18, .165); sight(.077, .165);
    } else if (type === 'rem870' || type === 'benelli') {
        const benelli = type === 'benelli';
        b([0, .006, .024], [benelli ? .103 : .091, .116, benelli ? .35 : .315], dark);
        b([0, .064, .004], [.078, .025, .24], steel);
        cy([0, .025, (end - .115) / 2], [.041, Math.abs(end + .115), .041], steel);
        cy([0, -.047, -.399], [.045, benelli ? .69 : .61, .045], black);
        b([.054, .018, -.009], [.01, .039, .105], black);
        b([.073, .013, .025], [benelli ? .065 : .022, .025, .026], steel, [0, 0, 0], 'action');
        if (benelli) { rail(-.08, .16, .115); sight(.115, .124); sight(end + .073, .109); }
        else { b([0, .064, end + .06], [.015, .023, .02], steel); b([0, .072, .11], [.06, .016, .025], black); }
        trigger(.100);
    } else if (type === 'm14') {
        b([0, .009, .003], [.089, .083, .27], steel);
        cy([0, .035, -.52], [.029, .89, .029], steel);
        cy([0, -.031, -.60], [.034, .51, .034], dark);
        b([0, .053, -.013], [.074, .035, .14], black, [0, 0, 0], 'action');
        b([.062, .014, .027], [.052, .023, .068], steel, [0, 0, 0], 'action');
        b([0, -.071, -.031], [.093, .069, .137], black);
        for (const x of [-.046, .046]) cy([x, .094, .112], [.022, .026, .022], steel, [0, 0, Math.PI / 2]);
        sight(.110, .124); sight(end + .103, .124); trigger(.093);
    } else if (type === 'ak12' || type === 'rpk74') {
        const support = type === 'rpk74';
        b([0, .005, .029], [support ? .098 : .089, .12, support ? .39 : .36], steel);
        b([0, .077, .033], [.081, .027, .32], black);
        cy([0, .024, (end - .12) / 2], [support ? .031 : .026, Math.abs(end + .12), support ? .031 : .026], steel);
        cy([0, .088, support ? -.37 : -.33], [.037, support ? .44 : .34, .037], dark);
        b([.063, .031, -.021], [.070, .02, .026], black, [0, 0, 0], 'action');
        b([.05, -.005, .022], [.012, .022, .19], dark);
        if (support) {
            for (const x of [-.043, .043]) { b([x, -.022, -.86], [.017, .029, .30], black, [.10, 0, 0]); b([x * 1.5, -.038, -.722], [.053, .019, .048], steel); }
            b([0, .061, -.665], [.043, .067, .035], dark);
        } else { rail(-.13, .185, .104); b([0, .080, -.532], [.047, .071, .034], dark); }
        sight(end + .123, .138); sight(support ? -.12 : .13, .138); trigger(.106);
    } else {
        const g36 = type === 'g36', scar = type === 'scar', mcx = type === 'mcx', bren = type === 'bren', scorpion = type === 'scorpion', mpx = type === 'mpx';
        const length = scorpion ? .32 : mpx ? .30 : g36 ? .39 : scar ? .43 : .37;
        const c = scar || mcx ? sand : dark;
        b([0, .025, .021], [g36 ? .112 : scar ? .117 : .093, g36 ? .155 : scar ? .145 : scorpion ? .133 : .119, length], c);
        if (scorpion) b([0, .078, -.046], [.093, .036, .25], c, [-.065, 0, 0]);
        else b([0, .091, .020], [scar ? .111 : .083, .037, length * .95], c);
        b([0, -.073, -.067], [g36 ? .112 : .093, .090, mpx || scorpion ? .085 : .120], black);
        cy([0, weaponLayout(type).muzzle[1], (end - .12) / 2], [.026, Math.abs(end + .12), .026], steel);
        const railY = g36 ? .18 : scar ? .127 : .121;
        if (g36) {
            b([0, .15, .019], [.078, .024, .34], black);
            for (const z of [-.12, .155]) b([0, .121, z], [.068, .07, .047], dark);
            b([0, .118, -.025], [.026, .023, .079], steel, [0, 0, 0], 'action');
            b([.061, .038, .079], [.014, .055, .087], black);
        } else {
            const x = scar || bren || scorpion ? -.066 : .06;
            b([x, .059, scar ? -.10 : bren ? -.085 : .041], [.062, .025, .049], black, [0, 0, 0], 'action');
            b([.052, .024, .038], [.013, .045, .095], black);
        }
        if (scar) for (const x of [-.062, .062]) for (const z of [-.138, .015, .158]) cy([x, .041, z], [.013, .009, .013], steel, [0, 0, Math.PI / 2]);
        if (mcx) { b([0, .087, .22], [.095, .073, .028], black); b([0, .12, .171], [.088, .013, .075], black); }
        if (bren) { b([0, .077, -.134], [.069, .066, .096], steel); b([-.052, .032, -.047], [.009, .018, .2], black); }
        rail(-length / 2 + .022, length / 2 + .003, railY, g36 ? .096 : .092);
        sight(-length / 2 + .028, railY + .025); sight(length / 2 - .025, railY + .025);
        trigger(mpx || scorpion ? .058 : .085);
    }
    return parts;
}

/** Return local mesh parts for the caller's slot transform and shared animation. */
export function arsenalModuleModel(shape: string, color: Color): Part[] | null {
    const { parts, box: b, cylinder: cy } = recipe();
    if (shape.startsWith('stock_ak12')) {
        cy([0, .036, -.066], [.040, .33, .040]); b([0, -.017, .052], [.098, .137, .27], color);
        b([0, -.024, .212], [.111, .23, .034], black); b([0, -.075, -.050], [.08, .045, .10], black);
        b([0, shape.endsWith('cheek') ? .106 : .067, .050], [.10, shape.endsWith('cheek') ? .059 : .025, .20], color);
    } else if (shape === 'stock_rpk') {
        b([0, -.035, .020], [.110, .182, .36], color, [-.1, 0, 0]); b([0, -.081, .159], [.12, .126, .18], color, [.18, 0, 0]); b([0, -.047, .224], [.12, .235, .03], black);
    } else if (shape === 'stock_val') {
        for (const y of [-.038, .057]) cy([0, y, .015], [.022, .335, .022], color);
        b([0, -.002, .183], [.065, .18, .03], black); b([0, .047, -.162], [.056, .06, .04], steel);
    } else if (shape.startsWith('stock_vss')) {
        const wood = shape.endsWith('wood');
        b([0, .044, .025], [.090, .065, .39], color); b([0, -.105, .075], [.079, .047, .29], color, [.10, 0, 0]);
        b([0, -.042, .197], [.113, .235, .05], black); b([0, -.070, -.144], [.080, .215, .077], color, [-.23, 0, 0]);
        if (!wood) { b([0, .096, .082], [.125, .043, .21], black); b([0, -.135, .094], [.08, .028, .15], steel); }
    } else if (shape.startsWith('stock_g36')) {
        const adjustable = shape.endsWith('adjust');
        b([0, .049, -.005], [.066, .048, .34], color); b([0, -.047, .002], [.037, .035, .35], color, [.30, 0, 0]);
        b([0, -.030, .175], [.093, .225, .033], black); b([0, .014, -.18], [.10, .12, .043], steel);
        if (adjustable) { b([0, .095, .029], [.12, .051, .23], color); b([0, -.067, .056], [.074, .07, .19], color); }
    } else if (shape.startsWith('stock_scar')) {
        b([0, .015, -.005], [.125, .162, .36], color); b([0, .102, -.027], [.136, .052, .23], color);
        b([0, -.044, .156], [.13, .228, .080], color, [-.10, 0, 0]); b([0, -.047, .212], [.14, .253, .035], black);
        b([.069, -.011, .047], [.01, .049, .057], black); b([0, -.083, -.158], [.055, .031, .069], steel);
        if (shape.endsWith('precision')) { b([0, .151, .033], [.143, .040, .28], black); b([0, -.114, .067], [.075, .075, .13], color); }
    } else if (shape.startsWith('stock_aug')) {
        b([0, -.010, .025], [.146, .17, .36], color); b([0, -.077, -.097], [.126, .079, .22], color, [.12, 0, 0]);
        b([0, -.023, .220], [.155, .244, shape.endsWith('padded') ? .065 : .034], black);
        b([0, .083, .007], [.13, .032, .33], color); b([.079, .027, -.085], [.008, .044, .091], black);
    } else if (shape.startsWith('stock_mcx')) {
        const length = shape.endsWith('compact') ? .22 : .33;
        b([0, .044, 0], [.037, .039, length], color); b([0, -.035, .004], [.030, .028, length], color, [.12, 0, 0]);
        b([0, -.007, length / 2], [.072, .198, .031], black); b([0, .073, -.012], [.081, .025, length * .68], color);
        b([0, .025, -length / 2], [.075, .103, .045], steel);
    } else if (shape === 'stock_bren' || shape === 'stock_scorpion') {
        const small = shape === 'stock_scorpion', length = small ? .26 : .33;
        b([0, .042, .008], [small ? .07 : .094, .08, length], color); b([0, -.041, .07], [.058, .045, length * .67], color, [.20, 0, 0]);
        b([0, -.033, length / 2 + .02], [.092, .206, .04], black); b([0, .012, -length / 2], [.085, .115, .043], color);
        if (!small) b([0, .095, .032], [.103, .031, .22], black);
    } else if (shape === 'stock_mpx') {
        for (const x of [-.04, .04]) b([x, .032, -.009], [.018, .025, .31], steel);
        b([0, -.017, .159], [.087, .19, .043], black); b([0, .023, .080], [.071, .080, .13], color);
    } else if (shape.startsWith('stock_870') || shape.startsWith('stock_benelli')) {
        const tactical = shape.endsWith('tactical') || shape === 'stock_benelli', benelli = shape.includes('benelli');
        if (tactical) {
            cy([0, .018, .02], [.039, .36, .039]); b([0, -.025, .13], [.092, .135, .19], color); b([0, -.022, .235], [.112, .218, .033], black);
            b([0, -.137, -.23], [.083, .20, .10], color, [-.22, 0, 0]); b([0, -.037, -.185], [.073, .062, .15], color);
        } else {
            b([0, -.038, .041], [.108, .157, .36], color, [-.13, 0, 0]); b([0, -.025, .249], [.117, .229, benelli ? .07 : .037], black);
            b([0, -.039, -.17], [.072, .083, .17], color, [.25, 0, 0]);
        }
        if (benelli) b([0, .064, .05], [.10, .022, .19], color);
    } else if (shape.startsWith('stock_m14')) {
        const chassis = shape.endsWith('chassis');
        b([0, -.045, .047], [chassis ? .13 : .098, .151, .40], color, [-.12, 0, 0]); b([0, -.035, -.30], [.097, .078, .75], color);
        b([0, -.037, .263], [.12, .242, .032], black);
        if (chassis) { b([0, .086, .074], [.126, .047, .27], black); b([0, -.125, -.20], [.081, .184, .093], color, [-.20, 0, 0]); for (let z = -.65; z < -.33; z += .07) b([.054, -.028, z], [.012, .041, .034], black); }
    } else if (/^guard_(ak12|rpk|val|g36|scar|mcx|bren|scorpion|mpx|870|benelli)/.test(shape)) {
        const mini = /val|scorpion|mpx/.test(shape), shotgun = /870|benelli/.test(shape);
        const length = shape.includes('mcx') ? shape.endsWith('short') ? .27 : .49 : shape.endsWith('long') ? .43 : shape.includes('benelli') ? .37 : shape.includes('870') ? .27 : shape.includes('bren') ? .25 : mini ? .20 : .31;
        const width = shape.includes('scar') ? .125 : shape.includes('g36') ? .135 : mini ? .095 : .117;
        const y = shotgun ? -.009 : 0;
        if (shape.includes('benelli') && !shape.endsWith('rail')) {
            for (const x of [-.04, .04]) b([x, y, 0], [.045, .085, length], color);
            b([0, y - .041, 0], [.099, .025, length], color);
        } else b([0, y, 0], [width, shotgun ? .097 : .107, length], color);
        const railed = shape.includes('rail') || /ak12|scar|mcx|bren|mpx|scorpion/.test(shape);
        for (let z = -length / 2 + .025; z < length / 2; z += .050) {
            if (railed) b([0, y + .061, z], [width + .01, .015, .021], black);
            else b([0, y - .052, z], [width + .004, .008, .009], black);
            for (const x of [-width / 2, width / 2]) b([x, y + .006, z], [.009, shape.includes('g36') ? .047 : .024, shape.includes('mcx') ? .033 : .021], black);
        }
        if (shape.includes('870')) for (const x of [-.049, .049]) b([x, .016, .20], [.012, .017, .24], steel);
    } else if (shape === 'guard_aug' || shape === 'guard_aug_rail') {
        cy([0, .077, 0], [.052, .115, .052], steel); b([0, .023, .003], [.083, .063, .12], color);
        if (shape === 'guard_aug') { b([0, -.076, -.001], [.07, .171, .088], color, [.12, 0, 0]); b([0, -.152, .008], [.077, .028, .10], black); }
        else { b([0, -.010, 0], [.114, .067, .18], color); for (const x of [-.065, .065]) for (const z of [-.055, 0, .055]) b([x, 0, z], [.015, .069, .027], black); }
    } else if (shape === 'guard_m14') {
        b([0, -.001, 0], [.087, .036, .43], color); for (let z = -.19; z < .20; z += .042) b([0, .019, z], [.09, .007, .009], black);
    } else if (/^mag_(545_window|val|g36|aug|scorpion|mpx|m14)/.test(shape)) {
        const pistol = /scorpion|mpx/.test(shape), short = shape.includes('short'), long = shape.includes('long');
        const length = short ? .145 : long ? .35 : shape.includes('val') ? .235 : .25;
        const curve = shape.includes('val') || shape.includes('scorpion') ? .42 : shape.includes('aug') ? .25 : shape.includes('g36') ? .20 : shape.includes('545') ? .33 : .045;
        const width = pistol ? .053 : shape.includes('m14') ? .077 : .069, depth = pistol ? .069 : shape.includes('m14') ? .114 : .105;
        for (let n = 0; n < 6; n++) {
            const y = .084 - n * length / 6, z = -curve * (n / 6) ** 2 * .17;
            b([0, y, z], [width, length / 6 + .008, depth], color, [curve * n / 6, 0, 0]);
            for (const x of [-width / 2, width / 2]) b([x, y, z - .018], [.009, length / 6 * .70, shape.includes('545') ? .022 : .009], black);
            if (/aug|g36/.test(shape)) b([0, y, z - depth / 2], [width + .004, .009, .009], black, [curve * n / 6, 0, 0]);
        }
        b([0, .067 - length, -.13 * curve], [width + .017, .022, depth + .009], black, [curve, 0, 0]);
    } else if (/^mag_(m9|m17)/.test(shape)) {
        const length = shape.endsWith('long') ? .205 : .145;
        b([0, -.021, 0], [.060, length, .086], steel, [-.17, 0, 0]); b([0, -.021 - length / 2, .010], [.076, .028, .098], color);
        for (let n = 0; n < 4; n++) b([.032, .021 - n * .025, .009], [.008, .010, .010], black);
    } else if (/^grip_(m9|m17|scorpion)/.test(shape)) {
        const m17 = shape.includes('m17'), slim = shape.endsWith('slim'), rubber = shape.endsWith('rubber');
        b([0, -.026, 0], [slim ? .069 : rubber ? .092 : .081, .182, m17 ? .115 : .092], color, [shape.includes('scorpion') ? -.35 : -.18, 0, 0]);
        if (m17) { b([0, .065, -.069], [.081, .051, .174], color); b([0, .062, .070], [.079, .03, .074], color); }
        for (const x of [-.043, .043]) for (let n = 0; n < 5; n++) b([x, -.094 + n * .032, .005], [.006, .012, .05], black);
    } else if (shape === 'mount_pistol') {
        b([0, .007, 0], [.079, .013, .072], color);
    } else if (shape === 'optic_micro') {
        b([0, -.035, 0], [.071, .021, .060], color);
        for (const x of [-.031, .031]) b([x, -.011, -.009], [.009, .048, .036], color);
        b([0, .013, -.009], [.072, .010, .036], color); b([0, -.007, -.027], [.053, .034, .004], rgb('#326259'));
    } else if (shape === 'muzzle_m14') {
        cy([0, 0, -.025], [.036, .12, .036], color); for (const x of [-.018, .018]) for (const z of [-.05, -.014, .022]) b([x, 0, z], [.010, .031, .019], black);
    } else if (shape === 'fore_slim') {
        b([0, -.025, 0], [.036, .070, .073], color, [-.20, 0, 0]); b([0, .01, -.02], [.053, .016, .09], black);
    } else if (shape === 'light_compact') {
        cy([0, 0, 0], [.044, .10, .044], color); cy([0, 0, -.055], [.052, .026, .052], black); cy([0, 0, -.072], [.038, .008, .038], rgb('#f8e6b5'));
    } else return null;
    return parts;
}
