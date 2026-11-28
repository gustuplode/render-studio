// V2 light story: day throughout, except the BUILD beat ("That night, in his workshop…",
// old frames 820-1040) where the kit grocery set's own night mood dims in and out.
import type {Tod} from '../../engine/look/look';
export const TOD: [number, Tod][] = [[0, 'day']];
export const INTERIOR = {shots: [] as string[], centre: [0, 0] as [number, number], pool: [0, 0, 0] as [number, number, number],
  lamp: [0, 2.3, 0] as [number, number, number], lampPt: [0, 2.25, 0] as [number, number, number], cool: [0, 2.2, 0] as [number, number, number], warm: [0, 2.7, 0] as [number, number, number]};
/** night mood 0..1 (0 = none) — ramps in/out around the build shot so the cut is not a light pop */
export const MOOD = (f: number) => {
  if (f < 812 || f > 1048) return 0;
  const inn = Math.min(1, (f - 812) / 30), out = Math.min(1, (1048 - f) / 30);
  return 0.8 * Math.min(inn, out);
};
