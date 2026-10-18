import type { Equipment, Item, Profile } from './types.js';
import { CATALOG } from '../content/catalog.js';
import { validateProfile } from './profile.js';
import { check, clone, safeRecord } from './util.js';

/** Schema 1: rounds on gun; 2: detachable rounds on mag; 3: distinct chamber.
 * Old saves receive an EMPTY chamber, never a free extra cartridge. Store backs up atomically. */
export function migrateProfile(raw: unknown): { profile: Profile; changed: boolean } {
    check(safeRecord(raw) && typeof raw.schema === 'number' && [1, 2, 3].includes(raw.schema), 'Неизвестная версия сохранения');
    check(Number.isSafeInteger(raw.revision) && Number(raw.revision) >= 0, 'Повреждённая ревизия сохранения');
    if (raw.schema === 3) { validateProfile(raw); return { profile: raw, changed: false }; }
    const version = raw.schema, p = clone(raw) as unknown as Profile;
    let nodes = 0;
    function item(i: Item, depth = 0): void {
        check(depth <= 8 && ++nodes < 12000 && safeRecord(i) && safeRecord(i.children), 'Повреждённое дерево старого сохранения');
        check(Number.isInteger(i.rounds) && i.rounds >= 0 && i.rounds <= 90, 'Повреждённый боекомплект старого сохранения');
        const d = CATALOG[i.def]; check(d, 'Неизвестный предмет в старом сохранении');
        if (d.category === 'weapon') {
            check(i.chamber === undefined || i.chamber === 0, 'Старая схема не должна содержать заряженный патронник');
            i.chamber = 0;
            if (version === 1 && d.feed === 'detachable') {
                check(i.children.magazine && i.children.magazine.rounds === 0, 'Неоднозначное содержимое старого магазина');
                i.children.magazine.rounds = i.rounds; i.rounds = 0;
            }
        }
        for (const c of Object.values(i.children)) item(c, depth + 1);
    }
    function gear(g: Equipment): void {
        check(safeRecord(g) && Array.isArray(g.bag) && Array.isArray(g.safe), 'Повреждена экипировка');
        for (const i of [g.primary, g.secondary, g.armor, g.helmet, ...g.bag, ...g.safe]) if (i) item(i);
    }
    check(Array.isArray(p.stash) && Array.isArray(p.inbox) && Array.isArray(p.journal), 'Повреждён профиль');
    for (const i of [...p.stash, ...p.inbox]) item(i);
    gear(p.gear); if (p.pending) gear(p.pending.gear);
    for (const result of p.journal) gear(result.gear);
    p.schema = 3; p.revision++;
    validateProfile(p); return { profile: p, changed: true };
}
