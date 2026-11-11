// Shot plan for "Barry — The Dog Who Saved 40 Lives" — timed to barry-voice
// (48.55 s, 30 fps, TOTAL 1456). True story: St Bernard of the Great St Bernard
// Hospice, Swiss Alps — rescued 40+ travellers from the snow.
// Sections (voice phrases, contiguous):
//  S1 hook 0-132 | S2 hospice 133-268 | S3 blizzard/buried 269-398 | S4 patrol 399-504
//  S5 close-up 505-630 | S6 search 631-763 | S7 rescue 764-899 | S8 count drone 900-1037
//  S9 barrel legend 1038-1137 | S10 old Barry 1138-1277 | S11 museum 1278-1455
// World (built in main.js): hospice at (0,0,-11), front face z=-8, door (0,0,-7.9).
// Trail runs +z from the door: paw-print path to the rescue drift at (3,0,14.5).
// Museum hall centred (40,0,40): plinth top y=1.02 at (40,0,40), finale board (40,0,45.6).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30, TOTAL = 1456, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 132, light: 'dawn' },
  { id: 'hospice', a: 133, b: 268, light: 'day' },
  { id: 'blizzard', a: 269, b: 398, light: 'whiteout' },
  { id: 'patrol', a: 399, b: 504, light: 'day' },
  { id: 'closeup', a: 505, b: 630, light: 'day' },
  { id: 'search', a: 631, b: 763, light: 'whiteout' },
  { id: 'rescue', a: 764, b: 899, light: 'dusk' },
  { id: 'count', a: 900, b: 1037, light: 'day' },
  { id: 'barrel', a: 1038, b: 1137, light: 'day' },
  { id: 'old', a: 1138, b: 1277, light: 'dusk' },
  { id: 'museum', a: 1278, b: 1455, light: 'museum' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#24384a', waterShal: '#3a5a74', glint: '#dfeaff' };
export const LIGHTS = {
  dawn: { az: 105, el: 18, sky: '#8fa3c8', ground: '#4a4238', hemi: 1.0, sun: '#ffc98a', sunI: 2.0, fog: '#b9c4d6', fogNear: 30, fogFar: 300,
    skyTop: '#4d6ea6', skyHor: '#f2cf9e', sunDisc: '#fff0c8', sunSize: 0.0032, sat: 1.05, vig: 0.26, shadowExt: 16, aurora: 0, ...WATER },
  day: { az: 130, el: 36, sky: '#aebfe0', ground: '#5a6a80', hemi: 1.12, sun: '#fff1d6', sunI: 1.95, fog: '#c3cfdf', fogNear: 42, fogFar: 330,
    skyTop: '#6f97cc', skyHor: '#dfe9f2', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.03, vig: 0.2, shadowExt: 18, aurora: 0, ...WATER },
  whiteout: { az: 200, el: 26, sky: '#7e8ea8', ground: '#2e3442', hemi: 0.72, sun: '#c9d6ee', sunI: 1.0, fog: '#aebdd2', fogNear: 7, fogFar: 88,
    skyTop: '#5d6f8c', skyHor: '#c8d4e4', sunDisc: '#e8eeff', sunSize: 0.0026, sat: 0.97, vig: 0.34, shadowExt: 14, aurora: 0, ...WATER },
  dusk: { az: 95, el: 13, sky: '#7d86b0', ground: '#463a30', hemi: 0.88, sun: '#ffb877', sunI: 1.9, fog: '#c2a68c', fogNear: 26, fogFar: 260,
    skyTop: '#3d4a78', skyHor: '#f7bd85', sunDisc: '#ffe9bd', sunSize: 0.0034, sat: 1.05, gain: '#ffedd2', vig: 0.27, shadowExt: 16, aurora: 0, ...WATER },
  museum: { az: 60, el: 42, sky: '#8a7a68', ground: '#2e2620', hemi: 0.95, sun: '#ffd9a0', sunI: 1.7, fog: '#4a3d31', fogNear: 30, fogFar: 190,
    skyTop: '#3a3230', skyHor: '#6e5c49', sunDisc: '#ffe9bd', sunSize: 0.0028, sat: 1.04, gain: '#ffedd2', vig: 0.3, shadowExt: 13, aurora: 0, ...WATER },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (A[k] === undefined) o[k] = B[k];
    else if (B[k] === undefined) o[k] = A[k];
    else o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  }
  o.sunI = o.sunI * (1 - 0.4 * Math.sin(Math.PI * t));
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'rescue') return blendLight(LIGHTS.whiteout, LIGHTS.dusk, smooth(ramp(f, 790, 899)));
  if (S.id === 'count') return blendLight(LIGHTS.dusk, LIGHTS.day, smooth(ramp(f, 900, 960)));
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const DOOR = [0, 0, -7.6];              // hospice door spot (cards stand just in front)
export const HERO = [0, 0, -1];                // Barry's hero mark, south of the hospice
export const BURIED = [3.1, 0, 14.6];          // the buried traveller
export const MUSEUM = [40, 0, 40];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

