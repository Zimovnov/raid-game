import { scavLoadout } from '../dist/src/content/scav-loadouts.js';
import { loadedRounds as botRounds, setLoadedRounds as botSetRounds } from '../dist/src/domain/ammunition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../dist/src/simulation/world.js';
import { MAPS } from '../dist/src/content/maps.js';
import { newProfile } from '../dist/src/domain/profile.js';
import { createItem } from '../dist/src/domain/items.js';

const character = { name: 'Проверка экипировки', faction: 'BEAR', face: 0, outfit: 0 };
const fixture = () => ({ ...MAPS.range, id: 'v05-regression', boxes: [], surfaces: [], doors: [], loot: [], bots: [], exits: [], pois: [], signs: [], spawn: [[0, 0, 0]] });

test('visiting a POI requires reaching its floor, including the new upstairs clothing shop', () => {
    for (const [mapId, poiId] of [['mall', 'clothing'], ['factory', 'office']]) {
        const original = MAPS[mapId], poi = original.pois.find(p => p.id === poiId);
        assert(poi && poi.p[1] >= 3, 'fixture must represent a real upstairs destination');
        const map = { ...fixture(), pois: [poi], surfaces: [{ x: poi.p[0], z: poi.p[2], w: 4, d: 4, y: poi.p[1] }] };
        const profile = newProfile(character), world = new World(map, 'floor-' + poiId, false, 23, true);
        const a = world.addPlayer(profile.id, profile.character, profile.gear);
        a.p = [poi.p[0], 0, poi.p[2]]; a.safePosition = [...a.p];
        world.step(1 / 30);
        assert.equal(a.visited.includes(poi.id), false, 'ground-floor shortcut must not award upstairs quest progress');
        a.p = [...poi.p]; a.safePosition = [...a.p]; a.vy = 0;
        world.step(1 / 30);
        assert.equal(a.visited.includes(poi.id), true, 'standing on the actual destination floor must register it');
        world.step(1 / 30);
        assert.equal(a.visited.filter(id => id === poi.id).length, 1);
    }
});

test('a real bot shot damages the nearest struck armor slot instead of always the vest', () => {
    for (const head of [false, true]) {
        const profile = newProfile(character);
        profile.gear.armor = createItem('armor_6b45'); profile.gear.helmet = createItem('helmet_6b47');
        const world = new World(fixture(), 'bot-hit-' + head, false, 25, true);
        const a = world.addPlayer(profile.id, profile.character, profile.gear);
        const bot = { id: 'bot-test', name: 'Контроль', p: [0, 0, 8], yaw: 0, hp: 75, mode: 'attack', ...scavLoadout(0), timer: 0, target: a.id, goal: [...a.p], path: [], lastSeen: [...a.p], memory: 5, nextThink: 100, voiceAt: 100, shotAt: -1, style: 0 };
        botSetRounds(bot.weapon,18);
        // Controlled RNG aims the actual, unobstructed ray at torso or upper head.
        // Calls: burst size, next-shot timing, aim X, aim Y, aim Z, damage, bleed.
        const values = [.5, .5, .5, head ? .99 : .5, .5, .5, .5];
        world.random = () => values.length ? values.shift() : .5;
        world.stepBot(bot, 1 / 30);
        assert.equal(botRounds(bot.weapon), 17); assert(a.hp < 100);
        assert.equal(world.events.find(e => e.type === 'shot')?.hit, true);
        assert(a.gear[head ? 'helmet' : 'armor'].condition < 100, 'hit slot must absorb and wear');
        assert.equal(a.gear[head ? 'armor' : 'helmet'].condition, 100, 'other slot must remain untouched');
    }
});
