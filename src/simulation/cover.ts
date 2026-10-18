import type { Vec3 } from '../domain/types.js';
import { distXZ } from '../domain/util.js';
import type { Collision, Navigation } from './collision.js';
/** Cover is accepted only when a wall blocks the threat and the navigation route exists. */
export function findCover(collision: Collision, navigation: Navigation, origin: Vec3, threat: Vec3): { goal: Vec3; path: Vec3[] } | null {
    const eye: Vec3 = [threat[0], threat[1] + 1.5, threat[2]];
    const candidates = [...navigation.nodes.values()].filter(n => {
        const travel = distXZ(origin, n.p);
        return travel >= 1.5 && travel <= 9 && Math.abs(n.p[1] - origin[1]) < .5
            && collision.free(n.p) && !collision.visible(eye, [n.p[0], n.p[1] + 1.5, n.p[2]]);
    }).sort((a, b) => distXZ(origin, a.p) - distXZ(origin, b.p));
    // Small finite budget: no ray-to-every-node per frame and no teleport fallback.
    for (const n of candidates.slice(0, 12)) {
        const path = navigation.path(origin, n.p);
        if (path.length && distXZ(path[path.length - 1], n.p) < .5) return { goal: [...n.p], path };
    }
    return null;
}
