import test from 'node:test';
import assert from 'node:assert/strict';
import { newProfile, prepareRaid, applyResult } from '../dist/src/domain/profile.js';
import { viewedActor } from '../dist/src/domain/util.js';
import { createItem } from '../dist/src/domain/items.js';
import { World } from '../dist/src/simulation/world.js';
import { MAPS, RAID_MAPS } from '../dist/src/content/maps.js';
import { DEFAULT_SETTINGS } from '../dist/src/persistence/store.js';
import { headingDegrees, headingText, exitGuidance, nearestExit, raidObjectives, quickslotsHtml, conditionHtml } from '../dist/src/ui/raid-info.js';
import { screen, raidOverlay } from '../dist/src/ui/views.js';
import { mapSvg } from '../dist/src/ui/helpers.js';

function fixture(map = MAPS.factory) {
    const profile = newProfile({ name: 'Проверка', faction: 'BEAR', face: 0, outfit: 0 });
    const world = new World(map, 'ui-raid', false, 42);
    const actor = world.addPlayer(profile.id, profile.character, profile.gear);
    const view = { profile, character: profile.character, snapshot: world.snapshot(), page: 'raid', overlay: '', settings: DEFAULT_SETTINGS, selected: '', containerId: '', trackedExit: map.exits[0]?.id || '', isRange: false };
    return { profile, world, actor, view };
}

