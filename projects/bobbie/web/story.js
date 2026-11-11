// Shot plan for "Bobbie — The Dog Who Walked 2,551 Miles Home" — timed to the
// 51.850 s voice stem (30 fps, TOTAL 1556). Sections are CONTIGUOUS, one per
// phrase; gaps between phrases hold the previous section's tail.
// P1 0-157 hook | P2 190-301 drive | P3 339-416 vanish | P4 451-550 search |
// P5 565-709 turn+map | P6 738-813 rivers+desert | P7 836-946 winter |
// P8 972-1064 strangers | P9 1094-1182 worn | P10 1215-1363 arrival |
// P11 1387-1531 finale.
// World sets (main.js): Wolcott street (0,0,-40) · road (30,0,-40) ·
// map board (30,0,0) · river (60,0,10) · desert (78,0,10) ·
// winter pass (-60,0,10) · farm (-30,0,-10) · plain (-30,0,30) ·
// Silverton + family house (-60,0,-40), door at (-60,0,-45.6).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1556, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 189, light: 'gold' },
  { id: 'drive', a: 190, b: 338, light: 'gold' },
  { id: 'vanish', a: 339, b: 450, light: 'gold' },
  { id: 'search', a: 451, b: 564, light: 'dusk' },
  { id: 'turn', a: 565, b: 737, light: 'day' },
  { id: 'rivers', a: 738, b: 835, light: 'river' },
  { id: 'winter', a: 836, b: 971, light: 'white' },
  { id: 'strangers', a: 972, b: 1093, light: 'dusk' },
  { id: 'worn', a: 1094, b: 1214, light: 'day' },
  { id: 'arrival', a: 1215, b: 1386, light: 'dawn' },
  { id: 'finale', a: 1387, b: 1555, light: 'dawn' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t); // tracking moves: constant speed keeps per-frame delta under the sweep bound

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  gold: { az: 120, el: 30, sky: '#c8a06a', ground: '#6a5238', hemi: 1.1, sun: '#ffc37e', sunI: 2.2, fog: '#d9b28c', fogNear: 40, fogFar: 300,
    skyTop: '#7d94c4', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.06, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  day: { az: 130, el: 38, sky: '#aebfe0', ground: '#5a6a80', hemi: 1.15, sun: '#fff1d6', sunI: 2.0, fog: '#c3cfdf', fogNear: 45, fogFar: 340,
    skyTop: '#6f97cc', skyHor: '#dfe9f2', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.03, vig: 0.2, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  dusk: { az: 250, el: 14, sky: '#7a5a78', ground: '#2e2430', hemi: 0.8, sun: '#ff9a5e', sunI: 1.2, fog: '#4a3550', fogNear: 22, fogFar: 200,
    skyTop: '#2c2444', skyHor: '#c46a4a', sunDisc: '#ffb37e', sunSize: 0.003, sat: 1.02, vig: 0.32, shadowExt: 15, aurora: 0, gain: '#ffffff', ...WATER },
  river: { az: 140, el: 34, sky: '#a8c4de', ground: '#4a5c50', hemi: 1.12, sun: '#eef4ff', sunI: 1.9, fog: '#b8ccdc', fogNear: 40, fogFar: 300,
    skyTop: '#5f8ab8', skyHor: '#dcebf4', sunDisc: '#ffffff', sunSize: 0.003, sat: 1.0, vig: 0.2, shadowExt: 18, aurora: 0, gain: '#ffffff',
    waterDeep: '#1d4a66', waterShal: '#3d84a8', glint: '#eaf7ff' },
  desert: { az: 160, el: 48, sky: '#e0d3ae', ground: '#8a6f4a', hemi: 1.2, sun: '#fff0c8', sunI: 2.3, fog: '#e6d9b4', fogNear: 45, fogFar: 320,
    skyTop: '#9ab4d4', skyHor: '#f2e3ba', sunDisc: '#fff8dc', sunSize: 0.0034, sat: 0.98, vig: 0.2, shadowExt: 20, aurora: 0, gain: '#ffffff', ...WATER },
  white: { az: 215, el: 30, sky: '#e8edf2', ground: '#c9d2da', hemi: 1.25, sun: '#ffffff', sunI: 0.75, fog: '#eef2f6', fogNear: 4, fogFar: 42,
    skyTop: '#dfe7ee', skyHor: '#f4f7fa', sunDisc: '#ffffff', sunSize: 0.002, sat: 0.92, vig: 0.2, shadowExt: 15, aurora: 0, gain: '#ffffff', ...WATER },
  dawn: { az: 100, el: 16, sky: '#9aa8d8', ground: '#6a5238', hemi: 1.12, sun: '#ffc37e', sunI: 2.35, fog: '#d9b28c', fogNear: 40, fogFar: 300,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.06, gain: '#ffedd6', vig: 0.24, shadowExt: 18, aurora: 0, ...WATER },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  o.sunI = o.sunI * (1 - 0.45 * Math.sin(Math.PI * t));
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'rivers') return blendLight(LIGHTS.river, LIGHTS.desert, smooth(ramp(f, 788, 835)));
  if (S.id === 'finale') return blendLight(LIGHTS.dawn, LIGHTS.day, smooth(ramp(f, 1440, 1531)));
  if (S.id === 'winter') return blendLight(LIGHTS.white, { ...LIGHTS.white, fogNear: 9, fogFar: 90, sunI: 1.0 }, smooth(ramp(f, 880, 946)));
  return { ...LIGHTS[S.light] };
};

