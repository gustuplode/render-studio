// "300 Spartans vs 10,000" — batch-2 Short (3/8). Demo only.
// Pure frame math only (no THREE, no DOM): TIMING, cameras, environment,
// the LITERAL armies (300 Spartans + 10,000 Persians in formation arrays),
// the arrow volleys, the goat-path torches, the hero cards' paths.
// main.js renders; sweep.mjs verifies. Every pose is an analytic function
// of the frame. Timing patched from the finished voice stem.
import { clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30;
// === PATCH:TOTAL ===
export const TOTAL = 1656; // frames 0..1655 — final stem 55.195s x 30fps
// === PATCH:TIMING === [id, startFrame, endFrame] — one section per phrase
export const TIMING = [
  ['hook', 0, 138],
  ['gates', 150, 284],
  ['leonidas', 296, 427],
  ['persians', 439, 566],
  ['arrows', 578, 696],
  ['shade', 708, 860],
  ['wall', 872, 1002],
  ['waves', 1014, 1152],
  ['goatpath', 1164, 1353],
  ['choice', 1365, 1522],
  ['finale', 1534, 1656],
];
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
export const secAt = (f) => {
  let s = SEG[TIMING[0][0]];
  for (const [id, a] of TIMING) { if (f >= a) s = SEG[id]; else break; }
  return { id: s.id, a: s.a, b: s.b, u: clamp((f - s.a) / s.len) };
};
const sf = (id, u) => SEG[id].a + (SEG[id].b - SEG[id].a) * u;
export const smooth = (u) => u * u * (3 - 2 * u);
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const k1 = (keys, f) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return lerp(v0, v1, (f - f0) / Math.max(1, f1 - f0)); }
  }
  return keys[keys.length - 1][1];
};
const k3 = (keys, f) => {
  if (f <= keys[0][0]) return [...keys[0][1]];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return lerp3(v0, v1, (f - f0) / Math.max(1, f1 - f0)); }
  }
  return [...keys[keys.length - 1][1]];
};

// ---------- world layout ----------
// The pass runs along X: Persians come from the EAST (+x). Cliff ridge on the
// NORTH side (z < -8, only west of x=30 — a gap in the ridge), open Persian
// plain to the east, sea along the SOUTH shore (z > 8) for every x.
// The fighting gap: cliff face z=-8, shoreline z=+8. Spartan block at x~3.
export const ROCK = [6.8, 0.85, -3.4]; // Leonidas' boulder (top y=0.85)
export const FRONT_X = 3.2;            // Spartan front rank x

// ---------- THE 300 SPARTANS: 25 ranks x 12 files, exactly 300 ----------
// index i = rank*12 + file; rank 0 = front (faces +x, the Persians).
export const SPARTAN_FORM = [];
for (let r = 0; r < 25; r++) for (let c = 0; c < 12; c++) SPARTAN_FORM.push({ rank: r, file: c });
export const spartanCountAt = (f) => (f >= 0 && f < TOTAL ? SPARTAN_FORM.length : 0);
// the shield-wall push: the block walks east during 'wall', surges twice in 'waves'
export const pushXAt = (f) => {
  let x = 2.3 * smooth(ramp(f, sf('wall', 0.05), sf('wall', 0.95)));
  x += 1.1 * smooth(ramp(f, sf('waves', 0.02), sf('waves', 0.38)));
  x += 0.9 * smooth(ramp(f, sf('waves', 0.55), sf('waves', 0.92)));
  return x;
};
// shields rise over heads when the arrows come (arrows + shade sections)
export const shieldUpAt = (f) =>
  smooth(ramp(f, sf('arrows', 0.10), sf('arrows', 0.45))) * (1 - smooth(ramp(f, sf('wall', 0.0), sf('wall', 0.30))));
export function spartanPosAt(i, f) {
  const s = SPARTAN_FORM[i], t = f / FPS;
  const push = pushXAt(f);
  // the wall leans into the push: front ranks a touch ahead, ranks compress
  const lean = (1 - s.rank / 25) * 0.35 * clamp(push / 4.3);
  const x = FRONT_X - s.rank * 0.62 + push + lean + Math.sin(t * 0.9 + i * 1.7) * 0.012;
  const z = -5.78 + s.file * 1.05 + Math.sin(t * 0.7 + i * 2.3) * 0.010;
  const y = Math.abs(Math.sin(t * 1.35 + i * 0.9)) * 0.022; // idle weight shift / march bob
  return { p: [x, y, z], shieldUp: shieldUpAt(f) };
}

