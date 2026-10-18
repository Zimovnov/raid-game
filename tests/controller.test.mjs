import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../dist/src/main.js';
import { applyResult, newProfile, prepareRaid } from '../dist/src/domain/profile.js';
import { World } from '../dist/src/simulation/world.js';
import { MAPS } from '../dist/src/content/maps.js';

// Calls production controller methods with explicit DOM/audio boundaries.
// This is not browser, WebGL, or IndexedDB integration.
function controller() {
    const game = Object.create(Game.prototype);
    Object.assign(game, {
        profile: newProfile({ name: 'Контроллер', faction: 'BEAR', face: 0, outfit: 0 }),
        page: 'maps', solo: null, session: null, snapshot: null, resultBusy: false, resultAttempted: '',
        trackedExit: '', collision: null, overlay: '', launchBusy: false, eventId: 0,
        controls: { enabled: false, unlock() {}, syncSequence() {} }, audio: { reset() {}, event() {} },
        render() {}, toast() {}, change: async function (fn) { this.profile = fn(this.profile); }
    });
    return game;
}
test('repeated solo click launches exactly one raid while preparation is unresolved', async () => {
    const game = controller(); let starts = 0, release;
    game.startSoloRaid = async () => { starts++; await new Promise(resolve => { release = resolve; }); };
    const first = game.startSolo('factory');
    await game.startSolo('factory');
    assert.equal(starts, 1); assert.equal(game.launchBusy, true);
    release(); await first;
    assert.equal(game.launchBusy, false);
});
test('failed raid preparation restores escrow and lets the next start proceed', async () => {
    const game = controller(); const before = structuredClone(game.profile.gear);
    game.startSoloRaid = async () => { game.profile = prepareRaid(game.profile, 'failed-launch', 'factory'); throw Error('Render setup failed'); };
    await assert.rejects(game.startSolo('factory'), /Render setup failed/);
    assert.equal(game.profile.pending, null); assert.deepEqual(game.profile.gear, before);
    assert.equal(game.page, 'maps'); assert.equal(game.launchBusy, false);
    assert.equal(game.solo, null);
});
test('pending escrow and an active raid cannot be replaced by another start', async () => {
    const game = controller(); let started = false; game.startSoloRaid = async () => { started = true; };
    game.profile = prepareRaid(game.profile, 'ongoing', 'factory');
    await assert.rejects(game.startSolo('city'), /завершите текущий рейд/);
    assert.equal(started, false); assert.equal(game.profile.pending.raidId, 'ongoing');
});
test('failed result is not retried by every snapshot; explicit retry preserves the same result', async () => {
    const game = controller();
    game.profile = prepareRaid(game.profile, 'result-save', 'factory');
    const world = new World(MAPS.factory, 'result-save', false, 42);
    const actor = world.addPlayer(game.profile.id, game.profile.character, game.profile.pending.gear);
    world.finish(actor, 'extracted');
    game.page = 'raid'; let writes = 0;
    game.change = async () => { writes++; throw Error('Quota exceeded'); };
    game.receiveSnapshot(world.snapshot());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(game.resultBusy, false); assert.equal(writes, 1);
    for (let i = 0; i < 15; i++) game.receiveSnapshot(world.snapshot());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes, 1); assert.ok(game.profile.pending);
    game.change = async function(fn) { writes++; this.profile = fn(this.profile); };
    await game.resolveResult(actor.result);
    assert.equal(writes, 2); assert.equal(game.profile.pending, null);
    assert.equal(game.profile.stats.extracted, 1);
});
for (const page of ['raid', 'lobby']) test('online terminal snapshot opens results after server profile confirmation on ' + page, async () => {
    const game = controller();
    const prepared = prepareRaid(game.profile, 'confirmed-online-result', 'factory');
    const world = new World(MAPS.factory, 'confirmed-online-result', false, 42);
    const actor = world.addPlayer(prepared.id, prepared.character, prepared.pending.gear);
    world.finish(actor, 'missing');
    const confirmed = applyResult(prepared, actor.result);
    game.profile = confirmed;
    game.online = { me: async () => confirmed };
    game.page = page;
    game.receiveSnapshot(world.snapshot());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(game.page, 'results');
    assert.equal(game.result?.id, actor.result.id);
    assert.equal(game.profile.pending, null);
    assert.equal(game.saving, false);
});
test('raid snapshot advances client input sequence after reconnect', () => {
    const game = controller();
    const world = new World(MAPS.factory, 'rejoined-raid', false, 42);
    const actor = world.addPlayer(game.profile.id, game.profile.character, game.profile.gear);
    world.input(actor.id, { ...actor.input, seq: 500 });
    let acknowledged = -1;
    game.controls.syncSequence = sequence => { acknowledged = sequence; };
    game.receiveSnapshot(world.snapshot());
    assert.equal(acknowledged, 500);
});
test('resuming a raid clears the overlay before requesting Pointer Lock', () => {
    const game = controller();
    game.page = 'raid';
    game.overlay = 'pause';
    game.snapshot = { players: [{ id: game.profile.id }] };
    let overlayWhenLockRequested = 'unset';
    game.controls = {
        enabled: false,
        unlock() {},
        syncSequence() {},
        lock() {
            overlayWhenLockRequested = game.overlay;
            // Mirrors a synchronous browser denial: the Controls callback must
            // be able to restore the pause overlay instead of hiding it.
            game.overlay = 'pause';
        }
    };
    game.renderOverlay = () => {};
    game.resumeRaid();
    assert.equal(overlayWhenLockRequested, '');
    assert.equal(game.overlay, 'pause');
    assert.equal(game.controls.enabled, true);
});
for (const outcome of ['dead', 'extracted']) test('disconnect after a failed result write preserves ' + outcome + ' instead of refunding the starting kit', async () => {
    const game = controller();
    game.profile = prepareRaid(game.profile, 'disconnect-result-' + outcome, 'factory');
    const world = new World(MAPS.factory, game.profile.pending.raidId, false, 42);
    const actor = world.addPlayer(game.profile.id, game.profile.character, game.profile.pending.gear);
    world.finish(actor, outcome);
    game.snapshot = world.snapshot();
    game.change = async () => { throw Error('Quota exceeded'); };
    await game.resolveResult(actor.result);
    assert.ok(game.profile.pending);
    game.change = async function(fn) { this.profile = fn(this.profile); };
    await game.connectionLost('Connection closed');
    assert.equal(game.result.outcome, outcome);
    assert.equal(game.profile.journal[0].outcome, outcome);
    assert.equal(game.profile.pending, null);
    assert.equal(game.profile.stats.raids, 1);
    assert.equal(!!game.profile.gear.primary, outcome === 'extracted');
});
test('disconnect with a continued storage failure keeps the known result available for manual retry', async () => {
    const game = controller(); game.profile = prepareRaid(game.profile, 'quota-disconnect', 'factory');
    const world = new World(MAPS.factory, 'quota-disconnect', false, 42);
    const actor = world.addPlayer(game.profile.id, game.profile.character, game.profile.pending.gear);
    world.finish(actor, 'dead'); game.snapshot = world.snapshot();
    game.change = async () => { throw Error('Still out of space'); };
    await game.connectionLost('Connection closed');
    assert.equal(game.page, 'results'); assert.equal(game.result.outcome, 'dead');
    assert.ok(game.profile.pending); assert.equal(game.snapshot, null);
    assert.equal(game.resultAttempted, actor.result.id);
});
test('disconnect without a known terminal result restores only escrow', async () => {
    const game = controller(); const before = structuredClone(game.profile.gear);
    game.profile = prepareRaid(game.profile, 'unknown-disconnect', 'factory');
    await game.connectionLost('Connection closed');
    assert.equal(game.result.outcome, 'technical'); assert.equal(game.profile.pending, null);
    assert.deepEqual(game.profile.gear, before); assert.equal(game.profile.stats.raids, 0);
});
