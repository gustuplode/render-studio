// Shot plan for "The Well and the Water — the Rent Trick" (T5 of the
// trick batch) — timed to well-voice (51.69 s, 30 fps, TOTAL 1551).
// Phrases: L1 0-115 | L2 128-226 | L3 237-368 | L4 377-451 | L5 470-622 |
// L6 638-740 | L7 752-914 | L8 931-980 | L9 994-1110 | L10 1125-1238 |
// L11 1261-1347 | L12 TEASE 1371-1538 (the king's treasury).
// World: ONE village — the well at origin, huts behind, the panchayat
// tree + platform west; the king's treasury far east for the night hook.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1392, DECK = 0;
const SHOTS_EN = [
  { id: 'deal', a: 0, b: 127, light: 'day' },
  { id: 'nextday', a: 128, b: 236, light: 'day' },
  { id: 'stop', a: 237, b: 376, light: 'day' },
  { id: 'stunned', a: 377, b: 469, light: 'day' },
  { id: 'council', a: 470, b: 637, light: 'day' },
  { id: 'elder', a: 638, b: 751, light: 'day' },
  { id: 'rent', a: 752, b: 930, light: 'golden' },
  { id: 'mouth', a: 931, b: 993, light: 'golden' },
  { id: 'choice', a: 994, b: 1124, light: 'golden' },
  { id: 'folded', a: 1125, b: 1260, light: 'golden' },
  { id: 'moral', a: 1261, b: 1370, light: 'golden' },
  { id: 'hook', a: 1371, b: 1550, light: 'night' },
];
const TIMING_EN = SHOTS_EN.map((s) => [s.id, s.a, s.b]);
const shotAt_en = (f) => SHOTS_EN.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS_EN[0] : SHOTS_EN[SHOTS_EN.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  golden: { az: 100, el: 22, sky: '#d9b28c', ground: '#5c5a34', hemi: 1.16, sun: '#ffb763', sunI: 2.4, fog: '#e5cf9e', fogNear: 42, fogFar: 340,
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
const lightFor_en = (S, f) => {
  if (S.id === 'hook') return blendLight(LIGHTS.golden, LIGHTS.night, smooth(ramp(f, 1371, 1440)));
  if (S.id === 'rent') return blendLight(LIGHTS.day, LIGHTS.golden, smooth(ramp(f, 752, 830)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const WELLP = [0, 0, 0];
export const COUNCIL = [-7.3, 0, -3.4];
export const TREASURY = [25, 0, -5.6];

/** The bucket on its rope: dips in nextday + moral. Returns [x, y, z]. */
export const bucketAt = (f) => {
  const S = shotAt_en(f);
  let dip = 0;
  if (S.id === 'nextday') dip = Math.sin(ramp(f, 150, 220) * Math.PI) * 0.5;
  if (S.id === 'moral') dip = Math.sin(ramp(f, 1270, 1355) * Math.PI) * 0.8;
  return [0, 1.72 - dip, 0];
};

const heroPosAt_en = (f) => {
  const S = shotAt_en(f);
  switch (S.id) {
    case 'deal': case 'nextday': return [0.4, 0.9, 0.4];
    case 'stop': return [-2.4, 1.0, 1.2];
    case 'stunned': return [1.1, 1.0, 2.0];
    case 'council': return [-6.2, 0.9, -3.2];
    case 'elder': case 'rent': case 'choice': return [-7.6, 1.05, -3.4];
    case 'mouth': case 'folded': return [-5.2, 1.0, -1.7];
    case 'moral': return [0.6, 0.9, 0.5];
    case 'hook': return [23.5, 1.2, -3.2];
    default: return [0, 1, 0];
  }
};

// ---------- cameras ----------
const CAMS = {
  deal: [
    { f: 0, pos: [5.2, 2.6, 6.8], look: [0.4, 0.9, 0.2], fov: 42 },
    { f: 60, pos: [4.6, 2.3, 6.0], look: [0.5, 0.9, 0.3], fov: 40, ease: 'surge' },
    { f: 127, pos: [4.2, 2.2, 5.6], look: [0.5, 0.95, 0.3], fov: 40 },
  ],
  nextday: [
    { f: 128, pos: [4.2, 2.2, 5.6], look: [0.5, 0.95, 0.3], fov: 40 },
    { f: 180, pos: [-4.4, 2.0, 5.2], look: [0.6, 0.9, 0.6], fov: 40, ease: 'surge' },
    { f: 236, pos: [-4.0, 1.9, 4.8], look: [0.7, 0.95, 0.6], fov: 39 },
  ],
  stop: [
    { f: 237, pos: [-4.0, 1.9, 4.8], look: [0.7, 0.95, 0.6], fov: 39 },
    { f: 300, pos: [-3.4, 1.8, 3.9], look: [-0.9, 1.0, 0.9], fov: 38, ease: 'surge' },
    { f: 376, pos: [-3.1, 1.8, 3.6], look: [-0.9, 1.0, 0.9], fov: 37 },
  ],
  stunned: [
    { f: 377, pos: [-3.1, 1.8, 3.6], look: [-0.9, 1.0, 0.9], fov: 37 },
    { f: 415, pos: [2.6, 1.7, 3.4], look: [1.3, 1.0, 0.9], fov: 38, ease: 'surge' },
    { f: 469, pos: [-1.5, 2.4, 6.5], look: [-3.5, 0.8, -1.5], fov: 44 },
  ],
  council: [
    { f: 470, pos: [-1.5, 2.4, 6.5], look: [-3.5, 0.8, -1.5], fov: 44 },
    { f: 560, pos: [-3.2, 2.1, 3.4], look: [-6.2, 0.9, -3.2], fov: 42, ease: 'surge' },
    { f: 637, pos: [-3.4, 2.0, 3.0], look: [-6.4, 0.9, -3.3], fov: 41 },
  ],
  elder: [
    { f: 638, pos: [-3.4, 2.0, 3.0], look: [-6.4, 0.9, -3.3], fov: 41 },
    { f: 700, pos: [-4.6, 1.9, 0.6], look: [-7.6, 1.05, -3.4], fov: 38, ease: 'surge' },
    { f: 751, pos: [-4.8, 1.9, 0.4], look: [-7.6, 1.05, -3.4], fov: 37 },
  ],
  rent: [
    { f: 752, pos: [-4.8, 1.9, 0.4], look: [-7.6, 1.05, -3.4], fov: 37 },
    { f: 840, pos: [-4.4, 2.0, 0.8], look: [-6.6, 1.0, -2.6], fov: 39, ease: 'surge' },
    { f: 930, pos: [-4.2, 2.0, 1.0], look: [-6.4, 1.0, -2.6], fov: 39 },
  ],
  mouth: [
    { f: 931, pos: [-4.2, 2.0, 1.0], look: [-6.4, 1.0, -2.6], fov: 39 },
    { f: 962, pos: [-3.0, 1.8, 1.4], look: [-5.2, 1.05, -1.8], fov: 36, ease: 'surge' },
    { f: 993, pos: [-2.9, 1.8, 1.3], look: [-5.2, 1.05, -1.8], fov: 36 },
  ],
  choice: [
    { f: 994, pos: [-2.9, 1.8, 1.3], look: [-5.2, 1.05, -1.8], fov: 36 },
    { f: 1060, pos: [-4.8, 1.9, 0.2], look: [-7.4, 1.05, -3.2], fov: 38, ease: 'surge' },
    { f: 1124, pos: [-5.0, 1.9, 0.0], look: [-7.4, 1.05, -3.2], fov: 37 },
  ],
  folded: [
    { f: 1125, pos: [-5.0, 1.9, 0.0], look: [-7.4, 1.05, -3.2], fov: 37 },
    { f: 1190, pos: [-3.2, 1.9, 1.6], look: [-5.0, 0.95, -1.9], fov: 38, ease: 'surge' },
    { f: 1260, pos: [1.5, 2.4, 6.0], look: [0.2, 0.8, 0.2], fov: 43 },
  ],
  moral: [
    { f: 1261, pos: [1.5, 2.4, 6.0], look: [0.2, 0.8, 0.2], fov: 43 },
    { f: 1320, pos: [4.4, 2.2, 5.2], look: [0.6, 0.9, 0.5], fov: 40, ease: 'surge' },
    { f: 1370, pos: [7.5, 2.6, 6.0], look: [12.0, 1.2, -2.0], fov: 44 },
  ],
  hook: [
    { f: 1371, pos: [7.5, 2.6, 6.0], look: [12.0, 1.2, -2.0], fov: 44 },
    { f: 1440, pos: [16.5, 2.2, 3.5], look: [24.5, 1.6, -5.0], fov: 38, ease: 'surge' },
    { f: 1550, pos: [17.8, 2.1, 2.6], look: [24.6, 1.7, -5.2], fov: 36 },
  ],
};
const camAt_en = (f) => camFromKeys(CAMS[shotAt_en(f).id], f);
const dofAt_en = (f) => {
  const S = shotAt_en(f), C = camAt_en(f);
  const hp = heroPosAt_en(f);
  let cinf = 5;
  if (S.id === 'stop' || S.id === 'mouth' || S.id === 'rent') cinf = 4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
const worldAt_en = (f) => {
  const S = shotAt_en(f);
  const W = { boardSold: 0, boardWater: 0, boardRent: 0, boardTreasury: 0, goldK: 0 };
  switch (S.id) {
    case 'deal': W.boardSold = smooth(ramp(f, 18, 45)); break;
    case 'nextday': W.boardSold = 1 - smooth(ramp(f, 128, 141)); break;
    case 'stop': W.boardWater = smooth(ramp(f, 292, 312)); break;
    case 'stunned': W.boardWater = 1 - smooth(ramp(f, 377, 387)); break;
    case 'rent': W.boardRent = smooth(ramp(f, 824, 846)) * (1 - smooth(ramp(f, 895, 925))); break;
    case 'hook': W.boardTreasury = smooth(ramp(f, 1470, 1500)); W.goldK = 0.5 + 0.5 * Math.sin(f * 0.15); break;
  }
  return W;
};
const fxProfileAt_en = (f) => {
  const S = shotAt_en(f);
  return { smokeRate: 0.35, dustRate: 0.1, splashRate: (S.id === 'nextday' && f >= 165 && f <= 215) || (S.id === 'moral' && f >= 1280 && f <= 1350) ? 9 : 0 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', golden: '#ffd9a3', night: '#aebedd' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  seller: { jacket: '#7a4a8c', pants: '#3c2c44', boots: '#2e2118', hat: 'cap', cap: '#4a2c5c', skin: '#e8b08a' },
  farmer: { jacket: '#4a7a3a', pants: '#37452a', boots: '#2e2a26', hat: 'cap', cap: '#d8cba8', skin: '#c98a5a' },
  elder: { jacket: '#e3ded2', pants: '#b8b0a0', boots: '#5a5148', hat: 'hair', hair: '#d8d8d2', skin: '#d9a878' },
  elder2: { jacket: '#8c6a4a', pants: '#4a3c2c', boots: '#2e2a26', hat: 'cap', cap: '#6a4a2e', skin: '#c98a5a' },
  elder3: { jacket: '#5a6a8c', pants: '#333c4e', boots: '#2e2a26', hat: 'cap', cap: '#3c4a66', skin: '#e8b08a' },
  thief: { jacket: '#2c2c34', pants: '#1e1e24', boots: '#141416', hat: 'cap', cap: '#1c1c22', skin: '#c98a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });

const actorsAt_en = (f, T) => {
  const S = shotAt_en(f), tint = tintFor(S), out = [];
  const st = stand(T, tint, f);
  const councilCast = (elderExpr, sellerExpr) => {
    const standK = (S.id === 'elder' || S.id === 'rent' || S.id === 'choice') ? M.easeInOut(clamp((f - 645) / 25)) : (S.id === 'council' ? 0 : 1);
    out.push(RW(T, OUTFITS.elder, { expr: elderExpr, mode: 'stand', blink: blinkAt(f, 83), seed: 83, wave: S.id === 'rent' ? q(0.5 + 0.5 * Math.sin(f * 0.3), 2) : 0 }, [-7.6, lerp(-0.22, 0.28, standK), -3.4, 0.28], { tint, yaw: 0.65 }));
    out.push(st(OUTFITS.elder2, 'neutral', 84, [-8.6, 0.28, -2.6], { yaw: 0.8 }));
    out.push(st(OUTFITS.elder3, 'neutral', 85, [-6.6, 0.28, -4.3], { yaw: 0.5 }));
    out.push(st(OUTFITS.seller, sellerExpr, 81, [-5.2, 0, -1.7], { yaw: 0.8, wave: S.id === 'council' ? q(0.5 + 0.5 * Math.sin(f * 0.15), 2) : 0 }));
    out.push(st(OUTFITS.farmer, S.id === 'folded' ? 'smile' : 'nervous', 82, [-4.3, 0, -2.2], { yaw: 0.9 }));
  };
  switch (S.id) {
    case 'deal': {
      out.push(RW(T, OUTFITS.seller, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 81), seed: 81, wave: q(Math.sin(ramp(f, 30, 70) * Math.PI), 2) }, [2.4, 0, 1.5], { tint, yaw: 0.5 }));
      out.push(st(OUTFITS.farmer, 'smile', 82, [-2.3, 0, 1.6], { yaw: -0.5 }));
      break;
    }
    case 'nextday': {
      out.push(st(OUTFITS.seller, 'stern', 81, [-2.4, 0, 1.2], { yaw: 0.8 }));
      const wp = kf3([[128, [3.6, 0, 3.6]], [183, [1.1, 0, 2.0]]], f);
      out.push(RW(T, OUTFITS.farmer, { expr: 'smile', mode: f < 183 ? 'march' : 'stand', phase: q((f * 0.09) % 1, 2), blink: blinkAt(f, 82), seed: 82 }, wp, { tint, yaw: -0.8 }));
      break;
    }
    case 'stop': {
      out.push(RW(T, OUTFITS.seller, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 81), seed: 81, wave: 0.7 }, [-2.4, 0, 1.2], { tint, yaw: 0.7 }));
      out.push(st(OUTFITS.farmer, 'nervous', 82, [1.1, 0, 2.0], { yaw: -0.7 }));
      break;
    }
    case 'stunned': {
      out.push(st(OUTFITS.farmer, 'shock', 82, [1.1, 0, 2.0], { yaw: -0.6, s: 1.05 }));
      out.push(st(OUTFITS.seller, 'stern', 81, [-2.4, 0, 1.2], { yaw: 0.7 }));
      break;
    }
    case 'council': councilCast('neutral', 'stern'); break;
    case 'elder': councilCast('stern', 'nervous'); break;
    case 'rent': councilCast('stern', 'nervous'); break;
    case 'mouth': councilCast('stern', 'shock'); break;
    case 'choice': councilCast('stern', 'nervous'); break;
    case 'folded': {
      councilCast('grin', 'pained');
      out.splice(3, 1); // replace the council seller with the bowing one
      out.push(RW(T, OUTFITS.seller, { expr: 'pained', mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: q(14, 1), wave: 0.25 }, [-5.0, 0, -1.9], { tint, yaw: 0.7 }));
      break;
    }
    case 'moral': {
      out.push(RW(T, OUTFITS.farmer, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 82), seed: 82, wave: q(0.5 + 0.5 * Math.sin(f * 0.12), 2) }, [1.1, 0, 2.0], { tint, yaw: -0.7 }));
      const wp = kf3([[1261, [-2.4, 0, 1.4]], [1351, [-7.5, 0, 3.5]]], f);
      out.push(RW(T, OUTFITS.seller, { expr: 'pained', mode: f < 1351 ? 'march' : 'stand', phase: q((f * 0.09) % 1, 2), blink: blinkAt(f, 81), seed: 81, headTilt: q(8, 1) }, wp, { tint, yaw: -0.9 }));
      break;
    }
    case 'hook': {
      const wp = kf3([[1371, [20.6, 0, -1.6]], [1501, [22.6, 0, -3.0]]], f);
      out.push(RW(T, OUTFITS.thief, { expr: 'nervous', mode: f < 1501 ? 'march' : 'stand', phase: q((f * 0.085) % 1, 2), blink: blinkAt(f, 86), seed: 86, headTilt: q(6, 1) }, wp, { tint, yaw: 0.85 }));
      break;
    }
  }
  return out;
};
const fxAt_en = (f, T) => [];

export const SHOTS = [
  { id: 'deal', a: 0, b: 136, light: 'day' },
  { id: 'nextday', a: 137, b: 229, light: 'day' },
  { id: 'stop', a: 230, b: 363, light: 'day' },
  { id: 'stunned', a: 364, b: 439, light: 'day' },
  { id: 'council', a: 440, b: 571, light: 'day' },
  { id: 'elder', a: 572, b: 696, light: 'day' },
  { id: 'rent', a: 697, b: 837, light: 'golden' },
  { id: 'mouth', a: 838, b: 897, light: 'golden' },
  { id: 'choice', a: 898, b: 1009, light: 'golden' },
  { id: 'folded', a: 1010, b: 1111, light: 'golden' },
  { id: 'moral', a: 1112, b: 1216, light: 'golden' },
  { id: 'hook', a: 1217, b: 1391, light: 'night' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
// ---------- HINDI retime wrapper (generated by retime.py) ----------
// Piecewise-linear EN->HI frame warp on phrase anchors; EN logic verbatim.
const WARP = [[0,0], [115,132], [128,137], [226,227], [237,230], [368,356], [377,364], [451,433], [470,440], [622,572], [638,572], [740,693], [752,697], [914,829], [931,838], [980,894], [994,898], [1110,1005], [1125,1010], [1238,1103], [1261,1112], [1347,1209], [1371,1217], [1538,1391], [1551,1392]];
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
