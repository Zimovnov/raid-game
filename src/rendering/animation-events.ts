export interface VisualAnimationEvent { name: string; seconds: number; normalized: number }

/** Crossed intervals, not frame equality: deterministic at low FPS and on retries.
 * A new playback token distinguishes restarts from repeated render evaluations.
 * These events must never mutate authoritative ammunition or inventory.
 */
export class AnimationEventCursor {
    private playback = '';
    private previous = -Number.EPSILON;
    advance(playback: string, seconds: number, events: readonly VisualAnimationEvent[]): VisualAnimationEvent[] {
        if (playback !== this.playback || seconds < this.previous) {
            this.playback = playback;
            this.previous = -Number.EPSILON;
        }
        const crossed = events.filter(event => event.seconds > this.previous && event.seconds <= seconds);
        this.previous = seconds;
        return crossed;
    }
    reset() { this.playback = ''; this.previous = -Number.EPSILON; }
}
