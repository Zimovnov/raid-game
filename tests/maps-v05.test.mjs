import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, RAID_MAPS } from '../dist/src/content/maps.js';
import { Collision, Navigation, rayRamp } from '../dist/src/simulation/collision.js';
import { World } from '../dist/src/simulation/world.js';
import { newProfile } from '../dist/src/domain/profile.js';
import { dist, distXZ, noInput } from '../dist/src/domain/util.js';

const actor = { name: 'Проверка Карт', faction: 'BEAR', face: 0, outfit: 0 };
const empty = (surfaces = []) => ({ id: 'wedge-regression', name: 'fixture', subtitle: '', theme: 'range', size: [40, 40], ground: [.4, .4, .4], fog: [.7, .7, .7], duration: 600, boxes: [], surfaces, doors: [], loot: [], spawn: [[0, 0, 12]], bots: [], exits: [], pois: [], signs: [] });

test('a solid ascending stair wedge intercepts side, high-end and low-end rays', () => {
    const s = { x: 0, z: 0, w: 4, d: 8, y: 0, rise: 4 };
    assert.equal(rayRamp([-5, 1, 2], [1, 0, 0], s), 3);
    assert.equal(rayRamp([0, 1, 8], [0, 0, -1], s), 4);
    assert.equal(rayRamp([0, 1, -8], [0, 0, 1], s), 6);
    assert.equal(rayRamp([-5, 3.5, 2], [1, 0, 0], s, 12), null);
    assert.equal(rayRamp([0, 1, 2], [1, 0, 0], s), 0);
    assert.equal(rayRamp([-5, 1, 2], [1, 0, 0], s, 2.9), null);
});

test('descending stairs use the same closed wedge as movement, with no phantom block above the slope', () => {
    const s = { x: 0, z: 0, w: 4, d: 8, y: 4, rise: -4 }, c = new Collision(empty([s]));
    assert.equal(rayRamp([-5, 1, -2], [1, 0, 0], s), 3);
    assert.equal(c.ray([-5, 1, -2], [1, 0, 0], 12).t, 3);
    assert.equal(c.visible([-5, 1, -2], [5, 1, -2]), false);
    assert.equal(c.visible([-5, 3.5, -2], [5, 3.5, -2]), true);
    assert.equal(c.free([0, 1, -2]), false);
    assert.equal(c.free([0, 3, -2]), true);
});

test('production mall stairs no longer allow horizontal fire through the visible side', () => {
    const c = new Collision(MAPS.mall);
    assert.equal(c.ray([-10, 1, 12], [1, 0, 0], 8).t, 2);
    assert.equal(c.visible([-10, 1, 12], [-2, 1, 12]), false);
});

test('both atrium end edges stop a standing or crouched walker, while stair entries stay open', () => {
    const c = new Collision(MAPS.mall);
    for (const h of [1.72, 1.17]) {
        assert(c.move([0, 4, 24], 0, -2, .33, h)[2] > 23.3);
        assert(c.move([0, 4, -24], 0, 2, .33, h)[2] < -23.3);
    }
    assert(c.free([-6, 4, 23]));
    assert(c.free([6, 4, -23]));
});

test('real railing bars block a ray, their visible gaps do not become invisible ballistic cover', () => {
    const c = new Collision(MAPS.mall);
    assert(c.ray([0, 5.23, 24], [0, 0, -1], 2).t < 1);
    assert.equal(c.ray([0, 4.95, 24], [0, 0, -1], 2).t, 2);
});

test('the garage service passage and west entrance no longer intersect the dacha or a continuous fence', () => {
    const c = new Collision(MAPS.village);
    // Interior-to-yard crossing at the west garage opening, then along the 3.5 m gap.
    for (const p of [[40, 0, -53], [40, 0, -51], [40, 0, -48], [41.5, 0, -51], [43, 0, -51]])
        assert(c.free(p), 'blocked service passage at ' + p);
    const moved = c.move([40, 0, -51], 4, 0);
    assert(moved[0] > 43.9);
});

test('the pond visit marker is on an accessible bank instead of the unreachable water centre', () => {
    const m = MAPS.park, c = new Collision(m), p = m.pois.find(p => p.id === 'pond');
    assert(c.free(p.p));
    assert(p.p[0] < 23);
    assert(distXZ(p.p, [39, 0, -6]) > 7);
});

test('jumping from the flat pond bank cannot climb the new physical shoreline fence', () => {
    const profile = newProfile(actor), w = new World(MAPS.park, 'shoreline-controller', false, 19, true);
    const a = w.addPlayer(profile.id, profile.character, profile.gear);
    a.p = [21.5, 0, -6]; a.safePosition = [...a.p];
    for (let tick = 0; tick < 180; tick++) {
        w.input(a.id, { ...noInput(), seq: a.input.seq + 1, right: 1, sprint: true, jump: tick % 30 === 0 });
        w.step(1 / 30);
        assert(a.p[0] < 22.7, 'entered the pond at ' + a.p);
        assert.equal(a.recoveries, 0);
    }
    assert.equal(a.hp, 100);
});

for (const m of RAID_MAPS) test('new scenery keeps starts, all interaction approaches and POIs connected: ' + m.id, () => {
    const c = new Collision(m), n = new Navigation(c);
    for (const p of [...m.spawn, ...m.bots]) assert(c.free(p), 'blocked spawn ' + p);
    for (const target of [...m.loot, ...(m.activators || [])]) {
        const candidates = [...n.nodes.values()].filter(v => dist([v.p[0], v.p[1] + 1.58, v.p[2]], target.p) < 2.9
            && c.visible([v.p[0], v.p[1] + 1.58, v.p[2]], target.p));
        assert(candidates.some(v => n.reachable(m.spawn[0], v.p)), 'no physical interaction approach: ' + target.id);
    }
    for (const poi of m.pois) {
        const candidates = [...n.nodes.values()].filter(v => distXZ(v.p, poi.p) < 6.5 && Math.abs(v.p[1] - poi.p[1]) < .6);
        assert(candidates.some(v => n.reachable(m.spawn[0], v.p)), 'POI inaccessible on its floor: ' + poi.id);
    }
    assert.equal(new Set(m.boxes.map(b => b.id)).size, m.boxes.length, 'colliding geometry identifiers');
});
