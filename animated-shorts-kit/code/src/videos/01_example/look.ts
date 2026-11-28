// TEMPLATE light story: [start seconds, 'day' | 'golden' | 'workshop'] and an optional practical-lit interior.
import type {Tod} from '../../engine/look/look';
export const TOD: [number, Tod][] = [[0, 'day']];
export const INTERIOR = {shots: [] as string[], centre: [0, 0] as [number, number], pool: [0, 0, 0] as [number, number, number],
  lamp: [0, 2.3, 0] as [number, number, number], lampPt: [0, 2.25, 0] as [number, number, number], cool: [0, 2.2, 0] as [number, number, number], warm: [0, 2.7, 0] as [number, number, number]};
/** night mood 0..1 (0 = none) */
export const MOOD = (_f: number) => 0;
