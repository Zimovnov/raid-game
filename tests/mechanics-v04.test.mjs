import { scavLoadout } from '../dist/src/content/scav-loadouts.js';
import { loadedRounds as botRounds, setLoadedRounds as botSetRounds } from '../dist/src/domain/ammunition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../dist/src/content/catalog.js';
import { World } from '../dist/src/simulation/world.js';
import { raySphere } from '../dist/src/simulation/collision.js';
import { newProfile, emptyGear } from '../dist/src/domain/profile.js';
import { createItem, createWeapon } from '../dist/src/domain/items.js';
import { setLoadedRounds } from '../dist/src/domain/ammunition.js';
import { noInput, uid } from '../dist/src/domain/util.js';

const character = { name: 'Механики 0.4', faction: 'BEAR', face: 0, outfit: 0 };
function arena() {
    return { id: uid(), name: 'Контрольная площадка', subtitle: '', size: [64, 64], theme: 'factory', ground: [.4, .4, .4], fog: [.7, .7, .7], duration: 600,
        boxes: [], surfaces: [], doors: [], loot: [], spawn: [[0, 0, 12], [2, 0, 12]], bots: [], exits: [], pois: [], signs: [] };
}
function fixture(map = arena(), seed = 42, friendlyFire = false) {
    const profile = newProfile(character), w = new World(map, uid(), friendlyFire, seed), a = w.addPlayer(profile.id, profile.character, profile.gear);
    return { w, a, profile };
}
function steps(w, n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) w.step(dt); }
function input(w, a, data = {}, dt = 1 / 30) { w.input(a.id, { ...noInput(), seq: a.input.seq + 1, yaw: a.yaw, pitch: a.pitch, ...data }); w.step(dt); }
function action(w, a, type, args = {}) { steps(w); return w.action(a.id, { id: uid(), type, ...args }); }
function addBot(w, data = {}) {
    const b = { id: 'bot-fixture-' + w.bots.length, name: 'Часовой', p: [0, 0, 0], yaw: Math.PI, hp: 75, mode: 'patrol', ...scavLoadout(0), timer: 0, target: '', goal: [0, 0, 0], path: [], lastSeen: [0, 0, 0], memory: 0, nextThink: 0, voiceAt: -100, shotAt: -100, style: 0, ...data };
    botSetRounds(b.weapon, data.ammo ?? 18);
    w.bots.push(b); return b;
}
function platform(height) {
    const map = arena();
    map.spawn[0] = [0, height, 0];
    map.boxes.push({ id: 'platform', p: [0, height / 2, 0], s: [4, height, 4], solid: true, color: [.4, .4, .4], kind: 'crate' });
    return map;
}
function leavePlatform(w, a, dt = 1 / 30) {
    for (let i = 0; i < Math.round(5 / dt) && a.status === 'active'; i++) input(w, a, { right: a.p[0] < 4 ? 1 : 0 }, dt);
}

