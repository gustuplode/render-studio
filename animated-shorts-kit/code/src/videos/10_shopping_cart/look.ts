// Shopping Cart light story: day throughout, except the NIGHT beats (lines 7-11: night1,
// night2, build1, build2, build3 — old frames 696-1147) where the kit grocery set's own
// night mood dims in and out so the cuts are not light pops. Launch (old 1148) is morning.
import type {Tod} from '../../engine/look/look';
export const TOD: [number, Tod][] = [[0, 'day']];
export const INTERIOR = {shots: [] as string[], centre: [0, 0] as [number, number], pool: [0, 0, 0] as [number, number, number],
  lamp: [0, 2.3, 0] as [number, number, number], lampPt: [0, 2.25, 0] as [number, number, number], cool: [0, 2.2, 0] as [number, number, number], warm: [0, 2.7, 0] as [number, number, number]};
/** night mood 0..1 (0 = none) — ramps in before night1, out across the launch boundary */
export const MOOD = (f: number) => {
  if (f < 671 || f > 1153) return 0;
  const inn = Math.min(1, (f - 671) / 60), out = Math.min(1, (1153 - f) / 40);
  return 0.8 * Math.min(inn, out);
};
