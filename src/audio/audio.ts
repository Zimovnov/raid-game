import { weaponSound } from './weapon-sound.js';
import { FootstepTracker } from './footsteps.js';
import type { Settings, Vec3, WorldEvent } from '../domain/types.js';
import { dist, clamp } from '../domain/util.js';
import type { Collision } from '../simulation/collision.js';

/** Original procedural effects. Speech synthesis is optional and non-spatial. */
export class AudioEngine {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private noise: AudioBuffer | null = null;
    private activeSounds = new Set<() => void>();
    private voiceAt = 0;
    private steps = new FootstepTracker();
    private closed = false;
    constructor(private settings: () => Settings) { }
    async unlock() {
        if (this.closed) return;
        if (!this.ctx) {
            this.ctx = new AudioContext();
            this.master = this.ctx.createGain();
            // Set the level before connecting; do not begin a session at the default gain of 1.
            this.master.gain.value = this.settings().volume;
            this.master.connect(this.ctx.destination);
            this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
            const data = this.noise.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.volume();
    }
    volume() {
        if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.settings().volume, this.ctx.currentTime, .05);
    }
    listener(p: Vec3, yaw: number, pitch: number) {
        if (!this.ctx) return;
        const listener = this.ctx.listener, time = this.ctx.currentTime;
        const up: Vec3 = [Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
        for (const [parameter, value] of [[listener.positionX, p[0]], [listener.positionY, p[1]], [listener.positionZ, p[2]], [listener.forwardX, -Math.sin(yaw) * Math.cos(pitch)], [listener.forwardY, Math.sin(pitch)], [listener.forwardZ, -Math.cos(yaw) * Math.cos(pitch)], [listener.upX, up[0]], [listener.upY, up[1]], [listener.upZ, up[2]]] as const) parameter.setValueAtTime(value, time);
    }
    private burst(frequency: number, duration: number, gain: number, p?: Vec3, tone = 0) {
        const context = this.ctx;
        if (!context || context.state !== 'running' || !this.noise || !this.master || this.activeSounds.size >= 28 || this.settings().effects <= 0 || this.settings().volume <= 0) return;
        const time = context.currentTime, envelope = context.createGain(), filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = frequency;
        envelope.gain.setValueAtTime(.0001, time);
        envelope.gain.exponentialRampToValueAtTime(Math.max(.001, gain * this.settings().effects), time + .004);
        envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
        filter.connect(envelope);
        let pan: PannerNode | undefined;
        if (p) {
            pan = context.createPanner();
            pan.panningModel = 'HRTF';
            pan.distanceModel = 'inverse';
            pan.refDistance = 2;
            pan.maxDistance = 100;
            pan.rolloffFactor = .75;
            pan.positionX.value = p[0];
            pan.positionY.value = p[1];
            pan.positionZ.value = p[2];
            envelope.connect(pan);
            pan.connect(this.master);
        } else envelope.connect(this.master);
        const source = context.createBufferSource();
        source.buffer = this.noise;
        source.playbackRate.value = .9 + Math.random() * .2;
        source.connect(filter);
        let oscillator: OscillatorNode | undefined, toneGain: GainNode | undefined, finished = false;
        const cleanup = () => {
            if (finished) return;
            finished = true;
            source.onended = null;
            // stop() may race with natural completion or a closing AudioContext.
            try { source.stop(); } catch { /* Already ended. */ }
            try { oscillator?.stop(); } catch { /* Already ended. */ }
            source.disconnect();
            oscillator?.disconnect();
            toneGain?.disconnect();
            filter.disconnect();
            envelope.disconnect();
            pan?.disconnect();
            this.activeSounds.delete(cleanup);
        };
        this.activeSounds.add(cleanup);
        source.onended = cleanup;
        if (tone) {
            oscillator = context.createOscillator();
            toneGain = context.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(tone, time);
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, tone * .4), time + duration);
            toneGain.gain.setValueAtTime(gain * .32, time);
            toneGain.gain.exponentialRampToValueAtTime(.0001, time + duration);
            oscillator.connect(toneGain);
            toneGain.connect(filter);
            oscillator.start(time);
            oscillator.stop(time + duration);
        }
        source.start(time, Math.random() * .4, duration);
    }
    event(event: WorldEvent, ear: Vec3, collision: Collision | null) {
        const distance = dist(event.p, ear);
        if (distance > 100) return;
        const blocked = collision ? !collision.visible(ear, event.p) : false;
        const attenuation = blocked ? .32 : 1;
        if (event.type === 'shot') {
            const sound = weaponSound(event.def || '', event.suppressed);
            this.burst(blocked ? 550 : sound.frequency, sound.duration, sound.gain * attenuation, event.p, sound.tone);
        }
        if (event.type === 'mechanic') {
            if (event.text === 'land' || event.text === 'land-hard') {
                this.burst(blocked ? 350 : 700, .16, (event.text === 'land-hard' ? .15 : .07) * attenuation, event.p, 65);
            } else if (event.text === 'leg-injury') {
                this.burst(600, .14, .08 * attenuation, event.p, 95);
            } else this.burst(blocked ? 700 : 1800, .09, .055 * attenuation, event.p, event.text === 'exit-unlocked' ? 440 : 240);
        }
        if (event.type === 'door') this.burst(blocked ? 450 : 900, .18, .13 * attenuation, event.p, 110);
        if (event.type === 'loot' || event.type === 'use') this.burst(blocked ? 500 : 1100, .10, .05 * attenuation, event.p);
        if (event.type === 'hit' && distance < 8) this.burst(blocked ? 550 : 1500, .06, .08 * attenuation, event.p, 270);
        if (event.type === 'voice' && distance < 27 && this.settings().voices && event.text && Date.now() - this.voiceAt > 7500 && 'speechSynthesis' in window) {
            const voices = speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('ru'));
            if (!voices.length || speechSynthesis.speaking) return;
            const line = new SpeechSynthesisUtterance(event.text);
            line.voice = voices[0];
            line.lang = 'ru-RU';
            line.volume = clamp(.45 * (1 - distance / 35) * this.settings().volume * attenuation, 0, 1);
            line.rate = .97;
            this.voiceAt = Date.now();
            speechSynthesis.speak(line);
        }
    }
    motion(actorId: string, position: Vec3, grounded: boolean, sprint: boolean, slow: boolean, crouch: boolean, map: string) {
        const cue = this.steps.update(actorId, position, grounded, sprint, slow, crouch);
        if (!cue) return;
        this.burst(map === 'park' || map === 'village' ? 650 : map === 'mall' ? 1300 : 900, .07, cue.gain, undefined, (map === 'mall' ? 170 : 65) * cue.tone);
    }
    click() { this.burst(1400, .035, .025); }
    reload() { this.burst(2600, .10, .07, undefined, 340); }
    reset() {
        for (const cleanup of [...this.activeSounds]) cleanup();
        this.steps.reset();
        this.voiceAt = 0;
        if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
    dispose() {
        this.closed = true;
        this.reset();
        this.master?.disconnect();
        this.ctx?.close().catch(() => { });
        this.ctx = null;
        this.master = null;
        this.noise = null;
    }
}
