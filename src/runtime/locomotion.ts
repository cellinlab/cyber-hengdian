import type { Key } from '../core/schema';

// A blocking-preview gait, not foot IK. Sample only the current translation
// interval so held keys and time outside the track really return to rest.
export function walkSwing(keys: Key[], time: number): number {
  let travelled = 0;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    const distance = Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]);
    const duration = b.time - a.time;
    if (duration <= 0) continue;
    if (time >= a.time && time < b.time) {
      if (distance < 0.0001) return 0;
      const progress = (time - a.time) / duration;
      const fade = Math.min(1, (time - a.time) / 0.15, (b.time - time) / 0.15);
      const speed = Math.min(1, distance / duration);
      return Math.sin((travelled + distance * progress) * 8) * 0.35 * fade * speed;
    }
    travelled += distance;
  }
  return 0;
}