// ---------- the mile counter (HARD PROOF) ----------
// Starts on the map draw, rises through the journey, slower in winter,
// and lands EXACTLY on 2551 at the final frame. Monotonic non-decreasing.
export const milesAt = (f) => Math.round(kf([[0, 0], [565, 0], [650, 90], [737, 260], [790, 640], [835, 980], [900, 1150], [971, 1330], [1093, 1690], [1150, 1980], [1214, 2210], [1300, 2380], [1386, 2470], [1480, 2520], [1555, 2551]], f));

// ---------- journey scroll (parallax metres for scroll props) ----------
export const scrollAt = (f) => kf([[0, 0], [737, 0], [835, 5], [971, 9], [1093, 11], [1214, 16], [1386, 18], [1555, 19]], f);

// ---------- shared staging ----------
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
export const bobbiePosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return f < 120 ? kf3([[0, [1.7, 0, -35]], [70, [1.9, 0, -38.6], 'linear'], [120, [1.9, 0, -40.6], 'linear']], f) : [1.9, 0, -41.2];
    case 'drive': return [28.6, 0, -37.6];
    case 'vanish': return kf3([[339, [1.2, 0, -38]], [395, [3.4, 0, -41], 'linear'], [450, [5.6, 0, -44.5], 'linear']], f);
    case 'search': return null;
    case 'turn': return f >= 690 ? [24.5, 0, 5.5] : null;
    case 'rivers': return f < 788 ? [60, -0.34, 10] : kf3([[788, [63, 0, 10]], [835, [78.5, 0, 10], 'linear']], f);
    case 'winter': return [-60, 0, 10];
    case 'strangers': return [-31.6, 0, -8.6];
    case 'worn': return f < 1150 ? [-30, 0, 30] : [-30, 0, 28];
    case 'arrival': return kf3([[1215, [-51, 0, -35]], [1300, [-55, 0, -39], 'linear'], [1386, [-58.2, 0, -42.5], 'linear']], f);
    case 'finale': return f < 1440 ? kf3([[1387, [-58.2, 0, -42.5]], [1440, [-59.6, 0, -44.6], 'easeInOut']], f) : [-59.6, 0, -44.6];
    default: return null;
  }
};
export const heroPosAt = bobbiePosAt;
// period car prop: one car, repositioned per beat (main.js)
export const carAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'hook') { const p = kf3([[0, [-0.5, 0, -38]], [70, [-0.5, 0, -42.5], 'easeInOut'], [150, [-0.5, 0, -48]]], f); return { x: p[0], z: p[2], ry: 0 }; }
  if (S.id === 'drive') return { x: 34.5, z: -43, ry: 0.9 };
  if (S.id === 'vanish') return { x: -3.2, z: -42.5, ry: 0.2 };
  if (S.id === 'search') { if (f < 520) return { x: -4.5, z: -41.5, ry: 0.2 }; const p = kf3([[520, [-4.5, 0, -41.5]], [564, [6.5, 0, -39.5], 'easeIn']], f); return { x: p[0], z: p[2], ry: 1.15 }; }
  return null;
};

