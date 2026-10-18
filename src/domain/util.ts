import type { Actor, Color, Snapshot, Vec3 } from './types.js';
/** One observer target for rendering, HUD and positional sound. */
export function viewedActor(snapshot: Snapshot, localId: string): Actor | undefined {
    const own = snapshot.players.find(actor => actor.id === localId);
    return own && (own.status === 'dead' || own.status === 'missing') ? snapshot.players.find(actor => actor.status === 'active') || own : own;
}
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const uid = (): string => { if (crypto.randomUUID)
    return crypto.randomUUID(); return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(n => n.toString(16).padStart(2, '0')).join(''); };
export const clone = <T>(v: T): T => structuredClone(v);
export const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(...a) || 1));
export const direction = (yaw: number, pitch = 0): Vec3 => [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
export const rgb = (value: number | string): Color => { const hex = typeof value === 'string' ? parseInt(value.replace('#', ''), 16) : value; return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255]; };
export const money = (n: number) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
export function rng(seed: number): () => number { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
export function cleanName(value: string): string { const s = value.normalize('NFKC').trim(); if (!/^[\p{L}\p{N} _.-]{2,24}$/u.test(s))
    throw Error('Позывной: 2–24 буквы, цифры, пробел, точка, дефис.'); return s; }
export const safeRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export function check(condition: unknown, message: string): asserts condition { if (!condition)
    throw Error(message); }
export const noInput = () => ({ seq: 0, forward: 0, right: 0, yaw: 0, pitch: 0, sprint: false, slow: false, crouch: false, jump: false, fire: false, aim: false });