// ---------- THE 10,000 PERSIANS: 80 ranks x 125 files, exactly 10,000 ----------
// index i = rank*125 + file; rank 0 = front (closest to the Spartans, faces -x).
export const PERSIAN_FORM = [];
for (let r = 0; r < 80; r++) for (let c = 0; c < 125; c++) PERSIAN_FORM.push({ rank: r, file: c });
export const persianCountAt = (f) => (f >= 0 && f < TOTAL ? PERSIAN_FORM.length : 0);
const P_FRONT_REST = 26.5; // front-rank x before the march
// the whole sea marches west during 'persians' (front 26.5 -> 15.5)
export const marchAt = (f) => 11.0 * smooth(ramp(f, sf('persians', 0.06), sf('persians', 0.92)));
// recoil pulses: the wall shoves the front ranks back, wave dies out eastward
const recoilPulse = (f, a, b, c) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, b, c)));
export function persianPosAt(i, f) {
  const s = PERSIAN_FORM[i], t = f / FPS;
  const march = marchAt(f);
  const wave = Math.exp(-s.rank * 0.085);
  let recoil = 5.6 * wave * recoilPulse(f, sf('wall', 0.18), sf('wall', 0.55), sf('waves', 0.30));
  recoil += 7.2 * wave * recoilPulse(f, sf('waves', 0.10), sf('waves', 0.45), sf('waves', 0.95));
  recoil += 5.0 * wave * recoilPulse(f, sf('waves', 0.60), sf('waves', 0.88), sf('finale', 0.20));
  const x = P_FRONT_REST + s.rank * 1.75 - march + recoil + Math.sin(t * 0.8 + i * 1.3) * 0.02;
  const z = -150 + s.file * 1.28 + Math.sin(t * 0.6 + i * 2.1) * 0.015;
  // marching bob while the sea moves; near-still when halted
  const moving = (march > 0.02 && march < 10.98) || recoil > 0.05 ? 1 : 0.25;
  const y = Math.abs(Math.sin(t * 2.4 + i * 0.83)) * 0.045 * moving;
  return { p: [x, y, z] };
}

// ---------- the other Greeks (NOT Spartans — Leonidas sends them home) ----------
export const ALLY_N = 18;
export function allyPosAt(k, f) {
  const u = clamp((f - sf('choice', 0.06)) / (sf('choice', 0.98) - sf('choice', 0.06)));
  const e = u * u * (3 - 2 * u);
  const x = lerp(-2 - (k % 6) * 1.1, -96 - (k % 6) * 1.4, e);
  const z = 4.6 + Math.floor(k / 6) * 1.5 + (k % 3) * 0.4;
  const y = Math.abs(Math.sin(f * 0.16 + k * 1.9)) * 0.05 * (u > 0 && u < 1 ? 1 : 0);
  return { p: [x, y, z], walking: u > 0 && u < 1 };
}

// ---------- ARROW VOLLEYS: 540 arrows, two volleys (arrows + shade) ----------
export const ARROW_N = 540;
const ARROW_PER = 270, FLIGHT = 52;
export function arrowAt(k, f) {
  const V = k < ARROW_PER ? 0 : 1, j = k % ARROW_PER;
  const L = (V ? sf('shade', 0.03) : sf('arrows', 0.06)) + (j % 30) * 1.1 + Math.floor(j / 30) * 2.5;
  const sx = 16.5 + (j % 9) * 0.85, sy = 1.7, sz = -9 + (j * 0.371) % 18;
  const ex = 2.4 + (j % 7) * 0.4, ey = 1.12, ez = -5.6 + (j * 0.529) % 11.2;
  const u = (f - L) / FLIGHT;
  if (u < 0) return { p: [0, -99, 0], u: -1, landed: false };
  if (u >= 1) { // stuck in a shield / the dust for a while, then gone
    const hold = f - (L + FLIGHT);
    if (hold > 80) return { p: [0, -99, 0], u: 2, landed: true };
    return { p: [ex, ey, ez], u: 1, landed: true };
  }
  const x = lerp(sx, ex, u), z = lerp(sz, ez, u);
  const y = lerp(sy, ey, u) + 11.5 * Math.sin(Math.PI * u);
  return { p: [x, y, z], u, landed: false };
}
export const arrowLandFrame = (k) => {
  const V = k < ARROW_PER ? 0 : 1, j = k % ARROW_PER;
  return Math.round((V ? sf('shade', 0.03) : sf('arrows', 0.06)) + (j % 30) * 1.1 + Math.floor(j / 30) * 2.5 + FLIGHT);
};

