import { safeRecord } from './util.js';

export const PATCH_SLOTS = ['leftShoulder', 'rightShoulder'] as const;
export type PatchSlot = typeof PATCH_SLOTS[number];
export type PatchSelection = Partial<Record<PatchSlot, string>>;
export interface PatchInfo { id: string; bytes: number; createdAt: number }
export const PATCH_LIMIT = 20;
export const PATCH_INPUT_BYTES = 2 * 1024 * 1024;
export const PATCH_OUTPUT_BYTES = 300 * 1024;
export const PATCH_PIXELS = 16 * 1024 * 1024;
export const isPatchId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function isPatchSelection(value: unknown): value is PatchSelection {
    if (!safeRecord(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    return Object.keys(value).every(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return PATCH_SLOTS.includes(key as PatchSlot) && !!descriptor && 'value' in descriptor && isPatchId(descriptor.value);
    });
}

export function selectedPatches(value?: PatchSelection): string[] {
    return isPatchSelection(value) ? [...new Set(PATCH_SLOTS.flatMap(slot => value[slot] ? [value[slot]!] : []))] : [];
}
