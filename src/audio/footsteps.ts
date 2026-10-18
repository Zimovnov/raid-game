import type { Vec3 } from '../domain/types.js';

export interface StepCue { gain: number; tone: number; }
/** Distance-based stride clock. Rendering the same snapshot again cannot produce footsteps. */
export class FootstepTracker {
    private actor = '';
    private position: Vec3 | null = null;
    private distance = 0;
    private side = false;
    reset() { this.actor = ''; this.position = null; this.distance = 0; this.side = false; }
    update(actor: string, position: Vec3, grounded: boolean, sprint: boolean, slow: boolean, crouch: boolean): StepCue | null {
        if (!position.every(Number.isFinite)) { this.reset(); return null; }
        const previous = this.position;
        this.position = [...position];
        if (!previous || actor !== this.actor) {
            this.actor = actor;
            this.distance = 0;
            return null;
        }
        const traveled = Math.hypot(position[0] - previous[0], position[2] - previous[2]);
        // Long corrections/new spawn positions and vertical flight are not strides.
        if (!grounded || traveled > 2 || Math.abs(position[1] - previous[1]) > 1) {
            this.distance = 0;
            return null;
        }
        if (traveled < .0001) return null;
        const quiet = slow || crouch;
        const stride = quiet ? .9 : sprint ? 1.7 : 1.45;
        this.distance += traveled;
        if (this.distance < stride) return null;
        this.distance %= stride;
        this.side = !this.side;
        return { gain: quiet ? .014 : sprint ? .065 : .04, tone: this.side ? 1.07 : .94 };
    }
}