// ---------- the count proof (S8): 0 -> 40 -> "40+" ----------
export const countAt = (f) => {
  if (f < 910) return 0;
  if (f >= 990) return 40;
  return Math.min(40, Math.floor((f - 910) / 2) + 1);
};
export const countLabelAt = (f) => (f >= 990 && shotAt(f).id === 'count' ? '40+' : String(countAt(f)));
/** 40 rescued-traveller markers spread over the pass (drone proof layout). */
export const markersLayout = (f) => {
  const out = [], act = shotAt(f).id === 'count' ? countAt(f) : 0;
  for (let i = 0; i < 40; i++) {
    const t = i / 39, col = i % 5, row = (i / 5) | 0;
    out.push({ x: -3.4 + col * 1.7 + ((i * 7) % 3 - 1) * 0.3, z: 0.5 + row * 2.2 + (i % 3) * 0.25, active: i < act, pulse: 0.5 + 0.5 * Math.sin(f * 0.22 + i * 1.3) });
  }
  return out;
};

// ---------- Barry's position per frame (sweep + powder FX reference) ----------
export const heroPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': case 'closeup': case 'barrel': return [...HERO];
    case 'patrol': return [0.9, 0, -6.2];
    case 'search': return kf3([[631, [0, 0, 3]], [700, [1.2, 0, 9], 'easeInOut'], [763, [2.4, 0, 14.6], 'easeInOut']], f);
    case 'rescue': case 'count': return [2.0, 0, 13.6];
    case 'old': return kf3([[1138, [0, 0, -6.4]], [1210, [0.3, 0, -2.6], 'easeInOut'], [1277, [0.6, 0, 1.8], 'easeInOut']], f);
    case 'museum': return [40, 1.02, 40];
    default: return null;
  }
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [0.45, 1.18, 3.8], look: [0, 0.95, -1], fov: 40 },
    { f: 110, pos: [0.25, 1.06, 2.7], look: [0, 0.98, -1], fov: 38, ease: 'surge' },
    { f: 132, pos: [0.2, 1.04, 2.55], look: [0, 0.98, -1], fov: 37.5 },
  ],
  hospice: [
    { f: 133, pos: [8.5, 4.2, 6.5], look: [-0.5, 2.4, -10], fov: 46 },
    { f: 240, pos: [7.6, 3.8, 4.6], look: [-0.4, 2.35, -10.1], fov: 45, ease: 'surge' },
    { f: 268, pos: [7.4, 3.75, 4.3], look: [-0.4, 2.35, -10.1], fov: 44.5 },
  ],
  blizzard: [
    { f: 269, pos: [-2.6, 1.95, 6.8], look: [3.0, 0.35, 14.4], fov: 43 },
    { f: 370, pos: [-1.5, 1.65, 9.3], look: [3.05, 0.4, 14.5], fov: 41, ease: 'surge' },
    { f: 398, pos: [-1.4, 1.62, 9.5], look: [3.05, 0.4, 14.5], fov: 40.5 },
  ],
  patrol: [
    { f: 399, pos: [5.2, 2.1, 3.0], look: [-0.5, 1.05, -6.9], fov: 43 },
    { f: 480, pos: [4.8, 2.0, 2.2], look: [-0.45, 1.05, -6.9], fov: 42, ease: 'surge' },
    { f: 504, pos: [4.7, 1.95, 2.05], look: [-0.45, 1.05, -6.9], fov: 42 },
  ],
  closeup: [
    { f: 505, pos: [4.7, 1.95, 2.05], look: [-0.45, 1.05, -6.9], fov: 42 },
    { f: 548, pos: [0.6, 1.2, 2.35], look: [0.02, 1.0, -1], fov: 39.5, ease: 'surge' },
    { f: 590, pos: [0.5, 1.17, 2.32], look: [0.02, 1.0, -1], fov: 40, ease: 'surge' },
    { f: 630, pos: [0.45, 1.15, 2.3], look: [0.02, 1.0, -1], fov: 40 },
  ],
  search: [
    { f: 631, pos: [-3.6, 1.4, -0.4], look: [0.0, 0.55, 3.55], fov: 41 },
    { f: 700, pos: [-2.9, 1.35, 5.2], look: [1.03, 0.5, 9.62], fov: 40.5, ease: 'surge' },
    { f: 763, pos: [-2.2, 1.3, 10.6], look: [2.25, 0.5, 15.05], fov: 40 },
  ],
  rescue: [
    { f: 764, pos: [-2.2, 1.3, 10.6], look: [2.25, 0.5, 15.05], fov: 40 },
    { f: 825, pos: [-1.7, 1.5, 10.0], look: [2.6, 0.6, 14.3], fov: 39.5, ease: 'surge' },
    { f: 875, pos: [-1.3, 1.55, 10.4], look: [2.65, 0.6, 14.25], fov: 39, ease: 'surge' },
    { f: 899, pos: [-1.25, 1.56, 10.5], look: [2.65, 0.6, 14.25], fov: 38.8 },
  ],
  count: [
    { f: 900, pos: [-1.25, 1.56, 10.5], look: [2.65, 0.6, 14.25], fov: 38.8 },
    { f: 920, pos: [-1.4, 1.7, 10.9], look: [2.5, 0.58, 14.1], fov: 40 },
    { f: 990, pos: [-4.2, 11.5, 21.5], look: [0, 0, 10.8], fov: 49, ease: 'surge' },
    { f: 1037, pos: [-1.15, 2.6, 11.6], look: [2.75, 0.5, 14.35], fov: 42, ease: 'surge' },
  ],
  barrel: [
    { f: 1038, pos: [0.5, 1.9, 5.4], look: [-0.05, 0.85, -0.9], fov: 44 },
    { f: 1090, pos: [0.48, 1.75, 4.7], look: [-0.02, 0.9, -0.95], fov: 42, ease: 'surge' },
    { f: 1112, pos: [0.45, 1.15, 2.3], look: [0.02, 1.0, -1], fov: 40, ease: 'surge' },
    { f: 1137, pos: [0.44, 1.14, 2.25], look: [0.02, 1.0, -1], fov: 39.5 },
  ],
  old: [
    { f: 1138, pos: [-3.5, 1.65, -1.2], look: [0.15, 0.85, -4.9], fov: 41 },
    { f: 1210, pos: [-3.4, 1.6, 3.4], look: [0.4, 0.85, -1.4], fov: 40, ease: 'surge' },
    { f: 1277, pos: [-3.3, 1.55, 6.8], look: [0.6, 0.85, 1.0], fov: 39 },
  ],
  museum: [
    { f: 1278, pos: [40, 2.35, 52.0], look: [40.1, 1.3, 41.2], fov: 40 },
    { f: 1400, pos: [40, 2.25, 51.2], look: [40.1, 1.32, 41.2], fov: 39, ease: 'surge' },
    { f: 1455, pos: [40, 2.22, 51.0], look: [40.1, 1.32, 41.2], fov: 38.5 },
  ],
};
const SHADOW_AT = { hook: HERO, hospice: [0, 1, -8], blizzard: BURIED, patrol: DOOR, closeup: HERO, search: [1.5, 0, 10], rescue: BURIED, count: [0, 0, 10], barrel: HERO, old: [0, 0, -3], museum: MUSEUM };
const BRIDGES = {}; // location changes are dip-masked cuts (Balto pattern); shared-location moves start on the previous section's last key (closeup, rescue, count)
const DIPS = [133, 269, 399, 631, 1038, 1138, 1278];
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
  if (S.id === 'blizzard' || S.id === 'search') { // wind buffet in the storm
    const amp = S.id === 'blizzard' ? 0.013 : 0.01;
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
    case 'hook': point = [0, 1, -1]; cinf = 9; break;
    case 'hospice': point = [0, 2, -9]; cinf = 6; break;
    case 'blizzard': point = [3.05, 0.5, 14.5]; cinf = 5; break;
    case 'patrol': point = [0, 1, -6.8]; cinf = 8; break;
    case 'closeup': point = [0, 1, -1]; cinf = 11; break;
    case 'search': point = heroPosAt(f) || [1, 0, 9]; cinf = 8; break;
    case 'rescue': point = [2.6, 0.55, 14.2]; cinf = 8; break;
    case 'count': point = f < 1010 ? [0, 0, 10] : [2.4, 0.5, 14.2]; cinf = f < 1010 ? 3 : 6; break;
    case 'barrel': point = [0.02, 1.03, -1]; cinf = 10; break;
    case 'old': point = heroPosAt(f) || HERO; cinf = 8; break;
    case 'museum': point = [40, 1.9, 40]; cinf = 4.5; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state (drives set pieces + FX in main.js) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lanternSet: [], mist: 0.15, snowK: 0.5, windK: 0.6, starK: 0, winGlow: 0.7, count: countAt(f), countLabel: countLabelAt(f), barrelGlint: 0, rescueLamp: 0, glintK: 0 };
  switch (S.id) {
    case 'hook': W.lanternSet = [0, 1]; W.mist = 0.3; W.snowK = 0.65; W.windK = 1.1; W.winGlow = 0.9; break;
    case 'hospice': W.lanternSet = [0, 1]; W.mist = 0.2; W.snowK = 0.45; W.windK = 0.7; W.winGlow = 1; break;
    case 'blizzard': W.mist = 0.95; W.snowK = 1; W.windK = 3.4; W.winGlow = 0.3; break;
    case 'patrol': W.lanternSet = [0, 1]; W.mist = 0.25; W.snowK = 0.5; W.windK = 0.8; W.winGlow = 0.95; break;
    case 'closeup': W.lanternSet = [0]; W.mist = 0.2; W.snowK = 0.5; W.windK = 0.8; W.winGlow = 0.8; W.glintK = 0.5 + 0.5 * Math.sin(f * 0.2); break;
    case 'search': W.mist = 0.8; W.snowK = 0.95; W.windK = 2.8; W.winGlow = 0.3; break;
    case 'rescue': W.lanternSet = [2, 3]; W.mist = lerp(0.6, 0.3, ramp(f, 764, 899)); W.snowK = lerp(0.85, 0.5, ramp(f, 764, 899)); W.windK = lerp(2.2, 0.9, ramp(f, 764, 899)); W.winGlow = 0.6; W.rescueLamp = smooth(ramp(f, 800, 850)); break;
    case 'count': W.mist = 0.25; W.snowK = 0.55; W.windK = 1.0; W.winGlow = 0.8; W.lanternSet = [0, 1, 2, 3]; break;
    case 'barrel': W.lanternSet = [0]; W.mist = 0.15; W.snowK = 0.45; W.windK = 0.7; W.winGlow = 0.85; W.barrelGlint = 0.55 + 0.45 * Math.sin(f * 0.3); break;
    case 'old': W.lanternSet = [0, 1]; W.mist = 0.2; W.snowK = 0.4; W.windK = 0.6; W.winGlow = 0.9; break;
    case 'museum': W.mist = 0.02; W.snowK = 0; W.windK = 0; W.winGlow = 0.2; W.glintK = f > 1380 ? 0.8 : 0.3; break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'blizzard': case 'search': return { fireRate: 0, fireScale: 0, smokeRate: 1.2 };
    case 'museum': return { fireRate: 0, fireScale: 0, smokeRate: 0 };
    default: return { fireRate: 0, fireScale: 0, smokeRate: 2.4 };
  }
};

