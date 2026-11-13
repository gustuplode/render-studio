// Shot plan for "Two Doors — Truth, Lie and One Question" (T3 of the
// trick batch) — timed to doors-voice (52.49 s, 30 fps, TOTAL 1575).
// Phrases: L1 0-163 (the pilot answer) | L2 188-271 | L3 285-355 |
// L4 376-501 | L5 517-633 | L6 658-773 | L7 788-955 | L8 977-1015 |
// L9 1015-1106 | L10 1133-1358 | L11 TEASE 1382-1567 (the crown hook).
// World: FIELD stage far east (x=40) where the empty plane lands, and the
// CHAMBER at origin: stone room, two doors in the back wall (freedom
// behind the LEFT, death behind the RIGHT), guards, a crown pedestal.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1545, DECK = 0;
const SHOTS_EN = [
  { id: 'landing', a: 0, b: 187, light: 'golden' },
  { id: 'doors', a: 188, b: 284, light: 'torch' },
  { id: 'stakes', a: 285, b: 375, light: 'torch' },
  { id: 'guards', a: 376, b: 516, light: 'torch' },
  { id: 'problem', a: 517, b: 657, light: 'torch' },
  { id: 'question', a: 658, b: 787, light: 'torch' },
  { id: 'ask', a: 788, b: 976, light: 'torch' },
  { id: 'point', a: 977, b: 1014, light: 'torch' },
  { id: 'exit', a: 1015, b: 1132, light: 'torch' },
  { id: 'explain', a: 1133, b: 1381, light: 'torch' },
  { id: 'hook', a: 1382, b: 1574, light: 'torch' },
];
const TIMING_EN = SHOTS_EN.map((s) => [s.id, s.a, s.b]);
const shotAt_en = (f) => SHOTS_EN.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS_EN[0] : SHOTS_EN[SHOTS_EN.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  golden: { az: 100, el: 22, sky: '#d9b28c', ground: '#5c5a34', hemi: 1.16, sun: '#ffb763', sunI: 2.4, fog: '#e5cf9e', fogNear: 44, fogFar: 380,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 20, aurora: 0, gain: '#ffedd6', ...WATER },
  torch: { az: 118, el: 34, sky: '#8a7a68', ground: '#3f3428', hemi: 1.04, sun: '#ffb763', sunI: 1.9, fog: '#6a5844', fogNear: 26, fogFar: 160,
    skyTop: '#4c4438', skyHor: '#a8895c', sunDisc: '#ffdf9e', sunSize: 0.003, sat: 1.02, vig: 0.34, shadowExt: 14, aurora: 0, gain: '#ffe4bb', ...WATER },
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
const lightFor_en = (S, f) => {
  if (S.id === 'doors') return blendLight(LIGHTS.golden, LIGHTS.torch, smooth(ramp(f, 188, 250)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const FIELD = [40, 0, 0];
export const DOOR_L = [-2.2, 0, -2.9];   // freedom behind this one
export const DOOR_R = [2.2, 0, -2.9];    // death behind this one
export const CROWN = [6.5, 0, -1];       // crown pedestal (the hook)

/** The empty plane's touchdown path (s1), k = 0..1 of worldAt planeK. */
export const planeAt = (k) => kf3([[0, [54, 8.5, -7]], [0.7, [44, 2.2, -1]], [1, [38.5, 0.55, 1.5]]], k);

const heroPosAt_en = (f) => {
  const S = shotAt_en(f);
  switch (S.id) {
    case 'landing': { const p = planeAt(worldAt_en(f).planeK); return [p[0], p[1] + 0.4, p[2]]; }
    case 'doors': return [0, 1.1, 0.5];
    case 'stakes': return [0, 1.3, -1.5];
    case 'guards': return [0, 1.2, -1.2];
    case 'problem': return [0, 1.15, 0.8];
    case 'question': return [0, 1.15, 0.6];
    case 'ask': return [-1.2, 1.2, -0.6];
    case 'point': return [1.6, 1.2, -2.2];
    case 'exit': return [-2.2, 1.1, -1.6];
    case 'explain': return [0, 1.2, -0.5];
    case 'hook': return [CROWN[0], 1.5, CROWN[2]];
    default: return [0, 1, 0];
  }
};

// ---------- cameras ----------
const CAMS = {
  landing: [
    { f: 0, pos: [52, 5.5, 14.5], look: [46, 2.5, -3], fov: 46 },
    { f: 90, pos: [48, 5.5, 16], look: [41.8, 1.3, 0], fov: 44, ease: 'surge' },
    { f: 187, pos: [43.5, 2.8, 11.8], look: [38.5, 0.9, 1.5], fov: 43 },
  ],
  doors: [
    { f: 188, pos: [43.5, 2.8, 11.8], look: [38.5, 0.9, 1.5], fov: 43 },
    { f: 240, pos: [16, 3.6, 9], look: [4, 1.4, -1], fov: 44, ease: 'surge' },
    { f: 284, pos: [7.6, 2.9, 7.6], look: [0, 1.5, -1.6], fov: 43 },
  ],
  stakes: [
    { f: 285, pos: [7.6, 2.9, 7.6], look: [0, 1.5, -1.6], fov: 43 },
    { f: 330, pos: [5.4, 2.5, 6.4], look: [0, 1.35, -2.0], fov: 41, ease: 'surge' },
    { f: 375, pos: [5.0, 2.4, 6.8], look: [0, 1.3, -1.9], fov: 41 },
  ],
  guards: [
    { f: 376, pos: [5.0, 2.4, 6.8], look: [0, 1.3, -1.9], fov: 41 },
    { f: 445, pos: [0.4, 2.0, 5.4], look: [-0.4, 1.35, -2.3], fov: 40, ease: 'surge' },
    { f: 516, pos: [-0.4, 2.0, 5.6], look: [0.2, 1.35, -2.2], fov: 40 },
  ],
  problem: [
    { f: 517, pos: [-0.4, 2.0, 5.6], look: [0.2, 1.35, -2.2], fov: 40 },
    { f: 585, pos: [0.9, 1.9, 4.6], look: [0, 1.25, 0.6], fov: 38, ease: 'surge' },
    { f: 657, pos: [0.7, 1.9, 4.8], look: [0, 1.25, 0.5], fov: 38 },
  ],
  question: [
    { f: 658, pos: [0.7, 1.9, 4.8], look: [0, 1.25, 0.5], fov: 38 },
    { f: 720, pos: [1.9, 2.0, 5.2], look: [4.0, 1.15, 0.6], fov: 39, ease: 'surge' },
    { f: 787, pos: [1.5, 2.0, 6.4], look: [4.2, 1.3, 2.2], fov: 39 },
  ],
  ask: [
    { f: 788, pos: [1.5, 2.0, 6.4], look: [4.2, 1.3, 2.2], fov: 39 },
    { f: 880, pos: [-0.6, 2.0, 5.2], look: [-1.7, 1.3, -1.6], fov: 39, ease: 'surge' },
    { f: 976, pos: [-0.8, 2.0, 5.4], look: [-1.8, 1.3, -1.7], fov: 39 },
  ],
  point: [
    { f: 977, pos: [1.5, 2.0, 6.4], look: [4.2, 1.3, 2.2], fov: 39 },
    { f: 1014, pos: [-0.9, 2.0, 5.6], look: [-2.6, 1.25, -2.2], fov: 40, ease: 'surge' },
  ],
  exit: [
    { f: 1015, pos: [-0.9, 2.0, 5.6], look: [-2.6, 1.25, -2.2], fov: 40 },
    { f: 1075, pos: [-0.9, 2.0, 5.4], look: [-2.1, 1.2, -2.3], fov: 39, ease: 'surge' },
    { f: 1132, pos: [-1.1, 2.0, 5.6], look: [-2.2, 1.2, -2.4], fov: 39 },
  ],
  explain: [
    { f: 1133, pos: [-1.1, 2.0, 5.6], look: [-2.2, 1.2, -2.4], fov: 39 },
    { f: 1240, pos: [1.8, 2.4, 7.4], look: [0, 1.3, -1.4], fov: 42, ease: 'surge' },
    { f: 1381, pos: [2.2, 2.4, 7.8], look: [0.2, 1.3, -1.3], fov: 42 },
  ],
  hook: [
    { f: 1382, pos: [2.2, 2.4, 7.8], look: [0.2, 1.3, -1.3], fov: 42 },
    { f: 1470, pos: [4.6, 2.2, 4.6], look: [6.3, 1.4, -1], fov: 40, ease: 'surge' },
    { f: 1574, pos: [4.9, 2.1, 4.2], look: [6.45, 1.45, -1], fov: 38 },
  ],
};
const camAt_en = (f) => camFromKeys(CAMS[shotAt_en(f).id], f);
const dofAt_en = (f) => {
  const S = shotAt_en(f), C = camAt_en(f);
  const hp = heroPosAt_en(f);
  let cinf = 5;
  if (S.id === 'problem' || S.id === 'ask' || S.id === 'point') cinf = 4;
  if (S.id === 'landing') cinf = 4.5;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
const worldAt_en = (f) => {
  const S = shotAt_en(f);
  const W = { boardDoors: 0, boardQuestion: 0, boardFree: 0, planeK: 0, glowL: 0, skullK: 0, doorLK: 0, doorRK: 0, crownK: 0, dustK: 0 };
  switch (S.id) {
    case 'landing': W.planeK = ramp(f, 6, 168); W.dustK = smooth(ramp(f, 150, 168)) * (1 - smooth(ramp(f, 172, 187))); break;
    case 'doors': W.boardDoors = smooth(ramp(f, 235, 268)); break;
    case 'stakes': W.boardDoors = 1; W.glowL = smooth(ramp(f, 292, 322)); W.skullK = smooth(ramp(f, 322, 352)); break;
    case 'guards': W.boardDoors = 1 - smooth(ramp(f, 376, 396)); W.glowL = 0.55; W.skullK = 0.55; break;
    case 'problem': W.glowL = 0.4; W.skullK = 0.4; break;
    case 'question': W.glowL = 0.4; W.skullK = 0.4; W.boardQuestion = smooth(ramp(f, 770, 785)); break;
    case 'ask': W.glowL = 0.4; W.skullK = 0.4; W.boardQuestion = 1 - ramp(f, 788, 798); break;
    case 'point': W.glowL = 0.4; W.skullK = 1; break;
    case 'exit': W.glowL = 1; W.skullK = 0.4; W.doorLK = smooth(ramp(f, 1032, 1072)); W.boardFree = smooth(ramp(f, 1078, 1108)); break;
    case 'explain': W.glowL = 1; W.doorLK = 1; W.boardFree = 1 - smooth(ramp(f, 1133, 1163)); W.boardQuestion = 1 - smooth(ramp(f, 1133, 1163)); break;
    case 'hook': W.glowL = 1; W.doorLK = 1; W.crownK = 0.6 + 0.4 * Math.sin(f * 0.3); break;
  }
  return W;
};
const fxProfileAt_en = (f) => {
  const W = worldAt_en(f);
  return { smokeRate: 0.35, dustRate: 0.1, torchRate: 7, landDustRate: W.dustK * 16 };
};

// ---------- actors ----------
const TINT = { golden: '#ffd9a3', torch: '#ffdfae' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  prisoner: { jacket: '#8a6a42', pants: '#4a4238', boots: '#2e2a26', skin: '#c99067' },
  guardA: { jacket: '#31517d', pants: '#22344d', boots: '#1e1a16', hat: 'cap', cap: '#c8ccd4', skin: '#f5c9a0' },
  guardB: { jacket: '#5d2e3a', pants: '#2e2226', boots: '#1e1a16', hat: 'cap', cap: '#8a8f98', skin: '#8a5a3b' },
  pilot: { jacket: '#2c3e57', pants: '#22344d', boots: '#1e1a16', hat: 'cap', cap: '#eef2f6', skin: '#f5c9a0' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: pos[1], ...extra });

/** Skull vision-card over the death door (s3/s8), drawn with the Pen. */
const skullCard = (p, k) => {
  p.ell(300, 400, 150, 140, '#e8e2d2', 6);
  p.ell(245, 392, 34, 42, '#17130e'); p.ell(355, 392, 34, 42, '#17130e');
  p.poly([[300, 432], [284, 466], [316, 466]], '#17130e');
  p.poly([[248, 498], [352, 498], [352, 562], [248, 562]], '#e8e2d2', 5);
  for (let i = 0; i < 4; i++) p.stroke([[264 + i * 25, 504], [264 + i * 25, 556]], 6, '#17130e');
};

const actorsAt_en = (f, T) => {
  const S = shotAt_en(f), tint = tintFor(S), out = [];
  const stand = (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
  const W = worldAt_en(f);
  if (S.id === 'landing') {
    if (f > 168) out.push(stand(OUTFITS.pilot, 'relief', 61, [37.2, 0, 2.6], { yaw: -0.5, s: 0.95 }));
    return out;
  }
  // chamber cast
  const prisonerPos = (() => {
    if (S.id === 'exit') { const k = smooth(ramp(f, 1020, 1096)); return [lerp(0, -2.2, k), 0, lerp(0.8, -2.2, k)]; }
    if (S.id === 'explain' || S.id === 'hook') return [-3.4, 0, -3.6]; // outside, in the meadow light
    return [0, 0, 0.8];
  })();
  const pExpr = S.id === 'problem' ? 'nervous' : S.id === 'question' || S.id === 'ask' ? 'grin' : S.id === 'exit' || S.id === 'explain' || S.id === 'hook' ? 'laugh' : 'stern';
  if (!(S.id === 'doors' && f < 235)) {
    const pExtra = { yaw: 0 };
    if (S.id === 'ask') pExtra.yaw = -0.55;
    if (S.id === 'problem') pExtra.headTilt = q(Math.sin(f * 0.05) * 6, 1);
    out.push(RW(T, OUTFITS.prisoner, { expr: pExpr, mode: S.id === 'exit' && f < 1096 ? 'march' : 'stand', phase: q((f * 0.055) % 1, 2), blink: blinkAt(f, 71), seed: 71, wave: S.id === 'question' ? q(0.5 + 0.5 * Math.sin(f * 0.4), 2) : 0 }, prisonerPos, { tint, ...pExtra }));
  }
  if (S.id === 'point') { // guard A points at the RIGHT (death) door
    out.push(RW(T, OUTFITS.guardA, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 72), seed: 72, wave: 1 }, [-3.6, 0, -2.2], { tint, yaw: 0.55 }));
    out.push(stand(OUTFITS.guardB, 'stern', 73, [3.6, 0, -2.2], { yaw: -0.35 }));
  } else if (S.id !== 'doors' || f >= 250) {
    const gExpr = S.id === 'explain' ? 'grin' : 'stern';
    out.push(stand(OUTFITS.guardA, gExpr, 72, [-3.6, 0, -2.2], { yaw: 0.35 }));
    out.push(stand(OUTFITS.guardB, gExpr, 73, [3.6, 0, -2.2], { yaw: -0.35 }));
  }
  if (W.skullK > 0.02 && (S.id === 'stakes' || S.id === 'point')) {
    out.push(FXC('skull' + q(W.skullK, 2), (p) => skullCard(p, W.skullK), [2.2, 2.3, -2.55], 0.62, { alpha: W.skullK }));
  }
  return out;
};
const fxAt_en = (f, T) => [];

export const SHOTS = [
  { id: 'landing', a: 0, b: 174, light: 'golden' },
  { id: 'doors', a: 175, b: 286, light: 'torch' },
  { id: 'stakes', a: 287, b: 378, light: 'torch' },
  { id: 'guards', a: 379, b: 513, light: 'torch' },
  { id: 'problem', a: 514, b: 651, light: 'torch' },
  { id: 'question', a: 652, b: 777, light: 'torch' },
  { id: 'ask', a: 778, b: 999, light: 'torch' },
  { id: 'point', a: 1000, b: 1070, light: 'torch' },
  { id: 'exit', a: 1071, b: 1175, light: 'torch' },
  { id: 'explain', a: 1176, b: 1392, light: 'torch' },
  { id: 'hook', a: 1393, b: 1544, light: 'torch' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
// ---------- HINDI retime wrapper (generated by retime.py) ----------
// Piecewise-linear EN->HI frame warp on phrase anchors; EN logic verbatim.
const WARP = [[0,0], [163,163], [188,175], [271,282], [285,287], [355,371], [376,379], [501,502], [517,514], [633,643], [658,652], [773,765], [788,778], [955,986], [977,1000], [1015,1071], [1015,1082], [1106,1167], [1133,1176], [1358,1393], [1382,1393], [1567,1544], [1575,1545]];
export const enFrame = (f) => {
  if (f <= 0) return 0;
  for (let i = 1; i < WARP.length; i++) {
    if (f <= WARP[i][0]) {
      const [x0, y0] = WARP[i - 1], [x1, y1] = WARP[i];
      return y0 + (y1 - y0) * (f - x0) / Math.max(1, x1 - x0);
    }
  }
  return WARP[WARP.length - 1][1];
};
const hiFrame = (e) => {
  if (e <= 0) return 0;
  for (let i = 1; i < WARP.length; i++) {
    if (e <= WARP[i][1]) {
      const [x0, y0] = WARP[i - 1], [x1, y1] = WARP[i];
      return x0 + (x1 - x0) * (e - y0) / Math.max(1, y1 - y0);
    }
  }
  return WARP[WARP.length - 1][0];
};
export const shotAt = (f) => shotAt_en(hiFrame(f));
export const camAt = (f) => camAt_en(hiFrame(f));
export const dofAt = (f) => dofAt_en(hiFrame(f));
export const worldAt = (f) => worldAt_en(hiFrame(f));
export const fxProfileAt = (f) => fxProfileAt_en(hiFrame(f));
export const heroPosAt = (f) => heroPosAt_en(hiFrame(f));
export const lightFor = (S, f) => lightFor_en(S, hiFrame(f));
export const actorsAt = (f, T) => actorsAt_en(hiFrame(f), T);
export const fxAt = (f, T) => fxAt_en(hiFrame(f), T);