test('compass agrees with actual game yaw in all cardinal directions and wraps', () => {
    assert.equal(headingDegrees(0), 0);
    assert.equal(headingDegrees(-Math.PI / 2), 90);
    assert.equal(headingDegrees(Math.PI), 180);
    assert.equal(headingDegrees(Math.PI / 2), 270);
    assert.equal(headingText(-2 * Math.PI), 'С · 000°');
    assert.equal(headingText(Math.PI / 4), 'СЗ · 315°');
    assert.equal(headingText(.00001), 'С · 000°');
});
test('chosen exit shows relative bearing without pretending to compute a walkable route', () => {
    const { actor } = fixture(); actor.p = [0, 0, 0]; actor.yaw = 0;
    const map = { ...MAPS.factory, exits: [{ id: 'east', name: 'Восток', p: [10, 0, 0], radius: 3, seconds: 5, requires: 'power' }] };
    let guide = exitGuidance(map, actor, 'east');
    assert.equal(guide.arrow, '→'); assert.equal(guide.distance, 10); assert.equal(guide.available, false);
    actor.yaw = -Math.PI / 2; guide = exitGuidance(map, actor, 'east', ['power']);
    assert.equal(guide.arrow, '↑'); assert.equal(guide.available, true);
    assert.equal(nearestExit(map, actor), '');
    assert.equal(nearestExit(map, actor, ['power']), 'east');
    assert.equal(exitGuidance(map, actor, 'missing'), null);
});
test('tracker only shows accepted tasks on the current map and excludes purchases', () => {
    const { profile, actor } = fixture(MAPS.city);
    profile.quests.quest_05 = { accepted: true, claimed: false, progress: 0 };
    profile.quests.quest_01 = { accepted: true, claimed: false, progress: 0 };
    actor.gear.bag = [createItem('loot_medical_09'), createItem('loot_medical_09')];
    let objectives = raidObjectives(profile, actor, 'city', 'ui-raid');
    assert.equal(objectives.length, 1); assert.equal(objectives[0].count, 0);
    actor.gear.bag[0].found = 'ui-raid'; actor.gear.bag[0].foundMap = 'city';
    const carriedWrongMap = actor.gear.bag[1]; carriedWrongMap.found = 'ui-raid'; carriedWrongMap.foundMap = 'factory';
    objectives = raidObjectives(profile, actor, 'city', 'ui-raid');
    assert.equal(objectives[0].count, 1); assert.equal(objectives[0].ready, false);
    const stash = createItem('loot_medical_09'); stash.found = 'previous'; stash.foundMap = 'city'; profile.stash.push(stash);
    objectives = raidObjectives(profile, actor, 'city', 'ui-raid');
    assert.equal(objectives[0].count, 2); assert.equal(objectives[0].ready, true);
    assert.match(objectives[0].detail, /эвакуируйтесь/);
    profile.quests.quest_05.claimed = true;
    assert.equal(raidObjectives(profile, actor, 'city', 'ui-raid').length, 0);
});
test('live visit/extract tracker does not award persistent progress early', () => {
    const { profile, actor } = fixture(MAPS.city);
    profile.quests.quest_04 = { accepted: true, claimed: false, progress: 0 };
    profile.quests.quest_06 = { accepted: true, claimed: false, progress: 0 };
    actor.visited.push('workshop');
    const item = createItem('loot_documents_09'); item.found = 'previous'; item.foundMap = 'city'; actor.gear.bag = [item];
    let objectives = raidObjectives(profile, actor, 'city', 'ui-raid');
    assert.equal(objectives[0].count, 1); assert.equal(objectives[1].count, 0);
    item.found = 'ui-raid'; objectives = raidObjectives(profile, actor, 'city', 'ui-raid');
    assert.equal(objectives[1].count, 1);
    assert.equal(profile.quests.quest_04.progress, 0); assert.equal(profile.quests.quest_06.progress, 0);
});
test('quickslots reflect remapped keys, usable counts and leg injury', () => {
    const { actor } = fixture();
    actor.gear.bag = [createItem('loot_medical_19'), createItem('loot_medical_19')];
    actor.legInjury = true; actor.exhausted = true;
    const settings = structuredClone(DEFAULT_SETTINGS); settings.bindings.splint = 'KeyH';
    const html = quickslotsHtml(actor, settings);
    assert.match(html, /<kbd>H<\/kbd>Шина <small>×2/);
    assert.match(conditionHtml(actor), /Травма ноги/); assert.match(conditionHtml(actor), /Истощение/);
});
for (const map of RAID_MAPS) test('actual HUD and exit selector include survival state on ' + map.id, () => {
    const { view } = fixture(map);
    const html = screen(view);
    for (const id of ['hud-heading', 'hud-guide', 'hud-objectives', 'hud-condition', 'hud-quickslots', 'hud-weight']) assert.ok(html.includes(`id="${id}"`), id);
    assert.match(html, /Шина/);
    const mapHtml = raidOverlay({ ...view, overlay: 'map' });
    assert.equal((mapHtml.match(/data-act="track-exit"/g) || []).length, map.exits.length + 1);
    assert.match(mapHtml, /по прямой/); assert.match(mapHtml, /Отмечен на компасе/);
    assert.match(mapSvg(map, view.snapshot.players[0], false, [], view.trackedExit), /stroke-dasharray="[0-9.]+ [0-9.]+"/);
});
test('inventory shows timed splint treatment and cancel from the real actor state', () => {
    const { view } = fixture();
    const actor = view.snapshot.players[0];
    const splint = actor.gear.bag.find(item => item.def === 'loot_medical_19');
    actor.legInjury = true; actor.use = 2.4; actor.useItem = splint.id;
    const html = raidOverlay({ ...view, overlay: 'inventory' });
    assert.match(html, /Наложение шины · 2.4 с/); assert.match(html, /cancel-action/);
    assert.match(html, /Травма ноги/);
});
test('spectator task preview never counts the same extracted item twice or awards a failed visit', () => {
    const { profile, actor } = fixture(MAPS.city);
    profile.quests.quest_05 = { accepted: true, claimed: false, progress: 0 };
    const pending = prepareRaid(profile, 'ui-raid', 'city');
    const item = createItem('loot_medical_09'); item.found = 'ui-raid'; item.foundMap = 'city';
    actor.gear.bag = [item]; actor.status = 'extracted';
    const result = { id: 'ui-result', raidId: 'ui-raid', playerId: profile.id, outcome: 'extracted', map: 'city', seconds: 20, kills: 0, gear: actor.gear, visited: [] };
    const saved = applyResult(pending, result);
    const objective = raidObjectives(saved, actor, 'city', 'ui-raid')[0];
    assert.equal(objective.count, 1); assert.equal(objective.ready, false);
    profile.quests.quest_04 = { accepted: true, claimed: false, progress: 0 };
    actor.status = 'dead'; actor.visited.push('workshop');
    const visit = raidObjectives(profile, actor, 'city', 'ui-raid').find(q => q.id === 'quest_04');
    assert.equal(visit.count, 0); assert.equal(visit.ready, false);
});
test('rendering and positional audio select the same live actor for a dead observer', () => {
    const { profile, world, actor } = fixture();
    const guest = newProfile({ name: 'Напарник', faction: 'USEC', face: 1, outfit: 1 });
    world.addPlayer(guest.id, guest.character, guest.gear);
    assert.equal(viewedActor(world.snapshot(), profile.id).id, profile.id);
    actor.status = 'dead';
    assert.equal(viewedActor(world.snapshot(), profile.id).id, guest.id);
    world.players.get(guest.id).status = 'extracted';
    assert.equal(viewedActor(world.snapshot(), profile.id).id, profile.id);
});