test('ray-sphere catches overlapping actors and supports non-unit directions', () => {
    assert.equal(raySphere([0, 0, 0], [0, 0, 1], [0, 0, 0], 1, 20), 0);
    assert.equal(raySphere([0, 0, 4], [0, 0, -2], [0, 0, 0], 1, 20), 1.5);
    assert.equal(raySphere([0, 0, 0], [0, 0, 0], [0, 0, 0], 1, 20), null);
    assert.equal(raySphere([NaN, 0, 0], [0, 0, -1], [0, 0, 0], 1, 20), null);
});
test('ordinary jump is safe and holding jump does not repeatedly launch the player', () => {
    const { w, a } = fixture();
    for (let i = 0; i < 150; i++) input(w, a, { jump: true });
    assert.equal(a.hp, 100); assert.equal(a.legInjury, false); assert.equal(a.p[1], 0);
    assert.equal(w.events.filter(e => e.type === 'mechanic' && e.text === 'land').length, 1);
    input(w, a); input(w, a, { jump: true }); assert(a.vy > 0);
});
test('walking off a low platform stays safe, without landing events on grounded ticks', () => {
    const { w, a } = fixture(platform(2.3)); leavePlatform(w, a);
    assert.equal(a.p[1], 0); assert.equal(a.hp, 100); assert.equal(a.legInjury, false);
    const count = w.events.filter(e => e.text === 'land').length;
    assert.equal(count, 1); steps(w, 120); assert.equal(w.events.filter(e => e.text === 'land').length, count);
});
test('a real fall injures the leg, bypasses armor and cancels the current action', () => {
    const { w, a } = fixture(platform(4.2));
    const armor = a.gear.armor.condition;
    for (let i = 0; i < 40; i++) input(w, a, { right: 1 });
    assert(!a.grounded && a.p[1] > 0);
    const med = a.gear.bag.find(i => CATALOG[i.def].effect === 'heal'); a.hp = 80;
    assert(action(w, a, 'use', { item: med.id }).ok); steps(w, 90);
    assert(a.hp < 80); assert.equal(a.legInjury, true); assert.equal(a.gear.armor.condition, armor);
    assert.equal(a.bleed, false); assert.equal(a.use, 0); assert(a.gear.bag.some(i => i.id === med.id));
    assert(w.events.some(e => e.text === 'land-hard')); assert(w.events.some(e => e.text === 'leg-injury'));
});
test('fall damage is consistent across simulation step rates', () => {
    const slow = fixture(platform(4.2)), fast = fixture(platform(4.2));
    leavePlatform(slow.w, slow.a, 1 / 30); leavePlatform(fast.w, fast.a, 1 / 60);
    assert(Math.abs(slow.a.hp - fast.a.hp) < .1, `${slow.a.hp} versus ${fast.a.hp}`);
    assert.equal(slow.a.legInjury, true); assert.equal(fast.a.legInjury, true);
});
test('below-world recovery returns to a safe point without fall damage, injury or healing', () => {
    const { w, a } = fixture(), safe = [...a.safePosition]; a.hp = 37; a.p = [6, -12, 0]; a.vy = -60; a.grounded = false;
    steps(w); assert.deepEqual(a.p, safe); assert.equal(a.hp, 37); assert.equal(a.legInjury, false); assert.equal(a.recoveries, 1);
    assert(!w.events.some(e => e.text === 'land-hard')); assert.equal(a.status, 'active');
});
test('a fatal fall commits one death before extraction and never duplicates the corpse', () => {
    const map = platform(30); map.exits.push({ id: 'below', name: 'Выход', p: [4, 0, 0], radius: 8, seconds: .01 });
    const { w, a } = fixture(map); leavePlatform(w, a); steps(w, 30);
    assert.equal(a.status, 'dead'); assert.equal(a.result.cause, 'Падение с высоты');
    assert.equal(w.containers.filter(c => c.id === 'corpse-' + a.id).length, 1);
});
test('leg injury slows walking and blocks sprint and jump until a splint completes', () => {
    const healthy = fixture(), injured = fixture(); injured.a.legInjury = true;
    for (let i = 0; i < 30; i++) { input(healthy.w, healthy.a, { right: 1 }); input(injured.w, injured.a, { right: 1, sprint: true, jump: true }); }
    assert(injured.a.p[0] < healthy.a.p[0] * .75); assert.equal(injured.a.sprinting, false); assert.equal(injured.a.p[1], 0);
    input(injured.w, injured.a); const splint = createItem('loot_medical_19'); injured.a.gear.bag.push(splint);
    const hp = injured.a.hp; assert(action(injured.w, injured.a, 'use', { item: splint.id }).ok);
    steps(injured.w, 121); assert.equal(injured.a.legInjury, false); assert.equal(injured.a.hp, hp);
    assert(!injured.a.gear.bag.some(i => i.id === splint.id)); input(injured.w, injured.a, { right: 1, sprint: true }); assert(injured.a.sprinting);
});
for (const reason of ['move', 'fire', 'damage', 'cancel']) test('interrupted splint preserves the item and the injury: ' + reason, () => {
    const { w, a } = fixture(), splint = createItem('loot_medical_19'); a.gear.bag.push(splint); a.legInjury = true;
    assert(action(w, a, 'use', { item: splint.id }).ok); steps(w, 8);
    if (reason === 'move') input(w, a, { right: 1 });
    if (reason === 'fire') input(w, a, { fire: true });
    if (reason === 'damage') a.hurtAt = w.time;
    if (reason === 'cancel') action(w, a, 'cancel');
    steps(w, 150); assert.equal(a.legInjury, true); assert(a.gear.bag.some(i => i.id === splint.id)); assert.equal(a.use, 0);
});
test('a splint cannot start or complete while the injured player is airborne', () => {
    const { w, a } = fixture(), splint = createItem('loot_medical_19'); a.gear.bag.push(splint); a.legInjury = true;
    a.p[1] = 2; a.grounded = false;
    assert(!action(w, a, 'use', { item: splint.id }).ok); assert(a.gear.bag.some(i => i.id === splint.id));
    steps(w, 25); assert(a.grounded); assert(action(w, a, 'use', { item: splint.id }).ok);
    a.p[1] = 1; a.grounded = false; steps(w);
    assert.equal(a.use, 0); assert.equal(a.legInjury, true); assert(a.gear.bag.some(i => i.id === splint.id));
});
for (const effect of ['heal', 'bandage', 'energy', 'splint']) test('a medical or energy item is not consumed when its effect is unnecessary: ' + effect, () => {
    const { w, a } = fixture(), definition = Object.values(CATALOG).find(d => d.effect === effect), item = createItem(definition.id); a.gear.bag.push(item);
    const reply = action(w, a, 'use', { item: item.id }); assert(!reply.ok); assert(reply.message);
    steps(w, 150); assert(a.gear.bag.some(i => i.id === item.id)); assert.equal(a.use, 0);
});
test('starting medicine preserves the last injury time and does not hide damage feedback', () => {
    const { w, a } = fixture(); a.hp = 50; a.hurtAt = w.time;
    const before = a.hurtAt, med = a.gear.bag.find(i => CATALOG[i.def].effect === 'heal');
    assert(action(w, a, 'use', { item: med.id }).ok); assert.equal(a.hurtAt, before);
    steps(w, 92); assert.equal(a.hp, 98);
});
test('exhaustion prevents sprint oscillation until stamina reaches the recovery threshold', () => {
    const { w, a } = fixture(); a.stamina = 3;
    for (let i = 0; i < 45; i++) { input(w, a, { forward: 1, sprint: true }); assert.equal(a.sprinting, false); }
    assert(a.exhausted); assert(a.stamina < 25);
    for (let i = 0; i < 30 && !a.sprinting; i++) input(w, a, { forward: 1, sprint: true });
    assert(a.sprinting); assert.equal(a.exhausted, false);
});
test('energy food restores stamina and clears exhaustion', () => {
    const { w, a } = fixture(); a.stamina = 0; a.exhausted = true;
    const food = a.gear.bag.find(i => CATALOG[i.def].effect === 'energy');
    assert(action(w, a, 'use', { item: food.id }).ok); steps(w, 61);
    assert.equal(a.stamina, 100); assert.equal(a.exhausted, false);
});
test('a low ceiling forces a real crouch in snapshots and expired input keeps that stance', () => {
    const map = arena(); map.boxes.push({ id: 'beam', p: [0, 1.52, 12], s: [4, .3, 4], solid: true, color: [.4, .4, .4], kind: 'roof' });
    const { w, a } = fixture(map);
    input(w, a, { crouch: false, jump: true }); assert.equal(a.input.crouch, true); assert.equal(a.vy, 0);
    steps(w, 30); assert.equal(w.snapshot().players[0].input.crouch, true); assert.equal(a.input.jump, false);
    for (let i = 0; i < 90; i++) input(w, a, { right: 1 });
    input(w, a, { crouch: false }); assert.equal(a.input.crouch, false); assert(w.collision.free(a.p));
});
test('expired movement is cleared from the authoritative snapshot', () => {
    const { w, a } = fixture(); input(w, a, { forward: 1, sprint: true }); steps(w, 20);
    assert.equal(a.input.forward, 0); assert.equal(a.input.sprint, false); assert.equal(a.sprinting, false);
});
test('crouching removes the standing head hitbox from friendly-fire hitscan', () => {
    for (const crouch of [false, true]) {
        const { w, a } = fixture(arena(), 13, true), p = newProfile({ ...character, name: 'Напарник' }), other = w.addPlayer(p.id, p.character, p.gear);
        other.p = [0, 0, 2]; other.input.crouch = crouch;
        input(w, a, { aim: true, fire: true });
        assert.equal(other.hp < 100, !crouch, 'standing ray must pass above a crouched actor');
    }
});
test('a bot cannot open the door leaf into a player, and opens it once clear', () => {
    const map = arena(); map.doors.push({ id: 'door', p: [0, 1.33, 10], s: [3.2, 2.65, .24], axis: 'x', name: 'Дверь', open: false });
    const { w, a } = fixture(map); a.p = [-1.6, 0, 11.6];
    addBot(w, { p: [0, 0, 11.5], path: [[0, 0, 9]], goal: [0, 0, 9], nextThink: 9999 });
    steps(w); assert.equal(w.collision.doors[0].open, false); assert(w.collision.free(a.p));
    a.p = [10, 0, 12]; steps(w); assert.equal(w.collision.doors[0].open, true);
});
test('a bot cannot perceive a silent distant player outside its field of view', () => {
    const { w } = fixture(); const b = addBot(w, { yaw: 0 }); steps(w);
    assert.equal(b.target, ''); assert.equal(b.mode, 'patrol'); assert.equal(b.memory, 0);
});
test('crouched target behind low cover is hidden while a standing target is visible', () => {
    for (const crouch of [false, true]) {
        const map = arena(); map.boxes.push({ id: 'low-cover', p: [0, .61, 10], s: [12, 1.22, .4], solid: true, color: [.4, .4, .4], kind: 'crate' });
        const { w, a } = fixture(map), b = addBot(w); a.input.crouch = crouch; steps(w);
        assert.equal(!!b.target, !crouch);
    }
});
test('nearby sound replaces an obsolete route with a new approximate investigation goal', () => {
    const { w, a } = fixture(); const b = addBot(w, { p: [0, 0, -8], yaw: 0, mode: 'search', path: [[-10, 0, -10]], goal: [-10, 0, -10], memory: 3, nextThink: 9999 });
    // This uses the production hearing entry point for a gunshot; not a private-state shortcut.
    input(w, a, { fire: true, yaw: Math.PI });
    assert(b.lastSeen[2] > 9); assert(b.memory > 0); assert.notDeepEqual(b.goal, [-10, 0, -10]);
    assert(!b.path.some(p => p[0] === -10 && p[2] === -10));
});
test('walls attenuate sound and an unreachable investigation expires', () => {
    const map = arena(); map.boxes.push({ id: 'divider', p: [0, 2, 0], s: [64, 4, 1], solid: true, color: [.4, .4, .4], kind: 'wall' });
    const { w, a } = fixture(map); const b = addBot(w, { p: [0, 0, -6], goal: [0, 0, -6], yaw: 0 });
    input(w, a, { fire: true, yaw: Math.PI });
    assert.equal(b.mode, 'investigate'); assert(b.memory > 0); assert.deepEqual(b.path, []);
    steps(w, 175); assert.equal(b.mode, 'patrol'); assert.equal(b.target, ''); assert.equal(b.memory, 0);
    const quietMap = arena(); quietMap.boxes = structuredClone(map.boxes);
    const quiet = fixture(quietMap), guard = addBot(quiet.w, { p: [0, 0, -6], goal: [0, 0, -6], yaw: 0 });
    for (let i = 0; i < 16; i++) input(quiet.w, quiet.a, { right: 1, sprint: true });
    assert.equal(guard.memory, 0, 'footsteps outside the attenuated radius must not reveal a location');
});
test('vision gives a reaction delay and bot shots arrive in short bursts with pauses', () => {
    const { w, a } = fixture(); const b = addBot(w);
    const times = []; let last = 0;
    for (let i = 0; i < 240; i++) {
        steps(w);
        for (const e of w.events.filter(e => e.seq > last)) { last = Math.max(last, e.seq); if (e.type === 'shot' && e.actor === b.id) times.push(w.time); }
        // Preserve the combat fixture long enough to inspect cadence, using fresh health only.
        if (a.status === 'active') a.hp = 100;
    }
    assert(times.length >= 7); assert(times[0] >= .9);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    assert(gaps.some(g => g >= .8)); assert(gaps.some(g => g >= .18 && g <= .34));
    assert(gaps.every(g => g >= .18));
});
test('seeded AI perception and burst choices replay deterministically', () => {
    function trace() {
        const { w, a } = fixture(arena(), 77), b = addBot(w), events = []; let last = 0;
        for (let i = 0; i < 150; i++) {
            steps(w); if (a.status === 'active') a.hp = 100;
            for (const e of w.events.filter(e => e.seq > last)) { last = Math.max(last, e.seq); if (e.actor === b.id) events.push({ time: w.time, type: e.type, to: e.to, text: e.text }); }
        }
        return { mode: b.mode, ammo: botRounds(b.weapon), events };
    }
    assert.deepEqual(trace(), trace());
});
test('an empty bot cannot shoot until its reload and post-reload reaction finish', () => {
    const { w, a } = fixture(), b = addBot(w, { mode: 'attack', ammo: 0, target: a.id });
    steps(w); assert.equal(b.mode, 'reload'); assert.equal(botRounds(b.weapon), 0);
    steps(w, 60); assert.equal(b.mode, 'reload'); assert.equal(botRounds(b.weapon), 0); assert(!w.events.some(e => e.type === 'shot'));
    steps(w, 50); assert.equal(b.mode, 'attack'); assert(botRounds(b.weapon) > 0 && botRounds(b.weapon) < 30); assert(w.events.some(e => e.type === 'shot' && e.actor === b.id));
});
test('bot spawn safety is rechecked after navigation snaps a hidden authored point around a corner', () => {
    const map = arena(); map.spawn = [[0, 0, 0], [0, 0, .1]]; map.bots = [[20, 0, 1]];
    map.boxes.push({ id: 'corner', p: [18.5, 2, .92], s: [.3, 4, .26], solid: true, color: [.4, .4, .4], kind: 'wall' });
    const { w } = fixture(map); assert.equal(w.bots.length, 0, 'navigation point exposes the bot directly to the spawn');
});
test('bound ammunition remains bound after packing a magazine in a raid', () => {
    const { w, a } = fixture(), mag = structuredClone(a.gear.primary.children.magazine), ammo = createItem('ammo_5.45x39', 1);
    mag.id = uid(); mag.rounds = 0; delete mag.bound; ammo.bound = true; a.gear.bag = [mag, ammo];
    assert(action(w, a, 'load-mag', { item: mag.id }).ok); steps(w, 15);
    assert.equal(mag.rounds, 1); assert.equal(mag.bound, true); assert(!a.gear.bag.some(i => i.id === ammo.id));
});
test('bound ammunition remains bound after loading an internal-feed weapon', () => {
    const { w, a } = fixture(), gun = createWeapon('weapon_mp133'), ammo = createItem('ammo_12gauge', 1);
    setLoadedRounds(gun, 0); ammo.bound = true; a.gear.primary = gun; a.gear.bag = [ammo];
    assert(action(w, a, 'reload').ok); steps(w, 40); assert.equal(gun.bound, true); assert.equal(gun.chamber, 1);
});
test('dropping and picking up a purchased item cannot forge found-in-raid provenance', () => {
    const { w, a } = fixture(), item = createItem('loot_valuables_01'); a.gear.bag = [item];
    assert(action(w, a, 'drop', { item: item.id }).ok); const drop = w.containers.at(-1); assert.equal(drop.source, 'player');
    assert(action(w, a, 'take', { target: drop.id, item: item.id, revision: 0 }).ok);
    const kept = a.gear.bag.find(i => i.id === item.id); assert.equal(kept.found, undefined); assert.equal(kept.foundMap, undefined);
});
test('world loot keeps its genuine provenance after dropping and picking it up again', () => {
    const { w, a } = fixture(), item = createItem('loot_valuables_01'); a.gear.bag = [];
    w.containers.push({ id: 'world-item', name: 'Находка', p: [0, .1, 11], items: [item], revision: 0, loose: true, source: 'world' });
    assert(action(w, a, 'take', { target: 'world-item', item: item.id, revision: 0 }).ok);
    assert(action(w, a, 'drop', { item: item.id }).ok); const drop = w.containers.at(-1);
    assert(action(w, a, 'take', { target: drop.id, item: item.id, revision: 0 }).ok);
    assert.equal(a.gear.bag[0].found, w.raidId); assert.equal(a.gear.bag[0].foundMap, w.map.id);
});
test('player corpse items retain their original provenance instead of becoming new raid loot', () => {
    const { w, a } = fixture(), item = createItem('loot_valuables_01'), oldItem = createItem('loot_valuables_02');
    oldItem.found = 'earlier-raid'; oldItem.foundMap = 'city'; a.gear = emptyGear(); a.gear.bag = [item, oldItem];
    const p = newProfile({ ...character, name: 'Второй' }), b = w.addPlayer(p.id, p.character, p.gear); b.gear.bag = [];
    w.finish(a, 'dead'); const corpse = w.containers.at(-1); assert.equal(corpse.source, 'player');
    assert(action(w, b, 'interact', { target: corpse.id }).ok); steps(w, 80);
    for (const i of [item, oldItem]) assert(action(w, b, 'take', { target: corpse.id, item: i.id, revision: corpse.revision }).ok);
    assert.equal(b.gear.bag.find(i => i.id === item.id).found, undefined);
    assert.equal(b.gear.bag.find(i => i.id === oldItem.id).found, 'earlier-raid');
    assert.equal(b.gear.bag.find(i => i.id === oldItem.id).foundMap, 'city');
});
