import type { Input, Settings } from '../domain/types.js';
import { clamp } from '../domain/util.js';

const movementActions = new Set(['forward', 'back', 'left', 'right', 'sprint', 'slow', 'crouch', 'jump']);

export class Controls {
    yaw = 0;
    pitch = 0;
    fire = false;
    aim = false;
    private active = false;
    private keys = new Set<string>();
    private sequence = 0;
    private events = new AbortController();
    private lockPending = false;

    constructor(readonly canvas: HTMLCanvasElement, readonly settings: () => Settings, readonly command: (action: string) => void, readonly unlocked: () => void) {
        const o = { signal: this.events.signal };
        window.addEventListener('keydown', e => {
            if (!this.enabled || e.repeat || e.defaultPrevented) return;
            if (e.code === 'Escape') {
                this.clear();
                return;
            }
            const target = e.target as HTMLElement | null;
            if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')) return;
            const action = Object.entries(this.settings().bindings).find(([, key]) => key === e.code)?.[0];
            if (!action) return;
            if (movementActions.has(action)) {
                if (!this.locked) return;
                e.preventDefault();
                this.keys.add(e.code);
            } else {
                e.preventDefault();
                this.command(action);
            }
        }, o);
        window.addEventListener('keyup', e => this.keys.delete(e.code), o);
        document.addEventListener('mousemove', e => {
            if (this.enabled && this.locked) {
                this.yaw -= e.movementX * this.settings().sensitivity;
                this.pitch = clamp(this.pitch - e.movementY * this.settings().sensitivity, -1.48, 1.48);
            }
        }, o);
        window.addEventListener('mousedown', e => {
            if (this.enabled && this.locked) {
                if (e.button === 0) this.fire = true;
                if (e.button === 2) this.aim = true;
            }
        }, o);
        window.addEventListener('mouseup', e => {
            if (e.button === 0) this.fire = false;
            if (e.button === 2) this.aim = false;
        }, o);
        window.addEventListener('blur', () => this.clear(), o);
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); }, o);
        document.addEventListener('pointerlockchange', () => {
            this.lockPending = false;
            if (!this.locked) {
                this.clear();
                if (this.enabled) this.unlocked();
            }
        }, o);
        document.addEventListener('pointerlockerror', () => this.lockFailed(), o);
        canvas.addEventListener('contextmenu', e => e.preventDefault(), o);
    }
    get enabled() { return this.active; }
    set enabled(value: boolean) {
        this.active = value;
        if (!value) this.clear();
    }
    get locked() { return document.pointerLockElement === this.canvas; }
    private lockFailed() {
        if (!this.lockPending) return;
        this.lockPending = false;
        this.clear();
        if (this.enabled && !this.events.signal.aborted) this.unlocked();
    }
    lock() {
        if (!this.enabled || this.events.signal.aborted) return;
        this.clear();
        this.lockPending = true;
        try {
            const request = this.canvas.requestPointerLock();
            if (request && typeof request.catch === 'function') request.catch(() => this.lockFailed());
        } catch {
            this.lockFailed();
        }
    }
    unlock() {
        this.lockPending = false;
        this.clear();
        if (this.locked) document.exitPointerLock();
    }
    clear() { this.keys.clear(); this.fire = false; this.aim = false; }
    syncSequence(serverSequence: number) {
        if (Number.isSafeInteger(serverSequence) && serverSequence > this.sequence)
            this.sequence = serverSequence;
    }
    input(): Input {
        const active = this.enabled && this.locked;
        const held = (name: string) => active && this.keys.has(this.settings().bindings[name]);
        return { seq: ++this.sequence, forward: Number(held('forward')) - Number(held('back')), right: Number(held('right')) - Number(held('left')), yaw: this.yaw, pitch: this.pitch, sprint: held('sprint'), slow: held('slow'), crouch: held('crouch'), jump: held('jump'), fire: active && this.fire, aim: active && this.aim };
    }
    dispose() { this.enabled = false; this.events.abort(); this.unlock(); }
}