// ---------- GOAT-PATH TORCHES: 9 torches on the cliff path behind ----------
export const TORCH_PTS = [];
for (let k = 0; k < 9; k++) {
  const u = k / 8;
  TORCH_PTS.push([lerp(46, -34, u), 12.6 + Math.sin(u * Math.PI) * 2.6 + (k % 2) * 0.5, -6.5 - Math.sin(u * 2.2) * 0.9]); // z in FRONT of the ridge face (rocks reach z~-4) — torches must not sit inside the boulders
}
export const torchLitAt = (f) =>
  smooth(ramp(f, sf('goatpath', 0.10), sf('goatpath', 0.30))) * (1 - smooth(ramp(f, sf('choice', 0.0), sf('choice', 0.25))));

// ---------- HERO CARDS ----------
export const LEONIDAS_SEED = 41, DIENEKES_SEED = 7, CMDR_SEED = 23;
export const LEONIDAS_HEAD_M = 1.4854, DIENEKES_HEAD_M = 1.5300, CMDR_HEAD_M = 1.5216;
export function leonidasAt(f) {
  const front = [FRONT_X + pushXAt(f) + 0.75, 0, 0.2];
  const CAMP = [-6.5, 0, 3.2];
  if (f < sf('wall', 0)) return { p: [...ROCK], mode: 'rock' };
  if (f < sf('wall', 0.22)) { const u = smooth(ramp(f, sf('wall', 0), sf('wall', 0.22))); return { p: lerp3(ROCK, front, u), mode: 'move' }; }
  if (f < sf('goatpath', 0)) return { p: front, mode: 'front' };
  if (f < sf('goatpath', 0.30)) { const u = smooth(ramp(f, sf('goatpath', 0), sf('goatpath', 0.30))); const p = lerp3(front, CAMP, u); p[2] += Math.sin(u * Math.PI) * 3.4; return { p, mode: 'move' }; } // walks along the FRONT of the block (z bulge) — never hidden inside the ranks
  if (f < sf('choice', 0.30)) return { p: CAMP, mode: 'camp' };
  if (f < sf('choice', 0.62)) { const u = smooth(ramp(f, sf('choice', 0.30), sf('choice', 0.62))); const p = lerp3(CAMP, front, u); p[2] += Math.sin(u * Math.PI) * 3.4; return { p, mode: 'move' }; }
  return { p: front, mode: 'front' };
}
export const leonidasHeadAt = (f) => { const s = leonidasAt(f).p; return [s[0], s[1] + LEONIDAS_HEAD_M, s[2]]; };
export function dienekesAt(f) {
  // front rank, file 9 — a pace ahead of the wall, laughing under the arrows
  const base = spartanPosAt(9, f).p;
  return { p: [base[0] + 0.55, 0, base[2]], mode: f >= sf('shade', 0) && f < sf('wall', 0) ? 'laugh' : 'stand' };
}
export const dienekesHeadAt = (f) => { const s = dienekesAt(f).p; return [s[0], s[1] + DIENEKES_HEAD_M, s[2]]; };
export function cmdrAt(f) { return { p: [30, 2.3, -18], mode: 'stand' }; } // on his rise east of the pass mouth
export const cmdrHeadAt = (f) => { const s = cmdrAt(f).p; return [s[0], s[1] + CMDR_HEAD_M, s[2]]; };
// two Spartan warrior cards: flank Leonidas on the rock, then hold his sides at the front
export function swarriorAt(k, f) {
  const side = k === 0 ? -1 : 1;
  if (f < sf('wall', 0)) return { p: [ROCK[0] + side * 1.7, 0, ROCK[2] + side * 0.9], mode: 'rock' };
  const L = leonidasAt(f).p;
  return { p: [L[0] - 0.3, 0, L[2] + side * 1.6], mode: 'front' };
}
// two Persian front-rank soldier cards, locked to real formation slots (rank 0, files 58 + 66)
export function psoldierAt(k, f) {
  const idx = (k === 0 ? 58 : 66);
  const base = persianPosAt(idx, f).p;
  return { p: [base[0] - 0.4, 0, base[2]], mode: 'front' };
}

