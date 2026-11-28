// ENGINE core/clock: time helpers shared by every video. Story timing comes from '@story/timeline'
// (generated from the real voice: WORDS, CAPS, SHOT_START, OLD_TOTAL, SHOT_REAL, WORDS_REAL, END_REAL, VOICE_END, WARP, warp).
import * as THREE from 'three';
import {SHOT_START, OLD_TOTAL, SHOT_REAL, WORDS_REAL, END_REAL, VOICE_END, WARP, warp} from '@story/timeline';
export const FPS = 30;
export const TOTAL = Math.ceil(VOICE_END * 30);

// ---------- math ----------
export const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ease = (t: number) => { t = cl(t); return t * t * (3 - 2 * t); };
export const sm01 = ease;
export const pop = (t: number) => { t = cl(t); return t < 1 ? 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2) : 1; }; // overshoot 0->1
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export type V3 = [number, number, number];
export const lerp3 = (a: V3, b: V3, t: number) => V(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

// ---------- staging clock (old frames) ----------
export const SH = Object.entries(SHOT_START).sort((a, b) => a[1] - b[1]);
export const shotAt = (f: number) => { let i = 0; while (i + 1 < SH.length && SH[i + 1][1] <= f) i++; const a = SH[i][1], b = i + 1 < SH.length ? SH[i + 1][1] : OLD_TOTAL; return {name: SH[i][0], lf: f - a, len: b - a, t: (f - a) / (b - a)}; };
export const S = (n: string) => SHOT_START[n];
/** local frame (in shot `shot`) at which `word` starts */
export const W = (shot: string, word: string) => { const a = SHOT_REAL[shot]; const w = WORDS_REAL.find((q) => q[1] >= a - 0.01 && norm(q[0]) === norm(word)); if (!w) throw new Error('word ' + word); return Math.round((w[1] - a) * 30); };

// ---------- real clock (voice seconds) ----------
export const oldF = (rt: number) => warp(rt) * 30;
/** old-timeline seconds -> real seconds (inverse of warp) */
export const realOf = (os: number) => {
  const A = WARP; if (os <= 0) return 0;
  for (let i = 1; i < A.length; i++) if (os <= A[i][1]) { const [a0, b0] = A[i - 1], [a1, b1] = A[i]; return a0 + (a1 - a0) * (os - b0) / Math.max(1e-6, b1 - b0); }
  return A[A.length - 1][0] + (os - A[A.length - 1][1]);
};
/** real-time span [first, last frame] (seconds) during which the STAGING shows each shot */
let SPAN: Record<string, [number, number]> | null = null;
export const span = (n: string) => { if (!SPAN) { SPAN = {}; for (let i = 0; i < TOTAL; i++) { const k = shotAt(oldF(i / 30)).name; if (!SPAN[k]) SPAN[k] = [i / 30, i / 30]; SPAN[k][1] = i / 30; } } return SPAN[n]; };
const SHOTS = Object.entries(SHOT_REAL).sort((a, b) => a[1] - b[1]);
export const shotEndReal = (n: string) => { const i = SHOTS.findIndex((s) => s[0] === n); return i + 1 < SHOTS.length ? SHOTS[i + 1][1] : END_REAL; };
/** real start time of the n-th occurrence of `word` inside shot `shot` */
export const T = (shot: string, word: string, n = 1) => {
  const a = SHOT_REAL[shot], b = shotEndReal(shot); let k = 0;
  for (const w of WORDS_REAL) if (w[1] >= a - 0.01 && w[1] < b - 0.01 && norm(w[0]) === norm(word) && ++k === n) return w[1];
  throw new Error(`word ${word}#${n} not in shot ${shot}`);
};
export {SHOT_REAL, END_REAL, warp};
/** V3: the real word table, re-exported so the character rig can sync mouths + cheeks to speech */
export {WORDS_REAL};
