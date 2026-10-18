import { CATALOG } from '../content/catalog.js';
export interface SoundProfile { frequency: number; duration: number; gain: number; tone: number }
/** Original synthesizer families, not recordings or specifications of real firearms. */
export function weaponSound(definitionId: string, suppressed = false): SoundProfile {
    const d = CATALOG[definitionId];
    if (suppressed) return { frequency: 850, duration: .11, gain: .11, tone: 100 };
    if (d?.stats && d.stats.pellets > 1) return { frequency: 1350, duration: .42, gain: .34, tone: 85 };
    if (d?.ammo === '7.62x54R' || d?.ammo === '7.62x51') return { frequency: 1400, duration: .36, gain: .29, tone: 95 };
    if (d?.stats?.auto && ['9x18', '9x19'].includes(d.ammo || '')) return { frequency: 3200, duration: .15, gain: .21, tone: 160 };
    if (['pm', 'tt', 'glock', 'grach', 'm9a3', 'm17'].includes(d?.shape || '')) return { frequency: 2300, duration: .17, gain: .22, tone: 220 };
    return { frequency: 1800, duration: .22, gain: .23, tone: 130 };
}