// ---------- environment: dawn gold -> bright battle -> arrow shade -> night torches -> sunrise ----------
const C = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const ENV_KEYS = [
  [0,                 { top: '#7a86a0', hor: '#f0c08a', fog: '#d9c2a4', fn: 40, ff: 430, az: 10, el: 9,  sun: '#ffd9a0', sunI: 1.6,  hSky: '#e8dcc8', hGnd: '#5a4f42', hemi: 0.85, deep: '#1d4258', shal: '#3f7d99', wsky: '#cfe0e8', mist: 0.15, cloud: '#e8d9c4', cop: 0.50, shade: 0,    sunS: 0.004 }],
  [sf('gates', 0.6),  { top: '#7d90b4', hor: '#f2c48e', fog: '#dec6a6', fn: 46, ff: 480, az: 11, el: 14, sun: '#ffdcA6', sunI: 1.9,  hSky: '#ecdfca', hGnd: '#5c5044', hemi: 0.88, deep: '#1e4459', shal: '#427f9c', wsky: '#d2e2ea', mist: 0.12, cloud: '#eadbc6', cop: 0.52, shade: 0,    sunS: 0.004 }],
  [sf('leonidas', 0.5), { top: '#8094b8', hor: '#f4c88f', fog: '#e2c9a8', fn: 50, ff: 520, az: 12, el: 17, sun: '#ffe0aa', sunI: 2.0,  hSky: '#efe2cc', hGnd: '#5e5246', hemi: 0.90, deep: '#1e465b', shal: '#44819e', wsky: '#d4e4ec', mist: 0.10, cloud: '#eee0c8', cop: 0.54, shade: 0,    sunS: 0.004 }],
  [sf('persians', 0.5), { top: '#8496b8', hor: '#f6cc92', fog: '#e6cdaa', fn: 55, ff: 620, az: 13, el: 24, sun: '#ffe4ae', sunI: 2.2,  hSky: '#f2e6ce', hGnd: '#605446', hemi: 0.92, deep: '#1f485e', shal: '#46849f', wsky: '#d6e6ee', mist: 0.08, cloud: '#f0e4cc', cop: 0.55, shade: 0,    sunS: 0.004 }],
  [sf('arrows', 0.45),  { top: '#77808f', hor: '#d9b98f', fog: '#d3bf9f', fn: 50, ff: 520, az: 13, el: 24, sun: '#e8d0a0', sunI: 1.1,  hSky: '#ddd2bc', hGnd: '#5a5044', hemi: 0.80, deep: '#1d4258', shal: '#407b98', wsky: '#c3d2da', mist: 0.10, cloud: '#cfc4ae', cop: 0.50, shade: 0.85, sunS: 0.003 }],
  [sf('shade', 0.5),    { top: '#7c8698', hor: '#e2c096', fog: '#d8c2a2', fn: 52, ff: 540, az: 13, el: 24, sun: '#edd2a2', sunI: 1.3,  hSky: '#e2d6be', hGnd: '#5c5146', hemi: 0.84, deep: '#1e445a', shal: '#427e9a', wsky: '#c9d6de', mist: 0.10, cloud: '#d8ccb4', cop: 0.52, shade: 0.6,  sunS: 0.003 }],
  [sf('wall', 0.4),     { top: '#8496b8', hor: '#f6cc92', fog: '#e6cdaa', fn: 55, ff: 600, az: 14, el: 27, sun: '#ffe4ae', sunI: 2.15, hSky: '#f2e6ce', hGnd: '#605446', hemi: 0.92, deep: '#1f485e', shal: '#46849f', wsky: '#d6e6ee', mist: 0.08, cloud: '#f0e4cc', cop: 0.55, shade: 0.05, sunS: 0.004 }],
  [sf('waves', 0.6),    { top: '#8698ba', hor: '#f8ce94', fog: '#e8cfaC', fn: 55, ff: 600, az: 14, el: 29, sun: '#ffe6b0', sunI: 2.2,  hSky: '#f4e8d0', hGnd: '#625646', hemi: 0.93, deep: '#204a60', shal: '#47869f', wsky: '#d8e8ee', mist: 0.08, cloud: '#f2e6ce', cop: 0.55, shade: 0,    sunS: 0.004 }],
  [sf('goatpath', 0.15), { top: '#131c2e', hor: '#2c3a55', fog: '#26334d', fn: 22, ff: 260, az: 14, el: -4, sun: '#7787b8', sunI: 0.5, hSky: '#46587a', hGnd: '#232c3e', hemi: 0.62, deep: '#0d2436', shal: '#1d3d55', wsky: '#24344d', mist: 0.42, cloud: '#1c2942', cop: 0.30, shade: 0,    sunS: 0.002 }],
  [sf('choice', 0.4),   { top: '#4a5a78', hor: '#e8a56f', fog: '#8d7a68', fn: 34, ff: 320, az: 13, el: 3,  sun: '#f2b183', sunI: 1.0,  hSky: '#b8a8a4', hGnd: '#3c3630', hemi: 0.66, deep: '#16334a', shal: '#2e5a74', wsky: '#7d90a8', mist: 0.25, cloud: '#8d8296', cop: 0.40, shade: 0,    sunS: 0.004 }],
  [sf('finale', 0.45),  { top: '#7d90b8', hor: '#ffc98a', fog: '#eacfa8', fn: 50, ff: 560, az: 11, el: 8,  sun: '#ffcf99', sunI: 2.3,  hSky: '#f2e2c8', hGnd: '#5e5142', hemi: 0.90, deep: '#1e465b', shal: '#44819e', wsky: '#d4e4ec', mist: 0.12, cloud: '#f0dfc2', cop: 0.54, shade: 0,    sunS: 0.010 }],
  [TOTAL - 1,           { top: '#7d90b8', hor: '#ffc98a', fog: '#eacfa8', fn: 50, ff: 560, az: 11, el: 8,  sun: '#ffcf99', sunI: 2.3,  hSky: '#f2e2c8', hGnd: '#5e5142', hemi: 0.90, deep: '#1e465b', shal: '#44819e', wsky: '#d4e4ec', mist: 0.12, cloud: '#f0dfc2', cop: 0.54, shade: 0,    sunS: 0.010 }],
];
const COL_FIELDS = ['top', 'hor', 'fog', 'sun', 'hSky', 'hGnd', 'deep', 'shal', 'wsky', 'cloud'];
const NUM_FIELDS = ['fn', 'ff', 'az', 'el', 'sunI', 'hemi', 'mist', 'cop', 'shade', 'sunS'];
export const envAt = (f) => {
  let i = 0;
  while (i < ENV_KEYS.length - 2 && f > ENV_KEYS[i + 1][0]) i++;
  const [f0, A] = ENV_KEYS[i], [f1, B] = ENV_KEYS[i + 1];
  const u = clamp((f - f0) / Math.max(1, f1 - f0));
  const out = {};
  for (const k of COL_FIELDS) out[k] = lerp3(C(A[k]), C(B[k]), u);
  for (const k of NUM_FIELDS) out[k] = lerp(A[k], B[k], u);
  out.flash = 0;
  return out;
};
export const mistBankAt = (f) => k1([[0, 0.55], [sf('persians', 0.5), 0.3], [sf('goatpath', 0.3), 0.85], [sf('finale', 0.5), 0.4], [TOTAL - 1, 0.35]], f);

