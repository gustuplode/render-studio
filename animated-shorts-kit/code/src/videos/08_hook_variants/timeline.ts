// HOOK VARIANTS A-D — line 1 only: "He added one word to the road, and stopped every car at once."
// Real N1 timings (voice_v4/timings.json): lead 0.40 s, line 1 = 0.40-3.568 s, 13 words.
// Every variant is exactly 5.000 s = 150 frames @30 fps. Captions = line-1 groups only.
// A/B/C run on a single shot 'hook'. D runs on four shots (d1-d4, snap cuts) with a 6-frame
// picture freeze on the word "stopped" (real frames 64-69): warp() holds the staging frame
// at 64 while the camera key holds still, then resumes 5 frames behind — the last 6 staging
// frames are never reached, the clip still ends exactly at real frame 150.
import {VARIANT} from './variant';
export const FPS = 30;
export const OLD_TOTAL = 150;
export const WORDS: [string, number, number][] = [["He", 0.4, 0.535], ["added", 0.535, 0.872], ["one", 0.872, 1.074], ["word", 1.074, 1.344], ["to", 1.344, 1.478], ["the", 1.478, 1.681], ["road,", 1.681, 1.95], ["and", 1.95, 2.153], ["stopped", 2.153, 2.624], ["every", 2.624, 2.961], ["car", 2.961, 3.164], ["at", 3.164, 3.298], ["once.", 3.298, 3.568]];
export const CAPS: [number, number][] = [[0, 2], [3, 5], [6, 8], [9, 11], [12, 12]];
// D shot boundaries are OLD frames; their REAL starts are 5 frames later from d3 on (the freeze
// steals 5 frames of staging time — d3's staging starts at old 70 = real 75, d4's at old 94 = real 99).
export const SHOT_START: Record<string, number> = VARIANT === 'D'
  ? {"d1": 0, "d2": 58, "d3": 70, "d4": 94}
  : {"hook": 0};
export const SHOT_REAL: Record<string, number> = VARIANT === 'D'
  ? {"d1": 0.0, "d2": 58 / 30, "d3": 75 / 30, "d4": 99 / 30}
  : {"hook": 0.0};
export const WORDS_REAL = WORDS;
export const END_REAL = 5.0;
export const VOICE_END = 5.0;
// WARP pairs are [real, old] (see clock.realOf). D's flat segment [64/30, 70/30) -> old 64/30
// is the freeze; after it the staging resumes 5 frames behind real time.
export const WARP: [number, number][] = VARIANT === 'D'
  ? [[0, 0], [64 / 30, 64 / 30], [70 / 30, 64 / 30], [5, 145 / 30]]
  : [[0, 0], [5, 5]];
export const warp = (t: number) => {
  if (VARIANT !== 'D') return t;
  if (t < 64 / 30) return t;
  if (t < 70 / 30) return 64 / 30;
  return t - 5 / 30;
};
