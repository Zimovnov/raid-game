import type { Appearance } from '../content/apparel.js';

export type Vec3 = [
    number,
    number,
    number
];
export type Color = [
    number,
    number,
    number
];
export type Shape = 'box' | 'cylinder' | 'sphere' | 'cone' | 'wedge' | 'plane';
export type Category = 'weapon' | 'module' | 'ammo' | 'medical' | 'food_drink' | 'hand_tools' | 'building_material' | 'electronics' | 'industrial' | 'valuables' | 'household' | 'documents' | 'factory_special' | 'armor';
export type Faction = 'BEAR' | 'USEC';
export interface Slot {
    id: string;
    name: string;
    accepts: string;
    required?: boolean;
}
export interface Mods {
    recoil?: number;
    ergo?: number;
    reload?: number;
    capacity?: number;
    zoom?: number;
    noise?: number;
    spread?: number;
}
export interface Definition {
    id: string;
    name: string;
    category: Category;
    price: number;
    size: [
        number,
        number
    ];
    weight: number;
    maxStack: number;
    rarity: number;
    shape: string;
    color: Color;
    spawnZones?: string[];
    feed?: 'detachable' | 'tube' | 'internal';
    effect?: 'heal' | 'bandage' | 'energy' | 'splint';
    interface?: string;
    slots?: Slot[];
    platforms?: string[];
    provides?: string[];
    requiresAll?: string[];
    requiresAny?: string[];
    excludes?: string[];
    occupiedPositions?: string[];
    ammo?: string;
    mods?: Mods;
    stats?: WeaponStats;
    equipmentSlot?: 'armor' | 'helmet';
    /** Game damage absorption at full condition; not a real protection rating. */
    protection?: number;
    description: string;
    joke?: string;
}
export interface WeaponStats {
    damage: number;
    rpm: number;
    recoil: number;
    ergo: number;
    reload: number;
    capacity: number;
    zoom: number;
    noise: number;
    spread: number;
    weight: number;
    ads: number;
    auto: boolean;
    pellets: number;
}
export interface Item {
    id: string;
    def: string;
    qty: number;
    condition: number;
    children: Record<string, Item>;
    rounds: number;
    chamber?: number;
    fireMode?: 'single' | 'auto';
    found?: string;
    foundMap?: string;
    rotated?: boolean;
    bound?: boolean;
}
export interface Character {
    name: string;
    faction: Faction;
    face: number;
    outfit: number;
    appearance?: Appearance;
    patches?: import('./patches.js').PatchSelection;
}
export interface Equipment {
    primary: Item | null;
    secondary: Item | null;
    armor: Item | null;
    helmet: Item | null;
    bag: Item[];
    safe: Item[];
}
export interface QuestState {
    accepted: boolean;
    progress: number;
    claimed: boolean;
}
export interface QuestDef {
    id: string;
    name: string;
    map: string;
    kind: 'deliver' | 'extract' | 'visit' | 'test';
    target: string;
    count: number;
    reward: number;
}
export type Outcome = 'extracted' | 'dead' | 'missing' | 'technical';
export interface RaidResult {
    cause?: string;
    id: string;
    raidId: string;
    playerId: string;
    outcome: Outcome;
    map: string;
    seconds: number;
    kills: number;
    gear: Equipment;
    visited: string[];
}
export interface Profile {
    schema: 3;
    id: string;
    revision: number;
    character: Character;
    cash: number;
    stash: Item[];
    inbox: Item[];
    gear: Equipment;
    quests: Record<string, QuestState>;
    presets: {
        name: string;
        def: string;
        tree: BuildPreset;
    }[];
    journal: RaidResult[];
    applied: string[];
    transactions: string[];
    pending: {
        raidId: string;
        stage: 'prepared' | 'active';
        gear: Equipment;
        map: string;
    } | null;
    stats: {
        raids: number;
        extracted: number;
        kills: number;
    };
}
export interface BuildPreset {
    def: string;
    children: Record<string, BuildPreset>;
}
export type SurfaceTexture = 'wood' | 'bark' | 'brick' | 'concrete' | 'soil' | 'asphalt' | 'metal' | 'pine' | 'leaves' | 'grass';
export type CharacterJoint = 'torso' | 'pelvis' | 'head' | 'upperL' | 'upperR' | 'foreL' | 'foreR' | 'thighL' | 'thighR' | 'shinL' | 'shinR' | 'footL' | 'footR';
export type CharacterLayer = 'body' | 'face' | 'jacket' | 'trousers' | 'headwear' | 'gloves' | 'boots';
export type CharacterMaterialRole = 'skin' | 'fabric' | 'trim';
export interface ModelSocketTransform { p: Vec3; s: Vec3; r: Vec3 }
export interface CharacterAssetBinding {
    kind: 'character';
    assetId: string;
    layer: CharacterLayer;
    group: string;
    first: boolean;
    transform: ModelSocketTransform;
    lodOrigin: Vec3;
    skin: Color;
    fabric?: string;
    fabricColor: Color;
}
export interface WeaponAssetBinding {
    kind?: 'weapon';
    weapon: string;
    group: string;
    first: boolean;
    transform?: ModelSocketTransform;
}
export interface Part {
    /** A GLB group with no corresponding legacy geometry; never draw its carrier primitive. */
    assetOnly?: boolean;
    patch?: string;
    surface?: SurfaceTexture;
    asset?: WeaponAssetBinding | CharacterAssetBinding;
    fabric?: string;
    fabricSize?: Vec3;
    legacyOnly?: boolean;
    babylonOnly?: boolean;
    shape: Shape;
    p: Vec3;
    s: Vec3;
    r: Vec3;
    c: Color;
    emissive?: number;
    material?: number;
    slot?: string;
}
export interface Box {
    id: string;
    p: Vec3;
    s: Vec3;
    kind: string;
    color: Color;
    solid: boolean;
    rotation?: Vec3;
}
export interface Surface {
    x: number;
    z: number;
    w: number;
    d: number;
    y: number;
    rise?: number;
}
export interface Door {
    id: string;
    p: Vec3;
    s: Vec3;
    open: boolean;
    axis: 'x' | 'z';
    name: string;
}
export interface LootPoint {
    id: string;
    p: Vec3;
    category: Category;
    name: string;
    loose: boolean;
}
export interface Extraction {
    id: string;
    name: string;
    p: Vec3;
    radius: number;
    seconds: number;
    requires?: string;
}
export interface Activator { id: string; name: string; p: Vec3; key?: string; }
export interface MapDef {
    id: string;
    name: string;
    subtitle: string;
    size: [
        number,
        number
    ];
    theme: string;
    ground: Color;
    fog: Color;
    duration: number;
    boxes: Box[];
    surfaces: Surface[];
    doors: Door[];
    loot: LootPoint[];
    spawn: Vec3[];
    bots: Vec3[];
    exits: Extraction[];
    activators?: Activator[];
    pois: {
        id: string;
        name: string;
        p: Vec3;
    }[];
    signs: {
        text: string;
        p: Vec3;
        yaw: number;
        color?: Color;
    }[];
}
export interface Input {
    seq: number;
    forward: number;
    right: number;
    yaw: number;
    pitch: number;
    sprint: boolean;
    slow?: boolean;
    crouch: boolean;
    jump: boolean;
    fire: boolean;
    aim: boolean;
}
export interface Actor {
    id: string;
    character: Character;
    p: Vec3;
    yaw: number;
    pitch: number;
    hp: number;
    stamina: number;
    bleed: boolean;
    legInjury?: boolean;
    exhausted?: boolean;
    sprinting?: boolean;
    gear: Equipment;
    active: 'primary' | 'secondary';
    status: 'active' | Outcome;
    extraction: number;
    exitId: string;
    reload: number;
    reloadDuration?: number;
    reloadMode?: 'swap' | 'rounds' | 'pack' | 'range' | 'charge';
    reloadGun?: string;
    reloadEmpty?: boolean;
    inspect?: number;
    search?: number;
    searchDuration?: number;
    searchTarget?: string;
    safePosition?: Vec3;
    recoveries?: number;
    reloadTarget?: string;
    use: number;
    useItem: string;
    kills: number;
    visited: string[];
    light: boolean;
    laser: boolean;
    lastShot: number;
    lastInput: number;
    input: Input;
    vy: number;
    grounded: boolean;
    hurtAt: number;
    result?: RaidResult;
}
export type BotMode = 'seekCover' | 'patrol' | 'investigate' | 'alert' | 'attack' | 'reload' | 'search' | 'retreat' | 'dead';
export interface Bot {
    id: string;
    name: string;
    p: Vec3;
    yaw: number;
    hp: number;
    mode: BotMode;
    weapon: Item;
    supplies: Item[];
    timer: number;
    target: string;
    goal: Vec3;
    path: Vec3[];
    lastSeen: Vec3;
    memory: number;
    nextThink: number;
    voiceAt: number;
    shotAt: number;
    style: number;
}
export interface Container {
    id: string;
    source?: 'world' | 'player';
    name: string;
    p: Vec3;
    items: Item[];
    revision: number;
    loose: boolean;
    searchedBy?: string[];
}
export interface WorldEvent {
    seq: number;
    type: 'shot' | 'hit' | 'voice' | 'door' | 'loot' | 'death' | 'use' | 'mechanic';
    p: Vec3;
    to?: Vec3;
    actor?: string;
    text?: string;
    def?: string;
    suppressed?: boolean;
    hit?: boolean;
}
export interface Snapshot {
    raidId: string;
    tick: number;
    time: number;
    mapId: string;
    players: Actor[];
    bots: Bot[];
    containers: Container[];
    doors: Record<string, boolean>;
    events: WorldEvent[];
    friendlyFire: boolean;
    activated?: string[];
}
export type Action = {
    id: string;
    type: 'reload' | 'load-mag' | 'interact' | 'take' | 'use' | 'switch' | 'light' | 'laser' | 'abandon' | 'drop' | 'fire-mode' | 'inspect' | 'cancel';
    target?: string;
    item?: string;
    revision?: number;
};
export interface ActionReply {
    id: string;
    ok: boolean;
    message?: string;
    container?: string;
}
export interface LobbyMember {
    id: string;
    character: Character;
    ready: boolean;
    loaded: boolean;
    gear: Equipment;
    connected: boolean;
}
export interface Lobby {
    members: LobbyMember[];
    mapId: string;
    friendlyFire: boolean;
    stage: 'lobby' | 'loading' | 'raid';
    raidId: string;
    hostId: string;
    capacity?: number;
}
export interface Settings {
    sensitivity: number;
    fov: number;
    volume: number;
    effects: number;
    voices: boolean;
    bob: boolean;
    quality: 'low' | 'high';
    bindings: Record<string, string>;
}
