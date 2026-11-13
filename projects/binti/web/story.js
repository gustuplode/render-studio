// Shot plan for "Binti Jua — The Gorilla Who Saved a Child" — timed to binti-voice
// (60.075 s, 30 fps, TOTAL 1802). One zoo enclosure set, ONE continuous camera flight:
// every section's first camera key == the previous section's last key (no cuts).
// Phrases: P1 0-146 | P2 175-316 | P3 351-461 | P4 499-599 | P5 621-709 | P6 732-811 |
// P7 829-938 | P8 969-1065 | P9 1095-1167 | P10 1197-1312 | P11 1339-1438 | P12 1461-1560 | P13 (TEASE) 1594-1756.
// Sections tile 0..1581 contiguously; inter-phrase gaps belong to the outgoing section.
// Set (built in main.js): pit floor y=0 at centre; visitor deck SOUTH at y=1.6 (z>5.4,
// railing at z=5.4, crowd behind it); rock back wall NORTH z=-7 with the keepers'
// door at x=-4.6; name easel (0.15,0,-4.9); carry easel (-3.9,0,-6.0);
// finale easel (3.55,0,-4.6). The hook is a flash-forward (boy down, Binti with him);
// P2 rewinds to the climb — the boy fades at the deck during the gap (worldAt-free,
// actor alpha), Binti walks back to her start while the camera swings south.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1802, DECK = 1.6;
export const SHOTS = [
  { id: 'hook', a: 0, b: 174, light: 'day' },
  { id: 'barrier', a: 175, b: 350, light: 'day' },
  { id: 'uncon', a: 351, b: 498, light: 'day' },
  { id: 'walk', a: 499, b: 620, light: 'day' },
  { id: 'pickup', a: 621, b: 731, light: 'warm' },
  { id: 'baby', a: 732, b: 828, light: 'warm' },
  { id: 'cradle', a: 829, b: 968, light: 'warm' },
  { id: 'carry', a: 969, b: 1094, light: 'warm' },
  { id: 'door', a: 1095, b: 1196, light: 'warm' },
  { id: 'hospital', a: 1197, b: 1338, light: 'golden' },
  { id: 'gentle', a: 1339, b: 1460, light: 'golden' },
  { id: 'finale', a: 1461, b: 1593, light: 'golden' },
  { id: 'tease', a: 1594, b: 1801, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2ea', ground: '#5a6a3a', hemi: 1.24, sun: '#fff3da', sunI: 2.2, fog: '#cfe0c8', fogNear: 45, fogFar: 380,
    skyTop: '#6f97cc', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.0032, sat: 1.05, vig: 0.2, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
  warm: { az: 112, el: 32, sky: '#c9c2a4', ground: '#5f6136', hemi: 1.18, sun: '#ffd9a0', sunI: 2.3, fog: '#ddd0a4', fogNear: 42, fogFar: 340,
    skyTop: '#7d90c2', skyHor: '#ffce96', sunDisc: '#ffe9bd', sunSize: 0.0032, sat: 1.07, vig: 0.23, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
  golden: { az: 95, el: 20, sky: '#d9b28c', ground: '#6a5a2c', hemi: 1.16, sun: '#ffb763', sunI: 2.5, fog: '#e5bd85', fogNear: 40, fogFar: 320,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.09, vig: 0.25, shadowExt: 16, aurora: 0, gain: '#ffedd6', ...WATER },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'pickup') return blendLight(LIGHTS.day, LIGHTS.warm, smooth(ramp(f, 621, 690)));
  if (S.id === 'hospital') return blendLight(LIGHTS.warm, LIGHTS.golden, smooth(ramp(f, 1197, 1270)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging tracks ----------
export const DOOR_POS = [-4.6, 0, -6.9];
export const BOY_PIT = [0.3, 0, 0.75];
export const BOY_DOOR = [-3.95, 0, -5.0];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

const BINTI_KEYS = [
  [0, [1.05, 0, 0.95]], [160, [1.05, 0, 0.95]],
  [235, [2.4, 0, -1.8], 'smooth'],
  [499, [2.4, 0, -1.8]],
  [599, [0.95, 0, 0.95], 'smooth'],
  [969, [0.95, 0, 0.95]],
  [1066, [-4.25, 0, -5.35], 'smooth', [[-1.6, 0, -2.7]]],
  [1140, [-4.25, 0, -5.35]],
  [1168, [-3.35, 0, -4.15], 'smooth'],
  [1197, [-3.35, 0, -4.15]],
  [1312, [0.9, 0, -0.9], 'smooth', [[-1.2, 0, -2.2]]],
  [1801, [0.9, 0, -0.9]],
];
export const bintiPosAt = (f) => kf3(BINTI_KEYS, f);
export const kokoPosAt = (f) => bintiPosAt(f); // fx emitter anchor (dust at Binti)

// the boy: full physical track — deck, climb, fall, lying, lift, carried, laid, out
export const boyAt = (f) => {
  const bp = bintiPosAt(f);
  const cradle = [bp[0], 0.58, bp[2] + 0.38];
  if (f < 160) return { pos: [...BOY_PIT], roll: 1.5, alpha: 1, blob: true, expr: 'dazed' };
  if (f < 180) return { pos: [...BOY_PIT], roll: 1.5, alpha: 1 - ramp(f, 160, 178), blob: true, expr: 'dazed' };
  if (f < 215) return { pos: [0.6, DECK, 6.7], roll: 0, alpha: ramp(f, 182, 198), blob: false, expr: 'smile' };
  if (f < 262) { // climb the railing and vault over it
    const pos = kf3([[215, [0.6, DECK, 6.7]], [240, [0.55, 1.7, 5.75], 'smooth'], [262, [0.5, 2.45, 5.15], 'smooth']], f);
    return { pos, roll: 0.15 * ramp(f, 240, 262), alpha: 1, blob: false, expr: 'nervous' };
  }
  if (f < 302) { // the fall: one smooth arc down to the pit floor
    const pos = kf3([[262, [0.5, 2.45, 5.15]], [302, [...BOY_PIT], 'smooth', [[0.45, 1.5, 3.3], [0.35, 0.45, 1.7]]]], f);
    return { pos, roll: lerp(0.15, 1.5, smooth(ramp(f, 268, 300))), alpha: 1, blob: f > 296, expr: 'shock' };
  }
  if (f < 630) return { pos: [...BOY_PIT], roll: 1.5, alpha: 1, blob: true, expr: 'dazed' };
  if (f < 674) { // the pick-up: continuous lift, synced with Binti's cradle bend
    const t = smooth(ramp(f, 630, 674));
    return { pos: lerp3(BOY_PIT, cradle, t), roll: lerp(1.5, 0.35, t), alpha: 1, blob: t < 0.06, expr: 'dazed' };
  }
  if (f < 1100) return { pos: cradle, roll: 0.35 + 0.03 * Math.sin(f * 0.07), alpha: 1, blob: false, expr: 'relief' };
  if (f < 1144) { // laid down by the door
    const t = smooth(ramp(f, 1100, 1144));
    return { pos: lerp3(cradle, BOY_DOOR, t), roll: lerp(0.35, 1.5, t), alpha: 1, blob: t > 0.94, expr: 'relief' };
  }
  if (f < 1212) return { pos: [...BOY_DOOR], roll: 1.5, alpha: 1, blob: true, expr: 'relief' };
  if (f < 1292) { // a keeper carries him out through the door (occluded by the wall)
    const t = smooth(ramp(f, 1212, 1280));
    const pos = lerp3(BOY_DOOR, [-4.6, 0.45, -7.4], t);
    return { pos, roll: lerp(1.5, 0.4, t), alpha: 1 - ramp(f, 1272, 1290), blob: false, expr: 'relief' };
  }
  return { pos: [-4.6, 0.45, -7.4], roll: 0.4, alpha: 0, blob: false, expr: 'relief' };
};
const keeperAt = (f, k) => {
  const door = k === 0 ? [-4.95, 0, -7.5] : [-4.25, 0, -7.6];
  const post = k === 0 ? [-5.0, 0, -4.55] : [-3.45, 0, -4.5];
  if (f < 1094) return door;
  if (f < 1170) return kf3([[1094, door], [1170, post, 'smooth', [[(door[0] + post[0]) / 2, 0, -6.0]]]], f);
  if (f < 1212) return post;
  if (f < 1292) return kf3([[1212, post], [1292, door, 'smooth', [[(door[0] + post[0]) / 2, 0, -6.0]]]], f);
  return door;
};
const gorillaFarAt = (f) => kf3([
  [0, [4.8, 0, -3.6]], [829, [4.8, 0, -3.6]],
  [882, [3.15, 0, -2.15], 'smooth'], [908, [3.15, 0, -2.15]],
  [938, [4.8, 0, -3.6], 'smooth'], [1801, [4.8, 0, -3.6]],
], f);

// ---------- cameras (boundary-matched continuous flight) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [0.7, 1.15, 3.6], look: [0.65, 1.0, 0.85], fov: 42 },
    { f: 80, pos: [0.7, 1.22, 3.05], look: [0.65, 1.02, 0.85], fov: 40, ease: 'surge' },
    { f: 174, pos: [0.75, 1.25, 3.0], look: [0.6, 1.0, 0.8], fov: 40 },
  ],
  barrier: [
    { f: 175, pos: [0.75, 1.25, 3.0], look: [0.6, 1.0, 0.8], fov: 40 },
    { f: 235, pos: [-1.6, 2.3, 1.2], look: [0.55, 2.0, 5.9], fov: 46, ease: 'surge' },
    { f: 262, pos: [-1.55, 2.3, 1.0], look: [0.5, 2.2, 5.0], fov: 44, ease: 'surge' },
    { f: 285, pos: [-1.5, 2.2, 0.4], look: [0.36, 0.6, 1.9], fov: 44, ease: 'surge' },
    { f: 315, pos: [-0.6, 2.0, -0.6], look: [0.31, 0.25, 0.78], fov: 44, ease: 'surge' },
    { f: 350, pos: [0.9, 1.8, -0.9], look: [0.32, 0.35, 0.8], fov: 44, ease: 'surge' },
  ],
  uncon: [
    { f: 351, pos: [0.9, 1.8, -0.9], look: [0.32, 0.35, 0.8], fov: 44 },
    { f: 420, pos: [0.15, 1.55, -2.6], look: [0.3, 0.45, 1.3], fov: 42, ease: 'surge' },
    { f: 498, pos: [0.55, 1.5, -2.1], look: [0.35, 0.55, 0.95], fov: 42 },
  ],
  walk: [
    { f: 499, pos: [0.55, 1.5, -2.1], look: [0.35, 0.55, 0.95], fov: 42 },
    { f: 560, pos: [1.9, 1.8, 5.6], look: [0.2, 1.15, -2.2], fov: 46, ease: 'surge' },
    { f: 620, pos: [1.85, 1.45, 4.1], look: [0.85, 1.0, 0.75], fov: 41 },
  ],
  pickup: [
    { f: 621, pos: [1.85, 1.45, 4.1], look: [0.85, 1.0, 0.75], fov: 41 },
    { f: 680, pos: [1.25, 1.18, 3.15], look: [0.8, 0.95, 0.8], fov: 39, ease: 'surge' },
    { f: 731, pos: [1.15, 1.2, 3.3], look: [0.8, 0.98, 0.8], fov: 40 },
  ],
  baby: [
    { f: 732, pos: [1.15, 1.2, 3.3], look: [0.8, 0.98, 0.8], fov: 40 },
    { f: 775, pos: [0.25, 1.5, 2.55], look: [0.95, 1.3, 0.55], fov: 38, ease: 'surge' },
    { f: 828, pos: [0.45, 1.45, 2.9], look: [0.9, 1.2, 0.6], fov: 39 },
  ],
  cradle: [
    { f: 829, pos: [0.45, 1.45, 2.9], look: [0.9, 1.2, 0.6], fov: 39 },
    { f: 895, pos: [2.5, 1.6, 5.0], look: [1.0, 1.0, 0.4], fov: 44, ease: 'surge' },
    { f: 968, pos: [2.3, 1.55, 4.8], look: [0.95, 1.0, 0.5], fov: 44 },
  ],
  carry: [
    { f: 969, pos: [2.3, 1.55, 4.8], look: [0.95, 1.0, 0.5], fov: 44 },
    { f: 1020, pos: [-1.4, 1.65, 3.6], look: [-2.4, 1.0, -2.2], fov: 44, ease: 'surge' },
    { f: 1095, pos: [-3.3, 1.5, 2.4], look: [-4.3, 0.95, -5.0], fov: 45 },
  ],
  door: [
    { f: 1095, pos: [-3.3, 1.5, 2.4], look: [-4.3, 0.95, -5.0], fov: 45 },
    { f: 1130, pos: [-3.5, 1.42, 2.0], look: [-4.35, 0.8, -5.2], fov: 43, ease: 'surge' },
    { f: 1196, pos: [-3.2, 1.5, 2.6], look: [-4.2, 0.9, -5.2], fov: 44 },
  ],
  hospital: [
    { f: 1197, pos: [-3.2, 1.5, 2.6], look: [-4.2, 0.9, -5.2], fov: 44 },
    { f: 1255, pos: [-2.2, 1.8, 4.4], look: [-3.4, 0.95, -4.4], fov: 46, ease: 'surge' },
    { f: 1285, pos: [0.2, 1.6, 4.8], look: [1.6, 1.0, -2.2], fov: 50, ease: 'surge' },
    { f: 1338, pos: [0.2, 1.6, 4.8], look: [1.6, 1.0, -2.2], fov: 50 },
  ],
  gentle: [
    { f: 1339, pos: [0.2, 1.6, 4.8], look: [1.6, 1.0, -2.2], fov: 50 },
    { f: 1400, pos: [0.85, 1.3, 3.55], look: [0.88, 1.05, -0.85], fov: 40, ease: 'surge' },
    { f: 1461, pos: [0.88, 1.3, 3.4], look: [0.88, 1.05, -0.85], fov: 40 },
  ],
  finale: [
    { f: 1461, pos: [0.88, 1.3, 3.4], look: [0.88, 1.05, -0.85], fov: 40 },
    { f: 1520, pos: [0.9, 1.28, 3.9], look: [0.9, 1.07, -0.85], fov: 41, ease: 'surge' },
    { f: 1593, pos: [0.92, 1.24, 3.25], look: [0.9, 1.08, -0.85], fov: 39 },
  ],
  tease: [
    { f: 1594, pos: [0.92, 1.24, 3.25], look: [0.9, 1.08, -0.85], fov: 39 },
    { f: 1700, pos: [0.9, 1.22, 2.8], look: [0.9, 1.1, -0.85], fov: 37, ease: 'surge' },
    { f: 1801, pos: [0.9, 1.2, 2.62], look: [0.9, 1.1, -0.85], fov: 36 },
  ],
};
const SHADOW_AT = { hook: [0.5, 0.8, 0.8], barrier: [0.4, 0.8, 3], uncon: [0.3, 0.6, 0.8], walk: [1.2, 0.8, 0], pickup: [0.9, 0.8, 0.9], baby: [0.95, 0.8, 0.9], cradle: [0.95, 0.8, 0.8], carry: [-2, 0.8, -2.5], door: [-4.2, 0.8, -5.2], hospital: [-1.5, 0.8, -2.5], gentle: [0.9, 0.8, -0.9], finale: [0.9, 0.9, -0.9], tease: [0.9, 0.9, -0.9] };
const shotCam = (id, f) => camFromKeys(CAMS[id], f);
export const camAt = (f) => {
  const S = shotAt(f);
  const c = shotCam(S.id, f);
  c.flash = f < 9 ? -0.95 * (1 - f / 9) : 0;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let point, cinf;
  switch (S.id) {
    case 'baby': point = [1.1, 1.35, 0.7]; cinf = 5; break;
    case 'pickup': case 'hook': point = [0.9, 1.0, 0.9]; cinf = 6; break;
    case 'door': case 'carry': point = [-4.2, 0.95, -5.2]; cinf = 7; break;
    case 'barrier': point = [0.5, 1.6, 5.6]; cinf = 7; break;
    default: point = [0.9, 1.0, 0]; cinf = 9;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, dust: 0.3, windK: 0.5, grassK: 0.6, boardName: 0, boardCarry: 0, boardFinale: 0, doorT: 0, glassT: 0.4 };
  switch (S.id) {
    case 'hook': W.dust = 0.22; break;
    case 'barrier': W.dust = 0.3; W.grassK = 0.85; break;
    case 'uncon': W.dust = 0.2; W.glassT = 0.7; break;
    case 'walk': W.boardName = smooth(ramp(f, 552, 564)) * (1 - smooth(ramp(f, 692, 712))); W.dust = 0.28; break;
    case 'pickup': W.boardName = 1 - smooth(ramp(f, 692, 712)); W.dust = 0.3; break;
    case 'baby': W.dust = 0.3; break;
    case 'cradle': W.dust = 0.3; break;
    case 'carry': W.boardCarry = smooth(ramp(f, 1012, 1032)); W.dust = 0.3; break;
    case 'door': W.boardCarry = 1 - smooth(ramp(f, 1172, 1192)); W.doorT = smooth(ramp(f, 1096, 1124)); W.dust = 0.26; break;
    case 'hospital': W.doorT = 1 - smooth(ramp(f, 1280, 1300)); W.boardFinale = smooth(ramp(f, 1298, 1318)) * (1 - smooth(ramp(f, 1326, 1338))); W.dust = 0.32; break;
    case 'gentle': W.dust = 0.3; break;
    case 'finale': W.dust = 0.28; W.windK = 0.4; break;
    case 'tease': W.dust = 0.3; W.windK = 0.4; break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'uncon': return { smokeRate: 0.5, dustRate: 0.2 };
    case 'finale': case 'gentle': case 'tease': return { smokeRate: 1.4, dustRate: 0.4 };
    default: return { smokeRate: 1.0, dustRate: 0.3 };
  }
};

// ---------- actors ----------
const TINT = { day: '#ffffff', warm: '#ffe9c4', golden: '#ffd9a3' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
const RK = (T, o, pos, extra = {}) => ({ key: 'koko' + JSON.stringify(o), draw: (p) => T.kokoCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RB = (T, o, pos, extra = {}) => ({ key: 'boy' + JSON.stringify(o), draw: (p) => T.boyCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RKP = (T, o, pos, extra = {}) => ({ key: 'keep' + JSON.stringify(o), draw: (p) => T.keeperCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RV = (T, o, pos, extra = {}) => ({ key: 'vis' + JSON.stringify(o), draw: (p) => T.visitorCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: DECK, shadow: false, ...extra });

const CROWD = [
  { x: -2.8, seed: 91, tunic: '#7a5a6e' }, { x: -1.2, seed: 97, tunic: '#54687e' },
  { x: 1.8, seed: 103, tunic: '#4a6a52' }, { x: 3.4, seed: 109, tunic: '#6e5636' },
];
export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  const bp = bintiPosAt(f);
  const moving = (f >= 499 && f < 599) || (f >= 969 && f < 1066) || (f >= 1140 && f < 1168) || (f >= 1197 && f < 1312);
  const bobB = moving ? q(0.012 * Math.abs(Math.sin(f * 0.32)), 3) : q(breath(f, 7), 3);

  // --- crowd on the south deck, behind the railing/glass (always present) ---
  const crowdExpr = S.id === 'uncon' || (S.id === 'barrier' && f > 262) ? 'shock' : S.id === 'hospital' || S.id === 'finale' ? 'smile' : 'neutral';
  CROWD.forEach((c, i) => {
    out.push(RV(T, { expr: crowdExpr, L: 'down', R: S.id === 'hospital' && i % 2 ? 'wave' : 'down', blink: 0, seed: c.seed, tunic: c.tunic },
      [c.x, DECK, 7.3], { tint: '#93a2b8', s: 0.95 }));
  });
  // --- distant gorillas, far east side (kept away in P7) ---
  const gf = gorillaFarAt(f);
  out.push(RK(T, { pose: f >= 829 && f <= 938 ? 'knuckle' : 'sit', expr: 'neutral', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3) }, gf, { tint: '#9aa0a8', s: 1.02 }));
  out.push(RK(T, { pose: 'sit', expr: 'neutral', blink: blinkAt(f, 27), bob: q(breath(f, 27), 3) }, [5.7, 0, -5.3], { tint: '#8b939c', s: 0.98 }));

  // --- Binti: pose by beat ---
  let pose = 'sit', expr = 'neutral';
  if (S.id === 'hook') { pose = 'cradle'; expr = 'smile'; }
  else if (S.id === 'barrier') { pose = 'sit'; expr = 'neutral'; }
  else if (S.id === 'uncon') { pose = 'sit'; expr = 'pained'; }
  else if (S.id === 'walk') { pose = f < 592 ? 'knuckle' : 'sit'; expr = 'neutral'; }
  else if (S.id === 'pickup' || S.id === 'baby' || S.id === 'cradle') { pose = 'cradle'; expr = 'smile'; }
  else if (S.id === 'carry') { pose = 'cradle'; expr = 'neutral'; }
  else if (S.id === 'door') { pose = f < 1144 ? 'cradle' : 'sit'; expr = 'smile'; }
  else if (S.id === 'hospital') { pose = f < 1212 ? 'sit' : 'knuckle'; expr = 'smile'; if (f >= 1292) pose = 'sit'; }
  else if (S.id === 'gentle') { pose = 'signC'; expr = 'smile'; }
  else if (S.id === 'finale' || S.id === 'tease') { pose = 'sit'; expr = 'smile'; }
  const rock = (pose === 'cradle' && f >= 674) ? q(0.022 * Math.sin(f * 0.07), 3) : 0;
  const bintiYaw = S.id === 'cradle' && f > 860 && f < 930 ? -0.35 : 0; // turns toward the approaching gorilla
  out.push(RK(T, { pose, expr, blink: blinkAt(f, 7), bob: bobB }, bp, { tint, s: S.id === 'hook' ? 1.18 : 1.12, roll: rock, yaw: bintiYaw }));
  // --- her baby, riding her back the whole time ---
  out.push(RK(T, { pose: 'sit', expr: 'smile', blink: blinkAt(f, 13), bob: bobB, young: 1 },
    [bp[0] + 0.3, 1.14, bp[2] - 0.2], { tint, s: 0.42, blob: false, order: 3 }));

  // --- the boy ---
  const B = boyAt(f);
  if (B.alpha > 0.01) {
    out.push(RB(T, { expr: B.expr, blink: B.expr === 'dazed' ? 1 : blinkAt(f, 31) },
      B.pos, { tint, s: 0.5, roll: q(B.roll, 3), alpha: q(B.alpha, 3), blob: B.blob, ground: B.pos[1] > 1 ? DECK : 0, order: 4 }));
  }
  // --- keepers (enter through the door in P9, carry the boy out in P10) ---
  if (f >= 1080 && f <= 1300) {
    for (let k = 0; k < 2; k++) {
      const kp = keeperAt(f, k);
      const kMoving = (f >= 1094 && f < 1170) || (f >= 1212 && f < 1292);
      out.push(RKP(T, { expr: 'smile', L: 'belly', R: 'belly', blink: blinkAt(f, 53 + k * 6), bob: q(breath(f, 53 + k * 6), 3), step: kMoving ? q((f % 16) / 16, 2) : 0 },
        kp, { tint, s: 0.98, yaw: k === 0 ? 0.3 : -0.3 }));
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
export const fxAt = (f, T) => [];