// ---------- cameras (dips at location changes; finale continues arrival) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [-3.4, 2.1, -29], look: [1.7, 0.8, -35], fov: 44 },
    { f: 70, pos: [-0.5, 1.7, -33], look: [1.9, 0.8, -38.6], fov: 41, ease: 'surge' },
    { f: 130, pos: [4.6, 1.4, -37], look: [1.9, 0.82, -41.2], fov: 39, ease: 'surge' },
    { f: 189, pos: [1.9, 1.02, -37.4], look: [1.9, 0.82, -41.2], fov: 37, ease: 'surge' },
  ],
  drive: [
    { f: 190, pos: [24, 2.2, -32.5], look: [29.5, 1.0, -38], fov: 44 },
    { f: 260, pos: [25.8, 1.7, -34.5], look: [29.3, 0.9, -37.8], fov: 40, ease: 'surge' },
    { f: 338, pos: [27, 1.35, -35.8], look: [29, 0.82, -37.6], fov: 37, ease: 'surge' },
  ],
  vanish: [
    { f: 339, pos: [-4.2, 2.0, -31.5], look: [0.4, 1.0, -37.5], fov: 44 },
    { f: 395, pos: [-2.8, 1.7, -33.5], look: [2.8, 0.8, -41], fov: 40, ease: 'surge' },
    { f: 450, pos: [1.8, 1.4, -38.5], look: [5.4, 0.8, -44.2], fov: 38, ease: 'surge' },
  ],
  search: [
    { f: 451, pos: [-4.6, 2.0, -32], look: [0.2, 1.0, -37], fov: 44 },
    { f: 515, pos: [-3.6, 1.7, -33.5], look: [0.6, 0.95, -37], fov: 41, ease: 'surge' },
    { f: 564, pos: [-2.4, 1.8, -32.5], look: [3.5, 0.9, -39.5], fov: 42, ease: 'surge' },
  ],
  turn: [
    { f: 565, pos: [21.5, 2.7, -10.5], look: [30, 2.3, 0], fov: 45 },
    { f: 640, pos: [24.6, 2.4, -6.8], look: [30, 2.2, 0], fov: 40, ease: 'surge' },
    { f: 690, pos: [26.4, 2.0, -3.6], look: [27.5, 1.4, 2.6], fov: 38, ease: 'surge' },
    { f: 715, pos: [23.5, 1.5, 0.6], look: [24.8, 0.85, 5.2], fov: 38, ease: 'surge' },
    { f: 737, pos: [21.2, 1.25, 1.6], look: [24.5, 0.75, 5.5], fov: 39, ease: 'surge' },
  ],
  rivers: [
    { f: 738, pos: [55.2, 1.15, 4.6], look: [60.2, 0.35, 10.2], fov: 41 },
    { f: 762, pos: [55.9, 1.08, 5.0], look: [60.3, 0.32, 10.2], fov: 40, ease: 'surge' },
    { f: 776, pos: [57.5, 1.2, 4.9], look: [60.2, 0.35, 10.1], fov: 40, ease: 'linear' },
    { f: 792, pos: [60.5, 1.3, 4.85], look: [64.3, 0.55, 10], fov: 40, ease: 'linear' },
    { f: 808, pos: [63.5, 1.4, 4.8], look: [69.6, 0.6, 10], fov: 40, ease: 'linear' },
    { f: 824, pos: [66.5, 1.5, 4.7], look: [74.8, 0.65, 10], fov: 40, ease: 'linear' },
    { f: 835, pos: [68.5, 1.6, 4.6], look: [78.5, 0.7, 10.05], fov: 40, ease: 'linear' },
  ],
  winter: [
    { f: 836, pos: [-64.8, 1.2, 4.4], look: [-59.8, 0.7, 10.2], fov: 41 },
    { f: 905, pos: [-64.2, 1.05, 5.2], look: [-59.9, 0.62, 10.2], fov: 40, ease: 'surge' },
    { f: 971, pos: [-63.8, 0.95, 5.8], look: [-60, 0.55, 10.2], fov: 39, ease: 'surge' },
  ],
  strangers: [
    { f: 972, pos: [-35.6, 1.9, -3.6], look: [-30.6, 0.95, -9.2], fov: 43 },
    { f: 1030, pos: [-34.6, 1.6, -4.8], look: [-30.9, 0.85, -9.0], fov: 40, ease: 'surge' },
    { f: 1093, pos: [-34.0, 1.45, -5.6], look: [-31.2, 0.8, -8.8], fov: 38, ease: 'surge' },
  ],
  worn: [
    { f: 1094, pos: [-30, 25, 51], look: [-30, 0, 30.5], fov: 46 },
    { f: 1130, pos: [-29.8, 17, 44], look: [-30, 0.2, 29.8], fov: 43, ease: 'linear' },
    { f: 1165, pos: [-30, 9, 36], look: [-30, 0.5, 28.8], fov: 40, ease: 'linear' },
    { f: 1195, pos: [-30, 2.2, 25.2], look: [-30, 0.75, 28.2], fov: 37, ease: 'linear' },
    { f: 1214, pos: [-30, 1.05, 24.2], look: [-30, 0.8, 28], fov: 37, ease: 'linear' },
  ],
  arrival: [
    { f: 1215, pos: [-46.5, 2.1, -30.5], look: [-53, 0.9, -37], fov: 44 },
    { f: 1300, pos: [-49.5, 1.7, -33.5], look: [-55.5, 0.85, -39.5], fov: 41, ease: 'surge' },
    { f: 1386, pos: [-54.5, 1.4, -38.5], look: [-59, 0.9, -43.5], fov: 39, ease: 'surge' },
  ],
  finale: [
    { f: 1387, pos: [-54.5, 1.4, -38.5], look: [-59.3, 0.95, -44.7], fov: 39 },
    { f: 1445, pos: [-55.8, 1.35, -40], look: [-59.6, 0.95, -44.8], fov: 38, ease: 'surge' },
    { f: 1500, pos: [-56.8, 1.4, -41.4], look: [-59.7, 1.0, -45.1], fov: 37, ease: 'surge' },
    { f: 1555, pos: [-51.5, 2.8, -34.5], look: [-61.4, 1.2, -46.9], fov: 44, ease: 'surge' },
  ],
};
const SHADOW_AT = { hook: [0, 0.7, -38], drive: [29, 0.7, -38], vanish: [2, 0.7, -40], search: [0, 0.7, -37], turn: [29, 1, 0], rivers: [62, 0.3, 9], winter: [-60, 0.5, 10], strangers: [-31, 0.7, -9], worn: [-30, 0.5, 29], arrival: [-56, 0.7, -40], finale: [-59, 0.9, -44] };
const DIPS = [190, 339, 451, 565, 738, 836, 972, 1094, 1215];
const BRIDGES = { finale: 26 };
const shotCam = (id, f) => camFromKeys(CAMS[id], f);
export const camAt = (f) => {
  const S = shotAt(f);
  let c = shotCam(S.id, f);
  const bd = BRIDGES[S.id];
  if (bd && f - S.a < bd) {
    const P = SHOTS[SHOTS.indexOf(S) - 1];
    const pc = shotCam(P.id, P.b);
    const t = smooth(ramp(f, S.a, S.a + bd));
    c = { pos: lerp3(pc.pos, c.pos, t), look: lerp3(pc.look, c.look, t), fov: lerp(pc.fov, c.fov, t), roll: lerp(pc.roll || 0, c.roll || 0, t) };
  }
  if (S.id === 'winter') {
    const amp = 0.012;
    c.pos = [c.pos[0] + Math.sin(f * 1.31) * amp, c.pos[1] + Math.sin(f * 1.73 + 1) * amp * 0.7, c.pos[2]];
    c.look = [c.look[0] + Math.sin(f * 1.53 + 2) * amp, c.look[1], c.look[2]];
  }
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9);
  for (const B of DIPS) { const d = f - B; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); }
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let point, cinf;
  switch (S.id) {
    case 'hook': point = [0.3, 0.85, -40]; cinf = 9; break;
    case 'drive': point = [29, 0.85, -38.2]; cinf = 8; break;
    case 'vanish': point = [3, 0.85, -41]; cinf = 9; break;
    case 'search': point = [0.5, 0.95, -37.5]; cinf = 10; break;
    case 'turn': point = f < 690 ? [30, 2.1, 0] : [24.6, 0.75, 5.6]; cinf = f < 690 ? 5 : 8; break;
    case 'rivers': point = f < 788 ? [60, 0.3, 10] : [78.5, 0.7, 10]; cinf = 8; break;
    case 'winter': point = [-60, 0.6, 10]; cinf = 8; break;
    case 'strangers': point = [-31.2, 0.85, -8.8]; cinf = 7; break;
    case 'worn': point = [-30, 0.6, 29]; cinf = f < 1150 ? 3 : 7; break;
    case 'arrival': point = [-56, 0.85, -40]; cinf = 9; break;
    case 'finale': point = [-59.4, 1.0, -44.8]; cinf = 7; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lanternSet: [], mist: 0.08, snowK: 0, windK: 0.3, scentK: 0, mapT: 0, starK: 0, winGlow: 0.4, statueGlint: 0, bottleK: 0, bottleGlint: 0, iceK: 0, crackK: 0, doorK: 0, riverK: 0, miles: milesAt(f) };
  switch (S.id) {
    case 'hook': W.winGlow = 0.7; break;
    case 'drive': W.winGlow = 0.5; W.mist = 0.05; break;
    case 'vanish': W.winGlow = 0.8; break;
    case 'search': W.lanternSet = [0]; W.starK = 0.7; W.winGlow = 0.9; W.mist = 0.2; break;
    case 'turn': W.lanternSet = [3]; W.mapT = M.easeInOut(ramp(f, 575, 685)); W.winGlow = 0.4; break;
    case 'rivers': W.riverK = f < 788 ? 1 : 0; W.mapT = 1; W.mist = 0.15; break;
    case 'winter': W.snowK = 1; W.windK = 3.0; W.mist = 0.9; W.mapT = 1; break;
    case 'strangers': W.lanternSet = [1]; W.starK = 0.5; W.winGlow = 1; W.mapT = 1; break;
    case 'worn': W.mapT = 1; W.windK = 0.8; break;
    case 'arrival': W.lanternSet = [2]; W.winGlow = 0.9; W.mapT = 1; W.snowK = 0.25; break;
    case 'finale':
      W.lanternSet = [2]; W.winGlow = 1; W.mapT = 1; W.snowK = 0.15;
      W.doorK = smooth(ramp(f, 1402, 1442));
      W.statueGlint = 0.9 * smooth(ramp(f, 1470, 1520)); break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'strangers': return { fireRate: 16, fireScale: 0.85, smokeRate: 2.4 };
    case 'finale': return { fireRate: 12, fireScale: 0.7, smokeRate: 2.0 };
    case 'search': return { fireRate: 0, fireScale: 0.5, smokeRate: 1.4 };
    case 'winter': return { fireRate: 0, fireScale: 0.5, smokeRate: 3.6 };
    default: return { fireRate: 0, fireScale: 0.5, smokeRate: 1.8 };
  }
};