// ---------- title / message boards ----------
export const boardAt = (f) => {
  const fade = (a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
  const inSec = (id, u0, u1) => f > sf(id, u0) && f < sf(id, u1);
  if (inSec('hook', 0.10, 0.94)) return { text: '300 vs 10,000', alpha: fade(sf('hook', 0.10), sf('hook', 0.22), sf('hook', 0.84), sf('hook', 0.94)) };
  if (inSec('gates', 0.14, 0.88)) return { text: 'THE HOT GATES', alpha: fade(sf('gates', 0.14), sf('gates', 0.26), sf('gates', 0.78), sf('gates', 0.88)) };
  if (inSec('shade', 0.16, 0.94)) return { text: 'WE FIGHT IN THE SHADE!', alpha: fade(sf('shade', 0.16), sf('shade', 0.28), sf('shade', 0.84), sf('shade', 0.94)) };
  if (inSec('goatpath', 0.40, 0.96)) return { text: 'SURROUNDED!', alpha: fade(sf('goatpath', 0.40), sf('goatpath', 0.50), sf('goatpath', 0.88), sf('goatpath', 0.96)) };
  if (inSec('finale', 0.08, 0.52)) return { text: '300 STOOD HERE', alpha: fade(sf('finale', 0.08), sf('finale', 0.18), sf('finale', 0.44), sf('finale', 0.52)) };
  if (inSec('finale', 0.56, 0.985)) return { text: 'THE WORLD REMEMBERS', alpha: fade(sf('finale', 0.56), sf('finale', 0.66), sf('finale', 0.93), sf('finale', 0.985)) };
  return null;
};

// ---------- CAMERA: one continuous flight, voice-tracked ----------
const BK = 9;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const wallFrontX = (f) => FRONT_X + pushXAt(f);
const CAMSEGS = [
  { a: 0, fn: (f) => ({ // HOOK — the drone: wide reveal of both armies, then a long dive to the pass mouth
    pos: kf3([[0, [-52, 26, 62]], [sf('hook', 0.35), [-30, 42, 34]], [sf('hook', 0.65), [-2, 20, 14]], [sf('hook', 0.85), [16, 8, 5]], [sf('hook', 1), [27, 5, 3]]], f),
    look: kf3([[0, [16, 0, -4]], [sf('hook', 0.5), [34, 0, -6]], [sf('hook', 1), [-6, 2, -1]]], f), fov: 55 }) },
  { a: SEG.gates.a, fn: (f) => ({ // GATES — glide east->west through the gap, cliff left, sea right
    pos: kf3([[SEG.gates.a, [30, 4.6, 5.5]], [sf('gates', 0.5), [10, 4.0, 4.5]], [sf('gates', 1), [-8, 4.2, 3]]], f),
    look: kf3([[SEG.gates.a, [-2, 2.2, -1]], [sf('gates', 0.62), [-16, 2.2, -1]], [sf('gates', 1), [6.8, 2.4, -3.4]]], f), fov: 52 }) },
  { a: SEG.leonidas.a, fn: (f) => { // LEONIDAS — fly in from the west end of the glide, then push in locked on his head
    const head = leonidasHeadAt(f);
    const close = add3(head, kf3([[SEG.leonidas.a, [-16.5, 2.3, 6.5]], [sf('leonidas', 0.55), [6.6, 2.2, 5.8]], [sf('leonidas', 1), [5.6, 2.0, 4.9]]], f));
    return { pos: close, look: lerp3([6.8, 2.2, -3.4], head, smooth(ramp(f, SEG.leonidas.a, sf('leonidas', 0.35)))), fov: kf([[SEG.leonidas.a, 47], [sf('leonidas', 1), 40]], f) };
  } },
  { a: SEG.persians.a, fn: (f) => ({ // PERSIANS — pull back from Leonidas, then a long sweep over the sea of spears to the commander's rise
    pos: kf3([[SEG.persians.a, [13.5, 4.2, 5.5]], [sf('persians', 0.30), [38, 15, 16]], [sf('persians', 0.62), [84, 23, -6]], [sf('persians', 1), [52, 13, -27]]], f),
    look: kf3([[SEG.persians.a, [7, 2, -3]], [sf('persians', 0.30), [46, 1, -34]], [sf('persians', 0.62), [58, 0, -38]], [sf('persians', 1), [30, 3.4, -18]]], f), fov: 54 }) },
  { a: SEG.arrows.a, fn: (f) => ({ // ARROWS — swing west over the wall and settle low behind it, looking up into the darkening sky
    pos: kf3([[SEG.arrows.a, [44, 12, -16]], [sf('arrows', 0.45), [20, 6, 10]], [sf('arrows', 1), [-4, 3.2, 9.0]]], f),
    look: kf3([[SEG.arrows.a, [30, 3.4, -18]], [sf('arrows', 0.45), [13, 8, -1]], [sf('arrows', 1), [12, 6, -2]]], f), fov: 50 }) },
  { a: SEG.shade.a, fn: (f) => { // SHADE — close on Dienekes laughing under the arrow rain
    const head = dienekesHeadAt(f);
    return { pos: add3(head, kf3([[SEG.shade.a, [6.4, 1.5, 5.6]], [sf('shade', 1), [4.7, 1.1, 4.0]]], f)), look: head, fov: kf([[SEG.shade.a, 44], [sf('shade', 1), 41]], f) };
  } },
  { a: SEG.wall.a, fn: (f) => { // WALL — action level: ride at shield height beside the walking wall
    const fx = wallFrontX(f);
    return { pos: [fx + 3.6, 1.65, kf([[SEG.wall.a, 8.8], [sf('wall', 1), 7.4]], f)], look: [fx - 1.6, 1.15, -1.6], fov: 50 };
  } },
  { a: SEG.waves.a, fn: (f) => { // WAVES — wider from the sea side: the sea of men breaks and rolls back
    const fx = wallFrontX(f);
    return { pos: kf3([[SEG.waves.a, [fx + 10, 5.4, 17.5]], [sf('waves', 1), [fx + 5, 4.2, 14]]], f), look: [fx - 6, 1.0, -6], fov: 52 };
  } },
  { a: SEG.goatpath.a, fn: (f) => ({ // GOATPATH — night: pull back at dusk, climb, then a slow pan along the torch line
    pos: kf3([[SEG.goatpath.a, [10, 5, 12]], [sf('goatpath', 0.45), [-12, 8.5, 9]], [sf('goatpath', 1), [2, 11, 4]]], f),
    look: kf3([[SEG.goatpath.a, [0, 2, -8]], [sf('goatpath', 0.5), [14, 12.5, -7]], [sf('goatpath', 1), [-12, 10.5, -5.5]]], f), fov: 50 }) },
  { a: SEG.choice.a, fn: (f) => { // CHOICE — first light: quiet wide on Leonidas as the others walk west
    const head = leonidasHeadAt(f);
    return { pos: kf3([[SEG.choice.a, [4, 6.5, 6]], [sf('choice', 1), [12, 5.5, 12.5]]], f), look: lerp3([3.5, 1.6, 0], head, 0.62), fov: 46 }; // look tracks Leonidas at 0.62 — the section is HIS walk to the front
  } },
  { a: SEG.finale.a, fn: (f) => ({ // FINALE — sunrise: rise slowly behind the 300, into the gold
    pos: kf3([[SEG.finale.a, [2, 3.4, 6.5]], [sf('finale', 0.5), [-16, 5.5, 13]], [sf('finale', 1), [-26, 10, 17]]], f),
    look: kf3([[SEG.finale.a, [16, 2.2, -1]], [sf('finale', 1), [10, 2.0, -0.5]]], f), fov: 52 }) },
];
export function camAt(f) {
  let i = 0;
  for (let k = 0; k < CAMSEGS.length; k++) if (f >= CAMSEGS[k].a) i = k;
  let c = CAMSEGS[i].fn(f);
  const blendTo = (other, w) => { c = { pos: lerp3(c.pos, other.pos, w), look: lerp3(c.look, other.look, w), fov: lerp(c.fov, other.fov, w) }; };
  if (i + 1 < CAMSEGS.length && f > CAMSEGS[i + 1].a - BK) {
    blendTo(CAMSEGS[i + 1].fn(f), smooth(clamp((f - (CAMSEGS[i + 1].a - BK)) / (2 * BK))));
  } else if (i > 0 && f < CAMSEGS[i].a + BK) {
    const p = CAMSEGS[i - 1].fn(f), w = smooth(clamp((f - (CAMSEGS[i].a - BK)) / (2 * BK)));
    c = { pos: lerp3(p.pos, c.pos, w), look: lerp3(p.look, c.look, w), fov: lerp(p.fov, c.fov, w) };
  }
  let { pos, look, fov } = c;
  const t = f / FPS;
  pos = [pos[0] + Math.sin(t * 0.5) * 0.15, pos[1] + Math.sin(t * 0.8) * 0.08, pos[2]];
  return { pos, look, fov };
}
