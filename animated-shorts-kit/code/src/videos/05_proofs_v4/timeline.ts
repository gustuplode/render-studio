// V4 PROOFS timeline: 4 still setups x 40 frames. No words (proof frames only, no captions).
export const FPS = 30;
export const OLD_TOTAL = 160;
export const WORDS: [string, number, number][] = [];
export const CAPS: [number, number][] = [];
export const SHOT_START: Record<string, number> = {hside: 0, hfront: 40, car34: 80, both: 120};
export const SHOT_REAL: Record<string, number> = {hside: 0, hfront: 40 / 30, car34: 80 / 30, both: 120 / 30};
export const WORDS_REAL = WORDS;
export const END_REAL = 160 / 30;
export const VOICE_END = 160 / 30;
export const WARP: [number, number][] = [[0, 0], [160 / 30, 160 / 30]];
export const warp = (t: number) => t;
