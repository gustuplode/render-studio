// "वो चोर जिसे पहरेदारों ने ख़ुद अंदर किया" — Hindi trick batch 2, topic 1.
// Timed DIRECTLY to the Hindi stem (50.77 s, 30 fps, TOTAL 1523) from the
// align_hi2 word timings (thief-hindi-voice/words.json). Every shot starts
// on a clause boundary; every camera key lands on the word that names its
// subject. Camera Law: the camera TRACKS the voice-named subject, holds
// with a slow push-in, never freezes, never drifts aimlessly.
// Clause map (s): L1 hook 0.00 | slip 2.08 | tala 2.70 | darwaza 3.40 |
// kaise 4.12 | guards-let-in 4.67 | salaam 6.62 || L2 watch 7.55 | roz-sham
// 10.28 | khazanchi 11.15 | hari-angrakhi 12.10 | safed-topi 12.63 |
// ungli-ring 13.54 | sona-ginta 15.38 || L3 angrakhi 17.98 | topi 19.61 |
// mom-ring 20.55 || L4 pahunch 24.52 | bhesh 25.09 | hukamnama 27.27 |
// das-bori 28.09 | aaj-hi-raat 29.61 || L5 salaam 30.91 | chabiyan 31.45 |
// taale 32.73 | khol-diye 33.62 || L6 das-bori-bhara 34.59 | gaadi-lada
// 35.41 | dhakelne 37.12 || L7 asli 39.45 | chehre-safed 41.38 | huzoor
// 42.17 || L8 ladka 45.20 | sikka 46.94 | hall 48.63 | sawal 49.48.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1523, DECK = 0;
export const SHOTS = [
  { id: 'hookgate', a: 0, b: 139, light: 'golden' },
  { id: 'reveal', a: 140, b: 226, light: 'golden' },
  { id: 'watch', a: 227, b: 308, light: 'golden' },
  { id: 'routine', a: 309, b: 496, light: 'golden' },
  { id: 'disguise', a: 497, b: 676, light: 'golden' },
  { id: 'arrive', a: 677, b: 780, light: 'golden' },
  { id: 'letter', a: 781, b: 910, light: 'golden' },
  { id: 'open', a: 911, b: 1027, light: 'golden' },
  { id: 'load', a: 1028, b: 1163, light: 'golden' },
  { id: 'real', a: 1164, b: 1317, light: 'golden' },
  { id: 'hookboy', a: 1318, b: 1522, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  golden: { az: 100, el: 21, sky: '#d9b28c', ground: '#5c5a34', hemi: 1.14, sun: '#ffb763', sunI: 2.4, fog: '#e5cf9e', fogNear: 42, fogFar: 340,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
  night: { az: 210, el: 38, sky: '#2c3a55', ground: '#1c221c', hemi: 0.62, sun: '#bcd2ff', sunI: 1.15, fog: '#1a2438', fogNear: 34, fogFar: 260,
    skyTop: '#131f38', skyHor: '#2c3c5c', sunDisc: '#dfe9ff', sunSize: 0.0022, sat: 0.94, vig: 0.32, shadowExt: 16, aurora: 0, gain: '#cfe0ff', ...WATER },
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
  if (S.id === 'real') return blendLight(LIGHTS.golden, LIGHTS.night, 0.5 * smooth(ramp(f, 1164, 1270)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const GATE = [0, 0, -2];
export const GUARD_L = [-2.7, 0, -0.55], GUARD_R = [2.7, 0, -0.55];
export const TABLE = [0, 0, -3.1];
export const STALL = [-7.4, 0, 2.3];
export const CART0 = [4.4, 0, 0.7];
export const BOY = [22.8, 0, -0.8];

const thiefWatchPos = [-4.05, 0, 1.25];
const revealWalk = (f) => kf3([[140, [0, 0, 2.1]], [218, [0, 0, -1.35]]], f);
const routineWalk = (f) => kf3([[309, [0, 0, -0.85]], [392, [0, 0, -2.5]]], f);
const cartXAt = (f) => 2.3 * smooth(ramp(f, 1092, 1163));
const heroPosAtInner = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hookgate': return [0, 1.5, -1.7];
    case 'reveal': { const p = revealWalk(f); return [p[0], 1.1, p[2]]; }
    case 'watch': return [thiefWatchPos[0], 1.15, thiefWatchPos[2]];
    case 'routine': { const p = routineWalk(f); return [p[0], 1.1, p[2]]; }
    case 'disguise': return [-6.55, 1.1, 2.35];
    case 'arrive': return [0.9, 1.25, 1.6];
    case 'letter': return f < 843 ? [0.9, 1.25, 1.6] : [2.4, 1.7, 1.2];
    case 'open': return [0, 1.4, -1.2];
    case 'load': return [CART0[0] + cartXAt(f), 0.9, CART0[2]];
    case 'real': return f < 1241 ? [2.3, 1.2, 1.15] : [0, 1.2, -0.55];
    case 'hookboy': return [BOY[0], 0.9, BOY[2]];
    default: return [0, 1, 0];
  }
};
export const heroPosAt = heroPosAtInner;

// ---------- cameras (keys land on clause words; look = voice-named subject) ----------
const CAMS = {
  hookgate: [
    { f: 0, pos: [6.4, 2.8, 7.6], look: [0, 1.55, -2.0], fov: 44 },
    { f: 62, pos: [5.9, 2.6, 7.0], look: [0.1, 1.55, -1.95], fov: 43, ease: 'surge' },
    { f: 102, pos: [2.2, 1.7, 2.2], look: [0, 1.5, -1.85], fov: 36, ease: 'surge' },
    { f: 139, pos: [1.7, 1.6, 1.4], look: [0, 1.5, -1.85], fov: 34 },
  ],
  reveal: [
    { f: 140, pos: [5.6, 2.4, 6.4], look: [0, 1.2, -0.6], fov: 42 },
    { f: 178, pos: [4.2, 2.0, 4.6], look: [0, 1.1, -0.7], fov: 39, ease: 'surge' },
    { f: 226, pos: [3.4, 1.9, 3.6], look: [0, 1.1, -1.0], fov: 37 },
  ],
  watch: [
    { f: 227, pos: [-1.2, 1.9, 5.6], look: [-4.0, 1.1, 1.2], fov: 42 },
    { f: 280, pos: [-2.2, 1.8, 4.6], look: [-4.05, 1.15, 1.25], fov: 39, ease: 'surge' },
    { f: 308, pos: [-2.5, 1.75, 4.2], look: [-4.05, 1.15, 1.25], fov: 38 },
  ],
  routine: [ // camera stays in the courtyard, tracking him THROUGH the open doorway
    { f: 309, pos: [3.4, 2.2, 4.6], look: [0, 1.2, -1.2], fov: 43 },
    { f: 363, pos: [2.6, 1.9, 3.0], look: [0, 1.15, -2.3], fov: 40, ease: 'surge' },
    { f: 379, pos: [2.3, 1.9, 2.6], look: [0, 1.5, -2.55], fov: 38, ease: 'surge' },
    { f: 406, pos: [1.9, 1.6, 2.0], look: [0.25, 0.95, -2.7], fov: 36, ease: 'surge' },
    { f: 461, pos: [2.1, 1.7, 2.2], look: [0, 0.95, -3.0], fov: 37, ease: 'surge' },
    { f: 496, pos: [2.2, 1.75, 2.4], look: [0, 1.0, -2.9], fov: 37 },
  ],
  disguise: [ // camera west of the stall, looking east: treasury fills the background
    { f: 497, pos: [-11.9, 2.1, 6.6], look: [-7.2, 1.15, 2.3], fov: 43 },
    { f: 539, pos: [-11.2, 1.9, 6.0], look: [-7.5, 1.45, 1.5], fov: 39, ease: 'surge' },
    { f: 589, pos: [-11.4, 1.85, 5.7], look: [-8.25, 1.1, 2.25], fov: 38, ease: 'surge' },
    { f: 617, pos: [-10.7, 1.6, 5.5], look: [-6.85, 0.95, 2.4], fov: 36, ease: 'surge' },
    { f: 676, pos: [-10.5, 1.7, 5.7], look: [-6.8, 1.0, 2.35], fov: 36 },
  ],
  arrive: [
    { f: 677, pos: [6.8, 2.6, 8.2], look: [0.4, 1.2, 0.2], fov: 44 },
    { f: 736, pos: [4.8, 2.1, 5.6], look: [0.9, 1.15, 1.4], fov: 40, ease: 'surge' },
    { f: 753, pos: [3.6, 1.9, 4.2], look: [0.9, 1.3, 1.55], fov: 37, ease: 'surge' },
    { f: 780, pos: [3.3, 1.85, 3.9], look: [0.9, 1.3, 1.55], fov: 36 },
  ],
  letter: [
    { f: 781, pos: [3.3, 1.85, 3.9], look: [0.9, 1.3, 1.55], fov: 36 },
    { f: 800, pos: [3.25, 1.84, 3.95], look: [0.85, 1.3, 1.55], fov: 36 },
    { f: 843, pos: [2.35, 1.78, 5.6], look: [2.4, 1.68, 1.2], fov: 35, ease: 'surge' },
    { f: 888, pos: [2.35, 1.75, 5.45], look: [2.4, 1.65, 1.2], fov: 35, ease: 'surge' },
    { f: 910, pos: [2.35, 1.76, 5.55], look: [2.4, 1.62, 1.2], fov: 35 },
  ],
  open: [
    { f: 911, pos: [5.4, 2.3, 6.0], look: [0, 1.3, -0.8], fov: 42 },
    { f: 944, pos: [4.4, 2.1, 4.6], look: [-0.7, 1.32, -1.1], fov: 42, ease: 'surge' },
    { f: 982, pos: [3.4, 1.95, 3.8], look: [-0.2, 1.4, -1.5], fov: 40, ease: 'surge' },
    { f: 1027, pos: [3.6, 2.0, 4.6], look: [0.3, 1.35, -1.2], fov: 39 },
  ],
  load: [
    { f: 1028, pos: [0.6, 2.5, 6.4], look: [2.9, 0.95, -0.6], fov: 44 },
    { f: 1063, pos: [1.4, 2.3, 6.0], look: [3.6, 0.9, 0.2], fov: 42, ease: 'surge' },
    { f: 1114, pos: [9.5, 2.4, 7.4], look: [5.3, 0.9, 0.6], fov: 44, ease: 'surge' },
    { f: 1163, pos: [10.6, 2.4, 7.8], look: [6.4, 0.9, 0.7], fov: 42 },
  ],
  real: [
    { f: 1164, pos: [10.4, 2.6, 7.2], look: [6.2, 1.25, 1.9], fov: 44 },
    { f: 1216, pos: [8.2, 2.4, 7.4], look: [3.6, 1.25, 1.4], fov: 44, ease: 'surge' },
    { f: 1241, pos: [7.4, 2.6, 8.6], look: [0.9, 1.25, 0.1], fov: 46, ease: 'surge' },
    { f: 1317, pos: [7.0, 2.5, 8.2], look: [0.9, 1.28, 0.15], fov: 45 },
  ],
  hookboy: [
    { f: 1318, pos: [15.5, 2.6, 6.5], look: [24.0, 2.2, -4.5], fov: 46 },
    { f: 1408, pos: [17.5, 2.0, 3.6], look: [22.8, 1.0, -0.8], fov: 40, ease: 'surge' },
    { f: 1459, pos: [18.6, 1.9, 3.0], look: [23.5, 1.55, -2.4], fov: 38, ease: 'surge' },
    { f: 1522, pos: [19.4, 1.8, 2.6], look: [22.9, 1.05, -0.85], fov: 36 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAtInner(f);
  let cinf = 5;
  if (S.id === 'letter' || S.id === 'open') cinf = 4;
  if (S.id === 'routine' && f >= 406) cinf = 4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTreasury: 0, boardLetter: 0, boardHook: 0, gateOpen: 0, lockK: 1, lockRot: 0, bags: 0, coatK: 0, capK: 0, ringK: 0, goldK: 0.15, coinK: 0, cartX: 0 };
  // treasury name board: only while a wide gate shot holds it fully in frame
  if (S.id === 'hookgate') W.boardTreasury = 1 - smooth(ramp(f, 44, 56));
  // the forged order letter
  if (S.id === 'letter') W.boardLetter = smooth(ramp(f, 838, 856)) * (1 - smooth(ramp(f, 892, 908)));
  if (S.id === 'open' && f < 930) W.boardLetter = (1 - smooth(ramp(f, 892, 908)));
  // hook board by the hall
  if (S.id === 'hookboy') W.boardHook = smooth(ramp(f, 1440, 1462)) * (1 - smooth(ramp(f, 1466, 1482)));
  // gates + lock
  if (S.id === 'reveal') { W.gateOpen = 0.55; W.lockK = 0; }
  if (S.id === 'routine') { W.gateOpen = 0.85; W.lockK = 0; } // the daily visit: guards have opened up for him
  if (S.id === 'open') {
    W.lockRot = f >= 950 && f < 985 ? q(Math.sin((f - 950) * 0.5) * 0.3, 2) : 0;
    W.lockK = 1 - smooth(ramp(f, 982, 1008));
    W.gateOpen = smooth(ramp(f, 988, 1027));
  }
  if (S.id === 'load') { W.lockK = 0; W.gateOpen = 1 - smooth(ramp(f, 1148, 1163)); }
  if (S.id === 'real' || S.id === 'hookboy') { W.lockK = 1; W.gateOpen = 0; }
  // disguise pieces appear as the voice names them
  if (S.id === 'disguise' || f > 676) { W.coatK = smooth(ramp(f, 520, 542)); W.capK = smooth(ramp(f, 578, 598)); W.ringK = smooth(ramp(f, 612, 638)); }
  // gold bags onto the cart, one by one
  if (f >= 1028) W.bags = 10 * ramp(f, 1038, 1092);
  // interior gold glow + hook coin glint
  if (S.id === 'routine') W.goldK = 0.85;
  if (S.id === 'load') W.goldK = 0.7;
  if (S.id === 'reveal') W.goldK = 0.45;
  if (S.id === 'hookboy') W.coinK = smooth(ramp(f, 1400, 1415));
  W.cartX = cartXAt(f);
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.3, dustRate: S.id === 'hookgate' || S.id === 'open' ? 0.5 : 0.12 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', golden: '#ffd9a3', night: '#aebedd' };
const tintFor = (S, f) => {
  if (S.id === 'real') return hexLerp('#ffd9a3', '#aebedd', 0.55 * smooth(ramp(f, 1164, 1270)));
  return TINT[S.light] || '#ffffff';
};
export const OUTFITS = {
  // ख़ज़ांची: green angrakha, white cap — and the disguised thief is his TWIN
  treasurer: { jacket: '#2e7d3a', pants: '#274435', boots: '#2e2118', hat: 'cap', cap: '#f4efe4', skin: '#c98a5a' },
  thief: { jacket: '#33302e', pants: '#26221f', boots: '#1c1a18', hat: 'hair', hair: '#241c14', skin: '#c98a5a' },
  guard: { jacket: '#8c2f2a', pants: '#3a2c2c', boots: '#241a14', hat: 'cap', cap: '#7a1f1f', skin: '#b57a4e', belt: true, pagdi: '#a52a24' },
  guard2: { jacket: '#8c2f2a', pants: '#3a2c2c', boots: '#241a14', hat: 'cap', cap: '#7a1f1f', skin: '#d9a878', belt: true, pagdi: '#a52a24' },
  boy: { jacket: '#b3a284', pants: '#6a5a44', boots: '#4a3a28', hat: 'hair', hair: '#2a2018', skin: '#c98a5a', build: 'kid' },
};
// Pen-space anchor points on the adult card (seed 71 geometry, stand pose):
// hang hand (416,645); forward hand Hd(k) interpolated below.
const propPt = (k) => [435.5 + 45.7 * k, 311.7 + 203.6 * k];
const drawFigure = (T, o, opts, extra) => (p) => {
  if (extra.spear) { // spear first: the hand overdrawing the shaft reads as a grip
    p.stroke([[424, 84], [424, 974]], 7.5, '#6d4a2a');
    p.poly([[424, 26], [411, 90], [437, 90]], '#b9c1c9', 4);
  }
  T.bodyFront(p, o, opts);
  if (extra.ring) { // the big seal ring — gold band, red seal stone
    // hang hand is pen (416,645); when that arm waves, the ring rides the other hand (184,645)
    const pt = opts.prop ? propPt(opts.prop[1]) : (opts.wave ? [184, 645] : [416, 645]);
    p.ell(pt[0], pt[1], 16, 16, '#d9a441', 5);
    p.ell(pt[0], pt[1], 8.5, 8.5, '#a02318', 3);
  }
  if (extra.pagdi) { // wrapped pagdi over the cap: dome + wrap lines + side knot
    const cy = extra.pagdi;
    p.ell(300, cy - 2, 105, 49, o.pagdi, 6);
    p.arc(300, cy + 4, 97, 41, 195, 345, 5, '#7c1d18');
    p.arc(300, cy - 14, 99, 44, 200, 340, 4, '#c8453c');
    p.dot(398, cy - 16, 15, o.pagdi);
    p.poly([[398, cy - 30], [424, cy + 26], [392, cy + 20]], o.pagdi, 4);
  }
};
const A = (T, o, opts, pos, extra = {}) => ({
  key: (extra.tag || 'fig') + JSON.stringify(o) + JSON.stringify(opts) + (extra.ring ? 'R' : '') + (extra.spear ? 'S' : '') + (extra.pagdi || ''),
  draw: drawFigure(T, o, opts, extra),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra.out,
});
const idleTilt = (f, seed) => q(1.5 * Math.sin(f * 0.037 + seed * 1.3), 1);
const treasurerAt = (T, tint, f, expr, pos, opts = {}, out = {}) => A(T, OUTFITS.treasurer, { expr, mode: 'stand', blink: blinkAt(f, 71), seed: 71, headTilt: idleTilt(f, 71), ...opts }, pos, { tag: 'trez', ring: true, out: { tint, ...out } });
const guardAt = (T, tint, f, which, expr, pos, opts = {}, out = {}) => A(T, which === 1 ? OUTFITS.guard : OUTFITS.guard2, { expr, mode: 'stand', blink: blinkAt(f, which === 1 ? 73 : 74), seed: which === 1 ? 73 : 74, headTilt: idleTilt(f, which === 1 ? 73 : 74), ...opts }, pos, { tag: 'grd' + which, spear: opts.spear !== false, pagdi: which === 1 ? 231 : 222, out: { tint, ...out } });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const guards = (lExpr, rExpr, lOpts = {}, rOpts = {}, lOut = {}, rOut = {}, lPos = GUARD_L, rPos = GUARD_R) => {
    out.push(guardAt(T, tint, f, 1, lExpr, lPos, lOpts, { yaw: 0.35, ...lOut }));
    out.push(guardAt(T, tint, f, 2, rExpr, rPos, rOpts, { yaw: -0.35, ...rOut }));
  };
  switch (S.id) {
    case 'hookgate': {
      // the thief slips in at the gate's side while the camera closes on the locks
      const p = kf3([[20, [2.7, 0, -0.9]], [80, [0.7, 0, -1.55]]], f);
      const a = f < 30 ? ramp(f, 20, 30) : 1 - ramp(f, 100, 118);
      out.push(A(T, OUTFITS.thief, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 72), seed: 72, headTilt: q(6, 1) }, p, { tag: 'thf', out: { tint: '#8d97a8', alpha: a, yaw: 0.5 } }));
      guards('stern', 'stern');
      break;
    }
    case 'reveal': {
      const p = revealWalk(f);
      const marching = f < 218;
      out.push(A(T, OUTFITS.treasurer, { expr: 'stern', mode: marching ? 'march' : 'stand', phase: q((f * 0.09) % 1, 2), blink: blinkAt(f, 71), seed: 71 }, p, { tag: 'trez', ring: true, out: { tint } }));
      const bow = smooth(ramp(f, 185, 205));
      guards('neutral', 'neutral', { headTilt: q(17 * bow, 1), wave: q(0.6 * bow, 2) }, { headTilt: q(17 * bow, 1), wave: q(0.6 * bow, 2) });
      break;
    }
    case 'watch': {
      out.push(A(T, OUTFITS.thief, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 72), seed: 72, headTilt: q(4 + 1.5 * Math.sin(f * 0.05), 1) }, thiefWatchPos, { tag: 'thf', out: { tint, yaw: 0.85 } }));
      guards('neutral', 'neutral');
      break;
    }
    case 'routine': {
      const p = routineWalk(f);
      const marching = f < 392;
      const counting = f >= 455;
      const opts = marching ? { mode: 'march', phase: q((f * 0.09) % 1, 2) } : counting ? { mode: 'stand', wave: q(0.32 + 0.08 * Math.sin(f * 0.35), 2) } : { mode: 'stand' }; // empty hand hovering over the coins (the kit's array-prop draws a tool — wrong here)
      out.push(A(T, OUTFITS.treasurer, { expr: 'neutral', blink: blinkAt(f, 71), seed: 71, headTilt: counting ? q(9, 1) : idleTilt(f, 71), ...opts }, p, { tag: 'trez', ring: true, out: { tint } }));
      guards('stern', 'stern');
      break;
    }
    case 'disguise': {
      const wavePulse = (c) => q(Math.max(0, Math.sin(ramp(f, c - 12, c + 14) * Math.PI)) * 0.55, 2);
      const wv = Math.max(wavePulse(539), wavePulse(589), wavePulse(617));
      out.push(A(T, OUTFITS.thief, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 72), seed: 72, wave: wv, headTilt: idleTilt(f, 72) }, [-6.55, 0, 2.35], { tag: 'thf', out: { tint, yaw: -0.5 } }));
      break;
    }
    case 'arrive': {
      out.push(treasurerAt(T, tint, f, 'stern', [0.9, 0, 1.6], {}, { yaw: 0.25 }));
      guards('neutral', 'neutral');
      break;
    }
    case 'letter': {
      const pointing = f >= 800;
      out.push(treasurerAt(T, tint, f, 'stern', [0.55, 0, 1.5], pointing ? { wave: 0.55 } : {}, { yaw: 0.45 })); // raised open hand presenting the order — no tool
      const lean = smooth(ramp(f, 820, 845)) * (1 - smooth(ramp(f, 885, 900)));
      guards('neutral', 'neutral', { headTilt: q(7 * lean, 1) }, { headTilt: q(7 * lean, 1) }, {}, {}, GUARD_L, [3.35, 0, -0.55]); // right guard steps aside, clear of the letter board
      break;
    }
    case 'open': {
      const bow = smooth(ramp(f, 911, 930)) * (1 - smooth(ramp(f, 938, 950)));
      const turning = f >= 944 && f < 988;
      guards('neutral', 'stern',
        turning ? { prop: ['key', q(0.5 + 0.22 * Math.sin((f - 944) * 0.55), 2)], spear: false, headTilt: q(5, 1) } : { headTilt: q(17 * bow, 1), wave: q(0.6 * bow, 2) },
        { headTilt: q(17 * bow, 1), wave: q(0.6 * bow, 2) }, {}, {}, [-0.9, 0, -1.05], GUARD_R); // left guard stands AT the lock to turn the key
      const step = f >= 1005;
      const p = step ? kf3([[1005, [0.55, 0, 1.5]], [1027, [0.25, 0, -0.5]]], f) : [0.55, 0, 1.5];
      out.push(treasurerAt(T, tint, f, 'stern', p, step ? { mode: 'march', phase: q((f * 0.09) % 1, 2) } : {}, { yaw: 0.3 }));
      break;
    }
    case 'load': {
      const cx = cartXAt(f);
      const loading = f < 1092;
      if (loading) {
        // disguised thief placing bags at the cart; a guard lifting at the pile
        out.push(A(T, OUTFITS.treasurer, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['load', q(0.55 + 0.2 * Math.sin(f * 0.3), 2)], headTilt: q(7, 1) }, [3.15, 0, 1.15], { tag: 'trez', ring: true, out: { tint, yaw: 0.7 } }));
        out.push(guardAt(T, tint, f, 1, 'neutral', [2.1, 0, -3.9], { prop: ['lift', q(0.5 + 0.25 * Math.sin(f * 0.3 + 1.5), 2)], spear: false, headTilt: q(8, 1) }, { yaw: 0.5 }));
        out.push(guardAt(T, tint, f, 2, 'neutral', GUARD_R, {}, { yaw: -0.35 }));
      } else {
        // both guards push the cart out; the "treasurer" strides beside it
        const ph = q((f * 0.075) % 1, 2);
        out.push(guardAt(T, tint, f, 1, 'stern', [CART0[0] + cx - 1.55, 0, 0.1], { mode: 'march', phase: ph, prop: ['push', 0.75], spear: false, headTilt: q(9, 1) }, { yaw: 0.15 }));
        out.push(guardAt(T, tint, f, 2, 'stern', [CART0[0] + cx - 1.55, 0, 1.3], { mode: 'march', phase: ph, prop: ['push', 0.75], spear: false, headTilt: q(9, 1) }, { yaw: 0.15 }));
        out.push(A(T, OUTFITS.treasurer, { expr: 'grin', mode: 'march', phase: ph, blink: blinkAt(f, 71), seed: 71 }, [CART0[0] + cx + 1.55, 0, 1.45], { tag: 'trez', ring: true, out: { tint, yaw: 0.3 } }));
      }
      break;
    }
    case 'real': {
      const marching = f >= 1184 && f < 1238;
      const p = kf3([[1184, [6.2, 0, 1.9]], [1238, [1.5, 0, 1.3]]], f); // stops clear of the letter signpost at (2.4, 1.2)
      out.push(A(T, OUTFITS.treasurer, { expr: marching ? 'neutral' : 'stern', mode: marching ? 'march' : 'stand', phase: q((f * 0.09) % 1, 2), blink: blinkAt(f, 71), seed: 71, headTilt: idleTilt(f, 71) }, p, { tag: 'trez', ring: true, out: { tint } }));
      if (f < 1241) guards('stern', 'stern');
      else { // चेहरे सफ़ेद — shock faces, washed-out tint, a stammering wave
        const stam = f >= 1265 ? q(0.18 + 0.1 * Math.sin(f * 0.5), 2) : 0;
        out.push(guardAt(T, '#e9e4d8', f, 1, 'shock', GUARD_L, { headTilt: q(4, 1) }, { yaw: 0.35 }));
        out.push(guardAt(T, '#e9e4d8', f, 2, 'nervous', GUARD_R, { headTilt: q(4, 1), wave: stam }, { yaw: -0.35 }));
      }
      break;
    }
    case 'hookboy': {
      const wv = f >= 1400 ? 0.85 : 0;
      out.push(A(T, OUTFITS.boy, { expr: f < 1459 ? 'smile' : 'neutral', mode: 'stand', blink: blinkAt(f, 75), seed: 75, wave: wv, headTilt: idleTilt(f, 75) }, BOY, { tag: 'boy', out: { tint, yaw: -0.3 } }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, s, t) => out.push({ key, draw: (p) => T.fxBurst(p, t, '#ffe066', 9, 26, 140), x, y, z, blob: false, shadow: false });
  if (f >= 1408 && f <= 1424) burst('coin_' + q((f - 1408) / 16, 2), BOY[0] + 0.48, 1.34, BOY[2], 0.4, q((f - 1408) / 16, 2));
  if (f >= 461 && f <= 477) burst('gold1_' + q((f - 461) / 16, 2), 0.25, 1.2, -2.95, 0.3, q((f - 461) / 16, 2));
  if (f >= 480 && f <= 496) burst('gold2_' + q((f - 480) / 16, 2), -0.3, 1.2, -3.1, 0.3, q((f - 480) / 16, 2));
  return out;
};
