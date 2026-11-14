// Shot plan for "The Thief the Guards Let In" (batch-2 topic 1, EN) —
// timed to the ACTUAL voice stem (52.29 s, 30 fps, TOTAL 1569), clause
// timings from faster-whisper alignment (match_ratio 1.000, 24 clauses):
// C1 0-103 hook Q | C2 116-175 guards opened | C3 175-197 with a bow |
// C4 218-284 watched 7 days | C5 298-358 treasurer arrives 6pm |
// C6 374-428 green coat/white cap/seal ring | C7 437-467 counted & left |
// C8 487-535 coat stitched | C9 539-555 white cap | C10 564-646 wax ring |
// C11 659-736 eighth evening | C12 749-770 dressed as treasurer |
// C13 781-823 letter w/ king's seal | C14 823-897 send ten bags |
// C15 916-955 bowed, turned keys | C16 958-1010 opened every lock |
// C17 1027-1082 ten bags on cart | C18 1091-1135 guards push it out |
// C19 1148-1204 real treasurer | C20 1216-1246 faces white |
// C21 1261-1298 "you just left!" | C22 1316-1398 next village boy |
// C23 1414-1507 one coin, giant hall | C24 1523-1556 what could he buy?
// QUALITY RULES (owner, batch-2): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes (camFromKeys creep + always a key move), never drifts;
// characters act in place — travel only via foot-locked march (walk());
// costumes by role; treasurer & disguised thief wear the IDENTICAL outfit.
// World: treasury gate x=0 (facade z=-3.2), counting chamber x=-16,
// thief's hut x=+16, landlord's hall x=+32.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1569, DECK = 0;
export const SHOTS = [
  { id: 'hookQ', a: 0, b: 115, light: 'dusk' },
  { id: 'letIn', a: 116, b: 217, light: 'dusk' },
  { id: 'watch', a: 218, b: 297, light: 'dusk' },
  { id: 'arrive', a: 298, b: 373, light: 'dusk' },
  { id: 'costume', a: 374, b: 436, light: 'lamp' },
  { id: 'count', a: 437, b: 486, light: 'lamp' },
  { id: 'stitch', a: 487, b: 563, light: 'lamp' },
  { id: 'carve', a: 564, b: 658, light: 'lamp' },
  { id: 'eighth', a: 659, b: 780, light: 'dusk' },
  { id: 'letter', a: 781, b: 915, light: 'dusk' },
  { id: 'bowkeys', a: 916, b: 1026, light: 'dusk' },
  { id: 'load', a: 1027, b: 1147, light: 'dusk' },
  { id: 'real', a: 1148, b: 1315, light: 'dusk' },
  { id: 'hook', a: 1316, b: 1568, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
  lamp: { az: 70, el: 34, sky: '#8a6a4c', ground: '#3c2c1e', hemi: 0.88, sun: '#ffc37a', sunI: 1.9, fog: '#caa27a', fogNear: 30, fogFar: 210,
    skyTop: '#3c3a55', skyHor: '#caa27a', sunDisc: '#ffe9c0', sunSize: 0.0026, sat: 1.05, vig: 0.3, shadowExt: 14, aurora: 0, gain: '#ffe2b8', ...WATER },
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
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
  if (S.id === 'hook') return blendLight(LIGHTS.dusk, LIGHTS.day, smooth(ramp(f, 1330, 1420)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const GATE = [0, 0, -3.2];
export const CHAMBER = [-16, 0, -5.2];
export const HUT = [16, 0, -1.6];
export const HALL = [32, 0, -6];
export const RINGP = [-15.2, 0.86, -4.6];   // seal ring on its cushion (chamber table)
export const WAXP = [15.8, 0.82, -0.85];    // wax ring copy (hut table)
export const LETTERP = [0.88, 1.38, 1.3];   // forged letter, held up at the gate
export const COINP = [30.82, 1.12, -0.95];  // the boy's single coin
export const CART0 = [5.8, 0, 2.8];   // parked at the courtyard's east side (never blocks the gate)        // cart start (outside the gate)

/** Cart travel distance (m) — 0 until the push-out beat, then rolls east. */
export const cartDAt = (f) => kf([[1091, 0], [1147, 3.6, 'easeInOut']], f);
export const cartPosAt = (f) => { const d = cartDAt(f); return [CART0[0] + d, 0, CART0[2] + d * 0.45]; };

const HERO = {
  hookQ: () => [0, 1.35, -2.9],
  letIn: (f) => lerp3([0, 1.1, 0.9], [0, 1.0, -1.9], smooth(ramp(f, 180, 200))),
  watch: () => [-6.7, 1.1, 0.3],
  arrive: () => [0.8, 1.1, 0.6],
  costume: (f) => lerp3([-16, 1.3, -5.5], [...RINGP], smooth(ramp(f, 414, 430))),
  count: () => [-16, 1.1, -5.4],
  stitch: (f) => lerp3([17.1, 1.1, -1.6], [16.55, 0.82, -0.9], smooth(ramp(f, 539, 555))),
  carve: (f) => lerp3([15.4, 1.0, -1.6], [...WAXP], smooth(ramp(f, 610, 640))),
  eighth: () => [0, 1.1, 0.9],
  letter: () => [...LETTERP],
  bowkeys: (f) => lerp3([0, 1.0, -2.0], [0.2, 1.35, -2.9], smooth(ramp(f, 958, 985))),
  load: (f) => { const c = cartPosAt(f); return [c[0], 0.9, c[2]]; },
  real: (f) => lerp3([0.8, 1.1, 0.6], [-0.6, 1.1, -1.7], smooth(ramp(f, 1225, 1252))),
  hook: () => [30.5, 1.0, -1.2],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Between clauses inside one shot
// (e.g. letIn C2->C3, letter C13->C14) a key lands exactly on the clause
// boundary frame.
const CAMS = {
  hookQ: [
    { f: 0, pos: [8.6, 3.8, 12.6], look: [0, 1.9, -3.0], fov: 46 },
    { f: 55, pos: [4.8, 2.55, 6.0], look: [0, 1.6, -3.0], fov: 42, ease: 'surge' },
    { f: 115, pos: [1.6, 1.7, 1.3], look: [0, 1.35, -2.95], fov: 36, ease: 'surge' },
  ],
  letIn: [
    { f: 116, pos: [1.6, 1.7, 1.3], look: [0, 1.35, -2.95], fov: 36 },
    { f: 150, pos: [3.4, 2.0, 4.6], look: [0, 1.15, 0.6], fov: 40, ease: 'surge' },
    { f: 175, pos: [3.0, 1.9, 4.2], look: [0, 1.1, 0.4], fov: 39 },
    { f: 197, pos: [-3.8, 1.8, 3.6], look: [-1.2, 0.95, -1.8], fov: 38, ease: 'surge' },
    { f: 217, pos: [-3.5, 1.75, 3.3], look: [-1.4, 0.95, -1.8], fov: 37 },
  ],
  watch: [
    { f: 218, pos: [-3.5, 1.75, 3.3], look: [-1.4, 0.95, -1.8], fov: 37 },
    { f: 255, pos: [-2.2, 1.85, 5.2], look: [-6.45, 1.08, 0.3], fov: 40, ease: 'surge' },
    { f: 297, pos: [-2.9, 1.7, 4.6], look: [-6.6, 1.05, 0.3], fov: 38, ease: 'surge' },
  ],
  arrive: [
    { f: 298, pos: [-2.9, 1.7, 4.6], look: [-6.6, 1.05, 0.3], fov: 38 },
    { f: 330, pos: [3.8, 2.0, 5.0], look: [0.8, 1.1, 0.6], fov: 40, ease: 'surge' },
    { f: 373, pos: [3.1, 1.85, 4.3], look: [0.8, 1.12, 0.6], fov: 38, ease: 'surge' },
  ],
  costume: [
    { f: 374, pos: [3.1, 1.85, 4.3], look: [0.8, 1.12, 0.6], fov: 38 },
    { f: 398, pos: [-12.2, 1.9, -0.4], look: [-16, 1.25, -5.4], fov: 40, ease: 'surge' },
    { f: 412, pos: [-13.7, 1.78, -2.3], look: [-16, 1.52, -5.5], fov: 36, ease: 'surge' },
    { f: 436, pos: [-14.3, 1.22, -3.2], look: [-15.2, 0.84, -4.58], fov: 34, ease: 'surge' },
  ],
  count: [
    { f: 437, pos: [-14.3, 1.22, -3.2], look: [-15.2, 0.84, -4.58], fov: 34 },
    { f: 462, pos: [-13.4, 1.9, -1.2], look: [-16, 1.05, -5.2], fov: 40, ease: 'surge' },
    { f: 486, pos: [-13.8, 1.95, -1.6], look: [-15.2, 1.1, -5.0], fov: 40, ease: 'surge' },
  ],
  stitch: [
    { f: 487, pos: [-13.8, 1.95, -1.6], look: [-15.2, 1.1, -5.0], fov: 40 },
    { f: 520, pos: [13.3, 1.9, 2.7], look: [16.2, 1.05, -1.8], fov: 39, ease: 'surge' },
    { f: 539, pos: [13.9, 1.86, 2.5], look: [16.6, 1.0, -1.7], fov: 38, ease: 'surge' },
    { f: 563, pos: [14.6, 1.5, 1.3], look: [16.55, 0.8, -0.9], fov: 36, ease: 'surge' },
  ],
  carve: [
    { f: 564, pos: [14.6, 1.5, 1.3], look: [16.55, 0.8, -0.9], fov: 36 },
    { f: 600, pos: [14.2, 1.6, 1.7], look: [15.6, 0.95, -1.3], fov: 38, ease: 'surge' },
    { f: 658, pos: [15.0, 1.15, 0.2], look: [15.8, 0.78, -0.85], fov: 33, ease: 'surge' },
  ],
  eighth: [
    { f: 659, pos: [15.0, 1.15, 0.2], look: [15.8, 0.78, -0.85], fov: 33 },
    { f: 705, pos: [3.6, 2.0, 4.8], look: [0, 1.1, 0.7], fov: 40, ease: 'surge' },
    { f: 749, pos: [2.9, 1.85, 4.0], look: [0, 1.12, 0.8], fov: 38, ease: 'surge' },
    { f: 780, pos: [2.6, 1.8, 3.7], look: [0.1, 1.15, 0.8], fov: 37, ease: 'surge' },
  ],
  letter: [
    { f: 781, pos: [2.6, 1.8, 3.7], look: [0.1, 1.15, 0.8], fov: 37 },
    { f: 812, pos: [3.7, 1.9, 4.9], look: [0.62, 1.3, 0.85], fov: 38, ease: 'surge' },
    { f: 850, pos: [4.05, 1.88, 5.3], look: [0.88, 1.37, 1.28], fov: 34, ease: 'surge' },
    { f: 897, pos: [3.9, 1.86, 5.15], look: [0.88, 1.37, 1.28], fov: 34 },
    { f: 915, pos: [2.4, 1.8, 3.2], look: [0.3, 1.2, 0.2], fov: 37, ease: 'surge' },
  ],
  bowkeys: [
    { f: 916, pos: [2.4, 1.8, 3.2], look: [0.3, 1.2, 0.2], fov: 37 },
    { f: 950, pos: [0.2, 1.9, 4.9], look: [0, 0.9, -2.0], fov: 40, ease: 'surge' },
    { f: 985, pos: [2.2, 1.72, 1.9], look: [0.2, 1.3, -2.9], fov: 36, ease: 'surge' },
    { f: 1026, pos: [3.8, 2.2, 5.4], look: [0, 1.3, -2.2], fov: 42, ease: 'surge' },
  ],
  load: [
    { f: 1027, pos: [3.8, 2.2, 5.4], look: [0, 1.3, -2.2], fov: 42 },
    { f: 1050, pos: [8.6, 2.5, 9.4], look: [1.2, 1.8, -1.6], fov: 42, ease: 'surge' },
    { f: 1075, pos: [8.6, 2.0, 7.0], look: [5.9, 0.95, 2.9], fov: 40, ease: 'surge' },
    { f: 1105, pos: [8.8, 1.95, 7.4], look: [6.3, 0.95, 3.5], fov: 40, ease: 'surge' },
    { f: 1147, pos: [10.2, 2.0, 8.2], look: [8.6, 0.95, 4.9], fov: 41, ease: 'surge' },
  ],
  real: [
    { f: 1148, pos: [10.2, 2.0, 8.2], look: [8.6, 0.95, 4.9], fov: 41 },
    { f: 1185, pos: [3.4, 1.95, 4.6], look: [0.8, 1.1, 0.6], fov: 39, ease: 'surge' },
    { f: 1216, pos: [3.0, 1.85, 4.2], look: [0.6, 1.12, 0.4], fov: 38, ease: 'surge' },
    { f: 1238, pos: [-3.0, 1.8, 3.4], look: [-1.15, 1.1, -1.7], fov: 37, ease: 'surge' },
    { f: 1298, pos: [-2.6, 1.82, 3.7], look: [-0.9, 1.08, -1.7], fov: 37, ease: 'surge' },
    { f: 1315, pos: [-1.8, 2.0, 4.4], look: [1.5, 1.2, -0.5], fov: 40, ease: 'surge' },
  ],
  hook: [
    { f: 1316, pos: [-1.8, 2.0, 4.4], look: [1.5, 1.2, -0.5], fov: 40 },
    { f: 1400, pos: [24.5, 2.4, 6.5], look: [31, 1.6, -4], fov: 42, ease: 'surge' },
    { f: 1450, pos: [26.8, 2.0, 3.6], look: [30.66, 1.0, -1.12], fov: 40, ease: 'surge' },
    { f: 1507, pos: [28.3, 1.6, 1.9], look: [30.68, 1.04, -1.1], fov: 36, ease: 'surge' },
    { f: 1568, pos: [28.9, 1.5, 1.4], look: [30.7, 1.08, -1.08], fov: 34, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['costume', 'carve', 'letter', 'bowkeys'].includes(S.id)) cinf = 3.6;
  if (S.id === 'load') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTreasury: 0, boardLetter: 0, boardBags: 0, gateOpen: 0, keyTurn: 0, lockOpen: 0, bagK: 0, cartD: cartDAt(f), goldK: 0 };
  if (S.id === 'hookQ') W.boardTreasury = 1 - smooth(ramp(f, 50, 62));
  if (S.id === 'letIn') {
    W.keyTurn = smooth(ramp(f, 130, 160)) * (1 - smooth(ramp(f, 190, 212)));
    W.lockOpen = smooth(ramp(f, 148, 172));
    W.gateOpen = smooth(ramp(f, 134, 172));
    W.goldK = W.gateOpen * 0.6;
  }
  if (S.id === 'costume' || S.id === 'count') W.goldK = 0.45 + 0.35 * Math.sin(f * 0.22);
  if (S.id === 'letter') W.boardLetter = smooth(ramp(f, 810, 824)) * (1 - smooth(ramp(f, 888, 900)));
  if (S.id === 'bowkeys') {
    W.keyTurn = smooth(ramp(f, 928, 972));
    W.lockOpen = smooth(ramp(f, 950, 990));
    W.gateOpen = smooth(ramp(f, 966, 1022));
    W.goldK = W.gateOpen * 0.7;
  }
  if (S.id === 'load') {
    W.keyTurn = 1 - smooth(ramp(f, 1030, 1060));
    W.lockOpen = 1; W.gateOpen = 1 - smooth(ramp(f, 1132, 1147));
    W.bagK = clamp((f - 1032) / 4.8, 0, 10);
    W.boardBags = smooth(ramp(f, 1038, 1050)) * (1 - smooth(ramp(f, 1060, 1070)));
    W.goldK = 0.4;
  }
  if (S.id === 'hook') W.goldK = f > 1440 ? 0.5 + 0.5 * Math.sin(f * 0.18) : 0;
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: (S.light === 'lamp' ? 0.22 : 0.35), dustRate: 0.1, splashRate: 0 };
};

// ---------- actors ----------
const TINT = { dusk: '#ffd9a3', lamp: '#ffcf96', day: '#ffffff' };
const tintFor = (S, f) => (S.id === 'hook' && f < 1400 ? TINT.dusk : TINT[S.light] || '#ffffff');
// COSTUMES BY ROLE — treasurer and the disguised thief share the EXACT
// same outfit object values (green coat, white cap): the twin read IS the
// trick. Guards: red uniform + shako. Boy: plain poor clothes, kid build.
export const OUTFITS = {
  treasurer: { jacket: '#2e7a3f', pants: '#26452f', boots: '#2e2118', hat: 'cap', cap: '#f7f3e6', skin: '#e8b08a' },
  thiefDark: { jacket: '#2b2b33', pants: '#1e1e24', boots: '#141416', hat: 'cap', cap: '#1b1b21', skin: '#c98a5a' },
  guardL: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  guardR: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
  boy: { jacket: '#a08b6d', pants: '#6e5a41', boots: '#4a3a28', hat: 'hair', hair: '#241a12', skin: '#c98a5a', build: 'kid' },
  landlord: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'tophat', skin: '#e8b08a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];   // guard posts
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
// Bow = HEAD bows (headTilt) + whole body dips a touch. (Card 'tilt' rolls
// sideways — it read as falling over, never a bow.)
const bowOpts = (k) => ({ headTilt: q(k * 17, 1) });
const BP = (pos, k) => [pos[0], q(-0.07 * k, 3), pos[2]];

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  const guards = (glExpr = 'stern', grExpr = 'stern', glX = {}, grX = {}) => {
    out.push(st(OUTFITS.guardL, glExpr, 61, GLP, { yaw: 0.15, ...glX }));
    out.push(st(OUTFITS.guardR, grExpr, 62, GRP, { yaw: -0.15, ...grX }));
  };
  switch (S.id) {
    case 'hookQ': guards(); break;
    case 'letIn': {
      const k = bowK(f, 170, 190, 203, 217);
      out.push(RW(T, OUTFITS.treasurer, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, [0, 0, 0.9], { tint, yaw: 0 }));
      out.push(RW(T, OUTFITS.guardL, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...bowOpts(k) }, BP(GLP, k), { tint, yaw: 0.3 }));
      out.push(RW(T, OUTFITS.guardR, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62, ...bowOpts(k) }, BP(GRP, k), { tint, yaw: -0.3 }));
      break;
    }
    case 'watch': {
      out.push(st(OUTFITS.thiefDark, 'nervous', 86, [-6.7, 0, 0.3], { yaw: 0.55 }));
      guards();
      break;
    }
    case 'arrive': {
      out.push(st(OUTFITS.treasurer, 'neutral', 41, [0.8, 0, 0.6], { yaw: -0.2 }));
      const nk = bowK(f, 326, 342, 356, 370);
      out.push(RW(T, OUTFITS.guardL, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...bowOpts(nk * 0.45) }, BP(GLP, nk * 0.45), { tint, yaw: 0.25 }));
      out.push(st(OUTFITS.guardR, 'stern', 62, GRP, { yaw: -0.15 }));
      break;
    }
    case 'costume': case 'count': {
      const k = S.id === 'costume' || f < 467 ? q(0.5 + 0.5 * Math.sin(f * 0.33), 2) : q(lerp(0.5, 0.12, ramp(f, 467, 486)), 2);
      const yaw = S.id === 'count' ? lerp(0, -0.6, smooth(ramp(f, 467, 486))) : 0;
      out.push(RW(T, OUTFITS.treasurer, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['count', k] }, [-16, 0, -5.55], { tint, yaw }));
      break;
    }
    case 'stitch': {
      const sew = f < 539 ? q(0.5 + 0.5 * Math.sin(f * 0.42), 2) : q(lerp(0.5, 0.92, ramp(f, 539, 556)), 2);
      out.push(RW(T, OUTFITS.thiefDark, { expr: f < 539 ? 'stern' : 'grin', mode: 'stand', blink: blinkAt(f, 86), seed: 86, prop: ['sew', sew] }, [15.95, 0, -2.0], { tint, yaw: 0.35 }));
      break;
    }
    case 'carve': {
      const k = q(0.62 + 0.26 * Math.sin(f * 0.5), 2);
      out.push(RW(T, OUTFITS.thiefDark, { expr: f < 625 ? 'stern' : 'grin', mode: 'stand', blink: blinkAt(f, 86), seed: 86, prop: ['carve', k] }, [15.5, 0, -1.95], { tint, yaw: 0.3 }));
      break;
    }
    case 'eighth': {
      out.push(st(OUTFITS.treasurer, f < 749 ? 'neutral' : 'stern', 43, [0, 0, 0.9], { yaw: 0 }));
      guards();
      break;
    }
    case 'letter': {
      const k = q(0.1 + 0.9 * smooth(ramp(f, 786, 812)) * (1 - smooth(ramp(f, 890, 906))), 2);
      out.push(RW(T, OUTFITS.treasurer, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 43), seed: 43, prop: ['letter', k] }, [0, 0, 0.9], { tint, yaw: 0.1 }));
      const lean = bowK(f, 812, 850, 880, 912) * 0.35;
      out.push(RW(T, OUTFITS.guardL, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...bowOpts(lean) }, BP(GLP, lean), { tint, yaw: 0.3 }));
      out.push(RW(T, OUTFITS.guardR, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 62), seed: 62, ...bowOpts(lean) }, BP(GRP, lean), { tint, yaw: -0.3 }));
      break;
    }
    case 'bowkeys': {
      const k = bowK(f, 922, 946, 984, 1010);
      out.push(st(OUTFITS.treasurer, 'grin', 43, [0, 0, 0.9], { yaw: 0 }));
      out.push(RW(T, OUTFITS.guardL, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...bowOpts(k) }, BP([-1.05, 0, -2.2], k), { tint, yaw: 0.2 }));
      out.push(RW(T, OUTFITS.guardR, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62, prop: ['key', q(smooth(ramp(f, 928, 972)), 2)], ...bowOpts(k * 0.4) }, BP([1.05, 0, -2.2], k * 0.4), { tint, yaw: -0.2 }));
      break;
    }
    case 'load': {
      out.push(RW(T, OUTFITS.treasurer, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 43), seed: 43, wave: f >= 1030 && f <= 1082 ? q(0.5 + 0.5 * Math.sin(f * 0.2), 2) : 0 }, [3.6, 0, 4.4], { tint, yaw: 0.5 }));
      const cp = cartPosAt(f);
      const guardAt = (post, seed, zOff, xOff) => {
        const outfit = seed === 61 ? OUTFITS.guardL : OUTFITS.guardR;
        const startF = seed === 61 ? 1027 : 1045;   // staggered departure AND arrival:
        const endF = seed === 61 ? 1070 : 1090;     // the two never stack into one blob
        const rear = [cp[0] - 1.35 + xOff, 0, cp[2] + zOff];
        if (f < 1091) {
          const target = [CART0[0] - 1.35 + xOff, 0, CART0[2] + zOff];
          const total = Math.hypot(target[0] - post[0], target[2] - post[2]);
          const dist = smooth(ramp(f, startF, endF)) * total;   // foot-lock: phase from eased distance actually travelled
          const p = kf3([[startF, post], [endF, target]], f);
          const moving = f > startF && f < endF;
          return RW(T, outfit, { expr: 'stern', mode: moving ? 'march' : 'stand', phase: q((dist / 1.6) % 1, 3), blink: blinkAt(f, seed), seed }, p, { tint, yaw: -0.5 });
        }
        const phase = (cartDAt(f) / 1.6) % 1;   // feet cycle locked to cart travel
        return RW(T, outfit, { expr: 'stern', mode: 'march', phase: q(phase, 3), blink: blinkAt(f, seed), seed, headTilt: 12, prop: ['push', 0.85] }, rear, { tint, yaw: -0.5 });
      };
      out.push(guardAt(GLP, 61, -0.55, 0));
      out.push(guardAt(GRP, 62, 0.55, -0.3));
      break;
    }
    case 'real': {
      out.push(st(OUTFITS.treasurer, 'stern', 41, [0.8, 0, 0.6], { yaw: -0.2 }));
      const pale = smooth(ramp(f, 1216, 1246));
      const gt = pale > 0.5 ? '#eef2f6' : tint;
      const gExpr = f < 1216 ? 'stern' : 'shock';
      out.push(st(OUTFITS.guardL, gExpr, 61, GLP, { yaw: 0.25, tint: gt }));
      if (f >= 1261) out.push(RW(T, OUTFITS.guardR, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 62), seed: 62, prop: ['point', 1] }, GRP, { tint: gt, yaw: -0.4 }));
      else out.push(st(OUTFITS.guardR, gExpr, 62, GRP, { yaw: -0.15, tint: gt }));
      break;
    }
    case 'hook': {
      out.push(st(OUTFITS.landlord, 'stern', 95, [32.3, 0, -5.2], { yaw: -0.3 }));
      out.push(RW(T, OUTFITS.boy, { expr: f < 1507 ? 'nervous' : 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, ...(f >= 1414 ? { prop: ['coin', 0.9] } : {}) }, [30.4, 0, -1.2], { tint, yaw: 0.25, s: 0.85 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