// ---------- actors (2D cards) ----------
const MONK = (parka) => parka || '#5d4030';
const TRAVELLER = { tunic: '#46586a', skin: '#f0c297', hair: '#3b2a20' };
const VISITOR_M = { tunic: '#54687e', skin: '#ecd0b6', hair: '#241a14', stout: true };
const KID = { tunic: '#b8524a', skin: '#f5c9a0', hair: '#3b2a20' };
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'obj') + JSON.stringify(o) + JSON.stringify(who), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const MK = (T, o, pos, extra = {}) => ({ key: 'monk' + JSON.stringify(o), draw: (p) => T.musherFront(p, { parka: MONK(o.parka), ...o }), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const BD = (T, o, pos, extra = {}) => ({ key: 'barry' + JSON.stringify(o), draw: (p) => T.barryCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const BOARD = (T, lines, pos, extra = {}) => ({ key: 'board' + lines.join('|'), draw: (p) => T.boardCard(p, { lines }), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], blob: false, ...extra });
const TINT = { dawn: '#ffe2b8', day: '#ffffff', whiteout: '#d5e2f2', dusk: '#ffd9ae', museum: '#ffe9c4' };
const tintFor = (S, f) => S.id === 'rescue' ? (f < 840 ? TINT.whiteout : TINT.dusk) : S.id === 'count' ? (f < 960 ? TINT.dusk : TINT.day) : (TINT[S.light] || '#ffffff');

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S, f);
  switch (S.id) {
    case 'hook': {
      out.push(BD(T, { view: 'front', pant: f > 60 ? 1 : 0 }, [...HERO], { tint, s: 1.18, roll: kf([[0, 0], [60, -0.015], [132, 0]], f) }));
      out.push(MK(T, { seed: 31, expr: 'smile', L: 'belly', R: 'belly', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-1.7, 0, -6.9], { tint, s: 0.92 }));
      break;
    }
    case 'hospice': {
      out.push(MK(T, { seed: 31, expr: 'stern', L: 'hang', R: 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-0.9, 0, -7.3], { tint, s: 0.95, yaw: 0.3 }));
      out.push(MK(T, { seed: 47, expr: 'neutral', L: 'belly', R: 'belly', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3), parka: '#4c3828' }, [1.1, 0, -7.4], { tint, s: 0.93, yaw: -0.2 }));
      out.push(BD(T, { view: 'front' }, [4.3, 0, -4.6], { tint, s: 0.72 }));
      out.push(BD(T, { view: 'side', furC: '#e9e2d2' }, [-3.3, 0, -5.2], { tint, s: 0.62, flip: true }));
      break;
    }
    case 'blizzard': {
      // the traveller, buried: sunk deep in the drift — head, shoulders and one arm out of the snow
      out.push(MK(T, { seed: 62, expr: 'shock', L: 'up', R: 'hang', blink: 1, parka: '#44586a', bob: 0 }, [3.1, -1.05, 14.6], { tint, s: 0.95, yaw: 0.2, blob: false }));
      break;
    }
    case 'patrol': {
      out.push(MK(T, { seed: 31, expr: 'stern', L: 'hold', R: 'hold', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-1.3, 0, -6.9], { tint, s: 0.97 }));
      out.push(MK(T, { seed: 47, expr: 'neutral', L: 'hang', R: 'point', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3), parka: '#4c3828' }, [-2.2, 0, -6.4], { tint, s: 0.94, yaw: 0.25 }));
      out.push(BD(T, { view: 'front', pant: 1 }, [0.9, 0, -6.2], { tint, s: 0.95 }));
      out.push(BD(T, { view: 'side' }, [1.55, 0, -5.4], { tint, s: 0.66, yaw: -0.3 }));
      break;
    }
    case 'closeup': {
      out.push(BD(T, { view: 'front', pant: f > 555 ? 1 : 0, bark: 0 }, [...HERO], { tint, s: 1.38, roll: kf([[505, 0], [560, 0.014], [630, 0]], f) }));
      out.push(MK(T, { seed: 31, expr: 'smile', L: 'belly', R: 'belly', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-2.3, 0, -6.8], { tint, s: 0.9 }));
      break;
    }
    case 'search': {
      const pos = heroPosAt(f);
      const ph = q((f * 0.045) % 1, 2);
      const hd = q(0.35 + 0.45 * (0.5 + 0.5 * Math.sin(f * 0.05)), 2);
      out.push(BD(T, { view: 'side', step: ph, headDown: hd, pant: 1 }, pos, { tint, s: 1.22 }));
      break;
    }
    case 'rescue': {
      // the man, dug out: sitting up against the drift, weak but alive
      out.push(MK(T, { seed: 62, expr: f > 850 ? 'relief' : 'pained', L: 'hang', R: 'belly', blink: blinkAt(f, 62), parka: '#44586a', bob: q(breath(f, 62), 3) }, [3.35, 0, 14.9], { tint, s: 0.92, yaw: -0.25 }));
      // Barry lying warm against him, barking for the monks
      const bark = (f % 36) < 16 ? 1 : 0;
      out.push(BD(T, { view: 'lying', bark }, [1.95, 0, 13.55], { tint, s: 0.98, yaw: 0.35 }));
      // monks hurry in with a lantern
      const mp = kf3([[764, [1.4, 0, 6.2]], [850, [1.5, 0, 10.4], 'easeInOut'], [899, [1.55, 0, 12.2]]], f);
      const walking = f < 852;
      out.push(MK(T, { seed: 31, expr: 'stern', L: 'hold', R: 'hold', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3), step: q(walking ? kf([[764, 0], [852, 5.2]], f) : 0) }, mp, { tint, s: 0.97 }));
      const mp2 = kf3([[764, [0.2, 0, 5.4]], [860, [0.35, 0, 10.0], 'easeInOut'], [899, [0.4, 0, 11.9]]], f);
      out.push(MK(T, { seed: 47, expr: 'nervous', L: 'hang', R: 'up', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3), parka: '#4c3828', step: q(walking ? kf([[764, 0], [860, 5.6]], f) : 0) }, mp2, { tint, s: 0.94 }));
      break;
    }
    case 'count': {
      out.push(BD(T, { view: 'lying', bark: (f % 36) < 16 && f < 930 ? 1 : 0 }, [1.95, 0, 13.55], { tint, s: 0.98, yaw: 0.35 }));
      out.push(MK(T, { seed: 62, expr: 'relief', L: 'hang', R: 'belly', blink: blinkAt(f, 62), parka: '#44586a', bob: q(breath(f, 62), 3) }, [3.35, 0, 14.9], { tint, s: 0.92, yaw: -0.25 }));
      if (f >= 965 && f <= 1008) out.push({ key: 'count' + countLabelAt(f), draw: (p) => T.countBoardCard(p, { label: countLabelAt(f) }), x: 0.2, y: 0, z: 14.8, s: 2.0, ground: 0, blob: false, shadow: false });
      break;
    }
    case 'barrel': {
      out.push(BD(T, { view: 'front', pant: 0 }, [...HERO], { tint, s: 1.3 }));
      out.push(BOARD(T, ['A LEGEND'], [0, 0, 1.9], { tint, s: 0.72, yaw: 0 }));
      break;
    }
    case 'old': {
      const pos = heroPosAt(f);
      const ph = q((f * 0.026) % 1, 2); // slow old-dog walk
      out.push(BD(T, { view: 'side', step: ph, age: 'old', pant: 0 }, pos, { tint, s: 0.95 }));
      const m1 = kf3([[1138, [-1.2, 0, -8.6]], [1210, [-1.0, 0, -4.8], 'easeInOut'], [1277, [-0.8, 0, -0.6], 'easeInOut']], f);
      out.push(MK(T, { seed: 31, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3), step: q(kf([[1138, 0], [1277, 4.4]], f)) }, m1, { tint, s: 0.96 }));
      const m2 = kf3([[1138, [1.7, 0, -9.0]], [1210, [1.8, 0, -5.2], 'easeInOut'], [1277, [1.9, 0, -1.0], 'easeInOut']], f);
      out.push(MK(T, { seed: 47, expr: 'neutral', L: 'belly', R: 'belly', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3), parka: '#4c3828', step: q(kf([[1138, 0], [1277, 4.4]], f)) }, m2, { tint, s: 0.93 }));
      break;
    }
    case 'museum': {
      out.push(BD(T, { view: 'front', statue: 1 }, [40, 1.02, 40], { tint, s: 1.08, ground: 1.02 }));
      out.push(R(T, KID, { seed: 23, expr: 'grin', L: 'hang', R: 'point', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3), headTilt: -6 }, [38.9, 0, 43.2], { tint, s: 0.62, yaw: 0.15 }));
      out.push(R(T, 'civB', { seed: 14, expr: 'smile', L: 'belly', R: 'belly', blink: blinkAt(f, 14), bob: q(breath(f, 14), 3), headTilt: -4 }, [41.2, 0, 43.4], { tint, s: 0.95, yaw: -0.12 }));
      out.push(R(T, VISITOR_M, { seed: 19, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 19), bob: q(breath(f, 19), 3), headTilt: -3 }, [39.0, 0, 42.2], { tint, s: 0.9, yaw: 0.05 }));
      out.push(BOARD(T, ['MORE THAN 40 LIVES.', 'ONE DOG.'], [40, 0, 44.6], { tint: '#ffffff', s: 1.02, yaw: 0 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: pos[1], ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'closeup') { // warm breath puffs in the cold air
    const t = q(((f / 52) % 1), 2);
    out.push(FXC('breath_' + t, (p) => T.fxPuff(p, t), [0.55, 1.15, -1.6], 0.34));
  }
  if (S.id === 'rescue' && f >= 780 && f <= 806) { // powder burst as Barry digs / shakes off snow
    const t = q((f - 780) / 26, 2);
    out.push(FXC('dig_' + t, (p) => T.fxBurst(p, t, '#eef4fb', 9, 26, 170), [2.6, 0.7, 14.0], 0.7));
  }
  return out;
};
