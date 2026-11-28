// TEMPLATE timeline (placeholder words). For a real video this file is GENERATED:
//   python3 src/engine/tools/timeline.py script.txt words.json ../../../public/<id>/voice.wav timeline.ts
export const FPS = 30;
export const OLD_TOTAL = 150;
export const WORDS: [string, number, number][] = [['This', 0.2, 0.5], ['is', 0.5, 0.7], ['a', 0.7, 0.8], ['test.', 0.8, 1.3], ['Watch', 2.6, 3.0], ['him', 3.0, 3.2], ['wave.', 3.2, 3.8]];
export const CAPS: [number, number][] = [[0, 3], [4, 6]];
export const SHOT_START: Record<string, number> = {intro: 0, wave: 75};
export const SHOT_REAL: Record<string, number> = {intro: 0, wave: 2.5};
export const WORDS_REAL = WORDS;
export const END_REAL = 5.0;
export const VOICE_END = 5.0;
export const WARP: [number, number][] = [[0, 0], [5, 5]];
export const warp = (t: number) => t;