// ---------- actors ----------
export const FATHER = { tunic: '#4a3b2c', skin: '#f5c9a0', hair: '#3b2a20', cap: '#5d4a38' };
export const MOTHER = { tunic: '#7a4a5a', skin: '#ffe2c2', hair: '#2b211c', dress: '#8c5a6e' };
export const KID1 = { tunic: '#b8524a', skin: '#f5c9a0', hair: '#3b2a20' };
export const KID2 = { tunic: '#4f7fb8', skin: '#ecd0b6', hair: '#5a3b2a' };
export const FARMER = { tunic: '#6d5136', skin: '#f5c9a0', cap: '#8a5a34', apron: '#d8c9a6', moustache: '#4a3020' };
export const FARMWOMAN = { tunic: '#5d7a3a', skin: '#ecd0b6', hair: '#4a3426', dress: '#7a8a4a' };
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'obj') + JSON.stringify(o) + JSON.stringify(who), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RB = (T, o, pos, extra = {}) => ({ key: 'bob' + JSON.stringify(o), draw: (p) => T.bobbieCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { gold: '#ffe9c4', day: '#ffffff', dusk: '#e8b48f', river: '#eaf4ff', desert: '#fff3d0', white: '#ffffff', dawn: '#ffe9c4' };
const tintFor = (S, f) => S.id === 'rivers' ? (f < 788 ? TINT.river : TINT.desert) : S.id === 'finale' ? TINT.dawn : (TINT[S.light] || '#ffffff');
const wornAt = (f) => clamp(kf([[0, 0], [737, 0.08], [835, 0.3], [971, 0.5], [1093, 0.68], [1214, 0.92], [1386, 1], [1440, 0.85], [1555, 0.8]], f));

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S, f), w = q(wornAt(f), 2);
  switch (S.id) {
    case 'hook': {
      const bp = bobbiePosAt(f);
      if (f < 120) out.push(RB(T, { step: q((f * 0.07) % 1, 2), pant: 1 }, [bp[0], Math.abs(Math.sin(f * 0.5)) * 0.02, bp[2]], { tint, s: 0.78 }));
      else out.push(RB(T, { view: 'front', pant: 1 }, [bp[0], breath(f, 3) * 0.5, bp[2]], { tint, s: 0.8 })); // stops alone, turns west, determined
      break;
    }
    case 'drive': {
      // the happy drive: family grouped at the car, Bobbie riding proud in front
      out.push(RB(T, { view: 'front', pant: 1 }, [28.6, breath(f, 3) * 0.5, -37.6], { tint, s: 0.78 }));
      out.push(R(T, FATHER, { seed: 31, expr: 'grin', L: 'hang', R: 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [30.9, 0, -38.9], { tint, s: 0.98, yaw: -0.4 }));
      out.push(R(T, MOTHER, { seed: 12, expr: 'grin', L: 'belly', R: 'wave', wv: q(f * 0.4, 1), blink: blinkAt(f, 12), bob: q(breath(f, 12), 3) }, [29.7, 0, -36.4], { tint, s: 0.95, yaw: 0.3 }));
      out.push(R(T, KID1, { seed: 23, expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) }, [31.6, 0, -37.2], { tint, s: 0.6, yaw: -0.3 }));
      break;
    }
    case 'vanish': {
      const bp = bobbiePosAt(f);
      out.push(RB(T, { step: q((f * 0.045) % 1, 2), headDown: q(0.3 + 0.4 * Math.sin(f * 0.05), 2) }, [bp[0], 0, bp[2]], { tint, s: 0.76 }));
      out.push(R(T, FATHER, { seed: 31, expr: 'neutral', L: 'belly', R: 'reach', lift: 0.4, blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [0.9, 0, -35.6], { tint, s: 0.98, yaw: 0.5 }));
      out.push(R(T, MOTHER, { seed: 12, expr: 'neutral', L: 'hang', R: 'belly', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3) }, [-1.1, 0, -35.9], { tint, s: 0.95, yaw: -0.4 }));
      out.push(R(T, KID2, { seed: 27, expr: 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 27), bob: q(breath(f, 27), 3) }, [-2.0, 0, -37.5], { tint, s: 0.6 }));
      break;
    }
    case 'search': {
      out.push(R(T, FATHER, { seed: 31, expr: 'nervous', L: 'reach', R: 'reach', lift: 0.5, blink: blinkAt(f, 31), bob: q(breath(f, 31), 3), headTilt: -4 }, [-0.6, 0, -36.8], { tint, s: 0.98, yaw: 0.4 }));
      out.push(R(T, MOTHER, { seed: 12, expr: 'nervous', L: 'up', R: 'up', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3) }, [0.5, 0, -36.3], { tint, s: 0.95, yaw: -0.3 }));
      out.push(R(T, KID1, { seed: 23, expr: 'nervous', L: 'hang', R: 'wave', wv: q(f * 0.3, 1), blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) }, [2.0, 0, -37.4], { tint, s: 0.6 }));
      break;
    }
    case 'turn': {
      if (f >= 690) { const bp = bobbiePosAt(f); out.push(RB(T, { step: q((f * 0.05) % 1, 2), pant: 0, worn: 0.08 }, [bp[0], Math.abs(Math.sin(f * 0.45)) * 0.02, bp[2]], { tint, s: 0.78 })); }
      break;
    }
    case 'rivers': {
      if (f < 788) out.push(RB(T, { step: q((f * 0.09) % 1, 2), headDown: 0.25, worn: w, pant: 1 }, [60, -0.3, 10], { tint, s: 0.8 }));
      else { const bp = bobbiePosAt(f); out.push(RB(T, { step: q((f * 0.05) % 1, 2), worn: w, pant: 1 }, [bp[0], Math.abs(Math.sin(f * 0.45)) * 0.02, bp[2]], { tint, s: 0.8 })); }
      break;
    }
    case 'winter': {
      out.push(RB(T, { step: q((f * 0.035) % 1, 2), headDown: 0.4, worn: w, snow: 0.8, pant: 1 }, [-60, Math.abs(Math.sin(f * 0.35)) * 0.015, 10], { tint, s: 0.82 }));
      break;
    }
    case 'strangers': {
      out.push(RB(T, { headDown: 0.75, worn: w }, [-31.6, 0, -8.6], { tint, s: 0.78 })); // nose down to the bowl
      out.push(R(T, FARMER, { seed: 44, expr: 'smile', L: 'belly', R: 'reach', lift: 0.25, blink: blinkAt(f, 44), bob: q(breath(f, 44), 3) }, [-30.2, 0, -10.6], { tint, s: 0.98, yaw: -0.5 }));
      out.push(R(T, FARMWOMAN, { seed: 18, expr: 'smile', L: 'hang', R: 'belly', blink: blinkAt(f, 18), bob: q(breath(f, 18), 3) }, [-28.2, 0, -11.8], { tint, s: 0.95, yaw: -0.7 }));
      break;
    }
    case 'worn': {
      if (f < 1198) out.push(RB(T, { step: q((f * 0.04) % 1, 2), headDown: 0.5, worn: 1, limp: 0.6 }, [-30, 0, 30], { tint, s: 0.55 })); // tiny from the drone
      else out.push(RB(T, { view: 'front', headDown: 0, worn: 1, pant: 1 }, [-30, breath(f, 3) * 0.5, 28], { tint, s: 0.95 })); // low front close-up: worn, still walking
      break;
    }
    case 'arrival': {
      const bp = bobbiePosAt(f);
      out.push(RB(T, { step: q((f * 0.04) % 1, 2), headDown: 0.35, worn: 1, limp: 0.9, snow: 0.3, pant: 1 }, [bp[0], Math.abs(Math.sin(f * 0.4)) * 0.015, bp[2]], { tint, s: 0.8 }));
      out.push(R(T, MOTHER, { seed: 12, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3) }, [-60.8, 0, -44.9], { tint, s: 0.9, yaw: 0.6 }));
      break;
    }
    case 'finale': {
      const bp = bobbiePosAt(f), medal = f >= 1470;
      if (f < 1440) out.push(RB(T, { step: q((f * 0.09) % 1, 2), worn: w, pant: 1 }, [bp[0], Math.abs(Math.sin(f * 0.6)) * 0.03, bp[2]], { tint, s: 0.82 }));
      else out.push(RB(T, { view: 'front', worn: q(w * 0.9, 2), pant: 1, medal, collar: medal }, [bp[0], breath(f, 3) * 0.5, bp[2]], { tint, s: 0.9 }));
      out.push(R(T, FATHER, { seed: 31, expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-60.9, 0, -45.5], { tint, s: 0.98, yaw: 0.5 }));
      out.push(R(T, MOTHER, { seed: 12, expr: 'laugh', L: 'up', R: 'wave', wv: q(f * 0.45, 1), blink: blinkAt(f, 12), bob: q(breath(f, 12), 3) }, [-59.3, 0, -45.7], { tint, s: 0.95, yaw: -0.4 }));
      out.push(R(T, KID1, { seed: 23, expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 23), bob: q(Math.abs(Math.sin(f * 0.3)) * 0.02, 3) }, [-58.7, 0, -45.0], { tint, s: 0.62, yaw: -0.5 }));
      out.push(R(T, KID2, { seed: 27, expr: 'grin', L: 'wave', R: 'up', wv: q(f * 0.5, 1), blink: blinkAt(f, 27), bob: q(breath(f, 27), 3) }, [-60.1, 0, -44.6], { tint, s: 0.58, yaw: 0.6 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'turn' && f >= 690) { // falling autumn leaves as he sets off
    for (let i = 0; i < 3; i++) {
      const ph = q(((f + i * 37) % 90) / 90, 2);
      out.push(FXC('leaf_' + i + '_' + ph, (p) => T.fxLeaf(p, ['#d98a3a', '#c46a2a', '#e8b45a'][i]), [23.4 + i * 1.3, 2.2 - ph * 1.9, 4.2 + i * 0.9], 0.3));
    }
  }
  if (S.id === 'rivers' && f < 788) { // swim splashes on the stroke cycle
    const t = q(((f % 22) / 22), 2);
    out.push(FXC('splash_' + t, (p) => T.fxSplash(p, t), [60.6, 0.02, 9.6], 0.36));
    const t2 = q(((f + 11) % 22) / 22, 2);
    out.push(FXC('splash2_' + t2, (p) => T.fxSplash(p, t2), [59.4, 0.0, 10.4], 0.28));
  }
  if (S.id === 'rivers' && f >= 788 && f % 46 < 20) { // desert dust puffs at his feet
    const t = q((f % 46) / 46, 2);
    out.push(FXC('dust_' + t, (p) => T.fxDust(p, t), [77.6, 0.1, 10.6], 0.55));
  }
  if (S.id === 'finale' && f >= 1445) { // letters fluttering down around the reunion
    for (let i = 0; i < 3; i++) {
      const ph = q(((f + i * 53) % 110) / 110, 2);
      out.push(FXC('letter_' + i + '_' + ph, (p) => T.fxLeaf(p, ['#f2ead2', '#e9dcba', '#ffffff'][i]), [-61 + i * 1.6, 2.6 - ph * 2.2, -43.6 - i * 0.5], 0.26));
    }
    if (f >= 1470 && f <= 1500) { const t = q((f - 1470) / 30, 2); out.push(FXC('burst_' + t, (p) => T.fxBurst(p, t, '#ffe9a8', 10, 30, 210), [-59.6, 1.2, -44.4], 0.8)); }
  }
  return out;
};
